---
tipo: bug
data: 2026-08-04
severidade: crítica
status: Resolvido
---

# RLS de `subscriptions` sem WITH CHECK permitia auto-promoção a Premium sem pagar

## Sintoma

Nenhum sintoma observado em produção até este ponto — achado por revisão de segurança proativa
(agente `revisor-seguranca`) ao retrofitar o projeto pra metodologia Onda-Dev, não por incidente
reportado.

## Causa raiz

As policies `"own subscription insert"` e `"own subscription update"` na tabela `subscriptions`
(migration `20260417115251`) só tinham `USING (auth.uid() = user_id)`, sem `WITH CHECK` cobrindo
as demais colunas. Em Postgres, quando `WITH CHECK` é omitido numa policy de `UPDATE`, o próprio
`USING` é reaplicado como check da linha resultante — ou seja, o único requisito pra aceitar a
escrita era `user_id` continuar sendo o do próprio usuário autenticado. Nenhuma restrição existia
sobre `plano`, `status`, `premium_until` ou qualquer outra coluna.

Qualquer usuário autenticado podia, com seu próprio JWT + a `anon key` pública (embutida no bundle
do frontend), chamar a REST API do PostgREST diretamente:

```
PATCH /rest/v1/subscriptions?user_id=eq.<próprio-user-id>
{"plano":"premium","status":"active","premium_until":"2099-12-31T00:00:00Z"}
```

Isso setava a própria linha como Premium ativo até 2099, sem passar pelo Mercado Pago — e
`isPremium()` (`supabase/functions/_shared/auth.ts`) lê exatamente essa tabela como única fonte de
verdade de premium no servidor.

**Por que a policy de INSERT também precisava do mesmo tratamento:** ao investigar, confirmei que
nenhum fluxo legítimo insere em `subscriptions` pelo client autenticado — a linha de trial nasce
via trigger `SECURITY DEFINER` (`handle_new_user`, migration `20260713165725`), que bypassa RLS.
A policy de INSERT com `WITH CHECK (auth.uid() = user_id)` (sem restringir `plano`/`status`) era
uma segunda porta pro mesmo ataque, só que criando a linha do zero em vez de atualizá-la.

## Solução

Migration `20260804200000_fix_subscriptions_rls_no_client_writes.sql`: remove as duas policies de
escrita e faz `REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated`. Toda
escrita legítima já passava por edge functions com `service_role` (`payments-subscribe`,
`payments-cancel`, `mercadopago-webhook`, `admin-set-premium`, `admin-user-actions`), que ignoram
RLS — remover a permissão do client não quebra nenhum fluxo real. Só a policy de `SELECT` (própria
linha) permanece pro client autenticado.

Achados relacionados na mesma revisão, também corrigidos:
- XSS (self-XSS, severidade média) em `src/pages/Relatorios.tsx` via `dangerouslySetInnerHTML`
  com `categoria.nome` (texto livre do usuário) — trocado por `parseBoldSegments` em
  `src/lib/format.ts`, que retorna dados em vez de HTML.
- Comparação não-timing-safe do `MP_WEBHOOK_TOKEN` em `mercadopago-webhook/index.ts` — trocada por
  `timingSafeEqual` (severidade baixa).

## Ligado a
- [[eslint-scope-supabase-functions]]
