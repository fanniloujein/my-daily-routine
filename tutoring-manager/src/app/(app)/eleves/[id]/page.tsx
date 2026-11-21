"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, Ban, CalendarPlus, FileDown, FileText, Pencil, Phone, Plus, Trash2, Upload, Wallet } from "lucide-react";
import { api, fullName, refreshAll, useApi } from "@/lib/client";
import { ASSESSMENT_KINDS, DOCUMENT_TYPES, PAYMENT_KINDS, PAYMENT_METHODS, PROGRESS_STATUS, SESSION_STATUS } from "@/lib/constants";
import { BILLING_MODES } from "@/lib/finance";
import { formatDT } from "@/lib/money";
import { duration, formatMinutes, monthLabel, monthOf, shortDate, today, weekdayName, weekday } from "@/lib/dates";
import type { Chapter, Finance, Homework, Invoice, Package, Payment, Refund, Session, Student, Tx } from "@/lib/types";
import { Avatar, Badge, Button, Dialog, Empty, ErrorBox, Field, Input, Loading, Select, Tabs, Textarea, useConfirm, useToast, Pager, usePager } from "@/components/ui";
import { Money, StatusBadge, TxBadge, useRefs } from "@/components/shared";
import { StudentForm } from "@/components/StudentForm";
import { SessionForm } from "@/components/SessionForm";
import { SessionDetail } from "@/components/SessionDetail";
import { PaymentDialog, type PaymentKind } from "@/components/PaymentDialog";
import { Lines } from "@/components/charts";

type Detail = Student & {
  photo: string | null;
  parent: (Student["parent"] & { students: { id: string; firstName: string; lastName: string }[] }) | null;
  finance: Finance;
  invoices: Invoice[];
  payments: Payment[];
  refunds: Refund[];
  transactions: Tx[];
  packages: Package[];
  sessions: (Session & { price: number; absent: boolean })[];
  progress: { id: string; status: string; notes: string | null; chapterId: string; chapter: { id: string; title: string; subject: { name: string; color: string }; level: { name: string } | null } }[];
  assessments: { id: string; kind: string; title: string; date: string; score: number; maxScore: number; notes: string | null; subject: { name: string } | null }[];
  homework: Homework[];
  documents: { id: string; name: string; type: string; mimeType: string | null; size: number | null; url: string | null; createdAt: string }[];
};

const TABS = [
  { value: "infos", label: "Informations" },
  { value: "planning", label: "Planning" },
  { value: "seances", label: "Séances" },
  { value: "suivi", label: "Suivi pédagogique" },
  { value: "documents", label: "Documents" },
  { value: "historique", label: "Historique financier" },
  { value: "paiements", label: "Paiements" },
  { value: "avances", label: "Avances" },
  { value: "solde", label: "Solde restant" },
] as const;
type TabKey = (typeof TABS)[number]["value"];

