"use client";

import { useEffect, useState } from "react";
import { Check, Dumbbell, Plus, Settings2, SkipForward, Target, Trash2, Trophy } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Loading, Modal, PageHeader, Progress, Segmented, WeekdayPicker, WEEKDAY_SHORT, useUi } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { api, cx, fmtDayNum, refreshAll, relativeDay, useApi } from "@/lib/client";
import { addDays, formatDuration, formatTime, startOfWeek, today, weekday } from "@/lib/dates";

type Profile = { goal: string | null; weeklySessions: number; weeklyMinutes: number; preferred: string[]; availableDays: number[]; defaultDuration: number; preferredTime: string | null };
type Session = { id: string; date: string; startTime: string | null; type: string; durationMin: number; intensity: number; status: "PLANNED" | "DONE" | "SKIPPED"; notes: string | null };

export default function SportPage() {
  const profile = useApi<Profile | null>("/api/sport/profile");
  const sessions = useApi<Session[]>("/api/sport/sessions");
  const [form, setForm] = useState<Partial<Session> | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { toast } = useUi();
  const t = today();
  const ws = startOfWeek(t);
  const p = profile.data;
  const all = sessions.data ?? [];
  const thisWeek = all.filter((s) => s.date >= ws && s.date <= addDays(ws, 6));
  const doneWeek = thisWeek.filter((s) => s.status === "DONE");
  const minutesWeek = doneWeek.reduce((a, s) => a + s.durationMin, 0);
  const upcoming = all.filter((s) => s.status === "PLANNED" && s.date >= t).sort((a, b) => (a.date + (a.startTime ?? "")).localeCompare(b.date + (b.startTime ?? "")));
  const history = all.filter((s) => s.status !== "PLANNED" || s.date < t);

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = addDays(ws, -7 * (7 - i));
    const to = addDays(from, 6);
    const m = all.filter((s) => s.status === "DONE" && s.date >= from && s.date <= to).reduce((a, s) => a + s.durationMin, 0);
    return { label: fmtDayNum(from), value: m, tooltip: `${formatDuration(m)}` };
  });

  async function done(s: Session) {
    await api(`/api/sport/sessions/${s.id}`, { method: "PATCH", body: { status: s.status === "DONE" ? "PLANNED" : "DONE" } });
    await refreshAll();
    if (s.status !== "DONE") toast("Séance terminée, bravo ! 💪");
  }
  async function postpone(s: Session) {
    // Prochain jour disponible selon le profil
    let d = addDays(s.date < t ? t : s.date, 1);
    for (let i = 0; i < 7 && p?.availableDays.length && !p.availableDays.includes(weekday(d)); i++) d = addDays(d, 1);
    await api(`/api/sport/sessions/${s.id}`, { method: "PATCH", body: { postponeTo: d } });
    await refreshAll();
    toast(`Séance reportée au ${fmtDayNum(d)} — aucun souci`);
  }

  return (
    <div>
      <PageHeader
        title="Sport"
        subtitle="Bouger régulièrement, à ton rythme et selon ton énergie."
        actions={
          <>
            <Button variant="secondary" onClick={() => setProfileOpen(true)}>
              <Settings2 className="h-4 w-4" /> Objectifs
            </Button>
            <Button onClick={() => setForm({})}>
              <Plus className="h-4 w-4" /> Séance
            </Button>
          </>
        }
      />
      {!p && profile.data === null && (
        <Card className="mb-5">
          <Empty icon={<Target className="h-8 w-8" />} title="Définis tes objectifs sportifs" action={<Button size="sm" onClick={() => setProfileOpen(true)}>Commencer</Button>}>
            Jours disponibles, durée, activités préférées : le planificateur s&apos;en servira pour te proposer des séances réalistes.
          </Empty>
        </Card>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-muted">Séances cette semaine</div>
          <div className="mt-1 font-display text-xl font-semibold text-ink">
            {doneWeek.length} <span className="text-xs font-normal text-muted">/ {p?.weeklySessions ?? "—"}</span>
          </div>
          <Progress value={p?.weeklySessions ? (doneWeek.length / p.weeklySessions) * 100 : 0} tone="success" className="mt-2" />
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Minutes cette semaine</div>
          <div className="mt-1 font-display text-xl font-semibold text-ink">
            {minutesWeek} <span className="text-xs font-normal text-muted">/ {p?.weeklyMinutes ?? "—"} min</span>
          </div>
          <Progress value={p?.weeklyMinutes ? (minutesWeek / p.weeklyMinutes) * 100 : 0} tone="primary" className="mt-2" />
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Objectif</div>
          <div className="mt-1 text-sm text-ink">{p?.goal ?? "—"}</div>
          {p && (
            <div className="mt-1 text-xs text-muted">
              Jours : {p.availableDays.map((d) => WEEKDAY_SHORT[d]).join(", ") || "—"} · {p.defaultDuration} min{p.preferredTime ? ` · vers ${formatTime(p.preferredTime)}` : ""}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Prochaines séances" icon={<Dumbbell className="h-4 w-4" />}>
          {!sessions.data ? (
            <Loading />
          ) : upcoming.length === 0 ? (
            <Empty title="Aucune séance prévue" action={<Button size="sm" onClick={() => setForm({})}>Planifier</Button>} />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border border-line/70 p-3">
                  <button onClick={() => done(s)} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-line hover:border-success" aria-label="Terminer" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setForm(s)}>
                    <div className="text-sm font-medium text-ink">{s.type}</div>
                    <div className="text-xs first-letter:uppercase text-muted">
                      {relativeDay(s.date, t)}
                      {s.startTime ? ` · ${formatTime(s.startTime)}` : " · sans horaire"} · {s.durationMin} min
                    </div>
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => postpone(s)} title="Reporter">
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Minutes par semaine" icon={<Trophy className="h-4 w-4" />}>
          <BarChart data={weeks} color="rgb(var(--success))" goal={p?.weeklyMinutes} format={(v) => `${v} min`} />
        </Card>
        <Card title="Historique" className="lg:col-span-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted">Pas encore d&apos;historique.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {history.slice(0, 20).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => done(s)}
                    className={cx("flex h-5 w-5 items-center justify-center rounded-full border-2", s.status === "DONE" ? "border-success bg-success text-white" : "border-line")}
                    aria-label="Basculer terminé"
                  >
                    {s.status === "DONE" && <Check className="h-3 w-3" />}
                  </button>
                  <span className="flex-1 text-sm text-ink">{s.type}</span>
                  <span className="text-xs text-muted">
                    {fmtDayNum(s.date)} · {s.durationMin} min
                  </span>
                  <Badge tone={s.status === "DONE" ? "success" : "neutral"}>{s.status === "DONE" ? "Faite" : s.status === "SKIPPED" ? "Passée" : "Non faite"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {form && <SessionForm initial={form} profile={p ?? null} onClose={() => setForm(null)} />}
      {profileOpen && <ProfileForm initial={p ?? null} onClose={() => setProfileOpen(false)} onSaved={() => profile.mutate()} />}
    </div>
  );
}

function SessionForm({ initial, profile, onClose }: { initial: Partial<Session>; profile: Profile | null; onClose: () => void }) {
  const { toast, confirm } = useUi();
  const [f, setF] = useState({
    date: initial.date ?? today(),
    startTime: initial.startTime ?? profile?.preferredTime ?? "",
    type: initial.type ?? profile?.preferred[0] ?? "",
    durationMin: initial.durationMin ?? profile?.defaultDuration ?? 45,
    intensity: initial.intensity ?? 2,
    status: initial.status ?? "PLANNED",
    notes: initial.notes ?? "",
    autoSlot: !initial.id,
  });
  async function save() {
    if (!f.type.trim()) return toast("Indique le type de séance", "danger");
    try {
      const body = { ...f, startTime: f.startTime || null };
      if (initial.id) await api(`/api/sport/sessions/${initial.id}`, { method: "PATCH", body });
      else await api("/api/sport/sessions", { body });
      await refreshAll();
      toast(initial.id ? "Séance modifiée" : "Séance planifiée");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? "Séance de sport" : "Nouvelle séance"}
      footer={
        <>
          {initial.id && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={async () => {
                if (!(await confirm({ title: "Supprimer cette séance ?", danger: true, confirmLabel: "Supprimer" }))) return;
                await api(`/api/sport/sessions/${initial.id}`, { method: "DELETE" });
                await refreshAll();
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Activité">
          <input className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} placeholder="Yoga, course, natation…" list="sport-types" />
          <datalist id="sport-types">
            {(profile?.preferred ?? []).concat(["Marche rapide", "Course à pied", "Yoga", "Pilates", "Natation", "Vélo", "Renforcement"]).map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">
            <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Heure" hint={!initial.id && !f.startTime ? "Vide : créneau libre" : undefined}>
            <input type="time" className="input" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
          </Field>
          <Field label="Durée (min)">
            <input type="number" min={5} step={5} className="input" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) || 30 })} />
          </Field>
        </div>
        <div>
          <span className="label">Intensité</span>
          <Segmented value={f.intensity} onChange={(v) => setF({ ...f, intensity: v })} options={[{ value: 1, label: "Douce" }, { value: 2, label: "Modérée" }, { value: 3, label: "Intense" }]} />
        </div>
        <Field label="Notes">
          <textarea className="input min-h-[50px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function ProfileForm({ initial, onClose, onSaved }: { initial: Profile | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState<Profile>(
    initial ?? { goal: "", weeklySessions: 3, weeklyMinutes: 120, preferred: ["Marche rapide", "Yoga"], availableDays: [1, 3, 5], defaultDuration: 40, preferredTime: "18:30" },
  );
  const [pref, setPref] = useState(f.preferred.join(", "));
  useEffect(() => setPref(f.preferred.join(", ")), [f.preferred]);
  async function save() {
    try {
      await api("/api/sport/profile", { method: "PUT", body: { ...f, preferredTime: f.preferredTime || null, preferred: pref.split(",").map((x) => x.trim()).filter(Boolean) } });
      onSaved();
      await refreshAll();
      toast("Objectifs enregistrés");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    }
  }
  return (
    <Modal open onClose={onClose} title="Mes objectifs sportifs" footer={<Button onClick={save}>Enregistrer</Button>}>
      <div className="space-y-3">
        <Field label="Objectif">
          <input className="input" value={f.goal ?? ""} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="Avoir plus d'énergie, renforcer mon dos…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Séances par semaine">
            <input type="number" min={0} max={14} className="input" value={f.weeklySessions} onChange={(e) => setF({ ...f, weeklySessions: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Minutes par semaine">
            <input type="number" min={0} step={10} className="input" value={f.weeklyMinutes} onChange={(e) => setF({ ...f, weeklyMinutes: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Durée habituelle (min)">
            <input type="number" min={5} step={5} className="input" value={f.defaultDuration} onChange={(e) => setF({ ...f, defaultDuration: Number(e.target.value) || 30 })} />
          </Field>
          <Field label="Heure préférée">
            <input type="time" className="input" value={f.preferredTime ?? ""} onChange={(e) => setF({ ...f, preferredTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Activités préférées (séparées par des virgules)">
          <input className="input" value={pref} onChange={(e) => setPref(e.target.value)} />
        </Field>
        <div>
          <span className="label">Jours disponibles</span>
          <WeekdayPicker value={f.availableDays} onChange={(v) => setF({ ...f, availableDays: v })} />
        </div>
      </div>
    </Modal>
  );
}
