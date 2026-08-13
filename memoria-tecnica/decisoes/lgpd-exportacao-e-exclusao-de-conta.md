---
tipo: decisao
data: 2026-08-13
status: Ativa
---

# Exportação e exclusão de conta (LGPD): quais tabelas cascateiam sozinhas e quais não

## Contexto

A auditoria de prontidão pra produção/comercialização apontou que o sistema não tinha nenhum
mecanismo self-service pro usuário exercer os direitos de acesso/portabilidade/eliminação
previstos no Art. 18 da LGPD. Antes de implementar `account-delete`, era preciso levantar,
tabela por tabela, o que `supabase.auth.admin.deleteUser(userId)` já cascateia sozinho via FK
`ON DELETE CASCADE` — porque assumir que "tudo cascateia" seria o tipo de bug que só aparece
depois, com registros órfãos apontando pra um `user_id` que não existe mais.

## Decisão

Levantamento via grep em todas as migrations (`supabase/migrations/*.sql`), tabela por tabela:

**Cascateiam sozinhas de `auth.users`** (FK direta `ON DELETE CASCADE`): `profiles`, `categorias`,
`cartoes`, `gastos`, `contas`, `parcelas`, `metas`, `user_roles`, `payment_logs`.

**Cascateiam transitivamente** (FK indireta, via uma tabela que por sua vez cascateia):
`gastos_historico` (FK pra `gastos`, que cascateia de `auth.users`) e `ia_mensagens` (FK pra
`ia_conversas`, que **não** cascateia sozinha).

**NÃO cascateiam — sem FK nenhuma até `auth.users`, precisam ser apagadas explicitamente antes de
deletar o usuário:** `subscriptions`, `pagamentos_contas`, `ia_conversas`. Essa lista vive em
`_shared/accountDeletion.ts` (`TABLES_WITHOUT_USER_CASCADE`), testada (`accountDeletion.test.ts`)
justamente pra virar um teste que quebra se alguém adicionar uma tabela nova sem FK e esquecer de
atualizar a lista.

`account-export` usa uma lista separada e mais ampla (`_shared/accountExport.ts`,
`EXPORT_TABLES`), porque exportação não se importa com cascade — quer todas as 14 tabelas de
domínio com `user_id`, excluindo só as administrativas (`admin_logs`, `coupons`, `app_settings`,
que não são "dados do titular").

Consentimento (`profiles.terms_accepted_at`) usa um gate retroativo (`ConsentGate`, componente
React) em vez de só um checkbox no formulário de cadastro: o checkbox em `Auth.tsx` cobre o fluxo
de cadastro por e-mail, mas login via Google não passa por esse form nenhuma vez — e contas
criadas antes dessa mudança nunca viram checkbox nenhum. `ConsentGate` bloqueia qualquer usuário
autenticado com `terms_accepted_at` nulo antes de liberar o resto do app, independente de como a
conta foi criada ou de quando.

## Consequências

- Antes de adicionar qualquer tabela nova com `user_id`, checar se ela tem FK `ON DELETE CASCADE`
  até `auth.users` (direta ou transitiva). Se não tiver, ela precisa entrar em
  `TABLES_WITHOUT_USER_CASCADE` — senão `account-delete` deixa registro órfão.
  `accountDeletion.test.ts` só pega esse esquecimento se alguém lembrar de atualizar o teste junto
  com a lista; não é uma garantia automática vinda do schema.
- `account-export` devolve os dados como um único JSON por chamada — pode ficar pesado pra
  usuários com muito histórico de `ia_mensagens`. Não paginado ainda; ok pro volume atual.

## Ligado a
- [[admin-bootstrap-email-removido]]
