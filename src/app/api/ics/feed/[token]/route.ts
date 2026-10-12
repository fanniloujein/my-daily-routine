import { prisma } from "@/lib/db";
import { buildUserIcs } from "@/server/icsExport";

/** Flux d'abonnement public protégé par un jeton secret (révocable dans les paramètres). */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const raw = token.replace(/\.ics$/, "");
  if (raw.length < 20) return new Response("Introuvable", { status: 404 });
  const user = await prisma.user.findUnique({ where: { icsToken: raw } });
  if (!user) return new Response("Introuvable", { status: 404 });
  return new Response(await buildUserIcs(user.id), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
}
