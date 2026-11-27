/**
 * Architecture de paiement prête pour une passerelle tunisienne.
 *
 * MVP : seul le fournisseur « manual » est actif. L'élève déclare un paiement (référence),
 * un administrateur le vérifie. AUCUNE confirmation automatique n'est jamais générée.
 *
 * Pour brancher une passerelle :
 *  1. implémenter PaymentProvider (createCheckout + parseWebhook avec vérification de signature) ;
 *  2. l'enregistrer dans `providers` ;
 *  3. exposer /api/payments/webhook/[provider] qui appelle parseWebhook puis
 *     confirmPayment() (src/server/subscriptions.ts) uniquement si la signature est valide
 *     ET si le montant/la devise correspondent au paiement en base.
 */
import type { Payment } from "@prisma/client";

export interface CheckoutSession {
  redirectUrl: string;
  providerPaymentId: string;
}

export interface WebhookEvent {
  providerPaymentId: string;
  status: "CONFIRMED" | "FAILED";
  amountMillimes: number;
  currency: string;
}

export interface PaymentProvider {
  id: string;
  /** Les paiements nécessitent-ils une vérification humaine ? */
  requiresManualVerification: boolean;
  createCheckout?(payment: Payment, returnUrl: string): Promise<CheckoutSession>;
  parseWebhook?(request: Request): Promise<WebhookEvent | null>;
}

export const manualProvider: PaymentProvider = {
  id: "manual",
  requiresManualVerification: true,
};

const providers: Record<string, PaymentProvider> = { manual: manualProvider };

export function getProvider(id: string): PaymentProvider | null {
  return providers[id] ?? null;
}
