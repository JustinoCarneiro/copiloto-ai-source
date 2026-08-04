// Lógica pura de agregação/analítica usada pelas tools do chat-ia — extraída de
// chat-ia/index.ts pra ser testável sem depender de rede/Supabase. Cada função recebe as linhas
// já buscadas do banco (ou parâmetros determinísticos como `now`/`hoje`) e devolve o resultado —
// nenhuma função aqui faz I/O. Comportamento idêntico ao que estava inline antes (ver
// memoria-tecnica/decisoes/ para o porquê da extração).

export interface Gasto {
  valor: number | string;
  tipo?: "entrada" | "saida";
  categoria?: { nome?: string } | null;
  cartao?: { id?: string; nome?: string; limite?: number | null; dia_fechamento?: number | null } | null;
  destino?: string | null;
  descricao?: string | null;
  data?: string;
}

export interface Cartao {
  nome: string;
  dia_fechamento?: number | null;
  dia_vencimento?: number | null;
}

export interface Meta {
  nome: string;
  valor_objetivo: number | string;
  valor_atual: number | string;
  data_objetivo?: string | null;
}

export const monthRange = (year: number, monthIdx: number) => ({
  ini: new Date(year, monthIdx, 1).toISOString().slice(0, 10),
  fim: new Date(year, monthIdx + 1, 0).toISOString().slice(0, 10),
});

export const parseMonth = (s?: string): { y: number; m: number } | null => {
  if (!s || !/^\d{4}-\d{2}$/.test(s)) return null;
  const [y, m] = s.split("-").map(Number);
  return { y, m: m - 1 };
};

export const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

export const clampLimite = (limite: number | undefined, min = 1, max = 20, dflt = 5) =>
  Math.min(max, Math.max(min, limite ?? dflt));

export function aggResumoMes(rows: Gasto[], mes: string) {
  const entradas = rows.filter((g) => g.tipo === "entrada").reduce((a, g) => a + Number(g.valor), 0);
  const saidas = rows.filter((g) => g.tipo === "saida").reduce((a, g) => a + Number(g.valor), 0);
  return { mes, entradas, saidas, saldo: entradas - saidas };
}

export function aggGastosPorCategoria(rows: Gasto[], filtroCategoria?: string) {
  const map: Record<string, number> = {};
  rows.forEach((g) => {
    const nome = g.categoria?.nome ?? "Sem categoria";
    map[nome] = (map[nome] ?? 0) + Number(g.valor);
  });
  let list = Object.entries(map).map(([categoria, total]) => ({ categoria, total }));
  if (filtroCategoria) {
    const q = filtroCategoria.toLowerCase();
    list = list.filter((x) => x.categoria.toLowerCase().includes(q));
  }
  return list.sort((a, b) => b.total - a.total);
}

