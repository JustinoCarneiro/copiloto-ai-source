---
tipo: bug
data: 2026-08-04
severidade: baixa (só afeta o teste, não o comportamento real do app)
status: Resolvido
---

# `daysUntil.test.ts` era flaky dependendo do fuso horário e da hora do dia

## Sintoma

`npm run test` começou a falhar em `src/lib/format.test.ts` (2 de 21 testes) rodando à noite
(21h+ local, -03:00), depois de ter passado limpo mais cedo no mesmo dia, sem nenhuma mudança em
`src/lib/format.ts`.

## Causa raiz

Os testes de `daysUntil` construíam a data de teste assim:
```ts
const ontem = new Date();
ontem.setDate(ontem.getDate() - 1);
const iso = ontem.toISOString().slice(0, 10);
```
`toISOString()` sempre devolve a data em **UTC**. Depois das 21h num fuso -03:00, "agora" local já
corresponde à madrugada do dia seguinte em UTC — então `ontem.toISOString().slice(0,10)`, calculado
a partir de "ontem só na hora local", às vezes ainda cai no dia UTC de "hoje", não "ontem". O teste
comparava uma data errada (um dia adiantada) contra `daysUntil()`, que interpreta strings
`YYYY-MM-DD` como **meia-noite local** (comportamento correto e intencional de `format.ts`, pensado
pra usuário brasileiro vendo "dias até o vencimento" no calendário local — não é o `daysUntil` que
estava errado).

## Solução

Trocado por um helper `toLocalISODate(d)` no próprio teste, que monta a string a partir de
`getFullYear()/getMonth()/getDate()` (componentes locais), nunca de `toISOString()`. Determinístico
em qualquer fuso horário e qualquer hora do dia — não é uma correção que só funciona por acaso pro
fuso `-03:00` de hoje.

## Ligado a
- [[rls-integration-check-jwt-claim-guc]]
