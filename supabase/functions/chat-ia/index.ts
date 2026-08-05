// Copiloto AI — chat + registro de gastos + analítica financeira contextual
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import {
  aggCompararMeses, aggGastosPorCartao, aggGastosPorCategoria, aggGastosRecorrentes,
  aggMediaGastos, aggResumoMes, aggTendenciaCategoria, clampLimite, computeMetas,
  melhorCartaoHoje, monthRange, parseMonth, type Gasto,
} from "../_shared/analytics.ts";
import { decideGatewayOutcome, decideRegistrar } from "./toolRouting.ts";

// serviceClient() (_shared/auth.ts) não usa o generic Database — sem ele, o supabase-js não
// sabe que categoria_id/cartao_id são FK many-to-one e infere o embed (`categoria:categorias(...)`)
// como array no tipo. Em runtime o PostgREST sempre devolve objeto único pra esse tipo de
// relação (é assim que já funcionava antes, só sem checagem de tipo nenhuma — era `any`). Cast
// documentado em vez de mudar a tipagem do client em todas as functions.
const asGastos = (data: unknown) => (data ?? []) as Gasto[];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o **Copiloto**, um analista financeiro pessoal brasileiro (PT-BR).

Você NÃO é um chatbot genérico — você analisa continuamente o comportamento financeiro do usuário usando as ferramentas disponíveis.

REGRAS ABSOLUTAS:
1. Nunca invente números. Sempre chame ferramentas antes de citar valores, %, tendências ou datas.
2. Se as ferramentas retornarem vazio, diga claramente "não há dados suficientes para essa análise".
3. Prefira comparações concretas: "18% a mais que no mês passado", "R$ 250 acima da média", "faltam 3 meses".
4. Sugira ações práticas: qual cartão usar, quando pagar, onde cortar.
5. Formate valores em BRL (R$ 1.234,56). Emojis com moderação, markdown leve.

FLUXOS TÍPICOS:
- Usuário descreve gasto → use \`registrar_lancamento\` (app pedirá confirmação).
- Usuário pergunta sobre finanças → use as ferramentas de consulta e analítica, depois resuma em linguagem natural.
- Pergunta genérica ("como estou financeiramente?") → chame \`resumo_analitico\` que agrega várias métricas.

Categorias comuns: Alimentação, Transporte, Lazer, Mercado, Casa, Saúde, Salário.`;

