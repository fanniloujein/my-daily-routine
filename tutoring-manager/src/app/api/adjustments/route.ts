import { route, body } from "@/lib/api";
import { adjustmentSchema } from "@/lib/validation";
import { addAdjustment, financeTx } from "@/server/finance";

export const POST = route(async ({ req }) => {
  const v = await body(req, adjustmentSchema);
  return financeTx((tx) => addAdjustment(tx, v));
});
