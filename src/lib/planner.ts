import { diffDays, minToTime, timeToMin, type DateStr, type TimeStr } from "./dates";
import { freeSlots, type TimedItem } from "./conflicts";

// Planificateur « Organiser ma journée ».
// Principe : les éléments à horaire fixe ne bougent jamais ; les tâches flexibles sont
// classées (priorité, échéance, énergie) puis placées dans les créneaux libres, avec des
// pauses. La capacité de travail dépend du niveau d'énergie déclaré.

export type PlanSettings = {
  dayStart: TimeStr; // début de journée (ex. 08:00)
  workEnd: TimeStr; // heure après laquelle on ne planifie plus de travail (ex. 19:00)
  dayEnd: TimeStr; // fin de journée (ex. 22:30)
  breakMin: number; // pause entre deux tâches
  lunchStart?: TimeStr | null;
  lunchEnd?: TimeStr | null;
};

export type FixedItem = TimedItem & { kind?: string; categoryKind?: string | null };

export type FlexTask = {
  id: string; // id d'activité
  occurrenceDate: DateStr; // date de l'occurrence (récurrences)
  title: string;
  durationMin: number;
  priority: number; // 1-4
  energyCost: number; // 1-3
  dueDate?: DateStr | null;
  categoryKind?: string | null;
  postponeCount?: number;
};

export type PlanGoals = {
  germanMinutesLeft: number; // minutes d'allemand restantes pour atteindre l'objectif hebdo
  sportSessionsLeft: number;
  sportDuration: number;
  sportDayAvailable: boolean;
  sportPreferredTime?: TimeStr | null;
};

export type PlanInput = {
  date: DateStr;
  energy: number; // 1-5
  light?: boolean; // « Mode journée légère »
  settings: PlanSettings;
  notBefore?: TimeStr; // si on planifie la journée en cours : pas avant maintenant
  fixed: FixedItem[];
  tasks: FlexTask[];
  goals?: PlanGoals;
};

export type PlanBlock = {
  key: string;
  kind: "fixed" | "task" | "break" | "rest" | "meal" | "suggestion";
  title: string;
  startTime: TimeStr;
  endTime: TimeStr;
  refId?: string;
  occurrenceDate?: DateStr;
  part?: { index: number; total: number };
  categoryKind?: string | null;
  suggestion?: "german" | "sport";
};

export type PlanResult = {
  date: DateStr;
  energy: number;
  light: boolean;
  blocks: PlanBlock[];
  postponed: { id: string; occurrenceDate: DateStr; title: string; reason: string }[];
  notPlaced: { id: string; title: string; reason: string }[];
  focusMinutes: number;
  capacityMinutes: number;
  messages: string[];
};

export const ENERGY_PROFILES: Record<number, { capacity: number; heavy: number; chunk: number; pause: number; rest: number }> = {
  1: { capacity: 45, heavy: 0, chunk: 25, pause: 20, rest: 30 },
  2: { capacity: 120, heavy: 1, chunk: 30, pause: 15, rest: 20 },
  3: { capacity: 240, heavy: 2, chunk: 50, pause: 10, rest: 0 },
  4: { capacity: 360, heavy: 3, chunk: 90, pause: 10, rest: 0 },
  5: { capacity: 420, heavy: 4, chunk: 90, pause: 10, rest: 0 },
};

export function scoreTask(t: FlexTask, date: DateStr, energy: number): number {
  let s = t.priority * 10;
  if (t.dueDate) {
    const d = diffDays(t.dueDate, date);
    if (d <= 0) s += 30;
    else if (d === 1) s += 18;
    else if (d <= 3) s += 8;
  }
  if (t.categoryKind === "prep") s += 6; // préparer les cours à temps
  if (energy <= 2 && t.energyCost >= 3) s -= 15;
  if (energy >= 4 && t.energyCost >= 3) s += 4; // profiter de l'énergie pour le travail exigeant
  s += Math.min(t.postponeCount ?? 0, 3) * 2; // ne pas laisser une tâche reportée indéfiniment
  return s;
}

export function isUrgent(t: FlexTask, date: DateStr): boolean {
  return t.priority >= 4 || (!!t.dueDate && diffDays(t.dueDate, date) <= 0);
}

/** Découpe une durée en parties de taille maximale `chunk` (dernier morceau ≥ 15 min si possible). */
export function splitDuration(total: number, chunk: number): number[] {
  if (total <= chunk) return [total];
  const n = Math.ceil(total / chunk);
  const base = Math.floor(total / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] += total - base * n;
  return parts;
}

