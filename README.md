# My Life OS

Application web personnelle pour organiser toute ta vie : planning, cours particuliers, projets freelance, allemand, médicaments, énergie, sport et loisirs. Elle sert d'assistante personnelle : elle comprend tes priorités et adapte tes journées à ton niveau d'énergie, **sans jamais culpabiliser**.

> Autres noms possibles : **Équilibre**, **Lumen**, **Ma Boussole**, **Rythme**, **Oria**, **Sérénité OS**, **DayCompass**, **Halo Planner**.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Démarrage rapide (local)](#démarrage-rapide-local)
3. [Variables d'environnement](#variables-denvironnement)
4. [Déploiement](#déploiement)
5. [Architecture](#architecture)
6. [Rappels : limites réelles et solution fiable](#rappels--limites-réelles-et-solution-fiable)
7. [Assistant IA : configuration](#assistant-ia--configuration)
8. [Sécurité et données personnelles](#sécurité-et-données-personnelles)
9. [Tests](#tests)
10. [Ce qui demande une configuration externe](#ce-qui-demande-une-configuration-externe)

---

## Fonctionnalités

| Module | Ce qu'il permet |
|---|---|
| **Tableau de bord** | Date, message d'accueil, check-in d'énergie du matin (humeur et stress facultatifs), 3 priorités, planning du jour, prochaines activités, médicaments (noms masqués par défaut), prochaines séances de cours et leur préparation, urgences freelance, allemand, prochain entraînement, temps libre, progression du jour. Boutons **« Organiser ma journée »** et **« Mode journée légère »**. |
| **Planning** | Vues Jour (frise horaire), Semaine (glisser-déposer entre les jours), Mois, Liste (filtres) et Urgent (en retard + échéances). Ajout, modification, suppression (occurrence / suivantes / série), duplication, déplacement, report en un clic, activités sans horaire, récurrences (quotidienne, hebdomadaire, personnalisée, intervalle, date de fin), rappels configurables, **détection de conflits** avec proposition du prochain créneau libre réel. |
| **Organiser ma journée** | Planificateur : les rendez-vous fixes ne bougent jamais, les tâches flexibles sont classées (priorité, échéance, énergie), découpées en étapes et placées avec des pauses. Énergie faible : on garde l'urgent, on reporte le reste, on ajoute du repos et on conserve une petite tâche réaliste. Bonne énergie : plus de travail concentré + suggestions d'allemand et de sport selon les objectifs. La proposition est **modifiable** (heures, blocs retirés, reports) avant application. |
| **Cours particuliers** | Élèves (niveau, matières, objectifs, notes, archivage), séances (unique ou hebdomadaire), matière et chapitre, **checklist de préparation** en 6 étapes, ressources (cours, fiches, exercices, documents, liens), temps de préparation configurable **réservé automatiquement avant la séance**, alerte « risque de ne pas être prête », remarques après séance, planification des révisions. |
| **Projets freelance** | Client, projet, description, date limite, budget, statut, priorité, prochaine action, notes, liens, réunions et livrables, tâches avec temps estimé / passé, **Kanban** (À faire, En cours, En attente, Terminé — glisser-déposer), modèle « site web » en 7 étapes, **réservation de créneaux de développement** (le temps passé est ajouté quand le créneau est terminé). |
| **Allemand (B1 → entretiens)** | Sessions de 15/30/45/60 min avec objectif concret (vocabulaire, grammaire, expressions, simulation d'entretien, oral, écoute, rédaction, erreurs), **répétition espacée** (cartes, algorithme type SM-2), progrès hebdomadaires et sujets à retravailler. |
| **Santé & médicaments** | Nom, posologie et consignes **telles que prescrites** (chiffrées en base), horaires, fréquence, période, rappel à l'heure ou avant, confirmation « pris / manqué », historique 14 jours. Détection des consignes ambiguës → invitation à vérifier l'ordonnance. Aucune recommandation, aucune modification de traitement. |
| **Sport** | Objectifs (séances et minutes par semaine, activités préférées, jours disponibles, durée, heure préférée), calendrier, historique, report au prochain jour disponible, suivi hebdomadaire. |
| **Loisirs** | Films et séries (genre, durée, à voir / en cours / terminé, coups de cœur, notes), planification d'une soirée cinéma, liste d'activités relaxantes, **« Que puis-je faire maintenant ? »** selon le temps réellement libre et l'énergie. |
| **Assistant** | Conversation en langage naturel → actions proposées, **confirmées avant exécution** (suppressions en rouge). Conflits détectés avec créneau alternatif. Fonctionne sans IA externe (analyseur local) ; Claude en option. |
| **Catégories** | Créer, renommer, couleur, icône, rappel par défaut, nature (travail / repos / santé / personnel), réordonner (glisser ou flèches), supprimer avec **réaffectation obligatoire** des activités. |
| **Statistiques & bilan** | Activités terminées, temps par catégorie, séances de cours et préparation, avancement des projets, allemand, sport, reports, équilibre travail / repos, énergie. Bilan hebdomadaire bienveillant : accomplissements, projets, objectifs, reports, priorités, suggestions, ressenti personnel. |
| **Paramètres** | Rythme (début/fin de journée, fin du travail, pauses, déjeuner, objectif d'allemand), confidentialité, notifications, abonnement calendrier, export/restauration JSON, données de démonstration, mot de passe, langue. |

Interface : française par défaut, responsive (ordinateur, tablette, téléphone avec navigation basse), thème clair / sombre / automatique, installable comme application (PWA), bouton flottant « + » (activité, tâche rapide, rappel, séance, projet, session d'allemand, médicament).

---

## Démarrage rapide (local)

Prérequis : **Node.js 20+** et **PostgreSQL 14+**.

```bash
# 1. Dépendances
npm install

# 2. Configuration
cp .env.example .env
# puis remplir DATABASE_URL, et générer les secrets :
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → DATA_ENCRYPTION_KEY

# 3. Base de données (crée les tables)
npm run db:deploy

# 4. Lancer
npm run dev          # http://localhost:3000
```

Au premier lancement, la page `/setup` crée ton compte. Tu peux cocher « Ajouter des données de démonstration » (supprimables ensuite dans **Paramètres → Mes données**).

Pas de PostgreSQL installé ? Avec Docker :

```bash
docker run -d --name mylifeos-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mylifeos -p 5432:5432 postgres:16
```

### Scripts utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm test` | Tests unitaires (Vitest) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm run db:deploy` | Applique les migrations Prisma |
| `npm run db:migrate` | Crée une migration après modification de `prisma/schema.prisma` |
| `npm run db:studio` | Explorateur de base Prisma Studio |

---

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | oui | Connexion PostgreSQL |
| `AUTH_SECRET` | oui | Secret de signature des sessions (≥ 16 caractères, idéalement `openssl rand -base64 32`) |
| `DATA_ENCRYPTION_KEY` | oui | Clé de chiffrement des données de santé (idéalement `openssl rand -base64 32` ; toute valeur aléatoire d'au moins 16 caractères fonctionne, par ex. le bouton « Generate » de Render). **À sauvegarder** : sans elle, les médicaments enregistrés deviennent illisibles. |
| `APP_TIMEZONE` | recommandé | Ton fuseau (ex. `Europe/Paris`). Les serveurs d'hébergement tournent souvent en UTC : cette variable garantit que « aujourd'hui » et « maintenant » correspondent à ton heure. |
| `ANTHROPIC_API_KEY` | non | Active la compréhension avancée de l'assistant via Claude |
| `ANTHROPIC_MODEL` | non | Modèle Claude (par défaut `claude-opus-5-5`) |
| `ALLOW_SIGNUP` | non | `false` (défaut) : un seul compte possible ; `true` pour autoriser d'autres inscriptions |

---

## Déploiement

### Option A — Vercel + base PostgreSQL managée (Neon, Supabase, Railway…)

1. Crée une base PostgreSQL et récupère son URL de connexion.
2. Importe le dépôt dans Vercel.
3. Renseigne les variables d'environnement ci-dessus (`APP_TIMEZONE=Europe/Paris` conseillé).
4. Commande de build : `npx prisma migrate deploy && npm run build`.
5. Déploie, puis ouvre `/setup` pour créer ton compte.

### Option B — Render

1. **New → PostgreSQL** : crée la base, puis copie son **Internal Database URL**.
2. **New → Web Service** : connecte le dépôt GitHub, branche à déployer, *Runtime* Node.
3. *Build Command* : `npm install && npm run build`
4. *Start Command* : `npm start` (crée/met à jour les tables automatiquement au démarrage)
5. Onglet **Environment** : `DATABASE_URL` (Internal Database URL), `AUTH_SECRET` (Generate), `DATA_ENCRYPTION_KEY` (Generate), `APP_TIMEZONE=Europe/Paris`, `NODE_VERSION=22`, et facultativement `ANTHROPIC_API_KEY`.
6. Déploie, puis ouvre `https://<ton-service>.onrender.com/setup`.

### Option C — Serveur / VPS (Docker, Railway, Fly.io…)

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start            # port 3000 (variable PORT pour le changer)
```

Place l'application derrière HTTPS (obligatoire pour les notifications et l'installation PWA ; le cookie de session est `Secure` en production).

---

## Architecture

**Choix technique** : Next.js 15 (App Router) + TypeScript + Tailwind CSS + PostgreSQL/Prisma, comme recommandé. Une seule application contient l'interface et l'API (route handlers), ce qui simplifie l'hébergement d'une app personnelle.

```
prisma/
  schema.prisma          Modèle de données (+ migrations)
src/
  middleware.ts          Protection des pages et de l'API (session JWT)
  lib/                   Logique métier pure, testée
    dates.ts             Dates « calendrier » AAAA-MM-JJ / HH:mm sans décalage de fuseau
    recurrence.ts        Développement des récurrences
    conflicts.ts         Chevauchements, créneaux libres, prochain créneau
    planner.ts           Planificateur « Organiser ma journée » selon l'énergie
    nlp.ts               Analyseur local des phrases en français
    srs.ts               Répétition espacée
    meds.ts              Calendrier des prises + détection de consignes ambiguës
    ics.ts               Génération iCalendar avec alarmes
    crypto.ts            Chiffrement AES-256-GCM
    validation.ts        Schémas Zod partagés (formulaires + API)
  server/                Services serveur (Prisma) : occurrences, planning, cours,
                         statistiques, assistant, rappels, sauvegarde, démo…
  app/api/               API REST (une route par ressource)
  app/(app)/             Pages de l'application
  app/(auth)/            Connexion / création du compte
  components/            UI réutilisable (formulaires, planificateur, graphiques…)
  i18n/                  Dictionnaires (fr par défaut, en partiel, de/ar prévus)
tests/                   Tests Vitest
```

### Modèle de données (principaux)

- `Activity` : entité centrale du planning (titre, catégorie, date, horaires, durée, priorité, statut, description, notes, fixe, énergie demandée, échéance, rappels, récurrence). Les modules s'y rattachent (`lessonId`, `projectTaskId`, `germanSessionId`, `sportSessionId`, `mediaItemId`).
- `ActivityException` : modification d'une seule occurrence d'une activité récurrente (terminée, reportée, déplacée, annulée).
- `Category`, `EnergyCheckin`, `Student`, `Lesson`, `PrepItem`, `Resource`, `Project`, `ProjectTask`, `ProjectEvent`, `GermanSession`, `Flashcard`, `FlashcardReview`, `Medication` (champs `*Enc` chiffrés), `MedicationLog`, `SportProfile`, `SportSession`, `MediaItem`, `LeisureIdea`, `WeeklyReview`, `User` (réglages en JSON).
- `isDemo` sur les données de démonstration → suppression en un clic.

**Ajouter une responsabilité** ne demande rien de reconstruire : crée une catégorie (ou demande à l'assistant), puis ajoute des activités. Le planificateur et les statistiques la prennent en compte automatiquement.

**Langues** : `src/i18n/` contient le dictionnaire français et une architecture prête pour l'anglais, l'allemand et l'arabe (direction RTL déclarée). Les libellés de navigation et d'actions passent par ce système ; les textes des pages sont encore écrits directement en français et devront être extraits progressivement pour une traduction complète.

---

## Rappels : limites réelles et solution fiable

Testé dans l'application (bouton « Tester un rappel » dans **Santé** et **Paramètres**) :

- **Dans l'application** : les rappels (activités + médicaments) s'affichent en notification système si tu l'autorises, et toujours en bandeau dans l'app.
- **Limite** : un site web ne peut pas réveiller ton téléphone quand il est fermé. Les rappels du navigateur fonctionnent **uniquement lorsque l'application est ouverte** (onglet, même en arrière-plan, ou application installée). Si l'appareil est en veille, un rappel manqué de moins de 15 min est affiché au retour.
- **Solution fiable recommandée** : **Paramètres → Rappels fiables via ton agenda** crée un lien d'abonnement `.ics` secret. Ajoute-le dans Google Agenda, Calendrier Apple ou Outlook : activités et prises de médicaments y arrivent **avec leurs alarmes**, qui sonnent même téléphone verrouillé. Les noms de médicaments y sont masqués par défaut (« Rappel santé »). Les agendas actualisent un abonnement toutes les quelques heures ; un changement de dernière minute peut donc arriver avec retard.
- Évolution possible : notifications Web Push côté serveur (clés VAPID + tâche planifiée), non incluses car elles nécessitent un service externe d'exécution périodique.

---

## Assistant IA : configuration

- **Sans configuration**, l'assistant utilise un analyseur local en français (dates relatives, heures, durées, catégories, énergie, suppression, nouvelle catégorie, objectifs hebdomadaires…). Toutes les fonctions essentielles restent disponibles.
- **Avec Claude** : ajoute `ANTHROPIC_API_KEY` (clé créée sur console.anthropic.com). Modèle par défaut `claude-opus-5-5` (modifiable avec `ANTHROPIC_MODEL`), réponse en JSON structuré validé par Zod. Le paramètre de *fallback* côté serveur (`fallbacks: "default"`) est activé : si une requête est refusée par un filtre de sécurité, l'API la relance automatiquement sur le modèle de repli recommandé. En cas d'erreur, de délai dépassé ou de réponse invalide, l'assistant **revient automatiquement à l'analyseur local**.
- Dans tous les cas : l'assistant **propose**, tu **confirmes** ; il cherche les créneaux dans ton vrai agenda, n'invente pas de disponibilités, ne déplace jamais un rendez-vous fixe et ne donne aucun conseil médical.

---

## Sécurité et données personnelles

- Compte unique protégé par mot de passe (bcrypt), session JWT signée dans un cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production ; limitation des tentatives de connexion.
- Toutes les routes vérifient que les données appartiennent à l'utilisatrice connectée.
- Données de santé (nom, posologie, consignes) chiffrées en AES-256-GCM ; noms masqués par défaut à l'écran et dans les notifications.
- Export JSON (avec ou sans données de santé) et restauration complète ; lien d'abonnement calendrier révocable.
- En-têtes de sécurité (anti-iframe, nosniff, referrer), pages non indexées.

---

## Tests

```bash
npm test
```

35 tests couvrent la logique essentielle : dates (changements d'heure, années bissextiles), récurrences, conflits et créneaux libres, planificateur (rendez-vous fixes intouchables, absence de chevauchement, énergie faible / très faible / légère / bonne), analyseur de phrases (les 7 exemples du cahier des charges), répétition espacée, calendrier des médicaments et détection d'ambiguïtés, export iCalendar, suggestions « Que puis-je faire maintenant ? ».

Vérifié manuellement sur un serveur de production local et dans un navigateur (ordinateur, mobile 375 px, mode sombre) : création / modification / suppression / duplication / report / déplacement d'activités, conflits, récurrences, application d'un planning, séances et checklists, Kanban et créneaux de développement, médicaments (ambiguïté, chiffrement, prises), répétition espacée, catégories avec réaffectation, export → restauration, abonnement .ics, suppression des données de démo.

---

## Ce qui demande une configuration externe

| Élément | Nécessite |
|---|---|
| Base de données | Un serveur PostgreSQL (local, Docker ou hébergé) |
| Assistant IA avancé | `ANTHROPIC_API_KEY` (facultatif — sinon analyseur local) |
| Rappels application fermée | Abonner son agenda au lien `.ics` (Paramètres) |
| Notifications / installation sur téléphone | Site servi en HTTPS + autorisation du navigateur |
| Heure correcte sur un hébergeur en UTC | `APP_TIMEZONE` |
| Traductions anglais / allemand / arabe | Dictionnaires à compléter dans `src/i18n` |

*My Life OS est un outil d'organisation : il ne remplace pas l'avis d'un professionnel de santé.*
