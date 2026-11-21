import { route, body } from "@/lib/api";
import { exportBackup, restoreBackup } from "@/server/backup";
import { today } from "@/lib/dates";
import { z } from "zod";

export const GET = route(async () => {
  const data = await exportBackup();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="sauvegarde-tutoring-${today()}.json"`, "Cache-Control": "no-store" },
  });
});

export const POST = route(async ({ req }) => {
  const v = await body(req, z.object({ confirm: z.literal("RESTAURER"), backup: z.record(z.unknown()) }));
  return restoreBackup(v.backup);
});
