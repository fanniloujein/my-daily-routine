# Fanni's Tutoring Manager

Application web privée de gestion des cours particuliers pour **une seule enseignante administratrice** : élèves, séances, calendrier, finances (paiements, avances, crédits, dettes, forfaits), préparations pédagogiques, devoirs, suivi, documents, tâches, temps de travail et repos.

Les élèves n'ont pas de compte. Toutes les pages et toutes les API sont protégées.

---

## Démarrage rapide

Il faut **Node.js 20+** et **PostgreSQL 14+**.

```bash
cd tutoring-manager
npm install
cp .env.example .env      # puis renseigner DATABASE_URL et AUTH_SECRET
```

```bash
openssl rand -base64 32   # valeur pour AUTH_SECRET
```

```bash
npm run db:deploy         # crée les tables
npm run dev               # http://localhost:3000
```

Au premier lancement, la page `/setup` crée le compte administratrice. Vous pouvez y cocher **« données de démonstration fictives »** ; elles se suppriment ensuite en un clic (Paramètres → Sauvegarde & données).

PostgreSQL avec Docker :

```bash
docker run -d --name tutoring-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tutoring -p 5432:5432 postgres:16
```

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` puis `npm start` | Production (`npm start` applique les migrations) |
| `npm test` | Tests unitaires (moteur financier, planning) |
| `npm run typecheck` / `npm run lint` | Vérifications |
| `npm run db:migrate` | Nouvelle migration après modification du schéma |

### Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | oui | Connexion PostgreSQL |
| `AUTH_SECRET` | oui | Secret de signature des sessions (≥ 16 caractères) |
| `APP_TIMEZONE` | conseillé | `Africa/Tunis` par défaut |

### Déploiement (Render, Railway, VPS…)

1. Créer une base PostgreSQL.
2. *Build* : `npm install && npm run build` · *Start* : `npm start` (répertoire racine : `tutoring-manager`).
3. Renseigner `DATABASE_URL`, `AUTH_SECRET`, `APP_TIMEZONE=Africa/Tunis`.
4. Servir en HTTPS (le cookie de session est `Secure` en production), puis ouvrir `/setup`.

---

## Modules

| Module | Contenu |
|---|---|
| **Tableau de bord** | Accueil personnalisé et date, 10 indicateurs (élèves, séances du jour/semaine, heures travaillées, séances du mois, revenus encaissés, paiements en attente, avances disponibles, tâches), planning du jour avec créneaux libres, prochains cours, dernières transactions, retards de paiement, préparations à terminer, tâches urgentes, échéances, graphiques des revenus et des heures de cours. |
| **Élèves** | CRUD complet, recherche (nom, téléphone, parent, établissement), filtres, archivage, photo facultative, parent partagé entre frères et sœurs, détection des doublons. Fiche à 9 onglets : informations, planning, séances, suivi pédagogique, documents, historique financier, paiements, avances, solde restant, avec un résumé financier toujours visible. |
| **Matières & niveaux** | Matières (description, niveaux, tarif et durée habituels, couleur) ; niveaux du primaire au bac, personnalisables. |
| **Séances** | Individuelles ou collectives (tarif et absence par élève), 6 statuts, chapitre, objectifs, préparation, compte rendu, préparations rattachées. Récurrence hebdomadaire, duplication, report (avec nouvelle séance), actions groupées, export. |
| **Calendrier** | Vues jour, semaine et mois (FullCalendar), création par clic, déplacement et redimensionnement par glisser-déposer, couleurs par matière, disponibilités, repos et pauses, journées chargées ou surchargées, détection des conflits. |
| **Organiser ma semaine** | Vue globale, charge par jour, conflits, enchaînements sans pause, séances à préparer, créneaux libres (programmer en un clic), élèves à recevoir, revenus prévus, suggestions. |
| **Finances** | Tableau général filtrable (élève, niveau, matière, mois, statut), paiements, avances, remises, remboursements, forfaits mensuels, corrections, reçus PDF numérotés, journal immuable, statistiques (jour, semaine, mois, année, par élève, par matière), exports Excel et PDF. |
| **Préparations** | Matière → niveau → chapitre → leçon : objectifs, explication, exercices avec corrections, liens, documents importés (PDF, Word, images), séances rattachées. |
| **Devoirs** | À préparer, à corriger, à imprimer, révisions, examens blancs, à rendre ; élève, matière, leçon, date limite, note. |
| **Suivi pédagogique** | Chapitres terminés / en cours / à revoir, notes et examens (courbe d'évolution), points forts et faibles, difficultés, objectifs, comptes rendus de séance. |
| **Documents** | Bibliothèque classée (élève, matière, niveau, chapitre, type), recherche rapide, fichiers de 10 Mo maximum stockés en base, ou liens. |
| **Tâches** | Kanban (glisser-déposer) et vue calendrier, 9 catégories, priorités, échéances, heure, durée. |
| **Temps & productivité** | Heures de cours calculées automatiquement, saisie du temps de préparation, de correction, d'administration et de repos, bilans, charge des 7 prochains jours, créneaux libres, pauses programmées. |
| **Notifications** | Cours imminents, séance non préparée, séance reportée à reprogrammer, paiement en attente, crédit presque épuisé ou insuffisant, forfait à renouveler, tâches urgentes, échéances. Personnalisables. |
| **Rapports** | Statistiques pédagogiques, financières et de productivité sur une période choisie ; impression en PDF et exports Excel. |
| **Paramètres** | Profil et coordonnées (pour les reçus), nom de l'application, tarifs et durées par défaut, modes de paiement, horaires, disponibilités, notifications, thème, langue, mot de passe, sauvegarde et restauration, démo. |

---

## Règles financières (priorité absolue)

Le moteur est dans `src/lib/finance.ts` (fonctions pures, testées) et `src/server/finance.ts` (base de données).

- **Rien n'est stocké « à la main ».** La situation d'un élève est toujours recalculée à partir des pièces enregistrées : factures (séance effectuée, forfait du mois, correction), versements (paiement, avance, remise) et remboursements, dans l'ordre réel de saisie. Un solde ne peut donc pas devenir incohérent.
- **Affectation :** un versement règle d'abord les séances cochées (paiement groupé), puis les plus anciennes séances dues. Le reste devient du **crédit**, que chaque nouvelle séance consomme automatiquement.
- **Formules :**
  - Total facturé = Σ factures non annulées.
  - Reste à payer = Total facturé − Σ affectations.
  - Crédit disponible = Σ versements − Σ affectations − Σ remboursements.

  Une avance n'est jamais comptée à la fois comme paiement et comme crédit.
- **Revenus encaissés :** c'est l'argent réellement affecté à une prestation, daté au moment où la séance est à la fois faite et payée. Une avance non consommée **n'est pas** un revenu. Les montants s'affichent séparément : revenus, avances non consommées, créances, remboursés.
- **Facturation automatique :**
  - Une séance « effectuée » est facturée ; une séance annulée, reportée ou marquée « absence de l'enseignante » ne l'est jamais.
  - L'absence de l'élève n'est facturée que si l'option « absence tardive facturable » est cochée.
  - En mode forfait mensuel, les séances ne sont pas facturées à l'unité.
- **Aucune double facturation :** un index unique partiel interdit deux factures actives pour le même élève et la même séance, ou pour le même forfait le même mois. Un versement identique saisi deux fois de suite est refusé.
- **Traçabilité :** on ne supprime jamais une opération. Annuler un versement, une facture ou un remboursement exige un motif. L'élément reste visible (barré) et une écriture est ajoutée au journal, avec le reste dû et le crédit après chaque opération.
- **Fiabilité :**
  - Les montants sont stockés en `Decimal(12,3)` (le dinar compte 1000 millimes) et calculés en millimes entiers.
  - Chaque opération s'exécute dans une transaction PostgreSQL, avec un verrou par élève.
- **Devise** : dinar tunisien (DT) · **Fuseau** : Africa/Tunis.

---

## Architecture

- **Stack :** Next.js 15 (App Router), TypeScript, Tailwind CSS, composants UI dans le style shadcn (`src/components/ui`, avec class-variance-authority et tailwind-merge), icônes Lucide, PostgreSQL et Prisma, validation Zod, Recharts, FullCalendar, jsPDF (reçus et rapports), ExcelJS.
- **Organisation du code :**

```
prisma/schema.prisma      Modèle relationnel + migrations (index partiels anti-double facturation)
src/middleware.ts         Protection de toutes les pages et API
src/lib/                  Logique pure : finance, planning (conflits, créneaux, charge), dates, validation Zod
src/server/               Services : finance, séances, planning, notifications, tableau de bord, rapports, exports, sauvegarde, démo
src/app/api/              API REST (une route par ressource)
src/app/(app)/            Pages de l'application
src/app/(auth)/           Connexion et création du compte
src/components/           Interface (UI, formulaires, graphiques, navigation)
src/i18n/                 Dictionnaires fr (principal), en et ar (préparés, arabe en RTL)
tests/                    Tests Vitest
```

- **Correspondance avec le modèle demandé :**

| Table demandée | Modèle Prisma |
|---|---|
| User, Students, Parents, Subjects, Levels | `User`, `Student`, `Parent`, `Subject`, `Level` |
| Sessions | `Session` et `SessionParticipant` |
| SessionStatus | enum `SessionStatus` |
| Invoices, Payments | `Invoice`, `Payment` |
| Advances | `Payment` de type `ADVANCE`, pour des affectations uniformes et sans double comptage |
| Remboursements | `Refund` |
| FinancialTransactions | `FinancialTransaction` |
| Packages | `Package` |
| Lessons, Chapters, Exercises | `Lesson`, `Chapter`, `Exercise` |
| Homework, StudentProgress | `Homework`, `StudentProgress`, plus `Assessment` pour les notes |
| Tasks, Documents, Notifications | `Task`, `Document`, `Notification` |
| Availability, PersonalEvents | `Availability`, `PersonalEvent`, plus `TimeEntry` pour le temps |

---

## Sécurité

- **Compte et connexion :** un compte unique, protégé par un mot de passe hashé avec bcrypt.
- **Sessions :** jeton JWT signé dans un cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production, valable 14 jours. Changer le mot de passe révoque toutes les autres sessions.
- **Attaques par force brute :** les tentatives de connexion sont limitées.
- **Validation :** Zod côté serveur, sur toutes les entrées.
- **Navigateur et moteurs de recherche :** en-têtes de sécurité, pages non indexées.
- **Documents :** types de fichiers contrôlés à l'import.

## Tests

`npm test` lance 25 tests unitaires : cas d'avance du cahier des charges, paiements partiels, paiement groupé, crédit insuffisant, annulations, remboursements, remises, identité comptable, statuts facturables, conflits, créneaux libres, récurrences et charge de travail.

Un parcours complet a aussi été vérifié contre le serveur de production :
- règles de facturation et absence de double facturation ;
- annulations tracées, forfaits, conflits ;
- révocation des sessions ;
- interface : formulaires, paiement groupé, reçu, mode sombre, mobile.

## Limites connues

- Les notifications sont internes à l'application (pas d'envoi par e-mail ni de push quand l'application est fermée).
- Les traductions anglaise et arabe ne couvrent pour l'instant que la navigation.
- Modifier une répétition d'un événement personnel hebdomadaire modifie toute la série.
