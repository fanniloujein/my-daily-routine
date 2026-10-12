import { diffDays, weekday, addMinutesToTime, type DateStr } from "./dates";

export type MedSchedule = {
  times: string[];
  frequency: string; // DAILY | WEEKDAYS | EVERY_N_DAYS
  weekdays: number[];
  everyNDays: number;
  startDate: DateStr;
  endDate?: DateStr | null;
  active: boolean;
};

/** Le médicament est-il prescrit à cette date ? (strictement selon les données saisies) */
export function medOccursOn(m: MedSchedule, d: DateStr): boolean {
  if (!m.active) return false;
  if (d < m.startDate) return false;
  if (m.endDate && d > m.endDate) return false;
  if (m.frequency === "WEEKDAYS") return m.weekdays.includes(weekday(d));
  if (m.frequency === "EVERY_N_DAYS") return diffDays(d, m.startDate) % Math.max(1, m.everyNDays) === 0;
  return true;
}

export function dosesForDay(m: MedSchedule, d: DateStr): string[] {
  return medOccursOn(m, d) ? [...m.times].sort() : [];
}

export function reminderTime(time: string, offset: number) {
  return offset > 0 ? addMinutesToTime(time, -offset) : time;
}

/**
 * Détecte les formulations ambiguës dans les consignes saisies.
 * L'application ne les interprète jamais : elle invite à vérifier l'ordonnance.
 */
export function ambiguityWarnings(input: { instructions?: string | null; dosage?: string | null; times: string[] }): string[] {
  const out: string[] = [];
  const text = `${input.instructions ?? ""} ${input.dosage ?? ""}`.toLowerCase();
  if (/si besoin|au besoin|en cas de/.test(text))
    out.push("La consigne mentionne une prise « si besoin » : les rappels horaires ne s'appliquent peut-être pas. Vérifie avec ton ordonnance ou ton professionnel de santé.");
  if (/environ|à peu près|vers|ou\s+\d/.test(text))
    out.push("La consigne contient une formulation approximative (« environ », « ou… »). Vérifie l'horaire exact sur ton ordonnance.");
  if (/(\d+)\s*(fois|x)\s*par\s*jour/.test(text)) {
    const n = Number(text.match(/(\d+)\s*(fois|x)\s*par\s*jour/)![1]);
    if (n !== input.times.length)
      out.push(`La consigne indique ${n} prise(s) par jour mais ${input.times.length} horaire(s) sont saisis. Vérifie ton ordonnance avant d'enregistrer.`);
  }
  if (/pendant|repas|à jeun|a jeun/.test(text) && !/avant|après|apres|pendant|à jeun|a jeun/.test(text))
    out.push("Le moment par rapport au repas n'est pas clair. Demande confirmation à ton pharmacien ou à ton médecin.");
  return out;
}

export const MED_DISCLAIMER =
  "My Life OS sert uniquement de pense-bête : il ne recommande, ne modifie ni n'interprète aucun traitement. En cas de doute, référez-vous à votre ordonnance ou à votre professionnel de santé.";
