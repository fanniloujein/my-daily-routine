# Fanni's Education

Plateforme de préparation au **Bac Économie et Gestion** (Tunisie) : cours, fiches PDF, QCM corrigés, suivi de progression, abonnement mensuel et réservation de séances individuelles avec des enseignants vérifiés. Interface en **français** et en **arabe (RTL)**, mobile-first.

> Architecture, schéma de données et jalons : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Stack technique](#stack-technique)
3. [Installation locale](#installation-locale)
4. [Variables d'environnement](#variables-denvironnement)
5. [Comptes de démonstration](#comptes-de-démonstration)
6. [Tests](#tests)
7. [Déploiement](#déploiement)
8. [Paiements](#paiements)
9. [Sécurité](#sécurité)
10. [Structure du projet](#structure-du-projet)
11. [Feuille de route](#feuille-de-route)

---

## Fonctionnalités

### Élève
- Inscription / connexion, profil, choix du niveau.
- Matières du niveau → cours → leçons ; fiches PDF ; QCM.
- **Accès selon l'abonnement** : le contenu premium n'est jamais envoyé sans abonnement actif ; une leçon peut servir d'aperçu gratuit.
- QCM corrigés **côté serveur**, explications, historique, progression par matière.
- Abonnement : choix de l'offre, déclaration du paiement (référence), suivi du statut, renouvellement anticipé sans perte de jours, historique.
- Annuaire des enseignants (filtres matière / mode / ville), profil, tarifs, avis.
- Réservation : matière, mode (en ligne / présentiel), date, créneau libre, prix affiché, message.
- Historique des séances, annulation (≥ 24 h avant si acceptée), avis après la séance.
- Notifications in-app.

### Enseignant
- Inscription → profil **en attente de validation**.
- Profil public : présentation, matières, modes, tarifs, zone, durée de séance.
- Disponibilités hebdomadaires (heure de Tunis), contrôle des chevauchements.
- Réservations : accepter (lien visio / lieu), refuser (motif), terminer, annuler.
- Statistiques : demandes, séances à venir / terminées, revenus, note moyenne, avis.
- Proposition de cours et de fiches PDF (brouillons publiés après relecture admin).

### Administrateur
- Vue d'ensemble : élèves, abonnements actifs, MRR estimé, encaissements, réservations, graphiques.
- **Paiements** : vérification manuelle (confirmer / refuser / rembourser), journalisée.
- Abonnements : prolonger, résilier, mise à jour des expirations.
- **Offres & tarifs** configurables (prix, durée, avantages FR/AR, niveau ciblé) — aucun prix codé en dur.
- Utilisateurs (recherche, suspension = révocation immédiate des sessions), validation des enseignants.
- Niveaux & matières (multi-niveaux prêt), cours & leçons, ressources PDF, QCM.
- Suivi des réservations, messages de contact, paramètres (coordonnées, instructions de paiement), journal d'audit.

### Site public
Landing page (hero, fonctionnement, matières, enseignants, avantages, tarifs, témoignages **clairement marqués « démo »**, FAQ, contact), annuaire public des enseignants.

---

## Stack technique

Next.js 15 (App Router, Server Components, Server Actions) · TypeScript · Tailwind CSS 3 · PostgreSQL 14+ · Prisma 6 · Zod · React Hook Form · jose (JWT) · bcryptjs · lucide-react · Vitest.

Aucune bibliothèque d'UI, d'i18n, de dates ou d'authentification tierce.

---

## Installation locale

Prérequis : **Node.js 20+** et **PostgreSQL 14+** (avec l'extension `btree_gist`, incluse dans PostgreSQL standard).

```bash
cd fannis-education
npm install
cp .env.example .env
```

Renseigner `.env` (voir ci-dessous), puis :

```bash
npm run db:deploy
```

```bash
npm run db:seed
```

```bash
npm run dev
```

L'application est disponible sur http://localhost:3000.

Pas de PostgreSQL ? Avec Docker :

```bash
docker run -d --name fannis-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fannis_education -p 5432:5432 postgres:16
```

### Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start:prod` | Applique les migrations puis démarre |
| `npm run db:migrate` | Créer une migration (développement) |
| `npm run db:deploy` | Appliquer les migrations |
| `npm run db:seed` | Données de référence (+ démo si `SEED_DEMO=true`) |
| `npm test` | Tests unitaires (+ intégration si `TEST_DATABASE_URL`) |
| `npm run typecheck` | Vérification TypeScript |

---

## Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | Connexion PostgreSQL |
| `AUTH_SECRET` | oui | Signature des sessions, 32 caractères minimum (`openssl rand -base64 48`) |
| `APP_URL` | oui en prod | URL publique (métadonnées) |
| `CRON_SECRET` | recommandé | Protège `/api/cron/daily` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | pour le seed | Compte administrateur initial (mot de passe ≥ 10 caractères) |
| `SEED_DEMO` | non | `true` pour créer comptes et contenus de démonstration |
| `SHOW_DEMO_ACCOUNTS` | non | `true` pour afficher les identifiants démo sur `/login` en production (à éviter) |
| `TEST_DATABASE_URL` | non | Base **dédiée** aux tests d'intégration (vidée à chaque exécution) |

Aucun secret n'est versionné : `.env` est ignoré par git.

---

## Comptes de démonstration

Créés par `npm run db:seed` avec `SEED_DEMO=true`. **Tous fictifs** — aucune donnée réelle d'élève.

| Rôle | Email | Mot de passe |
|---|---|---|
| Élève | `eleve.demo@fannis-education.test` | `Demo!2026` |
| Enseignante (validée) | `enseignant.demo@fannis-education.test` | `Demo!2026` |
| Enseignant (validé) | `enseignant2.demo@fannis-education.test` | `Demo!2026` |
| Enseignante (en attente) | `enseignant3.demo@fannis-education.test` | `Demo!2026` |
| Administrateur | `SEED_ADMIN_EMAIL` | `SEED_ADMIN_PASSWORD` |

Les cours, fiches et QCM de démonstration portent le badge « Démo » et l'avertissement *« Contenu de démonstration — à vérifier par un enseignant qualifié »*. Ils présentent des notions générales et **ne prétendent pas reproduire le programme officiel ni des sujets d'examen**. Remplacez-les par des contenus rédigés et validés par des enseignants avant le lancement.

---

## Tests

```bash
npm test
```

Avec une base PostgreSQL de test (vidée à chaque exécution — **ne jamais pointer vers la production**) :

```bash
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fannis_test" npm test
```

81 tests :

- **Authentification** : hachage, jetons (falsification de rôle, expiration, mauvais secret), routes protégées par rôle, redirections ouvertes, validation des formulaires, limitation des tentatives.
- **Abonnements** : statut effectif, coupure à l'échéance sans attendre le cron, renouvellement sans perte de jours, transitions de paiement, prix figé, double confirmation concurrente, refus, remboursement.
- **Réservations** : génération des créneaux (fuseau de Tunis, délai de prévenance), machine à états, règle des 24 h, **demandes simultanées sur un même créneau (une seule acceptée)**, contrainte d'exclusion en base, avis unique.
- **Divers** : correction des QCM (réponses malveillantes), montants en millimes, dates, complétude du dictionnaire arabe.

La CI (`.github/workflows/fannis-education.yml`) lance typecheck, tests (avec PostgreSQL) et build à chaque push touchant `fannis-education/`.

---

## Déploiement

L'application est un serveur Node.js unique + une base PostgreSQL. Les fichiers PDF sont stockés en base : aucun disque persistant n'est requis.

### Render / Railway / Fly.io (recommandé)

1. Créer une base PostgreSQL managée et récupérer son URL.
2. Créer un service web Node depuis ce dépôt, **répertoire racine `fannis-education`**.
3. Build : `npm ci && npm run build` — Start : `npm run start:prod` (applique les migrations).
4. Variables : `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `CRON_SECRET`, `NODE_ENV=production`.
5. Une fois déployé, lancer une fois le seed depuis le shell du service (sans `SEED_DEMO` en production) :
   `SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run db:seed`
6. Vérifier `GET /api/health` → `{"ok":true,"db":"up"}`.

### Docker / VPS

```bash
docker build -t fannis-education .
```

```bash
docker run -p 3000:3000 -e DATABASE_URL=... -e AUTH_SECRET=... -e APP_URL=https://... -e CRON_SECRET=... fannis-education
```

Placer un reverse proxy HTTPS (Caddy, Nginx) devant : le cookie de session est `Secure` en production.

### Tâche quotidienne

Appeler une fois par jour (cron de l'hébergeur, GitHub Actions, etc.) :

```bash
curl -X POST https://VOTRE-DOMAINE/api/cron/daily -H "Authorization: Bearer $CRON_SECRET"
```

Elle passe en « expiré » les abonnements échus (avec notification) et envoie un rappel 3 jours avant l'échéance. **L'accès premium ne dépend pas de cette tâche** : il est recalculé à chaque requête.

---

## Paiements

- **MVP : vérification manuelle.** L'élève déclare son paiement (moyen + référence) ; un administrateur le confirme dans *Admin → Paiements*, ce qui active l'abonnement dans la même transaction. Rien n'est jamais confirmé automatiquement et aucune fausse confirmation n'est générée.
- Moyens acceptés et instructions (RIB, compte postal, portefeuille mobile…) : *Admin → Paramètres*.
- Les séances individuelles sont **séparées de l'abonnement** ; leur prix est fixé par chaque enseignant et réglé directement avec lui au MVP (le modèle `Payment` gère déjà l'objet `BOOKING`).
- **Passerelle en ligne** : l'interface `PaymentProvider` (`src/server/payments/provider.ts`) décrit les étapes pour brancher une passerelle tunisienne (création de paiement, webhook signé, contrôle du montant avant confirmation).

---

## Sécurité

- Mots de passe **bcrypt** (coût 12) ; temps de réponse constant si l'email n'existe pas.
- Session **JWT HS256** dans un cookie `httpOnly`, `SameSite=Lax`, `Secure` en production, 7 jours.
- Double contrôle d'accès : middleware (rôle par préfixe) **et** relecture de l'utilisateur en base dans chaque layout/action (`requireUser`) ; suspension ou changement de mot de passe → `sessionVersion` incrémentée → sessions révoquées.
- Toutes les mutations passent par des Server Actions validées par **Zod côté serveur** (protection CSRF intégrée de Next.js).
- Prix, créneaux, droits d'accès et scores **calculés côté serveur** ; les bonnes réponses des QCM ne sont jamais envoyées avant correction.
- Téléchargement PDF via une route qui revérifie l'abonnement à chaque appel ; fichiers contrôlés (taille ≤ 10 Mo, signature `%PDF-`).
- Contrainte d'exclusion PostgreSQL contre les doubles réservations ; transitions conditionnelles (pas de double traitement).
- Limitation des tentatives de connexion / inscription / contact (en mémoire — passer à Redis en multi-instances).
- Journal d'audit des actions sensibles (paiements, offres, suspensions, publications).
- En-têtes : `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

---

## Structure du projet

```
prisma/
  schema.prisma          modèle de données
  migrations/            migrations SQL (dont la contrainte anti-chevauchement)
  seed.ts                données de référence + démo
src/
  app/
    (public)/            landing, annuaire enseignants
    (auth)/              connexion, inscriptions
    student/ teacher/ admin/   espaces par rôle
    api/                 téléchargement protégé, cron, health
  actions/               Server Actions (auth, élève, enseignant, admin, contenu)
  server/                services métier (abonnements, réservations, QCM, stockage…)
  lib/
    domain/              règles pures testées (abonnement, réservation, QCM)
    validation/          schémas Zod partagés client/serveur
    auth/  i18n/         sessions, dictionnaires FR/AR
  components/            UI réutilisable (+ client/ pour les composants interactifs)
tests/                   unitaires + intégration
```

### Ajouter un niveau ou une matière

*Admin → Niveaux & matières* : créer le niveau (ex. « Bac Mathématiques »), ses matières, puis éventuellement une offre dédiée (*Offres & tarifs → Niveau concerné*). Aucune modification de code n'est nécessaire.

### Ajouter une langue

Créer `src/lib/i18n/dictionaries/<code>/` sur le modèle de `ar/` (le typage impose toutes les clés), puis l'ajouter à `LOCALES` dans `src/lib/i18n/config.ts`.

---

## Feuille de route

| Phase | Contenu | État |
|---|---|---|
| 1 | Landing, inscription, tableau de bord élève, matières, cours & PDF, contrôle d'accès, validation manuelle des paiements, admin | ✅ |
| 2 | Profils enseignants, validation, disponibilités, réservations en ligne / présentiel, tableau de bord enseignant, avis | ✅ |
| 3 | QCM ✅ · progression ✅ · notifications in-app ✅ · rapports admin de base ✅ · paiement en ligne ⏳ · emails/SMS ⏳ · examens chronométrés ⏳ · exports ⏳ | partiel |

À prévoir avant un lancement public : conditions d'utilisation et politique de confidentialité rédigées par un juriste, réinitialisation du mot de passe par email (nécessite un fournisseur d'email), contenus pédagogiques réels validés par des enseignants.
