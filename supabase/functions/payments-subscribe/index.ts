import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import { getPaymentService, PLAN_PRICES } from "../_shared/payments/service.ts";
import { BodySchema, buildSubscriptionUpsertPayload, resolveCustomerIdentity } from "./logic.ts";
import { reportError } from "../_shared/errorReporting.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    const { cycle, cpfCnpj, phone } = parsed.data;

    const supa = serviceClient();
    const { data: profile } = await supa.from("profiles").select("nome,email").eq("user_id", user.userId).maybeSingle();
    const identity = resolveCustomerIdentity(profile, user);
    if ("error" in identity) return jsonResponse({ error: identity.error }, 400);
    const { name, email } = identity;

    const { data: existing } = await supa.from("subscriptions").select("*").eq("user_id", user.userId).maybeSingle();

    const service = getPaymentService();
    let customerId = existing?.customer_id as string | null;
    if (!customerId) {
      const c = await service.createCustomer({ userId: user.userId, name, email, cpfCnpj, phone });
      customerId = c.customerId;
    }

    // Se já tem assinatura ativa no mesmo ciclo, retorna a URL da fatura pendente
    const amount = PLAN_PRICES[cycle];
    const sub = await service.createSubscription({
      customerId,
      cycle,
      amount,
      description: `Copiloto AI Premium (${cycle})`,
      externalReference: user.userId,
    });

    await supa.from("subscriptions").upsert(
      buildSubscriptionUpsertPayload({
        userId: user.userId, gateway: service.name, customerId, subscriptionId: sub.subscriptionId,
        status: sub.status, amount, cycle, nextDueDate: sub.nextDueDate, invoiceUrl: sub.invoiceUrl,
      }),
      { onConflict: "user_id" },
    );

    await supa.from("payment_logs").insert({
      user_id: user.userId,
      event: "SUBSCRIPTION_CREATED",
      status: sub.status,
      amount,
      payload: { cycle, subscriptionId: sub.subscriptionId, customerId },
    });

    return jsonResponse({
      subscriptionId: sub.subscriptionId,
      checkoutUrl: sub.checkoutUrl,
      status: sub.status,
    });
  } catch (e) {
    console.error("payments-subscribe", e);
    void reportError(e, "payments-subscribe");
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
