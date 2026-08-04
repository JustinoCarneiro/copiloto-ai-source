// Ações administrativas sobre usuários: bloquear, desbloquear, mudar plano, ver movimentações.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient, isAdmin } from "../_shared/auth.ts";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  action: z.enum(["block", "unblock", "set_plan", "movements", "set_ia_limit"]),
  userId: z.string().uuid(),
  plano: z.enum(["free", "premium"]).optional(),
  cycle: z.enum(["mensal", "anual"]).optional(),
  ia_daily_limit: z.number().int().min(0).max(10000).nullable().optional(),
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
    const { action, userId, plano, cycle, ia_daily_limit } = parsed.data;

    const log = async (payload: Record<string, any> = {}) => {
      await supa.from("admin_logs").insert({ admin_id: admin.userId, action, target_user_id: userId, payload });
    };

    if (action === "block" || action === "unblock") {
      await supa.from("profiles").update({ blocked: action === "block" }).eq("user_id", userId);
      await log({ blocked: action === "block" });
      return jsonResponse({ ok: true });
    }

    if (action === "set_plan") {
      if (!plano) return jsonResponse({ error: "plano obrigatório" }, 400);
      const update: any = { plano, status: plano === "premium" ? "active" : "canceled" };
      if (plano === "premium") {
        update.billing_cycle = cycle ?? "mensal"; update.ciclo = cycle ?? "mensal";
        const meses = cycle === "anual" ? 12 : 1;
        const until = new Date(); until.setMonth(until.getMonth() + meses);
        update.premium_until = until.toISOString();
      } else {
        update.canceled_at = new Date().toISOString();
      }
      await supa.from("subscriptions").upsert({ user_id: userId, gateway: "manual", ...update }, { onConflict: "user_id" });
      await log({ plano, cycle });
      return jsonResponse({ ok: true });
    }

    if (action === "set_ia_limit") {
      await supa.from("subscriptions").update({ ia_daily_limit: ia_daily_limit ?? null }).eq("user_id", userId);
      await log({ ia_daily_limit });
      return jsonResponse({ ok: true });
    }

    if (action === "movements") {
      const [gastos, contas, pagamentos] = await Promise.all([
        supa.from("gastos").select("descricao,valor,tipo,data,forma_pagamento").eq("user_id", userId).order("data", { ascending: false }).limit(50),
        supa.from("contas").select("descricao,valor,status,data_vencimento").eq("user_id", userId).order("data_vencimento", { ascending: false, nullsFirst: false }).limit(50),
        supa.from("payment_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      ]);
      return jsonResponse({ gastos: gastos.data ?? [], contas: contas.data ?? [], pagamentos: pagamentos.data ?? [] });
    }

    return jsonResponse({ error: "action desconhecida" }, 400);
  } catch (e) {
    console.error("admin-user-actions", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
