import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { AdminLogin } from "@/components/admin/AdminLogin";

export const metadata: Metadata = { title: "Connexion administrateur", robots: { index: false } };

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "ADMIN") redirect("/admin");
  return (
    <div className="flex min-h-screen items-center justify-center bg-midnight px-4">
      <AdminLogin />
    </div>
  );
}
