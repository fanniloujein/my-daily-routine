import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "My Life OS", template: "%s · My Life OS" },
  description: "Assistant personnel : planning, cours particuliers, projets freelance, allemand, santé, sport et loisirs.",
  applicationName: "My Life OS",
  appleWebApp: { capable: true, title: "Life OS", statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1322" },
  ],
};

// Applique le thème avant l'affichage pour éviter un flash
const themeScript = `(function(){try{var t=localStorage.getItem('mlos-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
