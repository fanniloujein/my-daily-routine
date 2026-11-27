import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";

export interface PlatformSettings {
  contactEmail: string;
  contactPhone: string;
  paymentInstructions: string;
  paymentInstructionsAr: string;
  enabledPaymentMethods: PaymentMethod[];
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  contactEmail: "contact@example.com",
  contactPhone: "",
  paymentInstructions:
    "Les coordonnées de paiement seront communiquées par l'équipe. Indique bien ton nom et ton email dans la référence.",
  paymentInstructionsAr: "سيقدّم الفريق معطيات الدفع. اذكر اسمك وبريدك الإلكتروني في المرجع.",
  enabledPaymentMethods: ["BANK_TRANSFER", "POSTAL_TRANSFER", "MOBILE_WALLET"],
};

export async function getSettings(): Promise<PlatformSettings> {
  const rows = await prisma.platformSetting.findMany();
  const out: PlatformSettings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in out) (out as unknown as Record<string, unknown>)[r.key] = r.value;
  }
  return out;
}

export async function saveSettings(values: Partial<PlatformSettings>) {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.platformSetting.upsert({
        where: { key },
        update: { value: value as never },
        create: { key, value: value as never },
      }),
    ),
  );
}
