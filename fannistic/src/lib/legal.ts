import type { Locale } from "@/lib/services/types";

export type LegalPage = "mentions-legales" | "confidentialite" | "conditions";

export interface LegalCompany {
  tradeName: string;
  legalName: string;
  legalForm: string;
  address: string;
  country: string;
  registration: string;
  vatNumber: string;
  director: string;
  email: string;
  phone: string;
  hosting: string;
}

interface Section {
  title: string;
  body: string[];
}

export interface LegalDoc {
  title: string;
  intro?: string;
  sections: Section[];
}

/**
 * Modèles de pages légales. Les informations de l'entreprise proviennent des réglages
 * (/admin/reglages) ; les champs vides sont signalés « à compléter ».
 * Ces textes sont une base de travail à faire valider selon le pays d'activité.
 */
export function legalDoc(page: LegalPage, locale: Locale, c: LegalCompany, missing: string): LegalDoc {
  const v = (s: string) => s.trim() || missing;
  const name = c.tradeName.trim() || "Fanni’stic";
  const contact = [c.email, c.phone].filter((x) => x.trim()).join(" · ") || missing;

  if (locale === "en") {
    if (page === "mentions-legales")
      return {
        title: "Legal notice",
        sections: [
          {
            title: "Publisher",
            body: [
              `${name} — ${v(c.legalName)} (${v(c.legalForm)})`,
              `Address: ${v(c.address)}, ${v(c.country)}`,
              `Registration: ${v(c.registration)} · VAT: ${v(c.vatNumber)}`,
              `Publication director: ${v(c.director)}`,
              `Contact: ${contact}`,
            ],
          },
          { title: "Hosting", body: [v(c.hosting)] },
          {
            title: "Intellectual property",
            body: [`All content on this site (texts, logos, visuals, code) belongs to ${name} or its clients and may not be reused without prior written permission.`],
          },
        ],
      };
    if (page === "confidentialite")
      return {
        title: "Privacy policy",
        intro: `This policy explains how ${name} handles the personal data you share through this site.`,
        sections: [
          { title: "Data controller", body: [`${v(c.legalName)}, ${v(c.address)}. Contact: ${contact}.`] },
          {
            title: "Data collected",
            body: [
              "Contact details you enter (name, email, phone, company, country), your project answers, attached files and messages.",
              "For client accounts: name, email and a securely hashed password.",
              "For security: a pseudonymised (hashed) IP address used to prevent abusive submissions.",
            ],
          },
          { title: "Purposes and legal basis", body: ["Handling your request, preparing and following up quotes, and managing your client area — on the basis of your consent and pre-contractual steps you request."] },
          { title: "Recipients", body: [`Only the ${name} team. Technical providers (hosting, email delivery) process data on our behalf. Your data is never sold.`] },
          { title: "Retention", body: ["Data is kept for as long as needed to handle your project, then archived or deleted within the limits set by applicable law."] },
          { title: "Cookies", body: ["The site uses only essential cookies: session (signed in) and language preference. No advertising or tracking cookies."] },
          { title: "Your rights", body: [`You may access, correct, delete or port your data, and object to its processing, by writing to ${contact}. You may also contact your data protection authority.`] },
        ],
      };
    return {
      title: "Terms and conditions",
      sections: [
        { title: "Purpose", body: [`These terms govern the use of the ${name} website and quote requests made through it.`] },
        { title: "Quote requests", body: ["Sending a request through the configurator is free and non-binding. Any estimate shown is indicative; only the quote sent by our team is authoritative."] },
        { title: "Quotes and acceptance", body: ["Each quote specifies the scope, deliverables, number of revisions, timeline, price and payment terms. Accepting a quote online records your agreement; specific conditions stated in the quote prevail."] },
        { title: "Intellectual property", body: ["The transfer of rights on final deliverables is set out in each quote. Preliminary work and unselected proposals remain the property of the studio unless otherwise agreed."] },
        { title: "Liability", body: ["The client guarantees they hold the rights to the content they provide (texts, images, logos)."] },
        { title: "Contact", body: [contact] },
      ],
    };
  }

  if (locale === "ar") {
    if (page === "mentions-legales")
      return {
        title: "الإشعار القانوني",
        sections: [
          {
            title: "ناشر الموقع",
            body: [
              `${name} — ${v(c.legalName)} (${v(c.legalForm)})`,
              `العنوان: ${v(c.address)}، ${v(c.country)}`,
              `رقم التسجيل: ${v(c.registration)} · الرقم الضريبي: ${v(c.vatNumber)}`,
              `مدير النشر: ${v(c.director)}`,
              `التواصل: ${contact}`,
            ],
          },
          { title: "الاستضافة", body: [v(c.hosting)] },
          { title: "الملكية الفكرية", body: [`جميع محتويات هذا الموقع (نصوص، شعارات، تصاميم، شيفرة) مملوكة لـ ${name} أو لعملائه، ولا يجوز إعادة استخدامها دون إذن كتابي مسبق.`] },
        ],
      };
    if (page === "confidentialite")
      return {
        title: "سياسة الخصوصية",
        intro: `توضح هذه السياسة كيفية تعامل ${name} مع البيانات الشخصية التي تشاركها عبر هذا الموقع.`,
        sections: [
          { title: "المسؤول عن المعالجة", body: [`${v(c.legalName)}، ${v(c.address)}. التواصل: ${contact}.`] },
          {
            title: "البيانات المجمعة",
            body: [
              "بيانات التواصل التي تدخلها (الاسم، البريد الإلكتروني، الهاتف، الشركة، البلد)، وإجاباتك حول المشروع، والملفات المرفقة والرسائل.",
              "لحسابات العملاء: الاسم والبريد الإلكتروني وكلمة مرور مشفرة بشكل آمن.",
              "للأمان: عنوان IP مُموَّه (مشفر) لمنع الإرسال المسيء.",
            ],
          },
          { title: "الأغراض والأساس القانوني", body: ["معالجة طلبك، وإعداد عروض الأسعار ومتابعتها، وإدارة فضاء العملاء، بناءً على موافقتك والإجراءات السابقة للتعاقد التي تطلبها."] },
          { title: "المستفيدون", body: [`فريق ${name} فقط. يعالج مزودو الخدمات التقنية (الاستضافة، إرسال البريد) البيانات نيابة عنا. لا نبيع بياناتك أبدًا.`] },
          { title: "مدة الاحتفاظ", body: ["نحتفظ بالبيانات طوال المدة اللازمة لمعالجة مشروعك، ثم تُؤرشف أو تُحذف في الحدود التي يفرضها القانون المعمول به."] },
          { title: "ملفات تعريف الارتباط", body: ["يستخدم الموقع ملفات ضرورية فقط: الجلسة (تسجيل الدخول) وتفضيل اللغة. لا توجد ملفات إعلانية أو تتبعية."] },
          { title: "حقوقك", body: [`يمكنك الاطلاع على بياناتك أو تصحيحها أو حذفها أو نقلها أو الاعتراض على معالجتها بالكتابة إلى ${contact}. يمكنك أيضًا التواصل مع هيئة حماية البيانات في بلدك.`] },
        ],
      };
    return {
      title: "الشروط العامة",
      sections: [
        { title: "الموضوع", body: [`تنظم هذه الشروط استخدام موقع ${name} وطلبات عروض الأسعار المرسلة من خلاله.`] },
        { title: "طلبات عروض الأسعار", body: ["إرسال طلب عبر أداة التكوين مجاني ودون أي التزام. أي تقدير معروض هو تقريبي، والعرض الذي يرسله فريقنا هو وحده المعتمد."] },
        { title: "العروض والقبول", body: ["يحدد كل عرض نطاق العمل والملفات المسلّمة وعدد التعديلات والمدة والسعر وشروط الدفع. يسجّل قبول العرض عبر الإنترنت موافقتك، وتسود الشروط الخاصة المذكورة في العرض."] },
        { title: "الملكية الفكرية", body: ["يُحدَّد نقل الحقوق على الأعمال النهائية في كل عرض. تبقى الأعمال التمهيدية والمقترحات غير المختارة ملكًا للاستوديو ما لم يُتفق على خلاف ذلك."] },
        { title: "المسؤولية", body: ["يضمن العميل امتلاكه لحقوق المحتوى الذي يقدمه (نصوص، صور، شعارات)."] },
        { title: "التواصل", body: [contact] },
      ],
    };
  }

  // Français
  if (page === "mentions-legales")
    return {
      title: "Mentions légales",
      sections: [
        {
          title: "Éditeur du site",
          body: [
            `${name} — ${v(c.legalName)} (${v(c.legalForm)})`,
            `Adresse : ${v(c.address)}, ${v(c.country)}`,
            `Immatriculation : ${v(c.registration)} · TVA : ${v(c.vatNumber)}`,
            `Directeur·rice de la publication : ${v(c.director)}`,
            `Contact : ${contact}`,
          ],
        },
        { title: "Hébergement", body: [v(c.hosting)] },
        { title: "Propriété intellectuelle", body: [`L’ensemble des contenus de ce site (textes, logos, visuels, code) appartient à ${name} ou à ses clients et ne peut être réutilisé sans autorisation écrite préalable.`] },
      ],
    };
  if (page === "confidentialite")
    return {
      title: "Politique de confidentialité",
      intro: `Cette politique explique comment ${name} traite les données personnelles que vous nous confiez via ce site.`,
      sections: [
        { title: "Responsable du traitement", body: [`${v(c.legalName)}, ${v(c.address)}. Contact : ${contact}.`] },
        {
          title: "Données collectées",
          body: [
            "Les coordonnées que vous saisissez (nom, e-mail, téléphone, entreprise, pays), vos réponses sur le projet, les fichiers joints et les messages échangés.",
            "Pour les comptes clients : nom, e-mail et mot de passe chiffré de manière irréversible.",
            "Pour la sécurité : une adresse IP pseudonymisée (hachée) servant à empêcher les envois abusifs.",
          ],
        },
        { title: "Finalités et base légale", body: ["Traiter votre demande, préparer et suivre les devis, gérer votre espace client — sur la base de votre consentement et des mesures précontractuelles que vous sollicitez."] },
        { title: "Destinataires", body: [`Uniquement l’équipe ${name}. Nos prestataires techniques (hébergement, envoi d’e-mails) traitent les données pour notre compte. Vos données ne sont jamais vendues.`] },
        { title: "Durée de conservation", body: ["Les données sont conservées le temps nécessaire au traitement de votre projet, puis archivées ou supprimées dans les limites prévues par la loi applicable."] },
        { title: "Cookies", body: ["Le site utilise uniquement des cookies indispensables : session (connexion) et préférence de langue. Aucun cookie publicitaire ni de mesure d’audience."] },
        { title: "Vos droits", body: [`Vous pouvez accéder à vos données, les rectifier, les supprimer, les récupérer ou vous opposer à leur traitement en écrivant à ${contact}. Vous pouvez également saisir l’autorité de protection des données de votre pays.`] },
      ],
    };
  return {
    title: "Conditions générales",
    sections: [
      { title: "Objet", body: [`Les présentes conditions encadrent l’utilisation du site ${name} et les demandes de devis effectuées par son intermédiaire.`] },
      { title: "Demandes de devis", body: ["L’envoi d’une demande via le configurateur est gratuit et sans engagement. Toute estimation affichée est indicative ; seul le devis transmis par notre équipe fait foi."] },
      { title: "Devis et acceptation", body: ["Chaque devis précise le périmètre, les livrables, le nombre de révisions, le délai, le prix et les modalités de paiement. L’acceptation en ligne d’un devis enregistre votre accord ; les conditions particulières du devis prévalent."] },
      { title: "Propriété intellectuelle", body: ["La cession des droits sur les créations finales est précisée dans chaque devis. Les travaux préparatoires et les propositions non retenues restent la propriété du studio, sauf accord contraire."] },
      { title: "Responsabilité", body: ["Le client garantit disposer des droits sur les contenus qu’il fournit (textes, images, logos)."] },
      { title: "Contact", body: [contact] },
    ],
  };
}
