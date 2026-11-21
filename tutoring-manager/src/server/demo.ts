// Données de démonstration FICTIVES (élèves, séances, paiements…), marquées isDemo.
// Les finances passent par le vrai moteur (facturation automatique, avances, journal).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { addDays, addMonths, monthOf, startOfWeek, today, weekday } from "@/lib/dates";
import { ensureReferenceData } from "./reference";
import { createSessions } from "./sessions";
import { billPackage, financeTx, recordPayment } from "./finance";

export async function seedDemo() {
  if (await prisma.student.count({ where: { isDemo: true } })) throw new HttpError(409, "Les données de démonstration sont déjà présentes.");
  await ensureReferenceData();
  const lv = Object.fromEntries((await prisma.level.findMany()).map((l) => [l.name, l.id]));
  const sj = Object.fromEntries((await prisma.subject.findMany()).map((s) => [s.name, s.id]));
  const t = today();
  const ws = startOfWeek(t);

  const parentA = await prisma.parent.create({ data: { name: "Parent Démo A", phone: "00 000 001", isDemo: true } });
  const parentB = await prisma.parent.create({ data: { name: "Parent Démo B", phone: "00 000 002", isDemo: true } });
  const parentC = await prisma.parent.create({ data: { name: "Parent Démo C", phone: "00 000 003", isDemo: true } });

  const mk = (d: { firstName: string; lastName: string; level: string; subjects: string[]; rate: number; mode: string; parentId?: string; color: string; type?: string; duration?: number }) =>
    prisma.student.create({
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        levelId: lv[d.level],
        parentId: d.parentId,
        school: "École fictive (démo)",
        enrolledAt: addDays(t, -60),
        courseType: d.type ?? "INDIVIDUAL",
        rate: new Prisma.Decimal(d.rate),
        sessionDuration: d.duration ?? 60,
        sessionsPerWeek: 1,
        billingMode: d.mode,
        color: d.color,
        availability: "Mercredi après-midi, samedi matin",
        notes: "Élève fictif créé pour la démonstration.",
        strengths: "Curiosité, régularité",
        weaknesses: "Rédaction des justifications",
        goals: "Gagner 2 points de moyenne ce trimestre",
        isDemo: true,
        subjects: { create: d.subjects.map((s) => ({ subjectId: sj[s] })) },
      },
    });

  const amine = await mk({ firstName: "Amine", lastName: "Démo", level: "9ème année", subjects: ["Mathématiques"], rate: 25, mode: "ADVANCE", parentId: parentA.id, color: "#8fb8e8" });
  const lina = await mk({ firstName: "Lina", lastName: "Démo", level: "6ème année", subjects: ["Français", "Mathématiques"], rate: 20, mode: "PER_SESSION", parentId: parentA.id, color: "#f0a8b8" });
  const sami = await mk({ firstName: "Sami", lastName: "Exemple", level: "Bac Économie et Gestion", subjects: ["Économie", "Gestion"], rate: 35, mode: "PER_SESSION", parentId: parentB.id, color: "#f3d77a", duration: 90 });
  const ines = await mk({ firstName: "Inès", lastName: "Exemple", level: "3ème année Informatique", subjects: ["Algorithmique", "Informatique"], rate: 30, mode: "MONTHLY", parentId: parentC.id, color: "#7fc8d8", duration: 90 });
  const yasmine = await mk({ firstName: "Yasmine", lastName: "Fictive", level: "8ème année", subjects: ["Physique", "Mathématiques"], rate: 18, mode: "PER_SESSION", color: "#9fd8b4", type: "GROUP" });
  const omar = await mk({ firstName: "Omar", lastName: "Fictif", level: "8ème année", subjects: ["Physique"], rate: 18, mode: "PER_SESSION", color: "#c7b8ea", type: "GROUP" });

  await prisma.package.create({ data: { studentId: ines.id, name: "Forfait 4 séances", amount: new Prisma.Decimal(110), sessionsCount: 4, startMonth: addMonths(monthOf(t), -2), isDemo: true } });

  // Pédagogie
  const ch1 = await prisma.chapter.create({ data: { subjectId: sj["Mathématiques"], levelId: lv["9ème année"], title: "Équations et inéquations", order: 1, isDemo: true } });
  const ch2 = await prisma.chapter.create({ data: { subjectId: sj["Mathématiques"], levelId: lv["9ème année"], title: "Théorème de Thalès", order: 2, isDemo: true } });
  const ch3 = await prisma.chapter.create({ data: { subjectId: sj["Économie"], levelId: lv["Bac Économie et Gestion"], title: "La croissance économique", order: 1, isDemo: true } });
  const ch4 = await prisma.chapter.create({ data: { subjectId: sj["Algorithmique"], levelId: lv["3ème année Informatique"], title: "Les structures itératives", order: 1, isDemo: true } });
  const l1 = await prisma.lesson.create({
    data: {
      chapterId: ch1.id, title: "Résoudre une équation du premier degré", status: "READY", isDemo: true,
      objectives: "Isoler l'inconnue\nVérifier une solution", content: "Rappel des règles de transposition, exemples guidés, puis exercices progressifs.",
      exercises: { create: [{ title: "Série 1 — échauffement", statement: "Résoudre : 3x + 5 = 20", correction: "x = 5", difficulty: "EASY", isDemo: true }, { title: "Problème", statement: "Un nombre augmenté de 7 vaut le triple de ce nombre. Lequel ?", correction: "x + 7 = 3x ⇒ x = 3,5", difficulty: "MEDIUM", isDemo: true }] },
    },
  });
  await prisma.lesson.create({ data: { chapterId: ch2.id, title: "Thalès : configuration papillon", status: "DRAFT", objectives: "Reconnaître les configurations", isDemo: true } });
  const l3 = await prisma.lesson.create({ data: { chapterId: ch3.id, title: "Les facteurs de la croissance", status: "READY", objectives: "Distinguer facteurs travail, capital, progrès technique", isDemo: true } });
  const l4 = await prisma.lesson.create({ data: { chapterId: ch4.id, title: "Boucles Pour / Tant que", status: "DRAFT", objectives: "Choisir la bonne structure itérative", isDemo: true, exercises: { create: [{ title: "Somme des n premiers entiers", statement: "Écrire l'algorithme.", difficulty: "EASY", isDemo: true }] } } });

  // Séances : 4 semaines passées + 2 à venir
  const plan = [
    { st: amine, wd: 3, time: ["14:00", "15:00"], subject: "Mathématiques", level: "9ème année", lesson: l1.id, chapter: ch1.title },
    { st: lina, wd: 3, time: ["15:30", "16:30"], subject: "Français", level: "6ème année" },
    { st: sami, wd: 6, time: ["09:00", "10:30"], subject: "Économie", level: "Bac Économie et Gestion", lesson: l3.id, chapter: ch3.title },
    { st: ines, wd: 6, time: ["11:00", "12:30"], subject: "Algorithmique", level: "3ème année Informatique", lesson: l4.id, chapter: ch4.title },
  ];
  for (let w = -4; w <= 1; w++) {
    for (const p of plan) {
      const date = addDays(addDays(ws, w * 7), p.wd - 1);
      const past = date < t;
      let status: "PLANNED" | "DONE" | "CANCELLED" | "STUDENT_ABSENT" = past ? "DONE" : "PLANNED";
      if (w === -3 && p.st.id === lina.id) status = "CANCELLED";
      if (w === -2 && p.st.id === sami.id) status = "STUDENT_ABSENT";
      await createSessions({
        title: null, participants: [{ studentId: p.st.id, price: Number(p.st.rate), absent: false }], subjectId: sj[p.subject], levelId: lv[p.level],
        date, startTime: p.time[0], endTime: p.time[1], location: "Domicile (démo)", chapter: p.chapter ?? null, objectives: null, preparationNeeded: null,
        prepared: past || (p.lesson === l1.id), notes: null, report: past && status === "DONE" ? "Bonne participation, notions comprises." : null, status,
        lateAbsenceBillable: status === "STUDENT_ABSENT", lessonIds: p.lesson ? [p.lesson] : [], repeat: null, force: true, skipConflicts: false,
      });
    }
    // Séance collective (groupe de physique)
    const gd = addDays(addDays(ws, w * 7), 4); // jeudi
    await createSessions({
      title: "Groupe Physique 8ème", participants: [{ studentId: yasmine.id, price: 18, absent: false }, { studentId: omar.id, price: 18, absent: w === -1 }], subjectId: sj["Physique"], levelId: lv["8ème année"],
      date: gd, startTime: "17:00", endTime: "18:00", location: "Salle (démo)", chapter: null, objectives: null, preparationNeeded: "Imprimer la série d'exercices", prepared: gd < t,
      notes: null, report: null, status: gd < t ? "DONE" : "PLANNED", lateAbsenceBillable: false, lessonIds: [], repeat: null, force: true, skipConflicts: false,
    });
  }

  // Versements (passent par le moteur financier)
  const pastWeek = (n: number, wd = 1) => addDays(addDays(ws, -n * 7), wd - 1);
  await financeTx(async (tx) => {
    await recordPayment(tx, { studentId: amine.id, kind: "ADVANCE", date: pastWeek(5), amount: 100, method: "CASH", reason: "Avance pour 4 séances", isDemo: true });
    await recordPayment(tx, { studentId: lina.id, kind: "PAYMENT", date: pastWeek(2, 4), amount: 40, method: "CASH", reason: "Séances d'octobre", isDemo: true });
    await recordPayment(tx, { studentId: sami.id, kind: "PAYMENT", date: pastWeek(1, 6), amount: 70, method: "TRANSFER", reference: "VIR-DEMO-01", reason: "Paiement partiel", isDemo: true });
    await recordPayment(tx, { studentId: yasmine.id, kind: "PAYMENT", date: pastWeek(1, 5), amount: 54, method: "CASH", reason: "3 séances de groupe", isDemo: true });
  });
  const prevMonth = addMonths(monthOf(t), -1);
  await financeTx((tx) => billPackage(tx, ines.id, prevMonth));
  await financeTx((tx) => recordPayment(tx, { studentId: ines.id, kind: "PAYMENT", date: `${prevMonth}-05`, amount: 110, method: "TRANSFER", reason: "Forfait du mois", isDemo: true }));

  // Suivi pédagogique
  await prisma.studentProgress.createMany({
    data: [
      { studentId: amine.id, chapterId: ch1.id, status: "DONE", notes: "Maîtrisé", isDemo: true },
      { studentId: amine.id, chapterId: ch2.id, status: "IN_PROGRESS", isDemo: true },
      { studentId: sami.id, chapterId: ch3.id, status: "TO_REVIEW", notes: "Revoir les définitions", isDemo: true },
      { studentId: ines.id, chapterId: ch4.id, status: "IN_PROGRESS", isDemo: true },
    ],
  });
  const grades = [11, 12.5, 13, 14.5];
  await prisma.assessment.createMany({
    data: [
      ...grades.map((g, i) => ({ studentId: amine.id, subjectId: sj["Mathématiques"], kind: i === 3 ? "EXAM" : "HOMEWORK", title: i === 3 ? "Devoir de synthèse" : `Devoir ${i + 1}`, date: addDays(t, -80 + i * 22), score: new Prisma.Decimal(g), maxScore: new Prisma.Decimal(20), isDemo: true })),
      ...[9, 10.5, 12].map((g, i) => ({ studentId: sami.id, subjectId: sj["Économie"], kind: "HOMEWORK", title: `Contrôle ${i + 1}`, date: addDays(t, -70 + i * 25), score: new Prisma.Decimal(g), maxScore: new Prisma.Decimal(20), isDemo: true })),
    ],
  });
  await prisma.homework.createMany({
    data: [
      { title: "Exercices 4 à 8 page 52", type: "TO_SUBMIT", studentId: amine.id, subjectId: sj["Mathématiques"], lessonId: l1.id, dueDate: addDays(t, 3), isDemo: true },
      { title: "Corriger le contrôle de Sami", type: "TO_CORRECT", studentId: sami.id, subjectId: sj["Économie"], dueDate: addDays(t, 1), isDemo: true },
      { title: "Imprimer la série de physique", type: "TO_PRINT", subjectId: sj["Physique"], dueDate: addDays(t, 4), isDemo: true },
      { title: "Examen blanc d'algorithmique", type: "MOCK_EXAM", studentId: ines.id, subjectId: sj["Algorithmique"], dueDate: addDays(t, 12), isDemo: true },
      { title: "Révision des conjugaisons", type: "REVISION", studentId: lina.id, subjectId: sj["Français"], dueDate: addDays(t, -2), status: "DONE", isDemo: true },
    ],
  });

  // Organisation
  await prisma.task.createMany({
    data: [
      { title: "Préparer la leçon sur Thalès", category: "PREP", priority: "HIGH", dueDate: addDays(t, 2), duration: 60, isDemo: true },
      { title: "Relancer le parent de Sami pour le solde", category: "STUDENTS", priority: "URGENT", dueDate: t, duration: 10, isDemo: true },
      { title: "Mettre à jour mes fiches de révision", category: "PRO_DEV", priority: "MEDIUM", status: "IN_PROGRESS", duration: 90, isDemo: true },
      { title: "Déclaration administrative", category: "ADMIN", priority: "MEDIUM", dueDate: addDays(t, 9), isDemo: true },
      { title: "Marche de 45 minutes", category: "SPORT", priority: "LOW", dueDate: addDays(t, 1), time: "18:30", duration: 45, isDemo: true },
      { title: "Corriger la série d'Amine", category: "CORRECTION", priority: "MEDIUM", status: "DONE", completedAt: new Date(), isDemo: true },
    ],
  });
  const entries = [];
  for (let i = 1; i <= 21; i++) {
    const d = addDays(t, -i);
    if (weekday(d) === 7) continue;
    entries.push({ date: d, category: "PREP", minutes: 30 + (i % 3) * 15, isDemo: true });
    if (i % 2) entries.push({ date: d, category: "CORRECTION", minutes: 30, isDemo: true });
    if (i % 4 === 0) entries.push({ date: d, category: "ADMIN", minutes: 20, isDemo: true });
    if (i % 3 === 0) entries.push({ date: d, category: "REST", minutes: 60, isDemo: true });
  }
  await prisma.timeEntry.createMany({ data: entries });
  if ((await prisma.availability.count()) === 0)
    await prisma.availability.createMany({
      data: [
        { weekday: 3, startTime: "13:30", endTime: "19:00", isDemo: true },
        { weekday: 4, startTime: "16:30", endTime: "19:30", isDemo: true },
        { weekday: 6, startTime: "08:30", endTime: "13:00", isDemo: true },
      ],
    });
  await prisma.personalEvent.createMany({
    data: [
      { title: "Pause déjeuner", kind: "BREAK", date: ws, startTime: "12:30", endTime: "13:30", weeklyUntil: addDays(t, 60), isDemo: true },
      { title: "Repos — après-midi libre", kind: "REST", date: addDays(ws, 6), startTime: "14:00", endTime: "18:00", weeklyUntil: addDays(t, 60), isDemo: true },
      { title: "Rendez-vous personnel", kind: "PERSONAL", date: addDays(t, 2), startTime: "10:00", endTime: "11:00", isDemo: true },
    ],
  });
  return { ok: true };
}

