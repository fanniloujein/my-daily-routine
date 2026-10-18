import "server-only";
import { Prisma, type Service, type PortfolioProject, type FaqItem } from "@prisma/client";
import { prisma } from "./db";
import { DEFAULT_SERVICES } from "@/lib/services/defaults";
import { tr, type L10n, type Question, type ServiceDef } from "@/lib/services/types";

const SEED_KEY = "seed.v1";

const DEFAULT_FAQ: { question: L10n; answer: L10n }[] = [
  {
    question: tr("Quels sont les délais de réalisation ?", "How long does a project take?", "ما هي مدة الإنجاز؟"),
    answer: tr(
      "Ils dépendent de la nature et de l’ampleur du projet. Le délai précis est indiqué dans chaque devis, et vous pouvez nous signaler une date limite dans le configurateur.",
      "It depends on the type and scope of the project. The exact timeline is stated in each quote, and you can tell us about any deadline in the configurator.",
      "تعتمد على طبيعة المشروع وحجمه. تُحدَّد المدة بدقة في كل عرض سعر، ويمكنك إعلامنا بأي موعد نهائي عبر أداة التكوين.",
    ),
  },
  {
    question: tr("Combien coûte un projet ?", "How much does a project cost?", "كم تبلغ تكلفة المشروع؟"),
    answer: tr(
      "Chaque projet est chiffré selon vos besoins réels. Lorsque des tarifs sont disponibles, le configurateur affiche une estimation indicative ; le devis final est toujours confirmé après étude.",
      "Each project is priced according to your actual needs. When rates are available, the configurator shows an indicative estimate; the final quote is always confirmed after review.",
      "يُسعَّر كل مشروع حسب احتياجاتك الفعلية. عند توفر الأسعار، تعرض أداة التكوين تقديرًا تقريبيًا، ويتم تأكيد عرض السعر النهائي دائمًا بعد الدراسة.",
    ),
  },
  {
    question: tr("Combien de révisions sont prévues ?", "How many revisions are included?", "كم عدد التعديلات المشمولة؟"),
    answer: tr(
      "Le nombre de séries de modifications incluses est précisé dans votre devis, afin que vous sachiez exactement à quoi vous attendre.",
      "The number of revision rounds included is stated in your quote, so you know exactly what to expect.",
      "يُحدَّد عدد جولات التعديل المشمولة في عرض السعر، لتعرف بالضبط ما يمكنك توقعه.",
    ),
  },
  {
    question: tr("Quels fichiers vais-je recevoir ?", "Which files will I receive?", "ما الملفات التي سأستلمها؟"),
    answer: tr(
      "Les formats livrés sont listés dans le devis selon la prestation (par exemple PNG, SVG ou PDF pour un logo). Les fichiers finaux sont téléchargeables depuis votre espace de suivi.",
      "Delivered formats are listed in the quote depending on the service (for example PNG, SVG or PDF for a logo). Final files can be downloaded from your tracking space.",
      "تُذكر الصيغ المسلّمة في عرض السعر حسب الخدمة (مثل PNG أو SVG أو PDF للشعار). ويمكن تنزيل الملفات النهائية من فضاء المتابعة.",
    ),
  },
  {
    question: tr("Comment se déroule un projet ?", "How does a project unfold?", "كيف يسير المشروع؟"),
    answer: tr(
      "Vous configurez votre demande, nous l’étudions et vous envoyons une proposition. Après acceptation, nous créons, vous validez les étapes clés, puis nous livrons les fichiers finaux.",
      "You configure your request, we study it and send you a proposal. Once accepted, we create, you approve the key milestones, then we deliver the final files.",
      "تُكوّن طلبك، فندرسه ونرسل لك عرضًا. بعد القبول نبدأ التصميم، وتوافق على المراحل الأساسية، ثم نسلّم الملفات النهائية.",
    ),
  },
  {
    question: tr("Quelles informations dois-je fournir ?", "What information should I provide?", "ما المعلومات التي يجب تقديمها؟"),
    answer: tr(
      "Le configurateur vous guide : il ne pose que les questions utiles à votre projet. Vous pouvez répondre « Je ne sais pas, conseillez-moi » et joindre vos références, logo ou contenus.",
      "The configurator guides you and only asks what matters for your project. You can answer “I’m not sure, advise me” and attach references, logo or content.",
      "ترشدك أداة التكوين ولا تطرح إلا الأسئلة المفيدة لمشروعك. يمكنك الإجابة بـ«لا أعرف، انصحوني» وإرفاق مراجعك أو شعارك أو المحتوى.",
    ),
  },
  {
    question: tr("Proposez-vous la maintenance des sites ?", "Do you offer website maintenance?", "هل تقدمون خدمة صيانة المواقع؟"),
    answer: tr(
      "Les possibilités de maintenance et de mises à jour peuvent être discutées et intégrées à votre devis selon vos besoins.",
      "Maintenance and update options can be discussed and included in your quote according to your needs.",
      "يمكن مناقشة خيارات الصيانة والتحديث وإدراجها في عرض السعر حسب احتياجاتك.",
    ),
  },
];

