import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/server/db";
import { getServices, toProject } from "@/server/catalog";
import { PortfolioEditor, type ProjectForm } from "@/components/admin/PortfolioEditor";

export default async function PortfolioEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const services = (await getServices()).map((s) => ({ slug: s.slug, name: s.name.fr }));
  const empty = { fr: "", en: "", ar: "" };
  let initial: ProjectForm;
  if (id === "nouveau") {
    initial = { slug: "", category: "web", title: empty, summary: empty, body: empty, results: null, services: [], client: null, year: new Date().getFullYear(), imageIds: [], published: false, order: 0 };
  } else {
    const row = await prisma.portfolioProject.findUnique({ where: { id } });
    if (!row) notFound();
    const p = toProject(row);
    initial = { ...p, results: p.results };
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/portfolio" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Toutes les réalisations
      </Link>
      <h1 className="text-2xl sm:text-3xl">{id === "nouveau" ? "Nouveau projet" : initial.title.fr}</h1>
      <PortfolioEditor key={id} initial={initial} services={services} />
    </div>
  );
}
