import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { readSettings, settingsSchema } from "@/lib/validation";
import { aiEnabled } from "@/server/assistant";

export const GET = route(async ({ user }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  locale: user.locale,
  settings: readSettings(user.settings),
  aiEnabled: aiEnabled(),
  hasIcsToken: !!user.icsToken,
}));

const patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  locale: z.enum(["fr", "en", "de", "ar"]).optional(),
  settings: settingsSchema.partial().optional(),
});

export const PATCH = route(async ({ req, user }) => {
  const data = await body(req, patch);
  const settings = data.settings ? { ...readSettings(user.settings), ...data.settings } : undefined;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: data.name, locale: data.locale, ...(settings ? { settings } : {}) },
  });
  return { ok: true, settings: readSettings(updated.settings) };
});
