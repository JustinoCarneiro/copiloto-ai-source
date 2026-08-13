# ROADMAP — Copiloto AI

> Blueprint reconstruído retroativamente em 2026-08-04 (ver nota de proveniência no `CLAUDE.md`).
> Fonte da verdade técnica: consumir junto com o `CLAUDE.md`. Este arquivo é também o quadro
> Kanban vivo do projeto (seção 12 da metodologia) a partir de agora — status por módulo abaixo.

## Mapa de fases e skills

| Fase | Skill | Entregável |
|---|---|---|
| 1 · Spec Viva | `onda-spec-viva` | `CLAUDE.md` + `docs/spec.md` — feito retroativamente |
| 2 · Layout | `onda-layout` | Já em produção — identidade extraída para `design/` |
| 3 · Blueprint | `onda-blueprint` | Este ROADMAP + contratos — feito retroativamente |
| 4 · XP Coding | `onda-xp-tdd` | **A partir de agora**, para todo módulo novo/alterado |
| 5 · Homologação | `onda-homologacao` | CI de smoke test adicionado (`.github/workflows/ci.yml`) |

## Diagrama do banco (Postgres/Supabase)

```mermaid
erDiagram
  PROFILES ||--o{ GASTOS : "user_id"
  PROFILES ||--o{ CONTAS : "user_id"
  PROFILES ||--o{ CARTOES : "user_id"
  PROFILES ||--o{ METAS : "user_id"
  PROFILES ||--o{ CATEGORIAS : "user_id"
  PROFILES ||--o| SUBSCRIPTIONS : "user_id"
  PROFILES ||--o{ USER_ROLES : "user_id"
  PROFILES ||--o{ IA_CONVERSAS : "user_id"

  CATEGORIAS ||--o{ GASTOS : categoria_id
  CATEGORIAS ||--o{ CONTAS : categoria_id
  CARTOES ||--o{ GASTOS : cartao_id
  CONTAS ||--o{ PARCELAS : conta_id
  CONTAS ||--o{ PAGAMENTOS_CONTAS : conta_id
  GASTOS ||--o{ GASTOS_HISTORICO : gasto_id
  IA_CONVERSAS ||--o{ IA_MENSAGENS : conversa_id
  SUBSCRIPTIONS ||--o{ PAYMENT_LOGS : subscription_id

  PROFILES {
    uuid id PK
    uuid user_id FK
    text nome
    text email
    boolean blocked
  }
  CATEGORIAS { uuid id PK; uuid user_id FK; text nome; text icone; text cor }
  CARTOES { uuid id PK; uuid user_id FK; text nome; text tipo; numeric limite; int dia_fechamento; int dia_vencimento }
  GASTOS { uuid id PK; uuid user_id FK; text descricao; numeric valor; text tipo; text forma_pagamento; int parcelas; date data }
  GASTOS_HISTORICO { uuid id PK; uuid gasto_id FK; jsonb changes; timestamptz changed_at }
  CONTAS { uuid id PK; uuid user_id FK; text descricao; numeric valor; numeric valor_pago; text status; boolean pago; date data_vencimento }
  PARCELAS { uuid id PK; uuid conta_id FK; int numero; numeric valor; date data_vencimento; boolean pago }
  PAGAMENTOS_CONTAS { uuid id PK; uuid conta_id FK; numeric valor; date data }
  METAS { uuid id PK; uuid user_id FK; text nome; numeric valor_objetivo; numeric valor_atual }
  USER_ROLES { uuid id PK; uuid user_id FK; app_role role }
  SUBSCRIPTIONS { uuid id PK; uuid user_id FK; text plano; text status; text gateway; text billing_cycle; numeric amount; date next_due_date }
  PAYMENT_LOGS { uuid id PK; uuid subscription_id FK; text event; text status; jsonb payload }
  IA_CONVERSAS { uuid id PK; uuid user_id FK; text titulo; timestamptz updated_at }
  IA_MENSAGENS { uuid id PK; uuid conversa_id FK; text role; text content; jsonb suggestion }
  ADMIN_LOGS { uuid id PK; uuid admin_id FK; text action; uuid target_user_id; jsonb payload }
  COUPONS { uuid id PK; text codigo; numeric desconto_pct; boolean ativo; int usos; int uso_max }
  APP_SETTINGS { text key PK; jsonb value }
```

