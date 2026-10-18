# Fanni’stic — plateforme du studio créatif

Site vitrine premium + configurateur de projets + demandes de devis réellement enregistrées + espace client + administration complète.
Français (par défaut), anglais et arabe (RTL complet).

---

## Sommaire

1. [Ce que fait la plateforme](#ce-que-fait-la-plateforme)
2. [Démarrage rapide (local)](#démarrage-rapide-local)
3. [Variables d’environnement](#variables-denvironnement)
4. [Premier administrateur](#premier-administrateur)
5. [Déploiement](#déploiement)
6. [Ce qui reste à connecter](#ce-qui-reste-à-connecter)
7. [Architecture](#architecture)
8. [Sécurité et données personnelles](#sécurité-et-données-personnelles)
9. [Tests](#tests)
10. [Choix de conception](#choix-de-conception)

---

## Ce que fait la plateforme

| Zone | Fonctionnalités |
|---|---|
| **Accueil** (`/fr`, `/en`, `/ar`) | Hero avec composition graphique (interface web, typographie, carte de visite, pixels), services, « Votre idée, notre création », comment ça marche, portfolio filtrable (ou section d’attente honnête s’il est vide), pourquoi Fanni’stic, FAQ, appel à l’action, pied de page avec contact, réseaux et pages légales. |
| **Configurateur** (`/fr/configurateur`) | Étapes : services (sélection multiple) → une étape par service avec ses filtres → budget / délai / précisions / fichiers → coordonnées → récapitulatif modifiable. Questions conditionnelles, « Je ne sais pas, conseillez-moi », barre de progression, validation claire, brouillon sauvegardé sur l’appareil, navigation clavier, barre d’actions collante sur mobile. Choix final : **Recevoir un devis** ou **Demander un échange**. |
| **Estimation** | Prix de base par service + suppléments par option + majoration urgente (uniquement si définie). Sans tarif : « Devis personnalisé ». Mention « estimation indicative » toujours affichée. **Aucun tarif n’est inventé par défaut.** |
| **Après envoi** | Enregistrement en base, identifiant unique `FAN-AAMM-XXXXXX`, lien de suivi secret, confirmation à l’écran, e-mail au client et notification à l’admin **seulement si le SMTP est configuré** (sinon l’écran le dit). |
| **Suivi / espace client** (`/fr/suivi/…`, `/fr/espace`) | Statut et historique, devis détaillé (accepter / refuser avec remarque), messagerie avec pièces jointes, fichiers livrés téléchargeables, rattachement d’une demande envoyée sans compte. Compte facultatif. |
| **Administration** (`/admin`) | Tableau de bord (indicateurs calculés sur les vraies données), demandes (recherche, filtres service / statut / dates / type, pagination), fiche demande (réponses, fichiers, statut + e-mail, notes internes, devis par lignes, messages, fichiers livrés, suppression RGPD), éditeur de services et de leurs filtres (questions, options, conditions, prix), tarifs, portfolio (images), FAQ, textes de la page d’accueil en 3 langues, réglages légaux, état des intégrations, mot de passe. |
| **SEO** | Métadonnées par page, Open Graph + image générée, `hreflang`, `sitemap.xml`, `robots.txt`, favicon issu du logo. |

Statuts : Demande reçue · Étude en cours · Informations complémentaires nécessaires · Devis envoyé · Devis accepté · En cours de réalisation · En attente de validation · Terminé · Annulé.

---

## Démarrage rapide (local)

Prérequis : **Node.js 20+** et **PostgreSQL 14+**.

```bash
cd fannistic
npm install
cp .env.example .env          # puis remplir DATABASE_URL et AUTH_SECRET (openssl rand -base64 32)
npm run db:deploy             # crée les tables
npm run admin:create -- vous@exemple.com "UnMotDePasseSolide"   # 12 caractères minimum
npm run dev                   # http://localhost:3000  → /fr, administration : /admin
```

PostgreSQL via Docker :

```bash
docker run -d --name fannistic-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fannistic -p 5432:5432 postgres:16
```

Au premier affichage, les 9 services, leurs filtres (traduits) et 7 questions de FAQ sont insérés automatiquement ; tout est ensuite modifiable depuis `/admin`.

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production (`start` applique les migrations et crée l’admin initial si besoin) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Parcours complets dans un navigateur (voir [Tests](#tests)) |
| `npm run typecheck` / `npm run lint` | Vérifications TypeScript / ESLint |
| `npm run admin:create -- email motdepasse` | Crée ou réinitialise un administrateur |
| `npm run db:studio` | Explorateur de base Prisma |

---

## Variables d’environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | ✅ | Connexion PostgreSQL |
| `AUTH_SECRET` | ✅ | Signature des sessions et chiffrement des jetons de suivi (32 caractères aléatoires ou plus). Le changer déconnecte tout le monde. |
| `SITE_URL` | ✅ en prod | URL publique (liens des e-mails, sitemap, Open Graph), ex. `https://fannistic.com` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | 1er démarrage | Crée le premier administrateur si aucun n’existe. Retirez-les ensuite. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | facultatif | E-mails transactionnels (Resend, Brevo, Mailgun, OVH, Gmail…). Port 465 = TLS direct. |
| `ADMIN_NOTIFY_EMAIL` | facultatif | Reçoit les nouvelles demandes, messages clients et réponses aux devis. |

Aucune clé secrète n’est envoyée au navigateur.

---

## Premier administrateur

Deux possibilités :
- `npm run admin:create -- email "motdepasse"` (local ou console de l’hébergeur) ;
- ou définir `ADMIN_EMAIL` / `ADMIN_PASSWORD` avant le premier `npm start`, puis les supprimer.

Connexion : `/admin/connexion`. Le mot de passe se change dans **Réglages** (cela déconnecte les autres sessions).

---

## Déploiement

L’application est un serveur Next.js classique + PostgreSQL. Les fichiers (pièces jointes, livrables, images du portfolio) sont stockés **dans PostgreSQL** : aucun stockage externe n’est nécessaire et rien n’est perdu au redéploiement.

**Render (exemple)**
1. Créer une base PostgreSQL, copier l’« Internal Database URL ».
2. Créer un *Web Service* sur ce dépôt avec **Root Directory : `fannistic`**.
3. Build : `npm install && npm run build` — Start : `npm start`.
4. Variables : `DATABASE_URL`, `AUTH_SECRET`, `SITE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, puis SMTP si souhaité.
5. Après le premier démarrage, se connecter à `/admin`, retirer `ADMIN_PASSWORD`, et compléter **Réglages** (informations légales).

**Railway / Fly.io / VPS** : même principe (`npm run build` puis `npm start`, Node 20+).
**Vercel** : possible avec une base hébergée (Neon, Supabase) ; lancer `npm run db:deploy` et `npm run bootstrap` une fois depuis votre poste avec la `DATABASE_URL` de production. Les envois de fichiers sont alors limités à ~4,5 Mo par requête par la plateforme.

---

## Ce qui reste à connecter

| Élément | État | Action |
|---|---|---|
| **E-mails** | Code prêt, inactif sans SMTP | Renseigner `SMTP_*`, `MAIL_FROM` (domaine vérifié chez le fournisseur) et `ADMIN_NOTIFY_EMAIL`. L’état s’affiche dans **/admin/reglages**. |
| **Tarifs** | Aucun par défaut | **/admin/tarifs** et chaque service : prix de base + suppléments d’options. Tant qu’ils sont vides : « Devis personnalisé ». |
| **Informations légales** | Modèles avec mentions « [à compléter] » | **/admin/reglages** : raison sociale, adresse, immatriculation, hébergeur… Faites valider les textes selon le pays d’activité. |
| **Portfolio** | Vide (aucun faux projet) | **/admin/portfolio** : ajouter des projets réels, avec l’accord des clients. |
| **Réseaux sociaux, e-mail et téléphone publics** | Vides | **/admin/reglages** (s’affichent dans le pied de page). |
| **Logo** | Reconstitué en SVG à partir du kit officiel (`src/components/site/Logo.tsx`, `src/app/icon.svg`) | Remplacer par les fichiers vectoriels d’origine si vous les avez. |
| **Paiement en ligne** | Non inclus (volontairement) | L’envoi reste une demande de devis ; l’acceptation en ligne n’engage aucun paiement. |

---

## Architecture

```
fannistic/
├── prisma/schema.prisma        # Modèle de données (demandes, devis, messages, fichiers, services, portfolio, FAQ, réglages)
├── scripts/                    # create-admin, bootstrap (démarrage), e2e (Playwright)
├── src/
│   ├── middleware.ts           # Préfixe de langue /fr|/en|/ar, protection de /admin
│   ├── i18n/                   # fr.ts (référence typée), en.ts, ar.ts, formats (monnaie, dates, tailles)
│   ├── lib/
│   │   ├── services/           # Types, configuration par défaut, logique partagée navigateur/serveur :
│   │   │                       #   visibilité conditionnelle, validation, estimation, récapitulatif, schémas zod
│   │   └── legal.ts            # Modèles des pages légales (3 langues)
│   ├── server/                 # Accès base, sessions (JWT signé + version), sécurité, fichiers, e-mails, réglages
│   ├── components/             # site/, configurator/, tracking/, account/, admin/
│   └── app/
│       ├── [locale]/           # Pages publiques et espace client
│       ├── admin/              # Back-office (français)
│       └── api/                # Routes : demandes, messages, devis, fichiers, authentification, administration
└── tests/                      # Tests unitaires
```

**Configuration des services** : stockée en base (JSON typé). Chaque question a un type (cartes, cases à cocher, liste, texte…), des libellés FR/EN/AR, une option « Je ne sais pas », une condition d’affichage et, pour les options, un supplément de prix. La même logique (`src/lib/services/logic.ts`) valide dans le navigateur **et** sur le serveur ; le serveur ignore toute question inconnue, masquée ou désactivée et refuse les valeurs hors liste. Chaque demande enregistre aussi un **instantané lisible** de ses réponses : modifier ou supprimer un service ne rend jamais une ancienne demande illisible.

---

## Sécurité et données personnelles

- Mots de passe hachés avec **bcrypt** (coût 12), jamais stockés en clair ; temps de réponse identique que le compte existe ou non.
- Sessions : cookie `httpOnly`, `SameSite=Lax`, `Secure` en production, JWT signé ; rôle et version revérifiés **en base** à chaque requête (changer de mot de passe invalide les autres sessions).
- Toutes les routes qui modifient des données vérifient l’en-tête **Origin** (CSRF) ; l’administration est protégée par le middleware **et** par chaque route.
- **Anti-abus** : limites de débit en base (envois, connexions, inscriptions, messages), champ piège invisible, temps minimal de remplissage.
- **Fichiers** : type détecté d’après le contenu réel (et non l’extension), liste blanche (images, PDF, Office, ZIP, texte), 10 Mo × 5 fichiers ; SVG/HTML refusés ; téléchargement avec `nosniff`, CSP `sandbox`, accès réservé à l’admin, au propriétaire ou au détenteur du lien de suivi.
- **Lien de suivi** : jeton aléatoire de 192 bits ; seul son empreinte SHA-256 sert au contrôle (une copie chiffrée AES-GCM permet de le renvoyer dans les e-mails suivants).
- Adresse IP stockée uniquement sous forme pseudonymisée (HMAC).
- Consentement obligatoire avant envoi, lien vers la politique de confidentialité, suppression définitive d’une demande depuis l’admin (droit à l’effacement). Seuls des cookies indispensables sont utilisés.
- En-têtes : `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

---

## Tests

**Unitaires** (`npm test`, 32 tests) : conformité de la configuration par défaut, filtres conditionnels, validation (valeurs hors liste, « Je ne sais pas » exclusif, e-mails, URL), estimation (base + options, options masquées ignorées, majoration urgente, service sans tarif), récapitulatif, coordonnées, consentement, cohérence des 3 traductions (mêmes clés, mêmes variables), détection des fichiers dangereux.

**Bout en bout** (`npm run test:e2e`, 55 vérifications, Playwright) — sur un serveur lancé et **une base de test** (le script crée des données) :

```bash
BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:e2e
```

Couvre : langues et RTL, configurateur complet sur mobile (multi-services, conditions, erreurs, fichier refusé, téléphone exigé pour WhatsApp, modification depuis le récapitulatif, brouillon après rechargement, consentement), enregistrement réel, suivi sans compte, téléchargement protégé, messages, sécurité (admin, API, Origin), connexion admin, recherche et filtres, statut, notes, devis envoyé puis accepté par le client, fichiers livrés, tarif → estimation, portfolio avec image, FAQ, compte client et rattachement d’une demande.

---

## Choix de conception

- **Palette** : le kit logo officiel fourni (Midnight `#0E1633`, Jaune doré `#FFB800`, Jaune soleil `#FFC21A`, Signal Cyan `#1FC8E3`, blanc ; typographie Poppins) a été retenu à la place du violet suggéré dans le brief, pour rester fidèle à l’identité réelle de la marque. L’arabe utilise Cairo (Poppins n’a pas de glyphes arabes). Polices auto-hébergées (aucun appel à Google Fonts).
- **Administration en français** : les textes publics, formulaires, validations, e-mails et pages de confirmation sont traduits en 3 langues ; le back-office, destiné à l’équipe, est en français.
- **Emplacement** : l’application vit dans le dossier `fannistic/` pour ne pas toucher à l’application My Life OS présente à la racine du dépôt.
