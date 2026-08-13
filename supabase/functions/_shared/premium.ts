// Lógica pura de "usuário tem acesso premium?" usada por isPremium() (auth.ts). Extraída pra
// ser testável e, no processo, alinhada com a mesma regra já usada no frontend
// (src/lib/subscription.ts computeSubscriptionState) — as duas tinham divergido silenciosamente
// (ver memoria-tecnica/bugs/ para o achado completo). isPremium() hoje não tem nenhum chamador
// no código (dead code) — corrigido e testado do mesmo jeito, pra não herdar o bug quando algo
// vier a usá-la. `ia_daily_limit` (outro consumidor natural desta lógica) já tem enforcement
// próprio em chat-ia (_shared/iaLimit.ts), mas hoje é um teto por usuário setado manualmente
// pelo admin — ainda não deriva um default automático de "é premium ou não".

export interface SubscriptionRowForPremium {
  plano: string;
  status?: string | null;
  trial_ends_at?: string | null;
  premium_until?: string | null;
}

export function computeIsPremium(row: SubscriptionRowForPremium | null, now: number = Date.now()): boolean {
  if (!row) return false;
  const status = row.status ?? "free";
  const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null;
  const premiumUntil = row.premium_until ? new Date(row.premium_until).getTime() : null;

  // Mesma regra do frontend: trial só conta enquanto não virou premium de verdade e enquanto
  // não foi cancelado — sem isso, uma assinatura cancelada durante o trial continuava sendo
  // tratada como premium ativa aqui (bug real encontrado, nunca exercitado por não ter chamador).
  const trialActive = trialEndsAt !== null && trialEndsAt > now && row.plano !== "premium" && status !== "canceled";
  const premiumActive = row.plano === "premium" && status === "active" && (premiumUntil === null || premiumUntil > now);

  return trialActive || premiumActive;
}
