import { addDays, type DateStr } from "./dates";

// Répétition espacée inspirée de SM-2, simplifiée à 4 boutons.
// grade : 0 = à revoir, 1 = difficile, 2 = bien, 3 = facile

export type CardState = { ease: number; interval: number; reps: number; lapses: number };

export function review(card: CardState, grade: 0 | 1 | 2 | 3, todayStr: DateStr) {
  let { ease, interval, reps, lapses } = card;
  if (grade === 0) {
    lapses += 1;
    reps = 0;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps += 1;
    if (reps === 1) interval = grade === 3 ? 3 : 1;
    else if (reps === 2) interval = grade === 1 ? 3 : 6;
    else interval = Math.round(interval * (grade === 1 ? 1.2 : grade === 2 ? ease : ease * 1.3));
    ease = Math.max(1.3, ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0));
    interval = Math.min(Math.max(1, interval), 365);
  }
  return { ease: Math.round(ease * 100) / 100, interval, reps, lapses, dueDate: addDays(todayStr, interval) };
}
