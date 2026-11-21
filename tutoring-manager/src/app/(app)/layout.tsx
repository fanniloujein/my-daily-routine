import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readSettings } from "@/lib/settings";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

// Double protection : le middleware vérifie le jeton, ici on vérifie aussi qu'il n'est pas révoqué.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect((await prisma.user.count()) === 0 ? "/setup" : "/login");
  return <AppShell appName={readSettings(user.settings).appName}>{children}</AppShell>;
}
