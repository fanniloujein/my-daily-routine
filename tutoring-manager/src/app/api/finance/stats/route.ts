import { route, qs } from "@/lib/api";
import { financeStats } from "@/server/financeStats";
import { today } from "@/lib/dates";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  const t = today();
  return financeStats({ from: p.get("from") ?? `${t.slice(0, 4)}-01-01`, to: p.get("to") ?? t });
});
