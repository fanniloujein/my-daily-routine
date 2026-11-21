import { route } from "@/lib/api";
import { readSettings } from "@/lib/settings";

export const GET = route(async ({ user }) => ({ id: user.id, name: user.name, email: user.email, settings: readSettings(user.settings) }));
