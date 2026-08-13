-- O admin fundador (agf3digital@gmail.com) já foi promovido pelas migrations anteriores
-- (20260713165725, 20260716013902) — essa promoção é histórica e não precisa ser desfeita.
-- O problema era o trigger `handle_new_user` continuar comparando NEW.email contra esse
-- endereço fixo em TODO cadastro novo daqui em diante: uma checagem que só faz sentido uma vez
-- (bootstrap do primeiro admin) virou uma superfície permanente com um e-mail real do fundador
-- hardcoded no código-fonte. Daqui pra frente, promoção de admin é só via
-- admin-user-actions/admin-set-premium (RBAC via UI), não por e-mail no signup.
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
  RETURN NEW;
END;
$$;
