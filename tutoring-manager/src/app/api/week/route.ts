import { route, qs } from "@/lib/api";
import { organizeWeek } from "@/server/week";
import { startOfWeek, today } from "@/lib/dates";

export const GET = route(async ({ req }) => organizeWeek(startOfWeek(qs(req).get("week") ?? today())));
