"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/client";
import { Button } from "./button";
import { Field, Input } from "./form";

export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input:not([type=hidden]),select,textarea")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className={cn("flex max-h-[94vh] w-full flex-col rounded-t-3xl bg-surface shadow-pop animate-scale-in sm:rounded-3xl", w)}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ───────────── Notifications éphémères ─────────────
type Toast = { id: number; tone: "success" | "error" | "info"; text: string };
const ToastCtx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});
export const useToast = () => {
  const push = useContext(ToastCtx);
  return { success: (t: string) => push("success", t), error: (t: string) => push("error", t), info: (t: string) => push("info", t) };
};

// ───────────── Confirmation ─────────────
type ConfirmOpts = { title: string; text?: ReactNode; confirm?: string; danger?: boolean; reason?: string };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<string | false>>(async () => false);
/** Renvoie false si annulé, sinon le motif saisi (ou "" si aucun motif demandé). */
export const useConfirm = () => useContext(ConfirmCtx);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);
  const [conf, setConf] = useState<(ConfirmOpts & { resolve: (v: string | false) => void }) | null>(null);
  const [reason, setReason] = useState("");
  const confirm = useCallback((o: ConfirmOpts) => new Promise<string | false>((resolve) => { setReason(""); setConf({ ...o, resolve }); }), []);
  const close = (v: string | false) => { conf?.resolve(v); setConf(null); };
  const needsReason = conf?.reason !== undefined;
  return (
    <ToastCtx.Provider value={push}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <Dialog
          open={!!conf}
          onClose={() => close(false)}
          title={conf?.title}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => close(false)}>Annuler</Button>
              <Button variant={conf?.danger ? "danger" : "primary"} disabled={needsReason && reason.trim().length < 3} onClick={() => close(needsReason ? reason.trim() : "")}>
                {conf?.confirm ?? "Confirmer"}
              </Button>
            </>
          }
        >
          {conf?.text && <div className="text-sm text-ink-2">{conf.text}</div>}
          {needsReason && (
            <Field label={conf?.reason || "Motif"} className="mt-3" hint="Obligatoire : la correction reste tracée dans le journal.">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. erreur de saisie" />
            </Field>
          )}
        </Dialog>
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={cn("pointer-events-auto flex items-start gap-2.5 rounded-2xl border bg-surface px-4 py-3 text-sm shadow-pop animate-fade-in", t.tone === "error" ? "border-danger/30" : "border-line")}>
              {t.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : t.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" />}
              <span className="text-ink">{t.text}</span>
            </div>
          ))}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
