-- Mesmo padrão do compose oficial self-host do Supabase (volumes/db/roles.sql) — a imagem
-- supabase/postgres cria authenticator/supabase_auth_admin/etc. SEM senha nenhuma por padrão
-- (confirmado rodando de verdade: "User has no password assigned" nos logs). Tentar setar depois
-- com um ALTER ROLE solto esbarra na proteção do supautils ("reserved role, only superusers can
-- modify it" — mensagem enganosa, o bloqueio é do supautils, não falta de privilégio real).
-- O jeito que FUNCIONA (comprovado no compose oficial): montar este .sql dentro de
-- /docker-entrypoint-initdb.d/init-scripts/ (não solto na raiz de /docker-entrypoint-initdb.d/) —
-- essa subpasta roda dentro do mesmo contexto privilegiado que o migrate.sh da imagem usa pros
-- próprios scripts internos dela, sem acionar a proteção do supautils.
\set pgpass `echo "$POSTGRES_PASSWORD"`
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
