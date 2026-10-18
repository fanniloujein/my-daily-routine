import { z } from "zod";
import { prisma } from "@/server/db";
import { guardAdmin, readJson } from "@/server/admin";
import { changeStatus } from "@/server/requests";
import { error, json } from "@/server/security";

const STATUSES = ["RECEIVED", "IN_REVIEW", "INFO_NEEDED", "QUOTE_SENT", "QUOTE_ACCEPTED", "IN_PROGRESS", "AWAITING_VALIDATION", "COMPLETED", "CANCELLED"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  const parsed = z
    .object({ status: z.enum(STATUSES), note: z.string().trim().max(2000).optional(), notify: z.boolean().optional() })
    .safeParse(await readJson(req));
  if (!parsed.success) return error("bad_request", 400);
  const exists = await prisma.projectRequest.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return error("not_found", 404);
  const r = await changeStatus(id, parsed.data.status, { note: parsed.data.note, notify: parsed.data.notify });
  return json({ ok: true, emailSent: r.emailSent });
}

/** Suppression définitive (droit à l'effacement) : demande, fichiers, messages, devis. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAdmin(req);
  if (g.res) return g.res;
  const { id } = await params;
  await prisma.projectRequest.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
}
