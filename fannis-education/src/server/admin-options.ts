import { prisma } from "@/lib/prisma";
import { localized, type AppLocale } from "@/lib/i18n/config";

/** Liste des matières pour les sélecteurs administrateur : « Niveau — Matière ». */
export async function subjectOptions(locale: AppLocale) {
  const subjects = await prisma.subject.findMany({ include: { level: true }, orderBy: [{ level: { order: "asc" } }, { order: "asc" }] });
  return subjects.map((s) => ({ id: s.id, label: `${localized(locale, s.level.name, s.level.nameAr)} — ${localized(locale, s.name, s.nameAr)}` }));
}
