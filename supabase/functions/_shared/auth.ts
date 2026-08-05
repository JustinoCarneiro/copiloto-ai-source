import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { computeIsPremium } from "./premium.ts";
import { extractUserFromClaims, hasAdminRole, parseBearerToken } from "./authLogic.ts";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const token = parseBearerToken(authHeader);
  if (!token) return null;
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader! } } },
  );
  const result = await supa.auth.getClaims(token);
  return extractUserFromClaims(result);
}

export async function isAdmin(userId: string): Promise<boolean> {
  const s = serviceClient();
  const { data } = await s.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return hasAdminRole(data);
}

export async function isPremium(userId: string): Promise<boolean> {
  const s = serviceClient();
  const { data } = await s.from("subscriptions").select("plano,status,trial_ends_at,premium_until").eq("user_id", userId).maybeSingle();
  return computeIsPremium(data);
}