Todas as tabelas de domínio têm **RLS obrigatória** (`auth.uid() = user_id`). `has_role()` roda em
`SECURITY DEFINER`, movida para o schema `private` (migration `20260728211306`) para não ser
exposta via PostgREST.

## Módulos — status e peso

Peso reflete a complexidade **real já construída**, não uma estimativa de dias futura (o código já
existe). Todos nasceram e foram concluídos **fora** da Esteira XP formal — ver ressalva de TDD
abaixo.

| ID | Módulo | Épico | Peso | Status |
|---|---|---|---|---|
| M01 | Auth & RBAC | E1 | 🔴 Grande | ✅ Concluído — lógica de `requireUser`/`isAdmin`/`isPremium` coberta (20 testes) + RLS validada contra Postgres real (9 cenários, manual) |
| M02 | Assinatura & Billing (Mercado Pago) | E8 | 🔴 Grande | ✅ Concluído — trial/premium, status do MP, patch do webhook e payload de assinatura cobertos (55 testes); I/O de `payments-cancel` sem teste |
| M03 | Copiloto IA (chat + 13 tools + voz) | E7 | 🔴 Grande | ✅ Concluído — analítica das 13 tools + roteamento de tool_calls + status do gateway cobertos (43 testes); loop de orquestração completo (fetch+Supabase) sem teste |
| M04 | Lançamentos & Histórico (+ auditoria) | E2 | 🟡 Médio | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M05 | Contas a pagar (parciais + parceladas) | E3 | 🟡 Médio | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M06 | Cartões | E4 | 🟢 Pequeno | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M07 | Metas / Cofrinhos | E5 | 🟢 Pequeno | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M08 | Dashboard & Relatórios (export PDF) | E6 | 🟡 Médio | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M09 | Admin/Backoffice (9 telas + auditoria) | E9 | 🔴 Grande | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M10 | Perfil & PWA | E1/E10 | 🟢 Pequeno | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M11 | Conformidade LGPD & Observabilidade | E1 | 🟡 Médio | ✅ Concluído (2026-08-13, já na Esteira XP — `iaLimit`, `errorReporting`, `accountDeletion`, `accountExport` nascem com teste) |

**Regra do coração, aplicada retroativamente:** os três módulos de maior risco (M01 Auth/RBAC, M02
Billing, M03 Copiloto IA) são também os que mais precisam de cobertura de teste ao serem tocados
de novo — priorizar TDD real neles primeiro quando entrarem na Esteira XP.

## Contratos de API — edge functions existentes

```
POST /functions/v1/chat-ia
Auth: Bearer (usuário)
Body: { messages: {role, content}[], conversa_id?: string, persist?: boolean }
Response 200: { text: string, suggestion: object|null, conversa_id: string }
Response 401/429/402/500: { error: string }

POST /functions/v1/voice-transcribe
Auth: Bearer (usuário) · Body: multipart/form-data { file: audio, máx 20MB }
Response 200: { text: string }
Response 400/401/413/500: { error: string }

POST /functions/v1/payments-subscribe
Auth: Bearer (usuário)
Body: { cycle: "mensal"|"anual", cpfCnpj?: string, phone?: string }
Response 200: { subscriptionId: string, checkoutUrl: string|null, status: string }
Response 400/401/500: { error: string }

POST /functions/v1/payments-cancel
Auth: Bearer (usuário) · Body: {}
Response 200: { ok: true }
Response 401/404/500: { error: string }

POST /functions/v1/mercadopago-webhook?token=<MP_WEBHOOK_TOKEN>
Auth: token na querystring (não é sessão de usuário) · Body: payload do Mercado Pago
Response 200: { ok: true } · Response 401: { error: "Unauthorized" }

GET  /functions/v1/admin-users?q=<busca>            — requer role admin
GET  /functions/v1/admin-metrics                     — requer role admin
GET  /functions/v1/admin-ia-stats                    — requer role admin
POST /functions/v1/admin-user-actions
  Body: { action: "block"|"unblock"|"set_plan"|"movements"|"set_ia_limit", userId, ... }
POST /functions/v1/admin-set-premium
  Body: { userId: uuid, action: "grant"|"revoke", cycle?, meses? }
Response 403 em todas: { error: "Acesso restrito" } se role != admin

POST /functions/v1/account-export
Auth: Bearer (usuário) · Body: {}
Response 200: { exported_at, user_id, ...uma chave por tabela de domínio } — LGPD Art. 18, V
Response 401/500: { error: string }

POST /functions/v1/account-delete
Auth: Bearer (usuário) · Body: {}
Response 200: { ok: true } — apaga tabelas sem FK até auth.users e depois auth.admin.deleteUser()
Response 401/500: { error: string }
```

