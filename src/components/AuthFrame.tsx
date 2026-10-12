import { Logo } from "./AppShell";

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-bg to-lavender-soft p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Logo />
          <span className="font-display text-xl font-semibold text-ink">My Life OS</span>
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Tes données restent privées : elles sont stockées dans ta propre base de données.</p>
      </div>
    </div>
  );
}
