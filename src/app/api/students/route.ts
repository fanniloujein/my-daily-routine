import { prisma } from "@/lib/db";
import { assertGroupSize, checkMembers } from "@/server/students";
import { body, route } from "@/lib/api";
import { studentSchema } from "@/lib/validation";
import { today } from "@/lib/dates";

export const GET = route(async ({ user }) => {
  const t = today();
  const students = await prisma.student.findMany({
    where: { userId: user.id },
    orderBy: [{ archived: "asc" }, { isGroup: "asc" }, { name: "asc" }],
    include: {
      lessons: { select: { id: true, date: true, startTime: true, status: true, subject: true } },
      members: { select: { id: true, name: true, color: true } },
      groups: { select: { id: true, name: true, color: true } },
    },
  });
  return students.map(({ lessons, ...s }) => ({
    ...s,
    lessonsDone: lessons.filter((l) => l.status === "DONE").length,
    nextLesson: lessons.filter((l) => l.status === "PLANNED" && l.date >= t).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0] ?? null,
  }));
});

export const POST = route(async ({ req, user }) => {
  const { memberIds, ...d } = await body(req, studentSchema);
  const members = d.isGroup ? await checkMembers(user.id, memberIds ?? []) : [];
  assertGroupSize(d.isGroup, members.length);
  return prisma.student.create({ data: { ...d, userId: user.id, ...(d.isGroup ? { members: { connect: members } } : {}) } });
});
