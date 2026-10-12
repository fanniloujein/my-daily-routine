"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

const isChunkError = (e: Error) => /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Loading CSS chunk/i.test(`${e.name} ${e.message}`);

/** Écran d'erreur d'une section : propose de réessayer sans perdre le reste de l'application. */
export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Après une mise à jour de l'application, un onglet ouvert peut chercher d'anciens fichiers : on recharge une fois.
    if (isChunkError(error)) {
      try {
        if (!sessionStorage.getItem("mlos-reloaded")) {
          sessionStorage.setItem("mlos-reloaded", "1");
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
    console.error(error);
  }, [error]);

  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <h2 className="font-display text-lg font-semibold text-ink">Cette section n&apos;a pas pu s&apos;afficher</h2>
      <p className="mt-2 text-sm text-muted">
        {isChunkError(error)
          ? "L'application vient d'être mise à jour. Recharge la page pour obtenir la nouvelle version."
          : "Un problème temporaire est survenu. Réessaie ; si cela persiste, ouvre /api/health pour le diagnostic."}
      </p>
      {error.digest && <p className="mt-1 text-[11px] text-muted">Réf. {error.digest}</p>}
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="secondary" onClick={() => reset()}>
          Réessayer
        </Button>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" /> Recharger
        </Button>
      </div>
    </div>
  );
}
