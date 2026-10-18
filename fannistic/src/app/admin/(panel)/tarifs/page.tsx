import Link from "next/link";
import { getServices } from "@/server/catalog";
import { getPricing } from "@/server/settings";
import { PricingForm } from "@/components/admin/SettingsForms";
import { formatMoney } from "@/i18n";

export const metadata = { title: "Tarifs" };

export default async function PricingPage() {
  const [pricing, services] = await Promise.all([getPricing(), getServices()]);
  const priced = services.filter((s) => s.baseMin != null);
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Tarifs et estimation</h1>
        <p className="mt-1 text-sm text-ink-muted">
          L’estimation = prix de base du service + suppléments des options choisies (+ majoration urgente si définie). Si un service sélectionné n’a pas de prix de base, le client voit « Devis personnalisé ».
        </p>
      </div>
      <PricingForm initial={pricing} />
      <section className="card p-5">
        <h2 className="text-base">Prix de base par service</h2>
        <p className="mt-1 text-sm text-ink-muted">{priced.length} service(s) sur {services.length} ont un tarif. Les suppléments par option se règlent dans chaque service.</p>
        <ul className="mt-4 divide-y divide-line">
          {services.map((s) => (
            <li key={s.slug} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>{s.name.fr}</span>
              <span className="flex items-center gap-4">
                <span className={s.baseMin != null ? "font-medium" : "text-ink-muted"}>
                  {s.baseMin != null && s.baseMax != null ? `${formatMoney(s.baseMin, pricing.currency, "fr")} – ${formatMoney(s.baseMax, pricing.currency, "fr")}` : "Devis personnalisé"}
                </span>
                <Link href={`/admin/services/${s.slug}`} className="text-xs font-semibold underline underline-offset-2">Modifier</Link>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
