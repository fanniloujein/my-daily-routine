// « Que puis-je faire maintenant ? » — options adaptées au temps disponible et à l'énergie.
// Volontairement orienté repos/plaisir : un moment libre n'est pas une séance de travail.

export type Suggestion = { title: string; detail: string; durationMin: number; kind: string; mediaId?: string };

type Media = { id: string; title: string; type: string; durationMin: number; status: string; genre?: string | null };
type Idea = { title: string; durationMin: number; minEnergy: number; kind: string };

const BUILTIN: Idea[] = [
  { title: "Faire une vraie pause", durationMin: 10, minEnergy: 1, kind: "RELAX" },
  { title: "Respiration calme (cohérence cardiaque)", durationMin: 5, minEnergy: 1, kind: "RELAX" },
  { title: "Boire un thé loin des écrans", durationMin: 15, minEnergy: 1, kind: "RELAX" },
  { title: "Sieste courte", durationMin: 20, minEnergy: 1, kind: "RELAX" },
  { title: "Marcher dehors", durationMin: 20, minEnergy: 2, kind: "MOVE" },
  { title: "Étirements doux", durationMin: 15, minEnergy: 1, kind: "MOVE" },
  { title: "Lire quelques pages", durationMin: 30, minEnergy: 2, kind: "READ" },
  { title: "Appeler une proche", durationMin: 20, minEnergy: 2, kind: "SOCIAL" },
  { title: "Écouter de la musique", durationMin: 20, minEnergy: 1, kind: "RELAX" },
];

export function suggestNow(opts: { freeMinutes: number; energy: number; media: Media[]; ideas: Idea[] }): Suggestion[] {
  const { freeMinutes, energy } = opts;
  const out: Suggestion[] = [];
  const ideas = [...opts.ideas, ...BUILTIN].filter((i) => i.durationMin <= freeMinutes && i.minEnergy <= Math.max(1, energy));

  // Contenus à regarder
  const watch = opts.media.filter((m) => m.status !== "DONE");
  const series = watch.filter((m) => m.type === "SERIES" && m.durationMin <= freeMinutes);
  const movies = watch.filter((m) => m.type === "MOVIE" && m.durationMin <= freeMinutes);
  const inProgress = series.find((m) => m.status === "WATCHING") ?? series[0];
  if (inProgress) out.push({ title: `Un épisode de « ${inProgress.title} »`, detail: `${inProgress.durationMin} min`, durationMin: inProgress.durationMin, kind: "WATCH", mediaId: inProgress.id });
  if (movies.length && freeMinutes >= 90) {
    const m = movies[0];
    out.push({ title: `Regarder « ${m.title} »`, detail: `${m.genre ?? "Film"} · ${m.durationMin} min`, durationMin: m.durationMin, kind: "WATCH", mediaId: m.id });
  }

  // Idées de détente (priorité au repos si énergie basse)
  const sorted = ideas.sort((a, b) => {
    const restFirst = energy <= 2 ? Number(b.kind === "RELAX") - Number(a.kind === "RELAX") : 0;
    return restFirst || b.durationMin - a.durationMin;
  });
  const seen = new Set<string>();
  for (const i of sorted) {
    if (seen.has(i.title)) continue;
    seen.add(i.title);
    out.push({ title: i.title, detail: `${i.durationMin} min`, durationMin: i.durationMin, kind: i.kind });
    if (out.length >= 5) break;
  }
  if (freeMinutes < 5) return [{ title: "Souffler un instant", detail: "Quelques respirations profondes", durationMin: 2, kind: "RELAX" }];
  return out.slice(0, 5);
}
