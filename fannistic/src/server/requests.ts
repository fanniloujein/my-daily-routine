import "server-only";
import { Prisma, type RequestStatus } from "@prisma/client";
import { prisma } from "./db";
import { getServices } from "./catalog";
import { getPricing } from "./settings";
import { isMailConfigured, sendMail, siteUrl } from "./mail";
import { makeReference, randomToken, seal, sha256, unseal } from "./security";
import type { SessionUser } from "./auth";
import { computeEstimate, validateAllAnswers, type FieldError } from "@/lib/services/logic";
import { describeAnswers } from "@/lib/services/describe";
import { phoneRequired, type SubmissionInput } from "@/lib/services/project";
import { dir, fmt, formatCents, getDict, isLocale, type Locale } from "@/i18n";

export function trackingUrl(locale: string, reference: string, token: string | null) {
  const base = `${siteUrl()}/${locale}/suivi/${reference}`;
  return token ? `${base}?t=${encodeURIComponent(token)}` : base;
}

const linkFor = (req: { locale: string; reference: string; accessTokenEnc: string | null }) =>
  trackingUrl(req.locale, req.reference, unseal(req.accessTokenEnc));

export type CreateResult =
  | { ok: true; reference: string; token: string; emailSent: boolean }
  | { ok: false; errors: Record<string, Record<string, FieldError>>; unavailable?: string[] };

export async function createRequest(
  input: SubmissionInput,
  files: { name: string; mime: string; size: number; data: Uint8Array<ArrayBuffer> }[],
  user: SessionUser | null,
  ipHash: string,
): Promise<CreateResult> {
  const services = await getServices({ activeOnly: true });
  const selected = [...new Set(input.services)];
  const unavailable = selected.filter((s) => !services.some((d) => d.slug === s));
  if (unavailable.length) return { ok: false, errors: {}, unavailable };

  const { answers, errors } = validateAllAnswers(services, selected, input.answers);
  if (phoneRequired(input.contact.contactPref) && !input.contact.phone) {
    errors.contact = { ...(errors.contact ?? {}), phone: "required" };
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const pricing = await getPricing();
  const estimate = computeEstimate(services, selected, answers, input.project.deadline, pricing);
  const snapshot = { sections: describeAnswers(services, selected, answers), project: input.project };

  const token = randomToken();
  const c = input.contact;
  let reference = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    reference = makeReference();
    try {
      await prisma.projectRequest.create({
        data: {
          reference,
          accessTokenHash: sha256(token),
          accessTokenEnc: seal(token),
          kind: input.kind,
          services: selected,
          answers: { services: answers, project: input.project } as Prisma.InputJsonValue,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          estimateMin: estimate.kind === "range" ? estimate.min : null,
          estimateMax: estimate.kind === "range" ? estimate.max : null,
          currency: pricing.currency,
          name: c.name,
          email: c.email,
          phone: c.phone ?? null,
          company: c.company ?? null,
          country: c.country,
          contactPref: c.contactPref,
          comments: c.comments ?? null,
          locale: input.locale,
          ipHash,
          userId: user?.id ?? null,
          events: { create: { to: "RECEIVED" } },
          files: { create: files.map((f) => ({ kind: "CLIENT_ATTACHMENT" as const, originalName: f.name, mime: f.mime, size: f.size, data: f.data })) },
        },
      });
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }

  const d = getDict(input.locale);
  const url = trackingUrl(input.locale, reference, token);
  const emailSent = await sendMail({
    to: c.email,
    subject: fmt(d.email.confirmSubject, { reference }),
    text: `${fmt(d.email.confirmIntro, { name: c.name, reference })}\n\n${d.email.confirmTrack}\n\n${d.email.confirmOutro}`,
    link: { url, label: d.confirmation.track },
    rtl: dir(input.locale) === "rtl",
  });

  const notify = process.env.ADMIN_NOTIFY_EMAIL;
  if (notify && isMailConfigured()) {
    const names = selected.map((s) => services.find((x) => x.slug === s)?.name.fr ?? s).join(", ");
    await sendMail({
      to: notify,
      replyTo: c.email,
      subject: `Nouvelle demande ${reference} — ${input.kind === "CALL" ? "échange" : "devis"} (${names})`,
      text: `${c.name} <${c.email}>${c.company ? ` — ${c.company}` : ""}\nServices : ${names}\nPays : ${c.country}\nFichiers joints : ${files.length}`,
      link: { url: `${siteUrl()}/admin/demandes/${reference}`, label: "Ouvrir dans l’administration" },
    });
  }

  return { ok: true, reference, token, emailSent };
}

/**
 * Accès à une demande : administrateur, propriétaire connecté, ou détenteur du lien de suivi.
 */
export async function findAccessibleRequest(reference: string, token: string | null | undefined, user: SessionUser | null) {
  const req = await prisma.projectRequest.findUnique({ where: { reference } });
  if (!req) return null;
  if (user?.role === "ADMIN") return req;
  if (user && req.userId === user.id) return req;
  if (token && sha256(token) === req.accessTokenHash) return req;
  return null;
}

export async function changeStatus(requestId: string, to: RequestStatus, opts: { note?: string; notify?: boolean } = {}) {
  const req = await prisma.projectRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (req.status === to) return { emailSent: false };
  await prisma.$transaction([
    prisma.projectRequest.update({ where: { id: requestId }, data: { status: to } }),
    prisma.statusEvent.create({ data: { requestId, from: req.status, to, note: opts.note || null } }),
  ]);
  if (!opts.notify) return { emailSent: false };
  const locale: Locale = isLocale(req.locale) ? req.locale : "fr";
  const d = getDict(locale);
  const status = d.status[to];
  const emailSent = await sendMail({
    to: req.email,
    subject: fmt(d.email.statusSubject, { reference: req.reference, status }),
    text: `${fmt(d.email.statusIntro, { name: req.name, status })}${opts.note ? `\n\n${opts.note}` : ""}\n\n${d.email.signature}`,
    link: { url: linkFor(req), label: d.confirmation.track },
    rtl: locale === "ar",
  });
  return { emailSent };
}

export async function notifyQuote(requestId: string, total: number, currency: string) {
  const req = await prisma.projectRequest.findUniqueOrThrow({ where: { id: requestId } });
  const locale: Locale = isLocale(req.locale) ? req.locale : "fr";
  const d = getDict(locale);
  return sendMail({
    to: req.email,
    subject: fmt(d.email.quoteSubject, { reference: req.reference }),
    text: `${fmt(d.email.quoteIntro, { name: req.name, total: formatCents(total, currency, locale) })}\n\n${d.email.quoteCta}\n\n${d.email.signature}`,
    link: { url: linkFor(req), label: d.confirmation.track },
    rtl: locale === "ar",
  });
}

export async function notifyMessage(requestId: string, body: string) {
  const req = await prisma.projectRequest.findUniqueOrThrow({ where: { id: requestId } });
  const locale: Locale = isLocale(req.locale) ? req.locale : "fr";
  const d = getDict(locale);
  return sendMail({
    to: req.email,
    subject: fmt(d.email.messageSubject, { reference: req.reference }),
    text: `${fmt(d.email.messageIntro, { name: req.name })}\n\n${body}\n\n${d.email.signature}`,
    link: { url: linkFor(req), label: d.confirmation.track },
    rtl: locale === "ar",
  });
}