export function planDay(input: PlanInput): PlanResult {
  const light = !!input.light;
  const energy = light ? 1 : Math.min(5, Math.max(1, Math.round(input.energy)));
  const profile = ENERGY_PROFILES[energy];
  const capacity = light ? 30 : profile.capacity;
  const { settings, date } = input;
  const messages: string[] = [];

  const blocks: PlanBlock[] = input.fixed
    .filter((f) => f.startTime && f.endTime)
    .map((f) => ({
      key: `fixed-${f.id}`,
      kind: "fixed" as const,
      title: f.title,
      startTime: f.startTime!,
      endTime: f.endTime!,
      refId: f.id,
      categoryKind: f.categoryKind,
    }));

  const busy: TimedItem[] = blocks.map((b) => ({ id: b.key, title: b.title, startTime: b.startTime, endTime: b.endTime }));

  // Pause déjeuner (si elle ne chevauche pas un rendez-vous fixe)
  if (settings.lunchStart && settings.lunchEnd) {
    const lunch = { id: "lunch", title: "Pause déjeuner", startTime: settings.lunchStart, endTime: settings.lunchEnd };
    const clash = busy.some(
      (b) => timeToMin(b.startTime!) < timeToMin(lunch.endTime) && timeToMin(lunch.startTime) < timeToMin(b.endTime!),
    );
    if (!clash) {
      blocks.push({ key: "meal-lunch", kind: "meal", ...lunch });
      busy.push(lunch);
    }
  }

  // Tri des tâches
  const sorted = [...input.tasks].sort((a, b) => scoreTask(b, date, energy) - scoreTask(a, date, energy));

  const postponed: PlanResult["postponed"] = [];
  const notPlaced: PlanResult["notPlaced"] = [];
  let selected: FlexTask[] = [];

  if (energy <= 2) {
    // Énergie faible : on garde l'urgent, on reporte le flexible non urgent.
    for (const t of sorted) {
      if (isUrgent(t, date)) selected.push(t);
      else
        postponed.push({
          id: t.id,
          occurrenceDate: t.occurrenceDate,
          title: t.title,
          reason: "Non urgent : reporté pour préserver ton énergie",
        });
    }
    // Conserver une petite tâche prioritaire si cela reste réaliste
    if (selected.length === 0 && postponed.length > 0) {
      const keep = sorted.find((t) => t.energyCost <= 2) ?? sorted[0];
      selected = [keep];
      const idx = postponed.findIndex((p) => p.id === keep.id && p.occurrenceDate === keep.occurrenceDate);
      if (idx >= 0) postponed.splice(idx, 1);
    }
  } else {
    selected = sorted;
  }

  let focus = 0;
  let heavyCount = 0;
  const workEnd = settings.workEnd < settings.dayEnd ? settings.workEnd : settings.dayEnd;

  for (const t of selected) {
    const remainingCapacity = capacity - focus;
    if (remainingCapacity < 15) {
      if (energy <= 2 || light) postponed.push({ id: t.id, occurrenceDate: t.occurrenceDate, title: t.title, reason: "Capacité du jour atteinte" });
      else notPlaced.push({ id: t.id, title: t.title, reason: "Capacité du jour atteinte (reste en liste)" });
      continue;
    }
    if (t.energyCost >= 3 && heavyCount >= profile.heavy && !isUrgent(t, date)) {
      postponed.push({ id: t.id, occurrenceDate: t.occurrenceDate, title: t.title, reason: "Tâche exigeante : à placer un jour plus énergique" });
      continue;
    }

    let total = t.durationMin;
    let truncated = false;
    if (total > remainingCapacity) {
      total = Math.max(15, Math.floor(remainingCapacity / 5) * 5);
      truncated = true;
    }
    const parts = splitDuration(total, profile.chunk);
    const placedParts: PlanBlock[] = [];

    for (let i = 0; i < parts.length; i++) {
      const slot = freeSlots(busy, settings.dayStart, workEnd, settings.breakMin, input.notBefore).find(
        (s) => s.end - s.start >= parts[i],
      );
      if (!slot) break;
      const block: PlanBlock = {
        key: `task-${t.id}-${t.occurrenceDate}-${i}`,
        kind: "task",
        title: t.title,
        startTime: minToTime(slot.start),
        endTime: minToTime(slot.start + parts[i]),
        refId: t.id,
        occurrenceDate: t.occurrenceDate,
        part: parts.length > 1 ? { index: i + 1, total: parts.length } : undefined,
        categoryKind: t.categoryKind,
      };
      placedParts.push(block);
      busy.push({ id: block.key, title: block.title, startTime: block.startTime, endTime: block.endTime });
      // Temps de repos après chaque bloc quand l'énergie est faible
      if (profile.rest > 0) {
        const restStart = slot.start + parts[i] + settings.breakMin;
        const restEnd = restStart + profile.rest;
        if (restEnd <= timeToMin(settings.dayEnd)) {
          const free = freeSlots(busy, settings.dayStart, settings.dayEnd, 0).some((s) => s.start <= restStart && s.end >= restEnd);
          if (free) {
            const rest: PlanBlock = {
              key: `rest-${block.key}`,
              kind: "rest",
              title: "Pause / repos",
              startTime: minToTime(restStart),
              endTime: minToTime(restEnd),
            };
            blocks.push(rest);
            busy.push({ id: rest.key, title: rest.title, startTime: rest.startTime, endTime: rest.endTime });
          }
        }
      }
    }

    if (placedParts.length === 0) {
      notPlaced.push({ id: t.id, title: t.title, reason: "Aucun créneau libre suffisant aujourd'hui" });
      continue;
    }
    blocks.push(...placedParts);
    focus += placedParts.reduce((s, b) => s + timeToMin(b.endTime) - timeToMin(b.startTime), 0);
    if (t.energyCost >= 3) heavyCount++;
    if (truncated || placedParts.length < parts.length) {
      messages.push(`« ${t.title} » : seule une première étape est prévue aujourd'hui, le reste pourra suivre plus tard.`);
    }
  }

  // Suggestions selon l'énergie et les objectifs (jamais en conflit, jamais forcées)
  const goals = input.goals;
  if (goals && !light) {
    const freeNow = () => freeSlots(busy, settings.dayStart, settings.dayEnd, settings.breakMin, input.notBefore);
    if (energy >= 3 && goals.germanMinutesLeft > 0) {
      const dur = energy >= 4 ? Math.min(30, Math.max(15, goals.germanMinutesLeft)) : 15;
      const slot = freeNow().find((s) => s.end - s.start >= dur && s.start < timeToMin(workEnd));
      if (slot) {
        const b: PlanBlock = {
          key: "suggest-german",
          kind: "suggestion",
          suggestion: "german",
          title: `Allemand (${dur} min)`,
          startTime: minToTime(slot.start),
          endTime: minToTime(slot.start + dur),
          categoryKind: "german",
        };
        blocks.push(b);
        busy.push({ id: b.key, title: b.title, startTime: b.startTime, endTime: b.endTime });
      }
    }
    if (energy >= 3 && goals.sportSessionsLeft > 0 && goals.sportDayAvailable) {
      const dur = energy === 3 ? Math.min(30, goals.sportDuration) : goals.sportDuration;
      const pref = goals.sportPreferredTime ? timeToMin(goals.sportPreferredTime) : null;
      const slots = freeNow().filter((s) => s.end - s.start >= dur);
      const slot = (pref !== null && slots.find((s) => s.start <= pref && s.end >= pref + dur)) || slots[0];
      if (slot) {
        const start = pref !== null && slot.start <= pref && slot.end >= pref + dur ? pref : slot.start;
        const b: PlanBlock = {
          key: "suggest-sport",
          kind: "suggestion",
          suggestion: "sport",
          title: `Sport (${dur} min)`,
          startTime: minToTime(start),
          endTime: minToTime(start + dur),
          categoryKind: "sport",
        };
        blocks.push(b);
        busy.push({ id: b.key, title: b.title, startTime: b.startTime, endTime: b.endTime });
      }
    }
  }

  // Petites pauses visibles entre deux blocs consécutifs
  blocks.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
  const withBreaks: PlanBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    withBreaks.push(blocks[i]);
    const next = blocks[i + 1];
    if (!next) continue;
    const gap = timeToMin(next.startTime) - timeToMin(blocks[i].endTime);
    const bothWork = blocks[i].kind !== "meal" && blocks[i].kind !== "rest" && next.kind !== "meal" && next.kind !== "rest";
    if (bothWork && gap >= 5 && gap <= 30) {
      withBreaks.push({
        key: `break-${i}`,
        kind: "break",
        title: "Pause",
        startTime: blocks[i].endTime,
        endTime: next.startTime,
      });
    }
  }

  if (energy <= 2) {
    messages.unshift(
      light
        ? "Mode journée légère : seulement l'essentiel. Prendre soin de toi fait aussi partie du programme."
        : "Énergie basse aujourd'hui : rendez-vous fixes et rappels conservés, le reste est allégé. C'est très bien ainsi.",
    );
  } else if (energy >= 4) {
    messages.unshift("Belle énergie ! Le travail concentré est placé en priorité, avec des pauses régulières.");
  } else {
    messages.unshift("Journée équilibrée : l'important d'abord, avec des pauses entre les tâches.");
  }
  if (postponed.length) messages.push(`${postponed.length} activité(s) flexible(s) proposée(s) au report — rien n'est perdu.`);

  return {
    date,
    energy,
    light,
    blocks: withBreaks,
    postponed,
    notPlaced,
    focusMinutes: focus,
    capacityMinutes: capacity,
    messages,
  };
}
