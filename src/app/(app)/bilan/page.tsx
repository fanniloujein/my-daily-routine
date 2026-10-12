"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, ChevronLeft, ChevronRight, Compass, Flag, Lightbulb, RefreshCw, Rocket, Sparkles, Trophy } from "lucide-react";
import { Button, Card, Loading, PageHeader, useUi } from "@/components/ui";
import { api, fmtDayNum, useApi } from "@/lib/client";
import { addDays, startOfWeek, today } from "@/lib/dates";

type Review = {
  id: string;
  weekStart: string;
  reflection: string | null;
  content: { accomplished: string[]; projects: string[]; goals: string[]; postponed: string[]; priorities: string[]; suggestions: string[] };
};

export default function BilanPage() {
  const { toast } = useUi();
  const [week, setWeek] = useState(startOfWeek(today()));
  const list = useApi<Review[]>("/api/reviews");
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [reflection, setReflection] = useState("");

  async function generate(ws = week) {
    setLoading(true);
    try {
      const r = await api<Review>("/api/reviews", { body: { weekStart: ws } });
      setReview(r);
      setReflection(r.reflection ?? "");
      list.mutate();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "danger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!list.data) return;
    const existing = list.data.find((r) => r.weekStart === week);
    if (existing) {
      setReview(existing);
      setReflection(existing.reflection ?? "");
    } else generate(week);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, list.data === undefined]);

  const sections: { key: keyof Review["content"]; title: string; icon: React.ReactNode; tone: string }[] = [
    { key: "accomplished", title: "Ce que j'ai accompli", icon: <Trophy className="h-4 w-4" />, tone: "text-success" },
    { key: "projects", title: "Projets qui ont avancé", icon: <Rocket className="h-4 w-4" />, tone: "text-primary-strong" },
    { key: "goals", title: "Objectifs", icon: <Flag className="h-4 w-4" />, tone: "text-lavender" },
    { key: "postponed", title: "Activités reportées", icon: <RefreshCw className="h-4 w-4" />, tone: "text-warning" },
    { key: "priorities", title: "Priorités de la semaine prochaine", icon: <Compass className="h-4 w-4" />, tone: "text-primary-strong" },
    { key: "suggestions", title: "Suggestions réalistes", icon: <Lightbulb className="h-4 w-4" />, tone: "text-lavender" },
  ];

  return (
    <div>
      <PageHeader
        title="Bilan de la semaine"
        subtitle="Un regard bienveillant sur ta semaine. Une semaine calme n'est jamais un échec."
        actions={
          <Button variant="secondary" onClick={() => generate()} loading={loading}>
            <Sparkles className="h-4 w-4" /> Actualiser le bilan
          </Button>
        }
      />
      <div className="mb-5 flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => setWeek(addDays(week, -7))} aria-label="Semaine précédente">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium text-ink">
          Semaine du {fmtDayNum(week)} au {fmtDayNum(addDays(week, 6))}
        </span>
        <Button size="icon" variant="ghost" onClick={() => setWeek(addDays(week, 7))} disabled={week >= startOfWeek(today())} aria-label="Semaine suivante">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      {!review || loading ? (
        <Loading label="Je prépare ton bilan…" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {sections.map((s) =>
            review.content[s.key]?.length ? (
              <Card key={s.key} title={<span className={s.tone}>{s.title}</span>} icon={s.icon}>
                <ul className="space-y-2 text-sm text-ink-2">
                  {review.content[s.key].map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted">•</span> {l}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null,
          )}
          <Card title="Mon ressenti" icon={<BookOpenCheck className="h-4 w-4" />} className="md:col-span-2">
            <textarea className="input min-h-[100px]" placeholder="Ce qui m'a fait du bien, ce que je veux garder, ce que je veux alléger…" value={reflection} onChange={(e) => setReflection(e.target.value)} />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                onClick={async () => {
                  await api(`/api/reviews/${review.id}`, { method: "PATCH", body: { reflection } });
                  toast("Ressenti enregistré");
                }}
              >
                Enregistrer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
