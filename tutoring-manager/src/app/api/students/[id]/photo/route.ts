import { prisma } from "@/lib/db";
import { route, fail } from "@/lib/api";

export const GET = route<{ id: string }>(async ({ params }) => {
  const s = await prisma.student.findUnique({ where: { id: params.id }, select: { photo: true } });
  const m = s?.photo?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) fail(404, "Pas de photo.");
  return new Response(Buffer.from(m![2], "base64"), { headers: { "Content-Type": m![1], "Cache-Control": "private, max-age=300" } });
});
