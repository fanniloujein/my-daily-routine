import { frBase } from "./fr/base";
import { frStudent } from "./fr/student";
import { frStaff } from "./fr/staff";

export const fr = { ...frBase, ...frStudent, ...frStaff };
