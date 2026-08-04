# Plano — Copiloto Inteligente + Painel Super Admin

Escopo grande. Vou dividir em 4 blocos entregáveis. Confirma tudo ou peça para eu executar por partes.

---

## Bloco 1 — Copiloto AI com memória contextual (analítica real)

Objetivo: a IA passa a **analisar** dados reais, não só responder.

**Backend (`chat-ia` edge function)** — adicionar novas *tools* que a IA pode chamar, sempre filtradas por `user_id` do JWT:
- `comparar_meses(mes_a, mes_b)` — total, delta %, breakdown por categoria.
- `tendencia_categoria(categoria, semanas)` — crescimento/redução nas últimas N semanas.
- `media_gastos(meses=3)` — média móvel + flag "acima da média".
- `progresso_metas()` — % concluído + estimativa em meses no ritmo atual.
- `contas_a_vencer(dias=7)` — lista de `contas` com `data_vencimento` próxima.
- `uso_cartoes()` — utilização por cartão (soma vs limite) + qual está mais utilizado.
- `melhor_cartao_hoje()` — dado hoje, retorna cartão cujo **fechamento é o mais distante** (maior prazo p/ pagar).
- `gastos_recorrentes()` — descrições/destinos repetidos ≥3x nos últimos 90d com valor médio elevado.

**System prompt** — instruir:
- Sempre chamar tools antes de opinar sobre números.
- Nunca inventar. Se tool retornar vazio → dizer "sem dados suficientes".
- Formatar respostas curtas com números concretos e comparações (%, R$).
- Sugerir ações (ex.: "use cartão X, fecha em 12 dias").

Sem novas tabelas — usa `gastos`, `contas`, `cartoes`, `metas`, `categorias` já existentes.

---

## Bloco 2 — Memória de conversas (já parcialmente feita)

Já existem `ia_conversas` + `ia_mensagens` com trigger `cleanup_ia_old` (15 dias). Falta a **UI de gestão**:

- Página `/ia/historico` (já existe) — adicionar:
  - Busca full-text no conteúdo das mensagens (`ilike` em `ia_mensagens.content`).
  - Botão "Continuar conversa" → abre `CopilotoChat` com `conversa_id` pré-carregada e mensagens hidratadas.
  - Botão "Excluir" com `ConfirmDelete` → `DELETE FROM ia_conversas WHERE id = ?` (cascade nas mensagens).
- `CopilotoChat`: aceitar prop `conversaId` opcional para retomar; ao montar, carregar mensagens dessa conversa.

---

## Bloco 3 — RBAC completo (4 papéis)

**Migração SQL:**
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'suporte';
-- 'admin' e 'user' já existem
```

- Promover `agf3digital@gmail.com` (já existe no trigger `handle_new_user` como `admin`) para `super_admin`. Ajustar trigger + rodar `UPDATE`/`INSERT` para o usuário existente.
- Hook `useRole()` retornando `{ role, isSuperAdmin, isAdmin, isSuporte }` (usa `user_roles` + `has_role`).
- `AdminRoute` wrapper: bloqueia < `admin`. Rotas de gestão crítica exigem `super_admin`.

**Usuário Super Admin:** já existe na base (ele fez signup). Não vou criar via SQL bruta — apenas garantir role via `INSERT ... ON CONFLICT DO NOTHING`. Senha nunca é tocada.

---

## Bloco 4 — Painel Super Admin expandido

Refatorar `/admin` para layout com submenus (tabs ou sub-rotas):

**Rotas:**
- `/admin` → Dashboard Executivo
- `/admin/usuarios` — busca, editar, bloquear/desbloquear (novo campo `profiles.blocked boolean`), liberar/remover Premium, mudar plano, ver movimentações (gastos/contas do usuário read-only).
- `/admin/assinaturas` — tabela de `subscriptions` com filtros por status.
- `/admin/financeiro` — `payment_logs` agregados por mês, ticket médio, churn.
- `/admin/gateway` — status Mercado Pago (secrets configuradas? webhook último recebido?).
- `/admin/ia` — total consultas, top usuários, custo estimado (tokens × preço), últimas perguntas (últimas 50 de `ia_mensagens` role=user), limite por plano em `subscriptions` (novo campo `ia_daily_limit`).
- `/admin/relatorios` — export CSV usuários/receita.
- `/admin/cupons` — nova tabela `coupons(codigo, desconto_pct, validade, uso_max, usado)`.
- `/admin/logs` — nova tabela `admin_logs(admin_id, action, target_user_id, payload jsonb, created_at)`.
- `/admin/config` — configurações globais (nova tabela `app_settings key/value jsonb`).

**Dashboard Executivo — novas métricas** (estende `admin-metrics`):
- Usuários ativos (com gasto nos últimos 30d).
- Receita prevista (soma `amount` de `subscriptions` ativas × ciclos restantes ano).
- Churn = canceladas último mês / ativas início do mês.
- Ticket médio = receita total / assinantes pagos.
- Conversão Premium = premium_active / total_users.
- Gráficos (Recharts): crescimento usuários por mês, MRR por mês, novas assinaturas por mês.

**Novas edge functions:**
- `admin-user-block` (super_admin)
- `admin-user-update-plan` (super_admin)
- `admin-user-movements` (super_admin/suporte, read-only)
- `admin-ia-stats`
- `admin-coupons-crud`
- Todas gravam em `admin_logs`.

**Segurança:** todas verificam `has_role(user, 'super_admin')` ou `'admin'` conforme sensibilidade. `admin_logs` insere via SECURITY DEFINER function.

---

## O que NÃO muda
- Client Supabase, types auto-gerados, config.toml (só adicionar functions se necessário).
- Gateway Mercado Pago já implementado.
- Funcionalidades existentes do usuário (dashboard, histórico, contas, cartões, metas, categorias, chat atual).

---

## Ordem de execução sugerida
1. Migração: novos roles, `profiles.blocked`, `coupons`, `admin_logs`, `app_settings`, `subscriptions.ia_daily_limit` + promover email para super_admin.
2. Backend: tools analíticas do Copiloto + novas edge functions admin.
3. Frontend: hook `useRole`, layout `/admin/*`, páginas.
4. UI histórico IA (busca + continuar + excluir).
5. Verificação: `tsgo`, build, smoke Playwright nas rotas admin.

Custo estimado: ~15-20 arquivos novos, ~10 editados, 1 migração grande.

**Confirma execução completa, ou prefere que eu comece pelo Bloco 1+2 (Copiloto inteligente + memória) e depois o Admin?**