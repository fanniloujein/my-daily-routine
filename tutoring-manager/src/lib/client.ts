"use client";
// Utilitaires côté navigateur : appels API, SWR, classes.
import useSWR, { mutate as globalMutate, type SWRConfiguration } from "swr";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const json = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, json?.error ?? "Une erreur est survenue.", json ?? undefined);
  return json as T;
}

export function useApi<T>(url: string | null, cfg?: SWRConfiguration) {
  return useSWR<T>(url, (u: string) => api<T>(u), { revalidateOnFocus: true, keepPreviousData: true, ...cfg });
}

/** Rafraîchit toutes les données affichées (après une opération qui touche plusieurs modules). */
export const refreshAll = () => globalMutate(() => true, undefined, { revalidate: true });

export const qsOf = (o: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const fullName = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`;
export const initials = (s: { firstName: string; lastName: string }) => `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();
