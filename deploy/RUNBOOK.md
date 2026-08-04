# Runbook — self-host do Copiloto AI numa VPS

Migra o stack completo (Postgres + Auth + PostgREST + Edge Functions + frontend) do Supabase Cloud
+ Lovable Cloud pra uma VPS própria via Docker. Siga na ordem — cada seção tem um "gate" antes de
avançar pra próxima. **Nenhum passo de dado real de produção acontece antes do dry-run passar.**

Contexto arquitetural completo em [`memoria-tecnica/decisoes/self-host-supabase-vps.md`](../memoria-tecnica/decisoes/self-host-supabase-vps.md).

---

## 0. Pré-requisitos

- VPS Hostinger com Ubuntu 22.04 ou 24.04 LTS, acesso SSH root/sudo.
- Dois subdomínios apontáveis: um pro frontend (`app.seudominio.com.br`), um pra API
  (`api.seudominio.com.br`). Não precisa apontar o DNS ainda — só decidir os nomes agora.
- Acesso ao painel do Supabase Cloud atual (pra pegar a connection string de produção depois).
- Acesso ao painel do Mercado Pago (pra trocar a URL do webhook depois).
- Uma conta no [Google Cloud Console](https://console.cloud.google.com/) se for manter login com
  Google.

## 1. Provisionar a VPS

```bash
# Na VPS, via SSH:
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Relogar (ou `newgrp docker`) pra o grupo docker valer sem sudo.
docker compose version   # confirma que o plugin compose veio junto
```

## 2. Clonar o repo e configurar segredos

```bash
git clone https://github.com/JustinoCarneiro/copiloto-ai-source.git
cd copiloto-ai-source/deploy
cp .env.example .env
```

Preencher `.env` (ver comentários de cada variável no próprio arquivo):
1. `openssl rand -base64 32` → `POSTGRES_PASSWORD`
2. `openssl rand -base64 40` → `JWT_SECRET`
3. `openssl rand -base64 24` → `DASHBOARD_PASSWORD`
4. `openssl rand -hex 32` → `MP_WEBHOOK_TOKEN`
5. Rodar `node generate-jwt-keys.js` (a partir de `deploy/`, com `JWT_SECRET` já preenchido) e
   colar `ANON_KEY`/`SERVICE_ROLE_KEY` em **todos** os campos correspondentes indicados nos
   comentários do `.env` (aparecem em mais de um lugar de propósito — ver nota no topo do arquivo).
6. `APP_DOMAIN`, `API_DOMAIN`, `SITE_URL`, `API_EXTERNAL_URL`, `APP_URL`,
   `VITE_SUPABASE_URL` — usar os subdomínios decididos no passo 0.
7. `MERCADO_PAGO_ACCESS_TOKEN` — painel do Mercado Pago, credenciais de **produção** (não teste).
8. `LOVABLE_API_KEY` — mesma chave já usada hoje (é um serviço externo, independente de onde o
   resto roda).
9. **Login com Google** ([ver seção 6](#6-configurar-login-com-google) antes de continuar, ou
   pular por ora e deixar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` vazios — o resto do stack
   sobe normalmente sem isso, só o botão "Entrar com Google" não funciona até preencher).

## 3. Subir o stack com banco vazio

```bash
cd copiloto-ai-source/deploy
docker compose config   # valida a sintaxe sem subir nada — rodar sempre depois de mexer no .env
docker compose up -d db
docker compose logs -f db   # esperar "database system is ready to accept connections"
```

Aplicar as migrations do projeto, **na ordem dos nomes de arquivo** (já são cronológicas):

```bash
for f in ../supabase/migrations/*.sql; do
  echo "Aplicando: $f"
  docker compose exec -T db psql -U postgres -d postgres -f - < "$f"
done
```

Se algum arquivo falhar, **parar e investigar antes de continuar** — não pular migration com erro.

Subir o resto do stack:

```bash
docker compose up -d
docker compose ps   # todos os serviços "healthy" ou "running"
docker compose logs -f functions   # confirmar "main function started" sem erro
```

## 4. Dry-run — validar ANTES de tocar em dado real

Com o stack de pé e schema aplicado (ainda sem dado de produção), validar direto na VPS:

```bash
# Auth: criar um usuário de teste
curl -X POST http://localhost:8000/auth/v1/signup \
  -H "apikey: <ANON_KEY do .env>" -H "Content-Type: application/json" \
  -d '{"email":"teste@example.com","password":"senha-teste-123"}'
# Esperado: 200 com um objeto de usuário. Confirma Auth + trigger handle_new_user
# (checar no Studio se profiles/categorias/subscriptions nasceram pro user_id novo).

# REST: listar categorias do usuário de teste (usar o access_token da resposta acima)
curl http://localhost:8000/rest/v1/categorias \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <access_token>"
# Esperado: as 7 categorias padrão.

# Edge Function: chat-ia
curl -X POST http://localhost:8000/functions/v1/chat-ia \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"oi"}]}'
# Esperado: resposta da IA (confirma LOVABLE_API_KEY + roteamento do dispatcher funcionando).
```

Acessar o Studio (`http://<IP-da-VPS>:8000/` com o basic auth do `.env`, antes de configurar
DNS/Caddy — ou depois via `https://api.seudominio.com.br/`) e conferir visualmente as tabelas.

**Gate:** só avançar pra seção 5 se os três testes acima passarem. Se algo falhar, o
`docker compose logs <serviço>` é o primeiro lugar a olhar — e `deploy/functions-main/index.ts`
tem uma nota de onde checar se for problema de roteamento das functions.

## 5. Migrar o dado real de produção

**Ponto de não-retorno relativo — fazer numa janela curta de manutenção.**

No Supabase Cloud: painel → Settings → Database → copiar a "Connection string" (URI, modo
"Session", não "Transaction").

```bash
# Dump dos schemas auth + public (não esquecer o auth — é onde ficam os usuários!)
pg_dump "<connection-string-do-supabase-cloud>" \
  --schema=auth --schema=public --no-owner --no-privileges \
  -f copiloto_producao.sql

# Copiar o dump pra VPS se não tiver rodado o pg_dump direto nela, depois:
docker compose exec -T db psql -U postgres -d postgres < copiloto_producao.sql
```

Depois de restaurar, validar contagens batendo com a origem (rodar a mesma query nos dois lados):

```sql
select 'profiles', count(*) from public.profiles
union all select 'gastos', count(*) from public.gastos
union all select 'subscriptions', count(*) from public.subscriptions
union all select 'auth.users', count(*) from auth.users;
```

## 6. Configurar login com Google

No [Google Cloud Console](https://console.cloud.google.com/): APIs e Serviços → Credenciais →
Criar credenciais → ID do cliente OAuth → Aplicativo da Web.
- **URIs de redirecionamento autorizados:** `https://api.seudominio.com.br/auth/v1/callback`
  (seu `API_DOMAIN` real, tem que bater exatamente).
- Copiar Client ID e Client Secret pro `.env` (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`).
- `docker compose up -d auth` pra recarregar com as novas variáveis.

## 7. Cutover — Mercado Pago, DNS e frontend

1. **Mercado Pago:** painel → Webhooks → trocar a URL pra
   `https://api.seudominio.com.br/functions/v1/mercadopago-webhook?token=<MP_WEBHOOK_TOKEN do .env>`.
2. **DNS:** apontar `app.seudominio.com.br` e `api.seudominio.com.br` (registro A) pro IP da VPS.
   Propagação pode levar minutos a algumas horas.
3. **Frontend:** já builda com `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` do `.env` (via
   `docker compose build frontend`) — se mudou algo no `.env` depois do primeiro build, rebuildar:
   ```bash
   docker compose build frontend && docker compose up -d frontend
   ```
4. Confirmar que o Caddy emitiu certificado (`docker compose logs caddy` — procurar
   "certificate obtained successfully" pros dois domínios).

## 8. Smoke test pós-cutover

Nessa ordem (módulos de maior risco primeiro, igual à Regra do Coração da metodologia Onda):
1. Login com e-mail/senha de uma conta real existente.
2. Login com Google (se configurado).
3. Ver saldo/histórico de uma conta com dado migrado — bate com o que aparecia antes da migração?
4. Lançar um gasto novo, confirmar que aparece no histórico e no dashboard.
5. Abrir `/assinatura` de uma conta premium ativa — status e data de cobrança corretos?
6. Mandar uma mensagem pro Copiloto IA, confirmar resposta.
7. Login como admin, abrir `/admin` — métricas carregando.

## 9. Rollback

Se algo crítico falhar depois do cutover: reverter o DNS pros endereços antigos (Lovable Cloud +
Supabase Cloud) — **não pausar/deletar o projeto Supabase Cloud** até ter certeza que o self-host
está estável por pelo menos alguns dias em produção. Mercado Pago: reverter a URL do webhook pra
antiga enquanto isso.

## 10. Backups (fazer antes de considerar a migração "pronta")

Sem isso, este runbook resolveu o deploy mas criou um novo risco (sem backup automático como o
Supabase Cloud tinha). Configurar cron na VPS:

```bash
# /etc/cron.d/copiloto-backup — dump diário, mantém 14 dias
0 3 * * * root docker compose -f /caminho/pro/repo/deploy/docker-compose.yml exec -T db \
  pg_dump -U postgres postgres | gzip > /backups/copiloto-$(date +\%F).sql.gz \
  && find /backups -name 'copiloto-*.sql.gz' -mtime +14 -delete
```

Idealmente copiar os backups pra fora da própria VPS (outro storage) — backup que mora só na
mesma máquina que pode falhar não é backup de verdade.
