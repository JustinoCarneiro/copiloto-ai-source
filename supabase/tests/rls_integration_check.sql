-- Verificação de integração de RLS — roda contra um Postgres REAL (não é lógica pura, não roda
-- em `deno test`). Existe pra validar o comportamento de ponta a ponta das policies depois de
-- aplicar as migrations, em especial o fix crítico de 2026-08-04 (ver
-- memoria-tecnica/bugs/rls-subscriptions-sem-with-check.md). Não está automatizada em CI ainda
-- (exigiria orquestrar Postgres no GitHub Actions) — rodar manualmente antes de qualquer mudança
-- de RLS, e sempre que a migration de subscriptions for tocada de novo.
--
-- Como rodar (Postgres descartável via Docker, não é a VPS nem produção):
--   docker run -d --name copiloto_rls_check -e POSTGRES_PASSWORD=testpass123 \
--     -e JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long \
--     -p 15432:5432 supabase/postgres:15.6.1.146
--   # aguardar ficar pronto (docker logs -f copiloto_rls_check)
--   for f in supabase/migrations/*.sql; do
--     docker exec -i copiloto_rls_check psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
--   done
--   docker exec -i copiloto_rls_check psql -U postgres -d postgres <<'SQL'
--     INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
--       ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"full_name":"Alice"}'::jsonb, 'authenticated', 'authenticated'),
--       ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"full_name":"Bob"}'::jsonb, 'authenticated', 'authenticated');
--     INSERT INTO public.gastos (user_id, descricao, valor, tipo)
--       VALUES ('11111111-1111-1111-1111-111111111111', 'Almoço', 45.00, 'saida');
-- SQL
--   docker exec -i copiloto_rls_check psql -U postgres -d postgres < supabase/tests/rls_integration_check.sql
--   docker rm -f copiloto_rls_check   # descartar ao final — nunca aponta pra produção
--
-- IMPORTANTE: `auth.uid()` nesta imagem lê o GUC `request.jwt.claim.sub` (formato "achatado",
-- um GUC por claim) — NÃO `request.jwt.claims` como blob JSON. Achado ao rodar isso pela
-- primeira vez (os testes de SELECT do próprio dono davam 0 linhas até corrigir o nome do GUC).

\echo '--- TESTE 1: Bob NÃO vê os gastos de Alice ---'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT count(*) = 0 AS passou FROM public.gastos;
ROLLBACK;

\echo '--- TESTE 2: Alice VÊ o próprio gasto ---'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT count(*) = 1 AS passou FROM public.gastos;
ROLLBACK;

\echo '--- TESTE 3 (CRÍTICO): Bob NÃO consegue se auto-promover a premium via UPDATE direto ---'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
DO $$
BEGIN
  BEGIN
    UPDATE public.subscriptions SET plano = 'premium', status = 'active', premium_until = '2099-12-31'
    WHERE user_id = '22222222-2222-2222-2222-222222222222';
    RAISE EXCEPTION 'FALHOU: UPDATE deveria ter sido bloqueado por permissão, mas passou';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'passou (bloqueado corretamente: %)', SQLERRM;
  END;
END $$;
ROLLBACK;

\echo '--- TESTE 4 (CRÍTICO): Bob NÃO consegue inserir uma linha premium pra si mesmo ---'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.subscriptions (user_id, plano, status, premium_until)
    VALUES ('33333333-3333-3333-3333-333333333333', 'premium', 'active', '2099-12-31');
    RAISE EXCEPTION 'FALHOU: INSERT deveria ter sido bloqueado por permissão, mas passou';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'passou (bloqueado corretamente: %)', SQLERRM;
  END;
END $$;
ROLLBACK;

\echo '--- TESTE 5: Bob VÊ a própria assinatura (SELECT continua permitido) ---'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT count(*) = 1 AS passou FROM public.subscriptions WHERE user_id = '22222222-2222-2222-2222-222222222222';
ROLLBACK;

\echo '--- TESTE 6: service_role AINDA consegue escrever em subscriptions (edge functions) ---'
BEGIN;
SET LOCAL ROLE service_role;
UPDATE public.subscriptions SET plano = 'premium', status = 'active' WHERE user_id = '22222222-2222-2222-2222-222222222222';
SELECT plano = 'premium' AS passou FROM public.subscriptions WHERE user_id = '22222222-2222-2222-2222-222222222222';
ROLLBACK;

\echo '--- TESTE 7: has_role identifica corretamente um não-admin ---'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT private.has_role('22222222-2222-2222-2222-222222222222'::uuid, 'admin') = false AS passou;
ROLLBACK;

\echo '--- TESTE 8: Alice NÃO vê a assinatura de Bob ---'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT count(*) = 0 AS passou FROM public.subscriptions WHERE user_id = '22222222-2222-2222-2222-222222222222';
ROLLBACK;

\echo '--- TESTE 9: Alice NÃO consegue editar categoria de Bob ---'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
UPDATE public.categorias SET nome = 'Hackeado' WHERE user_id = '22222222-2222-2222-2222-222222222222';
SELECT count(*) = 0 AS passou FROM public.categorias WHERE user_id = '22222222-2222-2222-2222-222222222222' AND nome = 'Hackeado';
ROLLBACK;

\echo '--- Fim. Ler cada "passou" acima — precisa ser "t" (true) em todos, ou "NOTICE: passou" nos testes 3/4. ---'
