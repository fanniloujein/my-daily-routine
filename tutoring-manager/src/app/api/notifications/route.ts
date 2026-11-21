import { route } from "@/lib/api";
import { syncNotifications } from "@/server/notifications";

const RANK = { DANGER: 0, WARNING: 1, INFO: 2 } as Record<string, number>;

export const GET = route(async () => {
  const items = await syncNotifications();
  return items.sort((a, b) => Number(!!a.readAt) - Number(!!b.readAt) || RANK[a.severity] - RANK[b.severity] || +b.createdAt - +a.createdAt);
});
