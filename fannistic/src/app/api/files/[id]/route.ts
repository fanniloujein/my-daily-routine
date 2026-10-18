import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/auth";
import { findAccessibleRequest } from "@/server/requests";
import { IMAGE_MIMES } from "@/server/files";

function notFound() {
  return new Response("Not found", { status: 404 });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const file = await prisma.storedFile.findUnique({ where: { id }, include: { request: { select: { reference: true } } } });
  if (!file) return notFound();

  let isPublic = false;
  if (file.kind === "PORTFOLIO_IMAGE") {
    isPublic = true;
  } else {
    if (!file.request) return notFound();
    const user = await getSessionUser();
    const allowed = await findAccessibleRequest(file.request.reference, url.searchParams.get("t"), user);
    if (!allowed) return notFound();
  }

  const inline = IMAGE_MIMES.has(file.mime) || file.mime === "application/pdf";
  const encoded = encodeURIComponent(file.originalName);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": `${inline && url.searchParams.get("dl") !== "1" ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": isPublic ? "public, max-age=86400" : "private, no-store",
    },
  });
}
