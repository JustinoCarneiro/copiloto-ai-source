import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decideRegistrar } from "./toolRouting.ts";

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
