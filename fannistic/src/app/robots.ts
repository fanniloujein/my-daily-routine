import type { MetadataRoute } from "next";
import { siteUrl } from "@/server/mail";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/fr/suivi", "/en/suivi", "/ar/suivi", "/fr/espace", "/en/espace", "/ar/espace"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
