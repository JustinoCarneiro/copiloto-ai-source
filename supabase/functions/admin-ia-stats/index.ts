// Estatísticas de uso da IA. Requer role 'admin'.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient, isAdmin } from "../_shared/auth.ts";
import { reportError } from "../_shared/errorReporting.ts";

// preço estimado por 1k tokens (Gemini 3 Flash aproximado)
const COST_PER_MSG = 0.003; // USD estimado por mensagem média

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);
    const supa = serviceClient();
    const admin_ok = await isAdmin(user.userId);
    if (!admin_ok) return jsonResponse({ error: "Acesso restrito" }, 403);

    const [{ count: total }, { data: recentes }, { data: porUsuario }] = await Promise.all([
      supa.from("ia_mensagens").select("*", { count: "exact", head: true }),
      supa.from("ia_mensagens").select("content,created_at,user_id,role").eq("role", "user").order("created_at", { ascending: false }).limit(30),
      supa.from("ia_mensagens").select("user_id"),
    ]);

    const byUser: Record<string, number> = {};
    (porUsuario ?? []).forEach((m: any) => { byUser[m.user_id] = (byUser[m.user_id] ?? 0) + 1; });
    const top = Object.entries(byUser).map(([user_id, count]) => ({ user_id, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    // enriquecer com email
    const ids = top.map((t) => t.user_id);
    const { data: profs } = ids.length ? await supa.from("profiles").select("user_id,email,nome").in("user_id", ids) : { data: [] as any[] };
    const emailByUser: Record<string, any> = {};
    (profs ?? []).forEach((p: any) => { emailByUser[p.user_id] = p; });

    return jsonResponse({
      totalMensagens: total ?? 0,
      custoEstimadoUSD: Number(((total ?? 0) * COST_PER_MSG).toFixed(2)),
      topUsuarios: top.map((t) => ({ ...t, ...emailByUser[t.user_id] })),
      ultimasPerguntas: recentes ?? [],
    });
  } catch (e) {
    console.error("admin-ia-stats", e);
    void reportError(e, "admin-ia-stats");
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
