-- Segurança (CRÍTICO — achado da revisão de segurança de 2026-08-04, ver
-- memoria-tecnica/bugs/rls-subscriptions-sem-with-check.md):
--
-- As policies "own subscription insert"/"own subscription update" (migration
-- 20260417115251) só restringiam `auth.uid() = user_id`, sem WITH CHECK cobrindo as
-- demais colunas. Qualquer usuário autenticado podia, via PATCH/POST direto no
-- PostgREST com o próprio JWT + anon key pública, setar plano='premium',
-- status='active' e premium_until no futuro na própria linha — bypass completo do
-- Mercado Pago, sem nenhuma outra validação server-side (isPremium() em
-- supabase/functions/_shared/auth.ts lê exatamente essa tabela).
--
-- Nenhuma escrita legítima em `subscriptions` parte do client autenticado: a linha de
-- trial nasce via trigger SECURITY DEFINER (handle_new_user, migration
-- 20260713165725), e toda alteração de plano/status/pagamento acontece nas edge
-- functions (payments-subscribe, payments-cancel, mercadopago-webhook,
-- admin-set-premium, admin-user-actions) usando o client service_role, que já bypassa
-- RLS. Logo, a correção correta não é só adicionar WITH CHECK — é remover
-- completamente a permissão de escrita de `authenticated` nessa tabela.

DROP POLICY IF EXISTS "own subscription insert" ON public.subscriptions;
DROP POLICY IF EXISTS "own subscription update" ON public.subscriptions;

REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;
