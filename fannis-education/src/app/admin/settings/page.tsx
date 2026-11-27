import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/time";
import { getSettings } from "@/server/settings";
import { Card, CardTitle, PageHeader, Table, Td } from "@/components/ui";
import { SettingsForm } from "@/components/client/AdminForms";
import type { SettingsInput } from "@/lib/validation/admin";

export default async function SettingsPage() {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const [s, logs] = await Promise.all([getSettings(), prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } })]);
  return (
    <>
      <PageHeader title={a.settingsTitle} subtitle={a.settingsSubtitle} />
      <Card className="mb-6">
        <SettingsForm
          defaults={{
            contactEmail: s.contactEmail,
            contactPhone: s.contactPhone,
            paymentInstructions: s.paymentInstructions,
            paymentInstructionsAr: s.paymentInstructionsAr,
            enabledPaymentMethods: s.enabledPaymentMethods.filter((m) => m !== "ONLINE_GATEWAY") as SettingsInput["enabledPaymentMethods"],
          }}
        />
      </Card>
      <Card>
        <CardTitle>{a.auditTitle}</CardTitle>
        <Table head={[t.common.date, a.author, t.common.actions, ""]}>
          {logs.map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(l.createdAt, locale)}</Td>
              <Td>{l.actor?.name ?? "—"}</Td>
              <Td><code className="text-xs">{l.action}</code></Td>
              <Td className="text-xs text-ink-muted"><span dir="ltr">{l.entityType} · {l.entityId.slice(0, 10)}</span></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
