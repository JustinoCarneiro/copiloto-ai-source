# Copiloto AI

SaaS de finanças pessoais com um assistente de IA ("Copiloto") que registra lançamentos por texto
ou voz e responde perguntas analíticas sobre o dinheiro do usuário.

> **Nota de proveniência.** Este `CLAUDE.md` foi reconstruído retroativamente em 2026-08-04,
> lendo o código-fonte, as migrations e as edge functions já existentes — o sistema já estava
> construído (via Lovable) e em produção antes da adoção da metodologia Onda-Dev. Não houve
> briefing formal com o cliente nesta reconstrução; onde a intenção de produto não é 100% óbvia a
> partir do código, isso está sinalizado no `docs/spec.md`. Toda mudança de escopo **daqui pra
> frente** deve seguir o processo normal (Fase 1 → `onda-spec-viva`).

## Stack
- **Frontend:** React 18 + Vite + TypeScript + shadcn/ui + Tailwind + TanStack Query + React Router
- **Backend:** Supabase (Postgres + Auth + Row Level Security + Edge Functions em Deno)
- **Pagamentos:** Mercado Pago, via camada `PaymentProvider` desacoplada
  (`supabase/functions/_shared/payments/`) — trocar de gateway é plugar outro provider, sem tocar
  o resto do sistema
- **IA:** `ai.gateway.lovable.dev` — Gemini (chat com function-calling) e Whisper/gpt-4o-mini
  (transcrição de voz)
- **Deploy:** Lovable Cloud (frontend) + Supabase (banco/functions gerenciados)

## Perfil de projeto
SaaS de assinatura recorrente (trial + planos mensal/anual) · perfis **usuário comum** e
**admin/backoffice** (RBAC) · produto B2C solo-user (sem multi-tenancy — cada usuário só vê os
próprios dados via RLS).

## Princípios (não-funcionais críticos)
- **Isolamento por usuário é absoluto:** toda tabela de domínio tem RLS `auth.uid() = user_id`;
  nenhuma linha de um usuário pode vazar para outro. Funções `SECURITY DEFINER` que verificam role
  (`has_role`/`private.has_role`) vivem fora do schema público pra não serem expostas via PostgREST.
- **A IA nunca inventa número.** Regra explícita no system prompt do `chat-ia`: toda métrica citada
  vem de uma tool call real contra o banco; se não há dado, ela diz isso em vez de estimar.
- **Lançamento por IA sempre passa por confirmação humana** antes de gravar (`registrar_lancamento`
  só sugere; o usuário confirma no app).
- **Dados de pagamento nunca client-side.** Toda a lógica de assinatura/cobrança roda em edge
  functions com `service_role`; o frontend só le `subscriptions`/`payment_logs` via RLS.
- **Auditoria onde há dinheiro ou permissão envolvidos:** `gastos_historico` (trigger em UPDATE de
  gastos), `admin_logs` (ações administrativas), `payment_logs` (eventos do gateway).
- **Direitos do titular (LGPD) são self-service.** Usuário exporta (`account-export`) e exclui
  (`account-delete`) os próprios dados direto pela página Perfil, sem precisar pedir pro suporte.
  Aceite de Termos de Uso/Privacidade é obrigatório antes de usar o app (`ConsentGate`), cobrindo
  tanto cadastro novo quanto contas que já existiam antes desse controle existir.
- **Erros de edge function são monitorados, não só logados.** `_shared/errorReporting.ts` reporta
  toda exceção pro Sentry (se `SENTRY_DSN` estiver configurado); nunca é a causa de uma resposta
  falhar, e nunca some silenciosamente em `console.error` perdido.

## Épicos
- **E1 — Autenticação & Perfil.** Cadastro/login (Supabase Auth), perfil próprio, troca de senha
  (mín. 8 caracteres, letra + número), criação automática de categorias padrão no primeiro acesso
  (`handle_new_user`), aceite obrigatório de Termos/Privacidade, exportação e exclusão de conta
  (LGPD) na página Perfil.
- **E2 — Lançamentos & Histórico.** CRUD de gastos/entradas, categorização, parcelamento,
  histórico de edições auditado.
- **E3 — Contas a pagar.** Contas fixas/avulsas/parceladas, pagamento total ou parcial, status
  (pendente/pago), geração de parcelas.
- **E4 — Cartões.** Cadastro de cartões (crédito/débito), limite, dia de fechamento/vencimento,
  sugestão de "melhor cartão para comprar hoje".
- **E5 — Metas / Cofrinhos.** Metas de economia com aporte/resgate, progresso, categoria dedicada
  "Cofrinho" (feature premium).
- **E6 — Dashboard & Relatórios.** Visão geral do mês, relatório mensal navegável, exportação em
  PDF, comparação entre meses.
- **E7 — Copiloto IA.** Chat com o assistente financeiro: registra lançamentos por linguagem
  natural, responde perguntas analíticas (13 ferramentas: resumo do mês, tendência por categoria,
  comparação de meses, gastos recorrentes, melhor cartão, etc.), aceita entrada por voz, mantém
  histórico de conversas com expurgo automático após 15 dias.
- **E8 — Assinatura & Billing.** Trial de 7 dias, planos mensal (R$19,90) e anual (R$199,90),
  checkout via Mercado Pago (Pix/cartão/boleto), cancelamento, histórico de cobranças, webhook de
  confirmação de pagamento.
