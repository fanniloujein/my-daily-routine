import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/server/db";
import { toServiceDef } from "@/server/catalog";
import { getPricing } from "@/server/settings";
import { ServiceEditor } from "@/components/admin/ServiceEditor";

export default async function ServiceEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await prisma.service.findUnique({ where: { slug } });
  if (!row) notFound();
  const pricing = await getPricing();
  const def = toServiceDef(row);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/services" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Tous les services
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl">{def.name.fr}</h1>
        <Link href={`/fr/configurateur?service=${def.slug}`} target="_blank" className="btn-ghost btn-sm">Tester dans le configurateur</Link>
      </div>
      <ServiceEditor initial={def} currency={pricing.currency} />
    </div>
  );
}
