// Exclusão de conta (LGPD, Art. 18 — direito de eliminação). Apaga explicitamente as tabelas sem
// FK até auth.users e deixa o resto cascatear via supabase.auth.admin.deleteUser().
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import { reportError } from "../_shared/errorReporting.ts";
import { TABLES_WITHOUT_USER_CASCADE } from "../_shared/accountDeletion.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const supa = serviceClient();
    for (const table of TABLES_WITHOUT_USER_CASCADE) {
      await supa.from(table).delete().eq("user_id", user.userId);
    }

    const { error } = await supa.auth.admin.deleteUser(user.userId);
    if (error) throw error;

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("account-delete", e);
    void reportError(e, "account-delete");
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
