-- Suporta o consentimento de Termos de Uso/Privacidade exigido pela LGPD. Nullable de propósito:
-- cobre tanto contas novas quanto as já existentes antes desta mudança — o frontend (ConsentGate)
-- bloqueia o uso do app e pede aceite explícito pra qualquer perfil com terms_accepted_at nulo,
-- independente de a conta ter sido criada por e-mail/senha ou OAuth do Google.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
