import { route, qs } from "@/lib/api";
import { financeOverview } from "@/server/reports";

export const GET = route(async ({ req }) => financeOverview(qs(req)));
