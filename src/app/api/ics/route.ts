import { route } from "@/lib/api";
import { buildUserIcs } from "@/server/icsExport";

/** Téléchargement du fichier .ics (connexion requise). */
export const GET = route(async ({ user }) => {
  const ics = await buildUserIcs(user.id);
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="my-life-os.ics"', "Cache-Control": "no-store" },
  });
});
