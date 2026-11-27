import { arBase } from "./ar/base";
import { arStudent } from "./ar/student";
import { arStaff } from "./ar/staff";
import type { fr } from "./fr";

export const ar: typeof fr = { ...arBase, ...arStudent, ...arStaff };
