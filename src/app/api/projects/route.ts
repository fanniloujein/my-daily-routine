import { prisma } from "@/lib/db";
import { body, route } from "@/lib/api";
import { projectSchema } from "@/lib/validation";
import { WEB_PROJECT_TEMPLATE } from "@/lib/constants";

export const GET = route(async ({ user }) => {
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    include: { tasks: true, events: { orderBy: { date: "asc" } } },
  });
  return projects.map(({ tasks, ...p }) => ({
    ...p,
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t) => t.status === "DONE").length,
    estimateMin: tasks.reduce((s, t) => s + t.estimateMin, 0),
    spentMin: tasks.reduce((s, t) => s + t.spentMin, 0),
  }));
});

export const POST = route(async ({ req, user }) => {
  const { template, ...d } = await body(req, projectSchema);
  return prisma.project.create({
    data: {
      ...d,
      budget: d.budget ?? null,
      userId: user.id,
      ...(template ? { tasks: { create: WEB_PROJECT_TEMPLATE.map((t, order) => ({ ...t, order })) } } : {}),
    },
  });
});
