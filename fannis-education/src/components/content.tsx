import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui";
import type { Dict } from "@/lib/i18n/dict";

/** Rendu sûr du texte de leçon (aucun HTML interprété) : « ## titre », « - liste », **gras**. */
export function LessonContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>);
    para = [];
    list = [];
  };
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("## ")) { flush(); blocks.push(<h2 key={blocks.length}>{line.slice(3)}</h2>); continue; }
    if (line.startsWith("- ")) { if (para.length) { const p = para; para = []; blocks.push(<p key={blocks.length}>{inline(p.join(" "))}</p>); } list.push(line.slice(2)); continue; }
    if (list.length) flush();
    para.push(line);
  }
  flush();
  return <div className="prose-lesson">{blocks}</div>;
}

export function LockedNotice({ t, href = "/student/subscription" }: { t: Dict; href?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-sun-200 bg-sun-50 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sun-700 shadow-soft"><Lock className="h-5 w-5" aria-hidden /></span>
      <p className="mt-3 font-semibold">{t.common.lockedTitle}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">{t.common.lockedBody}</p>
      <LinkButton href={href} variant="sun" className="mt-5">{t.common.subscribeCta}</LinkButton>
    </div>
  );
}
