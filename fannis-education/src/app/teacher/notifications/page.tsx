import { requireUser } from "@/lib/auth/session";
import { NotificationsPage } from "@/components/Notifications";

export default async function Page() {
  return <NotificationsPage user={await requireUser("TEACHER")} />;
}
