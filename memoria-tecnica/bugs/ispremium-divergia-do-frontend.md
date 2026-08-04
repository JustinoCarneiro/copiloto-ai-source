---
tipo: bug
data: 2026-08-04
severidade: baixa (nunca exercitado — código morto)
status: Resolvido
---

# `isPremium()` (backend) divergia de `computeSubscriptionState` (frontend) na regra de trial

## Sintoma

Nenhum sintoma em produção — achado ao escrever testes reais pra `_shared/auth.ts` (M01) durante
o pagamento do débito técnico de TDD. `isPremium()` não tem nenhum chamador em todo o código
(`grep -rn "isPremium("` só retorna a própria definição) — é dead code hoje.

## Causa raiz

`isPremium()` (`supabase/functions/_shared/auth.ts`) calculava `trialing` só checando
`trial_ends_at > now`, sem checar `plano !== "premium"` nem `status !== "canceled"` — diferente
da mesma regra já implementada em `src/lib/subscription.ts` (`computeSubscriptionState`, usada
pelo frontend em `usePremium`), que corretamente exclui trial de assinaturas já canceladas ou já
convertidas pra premium de verdade.

Efeito do bug (se algo viesse a chamar `isPremium()`): um usuário que cancelasse a assinatura
**durante** o período de trial continuaria sendo tratado como premium ativo até a data original
de expiração do trial, mesmo depois de cancelar.

Nunca esteve ativo em produção — a função só existe, não é chamada por nenhuma edge function nem
usada pra gate de feature nenhuma hoje (inclusive `ia_daily_limit`, que a coluna existe e o admin
consegue configurar, também não tem enforcement em lugar nenhum — funcionalidade só parcialmente
implementada, fora do escopo desta correção).

## Solução

Extraída a lógica de decisão pra `supabase/functions/_shared/premium.ts`
(`computeIsPremium(row, now)`), alinhada com a mesma regra do frontend, coberta por 9 testes
(`premium.test.ts`) incluindo o cenário de regressão específico (cancelado durante trial).
`isPremium()` agora só chama essa função pura.

## Ligado a
- [[eslint-scope-supabase-functions]]
