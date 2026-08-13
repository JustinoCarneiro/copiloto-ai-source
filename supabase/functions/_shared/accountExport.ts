// LGPD Art. 18, V (portabilidade) — todas as tabelas de domínio filtráveis por user_id, exportadas
// como um JSON por tabela. Não inclui tabelas administrativas (admin_logs, coupons, app_settings)
// que não são "dados do titular", são operação interna do backoffice.
export const EXPORT_TABLES = [
  "profiles", "categorias", "cartoes", "gastos", "contas", "parcelas", "metas",
  "user_roles", "payment_logs", "subscriptions", "pagamentos_contas",
  "ia_conversas", "ia_mensagens", "gastos_historico",
] as const;
