import { route, body } from "@/lib/api";
import { voidSchema } from "@/lib/validation";
import { financeTx, voidInvoice } from "@/server/finance";

export const POST = route<{ id: string }>(async ({ req, params }) => {
  const { reason } = await body(req, voidSchema);
  await financeTx((tx) => voidInvoice(tx, params.id, reason));
});
