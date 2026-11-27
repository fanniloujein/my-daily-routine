import { z } from "zod";
import { boolish, hhmm, idSchema, intInRange, optString, optionalTndAmount, reqString } from "./common";

export const teacherProfileSchema = z
  .object({
    headline: reqString(140),
    bio: optString(3000),
    city: reqString(80),
    yearsExperience: intInRange(0, 60),
    subjectIds: z.array(idSchema).min(1, "selectSubject").max(10),
    offersOnline: boolish,
    offersInPerson: boolish,
    onlinePrice: optionalTndAmount,
    inPersonPrice: optionalTndAmount,
    inPersonArea: optString(200),
    lessonDurationMinutes: intInRange(30, 180).refine((v) => v % 15 === 0, "invalidNumber"),
  })
  .superRefine((d, ctx) => {
    if (d.offersOnline && d.onlinePrice === null) ctx.addIssue({ code: "custom", path: ["onlinePrice"], message: "required" });
    if (d.offersInPerson && d.inPersonPrice === null) ctx.addIssue({ code: "custom", path: ["inPersonPrice"], message: "required" });
    if (d.offersInPerson && !d.inPersonArea) ctx.addIssue({ code: "custom", path: ["inPersonArea"], message: "required" });
    if (!d.offersOnline && !d.offersInPerson) ctx.addIssue({ code: "custom", path: ["offersOnline"], message: "modeNotOffered" });
  });

export const availabilitySlotSchema = z
  .object({
    dayOfWeek: intInRange(0, 6),
    start: hhmm,
    end: hhmm,
    mode: z.enum(["BOTH", "ONLINE", "IN_PERSON"]).default("BOTH"),
  })
  .refine((d) => d.end > d.start, { path: ["end"], message: "timeRange" });

export const availabilitySchema = z.object({ slots: z.array(availabilitySlotSchema).max(50) });

export type TeacherProfileInput = z.input<typeof teacherProfileSchema>;
export type AvailabilityInput = z.input<typeof availabilitySchema>;
