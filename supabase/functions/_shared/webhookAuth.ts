// Comparação de token em tempo constante — evita vazar o token por diferença de tempo de
// resposta (achado de segurança de 2026-08-04). Extraída de mercadopago-webhook/index.ts pra
// um módulo sem `Deno.serve()` no escopo do arquivo — importar um arquivo com Deno.serve() de
// dentro de um teste dispara o listener como efeito colateral do import.
import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts";

export function safeTokenMatch(got: string | null, expected: string): boolean {
  if (!got) return false;
  const enc = new TextEncoder();
  const a = enc.encode(got);
  const b = enc.encode(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
