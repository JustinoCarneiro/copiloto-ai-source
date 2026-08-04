import type {
  CreateCustomerInput,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentProvider,
  SubscriptionStatus,
  WebhookEvent,
} from "./types.ts";

const BASE = "https://api.mercadopago.com";

function mapPreapprovalStatus(s?: string): SubscriptionStatus {
  const v = (s ?? "").toLowerCase();
  if (v === "authorized") return "active";
  if (v === "paused") return "overdue";
  if (v === "cancelled" || v === "canceled") return "canceled";
  if (v === "pending") return "pending";
  return "pending";
}

function mapPaymentStatus(s?: string): SubscriptionStatus {
  const v = (s ?? "").toLowerCase();
  if (v === "approved") return "active";
  if (v === "in_process" || v === "pending" || v === "authorized") return "pending";
  if (v === "rejected" || v === "cancelled" || v === "refunded" || v === "charged_back") return "canceled";
  return "pending";
}

export class MercadoPagoProvider implements PaymentProvider {
  name = "mercadopago";
  private token: string;
  private backUrl: string;

  constructor(token: string, backUrl: string) {
    this.token = token;
    this.backUrl = backUrl;
  }

  private async req(path: string, init: RequestInit = {}) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      console.error("MercadoPago error", res.status, data);
      throw new Error(data?.message ?? `MercadoPago ${res.status}`);
    }
    return data;
  }

  // Em MP a "customer" é opcional para preapproval — basta o email do pagador.
  // Retornamos o próprio email como customerId para casar com o contrato.
  async createCustomer(input: CreateCustomerInput) {
    return { customerId: input.email };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const frequency = input.cycle === "anual" ? 12 : 1;
    const body = {
      reason: input.description,
      external_reference: input.externalReference,
      payer_email: input.customerId, // guardamos email como customerId
      back_url: this.backUrl,
      auto_recurring: {
        frequency,
        frequency_type: "months",
        transaction_amount: Number(input.amount.toFixed(2)),
        currency_id: "BRL",
      },
      status: "pending",
    };
    const data = await this.req("/preapproval", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      subscriptionId: data.id,
      status: mapPreapprovalStatus(data.status),
      nextDueDate: data.next_payment_date ? String(data.next_payment_date).slice(0, 10) : null,
      checkoutUrl: data.init_point ?? null,
      invoiceUrl: data.init_point ?? null,
    };
  }

  async cancelSubscription(id: string) {
    await this.req(`/preapproval/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });
  }

  async getSubscription(id: string): Promise<CreateSubscriptionResult> {
    const d = await this.req(`/preapproval/${id}`);
    return {
      subscriptionId: d.id,
      status: mapPreapprovalStatus(d.status),
      nextDueDate: d.next_payment_date ? String(d.next_payment_date).slice(0, 10) : null,
      checkoutUrl: d.init_point ?? null,
      invoiceUrl: d.init_point ?? null,
    };
  }

  parseWebhook(raw: unknown): WebhookEvent {
    const r = raw as Record<string, any>;
    const type = String(r?.type ?? r?.topic ?? "");
    const action = String(r?.action ?? "");
    const id = r?.data?.id ?? r?.id;
    return {
      event: `${type}${action ? "." + action : ""}`.toUpperCase() || type.toUpperCase(),
      raw,
      subscriptionId: type.startsWith("preapproval") || type === "subscription_preapproval" ? String(id ?? "") : undefined,
      paymentId: type === "payment" ? String(id ?? "") : undefined,
    };
  }

  // Métodos auxiliares específicos do MP usados pelo webhook.
  async fetchPreapproval(id: string) {
    const d = await this.req(`/preapproval/${id}`);
    return {
      id: d.id as string,
      status: mapPreapprovalStatus(d.status),
      rawStatus: d.status as string,
      externalReference: d.external_reference as string | undefined,
      payerEmail: d.payer_email as string | undefined,
      nextDueDate: d.next_payment_date ? String(d.next_payment_date).slice(0, 10) : null,
      amount: d.auto_recurring?.transaction_amount as number | undefined,
      initPoint: d.init_point as string | undefined,
    };
  }

  async fetchPayment(id: string) {
    const d = await this.req(`/v1/payments/${id}`);
    return {
      id: String(d.id),
      status: mapPaymentStatus(d.status),
      rawStatus: d.status as string,
      amount: d.transaction_amount as number | undefined,
      preapprovalId: (d.metadata?.preapproval_id ?? d.point_of_interaction?.transaction_data?.subscription_id ?? null) as string | null,
      externalReference: d.external_reference as string | undefined,
      paymentMethod: d.payment_method_id as string | undefined,
      payerEmail: d.payer?.email as string | undefined,
      receiptUrl: (d.transaction_details?.external_resource_url ?? null) as string | null,
    };
  }
}
