export interface SubscriptionState {
  plano: "free" | "premium";
  status: "trialing" | "pending" | "active" | "overdue" | "canceled" | "free";
  trialActive: boolean;
  trialDaysLeft: number;
  trialEndsAt: Date | null;
  premiumActive: boolean;
  isPro: boolean;
  ciclo: "mensal" | "anual" | null;
  billingCycle: "mensal" | "anual" | null;
  amount: number | null;
  nextDueDate: Date | null;
  paymentMethod: string | null;
  lastInvoiceUrl: string | null;
  subscriptionId: string | null;
  premiumUntil: Date | null;
}

/** Formato bruto da linha de `subscriptions` — mais permissivo que o tipo gerado do Supabase
 * porque algumas colunas (status, billing_cycle, amount...) foram adicionadas em migrations
 * posteriores à geração dos tipos e chegam como `unknown` na leitura. */
export interface SubscriptionRow {
  plano: string;
  ciclo?: string | null;
  trial_ends_at?: string | null;
  premium_until?: string | null;
  next_due_date?: string | null;
  status?: string | null;
  billing_cycle?: string | null;
  amount?: number | null;
  payment_method?: string | null;
  last_invoice_url?: string | null;
  subscription_id?: string | null;
}

export const defaultSubscriptionState = (): SubscriptionState => ({
  plano: "free",
  status: "free",
  trialActive: false,
  trialDaysLeft: 0,
  trialEndsAt: null,
  premiumActive: false,
  isPro: false,
  ciclo: null,
  billingCycle: null,
  amount: null,
  nextDueDate: null,
  paymentMethod: null,
  lastInvoiceUrl: null,
  subscriptionId: null,
  premiumUntil: null,
});

/**
 * Deriva o estado de assinatura (trial ativo, premium ativo, dias restantes) a partir da linha
 * crua de `subscriptions`. Lógica isolada da query do TanStack Query para ser testável sem mock
 * de Supabase — ver memoria-tecnica/decisoes para o motivo da extração.
 */
export function computeSubscriptionState(row: SubscriptionRow, now: number = Date.now()): SubscriptionState {
  const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const premiumUntil = row.premium_until ? new Date(row.premium_until) : null;
  const nextDueDate = row.next_due_date ? new Date(row.next_due_date) : null;
  const status = (row.status ?? "free") as SubscriptionState["status"];

  const trialActive = !!trialEndsAt && trialEndsAt.getTime() > now && row.plano !== "premium" && status !== "canceled";
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86400000)) : 0;
  const premiumActive = row.plano === "premium" && status === "active" && (!premiumUntil || premiumUntil.getTime() > now);

  return {
    plano: row.plano as "free" | "premium",
    status,
    trialActive,
    trialDaysLeft,
    trialEndsAt,
    premiumActive,
    isPro: premiumActive || trialActive,
    ciclo: (row.ciclo as SubscriptionState["ciclo"]) ?? null,
    billingCycle: (row.billing_cycle as SubscriptionState["billingCycle"]) ?? (row.ciclo as SubscriptionState["ciclo"]) ?? null,
    amount: row.amount ?? null,
    nextDueDate,
    paymentMethod: row.payment_method ?? null,
    lastInvoiceUrl: row.last_invoice_url ?? null,
    subscriptionId: row.subscription_id ?? null,
    premiumUntil,
  };
}
