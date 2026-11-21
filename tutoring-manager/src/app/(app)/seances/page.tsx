"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ClipboardList, FileDown, Plus, Search, Trash2, XCircle } from "lucide-react";
import { api, fullName, qsOf, refreshAll, useApi } from "@/lib/client";
import { SESSION_STATUS } from "@/lib/constants";
import { addDays, shortDate, startOfMonth, endOfMonth, today, dayName } from "@/lib/dates";
import { formatDT } from "@/lib/money";
import type { Session } from "@/lib/types";
import { Badge, Button, Empty, ErrorBox, Input, Loading, PageHeader, Pager, Segmented, Select, usePager, useConfirm, useToast } from "@/components/ui";
import { StatusBadge, SubjectDot, useRefs } from "@/components/shared";
import { SessionForm } from "@/components/SessionForm";
import { SessionDetail } from "@/components/SessionDetail";

type Period = "upcoming" | "week" | "month" | "past" | "all";

function SessionsInner() {
  const sp = useSearchParams();
  const refs = useRefs();
  const toast = useToast();
  const confirm = useConfirm();
  const t = today();
  const [period, setPeriod] = useState<Period>("upcoming");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [studentId, setStudent] = useState(sp.get("studentId") ?? "");
  const [subjectId, setSubject] = useState("");
  const [unprepared, setUnprepared] = useState(false);
  const [form, setForm] = useState(sp.get("new") === "1");
  const [open, setOpen] = useState<string | null>(sp.get("open"));
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (sp.get("open")) setOpen(sp.get("open")); }, [sp]);

  const range = { upcoming: [t, addDays(t, 60)], week: [addDays(t, -3), addDays(t, 7)], month: [startOfMonth(t), endOfMonth(t)], past: [addDays(t, -365), addDays(t, -1)], all: [null, null] }[period];
  const url = `/api/sessions${qsOf({ from: range[0], to: range[1], q, status, studentId, subjectId, unprepared: unprepared ? 1 : null, order: period === "past" ? "desc" : null, take: 1000 })}`;
  const { data, error, mutate } = useApi<{ items: Session[]; total: number }>(url);
  const items = data?.items ?? [];
  const pager = usePager(items, 30);

  const bulk = async (action: "status" | "delete" | "prepared", st?: string) => {
    if (action === "delete" && (await confirm({ title: `Supprimer ${sel.length} séance(s) ?`, text: "Les factures liées seront annulées avec trace.", danger: true, confirm: "Supprimer" })) === false) return;
    await api("/api/sessions/bulk", { body: { ids: sel, action, status: st } });
    toast.success("Séances mises à jour.");
    setSel([]);
    await refreshAll();
  };
  const all = pager.slice.length > 0 && pager.slice.every((s) => sel.includes(s.id));

  return (
    <div>
      <PageHeader
        title="Séances"
        icon={<ClipboardList className="h-5 w-5" />}
        subtitle={data ? `${data.total} séance(s)` : "…"}
        actions={
          <>
            <a href={`/api/export?dataset=sessions&format=xlsx${qsOf({ from: range[0], to: range[1], studentId }).replace("?", "&")}`}><Button variant="secondary"><FileDown className="h-4 w-4" />Excel</Button></a>
            <Button onClick={() => setForm(true)}><Plus className="h-4 w-4" />Nouvelle séance</Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented value={period} onChange={setPeriod} options={[{ value: "upcoming", label: "À venir" }, { value: "week", label: "Semaine" }, { value: "month", label: "Ce mois" }, { value: "past", label: "Passées" }, { value: "all", label: "Toutes" }]} />
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Élève, groupe, chapitre…" />
        </div>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} options={Object.fromEntries(Object.entries(SESSION_STATUS).map(([k, v]) => [k, v.label]))} placeholder="Tous statuts" />
        <Select className="w-auto" value={studentId} onChange={(e) => setStudent(e.target.value)} options={refs.students.map((s) => ({ value: s.id, label: fullName(s) }))} placeholder="Tous les élèves" />
        <Select className="w-auto" value={subjectId} onChange={(e) => setSubject(e.target.value)} options={refs.subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="Toutes matières" />
        <Button size="sm" variant={unprepared ? "accent" : "ghost"} onClick={() => setUnprepared(!unprepared)}>À préparer</Button>
      </div>
      {sel.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-primary-soft px-3 py-2 text-sm">
          <b>{sel.length} sélectionnée(s)</b>
          <Button size="sm" variant="success" onClick={() => bulk("status", "DONE")}><CheckCircle2 className="h-4 w-4" />Effectuées</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk("status", "CANCELLED")}><XCircle className="h-4 w-4" />Annulées</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk("prepared")}>Préparées</Button>
          <Button size="sm" variant="danger-ghost" onClick={() => bulk("delete")}><Trash2 className="h-4 w-4" />Supprimer</Button>
          <Button size="sm" variant="ghost" onClick={() => setSel([])}>Désélectionner</Button>
        </div>
      )}
      {error ? <ErrorBox error={error} retry={() => mutate()} /> : !data ? <Loading rows={8} /> : items.length === 0 ? (
        <Empty icon={<ClipboardList className="h-6 w-6" />} title="Aucune séance sur cette période" action={<Button onClick={() => setForm(true)}><Plus className="h-4 w-4" />Programmer une séance</Button>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="w-8"><input type="checkbox" checked={all} onChange={(e) => setSel(e.target.checked ? [...new Set([...sel, ...pager.slice.map((s) => s.id)])] : sel.filter((x) => !pager.slice.some((s) => s.id === x)))} aria-label="Tout sélectionner" /></th>
                <th>Date</th><th>Horaire</th><th>Élève(s)</th><th>Matière</th><th>Statut</th><th className="num">Tarif</th><th>Préparation</th>
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((s) => (
                <tr key={s.id} className={`cursor-pointer ${s.date === t ? "bg-accent-soft/30" : ""}`} onClick={() => setOpen(s.id)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.includes(s.id)} onChange={(e) => setSel(e.target.checked ? [...sel, s.id] : sel.filter((x) => x !== s.id))} aria-label="Sélectionner" /></td>
                  <td className="whitespace-nowrap"><span className="capitalize text-muted">{dayName(s.date).slice(0, 3)}.</span> {shortDate(s.date)}</td>
                  <td className="tabular-nums">{s.startTime}–{s.endTime}</td>
                  <td className="font-medium">{s.title ? <>{s.title} <span className="text-xs font-normal text-muted">({s.participants.length})</span></> : s.participants.map((p) => fullName(p.student)).join(", ")}</td>
                  <td><span className="inline-flex items-center gap-1.5"><SubjectDot color={s.subject?.color} />{s.subject?.name ?? "—"}</span>{s.chapter && <div className="text-xs text-muted">{s.chapter}</div>}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="num">{formatDT(s.participants.reduce((a, p) => a + Number(p.price), 0))}</td>
                  <td>{s.status === "PLANNED" ? (s.prepared ? <Badge tone="success">Prête</Badge> : <Badge tone="warning">À préparer</Badge>) : <span className="text-xs text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager {...pager} />
      <SessionForm open={form} onClose={() => setForm(false)} />
      <SessionDetail id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

export default function SessionsPage() {
  return <Suspense><SessionsInner /></Suspense>;
}
