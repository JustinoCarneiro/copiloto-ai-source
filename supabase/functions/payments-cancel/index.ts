import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import { getPaymentService } from "../_shared/payments/service.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const supa = serviceClient();
    const { data: sub } = await supa.from("subscriptions").select("*").eq("user_id", user.userId).maybeSingle();
    if (!sub?.subscription_id) return jsonResponse({ error: "Sem assinatura ativa" }, 404);

    const service = getPaymentService();
    await service.cancelSubscription(sub.subscription_id);

    await supa.from("subscriptions").update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    }).eq("user_id", user.userId);

    await supa.from("payment_logs").insert({
      user_id: user.userId,
      subscription_id: sub.id,
      event: "SUBSCRIPTION_CANCELED_BY_USER",
      status: "canceled",
      payload: { subscription_id: sub.subscription_id },
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("payments-cancel", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
