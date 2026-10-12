import { HttpError } from "@/lib/auth";
import { route } from "@/lib/api";
import { importData } from "@/server/backup";

export const POST = route(async ({ req, user }) => {
  const text = await req.text();
  if (text.length > 20_000_000) throw new HttpError(413, "Fichier trop volumineux");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Le fichier n'est pas un JSON valide");
  }
  return importData(user.id, json);
});
