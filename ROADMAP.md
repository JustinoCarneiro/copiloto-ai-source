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
| M01 | Auth & RBAC | E1 | 🔴 Grande | ✅ Concluído — `isPremium()` coberta (9 testes); `requireUser`/`isAdmin`/RLS ainda sem teste |
| M02 | Assinatura & Billing (Mercado Pago) | E8 | 🔴 Grande | ✅ Concluído — lógica de trial/premium coberta (10 testes); edge functions de pagamento ainda sem teste |
| M03 | Copiloto IA (chat + 13 tools + voz) | E7 | 🔴 Grande | ✅ Concluído — analítica das 13 tools coberta (32 testes) + propriedade de segurança do registrar_lancamento (6 testes); loop de orquestração completo (fetch+Supabase) ainda sem teste |
| M04 | Lançamentos & Histórico (+ auditoria) | E2 | 🟡 Médio | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M05 | Contas a pagar (parciais + parceladas) | E3 | 🟡 Médio | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M06 | Cartões | E4 | 🟢 Pequeno | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M07 | Metas / Cofrinhos | E5 | 🟢 Pequeno | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M08 | Dashboard & Relatórios (export PDF) | E6 | 🟡 Médio | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M09 | Admin/Backoffice (9 telas + auditoria) | E9 | 🔴 Grande | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |
| M10 | Perfil & PWA | E1/E10 | 🟢 Pequeno | ✅ Concluído (retroativo — pré-Onda, sem TDD formal) |

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
```

## Rastreabilidade história ↔ módulo

M01→E1 · M02→E8 · M03→E7 · M04→E2 · M05→E3 · M06→E4 · M07→E5 · M08→E6 · M09→E9 · M10→E1,E10.

## Débito técnico registrado (cards na lista de Arquitetura do Trello)

**Cobertura de testes — atualizado em 2026-08-04.** 75 testes reais no total (rodam em CI):

Frontend (Vitest, `npm run test`) — 21 testes:
- `src/lib/subscription.test.ts` (10) — `computeSubscriptionState`, trial/premium do M02.
- `src/lib/format.test.ts` (10) — `formatBRL`, `monthRange`, `daysUntil`, `parseBoldSegments`.
- `src/test/example.test.ts` (1) — placeholder original.

Edge functions (Deno, `deno test` em `supabase/functions/`) — 54 testes, **novos nesta rodada**:
- `_shared/analytics.test.ts` (32) — as 13 tools de analítica do M03 (Copiloto IA), extraídas
  pra `_shared/analytics.ts` como funções puras: `comparar_meses`, `tendencia_categoria`,
  `media_gastos`, `melhor_cartao_hoje`, `gastos_recorrentes`, etc.
- `chat-ia/toolRouting.test.ts` (6) — propriedade de segurança mais crítica do M03: quando a IA
  chama `registrar_lancamento`, nenhuma tool é executada nesse turno, só a sugestão é extraída.
- `_shared/premium.test.ts` (9) — `computeIsPremium` (M01), extraída de `isPremium()` em
  `auth.ts`. Achou e corrigiu uma divergência real com a regra do frontend (ver
  `memoria-tecnica/bugs/ispremium-divergia-do-frontend.md`) — código sem chamador hoje, mas o bug
  era real.
- `_shared/webhookAuth.test.ts` (7) — `safeTokenMatch` (M02), a comparação timing-safe do token
  do webhook do Mercado Pago, corrigida numa rodada anterior e nunca testada até agora.

**O que ainda falta** (gaps conhecidos, não escondidos):
- M01: `requireUser`/`isAdmin` (I/O direto com Supabase Auth) e as próprias policies RLS no
  Postgres — precisam de teste de integração contra um banco real/de teste, não unitário.
- M02: as edge functions de pagamento (`payments-subscribe`, `payments-cancel`,
  `mercadopago-webhook`) inteiras — só a peça pura (`safeTokenMatch`) foi coberta, o fluxo
  completo (chamadas HTTP ao Mercado Pago) não.
- M03: o loop de orquestração completo do `chat-ia` (`Deno.serve` handler) — só a decisão de
  roteamento do `registrar_lancamento` foi isolada e testada; o loop inteiro (mock de `fetch` +
  Supabase) exigiria refatorar `index.ts` pra injeção de dependência, ainda não feito.

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
