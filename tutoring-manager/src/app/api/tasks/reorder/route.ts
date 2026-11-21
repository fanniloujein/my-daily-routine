import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, body } from "@/lib/api";

// Kanban : nouvel ordre d'une colonne après glisser-déposer
const schema = z.object({ status: z.enum(["TODO", "IN_PROGRESS", "DONE", "POSTPONED"]), ids: z.array(z.string()).max(500) });

export const POST = route(async ({ req }) => {
  const v = await body(req, schema);
  await prisma.$transaction(
    v.ids.map((id, order) =>
      prisma.task.update({ where: { id }, data: { order, status: v.status, ...(v.status === "DONE" ? {} : { completedAt: null }) } }),
    ),
  );
  await prisma.task.updateMany({ where: { id: { in: v.ids }, status: "DONE", completedAt: null }, data: { completedAt: new Date() } });
});
