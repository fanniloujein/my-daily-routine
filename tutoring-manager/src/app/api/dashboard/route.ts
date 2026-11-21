import { route } from "@/lib/api";
import { dashboard } from "@/server/dashboard";

export const GET = route(async () => dashboard());
