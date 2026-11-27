import { z } from "zod";
import { idSchema, isoDate, optString, phoneSchema, reqString } from "./common";

export const PAYMENT_METHODS_MANUAL = ["BANK_TRANSFER", "POSTAL_TRANSFER", "MOBILE_WALLET", "CASH"] as const;

export const subscriptionRequestSchema = z.object({
  planId: idSchema,
  method: z.enum(PAYMENT_METHODS_MANUAL, { error: "required" }),
  reference: reqString(120),
  payerNote: optString(500),
});

export const bookingRequestSchema = z.object({
  teacherId: idSchema,
  subjectId: idSchema,
  mode: z.enum(["ONLINE", "IN_PERSON"], { error: "required" }),
  date: isoDate,
  startsAt: z.iso.datetime({ error: "required" }),
  note: optString(1000),
});

export const reviewSchema = z.object({
  bookingId: idSchema,
  rating: z.coerce.number().int().min(1, "required").max(5),
  comment: optString(1000),
});

export const studentProfileSchema = z.object({
  name: reqString(100),
  phone: phoneSchema,
  levelId: idSchema,
  city: optString(80),
  school: optString(120),
  guardianPhone: phoneSchema,
});

export type SubscriptionRequestInput = z.input<typeof subscriptionRequestSchema>;
export type BookingRequestInput = z.input<typeof bookingRequestSchema>;
export type ReviewInput = z.input<typeof reviewSchema>;
export type StudentProfileInput = z.input<typeof studentProfileSchema>;
