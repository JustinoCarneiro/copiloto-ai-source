---
tipo: decisao
data: 2026-08-13
status: Ativa
---

# Monitoramento de erro via HTTP direto ao Sentry, sem SDK

## Contexto

A auditoria de produção apontou que nenhuma edge function reportava erro pra lugar nenhum além de
`console.error` — sem `SENTRY_DSN`/conta configurada ainda, e sem cartão de crédito disponível
pra abrir uma conta paga agora.

## Decisão

`_shared/errorReporting.ts` fala direto com a API legada "store" do Sentry
(`POST https://<host>/api/<project>/store/`, header `X-Sentry-Auth`) via `fetch`, em vez de
importar `@sentry/deno` ou similar. Esse protocolo é estável e documentado há anos (plano free do
Sentry não exige cartão). Evita puxar uma dependência de SDK numa function que já tem pouca
superfície, e mantém o parsing do DSN e a montagem do evento como funções puras testáveis
(`parseDsn`, `buildStoreUrl`, `buildAuthHeader`, `buildErrorEvent`) — só o `fetch` em si
(`reportError`) fica de fora do `deno test`, mesmo padrão já usado em todo o resto do projeto
(lógica pura extraída e testada, I/O fino em volta sem teste).

`reportError()` nunca lança: se `SENTRY_DSN` não estiver setado (caso de hoje, em produção) ou o
`fetch` falhar, ela é um no-op silencioso — monitoramento não pode ser o motivo de uma resposta
real falhar.

## Consequências

- **`SENTRY_DSN` ainda não está configurado em produção** — até que o usuário crie a conta Sentry
  (free tier) e configure a env var na function, `reportError()` não reporta nada de verdade,
  só não quebra nada. Isso é uma pendência de infra, não de código.
- Se o volume de erro justificar features mais avançadas do Sentry (breadcrumbs, release
  tracking, source maps), aí sim vale reavaliar migrar pro SDK oficial — o approach atual cobre só
  "capturar exceção com contexto mínimo", que é o que a auditoria pediu.

## Ligado a
- [[lgpd-exportacao-e-exclusao-de-conta]]
