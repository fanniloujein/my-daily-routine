// Libellés et catégories par défaut (français). Les traductions vivent dans src/i18n.

export const DEFAULT_CATEGORIES = [
  { kind: "tutoring", name: "Cours particuliers", color: "#5b8def", icon: "graduation-cap", balance: "work", reminderMinutes: 60 },
  { kind: "prep", name: "Préparation des cours", color: "#7f9cf5", icon: "notebook-pen", balance: "work", reminderMinutes: 15 },
  { kind: "freelance", name: "Développement web freelance", color: "#1e3a8a", icon: "code", balance: "work", reminderMinutes: 10 },
  { kind: "german", name: "Allemand et entretiens", color: "#9b87f5", icon: "languages", balance: "work", reminderMinutes: 10 },
  { kind: "sport", name: "Sport", color: "#4fb3a9", icon: "dumbbell", balance: "health", reminderMinutes: 30 },
  { kind: "meds", name: "Médicaments", color: "#f0a35e", icon: "pill", balance: "health", reminderMinutes: 0 },
  { kind: "rest", name: "Repos", color: "#a7c4e5", icon: "moon", balance: "rest", reminderMinutes: null },
  { kind: "leisure", name: "Films et séries", color: "#c4a7e7", icon: "clapperboard", balance: "rest", reminderMinutes: 15 },
  { kind: "personal", name: "Vie personnelle", color: "#e3a0c0", icon: "heart", balance: "personal", reminderMinutes: 30 },
  { kind: "admin", name: "Administratif", color: "#8a94a6", icon: "file-text", balance: "work", reminderMinutes: 30 },
  { kind: "learning", name: "Apprentissage", color: "#6cc4e0", icon: "book-open", balance: "work", reminderMinutes: 10 },
  { kind: "other", name: "Autres", color: "#b0b8c8", icon: "tag", balance: "personal", reminderMinutes: null },
] as const;

export const PRIORITY_LABELS: Record<number, string> = { 1: "Basse", 2: "Normale", 3: "Haute", 4: "Urgente" };
export const STATUS_LABELS: Record<string, string> = { TODO: "À faire", IN_PROGRESS: "En cours", DONE: "Terminée", POSTPONED: "Reportée" };
export const ENERGY_LABELS: Record<number, string> = {
  1: "Énergie très faible",
  2: "Énergie faible",
  3: "Énergie moyenne",
  4: "Bonne énergie",
  5: "Excellente énergie",
};
export const ENERGY_EMOJI: Record<number, string> = { 1: "🪫", 2: "🌧️", 3: "⛅", 4: "🌤️", 5: "☀️" };
export const MOOD_LABELS: Record<number, string> = { 1: "Triste", 2: "Bof", 3: "Neutre", 4: "Bien", 5: "Très bien" };
export const STRESS_LABELS: Record<number, string> = { 1: "Très calme", 2: "Calme", 3: "Modéré", 4: "Stressée", 5: "Très stressée" };
export const ENERGY_COST_LABELS: Record<number, string> = { 1: "Légère", 2: "Moyenne", 3: "Exigeante" };

export const GERMAN_TOPICS: Record<string, string> = {
  VOCAB: "Vocabulaire professionnel",
  GRAMMAR: "Grammaire",
  EXPRESSIONS: "Expressions d'entretien",
  INTERVIEW: "Simulation d'entretien",
  LISTENING: "Compréhension orale",
  SPEAKING: "Expression orale",
  WRITING: "Rédaction",
  ERRORS: "Révision des erreurs",
};

export const GERMAN_OBJECTIVES: Record<string, string[]> = {
  VOCAB: ["Apprendre 10 mots professionnels", "Réviser les cartes du jour"],
  GRAMMAR: ["Réviser les verbes avec les prépositions", "Revoir la déclinaison de l'adjectif", "Pratiquer les subordonnées (weil, dass, obwohl)"],
  EXPRESSIONS: ["Apprendre 5 expressions utiles pour l'entretien"],
  INTERVIEW: ["Faire une simulation d'entretien", "Préparer une réponse à « Erzählen Sie etwas über sich »", "Préparer « Warum möchten Sie bei uns arbeiten? »"],
  LISTENING: ["Écouter un podcast professionnel et résumer", "Regarder une vidéo d'entretien et noter les expressions"],
  SPEAKING: ["S'enregistrer 3 minutes sur son parcours", "Décrire un projet à voix haute"],
  WRITING: ["Rédiger une réponse professionnelle", "Écrire un e-mail de motivation court"],
  ERRORS: ["Réviser mes erreurs de grammaire", "Refaire les phrases corrigées"],
};

export const PREP_CHECKLIST = [
  "Relire le programme",
  "Préparer une fiche de cours",
  "Préparer des exemples simples",
  "Préparer des exercices",
  "Préparer les corrections",
  "Vérifier le matériel nécessaire",
];

export const WEB_PROJECT_TEMPLATE: { title: string; estimateMin: number }[] = [
  { title: "Analyser les besoins", estimateMin: 120 },
  { title: "Concevoir l'interface", estimateMin: 240 },
  { title: "Développer le frontend", estimateMin: 600 },
  { title: "Développer le backend", estimateMin: 600 },
  { title: "Tester les fonctionnalités", estimateMin: 180 },
  { title: "Corriger les bugs", estimateMin: 180 },
  { title: "Déployer le projet", estimateMin: 90 },
];

export const PROJECT_STATUS_LABELS: Record<string, string> = { PROSPECT: "Prospect", ACTIVE: "En cours", ON_HOLD: "En pause", DONE: "Terminé" };
export const TASK_STATUS_LABELS: Record<string, string> = { TODO: "À faire", IN_PROGRESS: "En cours", WAITING: "En attente", DONE: "Terminé" };
export const MEDIA_STATUS_LABELS: Record<string, string> = { TO_WATCH: "À voir", WATCHING: "En cours", DONE: "Terminé" };

export const CATEGORY_ICONS = [
  "graduation-cap", "notebook-pen", "code", "languages", "dumbbell", "pill", "moon", "clapperboard", "heart", "file-text",
  "book-open", "tag", "briefcase", "home", "music", "palette", "plane", "shopping-cart", "users", "sparkles", "coffee", "leaf",
];

export const COLOR_PALETTE = [
  "#5b8def", "#7f9cf5", "#1e3a8a", "#9b87f5", "#c4a7e7", "#4fb3a9", "#7ccf9b", "#f0a35e", "#e3a0c0", "#a7c4e5", "#6cc4e0", "#8a94a6",
];
