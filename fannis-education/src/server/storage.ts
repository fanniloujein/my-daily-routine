/**
 * Stockage des fichiers PDF. Implémentation MVP : table StoredFile (PostgreSQL bytea),
 * qui fonctionne chez tout hébergeur, y compris à disque éphémère.
 * Pour passer à un stockage objet (S3, R2…), implémenter FileStorage et remplacer `storage`.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface FileStorage {
  save(input: { filename: string; mimeType: string; bytes: Uint8Array }): Promise<string>;
  read(id: string): Promise<{ filename: string; mimeType: string; bytes: Uint8Array } | null>;
}

const dbStorage: FileStorage = {
  async save({ filename, mimeType, bytes }) {
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const f = await prisma.storedFile.create({
      data: { filename, mimeType, size: bytes.byteLength, sha256, data: new Uint8Array(bytes) },
      select: { id: true },
    });
    return f.id;
  },
  async read(id) {
    const f = await prisma.storedFile.findUnique({ where: { id } });
    return f ? { filename: f.filename, mimeType: f.mimeType, bytes: new Uint8Array(f.data) } : null;
  },
};

export const storage: FileStorage = dbStorage;

/** Vérifie taille, extension et signature réelle du fichier (« %PDF- »). */
export function assertPdf(bytes: Uint8Array, filename: string) {
  if (bytes.byteLength === 0) throw new AppError("fileRequired");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new AppError("fileTooLarge");
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (header !== "%PDF-" || !/\.pdf$/i.test(filename)) throw new AppError("fileType");
}

export function safeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

export async function savePdfUpload(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new AppError("fileTooLarge");
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertPdf(bytes, file.name);
  return storage.save({ filename: safeFilename(file.name), mimeType: "application/pdf", bytes });
}
