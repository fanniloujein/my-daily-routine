// Parcours de bout en bout dans un vrai navigateur (Playwright) contre un serveur lancé.
// Usage : BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:e2e
// ⚠️ Crée de vraies données (demande, compte client, projet de portfolio, FAQ) : à lancer sur une base de test.
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SHOTS = process.env.E2E_SCREENSHOTS; // dossier facultatif pour les captures
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Définissez ADMIN_EMAIL et ADMIN_PASSWORD (compte administrateur existant).");
  process.exit(1);
}

const run = Date.now().toString(36);
let passed = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error(`ÉCHEC : ${label}`);
  passed++;
  console.log(`  ✔ ${label}`);
};
// Attend qu'un élément apparaisse (les actions déclenchent des rendus asynchrones).
const seen = (locator) => locator.waitFor({ timeout: 8000 }).then(() => true, () => false);
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

// Image PNG 1×1 valide.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const browser = await chromium.launch();
const errors = [];
const newPage = async (ctxOpts = {}) => {
  const ctx = await browser.newContext({ baseURL: BASE, ...ctxOpts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
};

try {
  console.log("\n1. Page d'accueil et langues");
  const guest = await newPage({ viewport: { width: 390, height: 844 } });
  const r = await guest.goto("/");
  ok(r.url().endsWith("/fr") || r.url().endsWith("/en") || r.url().endsWith("/ar"), "redirection vers une langue");
  await guest.goto("/fr");
  ok(await seen(guest.getByRole("heading", { level: 1, name: "Vos idées méritent une présence exceptionnelle." })), "titre du hero");
  ok(await seen(guest.getByRole("heading", { name: "Votre idée, notre création." })), "section « Votre idée, notre création »");
  await guest.goto("/ar");
  ok((await guest.locator("html").getAttribute("dir")) === "rtl", "arabe en RTL");
  await guest.goto("/en");
  ok((await guest.locator("html").getAttribute("lang")) === "en", "anglais disponible");

  console.log("\n2. Configurateur (mobile)");
  await guest.goto("/fr/configurateur?service=site-web");
  await guest.getByRole("button", { name: /^Logo/ }).click();
  await guest.getByRole("button", { name: "Continuer" }).click();
  ok(await seen(guest.getByRole("heading", { level: 1, name: "Site web" })), "étape Site web");
  await guest.getByRole("button", { name: "Continuer" }).click();
  ok(await seen(guest.getByText("Ce champ est obligatoire.").first()), "validation : type de site obligatoire");
  await guest.getByText("Site vitrine", { exact: true }).click();
  ok(!(await guest.getByLabel("Décrivez les fonctionnalités personnalisées").isVisible().catch(() => false)), "question conditionnelle masquée");
  await guest.getByText("Formulaire de contact", { exact: true }).click();
  await guest.getByText("Fonctionnalités personnalisées", { exact: true }).click();
  await guest.getByLabel("Décrivez les fonctionnalités personnalisées").fill("Simulateur de devis");
  ok(true, "question conditionnelle affichée et remplie");
  await shot(guest, "cfg-site-web");
  await guest.getByRole("button", { name: "Continuer" }).click();
  await guest.getByLabel(/Nom de la marque/).fill(`Atelier Test ${run}`);
  await guest.getByRole("button", { name: "Continuer" }).click();
  ok(await seen(guest.getByRole("heading", { level: 1, name: "Votre projet" })), "étape Projet");
  await guest.getByText("Urgent (moins de 2 semaines)").click();
  await guest.locator("input[type=file]").setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: PNG });
  await guest.locator("input[type=file]").setInputFiles({ name: "malware.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  ok(await seen(guest.getByText("« malware.exe » : format non accepté.")), "fichier non autorisé refusé");
  await guest.getByRole("button", { name: "Continuer" }).click();
  await guest.getByLabel(/Nom et prénom/).fill("Client Test");
  await guest.getByRole("textbox", { name: /E-mail/ }).fill(`client-${run}@exemple.com`);
  await guest.getByLabel(/Pays/).fill("Maroc");
  await guest.locator("label", { hasText: "WhatsApp" }).click();
  await guest.getByRole("button", { name: "Continuer" }).click();
  ok(await seen(guest.getByText("Ce champ est obligatoire.")), "téléphone exigé pour WhatsApp");
  await guest.getByRole("textbox", { name: /Téléphone/ }).fill("+212 600 000 000");
  await guest.getByRole("button", { name: "Continuer" }).click();
  ok(await seen(guest.getByRole("heading", { name: "Voici votre projet Fanni’stic" })), "récapitulatif");
  ok(await seen(guest.getByText("Devis personnalisé", { exact: true }).first()), "« Devis personnalisé » sans tarif configuré");
  await guest.getByRole("button", { name: "Modifier : Logo" }).click();
  await guest.getByLabel(/Slogan/).fill("Créer avec soin");
  await guest.getByRole("button", { name: "Voir le récapitulatif" }).click();
  ok(await seen(guest.getByText("Créer avec soin")), "modification sans recommencer");
  await guest.reload();
  await guest.getByText("Créer avec soin").waitFor({ timeout: 5000 });
  ok(true, "brouillon conservé après rechargement");
  // Le fichier n'est pas conservé au rechargement : on le rajoute.
  await guest.getByRole("button", { name: "Modifier : Budget, délai et précisions" }).click();
  await guest.locator("input[type=file]").setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: PNG });
  await guest.getByRole("button", { name: "Voir le récapitulatif" }).click();
  await guest.getByRole("button", { name: "Envoyer ma demande" }).click();
  ok(await seen(guest.getByText("Merci d’accepter le traitement")), "consentement exigé");
  await guest.getByRole("checkbox").check();
  await shot(guest, "cfg-summary");
  await guest.getByRole("button", { name: "Envoyer ma demande" }).click();
  await guest.getByRole("heading", { name: "Demande envoyée !" }).waitFor();
  const reference = (await guest.locator("p.font-mono").innerText()).trim();
  ok(/^FAN-\d{4}-[A-Z0-9]{6}$/.test(reference), `demande enregistrée : ${reference}`);
  ok(await seen(guest.getByText(/Aucun e-mail de confirmation|Un e-mail de confirmation/)), "état de l'e-mail affiché honnêtement");
  const trackHref = await guest.getByRole("link", { name: "Suivre ma demande" }).getAttribute("href");
  await shot(guest, "confirmation");

  console.log("\n3. Suivi de la demande (sans compte)");
  await guest.goto(trackHref);
  ok(await seen(guest.getByText("Demande reçue").first()), "statut « Demande reçue »");
  ok(await seen(guest.getByText("reference.png")), "fichier joint visible");
  const fileHref = await guest.getByRole("link", { name: /reference\.png/ }).getAttribute("href");
  ok((await guest.request.get(fileHref)).status() === 200, "téléchargement avec le lien de suivi");
  ok((await guest.request.get(fileHref.replace(/&t=[^&]+/, ""))).status() === 404, "téléchargement refusé sans jeton");
  ok((await guest.request.get(`/fr/suivi/${reference}`)).status() === 200, "page de suivi sans jeton accessible…");
  const noToken = await newPage();
  await noToken.goto(`/fr/suivi/${reference}`);
  ok(await seen(noToken.getByText("Lien de suivi invalide ou expiré.")), "…mais sans aucune donnée");
  await guest.getByLabel("Ajoutez une précision ou posez une question…").fill("Bonjour, voici une précision.");
  await guest.getByRole("button", { name: "Envoyer", exact: true }).click();
  await guest.getByText("Bonjour, voici une précision.").waitFor();
  ok(true, "message client envoyé");

  console.log("\n4. Sécurité");
  ok((await guest.request.get("/admin")).url().includes("/admin/connexion"), "administration protégée");
  ok((await guest.request.put("/api/admin/settings/pricing", { data: {}, headers: { Origin: BASE } })).status() === 401, "API admin refusée sans session");
  ok((await guest.request.post("/api/requests", { multipart: { payload: "{}" } })).status() === 403, "envoi refusé sans en-tête Origin");

  console.log("\n5. Administration");
  const admin = await newPage({ viewport: { width: 1366, height: 900 } });
  await admin.goto("/admin/connexion");
  await admin.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await admin.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await admin.getByRole("button", { name: "Se connecter" }).click();
  ok(await seen(admin.getByText("Identifiants incorrects.")), "mauvais mot de passe refusé");
  await admin.getByLabel("Mot de passe").fill(ADMIN_PASSWORD);
  await admin.getByRole("button", { name: "Se connecter" }).click();
  await admin.getByRole("heading", { name: "Tableau de bord" }).waitFor();
  ok(true, "connexion administrateur");
  await shot(admin, "admin-dashboard");
  await admin.goto(`/admin/demandes?q=${reference}`);
  ok(await seen(admin.getByRole("link", { name: reference })), "recherche de la demande");
  await admin.goto(`/admin/demandes?service=logo&status=RECEIVED`);
  ok(await seen(admin.getByRole("link", { name: reference })), "filtres service + statut");
  await admin.getByRole("link", { name: reference }).click();
  await admin.getByRole("heading", { name: reference }).waitFor();
  ok(await seen(admin.getByText("Simulateur de devis")), "réponses du configurateur visibles");
  ok(await seen(admin.getByText("Bonjour, voici une précision.")), "message client visible");
  await admin.getByLabel("Statut", { exact: true }).selectOption("IN_REVIEW");
  await admin.getByRole("button", { name: "Mettre à jour" }).click();
  await admin.getByText("Statut mis à jour").waitFor();
  ok(true, "statut modifié");
  await admin.getByLabel("Nouvelle note interne").fill("Client sérieux, rappeler jeudi.");
  await admin.getByRole("button", { name: "Ajouter la note" }).click();
  await admin.getByText("Client sérieux, rappeler jeudi.").last().waitFor();
  ok(true, "note interne ajoutée");
  await admin.getByLabel("Ligne 1 : prestation").fill("Site vitrine 5 pages");
  await admin.getByLabel("Ligne 1 : prix unitaire").fill("1200");
  await admin.getByRole("button", { name: "Ajouter une ligne" }).click();
  await admin.getByLabel("Ligne 2 : prestation").fill("Logo");
  await admin.getByLabel("Ligne 2 : prix unitaire").fill("450,50");
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Envoyer au client" }).click();
  await admin.getByText(/Devis (envoyé|publié)/).first().waitFor();
  ok(true, "devis envoyé (1 650,50 €)");
  await admin.locator("input[type=file]").last().setInputFiles({ name: "logo-final.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%test\n") });
  await admin.getByText("Fichiers déposés").waitFor();
  ok(true, "fichier livré déposé");
  await admin.getByPlaceholder("Écrire au client…").fill("Voici votre proposition.");
  await admin.getByRole("button", { name: "Envoyer", exact: true }).click();
  await admin.getByText("Message envoyé").waitFor();
  ok(true, "message de l'équipe envoyé");
  await shot(admin, "admin-request");

  console.log("\n6. Réponse du client au devis");
  await guest.goto(trackHref);
  ok(await seen(guest.getByText("1 650,50 €").first()), "devis visible côté client");
  ok(await seen(guest.getByText("Voici votre proposition.")), "message de l'équipe visible");
  ok(await seen(guest.getByText("logo-final.pdf")), "fichier livré visible");
  guest.once("dialog", (d) => d.accept());
  await guest.getByRole("button", { name: "Accepter la proposition" }).click();
  await guest.getByText(/Proposition acceptée le/).waitFor();
  ok(await seen(guest.getByText("Devis accepté").first()), "devis accepté, statut mis à jour");
  await shot(guest, "tracking");

  console.log("\n7. Tarifs et estimation");
  await admin.goto("/admin/services/logo");
  await admin.getByLabel("Minimum").fill("300");
  await admin.getByLabel("Maximum").fill("500");
  await admin.getByRole("button", { name: "Enregistrer" }).click();
  await admin.getByText("Enregistré").waitFor();
  const est = await newPage({ viewport: { width: 1366, height: 900 } });
  await est.goto("/fr/configurateur?service=logo");
  await est.getByText("Estimation indicative").first().waitFor();
  ok(await seen(est.getByText("300 € – 500 €").first()), "estimation calculée depuis le tarif admin");
  await admin.goto("/admin/services/logo");
  await admin.getByLabel("Minimum").fill("");
  await admin.getByLabel("Maximum").fill("");
  await admin.getByRole("button", { name: "Enregistrer" }).click();
  await admin.getByText("Enregistré").waitFor();
  ok(true, "tarif retiré (retour au devis personnalisé)");

  console.log("\n8. Portfolio et FAQ");
  await admin.goto("/admin/portfolio/nouveau");
  await admin.getByLabel("Titre (FR)").fill(`Projet test ${run}`);
  await admin.getByLabel("Résumé (FR)").fill("Résumé du projet de test.");
  await admin.locator("input[type=file]").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG });
  await admin.getByText("Image ajoutée").waitFor();
  await admin.getByText("Publié sur le site").click();
  await admin.getByRole("button", { name: "Enregistrer" }).click();
  await admin.waitForURL(/\/admin\/portfolio\/(?!nouveau)/);
  ok(true, "projet de portfolio créé");
  const pub = await newPage();
  await pub.goto("/fr/realisations");
  ok(await seen(pub.getByText(`Projet test ${run}`)), "projet visible dans la galerie");
  await pub.getByText(`Projet test ${run}`).click();
  await pub.getByRole("heading", { level: 1, name: `Projet test ${run}` }).waitFor();
  ok(true, "fiche projet détaillée");
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Supprimer" }).click();
  await admin.waitForURL(/\/admin\/portfolio$/);
  ok(true, "projet supprimé");

  await admin.goto("/admin/faq");
  await admin.getByRole("button", { name: "Ajouter une question" }).click();
  await admin.getByLabel("Question (FR)").last().fill(`Question test ${run} ?`);
  await admin.getByLabel("Réponse (FR)").last().fill("Réponse test.");
  await admin.getByRole("button", { name: "Enregistrer" }).last().click();
  await admin.getByRole("button", { name: "Ajouter une question" }).waitFor();
  await pub.goto("/fr");
  ok(await seen(pub.getByText(`Question test ${run} ?`)), "nouvelle FAQ visible sur l'accueil");

  console.log("\n9. Espace client");
  const client = await newPage();
  await client.goto("/fr/espace/inscription");
  await client.getByLabel("Nom et prénom").fill("Client Test");
  await client.getByLabel("E-mail").fill(`compte-${run}@exemple.com`);
  await client.getByLabel("Mot de passe").fill("court");
  await client.getByRole("button", { name: "Créer mon compte" }).click();
  ok(await seen(client.getByText("au moins 10 caractères").first()), "mot de passe trop court refusé");
  await client.getByLabel("Mot de passe").fill("MotDePasseClient1");
  await client.getByRole("button", { name: "Créer mon compte" }).click();
  await client.getByText("Vous n’avez pas encore de demande").waitFor();
  ok(true, "compte créé et connecté");
  await client.goto(trackHref);
  await client.getByRole("button", { name: "Ajouter cette demande à mon espace client" }).click();
  await client.getByText("Demande ajoutée à votre espace.").waitFor();
  await client.goto("/fr/espace");
  ok(await seen(client.getByText(reference)), "demande rattachée au compte");
  await client.goto(`/fr/suivi/${reference}`);
  ok(await seen(client.getByText("Devis accepté").first()), "suivi accessible connecté, sans lien");

  if (errors.length) throw new Error(`Erreurs JavaScript dans la page :\n${errors.join("\n")}`);
  console.log(`\n✅ ${passed} vérifications réussies.`);
} catch (e) {
  console.error(`\n❌ ${e.message}`);
  if (errors.length) console.error("Erreurs de page :", errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
