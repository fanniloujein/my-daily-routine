# Fanni's Education — Architecture

Ce document est la proposition d'architecture validée avant l'implémentation : choix techniques, découpage en modules, schéma de données, règles métier sensibles et jalons de développement.

## 1. Vue d'ensemble

```
Navigateur (FR / AR-RTL, mobile-first)
   │  HTML rendu côté serveur (React Server Components)
   │  + formulaires client (React Hook Form + Zod)
   ▼
Next.js 15 — App Router (un seul déploiement)
   ├── middleware.ts ............ garde des routes privées (JWT + rôle)
   ├── app/(public) ............. landing, connexion, inscription, annuaire
   ├── app/student|teacher|admin  espaces par rôle (layouts qui revérifient en base)
   ├── server actions ........... mutations, toutes validées par Zod côté serveur
   └── route handlers ........... téléchargement PDF protégé, cron, health
   ▼
Couche domaine (src/lib/domain) — logique pure, testée unitairement
   ├── subscription.ts  statut effectif, droit d'accès, calcul des périodes
   ├── booking.ts       créneaux, chevauchements, machine à états
   └── quiz.ts          correction côté serveur
   ▼
Couche services (src/server/*) — orchestration Prisma + transactions
   ▼
PostgreSQL (Prisma ORM, migrations versionnées)
   └── contrainte d'exclusion GiST : aucun chevauchement de réservations actives
```

Principes :

- **Un seul monolithe modulaire** (Next.js) : simple à déployer et à maintenir pour un MVP, chaque module reste isolé (`src/server/<module>`, `src/app/<role>/<module>`) pour pouvoir être extrait plus tard.
- **Le serveur décide de tout ce qui est sensible** : prix, droits d'accès, statut d'abonnement, disponibilité d'un créneau, score d'un quiz. Le client n'envoie que des intentions.
- **Aucun contenu payant n'est sérialisé vers un utilisateur non autorisé** : les leçons premium ne sont pas incluses dans la réponse HTML, les PDF passent par une route qui revérifie l'abonnement à chaque téléchargement, les bonnes réponses des QCM ne quittent jamais le serveur avant la soumission.
- **Prix configurables** : stockés en base en millimes (1 DT = 1000 millimes, entiers, pas d'erreurs d'arrondi). Le plan mensuel à 10 DT est une donnée de seed modifiable par l'administrateur.

## 2. Choix techniques

| Besoin | Choix | Raison |
|---|---|---|
| Framework | Next.js 15 App Router + TypeScript | SSR, server actions, un seul déploiement |
| Style | Tailwind CSS 3 (propriétés logiques `ms-/me-/ps-/pe-`) | RTL natif sans dupliquer les styles |
| Base | PostgreSQL 14+ | contraintes fortes (exclusion GiST), JSON |
| ORM | Prisma 6 | migrations, types générés |
| Validation | Zod (schémas partagés client/serveur) | une seule source de vérité |
| Formulaires | React Hook Form + `@hookform/resolvers/zod` | |
| Auth | Sessions JWT signées (jose) dans un cookie `httpOnly`, mots de passe bcrypt | pas de fournisseur externe ; `sessionVersion` en base pour révoquer toutes les sessions |
| i18n | Dictionnaires typés FR/AR maison, cookie `locale`, `<html dir="rtl">` | aucune dépendance, typage des clés |
| Fichiers | Table `StoredFile` (bytea) derrière une interface de stockage | fonctionne sur tout hébergeur (disque éphémère) ; remplaçable par S3 |
| Tests | Vitest (unitaires + intégration sur une vraie base) | |

Dépendances volontairement limitées : pas de bibliothèque d'UI, pas de NextAuth, pas de bibliothèque i18n, pas de bibliothèque de dates.

## 3. Rôles et contrôle d'accès

