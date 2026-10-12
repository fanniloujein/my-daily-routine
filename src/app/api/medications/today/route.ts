import { route, searchParam } from "@/lib/api";
import { isValidDateStr, today } from "@/lib/dates";
import { dosesFor } from "@/server/meds";

export const GET = route(async ({ req, user }) => {
  const q = searchParam(req, "date");
  return dosesFor(user.id, q && isValidDateStr(q) ? q : today());
});
