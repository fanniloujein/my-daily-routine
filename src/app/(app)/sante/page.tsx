"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff, History, Lock, Pencil, Pill, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Loading, Modal, Notice, PageHeader, Segmented, Toggle, WeekdayPicker, WEEKDAY_SHORT, useUi } from "@/components/ui";
import { ReminderStatus } from "@/components/ReminderStatus";
import { ApiError, api, cx, fmtDayNum, refreshAll, useApi } from "@/lib/client";
import { useMe } from "@/lib/hooks";
import { formatTime, today } from "@/lib/dates";
import type { Dose } from "@/server/meds";

type Med = {
  id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
  times: string[];
  frequency: "DAILY" | "WEEKDAYS" | "EVERY_N_DAYS";
  weekdays: number[];
  everyNDays: number;
  startDate: string;
  endDate: string | null;
  reminderOffset: number;
  active: boolean;
};

export default function SantePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Sante />
    </Suspense>
  );
}

function freqLabel(m: Med) {
  if (m.frequency === "WEEKDAYS") return `Les ${m.weekdays.map((w) => WEEKDAY_SHORT[w].toLowerCase()).join(", ")}`;
  if (m.frequency === "EVERY_N_DAYS") return m.everyNDays === 1 ? "Tous les jours" : `Tous les ${m.everyNDays} jours`;
  return "Tous les jours";
}

