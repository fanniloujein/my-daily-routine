"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runAction, type ActionResult } from "@/lib/action";
import { requireUser } from "@/lib/auth/session";

export async function markNotificationsReadAction(id?: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
