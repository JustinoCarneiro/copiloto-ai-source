-- 1. Adicionar data_pagamento em contas
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS data_pagamento date;

-- 2. Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plano text NOT NULL DEFAULT 'free' CHECK (plano IN ('free','premium')),
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  premium_until timestamptz,
  ciclo text CHECK (ciclo IN ('mensal','anual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subscription view"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "own subscription insert"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own subscription update"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Atualizar handle_new_user para criar trial premium de 7 dias
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.subscriptions (user_id, plano, trial_started_at, trial_ends_at)
  VALUES (NEW.id, 'free', now(), now() + interval '7 days');

  RETURN NEW;
END;
$function$;

-- Garantir trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill subscriptions para usuários já existentes
INSERT INTO public.subscriptions (user_id, plano, trial_started_at, trial_ends_at)
SELECT id, 'free', now(), now() + interval '7 days'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions)
ON CONFLICT (user_id) DO NOTHING;