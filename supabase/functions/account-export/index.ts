// Exportação de dados (LGPD Art. 18, V — portabilidade). Devolve um JSON com todas as tabelas de
// domínio do usuário autenticado, uma chave por tabela.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import { reportError } from "../_shared/errorReporting.ts";
import { EXPORT_TABLES } from "../_shared/accountExport.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const supa = serviceClient();
    const result: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: user.userId };

    for (const table of EXPORT_TABLES) {
      const { data } = await supa.from(table).select("*").eq("user_id", user.userId);
      result[table] = data ?? [];
    }

    return jsonResponse(result);
  } catch (e) {
    console.error("account-export", e);
    void reportError(e, "account-export");
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
