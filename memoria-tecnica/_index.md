---
tipo: indice
---

# Memória Técnica — Copiloto AI

Base de conhecimento viva do projeto: bugs cabeludos resolvidos (com causa raiz) e decisões técnicas
tomadas fora da spec original do [`CLAUDE.md`](../CLAUDE.md). Não documenta conceitos genéricos — só o
que é específico deste projeto e não seria óbvio olhando só o código.

Padrão da metodologia Onda-Dev — ver seção 11 de
[`Metodologia_de_Desenvolvimento_-_Onda.md`](../../onda-starter/docs/Metodologia_de_Desenvolvimento_-_Onda.md)
pro critério completo de quando vale (e quando não vale) criar uma nota aqui.

## Como usar
- **Antes de investigar um bug**, procurar em `bugs/` se algo parecido já foi resolvido.
- **Antes de tomar uma decisão de arquitetura**, procurar em `decisoes/` se já existe uma decisão
  relacionada (evita reabrir debate já resolvido ou contradizer uma decisão ativa).
- **Ao resolver um bug não-trivial** (que exigiu investigação real, causa raiz não óbvia a partir do
  código) ou **tomar uma decisão técnica fora da spec**, criar uma nota nova usando `templates/bug.md`
  ou `templates/decisao.md`, e linkar às notas relacionadas com a notação `[[nome-da-nota]]`.
- Não criar nota se o fato já tem um lar melhor (já é critério de aceite no `CLAUDE.md`, ou já tem um
  aviso dedicado em outro doc) — isso duplicaria a fonte de verdade em vez de complementá-la.

## Bugs
- [[rls-subscriptions-sem-with-check]] — crítico: RLS de `subscriptions` sem `WITH CHECK` permitia
  auto-promoção a Premium sem pagar. Resolvido em 2026-08-04.
- [[ispremium-divergia-do-frontend]] — baixa (código morto): `isPremium()` do backend tinha regra
  de trial diferente do frontend, achado ao escrever testes. Resolvido em 2026-08-04.
- [[teste-daysuntil-flaky-fuso-horario]] — baixa: teste de `daysUntil` usava `toISOString()` e
  ficava intermitente dependendo do fuso/hora do dia. Resolvido em 2026-08-04.

## Decisões
- [[eslint-scope-supabase-functions]] — por que `supabase/functions` saiu do escopo do eslint e
  `no-explicit-any` foi rebaixado a `warn` temporariamente.
- [[gerenciador-de-pacotes-npm-vs-bun]] — por que `bun.lock`/`bun.lockb` foram mantidos mesmo com
  npm como padrão de dev/CI.
- [[self-host-supabase-vps]] — por que self-host do stack Supabase via Docker numa VPS, não
  reescrita pra Postgres puro; inclui o achado de que o login com Google dependia de um proxy do
  Lovable Cloud (corrigido pra OAuth nativo do Supabase Auth).
- [[rls-integration-check-jwt-claim-guc]] — verificação de RLS contra Postgres real validou o fix
  crítico de `subscriptions` de ponta a ponta; GUC certo pra simular `auth.uid()` é
  `request.jwt.claim.sub`, não o blob `request.jwt.claims`.

Decisões arquiteturais que já existiam no código antes deste retrofit (ex.: desacoplamento de
gateway de pagamento em `PaymentProvider`) ficam documentadas no `ROADMAP.md`, não repetidas aqui.
