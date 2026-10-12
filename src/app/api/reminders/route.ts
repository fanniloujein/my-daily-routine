import { route } from "@/lib/api";
import { today } from "@/lib/dates";
import { upcomingReminders } from "@/server/reminders";

export const GET = route(async ({ user }) => upcomingReminders(user.id, today()));
