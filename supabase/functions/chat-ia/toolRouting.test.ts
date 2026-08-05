import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decideGatewayOutcome, decideRegistrar } from "./toolRouting.ts";

Deno.test("decideGatewayOutcome - resposta ok segue o loop normalmente", () => {
  assertEquals(decideGatewayOutcome(200, true), { kind: "ok" });
});

Deno.test("decideGatewayOutcome - 429 vira rate_limited com a mensagem certa pro usuário", () => {
  const r = decideGatewayOutcome(429, false);
  assertEquals(r, { kind: "rate_limited", httpStatus: 429, error: "Limite atingido. Tente em alguns instantes." });
});

Deno.test("decideGatewayOutcome - 402 vira no_credits com a mensagem certa", () => {
  const r = decideGatewayOutcome(402, false);
  assertEquals(r, { kind: "no_credits", httpStatus: 402, error: "Créditos esgotados. Adicione créditos ao workspace." });
});

Deno.test("decideGatewayOutcome - qualquer outro erro (ok=false) vira gateway_error genérico 500", () => {
  const r = decideGatewayOutcome(503, false);
  assertEquals(r, { kind: "gateway_error", httpStatus: 500, error: "Erro na IA" });
});

Deno.test("decideGatewayOutcome - 429/402 têm prioridade mesmo que ok também seja false por outro motivo", () => {
  // status 429 já implica ok=false na Fetch API real, mas a função não deve depender disso —
  // testamos a ordem de prioridade explicitamente.
  assertEquals(decideGatewayOutcome(429, false).kind, "rate_limited");
  assertEquals(decideGatewayOutcome(402, false).kind, "no_credits");
});

Deno.test("decideRegistrar - sem registrar_lancamento entre as tools, não é registro", () => {
  const r = decideRegistrar([{ function: { name: "consultar_resumo_mes", arguments: "{}" } }]);
  assertEquals(r, { isRegistrar: false, suggestion: null });
});

Deno.test("decideRegistrar - lista vazia de tool_calls não é registro", () => {
  assertEquals(decideRegistrar([]), { isRegistrar: false, suggestion: null });
});

Deno.test("decideRegistrar - registrar_lancamento com args válidos extrai a sugestão", () => {
  const args = JSON.stringify({ descricao: "iFood", valor: 45, tipo: "saida" });
  const r = decideRegistrar([{ function: { name: "registrar_lancamento", arguments: args } }]);
  assertEquals(r.isRegistrar, true);
  assertEquals(r.suggestion, { descricao: "iFood", valor: 45, tipo: "saida" });
});

Deno.test("decideRegistrar - JSON malformado nos args não quebra, suggestion vira null mas isRegistrar continua true", () => {
  const r = decideRegistrar([{ function: { name: "registrar_lancamento", arguments: "{ isso não é json" } }]);
  assertEquals(r.isRegistrar, true);
  assertEquals(r.suggestion, null);
});

Deno.test("decideRegistrar - arguments ausente não quebra", () => {
  const r = decideRegistrar([{ function: { name: "registrar_lancamento" } }]);
  assertEquals(r.isRegistrar, true);
  assertEquals(r.suggestion, null);
});

Deno.test("decideRegistrar - PROPRIEDADE DE SEGURANÇA: registrar_lancamento junto com outras tools ainda é detectado (o chamador deve ignorar as outras)", () => {
  const args = JSON.stringify({ descricao: "Uber", valor: 20, tipo: "saida" });
  const toolCalls = [
    { function: { name: "consultar_resumo_mes", arguments: "{}" } },
    { function: { name: "registrar_lancamento", arguments: args } },
    { function: { name: "gastos_por_cartao", arguments: "{}" } },
  ];
  const r = decideRegistrar(toolCalls);
  assertEquals(r.isRegistrar, true);
  assertEquals(r.suggestion, { descricao: "Uber", valor: 20, tipo: "saida" });
  // Nota: é responsabilidade do chamador (index.ts) parar o loop e NUNCA chamar runTool() pra
  // nenhuma tool desse turno assim que isRegistrar===true — decideRegistrar só decide, não
  // executa nada. O teste de integração do loop completo fica registrado como gap conhecido
  // (ver ROADMAP.md) — mockar fetch + serviceClient exigiria injeção de dependência que ainda
  // não existe no index.ts.
});
