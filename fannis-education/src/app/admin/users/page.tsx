import type { Prisma, Role } from "@prisma/client";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/time";
import { setUserStatusAction } from "@/actions/admin";
import { Badge, Button, Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { Pagination, qs } from "@/components/Pagination";

const PER = 50;
const ROLES: Role[] = ["STUDENT", "TEACHER", "ADMIN"];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const me = await requireUser("ADMIN");
  const { t, locale } = await getI18n();
  const a = t.admin;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const role = ROLES.includes(sp.role as Role) ? (sp.role as Role) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { studentProfile: { include: { level: true } } } }),
    prisma.user.count({ where }),
  ]);
  return (
    <>
      <PageHeader title={a.usersTitle} />
      <form className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-soft sm:grid-cols-[1fr_200px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder={a.usersSearch} className="input ps-9" aria-label={t.common.search} />
        </label>
        <select name="role" defaultValue={role ?? ""} className="input" aria-label="role">
          <option value="">{t.common.all}</option>
          {ROLES.map((r) => <option key={r} value={r}>{t.enums.role[r]}</option>)}
        </select>
        <Button type="submit">{t.common.filter}</Button>
      </form>
      {users.length === 0 ? <EmptyState title={a.usersEmpty} /> : (
        <Card>
          <Table head={[t.common.name, a.role, t.common.createdAt, a.lastLogin, t.common.status, t.common.actions]}>
            {users.map((u) => (
              <tr key={u.id}>
                <Td><p className="font-medium">{u.name}</p><p className="text-xs text-ink-muted" dir="ltr">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p></Td>
                <Td><Badge tone={u.role === "ADMIN" ? "yellow" : u.role === "TEACHER" ? "blue" : "gray"}>{t.enums.role[u.role]}</Badge>{u.studentProfile?.level && <span className="block text-xs text-ink-muted">{u.studentProfile.level.name}</span>}</Td>
                <Td className="text-ink-muted">{formatDate(u.createdAt, locale)}</Td>
                <Td className="text-ink-muted">{u.lastLoginAt ? formatDate(u.lastLoginAt, locale) : "—"}</Td>
                <Td><Badge tone={u.status === "ACTIVE" ? "green" : "red"}>{t.enums.userStatus[u.status]}</Badge></Td>
                <Td>
                  {u.id !== me.id && (u.status === "ACTIVE"
                    ? <ActionButton variant="danger" confirmText={t.common.confirmAction} action={setUserStatusAction.bind(null, u.id, "SUSPENDED")}>{a.suspend}</ActionButton>
                    : <ActionButton action={setUserStatusAction.bind(null, u.id, "ACTIVE")}>{a.reactivate}</ActionButton>)}
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <Pagination t={t} page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => qs("/admin/users", { q, role, page: p })} />
    </>
  );
}