/** Supprime uniquement les données de démonstration (les vraies données ne sont jamais touchées). */
export async function clearDemo() {
  const demoStudents = (await prisma.student.findMany({ where: { isDemo: true }, select: { id: true } })).map((s) => s.id);
  await prisma.$transaction(
    async (tx) => {
      const sid = { studentId: { in: demoStudents } };
      await tx.financialTransaction.deleteMany({ where: { OR: [{ isDemo: true }, sid] } });
      await tx.paymentTarget.deleteMany({ where: { payment: sid } });
      await tx.payment.deleteMany({ where: { OR: [{ isDemo: true }, sid] } });
      await tx.refund.deleteMany({ where: { OR: [{ isDemo: true }, sid] } });
      await tx.invoice.deleteMany({ where: { OR: [{ isDemo: true }, sid] } });
      await tx.package.deleteMany({ where: { OR: [{ isDemo: true }, sid] } });
      await tx.session.deleteMany({ where: { OR: [{ isDemo: true }, { participants: { some: sid } }] } });
      await tx.homework.deleteMany({ where: { isDemo: true } });
      await tx.assessment.deleteMany({ where: { isDemo: true } });
      await tx.studentProgress.deleteMany({ where: { isDemo: true } });
      await tx.document.deleteMany({ where: { isDemo: true } });
      await tx.student.deleteMany({ where: { isDemo: true } });
      await tx.parent.deleteMany({ where: { isDemo: true } });
      await tx.chapter.deleteMany({ where: { isDemo: true } });
      await tx.task.deleteMany({ where: { isDemo: true } });
      await tx.timeEntry.deleteMany({ where: { isDemo: true } });
      await tx.availability.deleteMany({ where: { isDemo: true } });
      await tx.personalEvent.deleteMany({ where: { isDemo: true } });
      await tx.notification.deleteMany({});
    },
    { timeout: 60_000 },
  );
  return { ok: true };
}
