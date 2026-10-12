"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { Button, Card, Notice } from "./ui";
import { useReminders } from "./ReminderEngine";

export function ReminderStatus() {
  const { status, requestPermission, test } = useReminders();
  return (
    <Card title="Fiabilité des rappels" icon={<BellRing className="h-4 w-4" />}>
      <div className="space-y-3 text-sm">
        {!status.supported ? (
          <Notice tone="warning">Ce navigateur ne permet pas les notifications. Les rappels s&apos;affichent seulement dans l&apos;application ouverte.</Notice>
        ) : status.permission === "granted" ? (
          <Notice tone="success">Notifications autorisées sur cet appareil.</Notice>
        ) : status.permission === "denied" ? (
          <Notice tone="warning">Notifications bloquées. Autorise-les dans les réglages du navigateur pour ce site.</Notice>
        ) : (
          <Button size="sm" onClick={requestPermission}>
            Activer les notifications
          </Button>
        )}
        <p className="text-xs text-ink-2">
          <strong>Limite réelle :</strong> les rappels du navigateur ne fonctionnent que lorsque l&apos;application est ouverte (onglet ou application installée). Pour des alarmes
          fiables même téléphone verrouillé, abonne ton agenda (Google, Apple, Outlook) au calendrier My Life OS dans les{" "}
          <Link href="/parametres#rappels" className="font-medium text-primary-strong underline">
            paramètres
          </Link>
          .
        </p>
        <Button size="sm" variant="secondary" onClick={test}>
          Tester un rappel
        </Button>
      </div>
    </Card>
  );
}

