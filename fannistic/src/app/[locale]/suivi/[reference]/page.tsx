import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download, FileText, Lock } from "lucide-react";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/auth";
import { findAccessibleRequest } from "@/server/requests";
import { getSiteDict } from "@/server/site";
import { fmt, formatCents, formatDate, formatSize, isLocale, type Locale } from "@/i18n";
import { SnapshotView, type Snapshot } from "@/components/tracking/SnapshotView";
import { StatusBadge } from "@/components/tracking/StatusBadge";
import { QuoteActions } from "@/components/tracking/QuoteActions";
import { MessageComposer } from "@/components/tracking/MessageComposer";
import { LinkAccount } from "@/components/tracking/LinkAccount";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface QuoteItem {
  label: string;
  quantity: number;
  unitPrice: number;
}

export default async function TrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; reference: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale: raw, reference } = await params;
  const { t } = await searchParams;
  const locale = (isLocale(raw) ? raw : "fr") as Locale;
  const d = await getSiteDict(locale);
  const user = await getSessionUser();
  const base = await findAccessibleRequest(reference, t, user);

  if (!base) {
    return (
      <div className="container-x py-20">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-paper-2">
            <Lock className="h-5 w-5 text-ink-muted" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl">{d.tracking.invalid}</h1>
          <p className="mt-3 text-ink-2">{d.account.emptyHelp}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/${locale}/espace/connexion`} className="btn-dark">{d.account.loginCta}</Link>
            <Link href={`/${locale}`} className="btn-ghost">{d.confirmation.home}</Link>
          </div>
        </div>
      </div>
    );
  }

  const request = await prisma.projectRequest.findUniqueOrThrow({
    where: { id: base.id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      quotes: { where: { status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" } },
      messages: { orderBy: { createdAt: "asc" }, include: { files: { select: { id: true, originalName: true } } } },
      files: { where: { messageId: null }, select: { id: true, originalName: true, size: true, kind: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const tq = t ? `&t=${encodeURIComponent(t)}` : "";
  const fileUrl = (id: string) => `/api/files/${id}?dl=1${tq}`;
  const tr = d.tracking;
  const quote = request.quotes[0];
  const deliverables = request.files.filter((f) => f.kind === "DELIVERABLE");
  const attachments = request.files.filter((f) => f.kind === "CLIENT_ATTACHMENT");
  const canLink = Boolean(user && t && !request.userId && user.role !== "ADMIN");

  return (
    <div className="bg-paper-2/60">
      <div className="container-x py-10 sm:py-14">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="eyebrow">{request.kind === "CALL" ? tr.kindCall : tr.kindQuote}</p>
            <h1 className="mt-2 text-2xl sm:text-3xl" dir="auto">
              {fmt(tr.title, { reference: request.reference })}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">{fmt(tr.sentOn, { date: formatDate(request.createdAt, locale) })}</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <StatusBadge status={request.status} label={d.status[request.status]} />
            {canLink && <LinkAccount reference={request.reference} token={t!} d={d} />}
          </div>
        </div>

        {request.status === "INFO_NEEDED" && (
          <p className="mt-6 flex items-start gap-3 rounded-xl bg-gold-soft px-4 py-3 text-sm font-medium text-midnight" role="status">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {tr.infoNeeded}
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-6">
            {quote && (
              <section className="card p-5 sm:p-6" aria-labelledby="quote-title">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="quote-title" className="text-lg">{tr.quote}</h2>
                  {quote.validUntil && quote.status === "SENT" && (
                    <span className="text-xs text-ink-muted">{fmt(tr.validUntil, { date: formatDate(quote.validUntil, locale) })}</span>
                  )}
                </div>
                {quote.message && <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{quote.message}</p>}
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-ink-muted">
                      <th scope="col" className="py-2 text-start font-medium">{tr.quoteItem}</th>
                      <th scope="col" className="py-2 text-end font-medium">{tr.quoteQty}</th>
                      <th scope="col" className="hidden py-2 text-end font-medium sm:table-cell">{tr.quoteUnit}</th>
                      <th scope="col" className="py-2 text-end font-medium">{tr.quoteTotal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(quote.items as unknown as QuoteItem[]).map((it, i) => (
                      <tr key={i} className="border-b border-line/70 align-top">
                        <td className="break-words py-2.5 pe-3">{it.label}</td>
                        <td className="py-2.5 text-end">{it.quantity}</td>
                        <td className="hidden whitespace-nowrap py-2.5 ps-3 text-end sm:table-cell">{formatCents(it.unitPrice, quote.currency, locale)}</td>
                        <td className="whitespace-nowrap py-2.5 ps-3 text-end">{formatCents(it.unitPrice * it.quantity, quote.currency, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 flex items-baseline justify-between gap-3 border-t-2 border-midnight pt-3">
                  <span className="font-semibold">{tr.quoteTotal}</span>
                  <span className="text-xl font-bold">{formatCents(quote.total, quote.currency, locale)}</span>
                </p>
                {quote.status === "SENT" && <QuoteActions reference={request.reference} token={t ?? null} quoteId={quote.id} d={d} />}
                {quote.status === "ACCEPTED" && quote.respondedAt && (
                  <p className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">{fmt(tr.accepted, { date: formatDate(quote.respondedAt, locale) })}</p>
                )}
                {quote.status === "REJECTED" && quote.respondedAt && (
                  <p className="mt-4 rounded-xl bg-paper-2 px-4 py-3 text-sm text-ink-2">{fmt(tr.rejected, { date: formatDate(quote.respondedAt, locale) })}</p>
                )}
              </section>
            )}

            <section className="card p-5 sm:p-6" aria-labelledby="msg-title">
              <h2 id="msg-title" className="text-lg">{tr.messages}</h2>
              {request.messages.length ? (
                <ol className="mt-4 space-y-3">
                  {request.messages.map((m) => {
                    const mine = m.authorRole === "CLIENT";
                    return (
                      <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? "ms-auto bg-midnight text-white" : "bg-paper-2 text-ink"}`}>
                        <p className={`text-xs font-semibold ${mine ? "text-gold-sun" : "text-cyan-deep"}`}>
                          {mine ? tr.you : tr.team} · <time dateTime={m.createdAt.toISOString()}>{formatDate(m.createdAt, locale, true)}</time>
                        </p>
                        {m.body && <p className="mt-1 whitespace-pre-line break-words">{m.body}</p>}
                        {m.files.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {m.files.map((f) => (
                              <li key={f.id}>
                                <a href={fileUrl(f.id)} className={`inline-flex items-center gap-1.5 underline underline-offset-2 ${mine ? "text-white" : "text-ink"}`}>
                                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> {f.originalName}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-ink-muted">{tr.noMessages}</p>
              )}
              {request.status !== "CANCELLED" && (
                <MessageComposer endpoint={`/api/requests/${request.reference}/messages`} token={t} d={d} placeholder={tr.messagePlaceholder} />
              )}
            </section>

            <section className="card p-5 sm:p-6" aria-labelledby="req-title">
              <h2 id="req-title" className="mb-4 text-lg">{tr.yourRequest}</h2>
              <SnapshotView snapshot={request.snapshot as unknown as Snapshot} locale={locale} d={d} currency={request.currency} />
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-5" aria-labelledby="hist-title">
              <h2 id="hist-title" className="text-base">{tr.history}</h2>
              <ol className="mt-4 space-y-4 border-s border-line ps-4">
                {request.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -start-[21px] top-1 h-2.5 w-2.5 rounded-full bg-gold ring-4 ring-white" aria-hidden="true" />
                    <p className="text-sm font-medium">{d.status[e.to]}</p>
                    <p className="text-xs text-ink-muted">{formatDate(e.createdAt, locale, true)}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="card p-5" aria-labelledby="deliv-title">
              <h2 id="deliv-title" className="text-base">{tr.deliverables}</h2>
              {deliverables.length ? (
                <FileList files={deliverables} href={fileUrl} locale={locale} />
              ) : (
                <p className="mt-2 text-sm text-ink-muted">{tr.noDeliverables}</p>
              )}
            </section>

            {attachments.length > 0 && (
              <section className="card p-5" aria-labelledby="att-title">
                <h2 id="att-title" className="text-base">{tr.attachments}</h2>
                <FileList files={attachments} href={fileUrl} locale={locale} />
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function FileList({ files, href, locale }: { files: { id: string; originalName: string; size: number }[]; href: (id: string) => string; locale: Locale }) {
  return (
    <ul className="mt-3 space-y-2">
      {files.map((f) => (
        <li key={f.id}>
          <a href={href(f.id)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper-2">
            <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{f.originalName}</span>
            <span className="text-xs text-ink-muted">{formatSize(f.size, locale)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
