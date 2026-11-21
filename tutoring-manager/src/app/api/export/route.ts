import { route, qs } from "@/lib/api";
import { buildExport } from "@/server/exports";

// /api/export?dataset=transactions|payments|finance|sessions&format=xlsx|pdf&from=&to=&studentId=
export const GET = route(async ({ req }) => {
  const p = qs(req);
  const { buffer, filename, type } = await buildExport(p.get("dataset") ?? "", p);
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
});
