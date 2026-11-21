// Sauvegarde complète (JSON) et restauration intégrale, dans une transaction unique.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";

// Ordre d'insertion respectant les clés étrangères
const TABLES = [
  "level", "subject", "subjectLevel", "parent", "student", "studentSubject",
  "chapter", "lesson", "exercise",
  "session", "sessionParticipant", "sessionLesson",
  "package", "invoice", "payment", "paymentTarget", "refund", "financialTransaction",
  "homework", "studentProgress", "assessment", "document",
  "task", "timeEntry", "availability", "personalEvent", "counter",
] as const;
type Table = (typeof TABLES)[number];

type Delegate = { findMany: (a?: unknown) => Promise<Record<string, unknown>[]>; createMany: (a: { data: unknown[] }) => Promise<unknown>; deleteMany: (a?: unknown) => Promise<unknown> };
const d = (client: unknown, t: Table) => (client as Record<string, Delegate>)[t];

export async function exportBackup() {
  const out: Record<string, unknown> = { app: "fannis-tutoring-manager", version: 1, exportedAt: new Date().toISOString() };
  const user = await prisma.user.findFirst();
  out.settings = user?.settings ?? {};
  for (const t of TABLES) {
    const rows = await d(prisma, t).findMany();
    out[t] = rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          v instanceof Uint8Array ? { $bytes: Buffer.from(v).toString("base64") } : Prisma.Decimal.isDecimal(v) ? { $dec: (v as Prisma.Decimal).toString() } : v instanceof Date ? { $date: v.toISOString() } : v,
        ]),
      ),
    );
  }
  return out;
}

function revive(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if ("$bytes" in o) return new Uint8Array(Buffer.from(String(o.$bytes), "base64"));
    if ("$dec" in o) return new Prisma.Decimal(String(o.$dec));
    if ("$date" in o) return new Date(String(o.$date));
  }
  return v;
}

export async function restoreBackup(backup: Record<string, unknown>) {
  if (backup.app !== "fannis-tutoring-manager") throw new HttpError(400, "Ce fichier n'est pas une sauvegarde de Fanni's Tutoring Manager.");
  const counts: Record<string, number> = {};
  await prisma.$transaction(
    async (tx) => {
      for (const t of [...TABLES].reverse()) await d(tx, t).deleteMany({});
      await tx.notification.deleteMany({});
      for (const t of TABLES) {
        const rows = (backup[t] as Record<string, unknown>[] | undefined) ?? [];
        counts[t] = rows.length;
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, revive(v)])));
          if (chunk.length) await d(tx, t).createMany({ data: chunk });
        }
      }
      if (backup.settings && typeof backup.settings === "object") {
        const user = await tx.user.findFirst();
        if (user) await tx.user.update({ where: { id: user.id }, data: { settings: backup.settings as Prisma.InputJsonValue } });
      }
    },
    { timeout: 120_000 },
  );
  return { restored: counts };
}
