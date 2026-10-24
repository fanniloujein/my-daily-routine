import { prisma } from "@/lib/db";
import { addDays, startOfWeek, today } from "@/lib/dates";
import { encrypt } from "@/lib/crypto";
import { WEB_PROJECT_TEMPLATE } from "@/lib/constants";
import { categoryForKind, ensureDefaultCategories } from "./categories";
import { createLesson } from "./lessons";

// Données de démonstration : toutes marquées isDemo = true et supprimables en un clic.

export async function loadDemo(userId: string) {
  await ensureDefaultCategories(userId);
  const t = today();
  const cat = async (k: string) => (await categoryForKind(userId, k)).id;
  const [personal, admin, freelance, german, sport, rest, leisure] = await Promise.all(
    ["personal", "admin", "freelance", "german", "sport", "rest", "leisure"].map(cat),
  );

  // Élèves et séances
  const lina = await prisma.student.create({
    data: { userId, name: "Lina (démo)", level: "3e", subjects: "Mathématiques", goals: "Préparer le brevet, reprendre confiance en géométrie", color: "#5b8def", billingMode: "SESSION", rate: 25, isDemo: true },
  });
  const yanis = await prisma.student.create({
    data: { userId, name: "Yanis (démo)", level: "Terminale", subjects: "Physique-chimie, Mathématiques", goals: "Bac : mécanique et suites", color: "#9b87f5", billingMode: "HOUR", rate: 30, isDemo: true },
  });
  await createLesson(userId, { studentId: lina.id, date: addDays(t, 1), startTime: "16:00", endTime: "17:00", subject: "Mathématiques", chapter: "Théorème de Pythagore", prepMinutes: 45, prepDate: t, isDemo: true });
  await createLesson(userId, { studentId: yanis.id, date: addDays(t, 3), startTime: "17:30", endTime: "19:00", subject: "Physique", chapter: "Lois de Newton", prepMinutes: 60, prepDate: null, isDemo: true });
  const groupe = await prisma.student.create({
    data: { userId, name: "Groupe révisions (démo)", isGroup: true, subjects: "Mathématiques", goals: "Révisions communes avant les contrôles", color: "#4fb3a9", billingMode: "MONTH", rate: 120, isDemo: true, members: { connect: [{ id: lina.id }, { id: yanis.id }] } },
  });
  await createLesson(userId, { studentId: groupe.id, date: addDays(t, 5), startTime: "14:00", endTime: "15:30", subject: "Mathématiques", chapter: "Fonctions", prepMinutes: 60, prepDate: null, isDemo: true });
  const past = await prisma.lesson.create({
    data: {
      userId, studentId: lina.id, date: addDays(t, -4), startTime: "16:00", endTime: "17:00", subject: "Mathématiques", chapter: "Fractions", status: "DONE",
      remarks: "Bonne progression sur les fractions. Encore des hésitations sur les priorités opératoires.", nextSteps: "Revoir les priorités opératoires dans 2 semaines.", price: 25, isDemo: true,
      prepItems: { create: [{ label: "Préparer une fiche de cours", done: true, order: 0 }, { label: "Préparer des exercices", done: true, order: 1 }] },
    },
  });
  await prisma.activity.create({
    data: { userId, categoryId: (await categoryForKind(userId, "tutoring")).id, title: "Cours — Lina (démo) (Mathématiques)", date: past.date, startTime: "16:00", endTime: "17:00", durationMin: 60, status: "DONE", isFixed: true, lessonId: past.id, lessonRole: "session", isDemo: true, completedAt: new Date() },
  });

  // Paiements d'exemple : une séance passée de Lina réglée + un acompte freelance
  const pay = await prisma.income.create({
    data: { userId, date: addDays(t, -4), amount: 25, source: "TUTORING", label: "Mathématiques — séance", studentId: lina.id, method: "CASH", isDemo: true },
  });
  await prisma.lesson.update({ where: { id: past.id }, data: { incomeId: pay.id } });
  const past2 = await prisma.lesson.create({
    data: { userId, studentId: yanis.id, date: addDays(t, -2), startTime: "17:30", endTime: "19:00", subject: "Physique", chapter: "Énergie", status: "DONE", price: 45, remarks: "Exercices bien réussis.", isDemo: true },
  });
  void past2;
  await prisma.income.create({ data: { userId, date: addDays(t, -6), amount: 600, source: "FREELANCE", label: "Acompte site vitrine — Boulangerie Martin (démo)", method: "TRANSFER", isDemo: true } });

  // Projets freelance
  const bakery = await prisma.project.create({
    data: {
      userId, client: "Boulangerie Martin (démo)", name: "Site vitrine", description: "Site vitrine responsive avec carte des produits et formulaire de contact.",
      deadline: addDays(t, 12), budget: 1800, priority: 3, nextAction: "Valider la maquette avec la cliente",
      links: [{ label: "Maquette Figma", url: "https://www.figma.com" }], isDemo: true,
      tasks: { create: WEB_PROJECT_TEMPLATE.map((x, i) => ({ ...x, order: i, status: i < 2 ? "DONE" : i === 2 ? "IN_PROGRESS" : "TODO", spentMin: i < 2 ? x.estimateMin : i === 2 ? 180 : 0, doneAt: i < 2 ? new Date() : null, priority: i === 2 ? 3 : 2 })) },
      events: { create: [{ type: "MEETING", title: "Point d'avancement avec la cliente", date: addDays(t, 2), time: "10:00" }, { type: "DELIVERABLE", title: "Mise en ligne", date: addDays(t, 12) }] },
    },
    include: { tasks: true },
  });
  await prisma.project.create({
    data: {
      userId, client: "StartupX (démo)", name: "Refonte du tableau de bord", deadline: addDays(t, 25), status: "ACTIVE", priority: 2, isDemo: true,
      tasks: { create: [{ title: "Audit de l'existant", estimateMin: 120, status: "WAITING", order: 0 }, { title: "Composants de graphiques", estimateMin: 300, order: 1 }, { title: "Tests utilisateurs", estimateMin: 120, order: 2 }] },
    },
  });
  const front = bakery.tasks.find((x) => x.title === "Développer le frontend")!;
  await prisma.activity.create({
    data: { userId, categoryId: freelance, title: "Site vitrine — Développer le frontend", date: t, startTime: "09:30", endTime: "11:00", durationMin: 90, priority: 3, energyCost: 3, projectTaskId: front.id, reminders: [10], isDemo: true },
  });
  await prisma.activity.create({
    data: { userId, categoryId: freelance, title: "Corriger le menu mobile (Site vitrine)", date: t, durationMin: 60, priority: 3, energyCost: 3, dueDate: addDays(t, 1), isDemo: true },
  });

  // Vie personnelle / administratif
  await prisma.activity.createMany({
    data: [
      { userId, categoryId: personal, title: "Faire les courses", date: t, durationMin: 45, priority: 2, energyCost: 1, isDemo: true },
      { userId, categoryId: admin, title: "Envoyer la facture à la Boulangerie Martin", date: t, durationMin: 20, priority: 4, energyCost: 1, dueDate: t, isDemo: true },
      { userId, categoryId: admin, title: "Classer les papiers administratifs", date: addDays(t, 2), durationMin: 60, priority: 1, energyCost: 2, isDemo: true },
      { userId, categoryId: personal, title: "Rendez-vous chez le dentiste", date: addDays(t, 2), startTime: "14:00", endTime: "14:45", durationMin: 45, isFixed: true, priority: 3, reminders: [60], isDemo: true },
      { userId, categoryId: rest, title: "Soirée tranquille", date: t, startTime: "21:00", endTime: "22:00", durationMin: 60, energyCost: 1, recurrence: "WEEKLY", weekdays: [0, 3], isDemo: true },
    ],
  });

  // Allemand
  const ws = startOfWeek(t);
  const gs = [
    { date: addDays(t, -2), durationMin: 30, topic: "VOCAB", objective: "Apprendre 10 mots professionnels", done: true, rating: 4 },
    { date: addDays(t, -1), durationMin: 15, topic: "GRAMMAR", objective: "Réviser les verbes avec les prépositions", done: true, rating: 2 },
    { date: t, startTime: "18:00", durationMin: 30, topic: "INTERVIEW", objective: "Préparer une réponse à « Erzählen Sie etwas über sich »", done: false },
  ];
  for (const g of gs) {
    const s = await prisma.germanSession.create({ data: { userId, ...g, isDemo: true } });
    await prisma.activity.create({
      data: {
        userId, categoryId: german, title: `Allemand — ${g.objective}`, date: g.date, startTime: g.startTime ?? null, endTime: g.startTime ? "18:30" : null,
        durationMin: g.durationMin, status: g.done ? "DONE" : "TODO", germanSessionId: s.id, isDemo: true, completedAt: g.done ? new Date() : null,
      },
    });
  }
  const cards: [string, string, string?, string?][] = [
    ["die Bewerbung", "la candidature", "Ich habe meine Bewerbung gestern abgeschickt."],
    ["das Vorstellungsgespräch", "l'entretien d'embauche", "Das Vorstellungsgespräch findet am Montag statt."],
    ["die Erfahrung", "l'expérience", "Ich habe drei Jahre Erfahrung in der Webentwicklung."],
    ["die Stärke / die Schwäche", "la force / la faiblesse", "Meine größte Stärke ist meine Zuverlässigkeit."],
    ["sich bewerben um + Akk.", "postuler à", "Ich bewerbe mich um die Stelle als Entwicklerin.", "GRAMMAR"],
    ["sich interessieren für + Akk.", "s'intéresser à", "Ich interessiere mich für Ihr Unternehmen.", "GRAMMAR"],
    ["teilnehmen an + Dat.", "participer à", "Ich habe an einem Projekt teilgenommen.", "GRAMMAR"],
    ["Erzählen Sie etwas über sich.", "Parlez-moi de vous.", "Ich heiße …, ich bin Webentwicklerin und unterrichte Nachhilfe.", "INTERVIEW"],
    ["Warum möchten Sie bei uns arbeiten?", "Pourquoi voulez-vous travailler chez nous ?", undefined, "INTERVIEW"],
    ["Ich freue mich auf Ihre Rückmeldung.", "Dans l'attente de votre retour.", undefined, "EXPRESSIONS"],
    ["weil + verbe à la fin", "parce que (subordonnée)", "…, weil ich gern im Team arbeite.", "ERRORS"],
  ];
  await prisma.flashcard.createMany({
    data: cards.map(([front, back, example, topic], i) => ({
      userId, front, back, example: example ?? null, topic: topic ?? "VOCAB", dueDate: addDays(t, i % 3 === 0 ? 0 : i % 3), isDemo: true,
      lapses: topic === "ERRORS" ? 3 : i === 5 ? 2 : 0, ease: topic === "ERRORS" ? 1.6 : 2.5,
    })),
  });

  // Sport
  await prisma.sportProfile.upsert({
    where: { userId },
    create: { userId, goal: "Bouger régulièrement pour avoir plus d'énergie", weeklySessions: 3, weeklyMinutes: 120, preferred: ["Yoga", "Marche rapide", "Pilates"], availableDays: [1, 3, 6], defaultDuration: 40, preferredTime: "18:30" },
    update: {},
  });
  const sp = await prisma.sportSession.create({ data: { userId, date: addDays(t, -3), startTime: "18:30", type: "Yoga", durationMin: 40, status: "DONE", isDemo: true } });
  await prisma.activity.create({ data: { userId, categoryId: sport, title: "Sport — Yoga", date: sp.date, startTime: "18:30", endTime: "19:10", durationMin: 40, status: "DONE", sportSessionId: sp.id, isDemo: true, completedAt: new Date() } });
  const sp2 = await prisma.sportSession.create({ data: { userId, date: addDays(t, 1), startTime: "08:00", type: "Marche rapide", durationMin: 30, isDemo: true } });
  await prisma.activity.create({ data: { userId, categoryId: sport, title: "Sport — Marche rapide", date: sp2.date, startTime: "08:00", endTime: "08:30", durationMin: 30, sportSessionId: sp2.id, reminders: [30], isDemo: true } });

  // Loisirs
  await prisma.mediaItem.createMany({
    data: [
      { userId, title: "Le Fabuleux Destin d'Amélie Poulain", type: "MOVIE", genre: "Comédie romantique", durationMin: 122, isDemo: true },
      { userId, title: "Dark", type: "SERIES", genre: "Science-fiction (en allemand !)", durationMin: 55, status: "WATCHING", liked: true, isDemo: true },
      { userId, title: "Good Bye, Lenin!", type: "MOVIE", genre: "Comédie dramatique (allemand)", durationMin: 121, isDemo: true },
      { userId, title: "Le Bureau des légendes", type: "SERIES", genre: "Espionnage", durationMin: 52, status: "DONE", liked: true, rating: 5, isDemo: true },
    ],
  });
  await prisma.leisureIdea.createMany({
    data: [
      { userId, title: "Dessiner ou colorier", durationMin: 30, minEnergy: 1, kind: "CREATIVE", isDemo: true },
      { userId, title: "Balade au parc", durationMin: 40, minEnergy: 2, kind: "MOVE", isDemo: true },
      { userId, title: "Lire un roman", durationMin: 45, minEnergy: 1, kind: "READ", isDemo: true },
    ],
  });

  // Médicament d'exemple (purement fictif)
  await prisma.medication.create({
    data: {
      userId, nameEnc: encrypt("Exemple — Traitement A (démo)"), dosageEnc: encrypt("Selon l'ordonnance"), instructionsEnc: encrypt("Exemple fictif : remplacez-le par votre propre traitement tel que prescrit."),
      times: ["08:00", "20:00"], frequency: "DAILY", startDate: addDays(t, -7), reminderOffset: 0, isDemo: true,
    },
  });

  // Historique d'énergie et quelques activités terminées pour les statistiques
  for (let i = 1; i <= 6; i++) {
    const d = addDays(t, -i);
    await prisma.energyCheckin.upsert({
      where: { userId_date: { userId, date: d } },
      create: { userId, date: d, energy: [3, 4, 2, 3, 5, 3][i - 1], mood: [3, 4, 3, 4, 5, 3][i - 1], stress: [3, 2, 4, 3, 2, 3][i - 1], isDemo: true },
      update: {},
    });
  }
  await prisma.activity.createMany({
    data: [
      { userId, categoryId: freelance, title: "Site vitrine — Concevoir l'interface", date: addDays(t, -2), startTime: "09:00", endTime: "11:00", durationMin: 120, status: "DONE", isDemo: true, completedAt: new Date() },
      { userId, categoryId: leisure, title: "Épisode de Dark", date: addDays(t, -1), startTime: "21:00", endTime: "22:00", durationMin: 60, status: "DONE", isDemo: true, completedAt: new Date() },
      { userId, categoryId: rest, title: "Sieste", date: addDays(t, -2), startTime: "14:00", endTime: "14:30", durationMin: 30, status: "DONE", isDemo: true, completedAt: new Date() },
      { userId, categoryId: admin, title: "Répondre aux e-mails", date: ws < t ? ws : addDays(t, -1), durationMin: 30, status: "DONE", isDemo: true, completedAt: new Date() },
    ],
  });
  return { ok: true };
}

