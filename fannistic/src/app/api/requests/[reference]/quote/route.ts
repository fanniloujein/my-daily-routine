import { z } from "zod";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/auth";
import { changeStatus, findAccessibleRequest } from "@/server/requests";
import { error, json, sameOrigin } from "@/server/security";
import { isMailConfigured, sendMail, siteUrl } from "@/server/mail";

const schema = z.object({
  t: z.string().max(200).optional(),
  quoteId: z.string().max(40),
  action: z.enum(["accept", "reject"]),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  if (!sameOrigin(req)) return error("forbidden", 403);
  const { reference } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("bad_request", 400);
  const { t, quoteId, action, note } = parsed.data;

  const user = await getSessionUser();
  const request = await findAccessibleRequest(reference, t, user);
  if (!request) return error("not_found", 404);
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, requestId: request.id } });
  if (!quote) return error("not_found", 404);
  if (quote.status !== "SENT") return error("already_answered", 409);
  if (quote.validUntil && quote.validUntil.getTime() < Date.now() - 86_400_000) return error("expired", 409);

  // Mise à jour conditionnelle : évite une double réponse simultanée.
  const updated = await prisma.quote.updateMany({
    where: { id: quote.id, status: "SENT" },
    data: { status: action === "accept" ? "ACCEPTED" : "REJECTED", clientNote: note || null, respondedAt: new Date() },
  });
  if (updated.count === 0) return error("already_answered", 409);

  if (action === "accept") await changeStatus(request.id, "QUOTE_ACCEPTED", { note: note || "Devis accepté par le client" });
  else await changeStatus(request.id, "IN_REVIEW", { note: note ? `Devis refusé : ${note}` : "Devis refusé par le client" });

  const notify = process.env.ADMIN_NOTIFY_EMAIL;
  if (notify && isMailConfigured()) {
    await sendMail({
      to: notify,
      subject: `Devis ${action === "accept" ? "accepté" : "refusé"} — ${request.reference}`,
      text: `${request.name} a ${action === "accept" ? "accepté" : "refusé"} la proposition.${note ? `\n\nRemarque : ${note}` : ""}`,
      link: { url: `${siteUrl()}/admin/demandes/${request.reference}`, label: "Ouvrir la demande" },
    });
  }
  return json({ ok: true });
}
