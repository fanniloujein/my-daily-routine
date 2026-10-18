import type { MetadataRoute } from "next";
import { siteUrl } from "@/server/mail";
import { prisma } from "@/server/db";
import { LOCALES } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const alt = (path: string) => ({ languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${path}`])) });
  const paths = ["", "/configurateur", "/realisations", "/mentions-legales", "/confidentialite", "/conditions"];
  const projects = await prisma.portfolioProject.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }).catch(() => []);
  return [
    ...paths.flatMap((p) => LOCALES.map((l) => ({ url: `${base}/${l}${p}`, alternates: alt(p), changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.7 }))),
    ...projects.flatMap((p) =>
      LOCALES.map((l) => ({ url: `${base}/${l}/realisations/${p.slug}`, lastModified: p.updatedAt, alternates: alt(`/realisations/${p.slug}`), priority: 0.6 })),
    ),
  ];
}
