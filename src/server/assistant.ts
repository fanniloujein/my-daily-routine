import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, addMinutesToTime, startOfWeek, today, type DateStr, formatTime } from "@/lib/dates";
import { findConflicts } from "@/lib/conflicts";
import { parseMessage, normalize, type AssistantAction, type ParseResult, type ParseContext } from "@/lib/nlp";
import { categoryForKind } from "./categories";
import { getOccurrences, patchOccurrence } from "./occurrences";
import { findSlot } from "./scheduling";
import { buildPlan, postponeOccurrence } from "./planning";
import { COLOR_PALETTE, GERMAN_OBJECTIVES } from "@/lib/constants";

// ───────────── Analyse : IA (facultative) puis repli sur l'analyseur local ─────────────

const actionSchema: z.ZodType<AssistantAction> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_activity"),
    data: z.object({
      title: z.string(),
      categoryKind: z.string().optional(),
      categoryName: z.string().optional(),
      date: z.string(),
      startTime: z.string().optional(),
      durationMin: z.number(),
      isFixed: z.boolean().optional(),
      priority: z.number().optional(),
      energyCost: z.number().optional(),
    }),
  }),
  z.object({ type: z.literal("prep_lesson"), data: z.object({ subject: z.string().optional(), studentName: z.string().optional(), date: z.string(), durationMin: z.number() }) }),
  z.object({ type: z.literal("weekly_goal"), data: z.object({ title: z.string(), categoryKind: z.string(), totalMinutes: z.number(), weekOf: z.string() }) }),
  z.object({
    type: z.literal("german_session"),
    data: z.object({ durationMin: z.number(), date: z.string(), startTime: z.string().optional(), topic: z.string(), objective: z.string() }),
  }),
  z.object({ type: z.literal("set_energy"), data: z.object({ energy: z.number().min(1).max(5), date: z.string() }) }),
  z.object({ type: z.literal("delete_activity"), data: z.object({ activityId: z.string().optional(), occurrenceDate: z.string().optional(), query: z.string().optional() }) }),
  z.object({ type: z.literal("create_category"), data: z.object({ name: z.string() }) }),
  z.object({ type: z.literal("plan_day"), data: z.object({ date: z.string(), light: z.boolean().optional() }) }),
  z.object({ type: z.literal("postpone_activity"), data: z.object({ activityId: z.string().optional(), occurrenceDate: z.string().optional(), query: z.string().optional() }) }),
]) as z.ZodType<AssistantAction>;

const llmResultSchema = z.object({ reply: z.string(), actions: z.array(actionSchema) });

const SYSTEM_PROMPT = `Tu es l'assistante de planification de « My Life OS », une application personnelle d'organisation.
Tu réponds toujours en français, avec un ton chaleureux, bref et jamais culpabilisant.
Tu transformes la demande en actions structurées que l'utilisatrice confirmera avant exécution.

Règles :
- N'invente jamais de disponibilité : pour trouver un créneau, omets startTime ; le serveur cherchera un vrai créneau libre.
- Ne déplace jamais un rendez-vous fixe.
- Pour une suppression, utilise delete_activity avec un "query" (titre) ou l'activityId fourni dans le contexte ; elle sera confirmée.
- Médicaments : ne recommande, ne modifie et n'interprète jamais un traitement. Si on te pose une question médicale, invite à consulter l'ordonnance ou un professionnel de santé, sans action.
- Dates au format AAAA-MM-JJ, heures HH:mm. Durées d'allemand : 15, 30, 45 ou 60 minutes.
- categoryKind possibles : tutoring, prep, freelance, german, sport, meds, rest, leisure, personal, admin, learning, other.
- topics d'allemand : VOCAB, GRAMMAR, EXPRESSIONS, INTERVIEW, LISTENING, SPEAKING, WRITING, ERRORS.
- Si la demande est floue, pose une question dans "reply" et renvoie actions: [].
Réponds uniquement avec l'objet JSON demandé.`;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "actions"],
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "data"],
        properties: {
          type: {
            type: "string",
            enum: ["create_activity", "prep_lesson", "weekly_goal", "german_session", "set_energy", "delete_activity", "create_category", "plan_day", "postpone_activity"],
          },
          data: {
            type: "object",
            additionalProperties: false,
            required: [],
            properties: {
              title: { type: "string" },
              categoryKind: { type: "string" },
              categoryName: { type: "string" },
              name: { type: "string" },
              date: { type: "string" },
              startTime: { type: "string" },
              durationMin: { type: "integer" },
              totalMinutes: { type: "integer" },
              weekOf: { type: "string" },
              isFixed: { type: "boolean" },
              priority: { type: "integer" },
              energyCost: { type: "integer" },
              subject: { type: "string" },
              studentName: { type: "string" },
              topic: { type: "string" },
              objective: { type: "string" },
              energy: { type: "integer" },
              activityId: { type: "string" },
              occurrenceDate: { type: "string" },
              query: { type: "string" },
              light: { type: "boolean" },
            },
          },
        },
      },
    },
  },
} as const;

