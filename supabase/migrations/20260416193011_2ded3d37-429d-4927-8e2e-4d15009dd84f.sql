-- =============== PROFILES ===============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============== CATEGORIAS ===============
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  icone TEXT NOT NULL DEFAULT 'tag',
  cor TEXT NOT NULL DEFAULT '#FF6A00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categorias" ON public.categorias FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_categorias_user ON public.categorias(user_id);

-- =============== CARTOES ===============
CREATE TABLE public.cartoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('credito','debito')),
  cor TEXT NOT NULL DEFAULT '#FF6A00',
  limite NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cartoes" ON public.cartoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_cartoes_user ON public.cartoes(user_id);

-- =============== GASTOS (lançamentos) ===============
CREATE TABLE public.gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  destino TEXT,
  valor NUMERIC(12,2) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'saida' CHECK (tipo IN ('entrada','saida')),
  forma_pagamento TEXT CHECK (forma_pagamento IN ('debito','credito','dinheiro','pix')),
  cartao_id UUID REFERENCES public.cartoes(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  parcelas INTEGER NOT NULL DEFAULT 1,
  valor_parcela NUMERIC(12,2),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gastos" ON public.gastos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_gastos_user_data ON public.gastos(user_id, data DESC);

-- =============== CONTAS ===============
CREATE TABLE public.contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  destino TEXT,
  valor NUMERIC(12,2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('fixa','avulsa','parcelada')),
  total_parcelas INTEGER DEFAULT 1,
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  pago BOOLEAN NOT NULL DEFAULT false,
  data_vencimento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contas" ON public.contas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_contas_user ON public.contas(user_id);

-- =============== PARCELAS ===============
CREATE TABLE public.parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conta_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  pago BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own parcelas" ON public.parcelas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_parcelas_conta ON public.parcelas(conta_id);

-- =============== METAS (COFRINHOS) ===============
CREATE TABLE public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor_objetivo NUMERIC(12,2) NOT NULL,
  valor_atual NUMERIC(12,2) NOT NULL DEFAULT 0,
  icone TEXT DEFAULT 'piggy-bank',
  cor TEXT DEFAULT '#FF6A00',
  data_objetivo DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own metas" ON public.metas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_metas_user ON public.metas(user_id);

-- =============== TIMESTAMPS TRIGGER ===============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== AUTO PROFILE + CATEGORIAS PADRÃO ===============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();