| Rôle | Préfixe | Garde |
|---|---|---|
| Visiteur | `/`, `/teachers`, `/login`, `/register` | — |
| Élève | `/student/**` | middleware (JWT + rôle) **et** `requireUser("STUDENT")` dans le layout (relit l'utilisateur en base : statut, `sessionVersion`) |
| Enseignant | `/teacher/**` | idem ; un enseignant non validé voit son espace mais n'apparaît pas dans l'annuaire et ne reçoit pas de réservations |
| Administrateur | `/admin/**` | idem |

Chaque server action rappelle `requireUser(rôle)` : le middleware n'est qu'une première barrière.

## 4. Schéma de données

Le schéma complet est dans `prisma/schema.prisma`. Résumé des entités et relations :

```
User 1─1 StudentProfile ─* EducationalLevel
User 1─1 TeacherProfile ─* TeacherSubject *─ Subject
                        ─* TeacherAvailability
                        ─* Booking
EducationalLevel 1─* Subject 1─* Course 1─* Lesson ─* LessonProgress
                          Subject 1─* EducationalResource ─1 StoredFile
                          Subject 1─* Quiz 1─* Question
                                      Quiz 1─* QuizAttempt *─1 User
SubscriptionPlan 1─* Subscription *─1 User
Subscription 1─* Payment ; Booking 1─* Payment
Booking 1─0..1 Review
User 1─* Notification ; User 1─* AuditLog (acteur)
PlatformSetting (clé/valeur JSON) ; ContactMessage
```

Points notables :

- **Montants** : `Int` en millimes partout (`priceMillimes`, `amountMillimes`), devise `TND`.
- **Instantanés de prix** : `Subscription.priceMillimes` et `Booking.priceMillimes` figent le prix au moment de la demande ; changer un tarif ne modifie pas l'historique.
- **Accès** : `accessLevel` (`FREE` | `PREMIUM`) sur `Course`, `Lesson`, `EducationalResource`, `Quiz`.
- **Publication** : `status` (`DRAFT` | `PUBLISHED` | `ARCHIVED`) — le contenu proposé par un enseignant reste en brouillon jusqu'à publication par un administrateur.
- **Contenu de démonstration** : drapeau `isDemo` affiché dans l'interface (« contenu de démonstration, à vérifier »).
- **Extensibilité** : `EducationalLevel.category` (secondaire, bac, formation…) ; `SubscriptionPlan.levelId` optionnel (plan par niveau plus tard) ; `Payment.provider/providerPaymentId` pour la future passerelle.
- **Index** : sur toutes les clés étrangères utilisées en filtre, `(teacherId, startsAt)`, `(studentId, startsAt)`, `(userId, status)`, `(status, createdAt)`, `(userId, readAt)`…
- **Contraintes uniques** : email, `(levelId, slug)` des matières, `(subjectId, slug)` des cours, `(teacherId, subjectId)`, `(userId, lessonId)`, `bookingId` des avis, `(provider, providerPaymentId)`.
- **Contrainte d'exclusion** (migration SQL) :
  `EXCLUDE USING gist ("teacherId" WITH =, tstzrange("startsAt","endsAt") WITH &&) WHERE (status IN ('PENDING','ACCEPTED'))`
  → même sous forte concurrence, deux réservations actives d'un même enseignant ne peuvent pas se chevaucher.

## 5. Règles métier

### Abonnements

- Statuts stockés : `PENDING_PAYMENT`, `ACTIVE`, `EXPIRED`, `CANCELLED`.
- **Statut effectif** calculé à chaque lecture : un abonnement `ACTIVE` dont `endsAt` est passé est traité comme `EXPIRED`, même si la tâche planifiée n'est pas encore passée. L'accès ne dépend donc jamais d'un cron.
- **Renouvellement** : l'élève crée une nouvelle demande ; lors de la validation, la période commence à la fin de l'abonnement actif en cours (pas de jours perdus) ou maintenant.
- **Paiement manuel (MVP)** : l'élève déclare un paiement (méthode + référence) → `Payment PENDING`. Seul un administrateur peut le confirmer, ce qui active l'abonnement dans la même transaction. Aucune confirmation n'est jamais générée automatiquement.
- **Remboursement** : `Payment REFUNDED` + abonnement `CANCELLED`, journalisé.
- **Passerelle future** : interface `PaymentProvider` (`src/server/payments/provider.ts`) ; le fournisseur `manual` est le seul actif.

### Réservations

- Disponibilités hebdomadaires (jour, minute de début, minute de fin, mode) dans le fuseau `Africa/Tunis`.
- Les créneaux proposés sont recalculés côté serveur au moment de la demande (durée de séance de l'enseignant, délai minimal de prévenance, créneaux déjà pris).
- Le prix vient du profil enseignant (en ligne / présentiel), jamais du client.
- Machine à états :

| De → À | Qui | Condition |
|---|---|---|
| PENDING → ACCEPTED | enseignant | pas de conflit |
| PENDING → REJECTED | enseignant | motif facultatif |
| PENDING → CANCELLED | élève, enseignant, admin | |
| ACCEPTED → CANCELLED | élève (≥ 24 h avant), enseignant, admin | |
| ACCEPTED → COMPLETED | enseignant, admin | après la fin de la séance |

- Un avis (1–5) n'est possible que sur une séance `COMPLETED`, une seule fois.

## 6. Jalons

| Phase | Contenu | État |
|---|---|---|
| **1 — MVP contenu & abonnement** | Landing, inscription élève, tableau de bord élève, niveaux/matières, cours et bibliothèque PDF, contrôle d'accès abonnement, validation manuelle des paiements, tableau de bord admin de base | ✅ implémenté |
| **2 — Accompagnement** | Profils enseignants, validation, disponibilités, réservation en ligne / présentiel, tableau de bord enseignant, avis | ✅ implémenté |
| **3 — Engagement & monétisation** | QCM interactifs ✅, progression ✅, notifications in-app ✅, rapports admin de base ✅ ; restent : passerelle de paiement en ligne, emails/SMS, examens chronométrés avancés, rapports exportables | partiel |

## 7. Évolutions prévues

- Passerelle de paiement tunisienne : implémenter `PaymentProvider` + webhook signé `/api/payments/webhook/<provider>`.
- Stockage objet (S3 compatible) : implémenter l'interface `FileStorage`.
- Emails transactionnels : brancher un fournisseur sur `notify()` (aujourd'hui in-app uniquement).
- Rate limiting distribué (Redis) à la place du limiteur mémoire.