let seeding: Promise<void> | null = null;

/** Insère la configuration initiale une seule fois (supprimer une FAQ ne la recrée pas). */
function ensureSeeded() {
  seeding ??= seed().catch((e) => {
    seeding = null;
    // Une autre instance a pu insérer les mêmes données au même moment.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  });
  return seeding;
}

async function seed() {
  const flag = await prisma.setting.findUnique({ where: { key: SEED_KEY } });
  if (flag) return;
  await prisma.$transaction(async (tx) => {
    const again = await tx.setting.findUnique({ where: { key: SEED_KEY } });
    if (again) return;
    for (const s of DEFAULT_SERVICES) {
      await tx.service.upsert({
        where: { slug: s.slug },
        update: {},
        create: {
          slug: s.slug,
          icon: s.icon,
          active: s.active,
          order: s.order,
          name: s.name,
          description: s.description,
          baseMin: s.baseMin,
          baseMax: s.baseMax,
          questions: s.questions as unknown as Prisma.InputJsonValue,
        },
      });
    }
    if ((await tx.faqItem.count()) === 0) {
      await tx.faqItem.createMany({ data: DEFAULT_FAQ.map((f, i) => ({ ...f, order: i })) });
    }
    await tx.setting.create({ data: { key: SEED_KEY, value: true } });
  });
}

export function toServiceDef(s: Service): ServiceDef {
  return {
    slug: s.slug,
    icon: s.icon,
    active: s.active,
    order: s.order,
    name: s.name as L10n,
    description: s.description as L10n,
    baseMin: s.baseMin,
    baseMax: s.baseMax,
    questions: (s.questions as unknown as Question[]) ?? [],
  };
}

export async function getServices(opts: { activeOnly?: boolean } = {}): Promise<ServiceDef[]> {
  await ensureSeeded();
  const rows = await prisma.service.findMany({
    where: opts.activeOnly ? { active: true } : undefined,
    orderBy: [{ order: "asc" }, { slug: "asc" }],
  });
  return rows.map(toServiceDef);
}

export interface FaqView {
  id: string;
  question: L10n;
  answer: L10n;
  order: number;
  published: boolean;
}

export const toFaq = (f: FaqItem): FaqView => ({ ...f, question: f.question as L10n, answer: f.answer as L10n });

export async function getFaq(opts: { publishedOnly?: boolean } = {}): Promise<FaqView[]> {
  await ensureSeeded();
  const rows = await prisma.faqItem.findMany({
    where: opts.publishedOnly ? { published: true } : undefined,
    orderBy: { order: "asc" },
  });
  return rows.map(toFaq);
}

export const PORTFOLIO_CATEGORIES = ["web", "logo", "identity", "catalog", "card", "other"] as const;
export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

export interface ProjectView {
  id: string;
  slug: string;
  category: PortfolioCategory;
  title: L10n;
  summary: L10n;
  body: L10n;
  services: string[];
  results: L10n | null;
  client: string | null;
  year: number | null;
  imageIds: string[];
  published: boolean;
  order: number;
}

export const toProject = (p: PortfolioProject): ProjectView => ({
  id: p.id,
  slug: p.slug,
  category: (PORTFOLIO_CATEGORIES as readonly string[]).includes(p.category) ? (p.category as PortfolioCategory) : "other",
  title: p.title as L10n,
  summary: p.summary as L10n,
  body: p.body as L10n,
  services: p.services,
  results: (p.results as L10n | null) ?? null,
  client: p.client,
  year: p.year,
  imageIds: p.imageIds,
  published: p.published,
  order: p.order,
});

export async function getPortfolio(opts: { publishedOnly?: boolean } = {}): Promise<ProjectView[]> {
  const rows = await prisma.portfolioProject.findMany({
    where: opts.publishedOnly ? { published: true } : undefined,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toProject);
}
