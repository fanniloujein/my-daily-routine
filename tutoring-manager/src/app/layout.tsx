import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./globals.css";
import { Providers, themeScript } from "@/components/providers";


export const metadata: Metadata = {
  title: { default: "Fanni's Tutoring Manager", template: "%s · Fanni's Tutoring Manager" },
  description: "Gestion privée des cours particuliers : élèves, séances, finances, pédagogie et organisation.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#8fb8e8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
