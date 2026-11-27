import Link from "next/link";
import type { PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { localized } from "@/lib/i18n/config";
import { formatDate } from "@/lib/time";
import { subjectOptions } from "@/server/admin-options";
import { Badge, Card, CardTitle, EmptyState, PageHeader, Table, Tabs, Td } from "@/components/ui";
import { CourseForm } from "@/components/client/ContentForms";
import { STATUS_TONE } from "@/components/CourseEditor";

const STATUSES: PublishStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as PublishStatus) ? (sp.status as PublishStatus) : undefined;
  const [courses, options] = await Promise.all([
    prisma.course.findMany({ where: status ? { status } : {}, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], include: { subject: true, author: { select: { name: true, role: true } }, _count: { select: { lessons: true } } } }),
    subjectOptions(locale),
  ]);
  return (
    <>
      <PageHeader title={a.coursesTitle} subtitle={a.coursesSubtitle} />
      <Tabs items={[{ href: "/admin/courses", label: t.common.all, active: !status }, ...STATUSES.map((s) => ({ href: `/admin/courses?status=${s}`, label: t.enums.publishStatus[s], active: s === status }))]} />
      <Card className="mb-6">
        {courses.length === 0 ? <EmptyState title={a.coursesEmpty} /> : (
          <Table head={[a.courseTitle, a.subject, a.lessons, a.access, a.author, t.common.status]}>
            {courses.map((c) => (
              <tr key={c.id}>
                <Td><Link href={`/admin/courses/${c.id}`} className="font-medium hover:text-brand-700">{c.title}</Link>{c.isDemo && <Badge tone="yellow" className="ms-2">{t.common.demo}</Badge>}<span className="block text-xs text-ink-muted">{formatDate(c.updatedAt, locale)}</span></Td>
                <Td>{localized(locale, c.subject.name, c.subject.nameAr)}</Td>
                <Td>{c._count.lessons}</Td>
                <Td><Badge tone={c.accessLevel === "FREE" ? "green" : "gray"}>{t.enums.accessLevel[c.accessLevel]}</Badge></Td>
                <Td className="text-ink-muted">{c.author ? `${c.author.name} (${t.enums.role[c.author.role]})` : "—"}</Td>
                <Td><Badge tone={STATUS_TONE[c.status]}>{t.enums.publishStatus[c.status]}</Badge></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card>
        <CardTitle>{a.newCourse}</CardTitle>
        <CourseForm subjects={options} isAdmin redirectBase="/admin/courses" />
      </Card>
    </>
  );
}
