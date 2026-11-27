import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | null = null;
/** Comparaison factice pour garder un temps de réponse constant quand l'email n'existe pas. */
export async function fakeVerify(plain: string): Promise<false> {
  dummyHash ??= bcrypt.hash("fanni-dummy-password", COST);
  await bcrypt.compare(plain, await dummyHash);
  return false;
}