## Rastreabilidade história ↔ módulo

M01→E1 · M02→E8 · M03→E7 · M04→E2 · M05→E3 · M06→E4 · M07→E5 · M08→E6 · M09→E9 · M10→E1,E10.

## Auditoria de produção/comercialização — resolvido em 2026-08-13

Revisão completa de prontidão pra produção real e cobrança de clientes identificou 3 gaps 🔴
(bloqueantes) e 4 🟡 (importantes). Todos os que dependiam só de código foram fechados:

- 🔴 **LGPD.** Termos de Uso + Política de Privacidade (`/termos`, `/privacidade` — rascunho,
  marcado como tal, precisa de revisão jurídica antes de valer), aceite obrigatório
  (`ConsentGate`, cobre contas novas e existentes), exportação (`account-export`) e exclusão
  (`account-delete`) de conta.
- 🔴 **`ia_daily_limit` sem enforcement.** Coluna e UI de admin já existiam, mas nenhuma function
  checava — `_shared/iaLimit.ts` fecha isso em `chat-ia`.
- 🔴 **Sem monitoramento de erro.** `_shared/errorReporting.ts` reporta exceções pro Sentry (API
  legada `store`, sem SDK) quando `SENTRY_DSN` está setado; sem DSN, no-op silencioso — **DSN
  ainda não configurado em produção, pendência fora do código.**
- 🟡 **Senha fraca.** `minLength` 6→8 + exige letra e número (`src/lib/password.ts`), aplicado no
  cadastro e na troca de senha — **o projeto Supabase Auth em si ainda aceita mínimo 6, pendência
  de configuração no Dashboard, fora do alcance do código.**
- 🟡 **E-mail de admin hardcoded no trigger de novo usuário.** Removido — promoção de admin passa
  a ser só via UI (`admin-user-actions`), não mais por comparação de e-mail em todo cadastro novo.
- 🟡 **Confirmação de e-mail habilitada no Supabase Cloud real?** Não verificável a partir do
  código/repo — checar no Dashboard.
- 🟡 **Direito de arrependimento (CDC, 7 dias).** Coberto no rascunho de Termos (trial de 7 dias
  antecede toda cobrança) — decisão de reembolso final é de negócio/jurídico, sinalizada no texto.

## Débito técnico registrado (cards na lista de Arquitetura do Trello)

**Cobertura de testes — atualizado em 2026-08-13.** 148 testes reais no total (rodam em CI):

Frontend (Vitest, `npm run test`) — 26 testes:
- `src/lib/subscription.test.ts` (10) — `computeSubscriptionState`, trial/premium do M02.
- `src/lib/format.test.ts` (10) — `formatBRL`, `monthRange`, `daysUntil`, `parseBoldSegments`.
- `src/lib/password.test.ts` (5) — `validatePassword` (M11): mínimo 8, exige letra e número.
- `src/test/example.test.ts` (1) — placeholder original.

Edge functions (Deno, `deno test` em `supabase/functions/`) — 122 testes:
- `_shared/analytics.test.ts` (32) — as 13 tools de analítica do M03 (Copiloto IA): `comparar_meses`,
  `tendencia_categoria`, `media_gastos`, `melhor_cartao_hoje`, `gastos_recorrentes`, etc.
- `chat-ia/toolRouting.test.ts` (11) — decisão de roteamento do `registrar_lancamento` (propriedade
  de segurança mais crítica do M03: nenhuma tool executa no turno em que a IA tenta registrar um
  lançamento) + `decideGatewayOutcome` (mapeamento de status HTTP do gateway de IA pras mensagens
  de erro exibidas ao usuário — 429/402/erro genérico).
- `_shared/premium.test.ts` (9) — `computeIsPremium` (M01). Achou e corrigiu uma divergência real
  com a regra do frontend (`memoria-tecnica/bugs/ispremium-divergia-do-frontend.md`).
- `_shared/webhookAuth.test.ts` (7) — `safeTokenMatch` (M02), timing-safe compare do token do
  webhook.
- `_shared/authLogic.test.ts` (11) — `parseBearerToken`/`extractUserFromClaims`/`hasAdminRole`
  (M01), extraídas de `requireUser`/`isAdmin` em `auth.ts`.
