import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { route, searchParam } from "@/lib/api";
import { activitySchema } from "@/lib/validation";
import { addDays, addMinutesToTime, diffDays, isValidDateStr, timeToMin, today } from "@/lib/dates";
import { getOccurrences } from "@/server/occurrences";
import { categoryOwned, checkConflicts } from "@/server/conflicts";

export const GET = route(async ({ req, user }) => {
  const from = searchParam(req, "from") ?? today();
  const to = searchParam(req, "to") ?? addDays(from, 6);
  if (!isValidDateStr(from) || !isValidDateStr(to) || to < from) throw new HttpError(400, "Plage de dates invalide");
  if (diffDays(to, from) > 370) throw new HttpError(400, "Plage trop longue (1 an maximum)");
  return getOccurrences(user.id, from, to);
});

/** Normalise heure de fin / durée : la durée suit l'horaire quand les deux sont fournis. */
function normalizeTimes<T extends { startTime: string | null; endTime: string | null; durationMin: number }>(a: T): T {
  if (a.startTime && a.endTime) return { ...a, durationMin: timeToMin(a.endTime) - timeToMin(a.startTime) };
  if (a.startTime && !a.endTime) return { ...a, endTime: addMinutesToTime(a.startTime, a.durationMin) };
  return a;
}

export const POST = route(async ({ req, user }) => {
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") throw new HttpError(400, "Données invalides");
  const allowConflict = !!(raw as { allowConflict?: boolean }).allowConflict;
  const data = normalizeTimes(activitySchema.parse(raw));
  if (!(await categoryOwned(user.id, data.categoryId))) throw new HttpError(400, "Catégorie inconnue");
  if (!allowConflict) {
    const c = await checkConflicts(user.id, data);
    if (c.conflicts.length) return NextResponse.json({ error: "Conflit d'horaire", ...c }, { status: 409 });
  }
  const created = await prisma.activity.create({
    data: { ...data, userId: user.id, completedAt: data.status === "DONE" ? new Date() : null },
  });
  return created;
});

