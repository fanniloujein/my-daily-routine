"use client";
import { SESSION_STATUS, TX_TYPES } from "@/lib/constants";
import { useApi, cn } from "@/lib/client";
import { formatDT } from "@/lib/money";
import type { Level, Student, Subject } from "@/lib/types";
import { Badge } from "./ui";

export function StatusBadge({ status }: { status: keyof typeof SESSION_STATUS }) {
  const s = SESSION_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function TxBadge({ type }: { type: string }) {
  const t = TX_TYPES[type];
  return <Badge tone={t?.tone ?? "muted"}>{t?.label ?? type}</Badge>;
}

/** Montant coloré : vert (positif / payé), rouge (dû) */
export function Money({ value, tone, className, strong }: { value: number; tone?: "due" | "paid" | "credit" | "auto"; className?: string; strong?: boolean }) {
  const color =
    tone === "due" ? (value > 0 ? "text-danger" : "text-muted") : tone === "paid" ? (value > 0 ? "text-success" : "text-muted") : tone === "credit" ? (value > 0 ? "text-primary-strong" : "text-muted") : "";
  return <span className={cn("tabular-nums", strong && "font-semibold", color, className)}>{formatDT(value)}</span>;
}

/** Référentiels (matières, niveaux, élèves actifs) partagés par les formulaires. */
export function useRefs() {
  const subjects = useApi<Subject[]>("/api/subjects");
  const levels = useApi<Level[]>("/api/levels");
  const students = useApi<Student[]>("/api/students");
  return {
    subjects: (subjects.data ?? []).filter((s) => !s.archived),
    allSubjects: subjects.data ?? [],
    levels: levels.data ?? [],
    students: students.data ?? [],
    loading: !subjects.data || !levels.data || !students.data,
    reload: () => Promise.all([subjects.mutate(), levels.mutate(), students.mutate()]),
  };
}

export function SubjectDot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: color ?? "rgb(var(--line))" }} />;
}
