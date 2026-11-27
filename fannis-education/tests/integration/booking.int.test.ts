import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createBooking, getTeacherSlots, reviewBooking, transitionBooking } from "@/server/bookings";
import { addDaysIso, toLocalIsoDate, zonedTimeToUtc } from "@/lib/time";
import { hasDb, makeCatalog, makeTeacher, makeUser, resetDb } from "./helpers";

describe.skipIf(!hasDb)("réservations (intégration)", () => {
  let subjectId: string;
  let date: string;
  let at17: Date;
  beforeEach(async () => {
    await resetDb();
    subjectId = (await makeCatalog()).subject.id;
    date = addDaysIso(toLocalIsoDate(new Date()), 3);
    at17 = zonedTimeToUtc(date, 17 * 60);
  });

  it("propose les créneaux et calcule le prix côté serveur", async () => {
    const { profile } = await makeTeacher(subjectId);
    const student = await makeUser();
    expect(await getTeacherSlots(profile.id, date)).toHaveLength(3);
    const b = await createBooking({ studentId: student.id, teacherId: profile.id, subjectId, mode: "IN_PERSON", startsAt: at17 });
    expect(b).toMatchObject({ status: "PENDING", priceMillimes: 35_000 });
    expect(await getTeacherSlots(profile.id, date)).toHaveLength(2);
    expect(await prisma.notification.count({ where: { type: "BOOKING_REQUESTED" } })).toBe(1);
  });

  it("refuse un créneau hors disponibilités, un enseignant non validé, une matière non enseignée", async () => {
    const { profile } = await makeTeacher(subjectId);
    const student = await makeUser();
    await expect(createBooking({ studentId: student.id, teacherId: profile.id, subjectId, mode: "ONLINE", startsAt: zonedTimeToUtc(date, 10 * 60) })).rejects.toMatchObject({ code: "slotUnavailable" });
    await expect(createBooking({ studentId: student.id, teacherId: profile.id, subjectId, mode: "ONLINE", startsAt: new Date(at17.getTime() + 15 * 60_000) })).rejects.toMatchObject({ code: "slotUnavailable" });
    const pending = await makeTeacher(subjectId, "PENDING");
    await expect(createBooking({ studentId: student.id, teacherId: pending.profile.id, subjectId, mode: "ONLINE", startsAt: at17 })).rejects.toMatchObject({ code: "teacherUnavailable" });
    const other = await prisma.subject.create({ data: { levelId: (await prisma.subject.findUniqueOrThrow({ where: { id: subjectId } })).levelId, slug: "math", name: "Maths" } });
    await expect(createBooking({ studentId: student.id, teacherId: profile.id, subjectId: other.id, mode: "ONLINE", startsAt: at17 })).rejects.toMatchObject({ code: "subjectNotTaught" });
  });

  it("empêche la double réservation, même avec des demandes simultanées", async () => {
    const { profile } = await makeTeacher(subjectId);
    const students = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()]);
    const results = await Promise.allSettled(students.map((s) => createBooking({ studentId: s.id, teacherId: profile.id, subjectId, mode: "ONLINE", startsAt: at17 })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "slotUnavailable" });
    expect(await prisma.booking.count({ where: { teacherId: profile.id } })).toBe(1);
  });

  it("la base refuse elle-même un chevauchement (contrainte d'exclusion)", async () => {
    const { profile } = await makeTeacher(subjectId);
    const [a, b] = [await makeUser(), await makeUser()];
    const base = { teacherId: profile.id, subjectId, mode: "ONLINE" as const, priceMillimes: 1, status: "ACCEPTED" as const };
    await prisma.booking.create({ data: { ...base, studentId: a.id, startsAt: at17, endsAt: new Date(at17.getTime() + 3_600_000) } });
    await expect(
      prisma.booking.create({ data: { ...base, studentId: b.id, startsAt: new Date(at17.getTime() + 1_800_000), endsAt: new Date(at17.getTime() + 5_400_000) } }),
    ).rejects.toThrow();
    // Une réservation annulée ne bloque pas le créneau.
    await prisma.booking.create({ data: { ...base, status: "CANCELLED", studentId: b.id, startsAt: at17, endsAt: new Date(at17.getTime() + 3_600_000) } });
  });

  it("un créneau libéré (refus/annulation) redevient réservable", async () => {
    const { profile, user: teacherUser } = await makeTeacher(subjectId);
    const [s1, s2] = [await makeUser(), await makeUser()];
    const b = await createBooking({ studentId: s1.id, teacherId: profile.id, subjectId, mode: "ONLINE", startsAt: at17 });
    await transitionBooking({ bookingId: b.id, actor: { userId: teacherUser.id, role: "TEACHER" }, to: "REJECTED", reason: "Indisponible" });
    const b2 = await createBooking({ studentId: s2.id, teacherId: profile.id, subjectId, mode: "ONLINE", startsAt: at17 });
    expect(b2.status).toBe("PENDING");
  });

  it("un élève ne peut pas avoir deux séances simultanées", async () => {
    const t1 = await makeTeacher(subjectId);
    const t2 = await makeTeacher(subjectId);
    const s = await makeUser();
    await createBooking({ studentId: s.id, teacherId: t1.profile.id, subjectId, mode: "ONLINE", startsAt: at17 });
    await expect(createBooking({ studentId: s.id, teacherId: t2.profile.id, subjectId, mode: "ONLINE", startsAt: at17 })).rejects.toMatchObject({ code: "ownOverlap" });
  });

  it("cycle complet : acceptation, autorisations, fin de séance et avis unique", async () => {
    const { profile, user: teacherUser } = await makeTeacher(subjectId);
    const student = await makeUser();
    const intruder = await makeUser();
    const b = await createBooking({ studentId: student.id, teacherId: profile.id, subjectId, mode: "ONLINE", startsAt: at17 });

    await expect(transitionBooking({ bookingId: b.id, actor: { userId: student.id, role: "STUDENT" }, to: "ACCEPTED" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(transitionBooking({ bookingId: b.id, actor: { userId: intruder.id, role: "STUDENT" }, to: "CANCELLED" })).rejects.toMatchObject({ code: "notFound" });
    await transitionBooking({ bookingId: b.id, actor: { userId: teacherUser.id, role: "TEACHER" }, to: "ACCEPTED", meetingLink: "https://meet.example/x" });
    await expect(transitionBooking({ bookingId: b.id, actor: { userId: teacherUser.id, role: "TEACHER" }, to: "COMPLETED" })).rejects.toMatchObject({ code: "notFinished" });
    await expect(reviewBooking({ bookingId: b.id, studentId: student.id, rating: 5 })).rejects.toMatchObject({ code: "invalidTransition" });

    const later = new Date(at17.getTime() + 2 * 3_600_000);
    await transitionBooking({ bookingId: b.id, actor: { userId: teacherUser.id, role: "TEACHER" }, to: "COMPLETED", now: later });
    await reviewBooking({ bookingId: b.id, studentId: student.id, rating: 4, comment: "Très clair" });
    await expect(reviewBooking({ bookingId: b.id, studentId: student.id, rating: 5 })).rejects.toMatchObject({ code: "alreadyReviewed" });
    expect(await prisma.teacherProfile.findUniqueOrThrow({ where: { id: profile.id } })).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
    const types = (await prisma.notification.findMany({ where: { userId: student.id } })).map((n) => n.type).sort();
    expect(types).toEqual(["BOOKING_ACCEPTED", "BOOKING_COMPLETED"]);
  });

  it("l'élève ne peut pas annuler une séance acceptée moins de 24 h avant", async () => {
    const { profile, user: teacherUser } = await makeTeacher(subjectId);
    const student = await makeUser();
    const b = await createBooking({ studentId: student.id, teacherId: profile.id, subjectId, mode: "ONLINE", startsAt: at17 });
    await transitionBooking({ bookingId: b.id, actor: { userId: teacherUser.id, role: "TEACHER" }, to: "ACCEPTED" });
    const justBefore = new Date(at17.getTime() - 2 * 3_600_000);
    await expect(transitionBooking({ bookingId: b.id, actor: { userId: student.id, role: "STUDENT" }, to: "CANCELLED", now: justBefore })).rejects.toMatchObject({ code: "tooLateToCancel" });
    await transitionBooking({ bookingId: b.id, actor: { userId: teacherUser.id, role: "TEACHER" }, to: "CANCELLED", reason: "Malade", now: justBefore });
  });
});