const tools = [
  {
    type: "function",
    function: {
      name: "registrar_lancamento",
      description: "Sugerir um lançamento financeiro extraído da mensagem. O app pedirá confirmação ao usuário.",
      parameters: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          destino: { type: "string" },
          valor: { type: "number" },
          tipo: { type: "string", enum: ["entrada", "saida"] },
          forma_pagamento: { type: "string", enum: ["debito", "credito", "dinheiro", "pix"] },
          parcelas: { type: "number" },
          categoria_sugerida: { type: "string" },
        },
        required: ["descricao", "valor", "tipo"],
        additionalProperties: false,
      },
    },
  },
  { type: "function", function: { name: "consultar_resumo_mes", description: "Total de entradas, saídas e saldo do mês atual.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  {
    type: "function",
    function: {
      name: "consultar_gastos_categoria",
      description: "Gasto total do mês atual por categoria. Filtro opcional por nome.",
      parameters: { type: "object", properties: { categoria: { type: "string" } }, additionalProperties: false },
    },
  },
  { type: "function", function: { name: "listar_contas_pendentes", description: "Contas a pagar pendentes ou vencendo nos próximos 30 dias.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "consultar_metas", description: "Metas do usuário com progresso e estimativa em meses no ritmo atual.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  {
    type: "function",
    function: {
      name: "maiores_gastos",
      description: "Os N maiores gastos do mês atual.",
      parameters: { type: "object", properties: { limite: { type: "number" } }, additionalProperties: false },
    },
  },
  { type: "function", function: { name: "gastos_por_cartao", description: "Total gasto por cartão no mês atual e % de utilização vs limite.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  {
    type: "function",
    function: {
      name: "comparar_meses",
      description: "Compara gastos entre dois meses (delta em R$, % e por categoria). Meses no formato YYYY-MM.",
      parameters: {
        type: "object",
        properties: {
          mes_a: { type: "string", description: "Mês mais recente (YYYY-MM). Padrão: mês atual." },
          mes_b: { type: "string", description: "Mês de comparação (YYYY-MM). Padrão: mês anterior." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tendencia_categoria",
      description: "Tendência de uma categoria nas últimas N semanas (crescimento/redução).",
      parameters: {
        type: "object",
        properties: {
          categoria: { type: "string" },
          semanas: { type: "number", description: "Padrão 4" },
        },
        required: ["categoria"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "media_gastos",
      description: "Média de gastos nos últimos N meses (padrão 3) e indica se o mês atual está acima/abaixo.",
      parameters: { type: "object", properties: { meses: { type: "number" } }, additionalProperties: false },
    },
  },
  { type: "function", function: { name: "melhor_cartao_hoje", description: "Cartão com maior prazo até o próximo fechamento — melhor para compras hoje.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "gastos_recorrentes", description: "Descrições/destinos que se repetem 3+ vezes nos últimos 90 dias com valor médio elevado.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "resumo_analitico", description: "Panorama financeiro completo: mês atual, delta vs mês anterior, top categorias, contas a vencer, metas, cartão sugerido.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
];

async function runTool(name: string, args: any, userId: string): Promise<any> {
  const s = serviceClient();
  const now = new Date();
  const { ini, fim } = monthRange(now.getFullYear(), now.getMonth());

  if (name === "consultar_resumo_mes") {
    const { data } = await s.from("gastos").select("tipo,valor").eq("user_id", userId).gte("data", ini).lte("data", fim);
    return aggResumoMes(data ?? [], `${now.getMonth() + 1}/${now.getFullYear()}`);
  }

  if (name === "consultar_gastos_categoria") {
    const { data } = await s.from("gastos")
      .select("valor,categoria:categorias(nome)")
      .eq("user_id", userId).eq("tipo", "saida").gte("data", ini).lte("data", fim);
    return aggGastosPorCategoria(asGastos(data), args?.categoria ? String(args.categoria) : undefined);
  }

  if (name === "listar_contas_pendentes") {
    const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const { data } = await s.from("contas")
      .select("descricao,valor,valor_pago,data_vencimento,status,dia_vencimento")
      .eq("user_id", userId).neq("status", "pago").lte("data_vencimento", in30)
      .order("data_vencimento", { nullsFirst: false }).limit(20);
    return data ?? [];
  }

  if (name === "consultar_metas") {
    const { data } = await s.from("metas").select("nome,valor_objetivo,valor_atual,data_objetivo").eq("user_id", userId);
    // Estimativa: assume ritmo de aporte = (valor_atual / meses desde criação). Sem coluna de aporte histórico, retornamos só progresso.
    return computeMetas(data ?? []);
  }

  if (name === "maiores_gastos") {
    const lim = clampLimite(args?.limite);
    const { data } = await s.from("gastos")
      .select("descricao,destino,valor,data,categoria:categorias(nome)")
      .eq("user_id", userId).eq("tipo", "saida").gte("data", ini).lte("data", fim)
      .order("valor", { ascending: false }).limit(lim);
    return data ?? [];
  }

  if (name === "gastos_por_cartao") {
    const { data } = await s.from("gastos")
      .select("valor,cartao:cartoes(id,nome,limite,dia_fechamento)")
      .eq("user_id", userId).eq("tipo", "saida").gte("data", ini).lte("data", fim);
    return aggGastosPorCartao(asGastos(data));
  }

  if (name === "comparar_meses") {
    const a = parseMonth(args?.mes_a) ?? { y: now.getFullYear(), m: now.getMonth() };
    const prev = new Date(a.y, a.m - 1, 1);
    const b = parseMonth(args?.mes_b) ?? { y: prev.getFullYear(), m: prev.getMonth() };
    const rangeA = monthRange(a.y, a.m); const rangeB = monthRange(b.y, b.m);
    const [ra, rb] = await Promise.all([
      s.from("gastos").select("valor,categoria:categorias(nome)").eq("user_id", userId).eq("tipo", "saida").gte("data", rangeA.ini).lte("data", rangeA.fim),
      s.from("gastos").select("valor,categoria:categorias(nome)").eq("user_id", userId).eq("tipo", "saida").gte("data", rangeB.ini).lte("data", rangeB.fim),
    ]);
    return aggCompararMeses(asGastos(ra.data), asGastos(rb.data), `${a.m + 1}/${a.y}`, `${b.m + 1}/${b.y}`);
  }

  if (name === "tendencia_categoria") {
    const semanas = Math.min(12, Math.max(2, args?.semanas ?? 4));
    const desde = new Date(now.getTime() - semanas * 7 * 86400000).toISOString().slice(0, 10);
    const { data } = await s.from("gastos")
      .select("valor,data,categoria:categorias(nome)")
      .eq("user_id", userId).eq("tipo", "saida").gte("data", desde);
    return aggTendenciaCategoria(asGastos(data), String(args.categoria), args?.semanas, now);
  }

  if (name === "media_gastos") {
    const meses = Math.min(12, Math.max(2, args?.meses ?? 3));
    const totals: number[] = [];
    for (let i = 1; i <= meses; i++) {
      const r = monthRange(now.getFullYear(), now.getMonth() - i);
      const { data } = await s.from("gastos").select("valor").eq("user_id", userId).eq("tipo", "saida").gte("data", r.ini).lte("data", r.fim);
      totals.push((data ?? []).reduce((s, g: any) => s + Number(g.valor), 0));
    }
    const r0 = monthRange(now.getFullYear(), now.getMonth());
    const { data: cur } = await s.from("gastos").select("valor").eq("user_id", userId).eq("tipo", "saida").gte("data", r0.ini).lte("data", r0.fim);
    const atual = (cur ?? []).reduce((s, g: any) => s + Number(g.valor), 0);
    return aggMediaGastos(totals, atual, meses);
  }

  if (name === "melhor_cartao_hoje") {
    const { data } = await s.from("cartoes").select("nome,dia_fechamento,dia_vencimento").eq("user_id", userId).eq("tipo", "credito");
    return melhorCartaoHoje(data ?? [], now.getDate());
  }

  if (name === "gastos_recorrentes") {
    const desde = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
    const { data } = await s.from("gastos").select("descricao,destino,valor").eq("user_id", userId).eq("tipo", "saida").gte("data", desde);
    return aggGastosRecorrentes(data ?? []);
  }

  if (name === "resumo_analitico") {
    const [resumo, cats, contas, cartoes, comp] = await Promise.all([
      runTool("consultar_resumo_mes", {}, userId),
      runTool("consultar_gastos_categoria", {}, userId),
      runTool("listar_contas_pendentes", {}, userId),
      runTool("gastos_por_cartao", {}, userId),
      runTool("comparar_meses", {}, userId),
    ]);
    return { mes_atual: resumo, top_categorias: (cats as any[]).slice(0, 5), contas_proximas: (contas as any[]).slice(0, 5), cartoes, comparacao_mes_anterior: comp };
  }

  return { error: "tool desconhecida" };
}

async function callGateway(body: any, key: string) {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await requireUser(req);
    if (!auth) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = auth.userId;

    const { messages, conversa_id: conversaIdIn, persist = true } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const s = serviceClient();
    let conversaId: string | null = conversaIdIn ?? null;
    const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
    if (persist) {
      if (!conversaId) {
        const titulo = (lastUser?.content ?? "Nova conversa").slice(0, 60);
        const { data: nova } = await s.from("ia_conversas").insert({ user_id: userId, titulo }).select("id").single();
        conversaId = nova?.id ?? null;
      }
      if (conversaId && lastUser) {
        await s.from("ia_mensagens").insert({ conversa_id: conversaId, user_id: userId, role: "user", content: String(lastUser.content ?? "") });
      }
    }

    const convo: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
    let finalText = "";
    let suggestion: any = null;

    for (let iter = 0; iter < 6; iter++) {
      const response = await callGateway({ model: "google/gemini-3-flash-preview", messages: convo, tools }, LOVABLE_API_KEY);
      const outcome = decideGatewayOutcome(response.status, response.ok);
      if (outcome.kind !== "ok") {
        if (outcome.kind === "gateway_error") {
          const txt = await response.text();
          console.error("AI gateway error:", response.status, txt);
        }
        return new Response(JSON.stringify({ error: outcome.error }), { status: outcome.httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      const msg = data.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls ?? [];

      if (toolCalls.length === 0) { finalText = msg?.content ?? ""; break; }

      const decision = decideRegistrar(toolCalls);
      if (decision.isRegistrar) {
        suggestion = decision.suggestion;
        finalText = msg?.content || "Identifiquei um lançamento — confirme abaixo:";
        break;
      }

      convo.push(msg);
      for (const tc of toolCalls) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch (_) {}
        const result = await runTool(tc.function.name, args, userId);
        convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }

    if (persist && conversaId) {
      await s.from("ia_mensagens").insert({
        conversa_id: conversaId, user_id: userId, role: "assistant",
        content: finalText || (suggestion ? "Lançamento identificado" : ""),
        suggestion: suggestion ?? null,
      });
    }

    return new Response(JSON.stringify({ text: finalText, suggestion, conversa_id: conversaId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("chat-ia error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
