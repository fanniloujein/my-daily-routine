import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action";

export async function getMyTeacherProfile(userId: string) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    include: { subjects: { include: { subject: { include: { level: true } } } }, availabilities: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] } },
  });
  if (!profile) throw new AppError("notFound");
  return profile;
}

/** Profil suffisamment complet pour être réservable. */
export function isBookable(p: { offersOnline: boolean; offersInPerson: boolean; onlinePriceMillimes: number | null; inPersonPriceMillimes: number | null; availabilities: unknown[] }) {
  const priced = (p.offersOnline && p.onlinePriceMillimes != null) || (p.offersInPerson && p.inPersonPriceMillimes != null);
  return priced && p.availabilities.length > 0;
}
