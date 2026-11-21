// Libellés et référentiels partagés (client + serveur).

export const SESSION_STATUS = {
  PLANNED: { label: "Prévue", tone: "info" },
  DONE: { label: "Effectuée", tone: "success" },
  CANCELLED: { label: "Annulée", tone: "muted" },
  POSTPONED: { label: "Reportée", tone: "warning" },
  STUDENT_ABSENT: { label: "Absence de l'élève", tone: "danger" },
  TEACHER_ABSENT: { label: "Absence de l'enseignante", tone: "warning" },
} as const;
export type SessionStatusKey = keyof typeof SESSION_STATUS;

export const PAYMENT_METHODS = { CASH: "Espèces", TRANSFER: "Virement bancaire", OTHER: "Autre" } as const;

export const PAYMENT_KINDS = { PAYMENT: "Paiement", ADVANCE: "Avance", DISCOUNT: "Remise" } as const;

export const TX_TYPES: Record<string, { label: string; tone: string; sign: 1 | -1 | 0 }> = {
  ADVANCE_RECEIVED: { label: "Avance reçue", tone: "success", sign: 1 },
  PAYMENT_RECEIVED: { label: "Paiement reçu", tone: "success", sign: 1 },
  DISCOUNT: { label: "Remise accordée", tone: "info", sign: 1 },
  SESSION_BILLED: { label: "Séance facturée", tone: "warning", sign: -1 },
  PACKAGE_BILLED: { label: "Forfait facturé", tone: "warning", sign: -1 },
  ADJUSTMENT: { label: "Correction (frais)", tone: "warning", sign: -1 },
  CREDIT_USED: { label: "Crédit utilisé", tone: "info", sign: 0 },
  REFUND: { label: "Remboursement", tone: "danger", sign: -1 },
  INVOICE_VOIDED: { label: "Annulation de facture", tone: "muted", sign: 1 },
  PAYMENT_VOIDED: { label: "Annulation de versement", tone: "muted", sign: -1 },
  REFUND_VOIDED: { label: "Annulation de remboursement", tone: "muted", sign: 1 },
};

export const LEVEL_CYCLES = { PRIMARY: "Primaire", MIDDLE: "Collège", SECONDARY: "Lycée", OTHER: "Autres" } as const;

export const DEFAULT_LEVELS: { name: string; cycle: keyof typeof LEVEL_CYCLES }[] = [
  ...["1ère", "2ème", "3ème", "4ème", "5ème", "6ème"].map((n) => ({ name: `${n} année`, cycle: "PRIMARY" as const })),
  ...["7ème", "8ème", "9ème"].map((n) => ({ name: `${n} année`, cycle: "MIDDLE" as const })),
  { name: "2ème année Économie", cycle: "SECONDARY" },
  { name: "3ème année Économie", cycle: "SECONDARY" },
  { name: "3ème année Informatique", cycle: "SECONDARY" },
  { name: "Bac Économie et Gestion", cycle: "SECONDARY" },
];

export const DEFAULT_SUBJECTS: { name: string; color: string }[] = [
  { name: "Mathématiques", color: "#8fb8e8" },
  { name: "Physique", color: "#a8c7f0" },
  { name: "Sciences", color: "#9fd8b4" },
  { name: "Technologie", color: "#c7b8ea" },
  { name: "Informatique", color: "#7fc8d8" },
  { name: "Algorithmique", color: "#9ab0e6" },
  { name: "Économie", color: "#f3d77a" },
  { name: "Gestion", color: "#f0c08a" },
  { name: "Bureautique", color: "#b8d4a0" },
  { name: "Français", color: "#f0a8b8" },
  { name: "Anglais", color: "#e8b4d8" },
];

export const TASK_CATEGORIES = {
  PREP: "Préparation des cours",
  CORRECTION: "Correction",
  STUDENTS: "Gestion des élèves",
  ADMIN: "Administration",
  PRO_DEV: "Développement professionnel",
  PERSONAL: "Projets personnels",
  SPORT: "Sport",
  REST: "Repos",
  OTHER: "Autres",
} as const;

export const TASK_STATUS = { TODO: "À faire", IN_PROGRESS: "En cours", DONE: "Terminée", POSTPONED: "Reportée" } as const;
export const PRIORITIES = { LOW: "Basse", MEDIUM: "Moyenne", HIGH: "Haute", URGENT: "Urgente" } as const;

export const HOMEWORK_TYPES = {
  TO_PREPARE: "Devoir à préparer",
  TO_CORRECT: "Exercices à corriger",
  TO_PRINT: "Série à imprimer",
  REVISION: "Révision",
  MOCK_EXAM: "Examen blanc",
  TO_SUBMIT: "Devoir à rendre",
} as const;

export const TIME_CATEGORIES = {
  TEACHING: { label: "Cours", color: "var(--s1)" },
  PREP: { label: "Préparation", color: "var(--s2)" },
  CORRECTION: { label: "Correction", color: "var(--s3)" },
  ADMIN: { label: "Administratif", color: "var(--s4)" },
  PERSONAL: { label: "Projets personnels", color: "var(--s5)" },
  REST: { label: "Repos", color: "var(--s6)" },
  FREE: { label: "Temps libre", color: "var(--s-other)" },
  OTHER: { label: "Autre", color: "var(--s-other)" },
} as const;

export const PROGRESS_STATUS = { DONE: "Terminé", IN_PROGRESS: "En cours", TO_REVIEW: "À revoir" } as const;
export const ASSESSMENT_KINDS = { HOMEWORK: "Devoir", EXAM: "Examen", MOCK_EXAM: "Examen blanc", QUIZ: "Interrogation" } as const;

export const DOCUMENT_TYPES = {
  PDF: "PDF",
  WORD: "Word",
  EXCEL: "Excel",
  IMAGE: "Image",
  EXERCISE: "Exercices",
  CORRECTION: "Corrections",
  EXAM: "Examens",
  REVISION: "Fiches de révision",
  LINK: "Lien",
  OTHER: "Autre",
} as const;

export const PERSONAL_EVENT_KINDS = { PERSONAL: "Événement personnel", REST: "Période de repos", BREAK: "Pause programmée" } as const;

export const COLORS = ["#8fb8e8", "#a8c7f0", "#9fd8b4", "#c7b8ea", "#7fc8d8", "#f3d77a", "#f0c08a", "#f0a8b8", "#e8b4d8", "#b8d4a0", "#cfd6e4", "#f2a7a0"];
