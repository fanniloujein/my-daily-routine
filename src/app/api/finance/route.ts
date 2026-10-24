import { route, searchParam } from "@/lib/api";
import { today } from "@/lib/dates";
import { financeSummary } from "@/server/finance";

export const GET = route(async ({ req, user }) => {
  const m = searchParam(req, "month");
  return financeSummary(user.id, m && /^\d{4}-\d{2}$/.test(m) ? m : today().slice(0, 7));
});
