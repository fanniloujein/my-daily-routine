import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Diagnostic public (aucune donnée personnelle, aucun secret) : aide à vérifier un déploiement.
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; message: string }> = {};
  checks.DATABASE_URL = process.env.DATABASE_URL
    ? { ok: true, message: "définie" }
    : { ok: false, message: "manquante : ajoute DATABASE_URL (Internal Database URL de ta base) dans Environment" };
  checks.AUTH_SECRET =
    (process.env.AUTH_SECRET ?? "").length >= 16 ? { ok: true, message: "définie" } : { ok: false, message: "manquante ou trop courte : ajoute AUTH_SECRET (bouton Generate)" };
  checks.DATA_ENCRYPTION_KEY =
    (process.env.DATA_ENCRYPTION_KEY ?? "").length >= 16 ? { ok: true, message: "définie" } : { ok: false, message: "manquante ou trop courte : ajoute DATA_ENCRYPTION_KEY (bouton Generate)" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, message: "connexion réussie" };
    try {
      const users = await prisma.user.count();
      checks.tables = { ok: true, message: users > 0 ? "tables présentes, compte déjà créé → va sur /login" : "tables présentes, aucun compte → va sur /setup" };
    } catch {
      checks.tables = { ok: false, message: "tables absentes : la Build Command doit contenir « npx prisma migrate deploy »" };
    }
  } catch (e) {
    checks.database = { ok: false, message: `connexion impossible (${e instanceof Error ? e.message.split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 160) : "erreur"}) — vérifie DATABASE_URL` };
  }
  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
