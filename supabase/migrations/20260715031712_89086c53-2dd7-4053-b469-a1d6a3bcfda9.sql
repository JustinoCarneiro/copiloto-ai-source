
-- ============ Gastos histórico ============
CREATE TABLE public.gastos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id uuid NOT NULL REFERENCES public.gastos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changes jsonb NOT NULL
);
GRANT SELECT ON public.gastos_historico TO authenticated;
GRANT ALL ON public.gastos_historico TO service_role;
ALTER TABLE public.gastos_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history read" ON public.gastos_historico FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX gastos_historico_gasto_idx ON public.gastos_historico(gasto_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_gasto_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diff jsonb := '{}'::jsonb;
BEGIN
  IF NEW.descricao IS DISTINCT FROM OLD.descricao THEN diff := diff || jsonb_build_object('descricao', jsonb_build_array(OLD.descricao, NEW.descricao)); END IF;
  IF NEW.destino IS DISTINCT FROM OLD.destino THEN diff := diff || jsonb_build_object('destino', jsonb_build_array(OLD.destino, NEW.destino)); END IF;
  IF NEW.valor IS DISTINCT FROM OLD.valor THEN diff := diff || jsonb_build_object('valor', jsonb_build_array(OLD.valor, NEW.valor)); END IF;
  IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN diff := diff || jsonb_build_object('tipo', jsonb_build_array(OLD.tipo, NEW.tipo)); END IF;
  IF NEW.forma_pagamento IS DISTINCT FROM OLD.forma_pagamento THEN diff := diff || jsonb_build_object('forma_pagamento', jsonb_build_array(OLD.forma_pagamento, NEW.forma_pagamento)); END IF;
  IF NEW.categoria_id IS DISTINCT FROM OLD.categoria_id THEN diff := diff || jsonb_build_object('categoria_id', jsonb_build_array(OLD.categoria_id, NEW.categoria_id)); END IF;
  IF NEW.cartao_id IS DISTINCT FROM OLD.cartao_id THEN diff := diff || jsonb_build_object('cartao_id', jsonb_build_array(OLD.cartao_id, NEW.cartao_id)); END IF;
  IF NEW.parcelas IS DISTINCT FROM OLD.parcelas THEN diff := diff || jsonb_build_object('parcelas', jsonb_build_array(OLD.parcelas, NEW.parcelas)); END IF;
  IF NEW.data IS DISTINCT FROM OLD.data THEN diff := diff || jsonb_build_object('data', jsonb_build_array(OLD.data, NEW.data)); END IF;
  IF diff <> '{}'::jsonb THEN
    INSERT INTO public.gastos_historico(gasto_id, user_id, changes) VALUES (NEW.id, NEW.user_id, diff);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_gasto_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_gastos_log_change AFTER UPDATE ON public.gastos
FOR EACH ROW EXECUTE FUNCTION public.log_gasto_change();

-- ============ IA conversas / mensagens ============
CREATE TABLE public.ia_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_conversas TO authenticated;
GRANT ALL ON public.ia_conversas TO service_role;
ALTER TABLE public.ia_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversas" ON public.ia_conversas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ia_conversas_user_idx ON public.ia_conversas(user_id, updated_at DESC);

CREATE TABLE public.ia_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.ia_conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  suggestion jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_mensagens TO authenticated;
GRANT ALL ON public.ia_mensagens TO service_role;
ALTER TABLE public.ia_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mensagens" ON public.ia_mensagens FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ia_mensagens_conversa_idx ON public.ia_mensagens(conversa_id, created_at);

-- Cleanup: apagar conversas do próprio usuário com mais de 15 dias, disparado no INSERT de nova mensagem
CREATE OR REPLACE FUNCTION public.cleanup_ia_old()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ia_conversas
  WHERE user_id = NEW.user_id
    AND updated_at < now() - interval '15 days';
  UPDATE public.ia_conversas SET updated_at = now() WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_ia_old() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ia_cleanup AFTER INSERT ON public.ia_mensagens
FOR EACH ROW EXECUTE FUNCTION public.cleanup_ia_old();
