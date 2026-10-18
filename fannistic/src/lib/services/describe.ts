import { asArray, visibleQuestions } from "./logic";
import { UNSURE, tr, type Answers, type L10n, type ServiceDef } from "./types";

export const UNSURE_LABEL: L10n = tr("Je ne sais pas, conseillez-moi", "I’m not sure, advise me", "لا أعرف، انصحوني");

export type SnapshotValue = { kind: "options"; labels: L10n[] } | { kind: "text"; text: string } | { kind: "unsure" };

export interface SnapshotItem {
  id: string;
  label: L10n;
  value: SnapshotValue;
}

export interface SnapshotSection {
  slug: string;
  name: L10n;
  items: SnapshotItem[];
}

/**
 * Transforme les réponses brutes en sections lisibles (libellés traduits).
 * Sert au récapitulatif du configurateur et à l'instantané enregistré avec la demande.
 */
export function describeAnswers(defs: ServiceDef[], selected: string[], answers: Answers): SnapshotSection[] {
  const sections: SnapshotSection[] = [];
  for (const slug of selected) {
    const def = defs.find((d) => d.slug === slug);
    if (!def) continue;
    const a = answers[slug] ?? {};
    const items: SnapshotItem[] = [];
    for (const q of visibleQuestions(def, a)) {
      if (q.type === "note") continue;
      const values = asArray(a[q.id]);
      if (!values.length) continue;
      let value: SnapshotValue;
      if (values.length === 1 && values[0] === UNSURE) value = { kind: "unsure" };
      else if (q.options?.length) {
        value = {
          kind: "options",
          labels: values.map((v) => q.options!.find((o) => o.value === v)?.label ?? tr(v, v, v)),
        };
      } else value = { kind: "text", text: values.join(", ") };
      items.push({ id: q.id, label: q.label, value });
    }
    sections.push({ slug, name: def.name, items });
  }
  return sections;
}
