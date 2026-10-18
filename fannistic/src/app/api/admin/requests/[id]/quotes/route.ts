import { z } from "zod";
import { prisma } from "@/server/db";
import { guardAdmin, readJson } from "@/server/admin";
import { changeStatus, notifyQuote } from "@/server/requests";
import { error, json } from "@/server/security";

const schema = z.object({
  quoteId: z.string().max(40).optional(),
  action: z.enum(["save", "send", "withdraw"]),
  currency: z.string().regex(/^[A-Z]{3}$/).default("EUR"),
  message: z.string().trim().max(5000).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  items: z
    .array(z.object({ label: z.string().trim().min(1).max(300), quantity: z.number().int().min(1).max(10000), unitPrice: z.number().int().min(0).max(1_000_000_000) }))
    .max(50)
    .default([]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return error("bad_request", 400, { message: "Vérifiez les lignes du devis (libellé, quantité, prix)." });
  const p = parsed.data;
  const request = await prisma.projectRequest.findUnique({ where: { id }, select: { id: true } });
  if (!request) return error("not_found", 404);

  if (p.action === "withdraw") {
    if (!p.quoteId) return error("bad_request", 400);
    const r = await prisma.quote.updateMany({ where: { id: p.quoteId, requestId: id, status: "SENT" }, data: { status: "DRAFT", sentAt: null } });
    if (!r.count) return error("not_found", 404);
    await changeStatus(id, "IN_REVIEW", { note: "Devis retiré pour modification" });
    return json({ ok: true });
  }

  if (p.action === "send" && !p.items.length) return error("bad_request", 400, { message: "Ajoutez au moins une ligne avant d’envoyer le devis." });
  const total = p.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const data = {
    items: p.items,
    total,
    currency: p.currency,
    message: p.message || null,
    validUntil: p.validUntil ? new Date(`${p.validUntil}T23:59:59`) : null,
  };

  if (p.action === "send") {
    const pending = await prisma.quote.findFirst({ where: { requestId: id, status: "SENT", NOT: p.quoteId ? { id: p.quoteId } : undefined } });
    if (pending) return error("quote_pending", 409);
  }

  let quoteId = p.quoteId;
  if (quoteId) {
    const r = await prisma.quote.updateMany({ where: { id: quoteId, requestId: id, status: "DRAFT" }, data });
    if (!r.count) return error("bad_request", 400, { message: "Seul un brouillon peut être modifié." });
  } else {
    quoteId = (await prisma.quote.create({ data: { ...data, requestId: id } })).id;
  }

  let emailSent = false;
  if (p.action === "send") {
    await prisma.quote.update({ where: { id: quoteId }, data: { status: "SENT", sentAt: new Date() } });
    await changeStatus(id, "QUOTE_SENT");
    emailSent = await notifyQuote(id, total, p.currency);
  }
  return json({ ok: true, quoteId, emailSent });
}
