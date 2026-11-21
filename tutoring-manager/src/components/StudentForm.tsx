"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { api, refreshAll, useApi } from "@/lib/client";
import { COLORS, LEVEL_CYCLES } from "@/lib/constants";
import { BILLING_MODES } from "@/lib/finance";
import { today } from "@/lib/dates";
import type { Student } from "@/lib/types";
import { Avatar, Button, ColorPicker, Dialog, Field, Input, Segmented, Select, Textarea, useToast } from "./ui";
import { useRefs } from "./shared";

/** Redimensionne une photo (max 256 px) côté navigateur avant envoi. */
async function resize(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 256 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

export function StudentForm({ open, onClose, student, onSaved }: { open: boolean; onClose: () => void; student?: (Student & { photo?: string | null }) | null; onSaved?: (id: string) => void }) {
  const refs = useRefs();
  const toast = useToast();
  const { data: me } = useApi<{ settings: { defaultRate: number; defaultDuration: number } }>("/api/me");
  const fileRef = useRef<HTMLInputElement>(null);
  const init = () => ({
    firstName: "", lastName: "", photo: null as string | null, phone: "", parentName: "", parentPhone: "", address: "", levelId: "", school: "",
    subjectIds: [] as string[], enrolledAt: today(), courseType: "INDIVIDUAL", rate: String(me?.settings.defaultRate ?? 25), sessionDuration: String(me?.settings.defaultDuration ?? 60),
    sessionsPerWeek: "1", billingMode: "PER_SESSION", availability: "", notes: "", strengths: "", weaknesses: "", difficulties: "", goals: "", color: COLORS[0],
  });
  const [v, setV] = useState(init);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (student)
      setV({
        firstName: student.firstName, lastName: student.lastName, photo: typeof student.photo === "string" ? student.photo : null, phone: student.phone ?? "",
        parentName: student.parent?.name ?? "", parentPhone: student.parent?.phone ?? "", address: student.address ?? "", levelId: student.levelId ?? "", school: student.school ?? "",
        subjectIds: student.subjects.map((s) => s.id), enrolledAt: student.enrolledAt, courseType: student.courseType, rate: String(student.rate), sessionDuration: String(student.sessionDuration),
        sessionsPerWeek: String(student.sessionsPerWeek), billingMode: student.billingMode, availability: student.availability ?? "", notes: student.notes ?? "", strengths: student.strengths ?? "",
        weaknesses: student.weaknesses ?? "", difficulties: student.difficulties ?? "", goals: student.goals ?? "", color: student.color ?? COLORS[0],
      });
    else setV(init());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.id]);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const toggleSubject = (id: string) => {
    const sub = refs.subjects.find((s) => s.id === id);
    const on = !v.subjectIds.includes(id);
    setV({
      ...v,
      subjectIds: on ? [...v.subjectIds, id] : v.subjectIds.filter((x) => x !== id),
      // Tarif et durée habituels de la matière proposés pour un nouvel élève
      ...(on && !student && v.subjectIds.length === 0 && sub?.defaultRate ? { rate: String(sub.defaultRate), sessionDuration: String(sub.defaultDuration) } : {}),
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { ...v, rate: Number(v.rate), sessionDuration: Number(v.sessionDuration), sessionsPerWeek: Number(v.sessionsPerWeek) };
      const r = student ? await api<{ id: string }>(`/api/students/${student.id}`, { method: "PUT", body }) : await api<{ id: string }>("/api/students", { body });
      toast.success(student ? "Fiche mise à jour." : "Élève ajouté.");
      await refreshAll();
      onSaved?.(r.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const groups = Object.entries(LEVEL_CYCLES).map(([cycle, label]) => ({ label, levels: refs.levels.filter((l) => l.cycle === cycle) })).filter((g) => g.levels.length);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={student ? `Modifier ${student.firstName} ${student.lastName}` : "Nouvel élève"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} loading={saving} disabled={!v.firstName.trim() || !v.lastName.trim()}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar name={`${v.firstName || "?"} ${v.lastName || ""}`} src={v.photo} color={v.color} size={64} />
            {v.photo && <button type="button" className="absolute -right-1 -top-1 rounded-full bg-surface p-0.5 shadow" onClick={() => setV({ ...v, photo: null })} aria-label="Retirer la photo"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setV({ ...v, photo: await resize(f) }); e.target.value = ""; }} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" />Photo (facultative)</Button>
            <ColorPicker value={v.color} onChange={(color) => setV({ ...v, color })} colors={COLORS} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prénom" required><Input value={v.firstName} onChange={set("firstName")} /></Field>
          <Field label="Nom" required><Input value={v.lastName} onChange={set("lastName")} /></Field>
          <Field label="Téléphone de l'élève"><Input type="tel" value={v.phone} onChange={set("phone")} /></Field>
          <Field label="Date d'inscription" required><Input type="date" value={v.enrolledAt} onChange={set("enrolledAt")} /></Field>
          <Field label="Nom du parent"><Input value={v.parentName} onChange={set("parentName")} /></Field>
          <Field label="Téléphone du parent" hint="Un même numéro relie automatiquement les frères et sœurs."><Input type="tel" value={v.parentPhone} onChange={set("parentPhone")} /></Field>
          <Field label="Adresse" className="sm:col-span-2"><Input value={v.address} onChange={set("address")} /></Field>
          <Field label="Niveau scolaire">
            <select className="input" value={v.levelId} onChange={set("levelId")}>
              <option value="">—</option>
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Établissement scolaire"><Input value={v.school} onChange={set("school")} /></Field>
        </div>
        <Field label="Matière(s) suivie(s)">
          <div className="flex flex-wrap gap-1.5">
            {refs.subjects.map((s) => (
              <button key={s.id} type="button" onClick={() => toggleSubject(s.id)} className={`chip border px-2.5 py-1 ${v.subjectIds.includes(s.id) ? "border-transparent text-navy" : "border-line text-muted"}`} style={v.subjectIds.includes(s.id) ? { background: s.color } : undefined}>
                {s.name}
              </button>
            ))}
          </div>
        </Field>
        <div className="rounded-2xl border border-line p-4">
          <div className="mb-3 text-sm font-semibold">Cours et facturation</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type de cours"><Segmented value={v.courseType} onChange={(courseType) => setV({ ...v, courseType })} options={[{ value: "INDIVIDUAL", label: "Individuel" }, { value: "GROUP", label: "Collectif" }]} /></Field>
            <Field label="Tarif par séance (DT)" required><Input type="number" min={0} step="0.5" value={v.rate} onChange={set("rate")} /></Field>
            <Field label="Durée de séance (min)"><Input type="number" min={15} step={15} value={v.sessionDuration} onChange={set("sessionDuration")} /></Field>
            <Field label="Séances par semaine"><Input type="number" min={0} max={14} value={v.sessionsPerWeek} onChange={set("sessionsPerWeek")} /></Field>
            <Field label="Système de facturation" className="sm:col-span-2" hint={v.billingMode === "MONTHLY" ? "Les séances ne sont pas facturées une à une : créez le forfait sur la fiche de l'élève." : v.billingMode === "ADVANCE" ? "Les avances alimentent un crédit consommé à chaque séance effectuée, avec alerte quand il s'épuise." : "Chaque séance effectuée est facturée automatiquement."}>
              <Select value={v.billingMode} onChange={set("billingMode")} options={BILLING_MODES} />
            </Field>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Disponibilités"><Textarea rows={2} value={v.availability} onChange={set("availability")} placeholder="Ex. mercredi après-midi, samedi matin" /></Field>
          <Field label="Remarques personnelles"><Textarea rows={2} value={v.notes} onChange={set("notes")} /></Field>
        </div>
        {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
