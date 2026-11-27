import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Db } from "./db";

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
  db: Db = prisma,
) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
}
