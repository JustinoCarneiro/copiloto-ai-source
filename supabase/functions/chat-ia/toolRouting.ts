// Decisão de roteamento das tool_calls retornadas pelo modelo — extraída do loop de
// orquestração em index.ts pra isolar a propriedade de segurança mais crítica do Copiloto IA:
// a IA NUNCA grava um lançamento sozinha, só sugere. Ver testes em toolRouting.test.ts.

export interface ToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

export interface RegistrarDecision {
  isRegistrar: boolean;
  suggestion: unknown | null;
}

/**
 * Se `registrar_lancamento` aparece entre as tool_calls do turno, NENHUMA tool é executada
 * nesse turno — nem a própria registrar_lancamento (que não tem implementação em runTool; ela
 * só existe como sinal pro app pedir confirmação humana), nem qualquer outra tool que o modelo
 * tenha pedido junto na mesma resposta. O chamador deve parar o loop de orquestração assim que
 * `isRegistrar` for true, sem chamar runTool() pra nenhuma delas.
 */
export type GatewayOutcome =
  | { kind: "rate_limited"; httpStatus: 429; error: string }
  | { kind: "no_credits"; httpStatus: 402; error: string }
  | { kind: "gateway_error"; httpStatus: 500; error: string }
  | { kind: "ok" };

/**
 * Traduz o status HTTP da resposta do gateway de IA pra uma decisão do que fazer — extraída do
 * loop de orquestração pra testar as mensagens de erro exibidas ao usuário sem precisar mockar
 * `fetch`. Ordem importa: 429 e 402 são checados antes do `!ok` genérico.
 */
export function decideGatewayOutcome(status: number, ok: boolean): GatewayOutcome {
  if (status === 429) return { kind: "rate_limited", httpStatus: 429, error: "Limite atingido. Tente em alguns instantes." };
  if (status === 402) return { kind: "no_credits", httpStatus: 402, error: "Créditos esgotados. Adicione créditos ao workspace." };
  if (!ok) return { kind: "gateway_error", httpStatus: 500, error: "Erro na IA" };
  return { kind: "ok" };
}

export function decideRegistrar(toolCalls: ToolCall[]): RegistrarDecision {
  const registrar = toolCalls.find((t) => t.function?.name === "registrar_lancamento");
  if (!registrar) return { isRegistrar: false, suggestion: null };
  let suggestion: unknown = null;
  try {
    suggestion = registrar.function?.arguments ? JSON.parse(registrar.function.arguments) : null;
  } catch {
    suggestion = null;
  }
  return { isRegistrar: true, suggestion };
}
