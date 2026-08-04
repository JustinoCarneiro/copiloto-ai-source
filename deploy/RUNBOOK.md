# Runbook — self-host do Copiloto AI numa VPS

Migra o stack completo (Postgres + Auth + PostgREST + Edge Functions + frontend) do Supabase Cloud
+ Lovable Cloud pra uma VPS própria via Docker. Siga na ordem — cada seção tem um "gate" antes de
avançar pra próxima. **Nenhum passo de dado real de produção acontece antes do dry-run passar.**

Contexto arquitetural completo em [`memoria-tecnica/decisoes/self-host-supabase-vps.md`](../memoria-tecnica/decisoes/self-host-supabase-vps.md)
— inclui os achados reais desta VPS específica (confirmados via SSH em 2026-08-04), que já mudam
este runbook em relação a uma VPS nova/vazia. Resumo do que muda:

- **Docker já está instalado e em uso** (Sistema Melvin, Sistema Lucas, SawHub, Coolify já rodam
  aqui) — não precisa provisionar do zero, só clonar o repo.
- **Portas 80/443 já pertencem ao nginx do sistema** (fora do Docker) — por isso este stack **não
  usa Caddy nem nenhum proxy em Docker**. Kong e o frontend publicam só em `127.0.0.1`, e um vhost
  do nginx do sistema (mesmo padrão de `institutomelvin.org`) expõe pra internet.
- **Portas 8091 (frontend) e 8092 (kong) foram escolhidas por estarem livres** nesta VPS em
  2026-08-04. Ocupadas por outros projetos: `22, 53, 80, 443, 3000, 5432, 6001, 6002, 8000, 8081,
  8082, 8090, 8443` (Melvin, Lucas, Coolify). Confirmar de novo antes de subir se muito tempo tiver
  passado — outros projetos podem ter mudado.

## 0. Pré-requisitos

- Acesso SSH root/sudo na VPS (já confirmado — `root@<IP-da-VPS>`).
- Dois subdomínios apontáveis: `app.seudominio.com.br` (frontend) e `api.seudominio.com.br` (API).
  Não precisa apontar o DNS ainda — só decidir os nomes agora.
- Acesso ao painel do Supabase Cloud atual (pra pegar a connection string de produção depois).
- Acesso ao painel do Mercado Pago (pra trocar a URL do webhook depois).
- Conta no [Google Cloud Console](https://console.cloud.google.com/) se for manter login com
  Google.

## 1. Clonar o repo e configurar segredos

```bash
ssh root@<IP-da-VPS>
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
   Se a VPS não tiver Node instalável facilmente, rodar esse script localmente na sua máquina e só
   colar o resultado — o script não depende de nada do ambiente da VPS.
6. `APP_DOMAIN`, `API_DOMAIN`, `SITE_URL`, `API_EXTERNAL_URL`, `APP_URL`,
   `VITE_SUPABASE_URL` — usar os subdomínios decididos no passo 0.
7. `MERCADO_PAGO_ACCESS_TOKEN` — painel do Mercado Pago, credenciais de **produção** (não teste).
8. `LOVABLE_API_KEY` — mesma chave já usada hoje (é um serviço externo, independente de onde o
   resto roda).
9. **Login com Google** ([ver seção 6](#6-configurar-login-com-google) antes de continuar, ou
   pular por ora e deixar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` vazios — o resto do stack
   sobe normalmente sem isso, só o botão "Entrar com Google" não funciona até preencher).

## 2. Subir o stack com banco vazio

```bash
cd ~/copiloto-ai-source/deploy
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
ss -tlnp | grep -E ':8091|:8092'   # confirmar que só bindaram em 127.0.0.1, não 0.0.0.0
```

## 3. Dry-run — validar ANTES de tocar em dado real

Com o stack de pé e schema aplicado (ainda sem dado de produção), validar direto na VPS (tudo via
`localhost`, sem precisar do nginx/DNS configurados ainda):

