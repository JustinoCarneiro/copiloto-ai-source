import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import { getPaymentService, PLAN_PRICES } from "../_shared/payments/service.ts";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  cycle: z.enum(["mensal", "anual"]),
  cpfCnpj: z.string().min(11).max(18).optional(),
  phone: z.string().max(20).optional(),
});

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
    const name = profile?.nome ?? user.email?.split("@")[0] ?? "Usuário";
    const email = profile?.email ?? user.email ?? "";
    if (!email) return jsonResponse({ error: "Email não encontrado no perfil" }, 400);

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

    await supa.from("subscriptions").upsert({
      user_id: user.userId,
      gateway: service.name,
      customer_id: customerId,
      subscription_id: sub.subscriptionId,
      plano: "free", // vira "premium" via webhook após pagamento confirmado
      status: sub.status,
      amount,
      billing_cycle: cycle,
      ciclo: cycle,
      next_due_date: sub.nextDueDate,
      last_invoice_url: sub.invoiceUrl,
    }, { onConflict: "user_id" });

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
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
