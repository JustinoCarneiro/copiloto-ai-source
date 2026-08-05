// Lógica pura de decisão do mercadopago-webhook — extraída de mercadopago-webhook/index.ts pra
// ser testável sem chamar a API do Mercado Pago nem o Supabase. Cada função recebe os dados já
// buscados (fetchPreapproval/fetchPayment) e devolve o patch a aplicar em `subscriptions`.

export interface PreapprovalData {
  id: string;
  status: string; // já mapeado por mapPreapprovalStatus
  externalReference?: string;
  nextDueDate: string | null;
  amount?: number;
  initPoint?: string;
}

export interface PaymentData {
  id: string;
  status: string; // já mapeado por mapPaymentStatus
  amount?: number;
  preapprovalId: string | null;
  externalReference?: string;
  paymentMethod?: string;
  receiptUrl: string | null;
}

/**
 * Evento de assinatura (preapproval). `active` promove pra premium; `canceled` derruba pra
 * free e marca canceled_at. Qualquer outro status só atualiza o rastro (next_due_date,
 * last_invoice_url) sem mexer no plano.
 */
export function buildPreapprovalPatch(pre: PreapprovalData): Record<string, unknown> {
  const patch: Record<string, unknown> = { status: pre.status };
  if (pre.nextDueDate) patch.next_due_date = pre.nextDueDate;
  if (pre.initPoint) patch.last_invoice_url = pre.initPoint;
  if (pre.status === "active") patch.plano = "premium";
  if (pre.status === "canceled") {
    patch.plano = "free";
    patch.canceled_at = new Date().toISOString();
  }
  return patch;
}

/**
 * Evento de pagamento avulso. `active` promove pra premium e recalcula `premium_until` a partir
 * de "agora" + 1 ou 12 meses conforme o ciclo já salvo em `subscriptions.billing_cycle` — só
 * quando existe uma linha de assinatura pra basear o ciclo (`subRow` null = não recalcula).
 * `canceled` (pagamento recusado/estornado) rebaixa pra overdue, não cancela a assinatura
 * inteira — só a próxima cobrança falhou, o preapproval em si segue ativo até o MP decidir.
 */
export function buildPaymentPatch(
  pay: PaymentData,
  billingCycle: string | null | undefined,
  now: Date,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (pay.status === "active") {
    patch.plano = "premium";
    patch.status = "active";
    patch.payment_method = pay.paymentMethod;
    if (pay.receiptUrl) patch.last_invoice_url = pay.receiptUrl;
    if (billingCycle !== undefined) {
      const meses = billingCycle === "anual" ? 12 : 1;
      const until = new Date(now);
      until.setMonth(until.getMonth() + meses);
      patch.premium_until = until.toISOString();
    }
  } else if (pay.status === "canceled") {
    patch.status = "overdue";
  }
  return patch;
}
