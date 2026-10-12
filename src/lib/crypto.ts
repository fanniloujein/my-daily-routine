import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Chiffrement applicatif AES-256-GCM des données de santé.
// Format stocké : "v1:<iv base64>:<tag base64>:<données base64>"

function getKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("DATA_ENCRYPTION_KEY manquante : impossible de chiffrer les données de santé.");
  if (raw.length < 16) throw new Error("DATA_ENCRYPTION_KEY trop courte (16 caractères minimum).");
  const key = Buffer.from(raw, "base64");
  // 32 octets en base64 : utilisés tels quels ; sinon (ex. valeur générée par l'hébergeur) on dérive une clé SHA-256.
  return key.length === 32 ? key : createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1" || !iv || !tag || data === undefined) throw new Error("Format chiffré invalide");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function encryptOpt(v?: string | null): string | null {
  return v ? encrypt(v) : null;
}

export function decryptOpt(v?: string | null): string | null {
  if (!v) return null;
  try {
    return decrypt(v);
  } catch {
    return "⚠️ Donnée illisible (clé de chiffrement modifiée ?)";
  }
}
