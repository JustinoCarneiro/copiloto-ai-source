// Copiloto AI — chat + registro de gastos + analítica financeira contextual
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";

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

// --- helpers ---
const monthRange = (year: number, monthIdx: number) => ({
  ini: new Date(year, monthIdx, 1).toISOString().slice(0, 10),
  fim: new Date(year, monthIdx + 1, 0).toISOString().slice(0, 10),
});
const parseMonth = (s?: string) => {
  if (!s || !/^\d{4}-\d{2}$/.test(s)) return null;
  const [y, m] = s.split("-").map(Number);
  return { y, m: m - 1 };
};
const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

async function runTool(name: string, args: any, userId: string): Promise<any> {
  const s = serviceClient();
  const now = new Date();
  const { ini, fim } = monthRange(now.getFullYear(), now.getMonth());

  if (name === "consultar_resumo_mes") {
    const { data } = await s.from("gastos").select("tipo,valor").eq("user_id", userId).gte("data", ini).lte("data", fim);
    const entradas = (data ?? []).filter((g: any) => g.tipo === "entrada").reduce((a, g: any) => a + Number(g.valor), 0);
    const saidas = (data ?? []).filter((g: any) => g.tipo === "saida").reduce((a, g: any) => a + Number(g.valor), 0);
    return { mes: `${now.getMonth() + 1}/${now.getFullYear()}`, entradas, saidas, saldo: entradas - saidas };
  }

  if (name === "consultar_gastos_categoria") {
    const { data } = await s.from("gastos")
      .select("valor,categoria:categorias(nome)")
      .eq("user_id", userId).eq("tipo", "saida").gte("data", ini).lte("data", fim);
    const map: Record<string, number> = {};
    (data ?? []).forEach((g: any) => {
      const nome = g.categoria?.nome ?? "Sem categoria";
      map[nome] = (map[nome] ?? 0) + Number(g.valor);
    });
    let list = Object.entries(map).map(([categoria, total]) => ({ categoria, total }));
    if (args?.categoria) list = list.filter((x) => x.categoria.toLowerCase().includes(String(args.categoria).toLowerCase()));
    return list.sort((a, b) => b.total - a.total);
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
    return (data ?? []).map((m: any) => ({
      nome: m.nome,
      objetivo: Number(m.valor_objetivo),
      atual: Number(m.valor_atual),
      faltam: Math.max(0, Number(m.valor_objetivo) - Number(m.valor_atual)),
      progresso_pct: Number(m.valor_objetivo) > 0 ? Math.round((Number(m.valor_atual) / Number(m.valor_objetivo)) * 100) : 0,
      data_objetivo: m.data_objetivo,
    }));
  }

  if (name === "maiores_gastos") {
    const lim = Math.min(20, Math.max(1, args?.limite ?? 5));
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
    const map: Record<string, { cartao: string; total: number; limite: number | null; utilizacao_pct: number | null }> = {};
    (data ?? []).forEach((g: any) => {
      const c = g.cartao;
      const nome = c?.nome ?? "Sem cartão";
      if (!map[nome]) map[nome] = { cartao: nome, total: 0, limite: c?.limite ?? null, utilizacao_pct: null };
      map[nome].total += Number(g.valor);
    });
    Object.values(map).forEach((x) => { if (x.limite && x.limite > 0) x.utilizacao_pct = Math.round((x.total / x.limite) * 100); });
    return Object.values(map).sort((a, b) => b.total - a.total);
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
    const agg = (rows: any[] | null) => {
      const total = (rows ?? []).reduce((s, g) => s + Number(g.valor), 0);
      const cats: Record<string, number> = {};
      (rows ?? []).forEach((g) => { const n = g.categoria?.nome ?? "Sem categoria"; cats[n] = (cats[n] ?? 0) + Number(g.valor); });
      return { total, cats };
    };
    const aa = agg(ra.data as any[]); const bb = agg(rb.data as any[]);
    const delta = aa.total - bb.total;
    const deltaPct = bb.total > 0 ? Math.round((delta / bb.total) * 100) : null;
    const catsDelta = Object.keys({ ...aa.cats, ...bb.cats }).map((n) => {
      const va = aa.cats[n] ?? 0; const vb = bb.cats[n] ?? 0;
      return { categoria: n, mes_a: va, mes_b: vb, delta: va - vb, delta_pct: vb > 0 ? Math.round(((va - vb) / vb) * 100) : null };
    }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 6);
    return {
      mes_a: `${a.m + 1}/${a.y}`, mes_b: `${b.m + 1}/${b.y}`,
      total_a: aa.total, total_b: bb.total, delta, delta_pct: deltaPct,
      categorias: catsDelta,
    };
  }

  if (name === "tendencia_categoria") {
    const semanas = Math.min(12, Math.max(2, args?.semanas ?? 4));
    const desde = new Date(now.getTime() - semanas * 7 * 86400000).toISOString().slice(0, 10);
    const { data } = await s.from("gastos")
      .select("valor,data,categoria:categorias(nome)")
      .eq("user_id", userId).eq("tipo", "saida").gte("data", desde);
    const q = String(args.categoria).toLowerCase();
    const rows = (data ?? []).filter((g: any) => (g.categoria?.nome ?? "").toLowerCase().includes(q));
    if (rows.length === 0) return { categoria: args.categoria, sem_dados: true };
    // metade recente vs metade anterior
    const meio = new Date(now.getTime() - (semanas / 2) * 7 * 86400000).toISOString().slice(0, 10);
    const recente = rows.filter((r: any) => r.data >= meio).reduce((s, r: any) => s + Number(r.valor), 0);
    const anterior = rows.filter((r: any) => r.data < meio).reduce((s, r: any) => s + Number(r.valor), 0);
    const delta_pct = anterior > 0 ? Math.round(((recente - anterior) / anterior) * 100) : null;
    return { categoria: args.categoria, semanas, total_periodo: recente + anterior, recente, anterior, delta_pct };
  }

  if (name === "media_gastos") {
    const meses = Math.min(12, Math.max(2, args?.meses ?? 3));
    const totals: number[] = [];
    for (let i = 1; i <= meses; i++) {
      const r = monthRange(now.getFullYear(), now.getMonth() - i);
      const { data } = await s.from("gastos").select("valor").eq("user_id", userId).eq("tipo", "saida").gte("data", r.ini).lte("data", r.fim);
      totals.push((data ?? []).reduce((s, g: any) => s + Number(g.valor), 0));
    }
    const media = totals.reduce((a, b) => a + b, 0) / meses;
    const r0 = monthRange(now.getFullYear(), now.getMonth());
    const { data: cur } = await s.from("gastos").select("valor").eq("user_id", userId).eq("tipo", "saida").gte("data", r0.ini).lte("data", r0.fim);
    const atual = (cur ?? []).reduce((s, g: any) => s + Number(g.valor), 0);
    return { meses_base: meses, media, mes_atual: atual, acima_da_media: atual > media, diferenca: atual - media };
  }

  if (name === "melhor_cartao_hoje") {
    const { data } = await s.from("cartoes").select("nome,dia_fechamento,dia_vencimento").eq("user_id", userId).eq("tipo", "credito");
    if (!data || data.length === 0) return { sem_dados: true };
    const hoje = now.getDate();
    const rank = data.map((c: any) => {
      const df = c.dia_fechamento;
      if (!df) return { ...c, dias_ate_fechar: -1 };
      const dias = df >= hoje ? df - hoje : 30 - hoje + df;
      return { ...c, dias_ate_fechar: dias };
    }).filter((c) => c.dias_ate_fechar >= 0).sort((a, b) => b.dias_ate_fechar - a.dias_ate_fechar);
    return { melhor: rank[0] ?? null, todos: rank };
  }

  if (name === "gastos_recorrentes") {
    const desde = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
    const { data } = await s.from("gastos").select("descricao,destino,valor").eq("user_id", userId).eq("tipo", "saida").gte("data", desde);
    const map: Record<string, { chave: string; ocorrencias: number; total: number }> = {};
    (data ?? []).forEach((g: any) => {
      const k = (g.destino ?? g.descricao ?? "").toLowerCase().trim();
      if (!k) return;
      if (!map[k]) map[k] = { chave: g.destino ?? g.descricao, ocorrencias: 0, total: 0 };
      map[k].ocorrencias += 1; map[k].total += Number(g.valor);
    });
    return Object.values(map).filter((x) => x.ocorrencias >= 3).map((x) => ({ ...x, medio: x.total / x.ocorrencias })).sort((a, b) => b.total - a.total).slice(0, 10);
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
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite atingido. Tente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos ao workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!response.ok) { const txt = await response.text(); console.error("AI gateway error:", response.status, txt); return new Response(JSON.stringify({ error: "Erro na IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

      const data = await response.json();
      const msg = data.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls ?? [];

      if (toolCalls.length === 0) { finalText = msg?.content ?? ""; break; }

      const registrar = toolCalls.find((t: any) => t.function?.name === "registrar_lancamento");
      if (registrar) {
        try { suggestion = JSON.parse(registrar.function.arguments); } catch (_) {}
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
