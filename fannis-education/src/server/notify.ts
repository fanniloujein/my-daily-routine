import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dictionaries } from "@/lib/i18n/dict";
import { fmt } from "@/lib/i18n/config";
import type { Db } from "./db";

type NotifyKey = Exclude<keyof (typeof dictionaries)["fr"]["notify"], "noReason">;

const TYPE_BY_KEY: Record<NotifyKey, NotificationType> = {
  subscriptionActivated: "SUBSCRIPTION_ACTIVATED",
  subscriptionExpiring: "SUBSCRIPTION_EXPIRING",
  subscriptionExpired: "SUBSCRIPTION_EXPIRED",
  paymentRejected: "PAYMENT_REJECTED",
  paymentRefunded: "PAYMENT_REFUNDED",
  bookingRequested: "BOOKING_REQUESTED",
  bookingAccepted: "BOOKING_ACCEPTED",
  bookingRejected: "BOOKING_REJECTED",
  bookingCancelled: "BOOKING_CANCELLED",
  bookingCompleted: "BOOKING_COMPLETED",
  teacherApproved: "TEACHER_APPROVED",
  teacherRejected: "TEACHER_REJECTED",
  reviewReceived: "REVIEW_RECEIVED",
};

/**
 * Crée une notification in-app dans la langue de l'utilisateur.
 * `vars` peut être une fonction recevant la langue (pour formater dates et montants).
 * Point d'extension : envoi d'email/SMS ici plus tard.
 */
export async function notify(
  userId: string,
  key: NotifyKey,
  vars: Record<string, string | number> | ((locale: "fr" | "ar") => Record<string, string | number>) = {},
  link?: string,
  db: Db = prisma,
) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  if (!user) return;
  const locale = user.locale === "AR" ? "ar" : "fr";
  const dict = dictionaries[locale].notify;
  const v = typeof vars === "function" ? vars(locale) : vars;
  const filled = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === "" ? dict.noReason : val]));
  await db.notification.create({
    data: {
      userId,
      type: TYPE_BY_KEY[key],
      title: fmt(dict[key].title, filled),
      body: fmt(dict[key].body, filled),
      link,
    },
  });
}
