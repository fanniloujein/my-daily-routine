"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, runAction, zodFail, type ActionResult } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { emailSchema, reqString } from "@/lib/validation/common";

const contactSchema = z.object({
  name: reqString(100),
  email: emailSchema,
  message: reqString(3000),
  website: z.string().max(0).optional(), // piège à robots
});

export async function contactAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!rateLimit(`contact:${ip}`, 5, 60 * 60_000)) throw new AppError("tooManyAttempts");
    const { name, email, message } = parsed.data;
    await prisma.contactMessage.create({ data: { name, email, message } });
    return { ok: true };
  });
}