```bash
# Auth: criar um usuário de teste
curl -X POST http://localhost:8092/auth/v1/signup \
  -H "apikey: <ANON_KEY do .env>" -H "Content-Type: application/json" \
  -d '{"email":"teste@example.com","password":"senha-teste-123"}'
# Esperado: 200 com um objeto de usuário. Confirma Auth + trigger handle_new_user
# (checar no Studio se profiles/categorias/subscriptions nasceram pro user_id novo).

# REST: listar categorias do usuário de teste (usar o access_token da resposta acima)
curl http://localhost:8092/rest/v1/categorias \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <access_token>"
# Esperado: as 7 categorias padrão.

# Edge Function: chat-ia
curl -X POST http://localhost:8092/functions/v1/chat-ia \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"oi"}]}'
# Esperado: resposta da IA (confirma LOVABLE_API_KEY + roteamento do dispatcher funcionando).

# Frontend buildou e sobe
curl -sI http://localhost:8091/ | head -1
# Esperado: HTTP/1.1 200 OK
```

Acessar o Studio via túnel SSH (não expor 8092 publicamente pra isso):
```bash
# Na sua máquina local:
ssh -L 8092:localhost:8092 root@<IP-da-VPS>
# Depois abrir http://localhost:8092/ no navegador local, com o basic auth do .env
```

**Gate:** só avançar pra seção 4 se os quatro testes acima passarem. Se algo falhar, o
`docker compose logs <serviço>` é o primeiro lugar a olhar — e `deploy/functions-main/index.ts`
tem uma nota de onde checar se for problema de roteamento das functions.

## 4. Configurar o nginx do sistema (vhost + SSL)

Mesmo padrão já usado pra `institutomelvin.org` nesta VPS — ver
[`deploy/nginx-vhost-example.conf`](./nginx-vhost-example.conf).

```bash
# Apontar o DNS de app.seudominio.com.br e api.seudominio.com.br pro IP da VPS antes deste passo
# (certbot precisa validar via HTTP).

cp ~/copiloto-ai-source/deploy/nginx-vhost-example.conf /etc/nginx/sites-available/copiloto-ai
# Editar /etc/nginx/sites-available/copiloto-ai: trocar "seudominio.com.br" pelo domínio real.
sed -i 's/seudominio\.com\.br/SEU-DOMINIO-REAL-AQUI/g' /etc/nginx/sites-available/copiloto-ai

ln -s /etc/nginx/sites-available/copiloto-ai /etc/nginx/sites-enabled/copiloto-ai
nginx -t   # valida a config antes de recarregar
systemctl reload nginx

certbot --nginx -d app.SEU-DOMINIO-REAL-AQUI -d api.SEU-DOMINIO-REAL-AQUI
# certbot já ajusta o arquivo sozinho pra apontar pros certificados gerados e recarrega o nginx.
```

## 5. Migrar o dado real de produção

**Ponto de não-retorno relativo — fazer numa janela curta de manutenção.**

No Supabase Cloud: painel → Settings → Database → copiar a "Connection string" (URI, modo
"Session", não "Transaction").

```bash
# Dump dos schemas auth + public (não esquecer o auth — é onde ficam os usuários!)
pg_dump "<connection-string-do-supabase-cloud>" \
  --schema=auth --schema=public --no-owner --no-privileges \
  -f copiloto_producao.sql

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

## 7. Cutover final — Mercado Pago e frontend

1. **Mercado Pago:** painel → Webhooks → trocar a URL pra
   `https://api.seudominio.com.br/functions/v1/mercadopago-webhook?token=<MP_WEBHOOK_TOKEN do .env>`.
2. **Frontend:** já builda com `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` do `.env` (via
   `docker compose build frontend`) — se mudou algo no `.env` depois do primeiro build, rebuildar:
   ```bash
   docker compose build frontend && docker compose up -d frontend
   ```

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
0 3 * * * root docker compose -f /root/copiloto-ai-source/deploy/docker-compose.yml exec -T db \
  pg_dump -U postgres postgres | gzip > /backups/copiloto-$(date +\%F).sql.gz \
  && find /backups -name 'copiloto-*.sql.gz' -mtime +14 -delete
```

Idealmente copiar os backups pra fora da própria VPS (outro storage) — backup que mora só na
mesma máquina que pode falhar não é backup de verdade. Vale conferir se já existe alguma rotina de
backup compartilhada nesta VPS (pra Melvin/Lucas) antes de inventar uma nova do zero.
