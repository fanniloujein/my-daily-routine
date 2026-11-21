"use client";
import { Button } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <h2 className="font-display text-lg font-semibold">Une erreur est survenue</h2>
      <p className="mt-2 text-sm text-muted">{error.message || "Impossible d'afficher cette page."}</p>
      <Button className="mt-4" onClick={reset}>Réessayer</Button>
    </div>
  );
}
