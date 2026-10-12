import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Life OS",
    short_name: "Life OS",
    description: "Mon assistant personnel pour organiser travail, cours, allemand, santé et loisirs.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#1e2a4a",
    lang: "fr",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
