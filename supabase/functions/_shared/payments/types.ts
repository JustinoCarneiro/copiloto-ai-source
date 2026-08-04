// Contrato agnóstico de gateway. Nenhum consumidor deve importar Asaas direto.

export type BillingCycle = "mensal" | "anual";

export type SubscriptionStatus =
  | "trialing"
  | "pending"
  | "active"
  | "overdue"
  | "canceled"
  | "free";

export interface CreateCustomerInput {
  userId: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

export interface CreateSubscriptionInput {
  customerId: string;
  cycle: BillingCycle;
  amount: number;
  description: string;
  externalReference: string; // user_id
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  status: SubscriptionStatus;
  nextDueDate: string | null;
  checkoutUrl: string | null;
  invoiceUrl: string | null;
}

export interface WebhookEvent {
  event: string;
  raw: unknown;
  customerId?: string;
  subscriptionId?: string;
  paymentId?: string;
  status?: string;
  amount?: number;
  invoiceUrl?: string;
  nextDueDate?: string;
  paymentMethod?: string;
  externalReference?: string;
}

export interface PaymentProvider {
  name: string;
  createCustomer(input: CreateCustomerInput): Promise<{ customerId: string }>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getSubscription(subscriptionId: string): Promise<CreateSubscriptionResult>;
  parseWebhook(raw: unknown): WebhookEvent;
}
