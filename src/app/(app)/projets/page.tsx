"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, FolderKanban, Plus } from "lucide-react";
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Progress, Segmented } from "@/components/ui";
import { ProjectForm, type Project } from "@/components/ProjectForm";
import { cx, fmtDayNum, useApi } from "@/lib/client";
import { diffDays, formatDuration, today } from "@/lib/dates";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";

export default function ProjetsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Projets />
    </Suspense>
  );
}

function Projets() {
  const params = useSearchParams();
  const router = useRouter();
  const [form, setForm] = useState(false);
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");
  const { data, error, mutate } = useApi<(Project & { tasksTotal: number; tasksDone: number; estimateMin: number; spentMin: number; events: { id: string; type: string; title: string; date: string; done: boolean }[] })[]>("/api/projects");

  useEffect(() => {
    if (params.get("new") === "project") {
      setForm(true);
      router.replace("/projets");
    }
  }, [params, router]);

  const list = (data ?? []).filter((p) => (filter === "all" ? true : filter === "done" ? p.status === "DONE" : p.status !== "DONE"));
  const t = today();

  return (
    <div>
      <PageHeader
        title="Projets freelance"
        subtitle="Clients, délais, tâches et temps passé."
        actions={
          <Button onClick={() => setForm(true)}>
            <Plus className="h-4 w-4" /> Projet
          </Button>
        }
      />
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "active", label: "En cours" },
          { value: "done", label: "Terminés" },
          { value: "all", label: "Tous" },
        ]}
      />
      {error ? (
        <ErrorBox error={error} onRetry={() => mutate()} />
      ) : !data ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty icon={<FolderKanban className="h-8 w-8" />} title="Aucun projet ici" action={<Button size="sm" onClick={() => setForm(true)}>Créer un projet</Button>}>
          Astuce : le modèle « site web » crée automatiquement les étapes (besoins, maquette, front, back, tests, déploiement).
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const progress = p.tasksTotal ? Math.round((p.tasksDone / p.tasksTotal) * 100) : 0;
            const daysLeft = p.deadline ? diffDays(p.deadline, t) : null;
            const nextEvent = p.events.find((e) => !e.done && e.date >= t);
            return (
              <Link key={p.id} href={`/projets/${p.id}`} className="card p-4 transition hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted">{p.client}</div>
                    <div className="truncate font-display text-lg font-semibold text-ink">{p.name}</div>
                  </div>
                  <Badge tone={p.status === "ACTIVE" ? "primary" : p.status === "DONE" ? "success" : p.status === "ON_HOLD" ? "warning" : "lavender"}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Progress value={progress} tone={progress === 100 ? "success" : "primary"} className="flex-1" />
                  <span className="text-xs text-muted">{progress} %</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                  <span>
                    {p.tasksDone}/{p.tasksTotal} tâches
                  </span>
                  <span>
                    {formatDuration(p.spentMin)} / {formatDuration(p.estimateMin)} estimées
                  </span>
                  {p.budget != null && <span>{p.budget.toLocaleString("fr-FR")} €</span>}
                </div>
                {p.deadline && (
                  <div className={cx("mt-2 flex items-center gap-1 text-xs", daysLeft !== null && daysLeft <= 3 && p.status !== "DONE" ? "font-medium text-warning" : "text-muted")}>
                    <Calendar className="h-3.5 w-3.5" /> Échéance {fmtDayNum(p.deadline)}
                    {daysLeft !== null && p.status !== "DONE" && ` · ${daysLeft < 0 ? `dépassée de ${-daysLeft} j` : daysLeft === 0 ? "aujourd'hui" : `dans ${daysLeft} j`}`}
                  </div>
                )}
                {p.nextAction && <p className="mt-2 truncate text-xs text-ink-2">➜ {p.nextAction}</p>}
                {nextEvent && <p className="mt-1 truncate text-xs text-lavender">{nextEvent.type === "MEETING" ? "Réunion" : "Livrable"} : {nextEvent.title} ({fmtDayNum(nextEvent.date)})</p>}
              </Link>
            );
          })}
        </div>
      )}
      {form && <ProjectForm open onClose={() => setForm(false)} onSaved={(id) => router.push(`/projets/${id}`)} />}
    </div>
  );
}
