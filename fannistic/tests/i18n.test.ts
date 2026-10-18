import { describe, expect, it } from "vitest";
import fr from "@/i18n/fr";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { dir, fmt } from "@/i18n";

function keys(o: unknown, prefix = ""): string[] {
  if (typeof o !== "object" || o === null) return [prefix];
  if (Array.isArray(o)) return [`${prefix}[${o.length}]`, ...o.flatMap((v, i) => keys(v, `${prefix}[${i}]`))];
  return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("traductions", () => {
  it("l'anglais et l'arabe ont exactement les mêmes clés que le français", () => {
    expect(keys(en)).toEqual(keys(fr));
    expect(keys(ar)).toEqual(keys(fr));
  });
  it("aucun texte vide", () => {
    for (const d of [fr, en, ar]) {
      const walk = (o: unknown): void => {
        if (typeof o === "string") expect(o.trim().length).toBeGreaterThan(0);
        else if (o && typeof o === "object") Object.values(o).forEach(walk);
      };
      walk(d);
    }
  });
  it("les variables {x} sont conservées dans chaque langue", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const pairs = (a: unknown, b: unknown, path: string): void => {
      if (typeof a === "string") expect(vars(b as string), path).toBe(vars(a));
      else if (a && typeof a === "object") Object.keys(a).forEach((k) => pairs((a as never)[k], (b as never)[k], `${path}.${k}`));
    };
    pairs(fr, en, "en");
    pairs(fr, ar, "ar");
  });
  it("l'arabe s'affiche de droite à gauche", () => {
    expect(dir("ar")).toBe("rtl");
    expect(dir("fr")).toBe("ltr");
  });
  it("fmt remplace les variables", () => {
    expect(fmt("Étape {current} sur {total}", { current: 2, total: 5 })).toBe("Étape 2 sur 5");
  });
});
