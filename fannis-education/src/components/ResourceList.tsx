import { Download, ExternalLink, FileText, Lock } from "lucide-react";
import type { EducationalResource, Subject } from "@prisma/client";
import { fmt, localized, type AppLocale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";
import { Badge, buttonClasses } from "@/components/ui";

export function ResourceList({
  items,
  t,
  locale,
  canOpen,
}: {
  items: (EducationalResource & { subject?: Subject })[];
  t: Dict;
  locale: AppLocale;
  canOpen: (r: EducationalResource) => boolean;
}) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((r) => {
        const open = canOpen(r);
        return (
          <li key={r.id} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-soft">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sun-100 text-sun-700"><FileText className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug">{r.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone="blue">{t.enums.resourceType[r.type]}</Badge>
                {r.subject && <Badge>{localized(locale, r.subject.name, r.subject.nameAr)}</Badge>}
                <Badge tone={r.accessLevel === "FREE" ? "green" : "gray"}>{t.enums.accessLevel[r.accessLevel]}</Badge>
                {r.isDemo && <Badge tone="yellow">{t.common.demo}</Badge>}
              </div>
              {r.description && <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{r.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!open ? (
                  <a href="/student/subscription" className={buttonClasses("sun", "sm")}><Lock className="h-4 w-4" aria-hidden /> {t.common.lockedTitle}</a>
                ) : r.fileId ? (
                  <a href={`/api/resources/${r.id}/download`} className={buttonClasses("secondary", "sm")}><Download className="h-4 w-4" aria-hidden /> {t.common.download}</a>
                ) : null}
                <span className="text-xs text-ink-muted">{fmt(t.student.downloads, { count: r.downloadCount })}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export { ExternalLink };
