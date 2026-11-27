import { Logo } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/client/LocaleSwitcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <LocaleSwitcher />
      </div>
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
