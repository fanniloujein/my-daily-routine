"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import frLocale from "@fullcalendar/core/locales/fr";
import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { CalendarDays, CalendarRange, Coffee, Plus } from "lucide-react";
import { api, ApiError, fullName, qsOf, refreshAll, useApi } from "@/lib/client";
import { duration, today } from "@/lib/dates";
import type { PersonalEvent, Session, Task } from "@/lib/types";
import { Button, Checkbox, Dialog, PageHeader, useConfirm, useToast } from "@/components/ui";
import { PersonalEventDialog } from "@/components/PersonalEventDialog";
import { SessionForm, type SessionDraft } from "@/components/SessionForm";
import { SessionDetail } from "@/components/SessionDetail";

type Cal = { sessions: Session[]; events: PersonalEvent[]; tasks: Task[]; availability: { date: string; startTime: string; endTime: string }[] };
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function CalendarPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const cal = useRef<FullCalendar>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [showAvail, setShowAvail] = useState(true);
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [pick, setPick] = useState<SessionDraft | null>(null);
  const [eventDraft, setEventDraft] = useState<(SessionDraft & { id?: string; ev?: PersonalEvent }) | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const { data, mutate } = useApi<Cal>(range ? `/api/calendar${qsOf(range)}` : null);
  const { data: me } = useApi<{ settings: { dayStart: string; dayEnd: string; maxDailyHours: number } }>("/api/me");

  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data?.sessions ?? []) if (!["CANCELLED", "POSTPONED", "TEACHER_ABSENT"].includes(s.status)) m.set(s.date, (m.get(s.date) ?? 0) + duration(s.startTime, s.endTime));
    return m;
  }, [data]);

  const events: EventInput[] = useMemo(() => {
    if (!data) return [];
    const out: EventInput[] = [];
    for (const s of data.sessions) {
      const color = s.subject?.color ?? s.participants[0]?.student.color ?? "#8fb8e8";
      const inactive = ["CANCELLED", "POSTPONED", "TEACHER_ABSENT"].includes(s.status);
      out.push({
        id: `s:${s.id}`,
        title: `${s.title || s.participants.map((p) => fullName(p.student)).join(", ")}${s.subject ? ` · ${s.subject.name}` : ""}${s.status === "DONE" ? " ✓" : !s.prepared && s.status === "PLANNED" ? " •" : ""}`,
        start: `${s.date}T${s.startTime}`,
        end: `${s.date}T${s.endTime}`,
        backgroundColor: color,
        textColor: "#1e2a4a",
        classNames: inactive ? ["ev-cancelled"] : s.status === "STUDENT_ABSENT" ? ["ev-cancelled"] : [],
        editable: s.status === "PLANNED",
      });
    }
    for (const e of data.events)
      out.push({ id: `e:${e.id}:${e.date}`, title: `${e.kind === "REST" ? "😌 " : e.kind === "BREAK" ? "☕ " : "📌 "}${e.title}`, start: `${e.date}T${e.startTime}`, end: `${e.date}T${e.endTime}`, classNames: e.kind === "PERSONAL" ? [] : ["ev-rest"], backgroundColor: e.kind === "PERSONAL" ? "#e8e1d4" : undefined, textColor: "#1e2a4a", editable: false, extendedProps: { ev: e } });
    for (const k of data.tasks)
      out.push({ id: `t:${k.id}`, title: `☐ ${k.title}`, start: `${k.dueDate}T${k.time}`, end: `${k.dueDate}T${k.time && k.duration ? addMin(k.time, k.duration) : addMin(k.time!, 30)}`, backgroundColor: "#fcf1c7", textColor: "#1e2a4a", editable: false });
    if (showAvail) for (const a of data.availability) out.push({ start: `${a.date}T${a.startTime}`, end: `${a.date}T${a.endTime}`, display: "background", classNames: ["ev-availability"] });
    return out;
  }, [data, showAvail]);

  const move = async (id: string, start: Date, end: Date, revert: () => void) => {
    const body = { date: ymd(start), startTime: hm(start), endTime: hm(end) };
    try {
      await api(`/api/sessions/${id}`, { method: "PATCH", body });
      toast.success("Séance déplacée.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (await confirm({ title: "Conflit horaire", text: e.message, confirm: "Déplacer quand même", danger: true })) !== false) {
        await api(`/api/sessions/${id}`, { method: "PATCH", body: { ...body, force: true } });
        toast.success("Séance déplacée malgré le conflit.");
      } else {
        revert();
        if (!(e instanceof ApiError && e.status === 409)) toast.error(e instanceof Error ? e.message : "Erreur");
      }
    }
    await mutate();
    refreshAll();
  };

  const onDrop = (a: EventDropArg) => a.event.id.startsWith("s:") && move(a.event.id.slice(2), a.event.start!, a.event.end ?? a.event.start!, a.revert);
  const onResize = (a: EventResizeDoneArg) => a.event.id.startsWith("s:") && move(a.event.id.slice(2), a.event.start!, a.event.end!, a.revert);
  const onClick = (a: EventClickArg) => {
    if (a.event.id.startsWith("s:")) setOpen(a.event.id.slice(2));
    else if (a.event.id.startsWith("e:")) setEventDraft({ ev: a.event.extendedProps.ev as PersonalEvent });
    else if (a.event.id.startsWith("t:")) window.location.href = "/taches";
  };
  const onSelect = (a: DateSelectArg) => {
    const d = a.allDay ? { date: ymd(a.start), startTime: me?.settings.dayStart ?? "14:00" } : { date: ymd(a.start), startTime: hm(a.start), endTime: hm(a.end) };
    setPick(d);
    cal.current?.getApi().unselect();
  };
  const max = (me?.settings.maxDailyHours ?? 6) * 60;

  return (
    <div>
      <PageHeader
        title="Calendrier"
        icon={<CalendarDays className="h-5 w-5" />}
        subtitle="Cliquez ou glissez sur un créneau pour ajouter ; glissez une séance pour la déplacer."
        actions={
          <>
            <Checkbox checked={showAvail} onChange={setShowAvail} label="Disponibilités" className="self-center" />
            <Link href="/semaine"><Button variant="secondary"><CalendarRange className="h-4 w-4" />Organiser ma semaine</Button></Link>
            <Button variant="secondary" onClick={() => setEventDraft({ date: today(), startTime: "12:30", endTime: "13:30" })}><Coffee className="h-4 w-4" />Repos / événement</Button>
            <Button onClick={() => setDraft({ date: today() })}><Plus className="h-4 w-4" />Séance</Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-success-soft" />Disponibilités</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded ev-rest" style={{ background: "repeating-linear-gradient(135deg,rgb(var(--primary-soft)),rgb(var(--primary-soft)) 3px,rgb(var(--surface-2)) 3px,rgb(var(--surface-2)) 6px)" }} />Repos et pauses</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-warning-soft" />Journée chargée</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-danger-soft" />Journée surchargée</span>
        <span>✓ effectuée · • à préparer</span>
      </div>
      <div className="card p-3 sm:p-4">
        <FullCalendar
          ref={cal}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locale={frLocale}
          initialView={typeof window !== "undefined" && window.innerWidth < 640 ? "timeGridDay" : "timeGridWeek"}
          headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth" }}
          buttonText={{ today: "Aujourd'hui", day: "Jour", week: "Semaine", month: "Mois" }}
          firstDay={1}
          height="auto"
          slotMinTime={`${(me?.settings.dayStart ?? "08:00").slice(0, 2)}:00:00`}
          slotMaxTime={`${String(Math.min(24, Number((me?.settings.dayEnd ?? "20:00").slice(0, 2)) + 2)).padStart(2, "0")}:00:00`}
          allDaySlot={false}
          nowIndicator
          selectable
          selectMirror
          editable
          eventResizableFromStart={false}
          events={events}
          datesSet={(a: DatesSetArg) => setRange({ from: ymd(a.start), to: ymd(addDate(a.end, -1)) })}
          eventDrop={onDrop}
          eventResize={onResize}
          eventClick={onClick}
          select={onSelect}
          dayCellClassNames={(a) => { const m = perDay.get(ymd(a.date)) ?? 0; return m > max ? ["ev-overloaded-day"] : m >= max * 0.8 ? ["ev-busy-day"] : []; }}
          dayHeaderClassNames={(a) => { const m = perDay.get(ymd(a.date)) ?? 0; return m > max ? ["ev-overloaded-day"] : m >= max * 0.8 ? ["ev-busy-day"] : []; }}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        />
      </div>
      <Dialog open={!!pick} onClose={() => setPick(null)} size="sm" title="Ajouter sur ce créneau">
        <div className="grid gap-2">
          <Button onClick={() => { setDraft(pick); setPick(null); }}><Plus className="h-4 w-4" />Une séance de cours</Button>
          <Button variant="secondary" onClick={() => { setEventDraft(pick); setPick(null); }}><Coffee className="h-4 w-4" />Un repos, une pause ou un événement personnel</Button>
        </div>
      </Dialog>
      <SessionForm open={!!draft} onClose={() => { setDraft(null); mutate(); }} draft={draft ?? undefined} />
      <SessionDetail id={open} onClose={() => { setOpen(null); mutate(); }} />
      {eventDraft && <PersonalEventDialog draft={eventDraft} onClose={() => { setEventDraft(null); mutate(); }} />}
    </div>
  );
}

function addMin(t: string, m: number) {
  const [h, mm] = t.split(":").map(Number);
  const x = Math.min(23 * 60 + 59, h * 60 + mm + m);
  return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`;
}
function addDate(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

