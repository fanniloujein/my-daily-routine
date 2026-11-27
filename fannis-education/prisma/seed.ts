/**
 * Seed : données de référence (niveau, matières, offre, paramètres) + compte administrateur.
 * Avec SEED_DEMO=true : comptes et contenus de DÉMONSTRATION, clairement signalés (isDemo),
 * sans aucune donnée réelle d'élève. Idempotent : peut être relancé sans dupliquer.
 */
import { PrismaClient, type AccessLevel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

const SUBJECTS = [
  { slug: "economie", name: "Économie", nameAr: "الاقتصاد", icon: "economy" },
  { slug: "gestion", name: "Gestion", nameAr: "التصرّف", icon: "management" },
  { slug: "mathematiques", name: "Mathématiques", nameAr: "الرياضيات", icon: "math" },
  { slug: "histoire-geographie", name: "Histoire-Géographie", nameAr: "التاريخ والجغرافيا", icon: "history" },
  { slug: "arabe", name: "Arabe", nameAr: "العربية", icon: "arabic" },
  { slug: "francais", name: "Français", nameAr: "الفرنسية", icon: "literature" },
  { slug: "anglais", name: "Anglais", nameAr: "الإنجليزية", icon: "language" },
  { slug: "philosophie", name: "Philosophie", nameAr: "الفلسفة", icon: "philosophy" },
  { slug: "informatique", name: "Informatique", nameAr: "الإعلامية", icon: "computer" },
];

/** Génère un PDF minimal valide (texte ASCII) pour les fiches de démonstration. */
function makePdf(title: string, lines: string[]): Buffer {
  const ascii = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "-").replace(/([()\\])/g, "\\$1");
  const text = [
    "BT /F1 18 Tf 56 780 Td (" + ascii(title) + ") Tj ET",
    "BT /F1 10 Tf 56 760 Td (Contenu de demonstration - a verifier par un enseignant qualifie.) Tj ET",
    ...lines.map((l, i) => `BT /F1 12 Tf 56 ${720 - i * 22} Td (${ascii(l)}) Tj ET`),
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function main() {
  // ── Niveau & matières ──
  const level = await prisma.educationalLevel.upsert({
    where: { slug: "bac-economie-gestion" },
    update: {},
    create: {
      slug: "bac-economie-gestion",
      name: "Bac Économie et Gestion",
      nameAr: "باكالوريا اقتصاد وتصرّف",
      description: "4ème année secondaire — section Économie et Gestion",
      category: "BACCALAUREATE",
      order: 1,
    },
  });
  const subjects: Record<string, string> = {};
  for (const [i, s] of SUBJECTS.entries()) {
    const row = await prisma.subject.upsert({
      where: { levelId_slug: { levelId: level.id, slug: s.slug } },
      update: {},
      create: { ...s, levelId: level.id, order: i + 1 },
    });
    subjects[s.slug] = row.id;
  }

  // ── Offre initiale : 10 DT / mois (modifiable par l'admin) ──
  await prisma.subscriptionPlan.upsert({
    where: { code: "MONTHLY" },
    update: {},
    create: {
      code: "MONTHLY",
      name: "Abonnement mensuel",
      nameAr: "الاشتراك الشهري",
      description: "Accès complet aux ressources abonnés pendant 30 jours.",
      descriptionAr: "وصول كامل إلى موارد المشتركين لمدة 30 يومًا.",
      priceMillimes: 10_000,
      durationDays: 30,
      isFeatured: true,
      features: [
        "Cours et leçons réservés aux abonnés",
        "Fiches de révision et exercices en PDF",
        "QCM interactifs corrigés",
        "Suivi de ta progression",
        "Sans engagement",
      ],
      featuresAr: ["دروس ومحاور للمشتركين", "ملخصات وتمارين بصيغة PDF", "اختبارات تفاعلية مصحّحة", "متابعة تقدّمك", "دون التزام"],
    },
  });

  // ── Administrateur ──
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@fannis-education.test").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 10) {
    throw new Error("SEED_ADMIN_PASSWORD doit être défini (10 caractères minimum).");
  }
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: "Administrateur", role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 12) },
  });
  console.log(`✔ Administrateur : ${adminEmail}`);

  if (process.env.SEED_DEMO !== "true") {
    console.log("ℹ SEED_DEMO≠true : aucun contenu de démonstration créé.");
    return;
  }

  // ── Comptes de démonstration (fictifs) ──
  const demoHash = await bcrypt.hash("Demo!2026", 12);
  await prisma.user.upsert({
    where: { email: "eleve.demo@fannis-education.test" },
    update: {},
    create: {
      email: "eleve.demo@fannis-education.test",
      name: "Élève Démo",
      role: "STUDENT",
      passwordHash: demoHash,
      studentProfile: { create: { levelId: level.id, city: "Ville démo" } },
    },
  });

  const teachers = [
    {
      email: "enseignant.demo@fannis-education.test",
      name: "Amel Démo",
      headline: "Enseignante d'économie (profil de démonstration)",
      bio: "Profil fictif créé pour la démonstration de la plateforme. Méthode : reprise des notions clés, exercices progressifs et méthodologie de la dissertation économique.",
      city: "Tunis",
      years: 9,
      subjects: ["economie", "gestion"],
      online: 25_000,
      inPerson: 35_000,
      status: "APPROVED" as const,
    },
    {
      email: "enseignant2.demo@fannis-education.test",
      name: "Karim Démo",
      headline: "Professeur de mathématiques (profil de démonstration)",
      bio: "Profil fictif de démonstration. Accompagnement sur les fonctions, les suites et les probabilités.",
      city: "Sfax",
      years: 6,
      subjects: ["mathematiques"],
      online: 20_000,
      inPerson: null,
      status: "APPROVED" as const,
    },
    {
      email: "enseignant3.demo@fannis-education.test",
      name: "Nour Démo",
      headline: "Professeure d'anglais (profil de démonstration en attente)",
      bio: "Profil fictif en attente de validation, pour tester le parcours administrateur.",
      city: "Sousse",
      years: 4,
      subjects: ["anglais"],
      online: 20_000,
      inPerson: 30_000,
      status: "PENDING" as const,
    },
  ];
  for (const tdef of teachers) {
    const existing = await prisma.user.findUnique({ where: { email: tdef.email } });
    if (existing) continue;
    await prisma.user.create({
      data: {
        email: tdef.email,
        name: tdef.name,
        role: "TEACHER",
        passwordHash: demoHash,
        teacherProfile: {
          create: {
            status: tdef.status,
            isDemo: true,
            headline: tdef.headline,
            bio: tdef.bio,
            city: tdef.city,
            yearsExperience: tdef.years,
            offersOnline: tdef.online !== null,
            offersInPerson: tdef.inPerson !== null,
            onlinePriceMillimes: tdef.online,
            inPersonPriceMillimes: tdef.inPerson,
            inPersonArea: tdef.inPerson ? `${tdef.city} centre` : null,
            lessonDurationMinutes: 60,
            validatedAt: tdef.status === "APPROVED" ? new Date() : null,
            subjects: { create: tdef.subjects.map((s) => ({ subjectId: subjects[s] })) },
            availabilities: {
              create: [
                // Lundi → vendredi 17:00–20:00, samedi 09:00–13:00 (heure de Tunis)
                ...[1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startMinute: 17 * 60, endMinute: 20 * 60 })),
                { dayOfWeek: 6, startMinute: 9 * 60, endMinute: 13 * 60 },
              ],
            },
          },
        },
      },
    });
  }

  // ── Cours de démonstration (notions générales, signalés « démo ») ──
  const courses: {
    subject: string;
    slug: string;
    title: string;
    summary: string;
    access: AccessLevel;
    lessons: { title: string; access: AccessLevel; minutes: number; content: string }[];
  }[] = [
    {
      subject: "economie",
      slug: "croissance-economique",
      title: "La croissance économique",
      summary: "Définir, mesurer et expliquer la croissance ; la distinguer du développement.",
      access: "PREMIUM",
      lessons: [
        {
          title: "Définir et mesurer la croissance",
          access: "FREE",
          minutes: 20,
          content: `## Définition
La croissance économique désigne l'augmentation durable de la production de biens et de services d'une économie sur une longue période.

## La mesure par le PIB
Le produit intérieur brut (PIB) mesure la richesse produite sur le territoire pendant une année. On l'obtient notamment par la somme des valeurs ajoutées.
- Le **taux de croissance** est le taux de variation du PIB d'une année à l'autre.
- On raisonne en **PIB réel** (à prix constants) pour neutraliser l'effet de la hausse des prix.

## Limites de l'indicateur
Le PIB ne mesure ni la répartition des revenus, ni les activités non marchandes, ni les atteintes à l'environnement.`,
        },
        {
          title: "Les facteurs de la croissance",
          access: "PREMIUM",
          minutes: 25,
          content: `## Les facteurs de production
La croissance s'explique par l'augmentation des quantités de facteurs utilisées et par leur meilleure efficacité.
- **Croissance extensive** : hausse des quantités de travail et de capital.
- **Croissance intensive** : hausse de la productivité, notamment grâce au progrès technique.

## Le rôle du progrès technique
Les innovations permettent de produire davantage avec les mêmes quantités de facteurs. L'éducation, la recherche et les infrastructures favorisent ce progrès.`,
        },
        {
          title: "Croissance et développement",
          access: "PREMIUM",
          minutes: 20,
          content: `## Deux notions différentes
La croissance est un phénomène quantitatif ; le développement est un processus qualitatif qui améliore durablement les conditions de vie de la population.

## Mesurer le développement
L'indice de développement humain (IDH) combine trois dimensions : la santé (espérance de vie), l'éducation et le niveau de vie.

## Le développement durable
Il vise à répondre aux besoins du présent sans compromettre la capacité des générations futures à répondre aux leurs.`,
        },
      ],
    },
    {
      subject: "economie",
      slug: "echanges-internationaux",
      title: "Les échanges internationaux",
      summary: "Fondements théoriques du commerce international et lecture de la balance des paiements.",
      access: "PREMIUM",
      lessons: [
        {
          title: "Pourquoi les pays échangent-ils ?",
          access: "FREE",
          minutes: 20,
          content: `## L'avantage absolu
Selon Adam Smith, chaque pays a intérêt à se spécialiser dans les productions pour lesquelles il est le plus efficace.

## L'avantage comparatif
David Ricardo montre qu'un pays a intérêt à échanger même s'il est moins efficace partout : il se spécialise là où son désavantage est le plus faible.`,
        },
        {
          title: "Mesurer les échanges",
          access: "PREMIUM",
          minutes: 25,
          content: `## La balance commerciale
Elle compare les exportations et les importations de biens.
- **Solde commercial** = exportations − importations.
- **Taux de couverture** = (exportations / importations) × 100.

## Interpréter
Un taux de couverture inférieur à 100 % traduit un déficit commercial.`,
        },
      ],
    },
    {
      subject: "gestion",
      slug: "analyse-du-bilan",
      title: "Lire et analyser un bilan",
      summary: "Structure du bilan et premiers indicateurs d'équilibre financier.",
      access: "PREMIUM",
      lessons: [
        {
          title: "La structure du bilan",
          access: "FREE",
          minutes: 20,
          content: `## Une photographie du patrimoine
Le bilan présente, à une date donnée, ce que l'entreprise possède et la manière dont ces biens sont financés.
- **Actifs** : actifs non courants (immobilisations) et actifs courants (stocks, créances, liquidités).
- **Capitaux propres et passifs** : capitaux propres, passifs non courants et passifs courants.

## L'égalité fondamentale
Total des actifs = capitaux propres + total des passifs.`,
        },
        {
          title: "Le fonds de roulement",
          access: "PREMIUM",
          minutes: 25,
          content: `## Définition
Le fonds de roulement mesure l'excédent des ressources stables sur les emplois stables.
- **Fonds de roulement** = capitaux permanents − actifs non courants.
- Capitaux permanents = capitaux propres + passifs non courants.

## Interprétation
Un fonds de roulement positif signifie qu'une partie des actifs courants est financée par des ressources stables.`,
        },
      ],
    },
  ];

  for (const [ci, c] of courses.entries()) {
    const subjectId = subjects[c.subject];
    const exists = await prisma.course.findUnique({ where: { subjectId_slug: { subjectId, slug: c.slug } } });
    if (exists) continue;
    await prisma.course.create({
      data: {
        subjectId,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        accessLevel: c.access,
        status: "PUBLISHED",
        publishedAt: new Date(),
        isDemo: true,
        order: ci + 1,
        authorId: admin.id,
        lessons: {
          create: c.lessons.map((l, i) => ({ title: l.title, content: l.content, accessLevel: l.access, durationMinutes: l.minutes, order: i + 1 })),
        },
      },
    });
  }

  // ── Fiches PDF de démonstration ──
  const resources = [
    {
      subject: "economie",
      title: "Fiche — La croissance économique (démo)",
      type: "REVISION_SHEET" as const,
      access: "FREE" as const,
      lines: ["1. Croissance : hausse durable de la production.", "2. Mesure : taux de variation du PIB reel.", "3. Facteurs : travail, capital, progres technique.", "4. Developpement : IDH (sante, education, niveau de vie)."],
    },
    {
      subject: "gestion",
      title: "Exercices — Bilan et fonds de roulement (démo)",
      type: "EXERCISES" as const,
      access: "PREMIUM" as const,
      lines: ["Exercice 1 : classer les postes du bilan.", "Exercice 2 : calculer les capitaux permanents.", "Exercice 3 : calculer et interpreter le fonds de roulement."],
    },
  ];
  for (const r of resources) {
    const exists = await prisma.educationalResource.findFirst({ where: { title: r.title } });
    if (exists) continue;
    const bytes = makePdf(r.title, r.lines);
    const file = await prisma.storedFile.create({
      data: {
        filename: `${r.title.replace(/[^\w]+/g, "-").toLowerCase()}.pdf`,
        mimeType: "application/pdf",
        size: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        data: new Uint8Array(bytes),
      },
    });
    await prisma.educationalResource.create({
      data: {
        subjectId: subjects[r.subject],
        title: r.title,
        description: "Ressource de démonstration à remplacer par une fiche rédigée par un enseignant.",
        type: r.type,
        accessLevel: r.access,
        status: "PUBLISHED",
        publishedAt: new Date(),
        isDemo: true,
        fileId: file.id,
        uploadedById: admin.id,
      },
    });
  }

  // ── QCM de démonstration ──
  const quizzes = [
    {
      subject: "economie",
      title: "QCM — La croissance économique (démo)",
      access: "FREE" as const,
      questions: [
        { prompt: "Quel indicateur est le plus utilisé pour mesurer la croissance ?", options: ["L'IDH", "Le PIB réel", "Le taux de chômage", "L'indice des prix"], correct: [1], explanation: "La croissance se mesure par le taux de variation du PIB réel." },
        { prompt: "Pourquoi utilise-t-on le PIB à prix constants ?", options: ["Pour inclure les activités domestiques", "Pour neutraliser l'effet de la hausse des prix", "Pour mesurer les inégalités", "Pour compter les importations"], correct: [1], explanation: "Le PIB réel élimine l'effet de l'inflation." },
        { prompt: "Quelles sont des dimensions de l'IDH ?", options: ["La santé", "L'éducation", "Le niveau de vie", "Le solde commercial"], correct: [0, 1, 2], type: "MULTIPLE_CHOICE" as const, explanation: "L'IDH combine santé, éducation et niveau de vie." },
        { prompt: "Une croissance due surtout au progrès technique est dite…", options: ["extensive", "intensive", "négative", "nominale"], correct: [1], explanation: "La croissance intensive repose sur les gains de productivité." },
      ],
    },
    {
      subject: "gestion",
      title: "QCM — Le bilan (démo)",
      access: "PREMIUM" as const,
      questions: [
        { prompt: "Les stocks font partie…", options: ["des actifs non courants", "des actifs courants", "des capitaux propres", "des passifs courants"], correct: [1], explanation: "Les stocks sont des actifs courants." },
        { prompt: "Les capitaux permanents comprennent…", options: ["les capitaux propres", "les passifs non courants", "les passifs courants", "les liquidités"], correct: [0, 1], type: "MULTIPLE_CHOICE" as const, explanation: "Capitaux permanents = capitaux propres + passifs non courants." },
        { prompt: "Fonds de roulement = …", options: ["Actifs courants − passifs non courants", "Capitaux permanents − actifs non courants", "Capitaux propres − actifs courants", "Total actif − total passif"], correct: [1], explanation: "FR = capitaux permanents − actifs non courants." },
      ],
    },
  ];
  for (const q of quizzes) {
    const exists = await prisma.quiz.findFirst({ where: { title: q.title } });
    if (exists) continue;
    await prisma.quiz.create({
      data: {
        subjectId: subjects[q.subject],
        title: q.title,
        description: "QCM de démonstration — à relire par un enseignant.",
        accessLevel: q.access,
        status: "PUBLISHED",
        isDemo: true,
        passingScore: 60,
        timeLimitMinutes: 10,
        authorId: admin.id,
        questions: {
          create: q.questions.map((qq, i) => ({
            prompt: qq.prompt,
            options: qq.options,
            correctOptions: qq.correct,
            type: qq.type ?? "SINGLE_CHOICE",
            explanation: qq.explanation,
            order: i + 1,
          })),
        },
      },
    });
  }
  console.log("✔ Contenus et comptes de démonstration créés (mot de passe démo : Demo!2026).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
