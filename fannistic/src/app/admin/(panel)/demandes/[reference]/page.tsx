import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Mail, Phone } from "lucide-react";
import { prisma } from "@/server/db";
import { isMailConfigured } from "@/server/mail";
import { formatCents, formatDate, formatMoney, formatSize, getDict } from "@/i18n";
import { SnapshotView, type Snapshot } from "@/components/tracking/SnapshotView";
import { StatusBadge } from "@/components/tracking/StatusBadge";
import {
  DeleteFileButton,
  DeleteRequestButton,
  DeliverableUpload,
  NoteForm,
  QuoteEditor,
  StatusForm,
  TeamMessageForm,
  type QuoteDraft,
} from "@/components/admin/RequestPanel";

const fr = getDict("fr");
const QUOTE_LABELS = { DRAFT: "Brouillon", SENT: "Envoyé", ACCEPTED: "Accepté", REJECTED: "Refusé" } as const;

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }) {
  return { title: (await params).reference };
}

export default async function AdminRequestPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const r = await prisma.projectRequest.findUnique({
    where: { reference },
    include: {
      user: { select: { email: true } },
      events: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      quotes: { orderBy: { createdAt: "desc" } },
      messages: { orderBy: { createdAt: "asc" }, include: { files: { select: { id: true, originalName: true } } } },
      files: { where: { messageId: null }, select: { id: true, originalName: true, size: true, kind: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) notFound();
  const mailOn = isMailConfigured();
  const latest = r.quotes[0];
  const editorQuote: QuoteDraft | null =
    latest && latest.status !== "REJECTED"
      ? {
          id: latest.id,
          status: latest.status,
          items: latest.items as unknown as QuoteDraft["items"],
          message: latest.message,
          validUntil: latest.validUntil?.toISOString() ?? null,
          currency: latest.currency,
        }
      : null;
  const attachments = r.files.filter((f) => f.kind === "CLIENT_ATTACHMENT");
  const deliverables = r.files.filter((f) => f.kind === "DELIVERABLE");
  const dl = (id: string) => `/api/files/${id}?dl=1`;

  return (
    <div className="space-y-6">
      <Link href="/admin/demandes" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Toutes les demandes
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="eyebrow">{r.kind === "CALL" ? "Demande d’échange" : "Demande de devis"} · langue {r.locale.toUpperCase()}</p>
          <h1 className="mt-2 font-mono text-2xl sm:text-3xl">{r.reference}</h1>
          <p className="mt-1 text-sm text-ink-muted">Reçue le {formatDate(r.createdAt, "fr", true)}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={r.status} label={fr.status[r.status]} />
          <DeleteRequestButton id={r.id} reference={r.reference} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5" aria-labelledby="client">
            <h2 id="client" className="text-base">Client</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-muted">Nom</dt><dd className="font-medium">{r.name}</dd></div>
              <div><dt className="text-xs text-ink-muted">Entreprise</dt><dd>{r.company || "—"}</dd></div>
              <div>
                <dt className="text-xs text-ink-muted">E-mail</dt>
                <dd><a className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline" href={`mailto:${r.email}?subject=${encodeURIComponent(`Votre demande ${r.reference}`)}`}><Mail className="h-3.5 w-3.5" aria-hidden="true" />{r.email}</a></dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Téléphone</dt>
                <dd>{r.phone ? <a className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline" href={`tel:${r.phone.replace(/\s/g, "")}`}><Phone className="h-3.5 w-3.5" aria-hidden="true" />{r.phone}</a> : "—"}</dd>
              </div>
              <div><dt className="text-xs text-ink-muted">Pays</dt><dd>{r.country}</dd></div>
              <div><dt className="text-xs text-ink-muted">Contact préféré</dt><dd>{fr.configurator.contactPrefs[r.contactPref as keyof typeof fr.configurator.contactPrefs] ?? r.contactPref}</dd></div>
              <div><dt className="text-xs text-ink-muted">Compte client</dt><dd>{r.user ? r.user.email : "Sans compte (lien de suivi)"}</dd></div>
              <div>
                <dt className="text-xs text-ink-muted">Estimation affichée</dt>
                <dd>{r.estimateMin != null && r.estimateMax != null ? `${formatMoney(r.estimateMin, r.currency, "fr")} – ${formatMoney(r.estimateMax, r.currency, "fr")}` : "Devis personnalisé"}</dd>
              </div>
              {r.comments && (
                <div className="sm:col-span-2"><dt className="text-xs text-ink-muted">Commentaires</dt><dd className="whitespace-pre-line">{r.comments}</dd></div>
              )}
            </dl>
          </section>

          <section className="card p-5" aria-labelledby="answers">
            <h2 id="answers" className="mb-4 text-base">Réponses du configurateur</h2>
            <SnapshotView snapshot={r.snapshot as unknown as Snapshot} locale="fr" d={fr} currency={r.currency} />
          </section>

          <section className="card p-5" aria-labelledby="files">
            <h2 id="files" className="text-base">Fichiers joints par le client</h2>
            {attachments.length ? (
              <ul className="mt-3 space-y-1">
                {attachments.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <a href={dl(f.id)} className="inline-flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper-2">
                      <Download className="h-4 w-4 text-ink-muted" aria-hidden="true" /> <span className="truncate">{f.originalName}</span>
                      <span className="text-xs text-ink-muted">{formatSize(f.size, "fr")}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Aucun fichier.</p>
            )}
          </section>

          <section className="card p-5" aria-labelledby="msgs">
            <h2 id="msgs" className="text-base">Échanges avec le client</h2>
            {r.messages.length ? (
              <ol className="mt-4 space-y-3">
                {r.messages.map((m) => (
                  <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.authorRole === "TEAM" ? "ms-auto bg-midnight text-white" : "bg-paper-2"}`}>
                    <p className={`text-xs font-semibold ${m.authorRole === "TEAM" ? "text-gold-sun" : "text-cyan-deep"}`}>
                      {m.authorRole === "TEAM" ? "Équipe" : r.name} · {formatDate(m.createdAt, "fr", true)}
                    </p>
                    {m.body && <p className="mt-1 whitespace-pre-line break-words">{m.body}</p>}
                    {m.files.map((f) => (
                      <a key={f.id} href={dl(f.id)} className="mt-1 flex items-center gap-1.5 underline underline-offset-2"><Download className="h-3.5 w-3.5" aria-hidden="true" />{f.originalName}</a>
                    ))}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Aucun message.</p>
            )}
            <TeamMessageForm id={r.id} mailOn={mailOn} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="status">
            <h2 id="status" className="mb-3 text-base">Suivi</h2>
            <StatusForm id={r.id} current={r.status} labels={fr.status} mailOn={mailOn} />
            <ol className="mt-5 space-y-2 border-t border-line pt-4 text-xs text-ink-2">
              {r.events.map((e) => (
                <li key={e.id}>
                  <span className="font-semibold">{fr.status[e.to]}</span> · {formatDate(e.createdAt, "fr", true)}
                  {e.note && <span className="block text-ink-muted">{e.note}</span>}
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-5" aria-labelledby="quote">
            <h2 id="quote" className="mb-3 text-base">
              Devis {latest && <span className="badge ms-2 bg-paper-2 text-ink-2">{QUOTE_LABELS[latest.status]}</span>}
            </h2>
            {latest?.status === "REJECTED" && (
              <p className="mb-3 rounded-lg bg-paper-2 px-3 py-2 text-xs text-ink-2">
                Dernier devis refusé{latest.clientNote ? ` : « ${latest.clientNote} »` : ""}. Vous pouvez en préparer un nouveau.
              </p>
            )}
            {latest?.status === "ACCEPTED" && latest.clientNote && <p className="mb-3 text-xs text-ink-2">Remarque du client : « {latest.clientNote} »</p>}
            <QuoteEditor key={editorQuote?.id ?? "new"} requestId={r.id} quote={editorQuote} currency={r.currency} mailOn={mailOn} />
            {r.quotes.length > 1 && (
              <details className="mt-4 text-xs text-ink-2">
                <summary className="cursor-pointer font-medium">Historique des devis ({r.quotes.length})</summary>
                <ul className="mt-2 space-y-1">
                  {r.quotes.map((q) => (
                    <li key={q.id}>{formatDate(q.createdAt, "fr")} · {formatCents(q.total, q.currency, "fr")} · {QUOTE_LABELS[q.status]}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="card p-5" aria-labelledby="deliv">
            <h2 id="deliv" className="text-base">Fichiers livrés</h2>
            <p className="mt-1 text-xs text-ink-muted">Visibles et téléchargeables par le client dans son espace de suivi.</p>
            {deliverables.length > 0 && (
              <ul className="mt-3 space-y-1">
                {deliverables.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <a href={dl(f.id)} className="flex-1 truncate underline-offset-2 hover:underline">{f.originalName}</a>
                    <span className="text-xs text-ink-muted">{formatSize(f.size, "fr")}</span>
                    <DeleteFileButton fileId={f.id} name={f.originalName} />
                  </li>
                ))}
              </ul>
            )}
            <DeliverableUpload id={r.id} />
          </section>

          <section className="card p-5" aria-labelledby="notes">
            <h2 id="notes" className="text-base">Notes internes</h2>
            <NoteForm id={r.id} />
            <ul className="mt-4 space-y-3">
              {r.notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-gold-soft/60 px-3 py-2 text-sm">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-muted">{n.author?.name ?? "—"} · {formatDate(n.createdAt, "fr", true)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
