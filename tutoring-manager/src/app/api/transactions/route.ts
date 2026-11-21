import { route, qs } from "@/lib/api";
import { transactionsQuery } from "@/server/reports";

export const GET = route(async ({ req }) => transactionsQuery(qs(req)));
