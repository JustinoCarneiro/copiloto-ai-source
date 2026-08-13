---
tipo: bug
data: 2026-08-13
severidade: alta (bloqueava o stack inteiro de subir)
status: Resolvido
---

# Primeiro boot real do self-host na VPS: 4 bugs de infra que só apareciam rodando de verdade

## Contexto

Todo o `deploy/` (docker-compose.yml, kong.yml, RUNBOOK.md) tinha sido escrito e validado só com
`docker compose config` (sintaxe) numa sessão anterior — nunca tinha rodado de verdade contra a
VPS real. No primeiro boot efetivo (2026-08-13, dry-run na mesma VPS do Sistema Melvin), 4 bugs
reais apareceram em sequência. Nenhum deles seria pego por `docker compose config`.

## Bug 1 — tag do `supabase/studio` não existe mais no registry

`supabase/studio:20241001-c7c6a5d` (pinada em 2026-08-04) sumiu do Docker Hub — a Supabase mudou a
convenção de tag do Studio pra `AAAA.MM.DD-sha-<hash>` em algum momento entre as duas datas.
**Solução:** repinar pra uma tag válida atual (`2026.08.03-sha-022b374`), confirmada via
`curl https://hub.docker.com/v2/repositories/supabase/studio/tags`. Lição: mesmo pinando versão
(certo, evita `:latest`), ainda vale reconfirmar que a tag pinada continua existindo antes de um
boot real — o registry pode aposentar tags antigas.

## Bug 2 — mount aninhado de `functions/main` falha com "read-only file system"

`docker-compose.yml` monta `../supabase/functions:/home/deno/functions:ro` e, por cima,
`./functions-main:/home/deno/functions/main:ro` (mount aninhado). Erro real:
```
unable to start container process: error during container init: error mounting
".../deploy/functions-main" to rootfs at "/home/deno/functions/main": create mountpoint
"...": mkdirat ...: read-only file system
```
Docker precisa criar o diretório `main/` como mountpoint pro segundo mount, mas não consegue
porque o mount pai já é `:ro` e o `main/` não existia de verdade dentro de `supabase/functions/`
no host (só existia no diretório separado `deploy/functions-main/`). **Solução:** criar
`supabase/functions/main/` de verdade (com um `.gitkeep`) — ele vira a origem do mount pai, já
contendo o subdiretório que o segundo mount precisa sobrepor. Lição: mount aninhado onde o pai é
`:ro` só funciona se o mountpoint do filho já existir fisicamente na ORIGEM do mount pai.

## Bug 3 — `authenticator`/`supabase_auth_admin` sem senha nenhuma

O mais demorado de diagnosticar. `auth` (GoTrue) e `rest` (PostgREST) entravam em restart loop com
`password authentication failed`, mesmo com `POSTGRES_PASSWORD` idêntico entre `.env` e o que os
containers recebiam (confirmado byte a byte). Causa raiz, descoberta em camadas:

1. Testar a senha via `docker compose exec db psql "postgresql://user:pw@localhost/..."` **não
   prova nada** — bate na regra `host all all 127.0.0.1/32 trust` do `pg_hba.conf`, que aceita
   qualquer senha (ou nenhuma) por vir de loopback. Só um teste cruzando a rede Docker de verdade
   (`docker run --rm --network <net> postgres:15-alpine psql "postgresql://user:pw@db/..."`)
   reproduz o que `auth`/`rest` realmente fazem.
2. Com o teste certo, o erro se repetia mesmo com senha correta. `select rolpassword from
   pg_authid where rolname='authenticator'` mostrou **vazio** — a imagem `supabase/postgres` cria
   essas roles (authenticator, supabase_auth_admin, e outras) SEM setar senha nenhuma a partir de
   `POSTGRES_PASSWORD`. O compose oficial completo do Supabase resolve isso com um `roles.sql`
   próprio que este stack, trimado, não tinha copiado.
3. Tentativa de corrigir com `ALTER ROLE authenticator WITH PASSWORD '...'` direto (mesmo como
   superuser `postgres`) falha: `"authenticator" is a reserved role, only superusers can modify
   it` — mensagem enganosa (quem tentou já É superuser). O bloqueio é da extensão `supautils`
   (`supautils.reserved_roles`), que existe especificamente pra impedir troca de senha/associação
   dessas roles (proteção contra escalada de privilégio via RLS).
