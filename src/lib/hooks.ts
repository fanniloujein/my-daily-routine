"use client";

import { useApi } from "./client";
import type { UserSettings } from "./validation";
import type { Occurrence } from "@/server/occurrences";

export type Me = { id: string; name: string; email: string; locale: string; settings: UserSettings; aiEnabled: boolean; hasIcsToken: boolean };
export type CategoryT = { id: string; name: string; color: string; icon: string; order: number; kind: string | null; balance: string; reminderMinutes: number | null; activityCount: number };
export type { Occurrence };

export function useMe() {
  return useApi<Me>("/api/me");
}

export function useCategories() {
  return useApi<CategoryT[]>("/api/categories");
}

export function useOccurrences(from: string, to: string) {
  return useApi<Occurrence[]>(`/api/activities?from=${from}&to=${to}`);
}
