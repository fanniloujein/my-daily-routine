import { route } from "@/lib/api";
import { hasDemo, loadDemo, removeDemo } from "@/server/demo";

export const GET = route(async ({ user }) => ({ hasDemo: await hasDemo(user.id) }));
export const POST = route(async ({ user }) => {
  if (await hasDemo(user.id)) await removeDemo(user.id);
  return loadDemo(user.id);
});
export const DELETE = route(async ({ user }) => removeDemo(user.id));
