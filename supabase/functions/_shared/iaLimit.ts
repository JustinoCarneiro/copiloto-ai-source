// Enforcement de subscriptions.ia_daily_limit — coluna já existia e já tinha UI de admin
// (admin-user-actions), mas nenhuma edge function checava antes de gastar uma chamada de IA.
// `null` mantém o significado que a coluna já tinha (sem limite, nullable sem default): é o
// admin quem opta por colocar um teto por usuário, não um teto global implícito.
export function isDailyLimitExceeded(countToday: number, limit: number | null | undefined): boolean {
  if (limit == null) return false;
  return countToday >= limit;
}

export function startOfTodayISO(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}
