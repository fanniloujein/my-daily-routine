"use client";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/lib/action";

/** Reporte les erreurs de champ renvoyées par le serveur dans React Hook Form. */
export function applyServerErrors<T extends FieldValues>(res: ActionResult<unknown>, setError: UseFormSetError<T>): string | undefined {
  if (res.ok) return undefined;
  for (const [k, v] of Object.entries(res.fieldErrors ?? {})) setError(k as Path<T>, { message: v });
  return res.error === "validation" && res.fieldErrors && Object.keys(res.fieldErrors).length ? undefined : res.error;
}
