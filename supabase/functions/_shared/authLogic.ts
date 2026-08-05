// Lógica pura de requireUser()/isAdmin() — extraída de auth.ts pra ser testável sem chamar a
// API de Auth do Supabase. O I/O em si (supa.auth.getClaims, query de user_roles) continua sem
// teste unitário — exigiria um Postgres/GoTrue reais (ver gap documentado no ROADMAP.md).

export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "");
}

export interface ClaimsResult {
  data: { claims?: Record<string, unknown> } | null;
  error: unknown;
}

export interface AuthedUser {
  userId: string;
  email?: string;
}

export function extractUserFromClaims(result: ClaimsResult): AuthedUser | null {
  if (result.error || !result.data?.claims) return null;
  const claims = result.data.claims;
  return { userId: claims.sub as string, email: claims.email as string | undefined };
}

export function hasAdminRole(row: { role: string } | null): boolean {
  return !!row;
}
