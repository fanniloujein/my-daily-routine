import { route, qs } from "@/lib/api";
import { analytics } from "@/server/analytics";
import { today } from "@/lib/dates";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  const t = today();
  return analytics(p.get("from") ?? `${t.slice(0, 4)}-01-01`, p.get("to") ?? t);
});
