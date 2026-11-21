import type { Prisma } from "@prisma/client";
import { route, body, qs } from "@/lib/api";
import { studentSchema } from "@/lib/validation";
import { createStudent } from "@/server/students";
import { allStudentFinances } from "@/server/finance";
import { prisma } from "@/lib/db";
import { today } from "@/lib/dates";

export const GET = route(async ({ req }) => {
  const p = qs(req);
  const q = p.get("q")?.trim();
  const where: Prisma.StudentWhereInput = {
    archived: p.get("archived") === "1" ? true : p.get("archived") === "all" ? undefined : false,
    ...(p.get("levelId") ? { levelId: p.get("levelId") } : {}),
    ...(p.get("subjectId") ? { subjects: { some: { subjectId: p.get("subjectId")! } } } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { school: { contains: q, mode: "insensitive" } },
            { parent: { name: { contains: q, mode: "insensitive" } } },
            { parent: { phone: { contains: q } } },
          ],
        }
      : {}),
  };
  const rows = await allStudentFinances(where);
  const ids = rows.map((r) => r.student.id);
  const next = await prisma.sessionParticipant.findMany({
    where: { studentId: { in: ids }, session: { status: "PLANNED", date: { gte: today() } } },
    include: { session: { select: { date: true, startTime: true } } },
  });
  const nextBy = new Map<string, string>();
  for (const n of next) {
    const k = `${n.session.date} ${n.session.startTime}`;
    if (!nextBy.has(n.studentId) || k < nextBy.get(n.studentId)!) nextBy.set(n.studentId, k);
  }
  const parents = await prisma.parent.findMany({ where: { students: { some: { id: { in: ids } } } } });
  const pm = new Map(parents.map((x) => [x.id, x]));
  return rows.map(({ student: s, finance: f }) => ({
    ...s,
    photo: s.photo ? true : false,
    parent: s.parentId ? pm.get(s.parentId) ?? null : null,
    subjects: s.subjects.map((x) => x.subject),
    nextSession: nextBy.get(s.id) ?? null,
    finance: { ...f, ledger: undefined },
  }));
});

export const POST = route(async ({ req }) => createStudent(await body(req, studentSchema)));
