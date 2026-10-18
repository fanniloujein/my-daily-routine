"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { fmt, type Dict } from "@/i18n";

/** Zone de saisie d'un message (avec pièces jointes), partagée par le client et l'administration. */
export function MessageComposer({
  endpoint,
  token,
  d,
  placeholder,
  extraFields,
}: {
  endpoint: string;
  token?: string | null;
  d: Dict;
  placeholder: string;
  extraFields?: (form: FormData) => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && !files.length) return;
    setBusy(true);
    setErr(null);
    const form = new FormData();
    form.set("body", body);
    if (token) form.set("t", token);
    files.forEach((f) => form.append("files", f));
    extraFields?.(form);
    try {
      const res = await fetch(endpoint, { method: "POST", body: form });
      if (res.status === 429) throw new Error(d.common.tooMany);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.name ? fmt(data.reason === "tooBig" ? d.configurator.fileTooBig : d.configurator.fileBadType, { name: data.name, size: 10 }) : d.common.error,
        );
      }
      setBody("");
      setFiles([]);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message || d.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4">
      <label htmlFor="msg-body" className="sr-only">{placeholder}</label>
      <textarea id="msg-body" className="input" rows={3} maxLength={5000} placeholder={placeholder} value={body} onChange={(e) => setBody(e.target.value)} />
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="badge bg-paper-2 py-1 text-ink-2">
              {f.name}
              <button type="button" aria-label={`${d.common.remove} ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={() => input.current?.click()}>
          <Paperclip className="h-4 w-4" aria-hidden="true" /> {d.tracking.attach}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.ai,.docx,.xlsx,.pptx,.zip,.txt"
          onChange={(e) => {
            setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 5));
            e.target.value = "";
          }}
        />
        <button type="submit" className="btn-dark btn-sm" disabled={busy || (!body.trim() && !files.length)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />}
          {d.tracking.sendMessage}
        </button>
      </div>
      {err && <p className="field-error" role="alert">{err}</p>}
    </form>
  );
}