export default function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: s, error, mutate } = useApi<Detail>(`/api/students/${id}`);
  const [tab, setTab] = useState<TabKey>(((sp.get("tab") === "finances" ? "solde" : sp.get("tab")) as TabKey) || "infos");
  const [edit, setEdit] = useState(false);
  const [newSession, setNewSession] = useState(false);
  const [pay, setPay] = useState<PaymentKind | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(null);

  if (error) return <ErrorBox error={error} retry={() => mutate()} />;
  if (!s) return <Loading rows={6} />;
  const f = s.finance;

  const archive = async () => {
    await api(`/api/students/${id}`, { method: "PATCH", body: { archived: !s.archived } });
    toast.success(s.archived ? "Élève réactivé." : "Élève archivé (historique conservé).");
    mutate();
    refreshAll();
  };
  const remove = async () => {
    if ((await confirm({ title: "Supprimer définitivement ?", text: "Possible uniquement si l'élève n'a aucun historique financier. Sinon, archivez-le.", danger: true, confirm: "Supprimer" })) === false) return;
    try {
      await api(`/api/students/${id}`, { method: "DELETE" });
      toast.success("Élève supprimé.");
      router.replace("/eleves");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/eleves" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Élèves</Link>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar name={fullName(s)} src={s.photo} color={s.color} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">{fullName(s)}</h1>
            {s.archived && <Badge tone="muted">Archivé</Badge>}
            {s.isDemo && <Badge>démo</Badge>}
            {f.alert === "INSUFFICIENT" && <Badge tone="danger">Avance insuffisante</Badge>}
            {f.alert === "LOW" && <Badge tone="warning">Crédit presque épuisé</Badge>}
          </div>
          <div className="mt-0.5 text-sm text-muted">{[s.level?.name, s.school, s.courseType === "GROUP" ? "Cours collectif" : "Cours individuel"].filter(Boolean).join(" · ")}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">{s.subjects.map((x) => <span key={x.id} className="chip text-navy" style={{ background: x.color }}>{x.name}</span>)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={() => setNewSession(true)}><CalendarPlus className="h-4 w-4" />Séance</Button>
          <Button variant="accent" onClick={() => setPay("PAYMENT")}><Wallet className="h-4 w-4" />Paiement</Button>
          <Button variant="secondary" onClick={() => setPay("ADVANCE")}>Avance</Button>
          <Button variant="ghost" size="icon" onClick={() => setEdit(true)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={archive} title={s.archived ? "Réactiver" : "Archiver"}>{s.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>
          <Button variant="danger-ghost" size="icon" onClick={remove} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Résumé financier toujours visible */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          ["Tarif / séance", formatDT(f.rate), ""],
          ["Séances effectuées", f.sessionsDone, ""],
          ["Séances facturées", f.sessionsBilled, ""],
          ["Séances payées", f.sessionsPaid, "text-success"],
          ["Total des frais", formatDT(f.billed), ""],
          ["Paiements reçus", formatDT(f.paymentsReceived), "text-success"],
          ["Avances versées", formatDT(f.advancesReceived), "text-primary-strong"],
          ["Crédit disponible", formatDT(f.credit), "text-primary-strong"],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="card p-3">
            <div className="text-[11px] text-muted">{l}</div>
            <div className={`mt-0.5 font-display text-lg font-semibold tabular-nums ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${f.due > 0 ? "border-danger/30 bg-danger-soft/40" : "border-success/30 bg-success-soft/40"}`}>
        <div>
          <div className="text-sm text-ink-2">Montant restant à payer</div>
          <div className={`font-display text-3xl font-bold tabular-nums ${f.due > 0 ? "text-danger" : "text-success"}`}>{formatDT(f.due)}</div>
          <div className="text-xs text-muted">
            {BILLING_MODES[s.billingMode as keyof typeof BILLING_MODES]}
            {f.oldestUnpaid && ` · plus ancienne séance due : ${shortDate(f.oldestUnpaid)}`}
            {s.billingMode === "ADVANCE" && ` · le crédit couvre ${f.sessionsCovered ?? 0} séance(s)`}
            {f.refunded > 0 && ` · remboursé : ${formatDT(f.refunded)}`}
            {f.discounts > 0 && ` · remises : ${formatDT(f.discounts)}`}
          </div>
        </div>
        {f.due > 0 && <Button variant="success" onClick={() => setPay("PAYMENT")}>Encaisser {formatDT(f.due)}</Button>}
      </div>

      <div className="card p-4 sm:p-5">
        <Tabs tabs={TABS.map((t) => ({ ...t, count: t.value === "seances" ? s.sessions.length : t.value === "documents" ? s.documents.length : t.value === "paiements" ? s.payments.filter((p) => p.kind !== "ADVANCE").length : t.value === "avances" ? s.payments.filter((p) => p.kind === "ADVANCE").length : undefined }))} value={tab} onChange={setTab} />
        {tab === "infos" && <InfoTab s={s} />}
        {tab === "planning" && <PlanningTab s={s} onOpen={setOpenSession} onNew={() => setNewSession(true)} />}
        {tab === "seances" && <SessionsTab s={s} onOpen={setOpenSession} />}
        {tab === "suivi" && <FollowTab s={s} reload={mutate} />}
        {tab === "documents" && <DocsTab s={s} reload={mutate} />}
        {tab === "historique" && <HistoryTab s={s} />}
        {tab === "paiements" && <PaymentsTab s={s} reload={mutate} kinds={["PAYMENT", "DISCOUNT"]} onNew={() => setPay("PAYMENT")} />}
        {tab === "avances" && <PaymentsTab s={s} reload={mutate} kinds={["ADVANCE"]} onNew={() => setPay("ADVANCE")} />}
        {tab === "solde" && <BalanceTab s={s} reload={mutate} onPay={() => setPay("PAYMENT")} />}
      </div>

      <StudentForm open={edit} onClose={() => { setEdit(false); mutate(); }} student={s} />
      <SessionForm open={newSession} onClose={() => { setNewSession(false); mutate(); }} draft={{ studentId: s.id }} />
      <PaymentDialog open={!!pay} kind={pay ?? "PAYMENT"} studentId={s.id} onClose={() => { setPay(null); mutate(); }} />
      <SessionDetail id={openSession} onClose={() => { setOpenSession(null); mutate(); }} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-2 border-b border-line/60 py-2 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line text-ink">{children || <span className="text-muted">—</span>}</dd>
    </div>
  );
}

function InfoTab({ s }: { s: Detail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <dl>
        <Row label="Téléphone">{s.phone && <a href={`tel:${s.phone}`} className="text-primary-strong">{s.phone}</a>}</Row>
        <Row label="Parent">{s.parent && <span>{s.parent.name}{s.parent.phone && <> · <a className="inline-flex items-center gap-1 text-primary-strong" href={`tel:${s.parent.phone}`}><Phone className="h-3.5 w-3.5" />{s.parent.phone}</a></>}</span>}</Row>
        {s.parent && s.parent.students.length > 1 && (
          <Row label="Fratrie">{s.parent.students.filter((x) => x.id !== s.id).map((x) => <Link key={x.id} href={`/eleves/${x.id}`} className="mr-2 text-primary-strong hover:underline">{fullName(x)}</Link>)}</Row>
        )}
        <Row label="Adresse">{s.address}</Row>
        <Row label="Niveau">{s.level?.name}</Row>
        <Row label="Établissement">{s.school}</Row>
        <Row label="Inscription">{shortDate(s.enrolledAt)}</Row>
      </dl>
      <dl>
        <Row label="Type de cours">{s.courseType === "GROUP" ? "Collectif" : "Individuel"}</Row>
        <Row label="Tarif">{formatDT(s.rate)} / séance</Row>
        <Row label="Durée">{formatMinutes(s.sessionDuration)}</Row>
        <Row label="Rythme">{s.sessionsPerWeek} séance(s) / semaine</Row>
        <Row label="Facturation">{BILLING_MODES[s.billingMode as keyof typeof BILLING_MODES]}</Row>
        <Row label="Disponibilités">{s.availability}</Row>
        <Row label="Remarques">{s.notes}</Row>
      </dl>
    </div>
  );
}

function PlanningTab({ s, onOpen, onNew }: { s: Detail; onOpen: (id: string) => void; onNew: () => void }) {
  const t = today();
  const upcoming = s.sessions.filter((x) => x.date >= t && x.status === "PLANNED").sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? -1 : 1));
  const slots = new Map<string, number>();
  for (const x of s.sessions.filter((x) => x.status !== "CANCELLED")) {
    const k = `${weekday(x.date)}|${x.startTime}`;
    slots.set(k, (slots.get(k) ?? 0) + 1);
  }
  const habits = [...slots.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="section-title">Prochaines séances ({upcoming.length})</h3>
          <Button size="sm" variant="soft" onClick={onNew}><Plus className="h-4 w-4" />Programmer</Button>
        </div>
        {upcoming.length === 0 ? <Empty title="Aucune séance prévue" /> : (
          <ul className="space-y-1.5">
            {upcoming.map((x) => (
              <li key={x.id}>
                <button onClick={() => onOpen(x.id)} className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2 text-left text-sm hover:bg-surface-2/60">
                  <span className="w-40 capitalize text-ink">{weekdayName(weekday(x.date))} {shortDate(x.date)}</span>
                  <span className="tabular-nums">{x.startTime}–{x.endTime}</span>
                  <span className="text-muted">{x.subject?.name}</span>
                  {!x.prepared && <Badge tone="warning">À préparer</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-2xl bg-beige/50 p-4 text-sm">
        <h3 className="section-title mb-2">Créneaux habituels</h3>
        {habits.length === 0 ? <p className="text-muted">—</p> : habits.map(([k, n]) => { const [w, h] = k.split("|"); return <div key={k} className="capitalize">{weekdayName(Number(w))} à {h} <span className="text-muted">({n}×)</span></div>; })}
        <h3 className="section-title mb-1 mt-4">Disponibilités</h3>
        <p className="whitespace-pre-line text-ink-2">{s.availability || "Non renseignées"}</p>
      </div>
    </div>
  );
}

function SessionsTab({ s, onOpen }: { s: Detail; onOpen: (id: string) => void }) {
  const [status, setStatus] = useState("");
  const list = s.sessions.filter((x) => !status || x.status === status);
  const pager = usePager(list, 20);
  const done = s.sessions.filter((x) => x.status === "DONE" && !x.absent);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted">{done.length} séance(s) effectuée(s) · {formatMinutes(done.reduce((a, x) => a + duration(x.startTime, x.endTime), 0))} de cours</div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={Object.fromEntries(Object.entries(SESSION_STATUS).map(([k, v]) => [k, v.label]))} placeholder="Tous les statuts" className="w-auto" />
      </div>
      {list.length === 0 ? <Empty title="Aucune séance" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Horaire</th><th>Matière / chapitre</th><th>Statut</th><th className="num">Tarif</th><th>Facture</th></tr></thead>
            <tbody>
              {pager.slice.map((x) => {
                const inv = s.invoices.find((i) => i.sessionId === x.id && !i.voidedAt);
                return (
                  <tr key={x.id} className="cursor-pointer" onClick={() => onOpen(x.id)}>
                    <td className="whitespace-nowrap">{shortDate(x.date)}</td>
                    <td className="tabular-nums">{x.startTime}–{x.endTime}</td>
                    <td><div>{x.subject?.name ?? "—"}</div>{x.chapter && <div className="text-xs text-muted">{x.chapter}</div>}</td>
                    <td><StatusBadge status={x.status} />{x.absent && <Badge tone="danger" className="ml-1">absent</Badge>}</td>
                    <td className="num">{formatDT(Number(x.price))}</td>
                    <td>{inv ? <Badge tone={inv.state?.status === "PAID" ? "success" : inv.state?.status === "PARTIAL" ? "warning" : "danger"}>{inv.state?.status === "PAID" ? "Payée" : inv.state?.status === "PARTIAL" ? "Partielle" : "Due"}</Badge> : <span className="text-xs text-muted">{s.billingMode === "MONTHLY" && x.status === "DONE" ? "forfait" : "—"}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager {...pager} />
    </div>
  );
}

function FollowTab({ s, reload }: { s: Detail; reload: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: chapters } = useApi<Chapter[]>(`/api/chapters`);
  const refs = useRefs();
  const [notes, setNotes] = useState({ strengths: s.strengths ?? "", weaknesses: s.weaknesses ?? "", difficulties: s.difficulties ?? "", goals: s.goals ?? "" });
  const [grade, setGrade] = useState(false);
  const [chapterId, setChapterId] = useState("");
  useEffect(() => setNotes({ strengths: s.strengths ?? "", weaknesses: s.weaknesses ?? "", difficulties: s.difficulties ?? "", goals: s.goals ?? "" }), [s.strengths, s.weaknesses, s.difficulties, s.goals]);
  const relevant = (chapters ?? []).filter((c) => s.subjects.some((x) => x.id === c.subjectId) && !s.progress.some((p) => p.chapterId === c.id));

  const saveNotes = async () => {
    const body = { ...s, ...notes, parentName: s.parent?.name, parentPhone: s.parent?.phone, subjectIds: s.subjects.map((x) => x.id), rate: Number(s.rate) };
    await api(`/api/students/${s.id}`, { method: "PUT", body });
    toast.success("Suivi enregistré.");
    reload();
  };
  const setProgress = async (cid: string, status: string) => {
    await api("/api/progress", { body: { studentId: s.id, chapterId: cid, status } });
    setChapterId("");
    reload();
  };
  const chart = s.assessments.map((a) => ({ date: shortDate(a.date).slice(0, 5), note: Math.round((Number(a.score) / Number(a.maxScore)) * 200) / 10, label: a.title }));
  const reports = s.sessions.filter((x) => x.report).slice(0, 8);
  const groups = Object.keys(PROGRESS_STATUS).map((k) => ({ k, items: s.progress.filter((p) => p.status === k) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g.k} className="rounded-2xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between"><h3 className="section-title">Chapitres {PROGRESS_STATUS[g.k as keyof typeof PROGRESS_STATUS].toLowerCase()}</h3><Badge tone={g.k === "DONE" ? "success" : g.k === "TO_REVIEW" ? "danger" : "info"}>{g.items.length}</Badge></div>
            <ul className="space-y-1.5">
              {g.items.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg bg-surface-2/50 px-2 py-1.5 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.chapter.subject.color }} />
                  <span className="min-w-0 flex-1 truncate">{p.chapter.title}</span>
                  <select value={p.status} onChange={(e) => setProgress(p.chapterId, e.target.value)} className="rounded-md border border-line bg-surface text-xs">
                    {Object.entries(PROGRESS_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button onClick={async () => { await api("/api/progress", { method: "DELETE", body: { studentId: s.id, chapterId: p.chapterId } }); reload(); }} className="text-muted hover:text-danger" aria-label="Retirer"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Ajouter un chapitre au suivi" className="min-w-[260px] flex-1">
          <Select value={chapterId} onChange={(e) => setChapterId(e.target.value)} options={relevant.map((c) => ({ value: c.id, label: `${c.subject.name} · ${c.level?.name ?? ""} · ${c.title}` }))} placeholder={relevant.length ? "Choisir…" : "Créez des chapitres dans Préparations"} />
        </Field>
        <Button variant="soft" disabled={!chapterId} onClick={() => setProgress(chapterId, "IN_PROGRESS")}>Ajouter (en cours)</Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between"><h3 className="section-title">Notes et résultats</h3><Button size="sm" variant="soft" onClick={() => setGrade(true)}><Plus className="h-4 w-4" />Note</Button></div>
          {chart.length > 1 ? <Lines data={chart} x="date" series={[{ key: "note", label: "Note /20", color: "var(--s1)" }]} domain={[0, 20]} height={200} /> : <p className="text-sm text-muted">Ajoutez au moins deux notes pour voir l&apos;évolution.</p>}
          <ul className="mt-2 divide-y divide-line text-sm">
            {[...s.assessments].reverse().map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">{shortDate(a.date)} · {ASSESSMENT_KINDS[a.kind as keyof typeof ASSESSMENT_KINDS]} · {a.title}{a.subject && <span className="text-muted"> ({a.subject.name})</span>}</span>
                <span className="flex items-center gap-2"><b className="tabular-nums">{Number(a.score)}/{Number(a.maxScore)}</b>
                  <button className="text-muted hover:text-danger" onClick={async () => { if ((await confirm({ title: "Supprimer cette note ?", danger: true })) !== false) { await api(`/api/assessments/${a.id}`, { method: "DELETE" }); reload(); } }} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="section-title">Profil pédagogique</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Points forts"><Textarea rows={2} value={notes.strengths} onChange={(e) => setNotes({ ...notes, strengths: e.target.value })} /></Field>
            <Field label="Points faibles"><Textarea rows={2} value={notes.weaknesses} onChange={(e) => setNotes({ ...notes, weaknesses: e.target.value })} /></Field>
            <Field label="Difficultés"><Textarea rows={2} value={notes.difficulties} onChange={(e) => setNotes({ ...notes, difficulties: e.target.value })} /></Field>
            <Field label="Objectifs de progression"><Textarea rows={2} value={notes.goals} onChange={(e) => setNotes({ ...notes, goals: e.target.value })} /></Field>
          </div>
          <Button size="sm" onClick={saveNotes}>Enregistrer le profil</Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="section-title mb-2">Remarques après les séances</h3>
          {reports.length === 0 ? <p className="text-sm text-muted">Les comptes rendus saisis après chaque séance apparaissent ici.</p> : (
            <ul className="space-y-2">{reports.map((x) => <li key={x.id} className="rounded-xl bg-surface-2/50 px-3 py-2 text-sm"><div className="text-xs text-muted">{shortDate(x.date)} · {x.subject?.name}</div>{x.report}</li>)}</ul>
          )}
        </div>
        <div>
          <h3 className="section-title mb-2">Devoirs</h3>
          {s.homework.length === 0 ? <p className="text-sm text-muted">Aucun devoir.</p> : (
            <ul className="space-y-1.5">{s.homework.map((h) => <li key={h.id} className="flex items-center justify-between gap-2 text-sm"><span className={h.status === "DONE" ? "text-muted line-through" : ""}>{h.title}</span><span className="text-xs text-muted">{shortDate(h.dueDate)}</span></li>)}</ul>
          )}
          <Link href="/devoirs" className="mt-2 inline-block text-xs text-primary-strong hover:underline">Gérer les devoirs →</Link>
        </div>
      </div>
      {grade && <GradeDialog studentId={s.id} subjects={refs.subjects.filter((x) => s.subjects.some((y) => y.id === x.id))} onClose={() => { setGrade(false); reload(); }} />}
    </div>
  );
}

function GradeDialog({ studentId, subjects, onClose }: { studentId: string; subjects: { id: string; name: string }[]; onClose: () => void }) {
  const [v, setV] = useState({ kind: "HOMEWORK", title: "", date: today(), score: "", maxScore: "20", subjectId: subjects[0]?.id ?? "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      await api("/api/assessments", { body: { ...v, studentId, score: Number(v.score), maxScore: Number(v.maxScore) } });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  };
  return (
    <Dialog open onClose={onClose} size="sm" title="Ajouter une note" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={!v.title || v.score === ""}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type"><Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={ASSESSMENT_KINDS} /></Field>
        <Field label="Matière"><Select value={v.subjectId} onChange={(e) => setV({ ...v, subjectId: e.target.value })} options={subjects.map((x) => ({ value: x.id, label: x.name }))} placeholder="—" /></Field>
        <Field label="Intitulé" className="sm:col-span-2"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Devoir de contrôle n°1" /></Field>
        <Field label="Date"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Note"><Input type="number" step="0.25" value={v.score} onChange={(e) => setV({ ...v, score: e.target.value })} /></Field>
          <Field label="Sur"><Input type="number" value={v.maxScore} onChange={(e) => setV({ ...v, maxScore: e.target.value })} /></Field>
        </div>
      </div>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}

function DocsTab({ s, reload }: { s: Detail; reload: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("studentId", s.id);
    try {
      await api("/api/documents", { form: fd });
      toast.success("Document ajouté.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <label className="mb-3 inline-flex">
        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary-soft px-4 text-sm font-medium text-primary-strong">{busy ? "Envoi…" : <><Upload className="h-4 w-4" />Ajouter un document</>}</span>
      </label>
      {s.documents.length === 0 ? <Empty title="Aucun document pour cet élève" icon={<FileText className="h-6 w-6" />} /> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {s.documents.map((d) => (
            <li key={d.id}>
              <a href={d.url && !d.size ? d.url : `/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm hover:bg-surface-2/60">
                <FileText className="h-5 w-5 text-primary-strong" />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <Badge>{DOCUMENT_TYPES[d.type as keyof typeof DOCUMENT_TYPES] ?? d.type}</Badge>
              </a>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/documents?studentId=${s.id}`} className="mt-3 inline-block text-xs text-primary-strong hover:underline">Ouvrir dans la bibliothèque →</Link>
    </div>
  );
}

function HistoryTab({ s }: { s: Detail }) {
  const pager = usePager(s.transactions, 25);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Journal chronologique et immuable : chaque correction ou annulation reste visible.</p>
        <div className="flex gap-2">
          <a href={`/api/export?dataset=transactions&format=xlsx&studentId=${s.id}`}><Button size="sm" variant="secondary"><FileDown className="h-4 w-4" />Excel</Button></a>
          <a href={`/api/export?dataset=transactions&format=pdf&studentId=${s.id}`}><Button size="sm" variant="secondary"><FileDown className="h-4 w-4" />PDF</Button></a>
        </div>
      </div>
      {s.transactions.length === 0 ? <Empty title="Aucune opération financière" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Opération</th><th>Description</th><th className="num">Montant</th><th className="num">Reste dû après</th><th className="num">Crédit après</th></tr></thead>
            <tbody>
              {pager.slice.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{shortDate(t.date)}</td>
                  <td><TxBadge type={t.type} /></td>
                  <td className="max-w-md text-ink-2">{t.description}</td>
                  <td className="num font-medium">{formatDT(Number(t.amount))}</td>
                  <td className="num"><Money value={Number(t.dueAfter)} tone="due" /></td>
                  <td className="num"><Money value={Number(t.creditAfter)} tone="credit" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager {...pager} />
    </div>
  );
}

function PaymentsTab({ s, reload, kinds, onNew }: { s: Detail; reload: () => void; kinds: string[]; onNew: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const list = s.payments.filter((p) => kinds.includes(p.kind));
  const isAdv = kinds.includes("ADVANCE");
  const voidIt = async (p: Payment) => {
    const reason = await confirm({ title: "Annuler ce versement ?", text: `${formatDT(Number(p.amount))} du ${shortDate(p.date)}. Il restera visible (barré) et l'annulation sera tracée dans le journal.`, confirm: "Annuler le versement", danger: true, reason: "Motif de l'annulation" });
    if (reason === false) return;
    await api(`/api/payments/${p.id}/void`, { body: { reason } });
    toast.success("Versement annulé (tracé).");
    reload();
    refreshAll();
  };
  const total = list.filter((p) => !p.voidedAt).reduce((a, p) => a + Number(p.amount), 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted">
          Total {isAdv ? "des avances versées" : "des paiements"} : <b className="text-ink">{formatDT(total)}</b>
          {isAdv && <> · crédit utilisé : <b className="text-ink">{formatDT(s.finance.creditUsed)}</b> · crédit disponible : <b className="text-primary-strong">{formatDT(s.finance.credit)}</b></>}
        </div>
        <Button size="sm" onClick={onNew}><Plus className="h-4 w-4" />{isAdv ? "Nouvelle avance" : "Nouveau paiement"}</Button>
      </div>
      {list.length === 0 ? <Empty title={isAdv ? "Aucune avance" : "Aucun paiement"} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>N° reçu</th><th>Type</th><th>Mode</th><th>Motif</th><th className="num">Montant</th><th></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.voidedAt ? "opacity-60" : ""}>
                  <td className="whitespace-nowrap">{shortDate(p.date)}</td>
                  <td className="text-xs">{p.receiptNo ?? "—"}</td>
                  <td><Badge tone={p.kind === "ADVANCE" ? "info" : p.kind === "DISCOUNT" ? "accent" : "success"}>{PAYMENT_KINDS[p.kind]}</Badge></td>
                  <td className="text-xs">{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}</td>
                  <td className="text-ink-2">{p.reason ?? "—"}{p.reference && <span className="block text-xs text-muted">Réf. {p.reference}</span>}{p.voidedAt && <span className="block text-xs text-danger">Annulé : {p.voidReason}</span>}</td>
                  <td className={`num font-medium ${p.voidedAt ? "line-through" : ""}`}>{formatDT(Number(p.amount))}</td>
                  <td className="whitespace-nowrap text-right">
                    {p.receiptNo && <a href={`/api/payments/${p.id}/receipt`} target="_blank" rel="noreferrer" title="Reçu PDF"><Button size="icon-sm" variant="ghost"><FileDown className="h-4 w-4" /></Button></a>}
                    {!p.voidedAt && <Button size="icon-sm" variant="danger-ghost" onClick={() => voidIt(p)} title="Annuler"><Ban className="h-4 w-4" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BalanceTab({ s, reload, onPay }: { s: Detail; reload: () => void; onPay: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [dlg, setDlg] = useState<null | "refund" | "adjust" | "package">(null);
  const open = s.invoices.filter((i) => i.state && i.state.remaining > 0);
  const months = useMemo(() => {
    const m = new Map<string, { billed: number; paid: number; due: number }>();
    for (const i of s.invoices.filter((i) => !i.voidedAt)) {
      const k = monthOf(i.date);
      const cur = m.get(k) ?? { billed: 0, paid: 0, due: 0 };
      cur.billed += Number(i.amount);
      cur.paid += i.state?.paid ?? 0;
      cur.due += i.state?.remaining ?? 0;
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [s.invoices]);
  const pkg = s.packages.find((p) => p.active);
  const thisMonth = monthOf(today());
  const billedThisMonth = s.invoices.some((i) => i.kind === "PACKAGE" && i.month === thisMonth && !i.voidedAt);
  const billPkg = async () => {
    try {
      await api("/api/packages/bill", { body: { studentId: s.id, month: thisMonth } });
      toast.success("Forfait du mois facturé.");
      reload();
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };
  const voidInv = async (i: Invoice) => {
    const reason = await confirm({ title: "Annuler cette facture ?", text: i.label, danger: true, confirm: "Annuler la facture", reason: "Motif" });
    if (reason === false) return;
    try {
      await api(`/api/invoices/${i.id}/void`, { body: { reason } });
      reload();
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onPay} disabled={!open.length} variant="success">Enregistrer un paiement</Button>
        <Button variant="secondary" onClick={() => setDlg("adjust")}>Correction (frais)</Button>
        <Button variant="secondary" onClick={() => setDlg("refund")} disabled={s.finance.credit <= 0}>Rembourser du crédit</Button>
        {s.billingMode === "MONTHLY" && <Button variant="secondary" onClick={() => setDlg("package")}>{pkg ? "Modifier le forfait" : "Créer le forfait"}</Button>}
        {s.billingMode === "MONTHLY" && pkg && !billedThisMonth && <Button variant="accent" onClick={billPkg}>Facturer le forfait de {monthLabel(thisMonth)}</Button>}
      </div>
      {s.billingMode === "MONTHLY" && (
        <div className="rounded-2xl bg-beige/50 p-3 text-sm">
          {pkg ? <>Forfait actif : <b>{pkg.name}</b> — {formatDT(Number(pkg.amount))} / mois{pkg.sessionsCount ? ` (${pkg.sessionsCount} séances)` : ""} depuis {monthLabel(pkg.startMonth)}{pkg.endMonth ? ` jusqu'à ${monthLabel(pkg.endMonth)}` : ""}. {billedThisMonth ? "✔ Ce mois est facturé." : "Ce mois n'est pas encore facturé."}</> : "Aucun forfait : créez-le pour facturer chaque mois."}
        </div>
      )}
      <div>
        <h3 className="section-title mb-2">Séances et frais restant à payer ({open.length})</h3>
        {open.length === 0 ? <Empty title="Tout est réglé ✔" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Libellé</th><th className="num">Montant</th><th className="num">Déjà payé</th><th className="num">Reste</th><th></th></tr></thead>
              <tbody>
                {open.map((i) => (
                  <tr key={i.id}>
                    <td>{shortDate(i.date)}</td>
                    <td>{i.label}</td>
                    <td className="num">{formatDT(Number(i.amount))}</td>
                    <td className="num"><Money value={i.state!.paid} tone="paid" /></td>
                    <td className="num"><Money value={i.state!.remaining} tone="due" strong /></td>
                    <td className="text-right">{i.kind !== "SESSION" && <Button size="icon-sm" variant="danger-ghost" onClick={() => voidInv(i)} title="Annuler"><Ban className="h-4 w-4" /></Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div>
        <h3 className="section-title mb-2">Situation par mois</h3>
        {months.length === 0 ? <p className="text-sm text-muted">—</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Mois</th><th className="num">Frais</th><th className="num">Payé</th><th className="num">Reste</th></tr></thead>
              <tbody>{months.map(([m, v]) => <tr key={m}><td>{monthLabel(m)}</td><td className="num">{formatDT(v.billed)}</td><td className="num"><Money value={v.paid} tone="paid" /></td><td className="num"><Money value={v.due} tone="due" strong /></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      {s.refunds.length > 0 && (
        <div>
          <h3 className="section-title mb-2">Remboursements</h3>
          <ul className="space-y-1 text-sm">
            {s.refunds.map((r) => (
              <li key={r.id} className={`flex items-center justify-between gap-2 ${r.voidedAt ? "opacity-60 line-through" : ""}`}>
                <span>{shortDate(r.date)} · {r.reason ?? "Remboursement"}</span>
                <span className="flex items-center gap-1"><b>{formatDT(Number(r.amount))}</b>
                  {!r.voidedAt && <Button size="icon-sm" variant="danger-ghost" onClick={async () => { const reason = await confirm({ title: "Annuler ce remboursement ?", danger: true, reason: "Motif" }); if (reason !== false) { await api(`/api/refunds/${r.id}/void`, { body: { reason } }); reload(); } }}><Ban className="h-4 w-4" /></Button>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dlg === "refund" && <MoneyDialog title="Rembourser du crédit" hint={`Crédit disponible : ${formatDT(s.finance.credit)}`} url="/api/refunds" studentId={s.id} withMethod labelField="reason" onClose={() => { setDlg(null); reload(); refreshAll(); }} />}
      {dlg === "adjust" && <MoneyDialog title="Correction : ajouter des frais" hint="Pour réduire une dette, utilisez plutôt une remise (Paiement → Remise)." url="/api/adjustments" studentId={s.id} labelField="label" requiredLabel onClose={() => { setDlg(null); reload(); refreshAll(); }} />}
      {dlg === "package" && <PackageDialog studentId={s.id} rate={s.rate} pkg={pkg} onClose={() => { setDlg(null); reload(); }} />}
    </div>
  );
}

function MoneyDialog({ title, hint, url, studentId, withMethod, labelField, requiredLabel, onClose }: { title: string; hint: string; url: string; studentId: string; withMethod?: boolean; labelField: "reason" | "label"; requiredLabel?: boolean; onClose: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ amount: "", date: today(), method: "CASH", text: "" });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      await api(url, { body: { studentId, amount: Number(v.amount), date: v.date, method: v.method, [labelField]: v.text } });
      toast.success("Opération enregistrée et tracée.");
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  };
  return (
    <Dialog open onClose={onClose} size="sm" title={title} description={hint} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={!(Number(v.amount) > 0) || (requiredLabel && v.text.trim().length < 3)}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Montant (DT)"><Input type="number" step="0.001" min={0} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        {withMethod && <Field label="Mode"><Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })} options={PAYMENT_METHODS} /></Field>}
        <Field label="Motif" className="sm:col-span-2"><Input value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}

function PackageDialog({ studentId, rate, pkg, onClose }: { studentId: string; rate: number; pkg?: Package; onClose: () => void }) {
  const [v, setV] = useState({ name: pkg?.name ?? "Forfait mensuel", amount: String(pkg?.amount ?? rate * 4), sessionsCount: String(pkg?.sessionsCount ?? 4), startMonth: pkg?.startMonth ?? monthOf(today()), endMonth: pkg?.endMonth ?? "", active: pkg?.active ?? true });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      const body = { ...v, studentId, amount: Number(v.amount), sessionsCount: Number(v.sessionsCount) || null };
      await api(pkg ? `/api/packages/${pkg.id}` : "/api/packages", { method: pkg ? "PUT" : "POST", body });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  };
  return (
    <Dialog open onClose={onClose} size="sm" title={pkg ? "Modifier le forfait" : "Créer un forfait mensuel"} description="Les mois déjà facturés ne sont pas modifiés." footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" className="sm:col-span-2"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Montant mensuel (DT)"><Input type="number" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
        <Field label="Séances incluses"><Input type="number" value={v.sessionsCount} onChange={(e) => setV({ ...v, sessionsCount: e.target.value })} /></Field>
        <Field label="Premier mois"><Input type="month" value={v.startMonth} onChange={(e) => setV({ ...v, startMonth: e.target.value })} /></Field>
        <Field label="Dernier mois (facultatif)"><Input type="month" value={v.endMonth} onChange={(e) => setV({ ...v, endMonth: e.target.value })} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}
