"use client";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCheck, Info, Settings, X } from "lucide-react";
import { api, cn, useApi } from "@/lib/client";
import type { Notification } from "@/lib/types";
import { Button, Empty, Loading, PageHeader } from "@/components/ui";

const STYLE = { DANGER: "border-danger/30 bg-danger-soft/50", WARNING: "border-warning/30 bg-warning-soft/40", INFO: "border-line bg-surface" };

export default function NotificationsPage() {
  const { data, mutate } = useApi<Notification[]>("/api/notifications");
  const patch = async (id: string, body: Record<string, boolean>) => { await api(`/api/notifications/${id}`, { method: "PATCH", body }); mutate(); };
  return (
    <div>
      <PageHeader
        title="Notifications"
        icon={<Bell className="h-5 w-5" />}
        subtitle="Alertes calculées en continu : elles disparaissent d'elles-mêmes quand la situation est réglée."
        actions={<><Link href="/parametres?tab=notifications"><Button variant="secondary"><Settings className="h-4 w-4" />Personnaliser</Button></Link><Button variant="soft" onClick={async () => { await api("/api/notifications/read-all", { method: "POST" }); mutate(); }}><CheckCheck className="h-4 w-4" />Tout marquer comme lu</Button></>}
      />
      {!data ? <Loading /> : data.length === 0 ? <Empty icon={<Bell className="h-6 w-6" />} title="Aucune alerte en cours 🎉">Tout est à jour : séances préparées, paiements réglés, tâches sous contrôle.</Empty> : (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3", STYLE[n.severity], n.readAt && "opacity-70")}>
              {n.severity === "INFO" ? <Info className="mt-0.5 h-5 w-5 text-primary-strong" /> : <AlertTriangle className={cn("mt-0.5 h-5 w-5", n.severity === "DANGER" ? "text-danger" : "text-warning")} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-medium">{n.title}</span>{!n.readAt && <span className="h-2 w-2 rounded-full bg-primary-strong" />}</div>
                {n.body && <div className="text-sm text-ink-2">{n.body}</div>}
                <div className="mt-1 flex gap-3 text-xs">
                  {n.href && <Link href={n.href} onClick={() => patch(n.id, { read: true })} className="font-medium text-primary-strong hover:underline">Voir</Link>}
                  <button onClick={() => patch(n.id, { read: !n.readAt })} className="text-muted hover:text-ink">{n.readAt ? "Marquer non lue" : "Marquer comme lue"}</button>
                </div>
              </div>
              <button onClick={() => patch(n.id, { dismissed: true })} className="text-muted hover:text-ink" aria-label="Masquer" title="Masquer définitivement"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