- `_shared/payments/mercadopago.test.ts` (15) — `mapPreapprovalStatus`/`mapPaymentStatus`/
  `parseWebhook` (M02): tradução do vocabulário de status do Mercado Pago pro nosso
  `SubscriptionStatus` interno.
- `_shared/payments/webhookLogic.test.ts` (12) — `buildPreapprovalPatch`/`buildPaymentPatch` (M02):
  a lógica de decisão inteira do `mercadopago-webhook`, incluindo o cálculo de `premium_until`
  (mensal +1 mês / anual +12 meses).
- `payments-subscribe/logic.test.ts` (11) — `resolveCustomerIdentity`, `BodySchema` (zod) e
  `buildSubscriptionUpsertPayload` (M02) + teste de consistência `PLAN_PRICES` vs. o preço exibido
  em `src/pages/Planos.tsx`.
- `_shared/iaLimit.test.ts` (6) — `isDailyLimitExceeded`/`startOfTodayISO` (M11): enforcement de
  `ia_daily_limit` no `chat-ia`.
- `_shared/errorReporting.test.ts` (6) — `parseDsn`/`buildStoreUrl`/`buildAuthHeader`/
  `buildErrorEvent` (M11): integração com Sentry sem SDK.
- `_shared/accountDeletion.test.ts` (1) e `_shared/accountExport.test.ts` (1) — listas de tabelas
  (M11): quais cascateiam de `auth.users` sozinhas vs. quais `account-delete`/`account-export`
  precisam tocar explicitamente.

Integração de RLS contra Postgres real (`supabase/tests/rls_integration_check.sql`, **não roda em
CI ainda** — manual, via Docker descartável) — 9 cenários, incluindo os dois que validam o fix
crítico de `subscriptions` (usuário comum não consegue `INSERT`/`UPDATE` a própria assinatura pra
premium; `service_role` continua funcionando). Detalhe e achado de GUC em
`memoria-tecnica/decisoes/rls-integration-check-jwt-claim-guc.md`.

**O que ainda falta** (gap conhecido, não escondido): o loop de orquestração completo do
`Deno.serve` handler de `chat-ia` (o `for` que chama o gateway de IA + executa tools em sequência)
— as peças de decisão de dentro dele (roteamento do registrar_lancamento, status do gateway) estão
testadas isoladas, mas o fluxo completo (mock de `fetch` + Supabase encadeados) exigiria refatorar
`index.ts` pra injeção de dependência, ainda não feito. Mesma situação pra `payments-cancel`
(função pequena, majoritariamente I/O, sem lógica pura de peso pra extrair) e pro corpo em si de
`payments-subscribe`/`mercadopago-webhook` (as peças de decisão já estão cobertas — o que falta é
só o encadeamento de I/O, não regra de negócio).

Checklist completo no card "Débito técnico: cobertura de testes automatizados (TDD)" do Trello.

**Dependências vulneráveis (npm audit, resolvido em 2026-08-04).** 16 de 20 vulnerabilidades
corrigidas via `npm audit fix` sem major bump. As 4 restantes (Vite/esbuild moderate, React Router
moderate/high) exigem major version bump (Vite 5→8, React Router 6→7) — não aplicado sem
cobertura de teste prévia para pegar regressão. Card dedicado no Trello.

**Escopo do eslint (resolvido em 2026-08-04).** `supabase/functions` (Deno) estava sendo lintado
com a config de frontend por engano — corrigido. Ver
`memoria-tecnica/decisoes/eslint-scope-supabase-functions.md`.

**Lockfiles (`npm` vs `bun`, decisão registrada em 2026-08-04).** Ver
`memoria-tecnica/decisoes/gerenciador-de-pacotes-npm-vs-bun.md` — `bun.lock`/`bun.lockb` mantidos
por incerteza sobre o pipeline de deploy do Lovable Cloud, não removidos sem confirmação.

## Prazo técnico

Não se aplica retroativamente (produto já entregue). Para aditivos futuros, usar a fórmula padrão:

```
Prazo do aditivo = Σ(dias do(s) módulo(s) afetado(s), pela tabela de peso da seção 7 da metodologia)
```

## Ordem de execução (Kanban)

Board Trello **"Copiloto AI"** — ver `scripts/trello_sync.py`. Cards dos módulos M01–M10 nascem
diretamente na lista **✅ Concluído**, refletindo o estado real; débito técnico e novos pedidos
entram no fluxo normal (Backlog → A Fazer → Em Execução → Code Review → UAT → Concluído).
