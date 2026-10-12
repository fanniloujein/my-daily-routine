import { addDays, weekday, isValidDateStr, type DateStr, formatTime } from "./dates";

// Analyseur local (sans IA externe) des phrases en français.
// Il transforme une phrase en « actions proposées » que l'utilisatrice confirme.
// Il ne déplace jamais un rendez-vous fixe et n'invente aucune disponibilité :
// la recherche de créneaux libres se fait côté serveur, sur le vrai agenda.

export type AssistantAction =
  | {
      type: "create_activity";
      data: {
        title: string;
        categoryKind?: string;
        categoryName?: string;
        date: DateStr;
        startTime?: string;
        durationMin: number;
        isFixed?: boolean;
        priority?: number;
        energyCost?: number;
      };
    }
  | { type: "prep_lesson"; data: { subject?: string; studentName?: string; date: DateStr; durationMin: number } }
  | { type: "weekly_goal"; data: { title: string; categoryKind: string; totalMinutes: number; weekOf: DateStr } }
  | { type: "german_session"; data: { durationMin: number; date: DateStr; startTime?: string; topic: string; objective: string } }
  | { type: "set_energy"; data: { energy: number; date: DateStr } }
  | { type: "delete_activity"; data: { activityId?: string; occurrenceDate?: DateStr; query?: string } }
  | { type: "create_category"; data: { name: string } }
  | { type: "plan_day"; data: { date: DateStr; light?: boolean } }
  | { type: "postpone_activity"; data: { activityId?: string; occurrenceDate?: DateStr; query?: string } };

export type ParseResult = {
  reply: string;
  actions: AssistantAction[];
  understood: boolean;
};

export type ParseContext = {
  today: DateStr;
  lastActivityId?: string | null;
  lastActivityDate?: DateStr | null;
};

export const DESTRUCTIVE: AssistantAction["type"][] = ["delete_activity"];

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, "quarante-cinq": 45, cinquante: 50, soixante: 60,
};

