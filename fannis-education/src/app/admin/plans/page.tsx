import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { fmt, localized } from "@/lib/i18n/config";
import { formatMoney, millimesToTndString } from "@/lib/money";
import { togglePlanAction } from "@/actions/admin";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { EditPlanToggle, PlanForm } from "@/components/client/AdminForms";

export default async function PlansPage() {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const [plans, levels] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }], include: { _count: { select: { subscriptions: true } } } }),
    prisma.educationalLevel.findMany({ orderBy: { order: "asc" } }),
  ]);
  const levelOptions = levels.map((l) => ({ id: l.id, label: localized(locale, l.name, l.nameAr) }));
  return (
    <>
      <PageHeader title={a.plansTitle} subtitle={a.plansSubtitle} />
      <div className="space-y-4">
        {plans.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{localized(locale, p.name, p.nameAr)}</h2>
                  <Badge tone={p.isActive ? "green" : "gray"}>{p.isActive ? t.common.active : t.common.inactive}</Badge>
                  {p.isFeatured && <Badge tone="yellow">{a.planFeatured}</Badge>}
                  <Badge><span dir="ltr">{p.code}</span></Badge>
                </div>
                <p className="mt-1 text-2xl font-bold">{formatMoney(p.priceMillimes, locale)} <span className="text-sm font-normal text-ink-muted">{fmt(t.student.subDuration, { days: p.durationDays })}</span></p>
                <p className="text-xs text-ink-muted">{p._count.subscriptions} {t.nav.admin.subscriptions.toLowerCase()}</p>
              </div>
              <ActionButton action={togglePlanAction.bind(null, p.id)}>{p.isActive ? t.common.inactive : t.common.active}</ActionButton>
            </div>
            <EditPlanToggle
              label={t.common.edit}
              planId={p.id}
              levels={levelOptions}
              defaults={{
                code: p.code, name: p.name, nameAr: p.nameAr ?? "", description: p.description ?? "", descriptionAr: p.descriptionAr ?? "",
                price: millimesToTndString(p.priceMillimes), durationDays: p.durationDays,
                features: ((p.features as string[]) ?? []).join("\n"), featuresAr: ((p.featuresAr as string[]) ?? []).join("\n"),
                levelId: p.levelId ?? "", isActive: p.isActive, isFeatured: p.isFeatured, order: p.order,
              }}
            />
          </Card>
        ))}
        <Card>
          <CardTitle>{a.newPlan}</CardTitle>
          <PlanForm levels={levelOptions} />
        </Card>
      </div>
    </>
  );
}
