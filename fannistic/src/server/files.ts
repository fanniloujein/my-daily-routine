import "server-only";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
export const MAX_FILES = 5;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type Detected = { mime: string; ext: string };

const startsWith = (buf: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => buf[offset + i] === b);

/** Détecte le vrai type d'un fichier d'après son contenu (et non d'après son nom). */
export function sniff(buf: Uint8Array, name: string): Detected | null {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", ext: "webp" };
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return { mime: "image/gif", ext: "gif" };
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) {
    // Les fichiers Illustrator récents sont des PDF.
    return ext === "ai" ? { mime: "application/postscript", ext: "ai" } : { mime: "application/pdf", ext: "pdf" };
  }
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    const office: Record<string, string> = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
    if (office[ext]) return { mime: office[ext], ext };
    return { mime: "application/zip", ext: "zip" };
  }
  if (ext === "txt") {
    // Texte brut : pas d'octet nul et UTF-8 valide.
    if (buf.includes(0)) return null;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
      return { mime: "text/plain; charset=utf-8", ext: "txt" };
    } catch {
      return null;
    }
  }
  return null;
}

export const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function safeName(name: string) {
  const cleaned = name.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  return (cleaned || "fichier").slice(0, 140);
}

export type FileCheck =
  | { ok: true; name: string; mime: string; size: number; data: Uint8Array<ArrayBuffer> }
  | { ok: false; name: string; reason: "tooBig" | "badType" };

export async function checkUpload(file: File, opts: { imagesOnly?: boolean; maxSize?: number } = {}): Promise<FileCheck> {
  const name = safeName(file.name);
  const max = opts.maxSize ?? MAX_FILE_SIZE;
  if (file.size > max) return { ok: false, name, reason: "tooBig" };
  const data = new Uint8Array(await file.arrayBuffer());
  if (data.length > max) return { ok: false, name, reason: "tooBig" };
  const detected = sniff(data, name);
  if (!detected || (opts.imagesOnly && !IMAGE_MIMES.has(detected.mime))) return { ok: false, name, reason: "badType" };
  return { ok: true, name, mime: detected.mime, size: data.length, data };
}

/** Récupère les fichiers d'un FormData (champ « files »). */
export function formFiles(form: FormData, field = "files"): File[] {
  return form.getAll(field).filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && (f as File).size > 0);
}
