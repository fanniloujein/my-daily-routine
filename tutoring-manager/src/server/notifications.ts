// Notifications internes : recalculées à partir de l'état réel (idempotent).
// Une alerte disparaît d'elle-même quand sa condition n'est plus vraie (resolved).
import { prisma } from "@/lib/db";
import { readSettings } from "@/lib/settings";
import { addDays, daysBetween, monthOf, nowParts, shortDate, toMinutes } from "@/lib/dates";
import { creditAlert } from "@/lib/finance";
import { formatDT, toMil } from "@/lib/money";
import { allStudentFinances } from "./finance";

type N = { key: string; type: string; severity: "INFO" | "WARNING" | "DANGER"; title: string; body?: string; href?: string };

export async function computeAlerts(): Promise<N[]> {
  const user = await prisma.user.findFirst();
  const cfg = readSettings(user?.settings).notifications;
  const { date: t, time } = nowParts();
  const nowMin = toMinutes(time);
  const out: N[] = [];
  const who = (s: { title: string | null; participants: { student: { firstName: string; lastName: string } }[] }) =>
    s.title || s.participants.map((p) => `${p.student.firstName} ${p.student.lastName}`).join(", ");

  const sessions = await prisma.session.findMany({
    where: { OR: [{ status: "PLANNED", date: { gte: t, lte: addDays(t, 3) } }, { status: "POSTPONED", postponedToId: null }] },
    include: { participants: { include: { student: true } }, subject: true },
  });
  for (const s of sessions) {
    const href = `/seances?open=${s.id}`;
    if (s.status === "POSTPONED") {
      if (cfg.postponed) out.push({ key: `postponed:${s.id}`, type: "POSTPONED", severity: "WARNING", title: `Séance reportée à reprogrammer`, body: `${who(s)} — prévue le ${shortDate(s.date)} à ${s.startTime}`, href });
      continue;
    }
    const minutesUntil = daysBetween(t, s.date) * 1440 + toMinutes(s.startTime) - nowMin;
    if (minutesUntil >= 0 && minutesUntil <= cfg.upcomingHours * 60)
      out.push({ key: `upcoming:${s.id}`, type: "UPCOMING", severity: "INFO", title: `Cours à ${s.startTime}${s.date !== t ? ` (${shortDate(s.date)})` : ""}`, body: `${who(s)}${s.subject ? ` · ${s.subject.name}` : ""}${s.location ? ` · ${s.location}` : ""}`, href });
    if (cfg.unprepared && !s.prepared && minutesUntil >= 0)
      out.push({ key: `unprepared:${s.id}`, type: "UNPREPARED", severity: minutesUntil < 24 * 60 ? "DANGER" : "WARNING", title: "Séance non préparée", body: `${who(s)} — ${shortDate(s.date)} ${s.startTime}${s.chapter ? ` · ${s.chapter}` : ""}`, href });
  }

  if (cfg.pendingPayment || cfg.lowCredit || cfg.packageRenewal) {
    const rows = await allStudentFinances({ archived: false });
    const month = monthOf(t);
    const billedPackages = new Set(
      (await prisma.invoice.findMany({ where: { kind: "PACKAGE", month, voidedAt: null }, select: { studentId: true } })).map((x) => x.studentId),
    );
    const activePackages = await prisma.package.findMany({ where: { active: true, startMonth: { lte: month }, OR: [{ endMonth: null }, { endMonth: { gte: month } }] } });
    const pkgBy = new Map(activePackages.map((p) => [p.studentId, p]));
    for (const { student: s, finance: f } of rows) {
      const name = `${s.firstName} ${s.lastName}`;
      const href = `/eleves/${s.id}?tab=finances`;
      if (cfg.pendingPayment && f.due > 0 && f.oldestUnpaid && daysBetween(f.oldestUnpaid, t) >= cfg.pendingPaymentDays)
        out.push({ key: `pending:${s.id}`, type: "PENDING_PAYMENT", severity: daysBetween(f.oldestUnpaid, t) > 30 ? "DANGER" : "WARNING", title: `Paiement en attente : ${name}`, body: `${formatDT(f.due)} dû depuis le ${shortDate(f.oldestUnpaid)}`, href });
      if (cfg.lowCredit && s.billingMode === "ADVANCE") {
        const a = creditAlert(toMil(f.credit), toMil(f.due), toMil(s.rate));
        if (a === "INSUFFICIENT") out.push({ key: `credit:${s.id}`, type: "INSUFFICIENT_CREDIT", severity: "DANGER", title: `Avance insuffisante : ${name}`, body: `Crédit ${formatDT(f.credit)}${f.due > 0 ? `, reste dû ${formatDT(f.due)}` : ""} — tarif ${formatDT(f.rate)}`, href });
        else if (a === "LOW") out.push({ key: `credit:${s.id}`, type: "LOW_CREDIT", severity: "WARNING", title: `Crédit presque épuisé : ${name}`, body: `Crédit restant ${formatDT(f.credit)} (1 séance)`, href });
      }
      if (cfg.packageRenewal && s.billingMode === "MONTHLY" && pkgBy.has(s.id) && !billedPackages.has(s.id))
        out.push({ key: `package:${s.id}:${month}`, type: "PACKAGE_RENEWAL", severity: "WARNING", title: `Forfait mensuel à renouveler : ${name}`, body: `${pkgBy.get(s.id)!.name} — ${formatDT(Number(pkgBy.get(s.id)!.amount))} pour ce mois`, href });
    }
  }

  const horizon = addDays(t, cfg.deadlineDays);
  const tasks = await prisma.task.findMany({ where: { status: { in: ["TODO", "IN_PROGRESS"] }, OR: [{ priority: "URGENT" }, { dueDate: { lte: horizon } }] } });
  for (const k of tasks) {
    const overdue = k.dueDate && k.dueDate < t;
    if (cfg.urgentTasks && (k.priority === "URGENT" || overdue))
      out.push({ key: `task:${k.id}`, type: "URGENT_TASK", severity: overdue ? "DANGER" : "WARNING", title: overdue ? `Tâche en retard : ${k.title}` : `Tâche urgente : ${k.title}`, body: k.dueDate ? `Échéance : ${shortDate(k.dueDate)}` : undefined, href: "/taches" });
    else if (cfg.deadlines && k.dueDate)
      out.push({ key: `task:${k.id}`, type: "DEADLINE", severity: "INFO", title: `Échéance proche : ${k.title}`, body: `Le ${shortDate(k.dueDate)}`, href: "/taches" });
  }
  if (cfg.deadlines) {
    const hw = await prisma.homework.findMany({ where: { status: "PENDING", dueDate: { lte: horizon } }, include: { student: true } });
    for (const h of hw)
      out.push({ key: `homework:${h.id}`, type: "DEADLINE", severity: h.dueDate! < t ? "DANGER" : "INFO", title: `${h.dueDate! < t ? "Devoir en retard" : "Devoir à échéance"} : ${h.title}`, body: `${h.student ? `${h.student.firstName} ${h.student.lastName} · ` : ""}${shortDate(h.dueDate)}`, href: "/devoirs" });
  }
  return out;
}

/** Synchronise la table Notification avec l'état actuel. */
export async function syncNotifications() {
  const alerts = await computeAlerts();
  const keys = alerts.map((a) => a.key);
  await prisma.$transaction([
    ...alerts.map((a) =>
      prisma.notification.upsert({
        where: { key: a.key },
        create: { ...a, body: a.body ?? null, href: a.href ?? null },
        update: { title: a.title, body: a.body ?? null, href: a.href ?? null, severity: a.severity, type: a.type, resolved: false },
      }),
    ),
    prisma.notification.updateMany({ where: { key: { notIn: keys }, resolved: false }, data: { resolved: true } }),
  ]);
  return prisma.notification.findMany({ where: { resolved: false, dismissed: false }, orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }] });
}
