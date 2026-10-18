import { getContent } from "@/server/settings";
import { getDict } from "@/i18n";
import { ContentForm } from "@/components/admin/SettingsForms";

export const metadata = { title: "Textes du site" };

const KEYS = [
  { key: "heroEyebrow", label: "Accroche au-dessus du titre" },
  { key: "heroTitle", label: "Titre principal (hero)" },
  { key: "heroSubtitle", label: "Sous-titre (hero)", long: true },
  { key: "ideaTitle", label: "Section « Votre idée » : titre" },
  { key: "ideaSubtitle", label: "Section « Votre idée » : sous-titre", long: true },
  { key: "servicesTitle", label: "Services : titre" },
  { key: "servicesSubtitle", label: "Services : sous-titre", long: true },
  { key: "portfolioTitle", label: "Réalisations : titre" },
  { key: "portfolioSubtitle", label: "Réalisations : sous-titre" },
  { key: "whyTitle", label: "Pourquoi Fanni’stic : titre" },
  { key: "faqTitle", label: "FAQ : titre" },
  { key: "finalTitle", label: "Appel à l’action final : titre" },
  { key: "finalText", label: "Appel à l’action final : texte", long: true },
];

export default async function ContentPage() {
  const content = await getContent();
  const defaults = Object.fromEntries((["fr", "en", "ar"] as const).map((l) => [l, getDict(l).home as unknown as Record<string, string>]));
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Textes de la page d’accueil</h1>
        <p className="mt-1 text-sm text-ink-muted">Personnalisez les principaux textes, dans chaque langue.</p>
      </div>
      <ContentForm keys={KEYS} defaults={defaults} initial={content as Record<string, Record<string, string>>} />
    </div>
  );
}
