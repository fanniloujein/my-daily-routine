import { z } from "zod";
import { emailSchema, idSchema, passwordSchema, phoneSchema, reqString } from "./common";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "required").max(128, "tooLong"),
  next: z.string().optional(),
});

const baseRegister = {
  name: reqString(100),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, { error: "acceptTerms" }),
};

export const studentRegisterSchema = z
  .object({ ...baseRegister, levelId: idSchema })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "passwordMismatch" });

export const teacherRegisterSchema = z
  .object({
    ...baseRegister,
    city: reqString(80),
    headline: reqString(140),
    subjectIds: z.array(idSchema).min(1, "selectSubject").max(10),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "passwordMismatch" });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "passwordMismatch" });

export type LoginInput = z.input<typeof loginSchema>;
export type StudentRegisterInput = z.input<typeof studentRegisterSchema>;
export type TeacherRegisterInput = z.input<typeof teacherRegisterSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
