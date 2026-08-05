---
tipo: decisao
data: 2026-08-04
status: Ativa
---

# Verificação de integração de RLS contra Postgres real — GUC certo é `request.jwt.claim.sub`

## Contexto

Depois de fechar a cobertura unitária de M01/M02/M03, faltava validar as próprias RLS policies —
lógica que não roda em `deno test` (é comportamento do Postgres, não TypeScript). Escrevi
`supabase/tests/rls_integration_check.sql`, rodado contra um Postgres descartável
(`supabase/postgres:15.6.1.146` via Docker, nunca a VPS nem produção) com todas as migrations
aplicadas de verdade, incluindo o fix crítico de `subscriptions`
([[rls-subscriptions-sem-with-check]]).

## Achado (armadilha real na primeira tentativa)

Primeira tentativa usou `SET LOCAL request.jwt.claims = '{"sub":"...","role":"authenticated"}'`
(blob JSON) — é o formato mais comum documentado pela Supabase em geral. Resultado: todo SELECT
do próprio dono retornava 0 linhas, como se `auth.uid()` nunca resolvesse.

Causa: `auth.uid()` **nesta versão da imagem** (`supabase/postgres:15.6.1.146`) é:
```sql
select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
```
Um GUC "achatado" por claim (`request.jwt.claim.sub`, singular, sem o `s` de `claims`) — não o
blob JSON `request.jwt.claims`. PostgREST seta esse GUC individualmente por claim internamente;
o formato JSON blob é de uma convenção diferente/mais antiga que não bate com esta versão.

## Decisão

`supabase/tests/rls_integration_check.sql` usa `SET LOCAL request.jwt.claim.sub = '<uuid>'`
(GUC direto, sem JSON). Documentado como comentário no topo do próprio arquivo, pra quem rodar de
novo não perder tempo com o mesmo engano.

## Resultado da verificação (2026-08-04)

9/9 cenários passaram, incluindo os dois críticos:
- Usuário autenticado comum **não consegue** `UPDATE`/`INSERT` em `subscriptions` (bloqueado a
  nível de `permission denied`, não só de RLS silenciosa) — confirma que o fix de
  `REVOKE INSERT, UPDATE, DELETE ... FROM authenticated` funciona contra Postgres real, não só
  em teoria.
- `service_role` continua conseguindo escrever normalmente (edge functions não quebraram).
- Isolamento padrão (`gastos`, `categorias`, outra assinatura) confirmado nos dois sentidos.

## Consequências

- **Não está em CI** — rodar manualmente (comando completo no cabeçalho do próprio `.sql`) antes
  de qualquer mudança em RLS, principalmente em `subscriptions`. Automatizar em CI exigiria
  orquestrar Postgres no GitHub Actions — não feito ainda, fica como próximo passo se o time achar
  que vale o custo de manutenção.
- Ao adicionar RLS pra uma tabela nova, replicar o padrão dos testes 1/2/8/9 (isolamento SELECT +
  UPDATE entre dois usuários) — é barato de escrever e pega regressão de policy rápido.

## Ligado a
- [[rls-subscriptions-sem-with-check]]
