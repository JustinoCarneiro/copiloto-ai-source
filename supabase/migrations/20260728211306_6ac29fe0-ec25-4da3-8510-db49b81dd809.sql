
-- Create a private schema to host the SECURITY DEFINER helper so PostgREST cannot expose it
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Recreate has_role inside the private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate policies referencing public.has_role to use private.has_role instead
DROP POLICY IF EXISTS "Admins view all payment logs" ON public.payment_logs;
CREATE POLICY "Admins view all payment logs" ON public.payment_logs
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins view logs" ON public.admin_logs;
CREATE POLICY "admins view logs" ON public.admin_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "read active coupons" ON public.coupons;
CREATE POLICY "read active coupons" ON public.coupons FOR SELECT TO authenticated
  USING (ativo = true OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage coupons" ON public.coupons;
CREATE POLICY "admins manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage settings" ON public.app_settings;
CREATE POLICY "admins manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- Drop the publicly exposed helper
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
