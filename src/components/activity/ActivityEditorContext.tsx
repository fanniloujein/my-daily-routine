"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ActivityForm, emptyDraft, type ActivityDraft } from "./ActivityForm";

const Ctx = createContext<{ open: (d?: Partial<ActivityDraft>) => void } | null>(null);

/** Permet d'ouvrir le formulaire d'activité depuis n'importe quelle page (bouton +, assistant…). */
export function ActivityEditorProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const open = useCallback((d?: Partial<ActivityDraft>) => setDraft(emptyDraft(d)), []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {draft && <ActivityForm open onClose={() => setDraft(null)} initial={draft} />}
    </Ctx.Provider>
  );
}

export function useActivityEditor() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useActivityEditor hors du fournisseur");
  return c;
}
