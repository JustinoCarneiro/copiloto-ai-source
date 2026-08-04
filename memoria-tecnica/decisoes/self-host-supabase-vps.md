---
tipo: decisao
data: 2026-08-04
status: Ativa
---

# Self-host do stack Supabase (Docker, VPS Hostinger) em vez de Postgres puro ou continuar gerenciado

## Contexto

O usuário perguntou se valia trocar pra "PostgreSQL puro" visando escalabilidade, e depois decidiu
hospedar o sistema numa VPS Hostinger, virando a produção real (não um ambiente paralelo).

Duas opções foram consideradas:
1. **Reescrever pra Postgres puro** (banco vanilla + backend próprio) — rejeitada. Supabase já É
   Postgres por baixo; a diferença toda está em Auth, RLS e Edge Functions, que teriam que ser
   reconstruídos do zero. Pra um sistema financeiro em produção, com dado real e (até este ponto)
   zero cobertura de teste na maior parte do código, essa reescrita teria risco altíssimo e nenhum
   ganho técnico real — só troca trabalho de infra por trabalho de reescrita de aplicação.
2. **Self-host do stack Supabase completo via Docker** — escolhida. Mesma API, Auth e RLS,
   migrations SQL já existentes aplicam sem alteração — só muda de onde roda.

## Decisão

Self-host via Docker Compose na VPS: Postgres (`supabase/postgres`, não vanilla — vem com os
schemas/roles/`auth.uid()` que as migrations do projeto já assumem), GoTrue (Auth), PostgREST
(REST), Edge Runtime (Deno, roda `supabase/functions/*` sem alteração de código), Kong (gateway),
Studio (painel admin), Caddy (reverse proxy + SSL automático) e o frontend (build estático, nginx).

**Sem Storage, Realtime nem imgproxy** — confirmado por grep no código que o projeto não usa
nenhum dos dois (`avatar_url` vem do provider OAuth, não de upload). Reduz superfície de ataque e
consumo de recursos na VPS.

Artefatos completos em `deploy/` (docker-compose.yml, kong.yml, Caddyfile, .env.example,
generate-jwt-keys.js, RUNBOOK.md).

## Achado colateral importante

Ao investigar a migração, descobri que o login com Google **não usava o Supabase Auth
diretamente** — passava por um proxy do Lovable Cloud (`@lovable.dev/cloud-auth-js`, em
`src/integrations/lovable/index.ts`, chamado de `AuthContext.tsx`). Isso não seria óbvio olhando
só pro Supabase; só apareceu ao rastrear todo o fluxo de auth pra garantir que o self-host
cobriria 100% do login. Corrigido: `AuthContext.tsx` agora usa `supabase.auth.signInWithOAuth`
nativo, com credenciais Google OAuth próprias (Google Cloud Console) configuradas no GoTrue —
zero dependência do Lovable Cloud depois da migração.

## Consequências

- **Backup deixa de ser automático.** O Supabase Cloud cuida disso; self-hosted não. RUNBOOK.md
  seção 10 tem o cron de backup — **não considerar a migração concluída sem isso rodando**.
- **Segurança da VPS vira responsabilidade própria** (updates do SO, firewall, hardening do
  Docker) — não é mais responsabilidade da Supabase.
- **Rotação de JWT_SECRET** não é automática como no Cloud — se precisar revogar, rodar
  `deploy/generate-jwt-keys.js` de novo gera chaves novas, mas invalida TODAS as sessões
  existentes (todo mundo precisa logar de novo).
- Antes de repetir esse tipo de decisão pra outro projeto Onda: o self-host da Supabase é um bom
  meio-termo quando o motivo é custo/controle, não performance — não confundir com "trocar de
  banco", que teria custo de reescrita muito maior sem esse ganho.

## Ligado a
- [[rls-subscriptions-sem-with-check]]
