import { route, searchParam } from "@/lib/api";
import { today } from "@/lib/dates";
import { exportData } from "@/server/backup";

export const GET = route(async ({ req, user }) => {
  const health = searchParam(req, "health") === "1";
  const data = await exportData(user.id, health);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-life-os-sauvegarde-${today()}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