export async function removeDemo(userId: string) {
  await prisma.$transaction([
    prisma.activity.deleteMany({ where: { userId, isDemo: true } }),
    prisma.income.deleteMany({ where: { userId, isDemo: true } }),
    prisma.lesson.deleteMany({ where: { userId, isDemo: true } }),
    prisma.student.deleteMany({ where: { userId, isDemo: true } }),
    prisma.project.deleteMany({ where: { userId, isDemo: true } }),
    prisma.germanSession.deleteMany({ where: { userId, isDemo: true } }),
    prisma.flashcard.deleteMany({ where: { userId, isDemo: true } }),
    prisma.medication.deleteMany({ where: { userId, isDemo: true } }),
    prisma.sportSession.deleteMany({ where: { userId, isDemo: true } }),
    prisma.mediaItem.deleteMany({ where: { userId, isDemo: true } }),
    prisma.leisureIdea.deleteMany({ where: { userId, isDemo: true } }),
    prisma.energyCheckin.deleteMany({ where: { userId, isDemo: true } }),
  ]);
  return { ok: true };
}

export async function hasDemo(userId: string) {
  const [a, s, p] = await Promise.all([
    prisma.activity.count({ where: { userId, isDemo: true } }),
    prisma.student.count({ where: { userId, isDemo: true } }),
    prisma.project.count({ where: { userId, isDemo: true } }),
  ]);
  return a + s + p > 0;
}
