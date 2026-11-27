"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h1>Une erreur est survenue · حدث خطأ</h1>
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 12, border: 0, background: "#3B7BC6", color: "#fff" }}>
            Réessayer · إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