function Sante() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: me } = useMe();
  const meds = useApi<{ medications: Med[]; disclaimer: string }>("/api/medications");
  const doses = useApi<Dose[]>("/api/medications/today");
  const [form, setForm] = useState<Partial<Med> | null>(null);
  const [history, setHistory] = useState(false);
  const [reveal, setReveal] = useState(false);
  const hidden = (me?.settings.privacyMode ?? true) && !reveal;

  useEffect(() => {
    if (params.get("new") === "med") {
      setForm({});
      router.replace("/sante");
    }
  }, [params, router]);

  return (
    <div>
      <PageHeader
        title="Santé & médicaments"
        subtitle={
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" /> Espace privé — données chiffrées
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setReveal(!reveal)}>
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {reveal ? "Masquer" : "Afficher les noms"}
            </Button>
            <Button variant="secondary" onClick={() => setHistory(true)}>
              <History className="h-4 w-4" /> Historique
            </Button>
            <Button onClick={() => setForm({})}>
              <Plus className="h-4 w-4" /> Médicament
            </Button>
          </>
        }
      />

      <Notice tone="info" className="mb-5">
        {meds.data?.disclaimer ??
          "My Life OS sert uniquement de pense-bête : il ne recommande, ne modifie ni n'interprète aucun traitement."}
      </Notice>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Aujourd'hui" icon={<Pill className="h-4 w-4" />}>
            {!doses.data ? (
              <Loading />
            ) : doses.data.length === 0 ? (
              <Empty title="Aucune prise prévue aujourd'hui" />
            ) : (
              <ul className="space-y-2">
                {doses.data.map((d) => (
                  <DoseLine key={d.medicationId + d.time} d={d} hidden={hidden} />
                ))}
              </ul>
            )}
          </Card>

          <Card title="Mes traitements" icon={<ShieldCheck className="h-4 w-4" />}>
            {!meds.data ? (
              <Loading />
            ) : meds.data.medications.length === 0 ? (
              <Empty title="Aucun médicament enregistré" action={<Button size="sm" onClick={() => setForm({})}>Ajouter</Button>}>
                Saisis-les exactement comme sur ton ordonnance.
              </Empty>
            ) : (
              <ul className="divide-y divide-line/60">
                {meds.data.medications.map((m) => (
                  <li key={m.id} className={cx("flex items-start gap-3 py-3", !m.active && "opacity-60")}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
                      <Pill className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cx("font-medium text-ink", hidden && "select-none blur-[5px]")}>{hidden ? "Médicament masqué" : m.name}</div>
                      <div className="text-xs text-ink-2">
                        {m.times.map(formatTime).join(" · ")} — {freqLabel(m)}
                        {m.reminderOffset > 0 && ` · rappel ${m.reminderOffset} min avant`}
                      </div>
                      {!hidden && m.dosage && <div className="text-xs text-muted">Posologie notée : {m.dosage}</div>}
                      {!hidden && m.instructions && <div className="text-xs text-muted">Consignes : {m.instructions}</div>}
                      <div className="text-[11px] text-muted">
                        Du {fmtDayNum(m.startDate)}
                        {m.endDate ? ` au ${fmtDayNum(m.endDate)}` : ""} {!m.active && "· en pause"}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setForm(m)} aria-label="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <ReminderStatus />
          <Card title="Rappels importants">
            <ul className="space-y-2 text-xs text-ink-2">
              <li>• L&apos;application ne recommande aucun médicament et ne modifie jamais les doses ni les horaires.</li>
              <li>• En cas de doute sur une consigne, vérifie ton ordonnance ou demande à ton médecin / pharmacien.</li>
              <li>• Une prise oubliée ? Ne double pas une dose sans avis médical : contacte ton professionnel de santé.</li>
              <li>• Les noms sont masqués par défaut sur le tableau de bord (modifiable dans les paramètres).</li>
            </ul>
          </Card>
        </div>
      </div>

      {form && <MedForm initial={form} onClose={() => setForm(null)} />}
      {history && <HistoryModal onClose={() => setHistory(false)} hidden={hidden} />}
    </div>
  );
}

function DoseLine({ d, hidden }: { d: Dose; hidden: boolean }) {
  const { toast } = useUi();
  async function log(status: "TAKEN" | "MISSED" | "PENDING") {
    try {
      await api("/api/medications/log", { body: { medicationId: d.medicationId, date: d.date, time: d.time, status } });
      await refreshAll();
      if (status === "TAKEN") toast("Prise confirmée ✓");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2/60 p-3">
      <span className={cx("w-14 font-display text-lg font-semibold tabular-nums", d.status === "LATE" ? "text-warning" : "text-ink")}>{formatTime(d.time)}</span>
      <div className="min-w-0 flex-1">
        <div className={cx("text-sm font-medium text-ink", hidden && "select-none blur-[5px]")}>{hidden ? "Médicament masqué" : d.name}</div>
        <div className="text-xs text-muted">
          {d.status === "TAKEN" && d.takenAt ? `Pris à ${new Date(d.takenAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : d.status === "LATE" ? "Heure passée — à confirmer" : d.status === "MISSED" ? "Marqué comme manqué" : "À prendre"}
        </div>
      </div>
      <div className="flex w-full justify-end gap-1.5 sm:w-auto">
        {d.status === "TAKEN" || d.status === "MISSED" ? (
          <Button size="sm" variant="ghost" onClick={() => log("PENDING")}>
            Annuler
          </Button>
        ) : (
          <>
            <Button size="sm" variant="success" onClick={() => log("TAKEN")}>
              <Check className="h-4 w-4" /> Pris
            </Button>
            <Button size="sm" variant="secondary" onClick={() => log("MISSED")}>
              <X className="h-4 w-4" /> Manqué
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function MedForm({ initial, onClose }: { initial: Partial<Med>; onClose: () => void }) {
  const { toast, confirm } = useUi();
  const [f, setF] = useState({
    name: initial.name ?? "",
    dosage: initial.dosage ?? "",
    instructions: initial.instructions ?? "",
    times: initial.times?.length ? initial.times : ["08:00"],
    frequency: initial.frequency ?? "DAILY",
    weekdays: initial.weekdays ?? [],
    everyNDays: initial.everyNDays ?? 1,
    startDate: initial.startDate ?? today(),
    endDate: initial.endDate ?? "",
    reminderOffset: initial.reminderOffset ?? 0,
    active: initial.active ?? true,
  });
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [verified, setVerified] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setErr(null);
    if (!f.name.trim()) return setErr("Le nom est obligatoire.");
    if (!f.times.length || f.times.some((t) => !t)) return setErr("Indique les horaires prescrits.");
    setSaving(true);
    try {
      const body = { ...f, endDate: f.endDate || null, confirmAmbiguous: verified };
      if (initial.id) await api(`/api/medications/${initial.id}`, { method: "PATCH", body });
      else await api("/api/medications", { body });
      await refreshAll();
      toast("Enregistré (données chiffrées)");
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setWarnings((e.data.warnings as string[]) ?? []);
      else setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? "Modifier le médicament" : "Ajouter un médicament"}
      footer={
        <>
          {initial.id && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={async () => {
                if (!(await confirm({ title: "Supprimer ce médicament ?", message: "L'historique des prises sera aussi supprimé. Pour arrêter temporairement les rappels, désactive-le plutôt.", danger: true, confirmLabel: "Supprimer" }))) return;
                await api(`/api/medications/${initial.id}`, { method: "DELETE" });
                await refreshAll();
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={save} loading={saving} disabled={!!warnings && !verified}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Notice>Saisis les informations exactement comme prescrites. L&apos;application ne les modifie et ne les interprète pas.</Notice>
        {err && <Notice tone="danger">{err}</Notice>}
        <Field label="Nom du médicament">
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Posologie telle que prescrite (facultatif)">
          <input className="input" value={f.dosage} onChange={(e) => setF({ ...f, dosage: e.target.value })} placeholder="Recopie l'ordonnance" />
        </Field>
        <Field label="Consignes de ton professionnel de santé (facultatif)">
          <textarea className="input min-h-[60px]" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
        </Field>
        <div>
          <span className="label">Horaires prescrits</span>
          <div className="flex flex-wrap gap-2">
            {f.times.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <input type="time" className="input h-9 w-28 py-1" value={t} onChange={(e) => setF({ ...f, times: f.times.map((x, j) => (j === i ? e.target.value : x)) })} />
                {f.times.length > 1 && (
                  <button onClick={() => setF({ ...f, times: f.times.filter((_, j) => j !== i) })} className="text-muted hover:text-danger" aria-label="Retirer l'horaire">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setF({ ...f, times: [...f.times, "20:00"] })}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <span className="label">Fréquence prescrite</span>
          <Segmented
            value={f.frequency}
            onChange={(v) => setF({ ...f, frequency: v })}
            options={[
              { value: "DAILY", label: "Tous les jours" },
              { value: "WEEKDAYS", label: "Certains jours" },
              { value: "EVERY_N_DAYS", label: "Tous les N jours" },
            ]}
          />
        </div>
        {f.frequency === "WEEKDAYS" && <WeekdayPicker value={f.weekdays} onChange={(v) => setF({ ...f, weekdays: v })} />}
        {f.frequency === "EVERY_N_DAYS" && (
          <Field label="Tous les … jours">
            <input type="number" min={1} max={60} className="input" value={f.everyNDays} onChange={(e) => setF({ ...f, everyNDays: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début">
            <input type="date" className="input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </Field>
          <Field label="Fin (facultatif)">
            <input type="date" className="input" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
          </Field>
        </div>
        <div>
          <span className="label">Rappel</span>
          <Segmented value={f.reminderOffset} onChange={(v) => setF({ ...f, reminderOffset: v })} options={[0, 5, 10, 15, 30].map((m) => ({ value: m, label: m === 0 ? "À l'heure" : `${m} min avant` }))} />
        </div>
        {initial.id && <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Rappels actifs" description="Désactive pour mettre en pause sans perdre l'historique" />}
        {warnings && (
          <div className="space-y-2 rounded-2xl border border-warning/40 bg-warning-soft p-3 text-sm">
            <p className="font-medium text-warning">Merci de vérifier avant d&apos;enregistrer :</p>
            <ul className="space-y-1 text-ink-2">
              {warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-ink">
              <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> J&apos;ai vérifié sur mon ordonnance : les horaires saisis sont corrects.
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}

function HistoryModal({ onClose, hidden }: { onClose: () => void; hidden: boolean }) {
  const { data } = useApi<{ date: string; doses: Dose[] }[]>("/api/medications/history");
  const [view, setView] = useState<"list" | "summary">("list");
  const all = (data ?? []).flatMap((d) => d.doses).filter((d) => d.date < today() || d.status === "TAKEN" || d.status === "MISSED");
  const taken = all.filter((d) => d.status === "TAKEN").length;
  return (
    <Modal open onClose={onClose} title="Historique des 14 derniers jours" size="lg">
      {!data ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <Segmented value={view} onChange={setView} options={[{ value: "list", label: "Détail" }, { value: "summary", label: "Résumé" }]} />
          {view === "summary" ? (
            <p className="text-sm text-ink-2">
              {taken} prise(s) confirmée(s) sur {all.length} prévue(s) passée(s). Les prises non confirmées apparaissent comme « manquées » — ce n&apos;est qu&apos;un suivi, pas un jugement.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.map((day) => (
                <li key={day.date}>
                  <div className="mb-1 text-xs font-semibold text-ink-2">{fmtDayNum(day.date)}</div>
                  {day.doses.length === 0 ? (
                    <p className="text-xs text-muted">Aucune prise prévue</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {day.doses.map((d) => (
                        <Badge key={d.medicationId + d.time} tone={d.status === "TAKEN" ? "success" : d.status === "MISSED" ? "danger" : d.status === "LATE" ? "warning" : "neutral"}>
                          {formatTime(d.time)} {hidden ? "" : `· ${d.name}`} · {d.status === "TAKEN" ? "pris" : d.status === "MISSED" ? "manqué" : d.status === "LATE" ? "à confirmer" : "à prendre"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
