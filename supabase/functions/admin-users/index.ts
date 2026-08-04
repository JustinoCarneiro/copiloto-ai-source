// Lista de usuários com plano/status/próxima cobrança. Requer role 'admin'.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient, isAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const supa = serviceClient();
    const admin_ok = await isAdmin(user.userId);
    if (!admin_ok) return jsonResponse({ error: "Acesso restrito" }, 403);

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";

    let query = supa
      .from("profiles")
      .select("user_id,nome,email,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (q) query = query.or(`email.ilike.%${q}%,nome.ilike.%${q}%`);
    const { data: profiles } = await query;

    const ids = (profiles ?? []).map((p: any) => p.user_id);
    const { data: subs } = ids.length
      ? await supa.from("subscriptions").select("*").in("user_id", ids)
      : { data: [] as any[] };

    const byUser: Record<string, any> = {};
    for (const s of subs ?? []) byUser[s.user_id] = s;

    return jsonResponse({
      users: (profiles ?? []).map((p: any) => ({
        ...p,
        subscription: byUser[p.user_id] ?? null,
      })),
    });
  } catch (e) {
    console.error("admin-users", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
