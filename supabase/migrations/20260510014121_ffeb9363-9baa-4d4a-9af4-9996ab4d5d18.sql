-- Pagamentos parciais
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';

-- Cartões inteligentes
ALTER TABLE public.cartoes ADD COLUMN IF NOT EXISTS bandeira text;
ALTER TABLE public.cartoes ADD COLUMN IF NOT EXISTS dia_fechamento integer;
ALTER TABLE public.cartoes ADD COLUMN IF NOT EXISTS dia_vencimento integer;

-- Tabela de pagamentos
CREATE TABLE IF NOT EXISTS public.pagamentos_contas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conta_id uuid NOT NULL,
  valor numeric NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pagamentos_contas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own pagamentos" ON public.pagamentos_contas;
CREATE POLICY "own pagamentos" ON public.pagamentos_contas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pag_conta ON public.pagamentos_contas(conta_id);

-- Trigger: atualiza conta automaticamente
CREATE OR REPLACE FUNCTION public.atualiza_conta_pagamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric;
  v_pago numeric;
  v_conta_id uuid;
BEGIN
  v_conta_id := COALESCE(NEW.conta_id, OLD.conta_id);
  SELECT valor INTO v_total FROM public.contas WHERE id = v_conta_id;
  SELECT COALESCE(SUM(valor),0) INTO v_pago FROM public.pagamentos_contas WHERE conta_id = v_conta_id;
  UPDATE public.contas SET
    valor_pago = v_pago,
    pago = (v_pago >= v_total),
    status = CASE WHEN v_pago <= 0 THEN 'pendente'
                  WHEN v_pago >= v_total THEN 'pago'
                  ELSE 'parcial' END,
    data_pagamento = CASE WHEN v_pago >= v_total THEN COALESCE(data_pagamento, CURRENT_DATE) ELSE NULL END
  WHERE id = v_conta_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pag_conta ON public.pagamentos_contas;
CREATE TRIGGER trg_pag_conta
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_contas
FOR EACH ROW EXECUTE FUNCTION public.atualiza_conta_pagamento();