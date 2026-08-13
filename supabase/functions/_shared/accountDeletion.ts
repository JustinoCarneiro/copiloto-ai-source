// Tabelas de domínio SEM FK (direta ou transitiva) até auth.users — supabase.auth.admin.deleteUser()
// não cascateia essas sozinho, precisam ser apagadas explicitamente antes de deletar o usuário.
// Todo o resto (profiles, categorias, cartoes, gastos, contas, parcelas, metas, user_roles,
// payment_logs) cascateia via FK ON DELETE CASCADE direta em auth.users. `gastos_historico`
// cascateia transitivamente de `gastos` (que cascateia de auth.users). `ia_mensagens` cascateia
// transitivamente de `ia_conversas` — por isso é `ia_conversas` que está nesta lista, não
// `ia_mensagens`. Levantamento completo em memoria-tecnica/decisoes/exclusao-conta-lgpd.md.
export const TABLES_WITHOUT_USER_CASCADE = ["subscriptions", "pagamentos_contas", "ia_conversas"] as const;
