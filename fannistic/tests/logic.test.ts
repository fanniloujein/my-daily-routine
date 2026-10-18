import { describe, expect, it } from "vitest";
import { DEFAULT_SERVICES } from "@/lib/services/defaults";
import { computeEstimate, validateAllAnswers, validateServiceAnswers, visibleQuestions } from "@/lib/services/logic";
import { describeAnswers } from "@/lib/services/describe";
import { serviceSchema } from "@/lib/services/schema";
import { contactSchema, phoneRequired, submissionSchema } from "@/lib/services/project";
import { UNSURE, type ServiceDef } from "@/lib/services/types";

const svc = (slug: string) => structuredClone(DEFAULT_SERVICES.find((s) => s.slug === slug)!) as ServiceDef;
const pricing = { currency: "EUR", estimatesEnabled: true, urgentSurchargePercent: null };

describe("configuration par défaut", () => {
  it("chaque service par défaut est valide selon le schéma d'administration", () => {
    for (const s of DEFAULT_SERVICES) {
      const r = serviceSchema.safeParse(s);
      expect(r.success, `${s.slug}: ${r.success ? "" : r.error.issues[0]?.message}`).toBe(true);
    }
  });
  it("propose les 9 catégories demandées, toutes traduites", () => {
    expect(DEFAULT_SERVICES).toHaveLength(9);
    for (const s of DEFAULT_SERVICES) {
      for (const q of s.questions) {
        expect(q.label.en, `${s.slug}.${q.id}`).not.toBe("");
        expect(q.label.ar, `${s.slug}.${q.id}`).not.toBe("");
        for (const o of q.options ?? []) expect(o.label.ar).not.toBe("");
      }
    }
  });
  it("aucun tarif n'est inventé par défaut", () => {
    for (const s of DEFAULT_SERVICES) expect(s.baseMin).toBeNull();
  });
});

describe("filtres conditionnels", () => {
  it("affiche la quantité seulement pour une carte imprimée", () => {
    const card = svc("carte-de-visite");
    const ids = (a: Record<string, string>) => visibleQuestions(card, a).map((q) => q.id);
    expect(ids({ delivery: "digital" })).not.toContain("quantity");
    expect(ids({ delivery: "print" })).toContain("quantity");
    expect(ids({ delivery: "both" })).toContain("quantity");
  });
  it("retire les réponses des questions masquées", () => {
    const card = svc("carte-de-visite");
    const r = validateServiceAnswers(card, { delivery: "digital", quantity: "500", fullName: "Ana" });
    expect(r.errors).toEqual({});
    expect(r.value.quantity).toBeUndefined();
  });
  it("les éléments d'identité ne sont obligatoires que pour une sélection partielle", () => {
    const id = svc("identite-visuelle");
    expect(validateServiceAnswers(id, { scope: "complete", brandName: "X" }).errors).toEqual({});
    expect(validateServiceAnswers(id, { scope: "custom", brandName: "X" }).errors.elements).toBe("required");
  });
});

describe("validation des réponses", () => {
  const web = svc("site-web");
  it("exige le type de site mais accepte « Je ne sais pas »", () => {
    expect(validateServiceAnswers(web, {}).errors.type).toBe("required");
    expect(validateServiceAnswers(web, { type: UNSURE }).errors).toEqual({});
  });
  it("refuse les valeurs hors liste et les questions inconnues", () => {
    const r = validateServiceAnswers(web, { type: "hack", unknown: "x", features: ["contact", "nope"] });
    expect(r.errors.type).toBe("invalid");
    expect(r.errors.features).toBe("invalid");
    expect("unknown" in r.value).toBe(false);
  });
  it("« Je ne sais pas » est exclusif dans un choix multiple", () => {
    expect(validateServiceAnswers(web, { type: "vitrine", features: [UNSURE, "blog"] }).errors.features).toBe("invalid");
  });
  it("contrôle les formats e-mail et URL", () => {
    const card = svc("carte-de-visite");
    const r = validateServiceAnswers(card, { fullName: "A", delivery: "digital", email: "pas-un-email", website: "javascript:alert(1)" });
    expect(r.errors.email).toBe("email");
    expect(r.errors.website).toBe("url");
  });
  it("ignore les questions désactivées par l'administrateur", () => {
    const w = svc("site-web");
    w.questions.find((q) => q.id === "type")!.enabled = false;
    expect(validateServiceAnswers(w, {}).errors).toEqual({});
  });
  it("valide plusieurs services d'un coup", () => {
    const r = validateAllAnswers([svc("site-web"), svc("logo")], ["site-web", "logo"], { "site-web": { type: "vitrine" }, logo: {} });
    expect(r.errors.logo?.brandName).toBe("required");
    expect(r.errors["site-web"]).toBeUndefined();
  });
});

