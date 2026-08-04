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
