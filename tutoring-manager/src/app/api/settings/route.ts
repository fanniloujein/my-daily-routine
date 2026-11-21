import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";
import { readSettings, settingsSchema } from "@/lib/settings";

const patch = settingsSchema.partial().extend({ name: z.string().trim().min(1).max(80).optional(), email: z.string().trim().toLowerCase().email("E-mail invalide").optional() });

export const PATCH = route(async ({ req, user }) => {
  const { name, email, ...rest } = await body(req, patch);
  const current = readSettings(user.settings);
  const merged = settingsSchema.parse({ ...current, ...rest, notifications: { ...current.notifications, ...(rest.notifications ?? {}) } });
  const u = await prisma.user.update({ where: { id: user.id }, data: { settings: merged, ...(name ? { name } : {}), ...(email ? { email } : {}) } });
  return { name: u.name, email: u.email, settings: readSettings(u.settings) };
});
