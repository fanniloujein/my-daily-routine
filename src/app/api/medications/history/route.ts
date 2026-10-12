import { route } from "@/lib/api";
import { addDays, today } from "@/lib/dates";
import { dosesFor } from "@/server/meds";

/** Historique des 14 derniers jours. */
export const GET = route(async ({ user }) => {
  const t = today();
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(t, -i);
    days.push({ date: d, doses: await dosesFor(user.id, d) });
  }
  return days;
});
