// Webhook Mercado Pago — público, validado por token na querystring.
// Configure a URL do webhook no painel MP como:
//   https://<PROJECT>.supabase.co/functions/v1/mercadopago-webhook?token=<MP_WEBHOOK_TOKEN>
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/auth.ts";
import { getPaymentService } from "../_shared/payments/service.ts";
import { MercadoPagoProvider } from "../_shared/payments/mercadopago.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const expected = Deno.env.get("MP_WEBHOOK_TOKEN");
  const got = url.searchParams.get("token") ?? req.headers.get("x-webhook-token");
  if (!expected || got !== expected) {
    console.warn("mercadopago-webhook: token inválido");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const service = getPaymentService() as MercadoPagoProvider;
    const evt = service.parseWebhook(raw);
    const supa = serviceClient();

    console.log("mp-webhook:", evt.event, evt.subscriptionId ?? evt.paymentId);

    let subRow: any = null;
    let patch: Record<string, unknown> = {};
    let userId: string | null = null;
    let logAmount: number | undefined = undefined;

    // Evento de assinatura (preapproval)
    if (evt.subscriptionId) {
      const pre = await service.fetchPreapproval(evt.subscriptionId).catch(() => null);
      if (pre) {
        const { data } = await supa
          .from("subscriptions")
          .select("*")
          .or(`subscription_id.eq.${pre.id}${pre.externalReference ? `,user_id.eq.${pre.externalReference}` : ""}`)
          .maybeSingle();
        subRow = data;
        userId = subRow?.user_id ?? pre.externalReference ?? null;
        logAmount = pre.amount;

        patch.status = pre.status;
        if (pre.nextDueDate) patch.next_due_date = pre.nextDueDate;
        if (pre.initPoint) patch.last_invoice_url = pre.initPoint;
        if (pre.status === "active") patch.plano = "premium";
        if (pre.status === "canceled") {
          patch.plano = "free";
          patch.canceled_at = new Date().toISOString();
        }
      }
    }

    // Evento de pagamento
    if (evt.paymentId) {
      const pay = await service.fetchPayment(evt.paymentId).catch(() => null);
      if (pay) {
        logAmount = pay.amount;
        const ref = pay.preapprovalId ?? pay.externalReference;
        if (ref) {
          const { data } = await supa
            .from("subscriptions")
            .select("*")
            .or(`subscription_id.eq.${ref},user_id.eq.${ref}`)
            .maybeSingle();
          subRow = data;
          userId = subRow?.user_id ?? pay.externalReference ?? null;
        }

        if (pay.status === "active") {
          patch.plano = "premium";
          patch.status = "active";
          patch.payment_method = pay.paymentMethod;
          if (pay.receiptUrl) patch.last_invoice_url = pay.receiptUrl;
          if (subRow) {
            const meses = subRow.billing_cycle === "anual" ? 12 : 1;
            const until = new Date();
            until.setMonth(until.getMonth() + meses);
            patch.premium_until = until.toISOString();
          }
        } else if (pay.status === "canceled") {
          patch.status = "overdue";
        }
      }
    }

    await supa.from("payment_logs").insert({
      user_id: userId,
      subscription_id: subRow?.id ?? null,
      gateway: "mercadopago",
      event: evt.event,
      status: (patch.status as string) ?? null,
      amount: logAmount,
      payload: raw,
    });

    if (subRow && Object.keys(patch).length > 0) {
      await supa.from("subscriptions").update(patch).eq("id", subRow.id);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("mercadopago-webhook error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
