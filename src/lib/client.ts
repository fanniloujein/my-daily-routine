"use client";

import useSWR, { mutate, type SWRConfiguration } from "swr";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; raw?: BodyInit } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body !== undefined || opts.raw ? "POST" : "GET"),
    headers: opts.raw ? undefined : { "Content-Type": "application/json" },
    body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    credentials: "same-origin",
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Erreur ${res.status}`, data as Record<string, unknown>);
  return data as T;
}

export function useApi<T>(url: string | null, config?: SWRConfiguration) {
  return useSWR<T>(url, (u: string) => api<T>(u), { revalidateOnFocus: true, keepPreviousData: true, ...config });
}

/** Rafraîchit toutes les données affichées (après une modification). */
export function refreshAll() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("mlos:changed"));
  return mutate(() => true);
}

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function fmtDateLong(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function fmtDateShort(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export function fmtDayNum(d: string) {
  return d.split("-").reverse().slice(0, 2).join("/");
}

export function relativeDay(d: string, todayStr: string) {
  const [y, m, day] = d.split("-").map(Number);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const diff = Math.round((new Date(y, m - 1, day).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  if (diff > 1 && diff < 7) return new Date(y, m - 1, day).toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  return fmtDateShort(d);
}
