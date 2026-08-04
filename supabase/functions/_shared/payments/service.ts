// PaymentService — fachada única. Todo consumidor usa esta camada.
// Arquitetura desacoplada: trocar de gateway = plugar outro provider aqui.
import type { PaymentProvider } from "./types.ts";
import { MercadoPagoProvider } from "./mercadopago.ts";

let cached: PaymentProvider | null = null;

export function getPaymentService(): PaymentProvider {
  if (cached) return cached;
  const gateway = (Deno.env.get("PAYMENT_GATEWAY") ?? "mercadopago").toLowerCase();
  switch (gateway) {
    case "mercadopago": {
      const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
      if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurada");
      const backUrl = Deno.env.get("APP_URL") ?? "https://copilotofinance.lovable.app/assinatura";
      cached = new MercadoPagoProvider(token, backUrl);
      return cached;
    }
    // Prontos para plugar sem tocar no resto:
    // case "stripe":   return new StripeProvider(...)
    // case "asaas":    return new AsaasProvider(...)
    // case "pagseguro":return new PagSeguroProvider(...)
    default:
      throw new Error(`Gateway não suportado: ${gateway}`);
  }
}

export const PLAN_PRICES = {
  mensal: 19.9,
  anual: 199.9,
} as const;
