import { z } from "zod";
import { route, body } from "@/lib/api";
import { billPackage, financeTx } from "@/server/finance";

const schema = z.object({ studentId: z.string().min(1), month: z.string().regex(/^\d{4}-\d{2}$/, "Mois invalide") });

export const POST = route(async ({ req }) => {
  const v = await body(req, schema);
  return financeTx((tx) => billPackage(tx, v.studentId, v.month));
});
