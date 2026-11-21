import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import type { StudentInput } from "@/lib/validation";
import { milToDecimalString, toMil } from "@/lib/money";

/** Parent : réutilise la fiche existante (même téléphone) pour les frères et sœurs. */
async function upsertParent(tx: Tx, name: string | null, phone: string | null, currentId: string | null) {
  if (!name && !phone) return null;
  if (currentId) {
    await tx.parent.update({ where: { id: currentId }, data: { name: name || "Parent", phone } });
    return currentId;
  }
  if (phone) {
    const existing = await tx.parent.findFirst({ where: { phone } });
    if (existing) return existing.id;
  }
  return (await tx.parent.create({ data: { name: name || "Parent", phone } })).id;
}

function data(v: StudentInput) {
  const { parentName, parentPhone, subjectIds, rate, ...rest } = v;
  void parentName; void parentPhone; void subjectIds;
  return { ...rest, rate: new Prisma.Decimal(milToDecimalString(toMil(rate))) };
}

export async function createStudent(v: StudentInput) {
  const dup = await prisma.student.findFirst({
    where: { firstName: { equals: v.firstName, mode: "insensitive" }, lastName: { equals: v.lastName, mode: "insensitive" }, archived: false },
  });
  if (dup) throw new HttpError(409, `Un élève « ${v.firstName} ${v.lastName} » existe déjà.`);
  return prisma.$transaction(async (tx) => {
    const parentId = await upsertParent(tx, v.parentName, v.parentPhone, null);
    return tx.student.create({ data: { ...data(v), parentId, subjects: { create: v.subjectIds.map((subjectId) => ({ subjectId })) } } });
  });
}

export async function updateStudent(id: string, v: StudentInput) {
  const cur = await prisma.student.findUnique({ where: { id } });
  if (!cur) throw new HttpError(404, "Élève introuvable.");
  return prisma.$transaction(async (tx) => {
    const parentId = await upsertParent(tx, v.parentName, v.parentPhone, cur.parentId);
    await tx.studentSubject.deleteMany({ where: { studentId: id } });
    return tx.student.update({ where: { id }, data: { ...data(v), parentId, subjects: { create: v.subjectIds.map((subjectId) => ({ subjectId })) } } });
  });
}