export function aggGastosPorCartao(rows: Gasto[]) {
  const map: Record<string, { cartao: string; total: number; limite: number | null; utilizacao_pct: number | null }> = {};
  rows.forEach((g) => {
    const c = g.cartao;
    const nome = c?.nome ?? "Sem cartão";
    if (!map[nome]) map[nome] = { cartao: nome, total: 0, limite: c?.limite ?? null, utilizacao_pct: null };
    map[nome].total += Number(g.valor);
  });
  Object.values(map).forEach((x) => {
    if (x.limite && x.limite > 0) x.utilizacao_pct = Math.round((x.total / x.limite) * 100);
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

export function aggCompararMeses(
  rowsA: Gasto[],
  rowsB: Gasto[],
  labelA: string,
  labelB: string,
) {
  const agg = (rows: Gasto[]) => {
    const total = rows.reduce((s, g) => s + Number(g.valor), 0);
    const cats: Record<string, number> = {};
    rows.forEach((g) => {
      const n = g.categoria?.nome ?? "Sem categoria";
      cats[n] = (cats[n] ?? 0) + Number(g.valor);
    });
    return { total, cats };
  };
  const aa = agg(rowsA);
  const bb = agg(rowsB);
  const delta = aa.total - bb.total;
  const deltaPct = bb.total > 0 ? Math.round((delta / bb.total) * 100) : null;
  const catsDelta = Object.keys({ ...aa.cats, ...bb.cats })
    .map((n) => {
      const va = aa.cats[n] ?? 0;
      const vb = bb.cats[n] ?? 0;
      return { categoria: n, mes_a: va, mes_b: vb, delta: va - vb, delta_pct: vb > 0 ? Math.round(((va - vb) / vb) * 100) : null };
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 6);
  return { mes_a: labelA, mes_b: labelB, total_a: aa.total, total_b: bb.total, delta, delta_pct: deltaPct, categorias: catsDelta };
}

export function aggTendenciaCategoria(
  rows: Gasto[],
  categoria: string,
  semanasIn: number | undefined,
  now: Date,
) {
  const semanas = Math.min(12, Math.max(2, semanasIn ?? 4));
  const q = categoria.toLowerCase();
  const filtradas = rows.filter((g) => (g.categoria?.nome ?? "").toLowerCase().includes(q));
  if (filtradas.length === 0) return { categoria, sem_dados: true };
  const meio = new Date(now.getTime() - (semanas / 2) * 7 * 86400000).toISOString().slice(0, 10);
  const recente = filtradas.filter((r) => (r.data ?? "") >= meio).reduce((s, r) => s + Number(r.valor), 0);
  const anterior = filtradas.filter((r) => (r.data ?? "") < meio).reduce((s, r) => s + Number(r.valor), 0);
  const delta_pct = anterior > 0 ? Math.round(((recente - anterior) / anterior) * 100) : null;
  return { categoria, semanas, total_periodo: recente + anterior, recente, anterior, delta_pct };
}

export function aggMediaGastos(totaisMesesAnteriores: number[], totalMesAtual: number, meses: number) {
  const media = totaisMesesAnteriores.reduce((a, b) => a + b, 0) / meses;
  return { meses_base: meses, media, mes_atual: totalMesAtual, acima_da_media: totalMesAtual > media, diferenca: totalMesAtual - media };
}

export function melhorCartaoHoje(cartoes: Cartao[], hoje: number) {
  if (cartoes.length === 0) return { sem_dados: true };
  const rank = cartoes
    .map((c) => {
      const df = c.dia_fechamento;
      if (!df) return { ...c, dias_ate_fechar: -1 };
      const dias = df >= hoje ? df - hoje : 30 - hoje + df;
      return { ...c, dias_ate_fechar: dias };
    })
    .filter((c) => c.dias_ate_fechar >= 0)
    .sort((a, b) => b.dias_ate_fechar - a.dias_ate_fechar);
  return { melhor: rank[0] ?? null, todos: rank };
}

export function aggGastosRecorrentes(rows: Gasto[]) {
  const map: Record<string, { chave: string; ocorrencias: number; total: number }> = {};
  rows.forEach((g) => {
    const k = (g.destino ?? g.descricao ?? "").toLowerCase().trim();
    if (!k) return;
    if (!map[k]) map[k] = { chave: g.destino ?? g.descricao ?? "", ocorrencias: 0, total: 0 };
    map[k].ocorrencias += 1;
    map[k].total += Number(g.valor);
  });
  return Object.values(map)
    .filter((x) => x.ocorrencias >= 3)
    .map((x) => ({ ...x, medio: x.total / x.ocorrencias }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

export function computeMetas(metas: Meta[]) {
  return metas.map((m) => {
    const objetivo = Number(m.valor_objetivo);
    const atual = Number(m.valor_atual);
    return {
      nome: m.nome,
      objetivo,
      atual,
      faltam: Math.max(0, objetivo - atual),
      progresso_pct: objetivo > 0 ? Math.round((atual / objetivo) * 100) : 0,
      data_objetivo: m.data_objetivo,
    };
  });
}
