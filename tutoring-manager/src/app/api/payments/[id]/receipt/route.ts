import { route } from "@/lib/api";
import { receiptPdf } from "@/server/exports";

export const GET = route<{ id: string }>(async ({ params }) => {
  const { buffer, filename } = await receiptPdf(params.id);
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "no-store" } });
});
