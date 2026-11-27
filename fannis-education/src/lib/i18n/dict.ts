import { fr } from "./dictionaries/fr";
import { ar } from "./dictionaries/ar";
import type { AppLocale } from "./config";

export type Dict = typeof fr;
export const dictionaries: Record<AppLocale, Dict> = { fr, ar };
