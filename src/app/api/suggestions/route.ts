import { prisma } from "@/lib/db";
import { route, searchParam } from "@/lib/api";
import { nowTime, timeToMin, today } from "@/lib/dates";
import { suggestNow } from "@/lib/suggestions";
import { readSettings } from "@/lib/validation";
import { getOccurrences } from "@/server/occurrences";

/** « Que puis-je faire maintenant ? » — basé sur le temps réellement libre et l'énergie du jour. */
export const GET = route(async ({ req, user }) => {
  const t = today();
  const now = nowTime();
  const s = readSettings(user.settings);
  const occ = (await getOccurrences(user.id, t, t)).filter((o) => o.startTime && o.endTime && o.status !== "DONE" && o.status !== "POSTPONED");
  const current = occ.find((o) => o.startTime! <= now && o.endTime! > now);
  const next = occ.find((o) => o.startTime! > now);
  const until = next?.startTime ?? s.dayEnd;
  const requested = Number(searchParam(req, "minutes"));
  const freeMinutes = requested > 0 ? requested : current ? 0 : Math.max(0, timeToMin(until) - timeToMin(now));
  const energy = (await prisma.energyCheckin.findUnique({ where: { userId_date: { userId: user.id, date: t } } }))?.energy ?? 3;
  const [media, ideas] = await Promise.all([
    prisma.mediaItem.findMany({ where: { userId: user.id, status: { not: "DONE" } } }),
    prisma.leisureIdea.findMany({ where: { userId: user.id } }),
  ]);
  return {
    freeMinutes,
    until: next ? { title: next.title, startTime: next.startTime } : null,
    current: current ? { title: current.title, endTime: current.endTime } : null,
    energy,
    suggestions: suggestNow({ freeMinutes: Math.min(freeMinutes, 240), energy, media, ideas }),
  };
});
