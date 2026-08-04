import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { computeIsPremium } from "./premium.ts";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supa.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return { userId: data.claims.sub as string, email: data.claims.email as string | undefined };
}

export async function isAdmin(userId: string): Promise<boolean> {
  const s = serviceClient();
  const { data } = await s.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

export async function isPremium(userId: string): Promise<boolean> {
  const s = serviceClient();
  const { data } = await s.from("subscriptions").select("plano,status,trial_ends_at,premium_until").eq("user_id", userId).maybeSingle();
  return computeIsPremium(data);
}
