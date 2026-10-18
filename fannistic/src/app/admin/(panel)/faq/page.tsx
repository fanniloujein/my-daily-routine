import { getFaq } from "@/server/catalog";
import { FaqManager } from "@/components/admin/FaqManager";

export const metadata = { title: "FAQ" };

export default async function FaqAdmin() {
  const items = await getFaq();
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Questions fréquentes</h1>
        <p className="mt-1 text-sm text-ink-muted">Affichées sur la page d’accueil, dans la langue du visiteur (le français sert de secours).</p>
      </div>
      <FaqManager items={items} />
    </div>
  );
}