export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function parseWithClaude(message: string, ctx: ParseContext, userId: string): Promise<ParseResult | null> {
  if (!aiEnabled()) return null;
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const todayOcc = await getOccurrences(userId, ctx.today, addDays(ctx.today, 1));
  const categories = await prisma.category.findMany({ where: { userId }, orderBy: { order: "asc" } });
  const context = {
    aujourdhui: ctx.today,
    jour: new Date().toLocaleDateString("fr-FR", { weekday: "long" }),
    derniereActivite: ctx.lastActivityId ? { activityId: ctx.lastActivityId, occurrenceDate: ctx.lastActivityDate } : null,
    categories: categories.map((c) => ({ nom: c.name, kind: c.kind })),
    agenda: todayOcc.map((o) => ({ id: o.id, date: o.date, titre: o.title, debut: o.startTime, fin: o.endTime, fixe: o.isFixed })),
  };
  try {
    // Le paramètre `fallbacks` (beta) relance automatiquement une requête refusée sur le modèle de repli recommandé.
    const params = {
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: "low", format: { type: "json_schema", schema: JSON_SCHEMA } },
      messages: [{ role: "user", content: `Contexte : ${JSON.stringify(context)}\n\nDemande : ${message}` }],
    };
    const response = (await client.beta.messages.create(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming)) as Anthropic.Beta.Messages.BetaMessage;
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const parsed = llmResultSchema.safeParse(JSON.parse(text.text));
    if (!parsed.success) return null;
    return { reply: parsed.data.reply, actions: parsed.data.actions, understood: parsed.data.actions.length > 0 };
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.warn(`Assistant IA indisponible (${e.status}) — repli sur l'analyseur local`);
    else console.warn("Assistant IA : réponse inexploitable — repli sur l'analyseur local");
    return null;
  }
}

export async function interpret(user: User, message: string, ctx: Omit<ParseContext, "today">) {
  const fullCtx = { ...ctx, today: today() };
  const ai = await parseWithClaude(message, fullCtx, user.id);
  const result = ai ?? parseMessage(message, fullCtx);
  const previews = await Promise.all(result.actions.map((a) => previewAction(user, a)));
  return { ...result, source: ai ? "ai" : "local", previews };
}

// ───────────── Aperçu (conflits, cible de suppression…) avant confirmation ─────────────

export type ActionPreview = { summary: string; warnings: string[]; destructive: boolean; resolved?: Record<string, unknown> };

