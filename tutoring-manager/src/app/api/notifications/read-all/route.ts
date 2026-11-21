import { prisma } from "@/lib/db";
import { route } from "@/lib/api";

export const POST = route(async () => {
  await prisma.notification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
});
