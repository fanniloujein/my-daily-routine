"use client";

import { useEffect } from "react";

/** Dernier filet de sécurité : erreur dans la mise en page racine. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (/ChunkLoadError|Loading chunk/i.test(`${error.name} ${error.message}`)) {
      try {
        if (!sessionStorage.getItem("mlos-reloaded")) {
          sessionStorage.setItem("mlos-reloaded", "1");
          window.location.reload();
        }
      } catch {}
    }
  }, [error]);
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f6f2", color: "#1b2540", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>My Life OS a rencontré un problème</h1>
          <p style={{ color: "#707891" }}>Recharge la page. Si cela persiste, ouvre /api/health pour le diagnostic.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: "10px 18px", borderRadius: 12, border: 0, background: "#3460be", color: "white", cursor: "pointer" }}>
            Recharger
          </button>
        </div>
      </body>
    </html>
  );
}
