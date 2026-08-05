// Lógica pura de payments-subscribe — extraída de index.ts (que tem Deno.serve() no escopo do
// módulo; importar esse arquivo direto num teste dispararia o listener como efeito colateral).
import { z } from "npm:zod@3.23.8";

export const BodySchema = z.object({
  cycle: z.enum(["mensal", "anual"]),
  cpfCnpj: z.string().min(11).max(18).optional(),
  phone: z.string().max(20).optional(),
});

export interface ProfileRow {
  nome?: string | null;
  email?: string | null;
}

export interface AuthedUser {
  userId: string;
  email?: string;
}

export type CustomerIdentity = { name: string; email: string } | { error: string };

/**
 * Resolve nome/email pra criar o cliente no gateway: prioriza o perfil (profiles), cai pro
 * claim do JWT se o perfil não tiver. Sem e-mail em lugar nenhum, não dá pra criar assinatura.
 */
export function resolveCustomerIdentity(profile: ProfileRow | null, user: AuthedUser): CustomerIdentity {
  const name = profile?.nome ?? user.email?.split("@")[0] ?? "Usuário";
  const email = profile?.email ?? user.email ?? "";
  if (!email) return { error: "Email não encontrado no perfil" };
  return { name, email };
}

export interface SubscriptionUpsertInput {
  userId: string;
  gateway: string;
  customerId: string;
  subscriptionId: string;
  status: string;
  amount: number;
  cycle: "mensal" | "anual";
  nextDueDate: string | null;
  invoiceUrl: string | null;
}

/**
 * plano sempre nasce "free" aqui mesmo quando o gateway já devolve status "active" — só o
 * webhook (fonte de verdade pós-confirmação de pagamento) promove pra "premium". Ver
 * buildPreapprovalPatch/buildPaymentPatch em _shared/payments/webhookLogic.ts.
 */
export function buildSubscriptionUpsertPayload(input: SubscriptionUpsertInput) {
  return {
    user_id: input.userId,
    gateway: input.gateway,
    customer_id: input.customerId,
    subscription_id: input.subscriptionId,
    plano: "free",
    status: input.status,
    amount: input.amount,
    billing_cycle: input.cycle,
    ciclo: input.cycle,
    next_due_date: input.nextDueDate,
    last_invoice_url: input.invoiceUrl,
  };
}
