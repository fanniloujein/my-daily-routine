import { GraduationCap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-bg to-accent-soft/60 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-[#a8c7f0] shadow-pop">
            <GraduationCap className="h-7 w-7" />
          </span>
          <h1 className="font-display text-2xl font-bold text-ink">Fanni&apos;s Tutoring Manager</h1>
          <p className="mt-1 text-sm text-muted">Votre espace privé de gestion des cours particuliers</p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
