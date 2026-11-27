import type { PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { subjectOptions } from "@/server/admin-options";
import { deleteResourceAction, setResourceAccessAction, setResourceStatusAction } from "@/actions/content";
import { Badge, Card, CardTitle, EmptyState, PageHeader, Table, Tabs, Td } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { ResourceUploadForm } from "@/components/client/ContentForms";
import { STATUS_TONE } from "@/components/CourseEditor";

const STATUSES: PublishStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export default async function AdminResourcesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as PublishStatus) ? (sp.status as PublishStatus) : undefined;
  const [resources, options, courses] = await Promise.all([
    prisma.educationalResource.findMany({ where: status ? { status } : {}, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200, include: { subject: true, uploadedBy: { select: { name: true } }, file: { select: { size: true } } } }),
    subjectOptions(locale),
    prisma.course.findMany({ select: { id: true, title: true, subjectId: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title={a.resourcesTitle} subtitle={a.resourcesSubtitle} />
      <Tabs items={[{ href: "/admin/resources", label: t.common.all, active: !status }, ...STATUSES.map((s) => ({ href: `/admin/resources?status=${s}`, label: t.enums.publishStatus[s], active: s === status }))]} />
      <Card className="mb-6">
        {resources.length === 0 ? <EmptyState title={a.resourcesEmpty} /> : (
          <Table head={[t.common.title, a.subject, a.resourceType, a.access, a.author, t.common.status, t.common.actions]}>
            {resources.map((r) => (
              <tr key={r.id}>
                <Td>
                  <a href={`/api/resources/${r.id}/download`} className="font-medium hover:text-brand-700">{r.title}</a>
                  {r.isDemo && <Badge tone="yellow" className="ms-2">{t.common.demo}</Badge>}
                  <span className="block text-xs text-ink-muted">{r.file ? `${Math.round(r.file.size / 1024)} Ko` : "—"} · ↓ {r.downloadCount}</span>
                </Td>
                <Td>{localized(locale, r.subject.name, r.subject.nameAr)}</Td>
                <Td>{t.enums.resourceType[r.type]}</Td>
                <Td><ActionButton variant="ghost" action={setResourceAccessAction.bind(null, r.id, r.accessLevel === "FREE" ? "PREMIUM" : "FREE")}><Badge tone={r.accessLevel === "FREE" ? "green" : "gray"}>{t.enums.accessLevel[r.accessLevel]}</Badge></ActionButton></Td>
                <Td className="text-ink-muted">{r.uploadedBy?.name ?? "—"}</Td>
                <Td><Badge tone={STATUS_TONE[r.status]}>{t.enums.publishStatus[r.status]}</Badge></Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {r.status !== "PUBLISHED" && <ActionButton variant="primary" action={setResourceStatusAction.bind(null, r.id, "PUBLISHED")}>{a.publish}</ActionButton>}
                    {r.status === "PUBLISHED" && <ActionButton action={setResourceStatusAction.bind(null, r.id, "ARCHIVED")}>{a.archive}</ActionButton>}
                    <ActionButton variant="danger" confirmText={t.common.confirmAction} action={deleteResourceAction.bind(null, r.id)}>{t.common.delete}</ActionButton>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card>
        <CardTitle>{a.newResource}</CardTitle>
        <ResourceUploadForm subjects={options} courses={courses.map((c) => ({ id: c.id, label: c.title, subjectId: c.subjectId }))} isAdmin />
      </Card>
    </>
  );
}
