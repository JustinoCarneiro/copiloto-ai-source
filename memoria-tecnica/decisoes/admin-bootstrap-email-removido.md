---
tipo: decisao
data: 2026-08-13
status: Ativa
---

# Remoção do e-mail de admin hardcoded no trigger de novo usuário

## Contexto

A auditoria de produção encontrou `agf3digital@gmail.com` hardcoded em duas migrations
(`20260713165725`, `20260716013902`), dentro do trigger `handle_new_user`: toda vez que uma conta
nova era criada, o trigger comparava `NEW.email` contra esse endereço fixo pra decidir se
promovia a admin. Fazia sentido como bootstrap do primeiro admin (não existia UI de RBAC ainda
quando o sistema foi construído no Lovable), mas continuar rodando essa comparação em **todo**
cadastro novo, pra sempre, é uma superfície permanente e desnecessária — e deixa um e-mail real do
fundador hardcoded no código-fonte do repositório.

## Decisão

Nova migration (`20260813120000_remove_hardcoded_admin_email_from_trigger.sql`) redefine
`handle_new_user` (via `CREATE OR REPLACE FUNCTION`) removendo o bloco `IF NEW.email = '...'`. As
migrations antigas que já promoveram o admin fundador não são alteradas nem revertidas — a
promoção já aconteceu e é histórica; só a checagem repetida em todo cadastro novo daqui pra frente
é que sai. Promoção de admin, de agora em diante, é só via `admin-user-actions` (UI de
`AdminUsuarios.tsx`), que já existe e já é RBAC de verdade (exige `role = admin` de quem chama).

## Consequências

- Se a conta admin de produção for perdida por algum motivo (ex.: reset de banco), não existe mais
  bootstrap automático por e-mail — promoção do primeiro admin nesse cenário precisa ser manual
  (`INSERT INTO user_roles ... VALUES (id, 'admin')` direto no banco, ou reintroduzir esse padrão
  temporariamente).
- Esta migration só existe no repositório — como as duas anteriores relacionadas a RLS de
  `subscriptions`, não há confirmação de que já foi aplicada no projeto Supabase Cloud real de
  produção.

## Ligado a
- [[lgpd-exportacao-e-exclusao-de-conta]]
- [[rls-subscriptions-sem-with-check]]
