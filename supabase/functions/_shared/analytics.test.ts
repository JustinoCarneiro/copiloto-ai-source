import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  aggCompararMeses, aggGastosPorCartao, aggGastosPorCategoria, aggGastosRecorrentes,
  aggMediaGastos, aggResumoMes, aggTendenciaCategoria, clampLimite, computeMetas,
  melhorCartaoHoje, monthRange, parseMonth,
} from "./analytics.ts";

Deno.test("monthRange - primeiro e último dia do mês", () => {
  const r = monthRange(2026, 1); // fevereiro/2026
  assertEquals(r.ini, "2026-02-01");
  assertEquals(r.fim, "2026-02-28");
});

Deno.test("monthRange - ano bissexto", () => {
  const r = monthRange(2028, 1);
  assertEquals(r.fim, "2028-02-29");
});

Deno.test("parseMonth - formato válido", () => {
  assertEquals(parseMonth("2026-08"), { y: 2026, m: 7 });
});

Deno.test("parseMonth - formato inválido retorna null", () => {
  assertEquals(parseMonth("agosto/2026"), null);
  assertEquals(parseMonth(undefined), null);
  assertEquals(parseMonth(""), null);
});

Deno.test("clampLimite - dentro do intervalo mantém o valor", () => {
  assertEquals(clampLimite(10), 10);
});

Deno.test("clampLimite - acima do máximo satura em 20", () => {
  assertEquals(clampLimite(999), 20);
});

Deno.test("clampLimite - abaixo do mínimo satura em 1", () => {
  assertEquals(clampLimite(-5), 1);
});

Deno.test("clampLimite - undefined usa o default (5)", () => {
  assertEquals(clampLimite(undefined), 5);
});

Deno.test("aggResumoMes - soma entradas e saídas separadamente", () => {
  const rows = [
    { valor: 1000, tipo: "entrada" as const },
    { valor: 300, tipo: "saida" as const },
    { valor: 50, tipo: "saida" as const },
  ];
  const r = aggResumoMes(rows, "8/2026");
  assertEquals(r, { mes: "8/2026", entradas: 1000, saidas: 350, saldo: 650 });
});

Deno.test("aggResumoMes - sem lançamentos retorna tudo zerado", () => {
  const r = aggResumoMes([], "8/2026");
  assertEquals(r, { mes: "8/2026", entradas: 0, saidas: 0, saldo: 0 });
});

Deno.test("aggGastosPorCategoria - agrupa e ordena do maior pro menor", () => {
  const rows = [
    { valor: 100, categoria: { nome: "Mercado" } },
    { valor: 50, categoria: { nome: "Lazer" } },
    { valor: 30, categoria: { nome: "Mercado" } },
  ];
  const r = aggGastosPorCategoria(rows);
  assertEquals(r, [{ categoria: "Mercado", total: 130 }, { categoria: "Lazer", total: 50 }]);
});

Deno.test("aggGastosPorCategoria - sem categoria vira 'Sem categoria'", () => {
  const rows = [{ valor: 20, categoria: null }];
  const r = aggGastosPorCategoria(rows);
  assertEquals(r, [{ categoria: "Sem categoria", total: 20 }]);
});

Deno.test("aggGastosPorCategoria - filtro por nome é case-insensitive e parcial", () => {
  const rows = [
    { valor: 100, categoria: { nome: "Mercado" } },
    { valor: 50, categoria: { nome: "Lazer" } },
  ];
  const r = aggGastosPorCategoria(rows, "merc");
  assertEquals(r, [{ categoria: "Mercado", total: 100 }]);
});

Deno.test("aggGastosPorCartao - calcula % de utilização quando há limite", () => {
  const rows = [
    { valor: 250, cartao: { nome: "Nubank", limite: 1000 } },
    { valor: 250, cartao: { nome: "Nubank", limite: 1000 } },
  ];
  const r = aggGastosPorCartao(rows);
  assertEquals(r, [{ cartao: "Nubank", total: 500, limite: 1000, utilizacao_pct: 50 }]);
});

Deno.test("aggGastosPorCartao - sem limite não calcula utilização (fica null)", () => {
  const rows = [{ valor: 100, cartao: { nome: "Cartão sem limite", limite: null } }];
  const r = aggGastosPorCartao(rows);
  assertEquals(r[0].utilizacao_pct, null);
});

Deno.test("aggCompararMeses - delta positivo e negativo por categoria", () => {
  const mesA = [{ valor: 150, categoria: { nome: "Mercado" } }];
  const mesB = [{ valor: 100, categoria: { nome: "Mercado" } }];
  const r = aggCompararMeses(mesA, mesB, "8/2026", "7/2026");
  assertEquals(r.total_a, 150);
  assertEquals(r.total_b, 100);
  assertEquals(r.delta, 50);
  assertEquals(r.delta_pct, 50); // 50/100 = 50%
  assertEquals(r.categorias[0], { categoria: "Mercado", mes_a: 150, mes_b: 100, delta: 50, delta_pct: 50 });
});

Deno.test("aggCompararMeses - mês base zerado não divide por zero (delta_pct null)", () => {
  const r = aggCompararMeses([{ valor: 100, categoria: null }], [], "8/2026", "7/2026");
  assertEquals(r.delta_pct, null);
});

