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
- **Deploy:** produção real ainda em Lovable Cloud (frontend) + Supabase (banco/functions
  gerenciados). Existe um stack self-hosted paralelo (Docker, VPS compartilhada com Sistema
  Melvin/Lucas/SAW HUB) já no ar e validado via dry-run completo em 2026-08-13 — mas **ainda sem
  cutover**: sem dado real migrado, sem `MERCADO_PAGO_ACCESS_TOKEN`/`LOVABLE_API_KEY`, hoje
  respondendo em domínios sslip.io provisórios. Ver `deploy/RUNBOOK.md`.

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
- ~~4 vulnerabilidades de dependência sem fix não-breaking (Vite/esbuild, React Router)~~ —
  **resolvido em 2026-08-13.** `react-router-dom` 6→7.18.2 e `vite` 5→7.3.6 (não 8: a vulnerabilidade
  do esbuild já está corrigida a partir do esbuild 0.25, que o Vite passou a empacotar desde a
  6.3 — subir só até a 7.x resolve o CVE sem forçar o `vitest` pra uma major nova junto, que exigiria
  vite@8). `npm audit` limpo (0 vulnerabilidades). 148 testes + build + dev server verificados
  depois do bump, nenhuma quebra.
- **Pendências que não são código — exigem ação fora do repo, ninguém verificou/preencheu ainda.**
  Atualizado em 2026-08-13.

  *Compliance/produção (independem do self-host):*
  1. Texto de `/termos` e `/privacidade` é rascunho gerado por IA (marcado como tal na própria
     página) — precisa de revisão jurídica antes de valer como termo real, e falta preencher razão
     social/CNPJ/e-mail do encarregado.
  2. `SENTRY_DSN` não está configurado em nenhum ambiente ainda — sem ele, `errorReporting.ts` fica
     em no-op silencioso (não quebra nada, só não reporta erro pra lugar nenhum).
  3. `minLength` de senha do próprio projeto Supabase Auth (Dashboard → Authentication → Policies)
     precisa subir pra 8 — hoje só o frontend força isso, o backend do Supabase Cloud ainda aceita
     mínimo 6.
  4. Não foi possível confirmar se confirmação de e-mail está habilitada no Supabase Cloud real
     (sem acesso ao painel a partir daqui).
  5. Não confirmado se as migrations de segurança já rodaram na produção real do Supabase Cloud:
     `20260804200000_fix_subscriptions_rls_no_client_writes.sql` (crítica — bloqueia auto-promoção
     a Premium sem pagar) e `20260813120000_remove_hardcoded_admin_email_from_trigger.sql` +
     `20260813120100_add_terms_accepted_at_to_profiles.sql`. O SQL está pronto no repo; falta
     alguém com acesso ao painel/CLI do projeto real rodar.

  *Self-host na VPS (`deploy/RUNBOOK.md` — dry-run já validado, cutover não feito, ver
  `memoria-tecnica/decisoes/self-host-supabase-vps.md`):*
  6. `MERCADO_PAGO_ACCESS_TOKEN` e `LOVABLE_API_KEY` reais — sem eles, pagamento e chat de IA ficam
     indisponíveis no self-host (usuário optou por seguir sem, por ora).
  7. Domínio próprio — hoje respondendo em `copiloto-app.157.173.212.76.sslip.io` /
     `copiloto-api...sslip.io` (sem custo, mesmo padrão do SAW HUB nesta VPS). Trocar por domínio
     real é reconfiguração pequena (`.env` + vhost do nginx), não um redesenho.
  8. Migração do dado real de produção (RUNBOOK seção 5) — janela curta de manutenção, ponto de
     não-retorno relativo, só depois do item 6 preenchido.
  9. Cron de backup do Postgres self-hosted (RUNBOOK seção 10) — sem isso, self-host não tem a
     rede de segurança que o Supabase Cloud dava de graça. **Não considerar o self-host "pronto"
     sem isso rodando**, mesmo que o cutover em si já tenha acontecido.
  10. Sem SMTP configurado no self-host, nenhum e-mail transacional sai — não só confirmação de
      cadastro (contornado com `GOTRUE_MAILER_AUTOCONFIRM: "true"`, decisão explícita do usuário
      em 2026-08-13), mas qualquer fluxo de recuperação de senha por e-mail também ficaria sem
      efeito se usado. **Revisar antes de qualquer cutover real:** configurar SMTP de verdade (e
      voltar `GOTRUE_MAILER_AUTOCONFIRM` pra `"false"`) ou aceitar conscientemente cadastro sem
      confirmação de e-mail em produção.
  11. Login com Google no self-host não está configurado (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
      vazios) — só e-mail/senha funciona por enquanto. Passo a passo em RUNBOOK seção 6.
  12. Self-host ainda não tem dado real nenhum — é um banco de teste vazio, não é hoje um
      substituto usável da produção (isso só muda com o item 8, migração do dado real).

## Ponteiros
- Histórias completas: `./docs/spec.md`
- Blueprint técnico: `./ROADMAP.md`
- Identidade visual: `./design/tokens.css` + `./design/DESIGN.md`
- Memória técnica: `./memoria-tecnica/`
