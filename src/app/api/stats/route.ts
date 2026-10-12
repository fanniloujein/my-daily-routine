import { HttpError } from "@/lib/auth";
import { route, searchParam } from "@/lib/api";
import { addDays, diffDays, isValidDateStr, startOfWeek, today } from "@/lib/dates";
import { computeStats } from "@/server/stats";

export const GET = route(async ({ req, user }) => {
  const from = searchParam(req, "from") ?? startOfWeek(today());
  const to = searchParam(req, "to") ?? addDays(from, 6);
  if (!isValidDateStr(from) || !isValidDateStr(to) || to < from || diffDays(to, from) > 366) throw new HttpError(400, "Période invalide");
  return computeStats(user.id, from, to);
});