Deno.test("aggCompararMeses - top 6 categorias por magnitude de delta, não só delta positivo", () => {
  const mesA = Array.from({ length: 8 }, (_, i) => ({ valor: (i + 1) * 10, categoria: { nome: `Cat${i}` } }));
  const r = aggCompararMeses(mesA, [], "8/2026", "7/2026");
  assertEquals(r.categorias.length, 6);
  // maior delta absoluto primeiro (Cat7 = 80)
  assertEquals(r.categorias[0].categoria, "Cat7");
});

Deno.test("aggTendenciaCategoria - sem dados da categoria retorna sem_dados", () => {
  const r = aggTendenciaCategoria([{ valor: 10, categoria: { nome: "Lazer" }, data: "2026-08-01" }], "Mercado", 4, new Date("2026-08-04"));
  assertEquals(r, { categoria: "Mercado", sem_dados: true });
});

Deno.test("aggTendenciaCategoria - divide corretamente entre metade recente e anterior", () => {
  const now = new Date("2026-08-29T00:00:00Z"); // 4 semanas = 28 dias -> meio em ~2026-08-15
  const rows = [
    { valor: 100, categoria: { nome: "Mercado" }, data: "2026-08-20" }, // recente
    { valor: 50, categoria: { nome: "Mercado" }, data: "2026-08-05" },  // anterior
  ];
  const r = aggTendenciaCategoria(rows, "mercado", 4, now) as any;
  assertEquals(r.recente, 100);
  assertEquals(r.anterior, 50);
  assertEquals(r.delta_pct, 100); // dobrou
});

Deno.test("aggTendenciaCategoria - semanas fora do intervalo é clampada (2 a 12)", () => {
  const now = new Date("2026-08-04");
  const r = aggTendenciaCategoria([{ valor: 10, categoria: { nome: "X" }, data: "2026-08-01" }], "x", 999, now) as any;
  assertEquals(r.semanas, 12);
});

Deno.test("aggMediaGastos - identifica mês atual acima da média", () => {
  const r = aggMediaGastos([100, 200, 300], 500, 3);
  assertEquals(r.media, 200);
  assertEquals(r.acima_da_media, true);
  assertEquals(r.diferenca, 300);
});

Deno.test("aggMediaGastos - mês atual abaixo da média", () => {
  const r = aggMediaGastos([100, 200, 300], 50, 3);
  assertEquals(r.acima_da_media, false);
});

Deno.test("melhorCartaoHoje - sem cartões retorna sem_dados", () => {
  assertEquals(melhorCartaoHoje([], 15), { sem_dados: true });
});

Deno.test("melhorCartaoHoje - escolhe o cartão com mais dias até fechar", () => {
  const cartoes = [
    { nome: "Fecha logo", dia_fechamento: 16 },
    { nome: "Fecha depois", dia_fechamento: 28 },
  ];
  const r = melhorCartaoHoje(cartoes, 15); // hoje = dia 15
  assertEquals(r.melhor?.nome, "Fecha depois");
  assertEquals(r.melhor?.dias_ate_fechar, 13);
});

Deno.test("melhorCartaoHoje - dia de fechamento já passou vira contagem do próximo ciclo (~30 dias)", () => {
  const cartoes = [{ nome: "Já fechou", dia_fechamento: 5 }];
  const r = melhorCartaoHoje(cartoes, 20); // hoje = 20, fechamento dia 5 já passou
  assertEquals(r.melhor?.dias_ate_fechar, 15); // 30 - 20 + 5
});

Deno.test("melhorCartaoHoje - cartão sem dia_fechamento configurado é excluído do ranking", () => {
  const cartoes = [{ nome: "Sem fechamento", dia_fechamento: null }];
  const r = melhorCartaoHoje(cartoes, 15);
  assertEquals(r.melhor, null);
});

Deno.test("aggGastosRecorrentes - exige 3+ ocorrências pra entrar na lista", () => {
  const rows = [
    { valor: 30, destino: "Netflix" },
    { valor: 30, destino: "Netflix" },
    { valor: 20, destino: "Spotify" },
    { valor: 20, destino: "Spotify" },
    { valor: 20, destino: "Spotify" },
  ];
  const r = aggGastosRecorrentes(rows);
  assertEquals(r.length, 1);
  assertEquals(r[0].chave, "Spotify");
  assertEquals(r[0].ocorrencias, 3);
  assertAlmostEquals(r[0].medio, 20);
});

Deno.test("aggGastosRecorrentes - ignora lançamentos sem destino nem descrição", () => {
  const rows = [{ valor: 10, destino: null, descricao: null }, { valor: 10, destino: null, descricao: null }, { valor: 10, destino: null, descricao: null }];
  assertEquals(aggGastosRecorrentes(rows), []);
});

Deno.test("computeMetas - progresso e faltam calculados corretamente", () => {
  const r = computeMetas([{ nome: "Viagem", valor_objetivo: 1000, valor_atual: 250 }]);
  assertEquals(r[0], { nome: "Viagem", objetivo: 1000, atual: 250, faltam: 750, progresso_pct: 25, data_objetivo: undefined });
});

Deno.test("computeMetas - meta com objetivo zerado não divide por zero", () => {
  const r = computeMetas([{ nome: "Sem objetivo", valor_objetivo: 0, valor_atual: 0 }]);
  assertEquals(r[0].progresso_pct, 0);
});

Deno.test("computeMetas - valor_atual maior que objetivo não deixa faltam negativo", () => {
  const r = computeMetas([{ nome: "Superou", valor_objetivo: 100, valor_atual: 150 }]);
  assertEquals(r[0].faltam, 0);
});
