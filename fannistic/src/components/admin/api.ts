"use client";

/** Appel JSON vers l'API d'administration ; lève une erreur lisible en cas d'échec. */
export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || MESSAGES[data.error] || `Erreur ${res.status}`);
  return data as T;
}

const MESSAGES: Record<string, string> = {
  unauthorized: "Session expirée : reconnectez-vous.",
  forbidden: "Action refusée.",
  not_found: "Élément introuvable.",
  rate_limited: "Trop de tentatives, patientez quelques minutes.",
  bad_request: "Données invalides.",
  exists: "Cet identifiant existe déjà.",
  quote_pending: "Un devis envoyé attend la réponse du client : retirez-le avant d'en envoyer un autre.",
  bad_file: "Fichier refusé (format ou taille).",
};
