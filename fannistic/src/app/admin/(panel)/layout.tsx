import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin Fanni’stic" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  if (!user) redirect("/admin/connexion");
  const newCount = await prisma.projectRequest.count({ where: { status: "RECEIVED" } });
  return (
    <div className="min-h-screen bg-paper-2 lg:flex">
      <AdminNav name={user.name} newCount={newCount} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
