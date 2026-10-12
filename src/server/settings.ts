import type { User } from "@prisma/client";
import { readSettings } from "@/lib/validation";

export function userSettings(user: Pick<User, "settings">) {
  return readSettings(user.settings);
}
