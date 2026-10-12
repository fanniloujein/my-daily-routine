"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import { useUi } from "./ui";
import type { Reminder } from "@/server/reminders";

// Moteur de rappels côté navigateur.
// Limite réelle : il ne fonctionne que lorsque l'application est ouverte (onglet ou PWA).
// Pour des alarmes fiables application fermée, utiliser l'abonnement calendrier (.ics) — voir Paramètres.

type Status = { supported: boolean; permission: NotificationPermission | "unsupported"; swReady: boolean; lastSync: Date | null; upcoming: Reminder[] };
const Ctx = createContext<{ status: Status; requestPermission: () => Promise<void>; test: () => Promise<void>; sync: () => Promise<void> } | null>(null);

const FIRED_KEY = "mlos-fired-reminders";

function loadFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveFired(f: Record<string, number>) {
  try {
    const cutoff = Date.now() - 3 * 86400000;
    localStorage.setItem(FIRED_KEY, JSON.stringify(Object.fromEntries(Object.entries(f).filter(([, t]) => t > cutoff))));
  } catch {}
}

function at(r: Reminder) {
  const [y, m, d] = r.date.split("-").map(Number);
  const [h, mi] = r.time.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { toast } = useUi();
  const [status, setStatus] = useState<Status>({ supported: false, permission: "unsupported", swReady: false, lastSync: null, upcoming: [] });
  const reminders = useRef<Reminder[]>([]);
  const fired = useRef<Record<string, number>>({});
  const reg = useRef<ServiceWorkerRegistration | null>(null);

  const notify = useCallback(
    async (title: string, body: string, tag: string, url = "/") => {
      toast(`🔔 ${title} — ${body}`, "warning");
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      try {
        if (reg.current) await reg.current.showNotification(title, { body, tag, icon: "/icons/192", badge: "/icons/192", data: { url } });
        else new Notification(title, { body, tag, icon: "/icons/192" });
      } catch {
        /* certaines plateformes refusent : le toast in-app reste affiché */
      }
    },
    [toast],
  );

  const sync = useCallback(async () => {
    try {
      const list = await api<Reminder[]>("/api/reminders");
      reminders.current = list;
      setStatus((s) => ({ ...s, lastSync: new Date(), upcoming: list.filter((r) => at(r) > Date.now()).slice(0, 5) }));
    } catch {
      /* hors ligne : on réessaiera */
    }
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    for (const r of reminders.current) {
      const t = at(r);
      // déclenchement si l'heure est passée depuis moins de 15 min (rattrapage après mise en veille)
      if (t <= now && now - t < 15 * 60000 && !fired.current[r.key]) {
        fired.current[r.key] = now;
        saveFired(fired.current);
        notify(r.title, r.body, r.key, r.kind === "medication" ? "/sante" : "/planning");
      }
    }
  }, [notify]);

  useEffect(() => {
    fired.current = loadFired();
    const supported = typeof window !== "undefined" && "Notification" in window;
    setStatus((s) => ({ ...s, supported, permission: supported ? Notification.permission : "unsupported" }));
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((r) => {
          reg.current = r;
          setStatus((s) => ({ ...s, swReady: true }));
        })
        .catch(() => {});
    }
    sync();
    const syncId = setInterval(sync, 5 * 60000);
    const tickId = setInterval(tick, 20000);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync().then(tick);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("mlos:changed", sync);
    return () => {
      clearInterval(syncId);
      clearInterval(tickId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("mlos:changed", sync);
    };
  }, [sync, tick]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setStatus((s) => ({ ...s, permission: p }));
  }, []);

  const test = useCallback(async () => {
    await notify("Test de rappel", "Les rappels fonctionnent sur cet appareil ✨", `test-${Date.now()}`);
  }, [notify]);

  return <Ctx.Provider value={{ status, requestPermission, test, sync }}>{children}</Ctx.Provider>;
}

export function useReminders() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useReminders hors du fournisseur");
  return c;
}
