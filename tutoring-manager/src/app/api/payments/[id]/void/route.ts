import { route, body } from "@/lib/api";
import { voidSchema } from "@/lib/validation";
import { financeTx, voidPayment } from "@/server/finance";

export const POST = route<{ id: string }>(async ({ req, params }) => {
  const { reason } = await body(req, voidSchema);
  await financeTx((tx) => voidPayment(tx, params.id, reason));
});
