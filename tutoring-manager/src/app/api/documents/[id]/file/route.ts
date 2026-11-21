import { prisma } from "@/lib/db";
import { route, fail } from "@/lib/api";

export const GET = route<{ id: string }>(async ({ params, req }) => {
  const d = await prisma.document.findUnique({ where: { id: params.id } });
  if (!d) fail(404, "Document introuvable.");
  if (!d!.data) return Response.redirect(d!.url ?? "/documents", 302);
  const inline = new URL(req.url).searchParams.get("download") !== "1" && /^(application\/pdf|image\/)/.test(d!.mimeType ?? "");
  return new Response(new Uint8Array(d!.data), {
    headers: {
      "Content-Type": d!.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(d!.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