4. **Solução real** (confirmada consultando o compose oficial do próprio Supabase no GitHub):
   montar um `.sql` com as mesmas `ALTER USER ... PASSWORD :'pgpass'` dentro de
   `/docker-entrypoint-initdb.d/init-scripts/` (não solto em `/docker-entrypoint-initdb.d/` — tem
   que ser especificamente essa subpasta). É o mesmo contexto privilegiado que os próprios scripts
   internos da imagem usam pra fazer `ALTER ROLE` nessas roles sem esbarrar no `supautils`. Ver
   `deploy/db-init-scripts/99-roles.sql`.

Cogitado e descartado: desligar `supautils.reserved_roles` temporariamente via `ALTER SYSTEM` +
`pg_reload_conf()` — funcionaria, mas é reinventar (pior) algo que já tem solução oficial
documentada, e o classificador de segurança do modo automático bloqueou a tentativa (corretamente
cauteloso com esse tipo de comando).

## Bug 4 — `kong:3.6` não tem `envsubst`

`kong.yml.template` tem `${DASHBOARD_USERNAME}`/`${DASHBOARD_PASSWORD}` pra substituir antes do
Kong subir. O comando original usava `envsubst` (padrão do compose oficial do Supabase) — mas a
imagem `kong:3.6` não tem `gettext` instalado (`sh: 1: envsubst: not found`), e o redirect da
saída ainda tentava escrever em `/home/kong/kong.yml`, caminho sem permissão de escrita pro
usuário não-root do container (`cannot create /home/kong/kong.yml: Permission denied` — esse foi
o PRIMEIRO erro que apareceu, mascarando o do `envsubst` que só ficou visível depois de trocar o
destino pra `/tmp/kong.yml`). **Solução:** troca `envsubst` por `sed` (sempre disponível, não
depende de pacote extra) e escreve em `/tmp/kong.yml` em vez de `/home/kong/kong.yml`.

## Bug 5 (achado no teste manual do usuário, não no dry-run automatizado) — sem SMTP, cadastro trava

`GOTRUE_MAILER_AUTOCONFIRM` estava `"false"` (padrão seguro) mas sem nenhum `GOTRUE_SMTP_*`
configurado — ou seja, GoTrue exige confirmação de e-mail mas não tem como enviar o e-mail de
confirmação. Resultado: usuário se cadastra com sucesso, tenta logar, recebe "Email not
confirmed" pra sempre, sem nenhum caminho de saída pela UI. Só apareceu no teste manual do
usuário (o dry-run automatizado sempre confirmava manualmente via SQL antes de testar login, o
que mascarou esse problema). **Solução adotada:** `GOTRUE_MAILER_AUTOCONFIRM: "true"` até SMTP
real ser configurado — decisão explícita do usuário, documentada como pendência de revisão antes
de qualquer cutover de produção real (ver `memoria-tecnica/decisoes/self-host-supabase-vps.md`).

Efeito colateral do mesmo teste manual: dois bugs de UX reais também apareceram e foram corrigidos
— mensagem de erro do GoTrue aparecia crua em inglês pro usuário PT-BR (`src/lib/authErrors.ts`,
tradução das mensagens mais comuns) e a regra de senha forte só aparecia depois de errar o
submit, não como dica visível de antemão (adicionado texto de ajuda fixo abaixo do campo em
`Auth.tsx`/`Perfil.tsx`).

## Erro de operação (meu, não do stack) — `rsync` sem barra final apagou e reestruturou `src/` na VPS

Ao sincronizar o frontend corrigido, rodei `rsync -avz --delete src root@...:.../src/` (sem barra
final em `src`) — isso faz o rsync tratar `src` como a PASTA a copiar PRA DENTRO do destino
`.../src/`, gerando `.../src/src/*` aninhado, enquanto `--delete` removia o conteúdo real de
`.../src/` por não bater com o único item esperado (a pasta `src` aninhada). Só percebido porque
o bundle rebuildado continuava com o hash antigo (rebuild usava conteúdo cacheado/desatualizado).
**Lição:** `rsync` com diretório como origem — sempre barra final (`src/`, não `src`) quando o
destino já é o diretório de conteúdo equivalente, e **conferir o conteúdo realmente sincronizado**
(`grep` de uma string conhecida no arquivo remoto) antes de assumir que um `--delete` silencioso
não bagunçou nada.

## Por que nenhum desses apareceu antes

`docker compose config` só valida sintaxe YAML/interpolação de variável — nunca baixa imagem, nunca
monta volume de verdade, nunca inicia processo dentro do container. Os 4 bugs só existem no mundo
real de "a imagem existe? o mount funciona? o binário existe dentro da imagem? a extensão de
segurança permite essa operação?" — nenhuma dessas perguntas tem resposta estática. Não tem
substituto pra rodar de verdade numa VPS real antes de considerar um runbook "pronto".

## Ligado a
- [[self-host-supabase-vps]]