function num(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  return NUMBER_WORDS[s] ?? null;
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

export function parseDateExpr(text: string, todayStr: DateStr): DateStr | null {
  const t = normalize(text);
  if (/apres-demain|apres demain/.test(t)) return addDays(todayStr, 2);
  if (/\bdemain\b/.test(t)) return addDays(todayStr, 1);
  if (/aujourd'hui|aujourdhui|ce soir|ce matin|cet apres-midi|cet apres midi|maintenant/.test(t)) return todayStr;

  // « le 15 octobre », « 15/10 », « le 15 »
  const full = t.match(/\b(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?/);
  if (full) {
    const day = Number(full[1]);
    const month = MONTHS.indexOf(full[2]) + 1;
    let year = full[3] ? Number(full[3]) : Number(todayStr.slice(0, 4));
    let candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!full[3] && candidate < todayStr) {
      year += 1;
      candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return isValidDateStr(candidate) ? candidate : null;
  }
  const slash = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (slash) {
    let year = slash[3] ? Number(slash[3]) : Number(todayStr.slice(0, 4));
    let candidate = `${year}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
    if (!slash[3] && candidate < todayStr) {
      year += 1;
      candidate = `${year}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
    }
    return isValidDateStr(candidate) ? candidate : null;
  }

  for (let i = 0; i < 7; i++) {
    const re = new RegExp(`\\b${WEEKDAYS[i]}\\b`);
    if (re.test(t)) {
      const cur = weekday(todayStr);
      let delta = (i - cur + 7) % 7;
      if (delta === 0) delta = /prochain/.test(t) ? 7 : 0;
      else if (new RegExp(`${WEEKDAYS[i]} prochain`).test(t) && delta < 7) {
        // « lundi prochain » = le prochain lundi (comportement courant)
      }
      return addDays(todayStr, delta);
    }
  }
  const dayOnly = t.match(/\ble (\d{1,2})\b(?!\s*(h|heures?|min))/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    let candidate = `${todayStr.slice(0, 8)}${String(day).padStart(2, "0")}`;
    if (isValidDateStr(candidate) && candidate < todayStr) {
      const [y, m] = todayStr.split("-").map(Number);
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      candidate = `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return isValidDateStr(candidate) ? candidate : null;
  }
  return null;
}

/** Heure de début : « à 17 h », « 17h30 », « vers 9:15 », « à midi » */
export function parseTimeExpr(text: string): string | null {
  const t = normalize(text);
  if (/\b(a|vers) midi\b/.test(t)) return "12:00";
  if (/\b(a|vers) minuit\b/.test(t)) return "00:00";
  const re = /(?:^|\s)(a|vers|des|de|pour|entre)?\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?!\s*(?:\d|minutes?|min\b|heures?))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const before = t.slice(0, m.index);
    if (/(pendant|durant)\s*$/.test(before)) continue;
    const h = Number(m[2]);
    const mi = m[3] ? Number(m[3]) : 0;
    if (h > 23 || mi > 59) continue;
    // « 2h » sans préposition est ambigu (durée) : on ne l'accepte que s'il ressemble à une heure de la journée
    if (!m[1] && h < 7) continue;
    let hour = h;
    if (/(apres-midi|apres midi|ce soir|du soir)/.test(t) && hour < 12) hour += 12;
    return `${String(hour).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }
  return null;
}

/** Durée : « 30 minutes », « trois heures », « 1h30 », « pendant 2h », « une demi-heure » */
export function parseDurationExpr(text: string): number | null {
  const t = normalize(text);
  if (/demi-heure|demi heure/.test(t)) return 30;
  if (/quart d'heure/.test(t)) return 15;
  const hm = t.match(/(?:pendant|durant)\s+(\d{1,2})\s*h\s*(\d{2})?/);
  if (hm) return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
  const hours = t.match(/\b(\d+(?:[.,]5)?|un|une|deux|trois|quatre|cinq|six|sept|huit)\s+heures?(?:\s+et\s+demie)?/);
  if (hours) {
    const raw = hours[1].replace(",", ".");
    const base = /^\d/.test(raw) ? Number(raw) : num(raw) ?? 1;
    return Math.round(base * 60 + (/et demie/.test(hours[0]) ? 30 : 0));
  }
  const mins = t.match(/\b(\d+|quinze|vingt|trente|quarante-cinq|quarante|cinquante|soixante|dix|cinq)\s*(?:minutes?|min)\b/);
  if (mins) return num(mins[1]);
  const compact = t.match(/\b(\d)h(\d{2})\b/);
  if (compact && /(pendant|durant|session|seance)/.test(t)) return Number(compact[1]) * 60 + Number(compact[2]);
  return null;
}

type CatRule = { kind: string; re: RegExp; title: string };
const CATEGORY_RULES: CatRule[] = [
  { kind: "prep", re: /prepar(er|e|ation)\s+(un |le |mon |ma |les |des )?(cours|seance|fiche|lecon|exercices?)/, title: "Préparer le cours" },
  { kind: "tutoring", re: /cours particuliers?|seance (avec|de cours)|eleve|soutien scolaire|donner (un )?cours/, title: "Cours particulier" },
  { kind: "freelance", re: /projet (web|client|freelance)|freelance|client|site web|developp|code|frontend|backend|maquette/, title: "Travail sur le projet web" },
  { kind: "german", re: /allemand|deutsch|entretien en allemand|vocabulaire allemand/, title: "Allemand" },
  { kind: "sport", re: /\bsport\b|courir|course a pied|yoga|pilates|natation|nager|muscu|salle de sport|marche sportive|velo|fitness|entrainement/, title: "Sport" },
  { kind: "meds", re: /medicament|traitement|comprime/, title: "Médicament" },
  { kind: "leisure", re: /\bfilm\b|\bserie\b|cinema|netflix|episode/, title: "Film / série" },
  { kind: "rest", re: /\brepos\b|sieste|me reposer|pause|detente|meditation/, title: "Repos" },
  { kind: "admin", re: /administratif|impots|papiers|banque|facture|caf|prefecture|dossier/, title: "Administratif" },
  { kind: "learning", re: /apprendre|formation|lecture|lire|tutoriel|cours en ligne/, title: "Apprentissage" },
  { kind: "personal", re: /rendez-vous|rdv|medecin|dentiste|courses|menage|anniversaire|appeler|famille|amie?s?/, title: "Vie personnelle" },
];

export function inferCategory(text: string): CatRule | null {
  const t = normalize(text);
  for (const r of CATEGORY_RULES) if (r.re.test(t)) return r;
  return null;
}

const SUBJECTS = ["mathematiques", "maths", "physique", "chimie", "francais", "anglais", "histoire", "geographie", "svt", "philosophie", "allemand", "espagnol", "informatique", "economie"];
const SUBJECT_LABEL: Record<string, string> = {
  mathematiques: "Mathématiques", maths: "Mathématiques", physique: "Physique", chimie: "Chimie", francais: "Français",
  anglais: "Anglais", histoire: "Histoire", geographie: "Géographie", svt: "SVT", philosophie: "Philosophie",
  allemand: "Allemand", espagnol: "Espagnol", informatique: "Informatique", economie: "Économie",
};

export function parseSubject(text: string): string | undefined {
  const t = normalize(text);
  for (const s of SUBJECTS) if (new RegExp(`\\b${s}\\b`).test(t)) return SUBJECT_LABEL[s];
  return undefined;
}

export function parseEnergy(text: string): number | null {
  const t = normalize(text);
  if (/tres fatiguee?|epuisee?|crevee?|a plat|videe?|ko\b|malade|pas du tout en forme/.test(t)) return 1;
  if (/fatiguee?|pas (tres |trop )?en forme|peu d'energie|un peu lasse|lasse/.test(t)) return 2;
  if (/pleine? d'energie|en pleine forme|super forme|excellente? (forme|energie)|au top|motivee? a fond/.test(t)) return 5;
  if (/en forme|bonne energie|motivee?|ca va bien|je me sens bien/.test(t)) return 4;
  if (/energie moyenne|moyennement|bof|ca va\b/.test(t)) return 3;
  return null;
}

const GERMAN_TOPICS: { re: RegExp; topic: string; objective: string }[] = [
  { re: /vocabulaire|mots/, topic: "VOCAB", objective: "Apprendre 10 mots professionnels" },
  { re: /grammaire|verbes?|prepositions?|declinaison/, topic: "GRAMMAR", objective: "Réviser les verbes avec prépositions" },
  { re: /simulation|entretien/, topic: "INTERVIEW", objective: "Faire une simulation d'entretien" },
  { re: /oral|parler|expression orale/, topic: "SPEAKING", objective: "Pratiquer l'expression orale à voix haute" },
  { re: /ecoute|comprehension|podcast/, topic: "LISTENING", objective: "Écouter un extrait et résumer" },
  { re: /redaction|ecrire|reponse ecrite/, topic: "WRITING", objective: "Rédiger une réponse professionnelle" },
  { re: /erreurs?/, topic: "ERRORS", objective: "Réviser mes erreurs de grammaire" },
  { re: /expressions?/, topic: "EXPRESSIONS", objective: "Apprendre 5 expressions utiles pour l'entretien" },
];

function cleanTitle(raw: string): string {
  return raw
    .replace(/^(je dois|il faut que je|je veux|j'aimerais|ajoute|ajouter|planifie|programme|note)\s+/i, "")
    .replace(/\b(demain|aujourd'hui|apr[eè]s-demain|ce soir|cette semaine)\b/gi, "")
    .replace(/\b(à|a|vers)\s+\d{1,2}\s*h\s*\d{0,2}/gi, "")
    .replace(/\bpendant\s+\S+\s+(minutes?|heures?)/gi, "")
    .replace(/[.,!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function parseMessage(message: string, ctx: ParseContext): ParseResult {
  const t = normalize(message);
  const date = parseDateExpr(message, ctx.today);
  const time = parseTimeExpr(message);
  const duration = parseDurationExpr(message);

  // 1. Nouvelle catégorie
  const cat = message.match(/cat[ée]gorie\s+(?:appel[ée]e|nomm[ée]e|intitul[ée]e)?\s*[«"']?\s*([^»"'.!?]+)/i);
  if (/(ajoute|cree|creer|nouvelle)/.test(t) && cat) {
    const name = cat[1].trim().replace(/^./, (c) => c.toUpperCase());
    return {
      understood: true,
      reply: `Je propose de créer la catégorie « ${name} ». Tu pourras ensuite choisir sa couleur et son icône.`,
      actions: [{ type: "create_category", data: { name } }],
    };
  }

  // 2. Suppression (toujours avec confirmation)
  if (/\b(supprime|supprimer|efface|effacer|retire|enleve)\b/.test(t)) {
    const refersToLast = /(cette|cet|la derniere|celle-ci|ca)\b/.test(t);
    if (refersToLast && ctx.lastActivityId) {
      return {
        understood: true,
        reply: "Je peux supprimer l'activité dont nous venons de parler. Confirme-tu la suppression ?",
        actions: [{ type: "delete_activity", data: { activityId: ctx.lastActivityId, occurrenceDate: ctx.lastActivityDate ?? undefined } }],
      };
    }
    const query = message
      .replace(/.*?\b(supprime|supprimer|efface|effacer|retire|enl[eè]ve)\b\s*/i, "")
      .replace(/^(l'activit[ée]|l'|le |la |les |mon |ma |activit[ée])\s*/i, "")
      .replace(/[.!?]+$/, "")
      .trim();
    if (!query || /^(cette|cet|ca|celle-ci)/i.test(query)) {
      return {
        understood: false,
        reply: "De quelle activité s'agit-il ? Donne-moi son nom (par exemple « supprime le sport de jeudi ») ou supprime-la depuis le planning.",
        actions: [],
      };
    }
    return {
      understood: true,
      reply: `Je vais chercher l'activité « ${query} » et te demander confirmation avant de la supprimer.`,
      actions: [{ type: "delete_activity", data: { query, occurrenceDate: date ?? undefined } }],
    };
  }

  // 3. Report
  if (/\b(reporte|reporter|decale|decaler|repousse)\b/.test(t)) {
    const query = message.replace(/.*?\b(reporte|reporter|d[ée]cale|d[ée]caler|repousse)\b\s*/i, "").replace(/[.!?]+$/, "").trim();
    if (/(cette|cet|ca)\b/.test(t) && ctx.lastActivityId) {
      return {
        understood: true,
        reply: "Je propose de reporter cette activité au lendemain.",
        actions: [{ type: "postpone_activity", data: { activityId: ctx.lastActivityId, occurrenceDate: ctx.lastActivityDate ?? undefined } }],
      };
    }
    return {
      understood: !!query,
      reply: query ? `Je propose de reporter « ${query} » au lendemain.` : "Quelle activité veux-tu reporter ?",
      actions: query ? [{ type: "postpone_activity", data: { query, occurrenceDate: date ?? undefined } }] : [],
    };
  }

  // 4. Organisation de la journée
  if (/organise|planifie ma journee|organiser ma journee|programme de la journee|journee legere/.test(t)) {
    const light = /legere|leger|minimal/.test(t);
    return {
      understood: true,
      reply: light ? "Je prépare un programme minimal et réaliste." : "Je prépare une proposition de planning — tu pourras tout modifier.",
      actions: [{ type: "plan_day", data: { date: date ?? ctx.today, light } }],
    };
  }

  // 5. Énergie
  const energy = parseEnergy(message);
  if (energy !== null && /(je suis|je me sens|suis|me sens|energie|forme)/.test(t)) {
    const reply =
      energy <= 2
        ? "Merci de me le dire. Je note ton énergie et je te propose une journée allégée : on garde l'essentiel, le reste peut attendre."
        : energy >= 4
          ? "Super ! Je note ta belle énergie. Je peux te proposer un planning avec plus de travail concentré."
          : "C'est noté. Je garde un rythme équilibré pour aujourd'hui.";
    return {
      understood: true,
      reply,
      actions: [
        { type: "set_energy", data: { energy, date: ctx.today } },
        { type: "plan_day", data: { date: ctx.today, light: energy === 1 } },
      ],
    };
  }

  const rule = inferCategory(message);

  // 6. Objectif hebdomadaire (« trois heures sur mon projet cette semaine »)
  if (/cette semaine|dans la semaine|par semaine/.test(t) && duration) {
    const kind = rule?.kind ?? "other";
    return {
      understood: true,
      reply: `Je vais chercher des créneaux libres cette semaine pour ${Math.round((duration / 60) * 10) / 10} h de « ${rule?.title ?? "travail"} », en blocs de 1 h maximum, sans toucher à tes rendez-vous fixes.`,
      actions: [{ type: "weekly_goal", data: { title: rule?.title ?? cleanTitle(message), categoryKind: kind, totalMinutes: duration, weekOf: ctx.today } }],
    };
  }

  // 7. Préparation de cours
  if (rule?.kind === "prep") {
    const subject = parseSubject(message);
    const student = message.match(/pour\s+([A-ZÀ-Ý][\wÀ-ÿ-]+)/);
    return {
      understood: true,
      reply: `Je propose d'ajouter une préparation de cours${subject ? ` de ${subject.toLowerCase()}` : ""}${student ? ` pour ${student[1]}` : ""}, avec la checklist habituelle. Si une séance est prévue, je la relierai.`,
      actions: [
        {
          type: "prep_lesson",
          data: { subject, studentName: student?.[1], date: date ?? ctx.today, durationMin: duration ?? 60 },
        },
      ],
    };
  }

  // 8. Allemand
  if (rule?.kind === "german") {
    const topic = GERMAN_TOPICS.find((g) => g.re.test(t)) ?? { topic: "VOCAB", objective: "Apprendre 10 mots professionnels" };
    const allowed = [15, 30, 45, 60];
    const d = duration ?? 30;
    const durationMin = allowed.reduce((best, x) => (Math.abs(x - d) < Math.abs(best - d) ? x : best), 30);
    return {
      understood: true,
      reply: `Je propose une session d'allemand de ${durationMin} min${time ? ` à ${formatTime(time)}` : ""} — objectif : ${topic.objective.toLowerCase()}.`,
      actions: [
        { type: "german_session", data: { durationMin, date: date ?? ctx.today, startTime: time ?? undefined, topic: topic.topic, objective: topic.objective } },
      ],
    };
  }

  // 9. Création d'activité générique
  if (rule || time || date) {
    const kind = rule?.kind;
    const subject = parseSubject(message);
    let title = rule?.title ?? cleanTitle(message);
    if (kind === "tutoring" && subject) title = `Cours particulier — ${subject}`;
    const isFixed = !!time && (kind === "tutoring" || kind === "personal" || /rendez-vous|rdv|reunion/.test(t));
    const durationMin = duration ?? (kind === "tutoring" ? 60 : kind === "sport" ? 45 : kind === "leisure" ? 120 : 30);
    return {
      understood: true,
      reply: `Je propose d'ajouter « ${title} »${date ? "" : " aujourd'hui"}${time ? ` à ${formatTime(time)}` : " (sans horaire fixe)"} pour ${durationMin} min.${isFixed ? " Je le marque comme rendez-vous fixe." : ""}`,
      actions: [
        {
          type: "create_activity",
          data: {
            title,
            categoryKind: kind,
            date: date ?? ctx.today,
            startTime: time ?? undefined,
            durationMin,
            isFixed,
            energyCost: kind === "freelance" ? 3 : kind === "rest" || kind === "leisure" ? 1 : 2,
          },
        },
      ],
    };
  }

  return {
    understood: false,
    reply:
      "Je n'ai pas bien compris. Tu peux par exemple écrire : « Demain, j'ai un cours particulier à 17 h », « Je veux réviser l'allemand pendant 30 minutes » ou « Aujourd'hui, je suis très fatiguée ».",
    actions: [],
  };
}
