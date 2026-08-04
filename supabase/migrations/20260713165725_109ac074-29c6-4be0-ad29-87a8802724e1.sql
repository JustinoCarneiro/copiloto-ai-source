-- 1. Enum de roles + tabela user_roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

-- 2. Expandir subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS gateway TEXT NOT NULL DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT,
  ADD COLUMN IF NOT EXISTS next_due_date DATE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS last_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- 3. payment_logs
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'asaas',
  event TEXT NOT NULL,
  status TEXT,
  amount NUMERIC(10,2),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_logs TO authenticated;
GRANT ALL ON public.payment_logs TO service_role;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own payment logs" ON public.payment_logs;
CREATE POLICY "Users view own payment logs" ON public.payment_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all payment logs" ON public.payment_logs;
CREATE POLICY "Admins view all payment logs" ON public.payment_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_payment_logs_user ON public.payment_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON public.subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_sub ON public.subscriptions(subscription_id);

-- 4. Endurecer funções internas
REVOKE EXECUTE ON FUNCTION public.atualiza_conta_pagamento() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;

-- 5. Trigger para promover admin inicial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.categorias (user_id, nome, icone, cor) VALUES
    (NEW.id, 'Alimentação', 'utensils', '#FF6A00'),
    (NEW.id, 'Transporte',  'car',      '#FF8C42'),
    (NEW.id, 'Lazer',       'gamepad-2','#A855F7'),
    (NEW.id, 'Mercado',     'shopping-cart','#10B981'),
    (NEW.id, 'Casa',        'home',     '#3B82F6'),
    (NEW.id, 'Saúde',       'heart-pulse','#EF4444'),
    (NEW.id, 'Salário',     'wallet',   '#22C55E');
  INSERT INTO public.subscriptions (user_id, plano, status, trial_started_at, trial_ends_at)
  VALUES (NEW.id, 'free', 'trialing', now(), now() + interval '7 days');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF NEW.email = 'agf3digital@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Promover admin se já existe
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'agf3digital@gmail.com'
ON CONFLICT DO NOTHING;