- **E9 — Admin/Backoffice.** Painel restrito a `role = admin`: usuários, assinaturas, financeiro,
  status do gateway de pagamento, métricas de uso de IA, relatórios agregados, cupons de desconto,
  log de auditoria, configurações do app.
- **E10 — PWA/Onboarding.** Instalação do app como PWA (`InstallButton`).

## Máquina de estados principal
**Ciclo de assinatura** (`subscriptions.status`):
```
free → trialing (7 dias, automático no cadastro)
trialing → active (pagamento confirmado via webhook)
trialing → pending (assinatura criada, aguardando 1º pagamento)
active ⇄ overdue (falha/atraso de cobrança recorrente)
active | trialing | overdue → canceled (cancelamento pelo usuário)
```
**Status de conta a pagar** (`contas.status`): `pendente → pago` (parcial via `pagamentos_contas`,
trigger `atualiza_conta_pagamento` soma `valor_pago` e fecha quando `valor_pago >= valor`).

## Convenções
- Comunicação com o banco via Supabase client (frontend) e `service_role` client (edge functions)
  — sem camada REST própria; "contratos de API" no `ROADMAP.md` descrevem as edge functions HTTP.
- Nomenclatura de domínio em português (`gastos`, `contas`, `cartoes`, `metas`) — manter consistência.
- Diretiva Primária na Fase 4: não alterar sintaxe de código existente sem necessidade.

## Diretivas de Gestão (Regra de Ouro do Trello)
> **ATENÇÃO:** Toda vez que você (Claude/IA) criar, modificar ou deletar qualquer especificação
> funcional ou técnica nos arquivos `CLAUDE.md`, `ROADMAP.md`, `docs/spec.md` ou `design/DESIGN.md`,
> você é **OBRIGADO** a executar `./scripts/trello_sync.py` para espelhar essa alteração no board
> **"Copiloto AI"** no Trello (criar card no Backlog, atualizar Critérios de Aceite, ou arquivar o
> que foi cancelado). Documentação e Trello são a mesma entidade.

## Memória Técnica (Bugs e Decisões)
Vault Obsidian em [`./memoria-tecnica/`](./memoria-tecnica/_index.md), dentro do próprio repo —
bugs cabeludos resolvidos (causa raiz, não só sintoma) e decisões técnicas tomadas fora desta spec.

- **Antes de investigar um bug**, consultar `memoria-tecnica/bugs/` — pode já ter causa raiz documentada.
- **Antes de tomar decisão de arquitetura**, consultar `memoria-tecnica/decisoes/` — pode já existir uma decisão ativa sobre o assunto.
- **Ao resolver um bug não-trivial ou tomar uma decisão fora da spec**, registrar nota nova em `memoria-tecnica/` (templates em `memoria-tecnica/templates/`), linkando às notas relacionadas com a notação `[[nome-da-nota]]`.

## Débito técnico conhecido
- **Cobertura de testes automatizados — quase toda a lógica de negócio de M01/M02/M03 fechada.**
  148 testes rodando em CI: 26 no frontend (Vitest) + 122 nas edge functions (Deno,
  `supabase/functions/` — via `deno test`, configurado em `supabase/functions/deno.json`). Cobre
  Auth/RBAC, trial/premium, mapeamento de status do Mercado Pago, patch do webhook, payload de
  assinatura, as 13 tools + roteamento de tool_calls do Copiloto IA, enforcement de
  `ia_daily_limit`, política de senha e integração com Sentry. RLS validada à parte contra
  Postgres real (`supabase/tests/rls_integration_check.sql`, manual — não roda em CI).
  **Único gap real que sobra:** o loop de orquestração completo do `Deno.serve` handler de
  `chat-ia` e o corpo de I/O de `payments-cancel` — encadeamento de chamadas, não regra de
  negócio (essa já está coberta em módulos separados). Toda mudança em módulo existente ou módulo
  novo entra pela Esteira XP (`onda-xp-tdd`), com Red/Green/Refactor de verdade. Detalhe completo
  em `ROADMAP.md`.
- **4 vulnerabilidades de dependência sem fix não-breaking** (Vite/esbuild, React Router) — exigem
  major bump; adiado até haver cobertura de teste suficiente pra validar a migração sem regressão.
- **Pendências que não são código, precisam de ação fora do repo (ninguém verificou ainda):**
  (1) o texto de `/termos` e `/privacidade` é rascunho gerado por IA, marcado como tal na própria
  página — precisa de revisão jurídica antes de valer como termo real, e falta preencher
  razão social/CNPJ/e-mail do encarregado; (2) `SENTRY_DSN` ainda não está configurado em produção
  — sem ele, `errorReporting.ts` fica em no-op silencioso; (3) o `minLength` de senha do próprio
  projeto Supabase Auth (Dashboard → Authentication → Policies) precisa ser alinhado pra 8 — hoje
  só o frontend força isso, o backend do Supabase Cloud ainda aceita o mínimo de 6 dele; (4) não
  foi possível confirmar se confirmação de e-mail está habilitada no projeto Supabase Cloud real
  (não há acesso ao painel a partir daqui).

## Ponteiros
- Histórias completas: `./docs/spec.md`
- Blueprint técnico: `./ROADMAP.md`
- Identidade visual: `./design/tokens.css` + `./design/DESIGN.md`
- Memória técnica: `./memoria-tecnica/`
