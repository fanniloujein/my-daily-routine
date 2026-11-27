import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { homeForRole, requiredRoleForPath, safeRedirectPath, signSession, verifySession } from "@/lib/auth/token";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema, studentRegisterSchema, teacherRegisterSchema } from "@/lib/validation/auth";

const SECRET = "unit-test-secret-unit-test-secret-0123456789";

describe("mots de passe", () => {
  it("hache et vérifie (bcrypt), sans jamais stocker le clair", async () => {
    const hash = await hashPassword("Bac2026!eco");
    expect(hash).not.toContain("Bac2026");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("Bac2026!eco", hash)).toBe(true);
    expect(await verifyPassword("bac2026!eco", hash)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("jetons de session", () => {
  it("aller-retour valide", async () => {
    const token = await signSession({ sub: "u1", role: "STUDENT", v: 3 }, SECRET);
    expect(await verifySession(token, SECRET)).toEqual({ sub: "u1", role: "STUDENT", v: 3 });
  });
  it("rejette un jeton signé avec un autre secret", async () => {
    const token = await signSession({ sub: "u1", role: "ADMIN", v: 0 }, SECRET);
    expect(await verifySession(token, SECRET.replace("unit", "evil"))).toBeNull();
  });
  it("rejette un jeton modifié (élévation de rôle)", async () => {
    const token = await signSession({ sub: "u1", role: "STUDENT", v: 0 }, SECRET);
    const [h, p, s] = token.split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    payload.role = "ADMIN";
    const forged = [h, Buffer.from(JSON.stringify(payload)).toString("base64url"), s].join(".");
    expect(await verifySession(forged, SECRET)).toBeNull();
  });
  it("rejette un jeton expiré, un rôle inconnu, l'absence de jeton", async () => {
    const key = new TextEncoder().encode(SECRET);
    const expired = await new SignJWT({ role: "STUDENT", v: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject("u1").setExpirationTime(Math.floor(Date.now() / 1000) - 10).sign(key);
    const badRole = await new SignJWT({ role: "ROOT", v: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject("u1").setExpirationTime("1h").sign(key);
    expect(await verifySession(expired, SECRET)).toBeNull();
    expect(await verifySession(badRole, SECRET)).toBeNull();
    expect(await verifySession(undefined, SECRET)).toBeNull();
    expect(await verifySession("not-a-jwt", SECRET)).toBeNull();
  });
  it("refuse un secret trop court", async () => {
    await expect(signSession({ sub: "u", role: "STUDENT", v: 0 }, "short")).rejects.toThrow();
  });
});

describe("contrôle d'accès par rôle (routes)", () => {
  it("associe chaque espace privé à son rôle", () => {
    expect(requiredRoleForPath("/student")).toBe("STUDENT");
    expect(requiredRoleForPath("/student/library")).toBe("STUDENT");
    expect(requiredRoleForPath("/teacher/bookings")).toBe("TEACHER");
    expect(requiredRoleForPath("/admin/payments")).toBe("ADMIN");
  });
  it("les pages publiques ne sont pas protégées, sans faux positif sur un préfixe", () => {
    expect(requiredRoleForPath("/")).toBeNull();
    expect(requiredRoleForPath("/teachers")).toBeNull();
    expect(requiredRoleForPath("/administration")).toBeNull();
    expect(requiredRoleForPath("/students-info")).toBeNull();
  });
  it("redirige chaque rôle vers son espace", () => {
    expect(homeForRole("ADMIN")).toBe("/admin");
    expect(homeForRole("TEACHER")).toBe("/teacher");
    expect(homeForRole("STUDENT")).toBe("/student");
  });
  it("empêche les redirections ouvertes après connexion", () => {
    expect(safeRedirectPath("/student/library")).toBe("/student/library");
    expect(safeRedirectPath("https://evil.example")).toBeNull();
    expect(safeRedirectPath("//evil.example")).toBeNull();
    expect(safeRedirectPath("/\\evil.example")).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
  });
});

describe("validation des formulaires d'authentification", () => {
  const valid = { name: "Élève Test", email: "  Eleve@Example.COM ", password: "abcd1234", confirmPassword: "abcd1234", acceptTerms: true, levelId: "lvl1" };
  it("normalise l'email", () => {
    const r = studentRegisterSchema.safeParse(valid);
    expect(r.success && r.data.email).toBe("eleve@example.com");
  });
  it("exige un mot de passe robuste et identique", () => {
    expect(studentRegisterSchema.safeParse({ ...valid, password: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(studentRegisterSchema.safeParse({ ...valid, password: "abcdefgh", confirmPassword: "abcdefgh" }).success).toBe(false);
    const mismatch = studentRegisterSchema.safeParse({ ...valid, confirmPassword: "abcd12345" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0].path).toEqual(["confirmPassword"]);
  });
  it("exige l'acceptation des conditions et un niveau", () => {
    expect(studentRegisterSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
    expect(studentRegisterSchema.safeParse({ ...valid, levelId: "" }).success).toBe(false);
  });
  it("valide le téléphone tunisien", () => {
    expect(studentRegisterSchema.safeParse({ ...valid, phone: "22 123 456" }).success).toBe(true);
    expect(studentRegisterSchema.safeParse({ ...valid, phone: "+216 98 765 432" }).success).toBe(true);
    expect(studentRegisterSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
  });
  it("l'inscription enseignant exige au moins une matière", () => {
    const base = { ...valid, city: "Tunis", headline: "Prof d'économie" };
    expect(teacherRegisterSchema.safeParse({ ...base, subjectIds: [] }).success).toBe(false);
    expect(teacherRegisterSchema.safeParse({ ...base, subjectIds: ["s1"] }).success).toBe(true);
  });
  it("le formulaire de connexion rejette un email invalide", () => {
    expect(loginSchema.safeParse({ email: "pas-un-email", password: "x" }).success).toBe(false);
  });
});

describe("limitation des tentatives", () => {
  it("bloque au-delà de la limite puis libère après la fenêtre", () => {
    const key = `t-${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000, t0 + i)).toBe(true);
    expect(rateLimit(key, 3, 60_000, t0 + 10)).toBe(false);
    expect(rateLimit(key, 3, 60_000, t0 + 61_000)).toBe(true);
  });
});
