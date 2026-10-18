"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { StatusLine, Toggle, useStatus } from "./ui";

export interface Pricing {
  currency: string;
  estimatesEnabled: boolean;
  urgentSurchargePercent: number | null;
}

export function PricingForm({ initial }: { initial: Pricing }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const st = useStatus();
  return (
    <form
      className="card space-y-5 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await st.run(() => api("/api/admin/settings/pricing", "PUT", p));
        router.refresh();
      }}
    >
      <Toggle checked={p.estimatesEnabled} onChange={(v) => setP({ ...p, estimatesEnabled: v })} label="Afficher une estimation indicative dans le configurateur" />
      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="cur" className="field-label">Devise (code ISO)</label>
          <input id="cur" className="input w-28 uppercase" maxLength={3} value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value.toUpperCase() })} />
          <p className="field-help">EUR, MAD, USD, CHF…</p>
        </div>
        <div>
          <label htmlFor="urg" className="field-label">Majoration délai urgent (%)</label>
          <input
            id="urg"
            type="number"
            min={0}
            max={200}
            className="input w-36"
            value={p.urgentSurchargePercent ?? ""}
            placeholder="Aucune"
            onChange={(e) => setP({ ...p, urgentSurchargePercent: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
          />
          <p className="field-help">Vide = aucune majoration appliquée.</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary btn-sm" disabled={st.busy}>Enregistrer</button>
        <StatusLine status={st.status} />
      </div>
    </form>
  );
}

type Company = { [key: string]: string | Record<string, string> | undefined; socials?: Record<string, string> };

const COMPANY_FIELDS: [string, string, boolean?][] = [
  ["tradeName", "Nom commercial"],
  ["legalName", "Raison sociale"],
  ["legalForm", "Forme juridique (SARL, auto-entrepreneur…)"],
  ["registration", "Immatriculation (RC, SIRET, ICE…)"],
  ["vatNumber", "N° de TVA / identifiant fiscal"],
  ["director", "Responsable de la publication"],
  ["email", "E-mail de contact public"],
  ["phone", "Téléphone public"],
  ["country", "Pays d’activité"],
  ["address", "Adresse", true],
  ["hosting", "Hébergeur (nom, adresse, contact)", true],
];
const SOCIALS = ["instagram", "facebook", "linkedin", "behance", "tiktok", "whatsapp"];

export function CompanyForm({ initial }: { initial: Company }) {
  const router = useRouter();
  const [c, setC] = useState<Company>(initial);
  const st = useStatus();
  const socials = c.socials ?? {};
  return (
    <form
      className="card space-y-5 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await st.run(() => api("/api/admin/settings/company", "PUT", c));
        router.refresh();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {COMPANY_FIELDS.map(([k, label, wide]) => (
          <div key={k} className={wide ? "sm:col-span-2" : ""}>
            <label htmlFor={`c-${k}`} className="field-label">{label}</label>
            {wide ? (
              <textarea id={`c-${k}`} rows={2} className="input min-h-[64px]" value={(c[k] as string) ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
            ) : (
              <input id={`c-${k}`} className="input" value={(c[k] as string) ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      <fieldset>
        <legend className="field-label">Réseaux sociaux (liens complets)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIALS.map((k) => (
            <input
              key={k}
              aria-label={k}
              className="input"
              placeholder={`https://… (${k})`}
              value={socials[k] ?? ""}
              onChange={(e) => setC({ ...c, socials: { ...socials, [k]: e.target.value } })}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary btn-sm" disabled={st.busy}>Enregistrer</button>
        <StatusLine status={st.status} />
      </div>
    </form>
  );
}

export function ContentForm({ keys, defaults, initial }: { keys: { key: string; label: string; long?: boolean }[]; defaults: Record<string, Record<string, string>>; initial: Record<string, Record<string, string>> }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, Record<string, string>>>({ fr: {}, en: {}, ar: {}, ...initial });
  const [lang, setLang] = useState<"fr" | "en" | "ar">("fr");
  const st = useStatus();
  return (
    <form
      className="card space-y-5 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await st.run(() => api("/api/admin/settings/content", "PUT", v));
        router.refresh();
      }}
    >
      <div className="flex gap-2" role="tablist" aria-label="Langue">
        {(["fr", "en", "ar"] as const).map((l) => (
          <button key={l} type="button" role="tab" aria-selected={lang === l} className={`chip ${lang === l ? "chip-on" : ""}`} onClick={() => setLang(l)}>
            {l === "fr" ? "Français" : l === "en" ? "English" : "العربية"}
          </button>
        ))}
      </div>
      <p className="text-sm text-ink-muted">Laissez un champ vide pour conserver le texte par défaut (affiché en gris).</p>
      <div className="space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
        {keys.map(({ key, label, long }) => {
          const props = {
            id: `ct-${key}`,
            className: "input",
            placeholder: defaults[lang]?.[key] ?? "",
            value: v[lang]?.[key] ?? "",
            maxLength: 400,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [lang]: { ...v[lang], [key]: e.target.value } }),
          };
          return (
            <div key={key} dir="ltr">
              <label htmlFor={`ct-${key}`} className="field-label">{label}</label>
              <div dir={lang === "ar" ? "rtl" : "ltr"}>{long ? <textarea rows={2} {...props} className="input min-h-[64px]" /> : <input {...props} />}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary btn-sm" disabled={st.busy}>Enregistrer</button>
        <StatusLine status={st.status} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const st = useStatus();
  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await st.run(() => api("/api/auth/password", "POST", { current, next }), "Mot de passe modifié")) {
          setCurrent("");
          setNext("");
        }
      }}
    >
      <h2 className="text-base">Mot de passe administrateur</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pw-cur" className="field-label">Actuel</label>
          <input id="pw-cur" type="password" autoComplete="current-password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pw-new" className="field-label">Nouveau (12 caractères min.)</label>
          <input id="pw-new" type="password" autoComplete="new-password" minLength={12} className="input" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-dark btn-sm" disabled={st.busy || !current || next.length < 12}>Modifier</button>
        <StatusLine status={st.status} />
      </div>
    </form>
  );
}
