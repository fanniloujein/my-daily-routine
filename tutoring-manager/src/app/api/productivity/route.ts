import { route, qs } from "@/lib/api";
import { productivity } from "@/server/dashboard";
import { addDays, today } from "@/lib/dates";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  const t = today();
  return productivity(p.get("from") ?? addDays(t, -29), p.get("to") ?? t);
});