async function findActivityByQuery(userId: string, query: string, date?: string) {
  const from = date ?? addDays(today(), -7);
  const to = date ?? addDays(today(), 30);
  const occ = await getOccurrences(userId, from, to);
  const q = normalize(query);
  const words = q.split(" ").filter((w) => w.length > 2 && !["les", "des", "une", "pour", "avec", "demain"].includes(w));
  const scored = occ
    .map((o) => {
      const t = normalize(`${o.title} ${o.category.name}`);
      return { o, score: words.filter((w) => t.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.o.date >= today() ? -1 : 1));
  return scored[0]?.o ?? null;
}

export async function previewAction(user: User, a: AssistantAction): Promise<ActionPreview> {
  const warnings: string[] = [];
  switch (a.type) {
    case "create_activity": {
      const d = a.data;
      if (d.startTime) {
        const end = addMinutesToTime(d.startTime, d.durationMin);
        const occ = await getOccurrences(user.id, d.date, d.date);
        const conflicts = findConflicts([...occ, { id: "new", title: d.title, startTime: d.startTime, endTime: end }]).filter(
          ([x, y]) => x.id === "new" || y.id === "new",
        );
        if (conflicts.length) {
          const other = conflicts.map(([x, y]) => (x.id === "new" ? y : x).title).join(", ");
          const alt =
            (await findSlot(user.id, { from: d.date, to: d.date, duration: d.durationMin, after: { date: d.date, time: d.startTime } })) ??
            (await findSlot(user.id, { from: d.date, to: d.date, duration: d.durationMin }));
          warnings.push(`Conflit avec : ${other}.${alt ? ` Créneau libre proposé : ${formatTime(alt.startTime)}.` : " Aucun autre créneau libre ce jour-là."}`);
          return { summary: `Ajouter « ${d.title} » le ${fmt(d.date)} à ${formatTime(d.startTime)}`, warnings, destructive: false, resolved: alt ? { alternative: alt } : {} };
        }
        return { summary: `Ajouter « ${d.title} » le ${fmt(d.date)} à ${formatTime(d.startTime)} (${d.durationMin} min)`, warnings, destructive: false };
      }
      return { summary: `Ajouter « ${d.title} » le ${fmt(d.date)}, sans horaire fixe (${d.durationMin} min)`, warnings, destructive: false };
    }
    case "delete_activity":
    case "postpone_activity": {
      const target = a.data.activityId
        ? (await getOccurrences(user.id, addDays(today(), -30), addDays(today(), 90))).find(
            (o) => o.id === a.data.activityId && (!a.data.occurrenceDate || o.originalDate === a.data.occurrenceDate),
          )
        : a.data.query
          ? await findActivityByQuery(user.id, a.data.query, a.data.occurrenceDate)
          : null;
      if (!target) return { summary: "Aucune activité correspondante trouvée.", warnings: ["Précise le nom ou utilise le planning."], destructive: false, resolved: { notFound: true } };
      if (a.type === "postpone_activity")
        return {
          summary: `Reporter « ${target.title} » (${fmt(target.date)}) au lendemain`,
          warnings: target.isFixed ? ["C'est un rendez-vous fixe : pense à prévenir les personnes concernées."] : [],
          destructive: false,
          resolved: { activityId: target.id, occurrenceDate: target.originalDate },
        };
      return {
        summary: `Supprimer « ${target.title} » du ${fmt(target.date)}${target.isRecurring ? " (cette occurrence uniquement)" : ""}`,
        warnings: target.isFixed ? ["Attention : c'est un rendez-vous fixe."] : [],
        destructive: true,
        resolved: { activityId: target.id, occurrenceDate: target.originalDate },
      };
    }
    case "weekly_goal":
      return { summary: `Réserver ${Math.round(a.data.totalMinutes / 6) / 10} h de « ${a.data.title} » cette semaine (créneaux libres uniquement)`, warnings, destructive: false };
    case "prep_lesson":
      return { summary: `Préparer un cours${a.data.subject ? ` de ${a.data.subject}` : ""}${a.data.studentName ? ` pour ${a.data.studentName}` : ""} (${a.data.durationMin} min)`, warnings, destructive: false };
    case "german_session":
      return { summary: `Session d'allemand de ${a.data.durationMin} min le ${fmt(a.data.date)} — ${a.data.objective}`, warnings, destructive: false };
    case "set_energy":
      return { summary: `Noter l'énergie du jour : ${a.data.energy}/5`, warnings, destructive: false };
    case "create_category": {
      const exists = await prisma.category.findFirst({ where: { userId: user.id, name: { equals: a.data.name, mode: "insensitive" } } });
      return { summary: `Créer la catégorie « ${a.data.name} »`, warnings: exists ? ["Une catégorie porte déjà ce nom."] : [], destructive: false };
    }
    case "plan_day":
      return { summary: `Proposer un planning ${a.data.light ? "léger " : ""}pour le ${fmt(a.data.date)}`, warnings, destructive: false };
  }
}

function fmt(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

// ───────────── Exécution (après confirmation) ─────────────

export async function executeAction(user: User, a: AssistantAction): Promise<{ message: string; activityId?: string; date?: string; plan?: unknown }> {
  switch (a.type) {
    case "create_activity": {
      const d = a.data;
      const cat = d.categoryName
        ? ((await prisma.category.findFirst({ where: { userId: user.id, name: { equals: d.categoryName, mode: "insensitive" } } })) ??
          (await categoryForKind(user.id, d.categoryKind ?? "other")))
        : await categoryForKind(user.id, d.categoryKind ?? "other");
      const act = await prisma.activity.create({
        data: {
          userId: user.id,
          categoryId: cat.id,
          title: d.title,
          date: d.date,
          startTime: d.startTime ?? null,
          endTime: d.startTime ? addMinutesToTime(d.startTime, d.durationMin) : null,
          durationMin: d.durationMin,
          isFixed: !!d.isFixed,
          priority: d.priority ?? 2,
          energyCost: d.energyCost ?? 2,
          reminders: cat.reminderMinutes != null && d.startTime ? [cat.reminderMinutes] : [],
        },
      });
      return { message: `« ${d.title} » ajoutée au planning.`, activityId: act.id, date: act.date };
    }
    case "prep_lesson": {
      const d = a.data;
      // Relier à la prochaine séance correspondante si elle existe
      const lesson = await prisma.lesson.findFirst({
        where: {
          userId: user.id,
          status: "PLANNED",
          date: { gte: d.date },
          ...(d.studentName ? { student: { name: { contains: d.studentName, mode: "insensitive" } } } : {}),
          ...(d.subject ? { subject: { contains: d.subject.slice(0, 5), mode: "insensitive" } } : {}),
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        include: { student: true },
      });
      const prep = await categoryForKind(user.id, "prep");
      const due = lesson?.date ?? null;
      const slot = await findSlot(user.id, {
        from: d.date,
        to: due ?? addDays(d.date, 2),
        duration: d.durationMin,
        before: lesson ? { date: lesson.date, time: lesson.startTime } : undefined,
      });
      const title = lesson
        ? `Préparer le cours — ${lesson.student.name} (${lesson.subject})`
        : `Préparer le cours${d.subject ? ` de ${d.subject}` : ""}${d.studentName ? ` pour ${d.studentName}` : ""}`;
      const act = await prisma.activity.create({
        data: {
          userId: user.id,
          categoryId: prep.id,
          title,
          date: slot?.date ?? d.date,
          startTime: slot?.startTime ?? null,
          endTime: slot?.endTime ?? null,
          durationMin: d.durationMin,
          priority: 3,
          dueDate: due,
          lessonId: lesson?.id ?? null,
          lessonRole: lesson ? "prep" : null,
          description: "• Relire le programme\n• Préparer une fiche de cours\n• Préparer des exemples simples\n• Préparer des exercices\n• Préparer les corrections\n• Vérifier le matériel nécessaire",
        },
      });
      return {
        message: `${title} : ${slot ? `réservé le ${fmt(slot.date)} à ${formatTime(slot.startTime)}` : "ajouté sans horaire (aucun créneau libre trouvé)"}${lesson ? `, avant la séance du ${fmt(lesson.date)}` : ""}.`,
        activityId: act.id,
        date: act.date,
      };
    }
    case "weekly_goal": {
      const d = a.data;
      const cat = await categoryForKind(user.id, d.categoryKind);
      const block = 60;
      let remaining = d.totalMinutes;
      const placed: string[] = [];
      const t = today();
      const end = addDays(startOfWeek(d.weekOf), 6);
      for (let day = t > d.weekOf ? t : d.weekOf; day <= end && remaining > 0; day = addDays(day, 1)) {
        const dur = Math.min(block, remaining);
        const slot = await findSlot(user.id, { from: day, to: day, duration: dur, workOnly: true });
        if (!slot) continue;
        await prisma.activity.create({
          data: { userId: user.id, categoryId: cat.id, title: d.title, date: slot.date, startTime: slot.startTime, endTime: slot.endTime, durationMin: dur, energyCost: 3, reminders: [10] },
        });
        placed.push(`${fmt(slot.date)} ${formatTime(slot.startTime)}`);
        remaining -= dur;
      }
      if (remaining > 0) {
        await prisma.activity.create({
          data: { userId: user.id, categoryId: cat.id, title: `${d.title} (à placer)`, date: end < t ? t : end, durationMin: remaining, energyCost: 3 },
        });
      }
      return {
        message: placed.length
          ? `Créneaux réservés : ${placed.join(", ")}.${remaining > 0 ? ` Il reste ${remaining} min sans créneau libre cette semaine (ajoutées à ta liste).` : ""}`
          : "Je n'ai trouvé aucun créneau libre cette semaine : j'ai ajouté la tâche à ta liste sans horaire.",
      };
    }
    case "german_session": {
      const d = a.data;
      const cat = await categoryForKind(user.id, "german");
      const slot = d.startTime ? null : await findSlot(user.id, { from: d.date, to: d.date, duration: d.durationMin });
      const start = d.startTime ?? slot?.startTime ?? null;
      const topic = ["VOCAB", "GRAMMAR", "EXPRESSIONS", "INTERVIEW", "LISTENING", "SPEAKING", "WRITING", "ERRORS"].includes(d.topic) ? d.topic : "VOCAB";
      const session = await prisma.germanSession.create({
        data: { userId: user.id, date: d.date, startTime: start, durationMin: [15, 30, 45, 60].includes(d.durationMin) ? d.durationMin : 30, topic, objective: d.objective || GERMAN_OBJECTIVES.VOCAB[0] },
      });
      const act = await prisma.activity.create({
        data: {
          userId: user.id,
          categoryId: cat.id,
          title: `Allemand — ${session.objective}`,
          date: d.date,
          startTime: start,
          endTime: start ? addMinutesToTime(start, session.durationMin) : null,
          durationMin: session.durationMin,
          germanSessionId: session.id,
          reminders: start ? [10] : [],
        },
      });
      return { message: `Session d'allemand ajoutée${start ? ` à ${formatTime(start)}` : " (sans horaire)"}.`, activityId: act.id, date: act.date };
    }
    case "set_energy": {
      await prisma.energyCheckin.upsert({
        where: { userId_date: { userId: user.id, date: a.data.date } },
        create: { userId: user.id, date: a.data.date, energy: a.data.energy },
        update: { energy: a.data.energy },
      });
      return { message: "Énergie du jour enregistrée." };
    }
    case "delete_activity": {
      const p = await previewAction(user, a);
      const r = p.resolved as { activityId?: string; occurrenceDate?: string } | undefined;
      if (!r?.activityId) return { message: "Aucune activité supprimée : je ne l'ai pas trouvée." };
      const act = await prisma.activity.findFirst({ where: { id: r.activityId, userId: user.id } });
      if (!act) return { message: "Activité introuvable." };
      if (act.recurrence !== "NONE" && r.occurrenceDate) await patchOccurrence(user.id, act.id, r.occurrenceDate, { cancelled: true });
      else await prisma.activity.delete({ where: { id: act.id } });
      return { message: `« ${act.title} » supprimée.` };
    }
    case "postpone_activity": {
      const p = await previewAction(user, a);
      const r = p.resolved as { activityId?: string; occurrenceDate?: string } | undefined;
      if (!r?.activityId) return { message: "Je n'ai pas trouvé l'activité à reporter." };
      await postponeOccurrence(user.id, r.activityId, r.occurrenceDate as DateStr);
      return { message: "Activité reportée au lendemain." };
    }
    case "create_category": {
      const exists = await prisma.category.findFirst({ where: { userId: user.id, name: { equals: a.data.name, mode: "insensitive" } } });
      if (exists) return { message: `La catégorie « ${exists.name} » existe déjà.` };
      const max = await prisma.category.aggregate({ where: { userId: user.id }, _max: { order: true } });
      const count = await prisma.category.count({ where: { userId: user.id } });
      await prisma.category.create({
        data: { userId: user.id, name: a.data.name, color: COLOR_PALETTE[count % COLOR_PALETTE.length], icon: "sparkles", order: (max._max.order ?? 0) + 1 },
      });
      return { message: `Catégorie « ${a.data.name} » créée. Tu peux changer sa couleur et son icône dans Catégories.` };
    }
    case "plan_day": {
      const plan = await buildPlan(user, a.data.date, { light: a.data.light });
      return { message: "Voici une proposition de planning. Tu peux l'ajuster avant de l'appliquer.", plan };
    }
  }
}