describe("estimation de prix", () => {
  it("affiche « devis personnalisé » sans tarif", () => {
    expect(computeEstimate([svc("site-web")], ["site-web"], {}, undefined, pricing)).toEqual({ kind: "custom", reason: "no-pricing" });
  });
  it("additionne prix de base et options", () => {
    const w = svc("site-web");
    w.baseMin = 800;
    w.baseMax = 1200;
    const features = w.questions.find((q) => q.id === "features")!;
    features.options!.find((o) => o.value === "payment")!.priceMin = 300;
    features.options!.find((o) => o.value === "payment")!.priceMax = 500;
    const e = computeEstimate([w], ["site-web"], { "site-web": { type: "ecommerce", features: ["payment", "blog"] } }, "1-2m", pricing);
    expect(e).toEqual({ kind: "range", min: 1100, max: 1700, urgentApplied: false });
  });
  it("n'applique la majoration urgente que si elle est définie", () => {
    const l = svc("logo");
    l.baseMin = 200;
    l.baseMax = 400;
    expect(computeEstimate([l], ["logo"], {}, "urgent", pricing)).toMatchObject({ min: 200, max: 400, urgentApplied: false });
    expect(computeEstimate([l], ["logo"], {}, "urgent", { ...pricing, urgentSurchargePercent: 25 })).toMatchObject({ min: 250, max: 500, urgentApplied: true });
  });
  it("un service sans tarif rend toute l'estimation personnalisée", () => {
    const l = svc("logo");
    l.baseMin = 200;
    l.baseMax = 400;
    expect(computeEstimate([l, svc("catalogue")], ["logo", "catalogue"], {}, undefined, pricing).kind).toBe("custom");
  });
  it("ignore les options masquées", () => {
    const c = svc("carte-de-visite");
    c.baseMin = 50;
    c.baseMax = 80;
    c.questions.find((q) => q.id === "quantity")!.options![0].priceMin = 40;
    const e = computeEstimate([c], ["carte-de-visite"], { "carte-de-visite": { delivery: "digital", quantity: "100" } }, undefined, pricing);
    expect(e).toMatchObject({ min: 50, max: 80 });
  });
  it("peut être désactivée", () => {
    const l = svc("logo");
    l.baseMin = 1;
    l.baseMax = 2;
    expect(computeEstimate([l], ["logo"], {}, undefined, { ...pricing, estimatesEnabled: false }).kind).toBe("custom");
  });
});

describe("récapitulatif", () => {
  it("traduit les valeurs choisies", () => {
    const [sec] = describeAnswers([svc("site-web")], ["site-web"], { "site-web": { type: "vitrine", pages: UNSURE } });
    expect(sec.items.find((i) => i.id === "type")!.value).toEqual({ kind: "options", labels: [{ fr: "Site vitrine", en: "Showcase site", ar: "موقع تعريفي" }] });
    expect(sec.items.find((i) => i.id === "pages")!.value).toEqual({ kind: "unsure" });
  });
});

describe("coordonnées et envoi", () => {
  it("valide les coordonnées", () => {
    expect(contactSchema.safeParse({ name: "Ana", email: "ana@exemple.com", country: "Maroc", contactPref: "email" }).success).toBe(true);
    const bad = contactSchema.safeParse({ name: "A", email: "x", country: "", contactPref: "fax" });
    expect(bad.success).toBe(false);
  });
  it("le téléphone devient obligatoire pour un rappel", () => {
    expect(phoneRequired("phone")).toBe(true);
    expect(phoneRequired("whatsapp")).toBe(true);
    expect(phoneRequired("email")).toBe(false);
  });
  it("exige le consentement", () => {
    const base = { kind: "QUOTE", services: ["logo"], answers: {}, project: {}, contact: { name: "Ana", email: "a@b.co", country: "FR", contactPref: "email" }, locale: "fr", startedAt: 1 };
    expect(submissionSchema.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(submissionSchema.safeParse({ ...base, consent: false }).success).toBe(false);
  });
});
