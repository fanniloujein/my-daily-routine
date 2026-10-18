import Link from "next/link";
import { getServices } from "@/server/catalog";
import { getPricing } from "@/server/settings";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { NewServiceForm } from "@/components/admin/ServiceEditor";
import { formatMoney } from "@/i18n";

export const metadata = { title: "Services & filtres" };

export default async function ServicesAdmin() {
  const [services, pricing] = await Promise.all([getServices(), getPricing()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Services & filtres</h1>
        <p className="mt-1 text-sm text-ink-muted">Chaque service a ses propres questions dans le configurateur. Modifiez libellés, options, conditions et tarifs sans toucher au code.</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {services.map((s) => (
          <li key={s.slug}>
            <Link href={`/admin/services/${s.slug}`} className="card flex items-center gap-4 p-4 transition hover:shadow-pop">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.active ? "bg-midnight text-gold-sun" : "bg-paper-3 text-ink-muted"}`}>
                <ServiceIcon name={s.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{s.name.fr}</span>
                <span className="block text-xs text-ink-muted">
                  {s.questions.filter((q) => q.enabled).length} question(s) active(s) ·{" "}
                  {s.baseMin != null && s.baseMax != null ? `${formatMoney(s.baseMin, pricing.currency, "fr")} – ${formatMoney(s.baseMax, pricing.currency, "fr")}` : "sans tarif (devis personnalisé)"}
                </span>
              </span>
              {!s.active && <span className="badge bg-paper-3 text-ink-muted">Masqué</span>}
            </Link>
          </li>
        ))}
      </ul>
      <NewServiceForm />
    </div>
  );
}
