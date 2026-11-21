"use client";
import Link from "next/link";
import { useState } from "react";
import { Archive, Phone, Plus, Search, Users } from "lucide-react";
import { fullName, qsOf, useApi } from "@/lib/client";
import { BILLING_MODES } from "@/lib/finance";
import { shortDate } from "@/lib/dates";
import type { Student } from "@/lib/types";
import { Avatar, Badge, Button, Empty, ErrorBox, Input, Loading, PageHeader, Pager, Segmented, Select, usePager } from "@/components/ui";
import { Money, useRefs } from "@/components/shared";
import { StudentForm } from "@/components/StudentForm";

export default function StudentsPage() {
  const refs = useRefs();
  const [q, setQ] = useState("");
  const [levelId, setLevel] = useState("");
  const [subjectId, setSubject] = useState("");
  const [archived, setArchived] = useState<"0" | "1">("0");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [form, setForm] = useState(false);
  const { data, error, mutate, isLoading } = useApi<Student[]>(`/api/students${qsOf({ q, levelId, subjectId, archived: archived === "1" ? "1" : null })}`);
  const pager = usePager(data ?? [], view === "cards" ? 24 : 30);

  return (
    <div>
      <PageHeader
        title="Élèves"
        icon={<Users className="h-5 w-5" />}
        subtitle={data ? `${data.length} élève(s) ${archived === "1" ? "archivé(s)" : "actif(s)"}` : "…"}
        actions={<Button onClick={() => setForm(true)}><Plus className="h-4 w-4" />Nouvel élève</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : nom, téléphone, parent, établissement…" className="pl-9" />
        </div>
        <Select value={levelId} onChange={(e) => setLevel(e.target.value)} options={refs.levels.map((l) => ({ value: l.id, label: l.name }))} placeholder="Tous les niveaux" className="w-auto" />
        <Select value={subjectId} onChange={(e) => setSubject(e.target.value)} options={refs.subjects.map((l) => ({ value: l.id, label: l.name }))} placeholder="Toutes les matières" className="w-auto" />
        <Segmented value={archived} onChange={setArchived} options={[{ value: "0", label: "Actifs" }, { value: "1", label: "Archivés" }]} />
        <Segmented value={view} onChange={setView} options={[{ value: "cards", label: "Cartes" }, { value: "table", label: "Tableau" }]} />
      </div>
      {error ? <ErrorBox error={error} retry={() => mutate()} /> : isLoading && !data ? <Loading rows={6} /> : !data?.length ? (
        <Empty icon={archived === "1" ? <Archive className="h-6 w-6" /> : <Users className="h-6 w-6" />} title={q || levelId || subjectId ? "Aucun élève ne correspond à ces filtres" : archived === "1" ? "Aucun élève archivé" : "Aucun élève pour l'instant"} action={archived === "0" && !q && <Button onClick={() => setForm(true)}><Plus className="h-4 w-4" />Ajouter mon premier élève</Button>} />
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pager.slice.map((s) => (
            <Link key={s.id} href={`/eleves/${s.id}`} className="card group p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="flex items-start gap-3">
                <Avatar name={fullName(s)} src={s.photo ? `/api/students/${s.id}/photo` : null} color={s.color} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink group-hover:underline">{fullName(s)}</span>
                    {s.isDemo && <Badge>démo</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted">{s.level?.name ?? "Niveau non renseigné"}{s.school ? ` · ${s.school}` : ""}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.subjects.map((x) => <span key={x.id} className="chip text-navy" style={{ background: x.color }}>{x.name}</span>)}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/60 p-2 text-center text-xs">
                <div><div className="text-muted">Séances</div><div className="font-semibold">{s.finance.sessionsDone}</div></div>
                <div><div className="text-muted">Crédit</div><Money value={s.finance.credit} tone="credit" strong /></div>
                <div><div className="text-muted">Reste dû</div><Money value={s.finance.due} tone="due" strong /></div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>{BILLING_MODES[s.billingMode as keyof typeof BILLING_MODES]} · {s.rate} DT</span>
                <span>{s.nextSession ? `Prochain : ${shortDate(s.nextSession.slice(0, 10)).slice(0, 5)} ${s.nextSession.slice(11)}` : "Aucun cours prévu"}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Élève</th><th>Niveau</th><th>Parent</th><th>Mode</th><th className="num">Séances</th><th className="num">Payé</th><th className="num">Crédit</th><th className="num">Reste dû</th></tr>
            </thead>
            <tbody>
              {pager.slice.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/eleves/${s.id}`} className="font-medium hover:underline">{fullName(s)}</Link></td>
                  <td className="text-muted">{s.level?.name ?? "—"}</td>
                  <td className="text-muted">{s.parent ? <span className="inline-flex items-center gap-1">{s.parent.name}{s.parent.phone && <a href={`tel:${s.parent.phone}`} className="text-primary-strong"><Phone className="h-3.5 w-3.5" /></a>}</span> : "—"}</td>
                  <td className="text-xs">{BILLING_MODES[s.billingMode as keyof typeof BILLING_MODES]}</td>
                  <td className="num">{s.finance.sessionsDone}</td>
                  <td className="num"><Money value={s.finance.paidOnInvoices} tone="paid" /></td>
                  <td className="num"><Money value={s.finance.credit} tone="credit" /></td>
                  <td className="num"><Money value={s.finance.due} tone="due" strong /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager {...pager} />
      <StudentForm open={form} onClose={() => setForm(false)} />
    </div>
  );
}
