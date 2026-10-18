import { CheckCircle2, CircleAlert } from "lucide-react";
import { getCompany } from "@/server/settings";
import { isMailConfigured, siteUrl } from "@/server/mail";
import { CompanyForm, PasswordForm } from "@/components/admin/SettingsForms";

export const metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const company = await getCompany();
  const checks = [
    { ok: isMailConfigured(), label: "E-mails transactionnels (SMTP_HOST, MAIL_FROM…)", hint: "Sans eux, aucune confirmation ni notification n’est envoyée ; les clients gardent leur lien de suivi." },
    { ok: Boolean(process.env.ADMIN_NOTIFY_EMAIL), label: "Adresse de notification des nouvelles demandes (ADMIN_NOTIFY_EMAIL)", hint: "" },
    { ok: Boolean(process.env.SITE_URL), label: `URL publique du site (SITE_URL) : ${siteUrl()}`, hint: "Utilisée dans les e-mails, le sitemap et Open Graph." },
    { ok: (process.env.AUTH_SECRET ?? "").length >= 32, label: "Secret de session robuste (AUTH_SECRET, 32 caractères ou plus)", hint: "" },
  ];
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl sm:text-3xl">Réglages</h1>
      <section className="card p-5">
        <h2 className="text-base">État des intégrations</h2>
        <p className="mt-1 text-sm text-ink-muted">Ces éléments se configurent dans les variables d’environnement de l’hébergeur (voir README).</p>
        <ul className="mt-4 space-y-3">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-3 text-sm">
              {c.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Configuré" /> : <CircleAlert className="h-5 w-5 shrink-0 text-gold" aria-label="Non configuré" />}
              <span>
                {c.label}
                {!c.ok && c.hint && <span className="block text-xs text-ink-muted">{c.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-lg">Entreprise et informations légales</h2>
          <p className="text-sm text-ink-muted">Utilisées dans le pied de page, les mentions légales, la politique de confidentialité et les conditions générales.</p>
        </div>
        <CompanyForm initial={company} />
      </section>
      <PasswordForm />
    </div>
  );
}
