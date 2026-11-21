import { route, body } from "@/lib/api";
import { refundSchema } from "@/lib/validation";
import { financeTx, recordRefund } from "@/server/finance";

export const POST = route(async ({ req }) => {
  const v = await body(req, refundSchema);
  return financeTx((tx) => recordRefund(tx, v));
});
