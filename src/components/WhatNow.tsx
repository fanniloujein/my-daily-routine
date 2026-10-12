"use client";

import { useState } from "react";
import { Coffee, Footprints, BookOpen, Tv, Sparkles, Users, Palette } from "lucide-react";
import { Button, Modal, Spinner } from "./ui";
import { api, cx } from "@/lib/client";
import { formatDuration, formatTime } from "@/lib/dates";
import type { Suggestion } from "@/lib/suggestions";

type Res = { freeMinutes: number; until: { title: string; startTime: string } | null; current: { title: string; endTime: string } | null; energy: number; suggestions: Suggestion[] };

const ICON: Record<string, typeof Coffee> = { WATCH: Tv, RELAX: Coffee, MOVE: Footprints, READ: BookOpen, SOCIAL: Users, CREATIVE: Palette };

/** « Que puis-je faire maintenant ? » — des idées de détente, jamais du travail en plus. */
export function WhatNow({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Res | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);

  async function load(m?: number | null) {
    setData(null);
    setData(await api<Res>(`/api/suggestions${m ? `?minutes=${m}` : ""}`));
  }

  return (
    <>
      <Button
        variant="soft"
        className={cx("w-full", className)}
        onClick={() => {
          setOpen(true);
          setMinutes(null);
          load();
        }}
      >
        <Sparkles className="h-4 w-4" /> Que puis-je faire maintenant ?
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Que puis-je faire maintenant ?" size="sm">
        {!data ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              {data.current
                ? `Tu es dans « ${data.current.title} » jusqu'à ${formatTime(data.current.endTime)}. Si tu as besoin d'une pause, voici quelques idées :`
                : `Tu as environ ${formatDuration(data.freeMinutes)} de libre${data.until ? ` avant « ${data.until.title} » (${formatTime(data.until.startTime)})` : ""}.`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[10, 30, 60, 120].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMinutes(m);
                    load(m);
                  }}
                  className={cx("rounded-full px-3 py-1 text-xs", minutes === m ? "bg-primary-soft text-primary-strong" : "bg-surface-2 text-ink-2")}
                >
                  {formatDuration(m)}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {data.suggestions.map((s) => {
                const I = ICON[s.kind] ?? Sparkles;
                return (
                  <li key={s.title} className="flex items-center gap-3 rounded-xl bg-surface-2/70 p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lavender-soft text-lavender">
                      <I className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-ink">{s.title}</div>
                      <div className="text-xs text-muted">{s.detail}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">Un moment libre n&apos;a pas besoin d&apos;être productif. 💙</p>
          </div>
        )}
      </Modal>
    </>
  );
}
