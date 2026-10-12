import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { route, searchParam } from "@/lib/api";
import { activitySchema } from "@/lib/validation";
import { addDays, addMinutesToTime, isValidDateStr, timeToMin } from "@/lib/dates";
import { getActivityOwned, patchOccurrence } from "@/server/occurrences";
import { categoryOwned, checkConflicts } from "@/server/conflicts";
import { onActivityStatusChange } from "@/server/hooks";

export const GET = route<{ id: string }>(async ({ user, params }) => {
  return prisma.activity.findFirstOrThrow({ where: { id: params.id, userId: user.id }, include: { category: true, exceptions: true } });
});

/** Modification de l'activité (ou de toute la série si récurrente). */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const existing = await getActivityOwned(user.id, params.id);
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) throw new HttpError(400, "Données invalides");
  const merged = activitySchema.parse({ ...existing, ...raw });
  let data = merged;
  if (data.startTime && data.endTime) data = { ...data, durationMin: timeToMin(data.endTime) - timeToMin(data.startTime) };
  else if (data.startTime && !data.endTime) data = { ...data, endTime: addMinutesToTime(data.startTime, data.durationMin) };
  if (!(await categoryOwned(user.id, data.categoryId))) throw new HttpError(400, "Catégorie inconnue");
  const timeChanged = data.date !== existing.date || data.startTime !== existing.startTime || data.endTime !== existing.endTime;
  if (timeChanged && !raw.allowConflict) {
    const c = await checkConflicts(user.id, data, existing.id);
    if (c.conflicts.length) return NextResponse.json({ error: "Conflit d'horaire", ...c }, { status: 409 });
  }
  const updated = await prisma.activity.update({
    where: { id: existing.id },
    data: {
      ...data,
      completedAt: data.status === "DONE" ? (existing.completedAt ?? new Date()) : null,
    },
  });
  await onActivityStatusChange(updated, existing.status, updated.status);
  return updated;
});

/**
 * Suppression.
 * ?scope=occurrence&date=AAAA-MM-JJ : seulement cette occurrence (récurrence)
 * ?scope=following&date=… : cette occurrence et les suivantes
 * sinon : toute l'activité / la série
 */
export const DELETE = route<{ id: string }>(async ({ req, user, params }) => {
  const a = await getActivityOwned(user.id, params.id);
  const scope = searchParam(req, "scope") ?? "series";
  const date = searchParam(req, "date");
  if (a.recurrence !== "NONE" && scope !== "series") {
    if (!date || !isValidDateStr(date)) throw new HttpError(400, "Date d'occurrence requise");
    if (scope === "occurrence") {
      await patchOccurrence(user.id, a.id, date, { cancelled: true });
      return { ok: true, scope };
    }
    if (scope === "following") {
      if (date <= a.date) await prisma.activity.delete({ where: { id: a.id } });
      else {
        await prisma.activity.update({ where: { id: a.id }, data: { until: addDays(date, -1) } });
      }
      return { ok: true, scope };
    }
  }
  await prisma.activity.delete({ where: { id: a.id } });
  return { ok: true, scope: "series" };
});
