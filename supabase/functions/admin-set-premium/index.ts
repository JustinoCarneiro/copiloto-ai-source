// Liberar / remover Premium manualmente. Requer role 'admin'.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient, isAdmin } from "../_shared/auth.ts";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["grant", "revoke"]),
  cycle: z.enum(["mensal", "anual"]).optional(),
  meses: z.number().int().min(1).max(60).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = await requireUser(req);
    if (!admin) return jsonResponse({ error: "Não autenticado" }, 401);

    const supa = serviceClient();
    const admin_ok = await isAdmin(admin.userId);
    if (!admin_ok) return jsonResponse({ error: "Acesso restrito" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    const { userId, action, cycle, meses } = parsed.data;

    if (action === "grant") {
      const meses_ = meses ?? (cycle === "anual" ? 12 : 1);
      const until = new Date();
      until.setMonth(until.getMonth() + meses_);
      await supa.from("subscriptions").upsert({
        user_id: userId,
        gateway: "manual",
        plano: "premium",
        status: "active",
        billing_cycle: cycle ?? "mensal",
        ciclo: cycle ?? "mensal",
        premium_until: until.toISOString(),
      }, { onConflict: "user_id" });
      await supa.from("payment_logs").insert({
        user_id: userId, gateway: "manual", event: "ADMIN_GRANT_PREMIUM",
        status: "active", payload: { by: admin.userId, meses: meses_, cycle: cycle ?? "mensal" },
      });
    } else {
      await supa.from("subscriptions").update({
        plano: "free", status: "canceled", canceled_at: new Date().toISOString(),
      }).eq("user_id", userId);
      await supa.from("payment_logs").insert({
        user_id: userId, gateway: "manual", event: "ADMIN_REVOKE_PREMIUM",
        status: "canceled", payload: { by: admin.userId },
      });
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("admin-set-premium", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
