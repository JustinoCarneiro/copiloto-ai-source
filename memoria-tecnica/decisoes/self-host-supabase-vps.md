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
Studio (painel admin) e o frontend (build estático, nginx) — proxy/SSL fica por conta do nginx do
sistema já existente na VPS, não de um serviço Docker próprio (ver achados abaixo).

**Sem Storage, Realtime nem imgproxy** — confirmado por grep no código que o projeto não usa
nenhum dos dois (`avatar_url` vem do provider OAuth, não de upload). Reduz superfície de ataque e
consumo de recursos na VPS.

Artefatos completos em `deploy/` (docker-compose.yml, kong.yml, nginx-vhost-example.conf,
.env.example, generate-jwt-keys.cjs, RUNBOOK.md).

## Achado colateral importante

Ao investigar a migração, descobri que o login com Google **não usava o Supabase Auth
diretamente** — passava por um proxy do Lovable Cloud (`@lovable.dev/cloud-auth-js`, em
`src/integrations/lovable/index.ts`, chamado de `AuthContext.tsx`). Isso não seria óbvio olhando
só pro Supabase; só apareceu ao rastrear todo o fluxo de auth pra garantir que o self-host
cobriria 100% do login. Corrigido: `AuthContext.tsx` agora usa `supabase.auth.signInWithOAuth`
nativo, com credenciais Google OAuth próprias (Google Cloud Console) configuradas no GoTrue —
zero dependência do Lovable Cloud depois da migração.

## Achados reais da VPS compartilhada (2026-08-04, via SSH)

O plano inicial usava Caddy em Docker pra proxy/SSL — **revertido** depois de confirmar, direto na
VPS (`root@157.173.212.76`, mesma máquina de Sistema Melvin e Sistema Lucas), que:

- Portas 80/443 já pertencem a um **nginx do sistema** (fora de Docker), com vhosts manuais em
  `/etc/nginx/sites-available/` + certbot (Let's Encrypt) — exatamente o padrão de
  `institutomelvin.org` e `lucas`. Subir um Caddy em Docker tentando bindar 80/443 teria
  conflitado com esse nginx já em produção.
- A VPS também tem **Coolify** instalado (containers `coolify`, `coolify-db`, `coolify-redis`,
  `coolify-realtime`), mas com só um app de teste rodando nele, usando domínio automático
  `*.sslip.io` — não é o padrão usado pelos projetos reais (Melvin tem domínio próprio,
  `institutomelvin.org`). Não é a convenção estabelecida pra produção nesta VPS, mesmo estando
  instalado — decisão foi seguir o padrão comprovado (nginx manual), não o Coolify.
- Portas já ocupadas nesta VPS (`ss -tlnp`, 2026-08-04): `22, 53, 80, 443, 3000, 5432, 6001, 6002,
  8000, 8081, 8082, 8090, 8443`. Copiloto AI usa **8091** (frontend) e **8092** (Kong/API) — livres
  na data da checagem.

Ajustado em consequência: `deploy/docker-compose.yml` não tem mais serviço `caddy` (removido, com
`deploy/Caddyfile` deletado); Kong e frontend publicam só em `127.0.0.1:8092`/`127.0.0.1:8091`;
`deploy/nginx-vhost-example.conf` substitui o Caddyfile, no mesmo formato do vhost do Melvin.

## Consequências

- **Backup deixa de ser automático.** O Supabase Cloud cuida disso; self-hosted não. RUNBOOK.md
  seção 10 tem o cron de backup — **não considerar a migração concluída sem isso rodando**.
- **Segurança da VPS vira responsabilidade própria** (updates do SO, firewall, hardening do
  Docker) — não é mais responsabilidade da Supabase.
- **Rotação de JWT_SECRET** não é automática como no Cloud — se precisar revogar, rodar
  `deploy/generate-jwt-keys.cjs` de novo gera chaves novas, mas invalida TODAS as sessões
  existentes (todo mundo precisa logar de novo).
- Antes de repetir esse tipo de decisão pra outro projeto Onda: o self-host da Supabase é um bom
  meio-termo quando o motivo é custo/controle, não performance — não confundir com "trocar de
  banco", que teria custo de reescrita muito maior sem esse ganho.

## Ligado a
- [[rls-subscriptions-sem-with-check]]
