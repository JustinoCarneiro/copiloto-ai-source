# Spec — Copiloto AI

> Reconstruído retroativamente a partir do código em 2026-08-04 (ver nota de proveniência no
> [`CLAUDE.md`](../CLAUDE.md)). Histórias marcadas com ⚠️ têm comportamento inferido do código sem
> confirmação explícita do dono do produto — revisar antes de tratar como spec definitiva.

## E1 — Autenticação & Perfil

**História.** Como usuário, quero criar minha conta e gerenciar meu perfil, para acessar minhas
finanças com segurança e sem ver dados de outra pessoa.

- Dado um cadastro novo, quando o usuário confirma o e-mail e entra pela primeira vez, então o
  sistema cria automaticamente um perfil e 7 categorias padrão (Alimentação, Transporte, Lazer,
  Mercado, Casa, Saúde, Salário).
- Dado um usuário autenticado, quando ele tenta ler ou escrever dados de `gastos`/`contas`/
  `cartoes`/`metas`, então só linhas com `user_id` igual ao seu `auth.uid()` são acessíveis (RLS).
- Dado um usuário autenticado, quando ele atualiza nome ou senha em `/perfil`, então a alteração é
  persistida e refletida na sessão sem exigir novo login.

## E2 — Lançamentos & Histórico

**História.** Como usuário, quero registrar e revisar meus gastos e entradas, para saber para onde
meu dinheiro está indo.

- Dado um lançamento novo, quando o usuário informa descrição, valor, tipo (entrada/saída) e forma
  de pagamento, então o registro aparece no histórico e nos totais do dashboard.
- Dado um gasto parcelado, quando o número de parcelas é maior que 1, então `valor_parcela` é
  calculado automaticamente (`valor / parcelas`).
- Dado um gasto existente, quando ele é editado (descrição, destino, valor, tipo, forma de
  pagamento ou categoria), então a mudança é registrada em `gastos_historico` com o diff antes/depois
  (auditoria, não é exibida como feature de UI hoje — ⚠️).
- Dado o histórico, quando o usuário filtra por tipo, categoria ou busca por texto, então só os
  lançamentos correspondentes aparecem.

## E3 — Contas a pagar

**História.** Como usuário, quero controlar minhas contas fixas, avulsas e parceladas, para não
perder vencimentos e saber quanto já paguei de cada uma.

- Dado uma conta pendente, quando o usuário registra um pagamento parcial menor que o valor total,
  então `valor_pago` aumenta e o status permanece `pendente`.
- Dado uma conta pendente, quando a soma dos pagamentos atinge ou ultrapassa o valor total, então o
  status muda automaticamente para `pago` (trigger `atualiza_conta_pagamento`).
- Dado uma conta do tipo `parcelada`, quando ela é criada com N parcelas, então N registros em
  `parcelas` são gerados com datas de vencimento sequenciais.

## E4 — Cartões

**História.** Como usuário, quero cadastrar meus cartões e ver o quanto usei de cada um, para
decidir qual usar sem estourar o limite.

- Dado um cartão de crédito com limite definido, quando gastos são lançados nele no mês, então o
  percentual de utilização (`gasto / limite`) fica visível.
- Dado dois ou mais cartões de crédito cadastrados com dia de fechamento, quando o usuário pergunta
  "qual o melhor cartão para comprar hoje", então o sistema (via IA ou tela) aponta o cartão com
  mais dias até o próximo fechamento.

## E5 — Metas / Cofrinhos

**História.** Como usuário, quero criar metas de economia e guardar dinheiro nelas, para acompanhar
meu progresso até um objetivo.

- Dado uma meta com valor objetivo definido, quando o usuário faz um aporte, então `valor_atual`
  sobe e o progresso percentual é recalculado.
- Dado uma meta, quando o usuário resgata (`withdraw`) um valor, então `valor_atual` não pode ficar
  negativo.
- Dado um usuário do plano `free`, quando ele tenta usar Metas/Cofrinhos, então o recurso é
  bloqueado por `PremiumGate` (feature premium).

## E6 — Dashboard & Relatórios

**História.** Como usuário, quero ver um resumo do meu mês e gerar relatórios, para entender minha
saúde financeira rapidamente.

- Dado o mês corrente, quando o dashboard carrega, então mostra saldo (entradas − saídas), contas a
  vencer nos próximos 60 dias e ranking das 5 categorias com maior gasto.
- Dado um mês selecionado em `/relatorios`, quando o usuário pede exportação, então um PDF é gerado
  no navegador (jsPDF) com o detalhamento do período.
- Dado um usuário do plano `free`, quando ele acessa recursos avançados de relatório (comparação
  entre meses, insights), então vê um `PremiumLockBadge` em vez do conteúdo completo (⚠️ — regra
  exata varia por seção da tela, revisar caso a caso).

## E7 — Copiloto IA (maior risco de complexidade)

**História.** Como usuário, quero conversar com um assistente financeiro em texto ou voz, para
registrar gastos rapidamente e tirar dúvidas sobre meus números sem navegar por telas.

- Dado que o usuário descreve um gasto em linguagem natural ("gastei 45 no iFood no crédito"),
  quando a IA chama a tool `registrar_lancamento`, então o app mostra a sugestão para **confirmação
  explícita do usuário** antes de gravar — a IA nunca grava direto.
- Dado que o usuário faz uma pergunta analítica ("quanto gastei com alimentação esse mês"), quando
  a IA não tem dados suficientes retornados pelas tools, então ela responde dizendo isso
  explicitamente, nunca estima ou inventa um valor (regra do system prompt).
- Dado um áudio enviado, quando tem entre 1KB e 20MB e é um formato suportado, então é transcrito e
  tratado como mensagem de texto; fora desses limites, o usuário recebe erro claro (400/413).
- Dado o histórico de conversas do usuário, quando uma conversa fica sem atividade por mais de 15
  dias, então ela é apagada automaticamente (`cleanup_ia_old`, disparado na próxima mensagem nova).

## E8 — Assinatura & Billing (alto risco)

**História.** Como usuário, quero testar o Copiloto de graça e depois assinar o plano Premium, para
continuar usando os recursos avançados sem fricção no pagamento.

- Dado um cadastro novo, quando a conta é criada, então `subscriptions` nasce com trial de 7 dias
  (`trial_ends_at = now() + 7 dias`) e acesso Premium liberado durante o trial.
- Dado um usuário no trial ou free, quando ele escolhe um ciclo (mensal R$19,90 ou anual R$199,90)
  e confirma, então `payments-subscribe` cria o cliente/assinatura no Mercado Pago e devolve uma
  `checkoutUrl` — o plano só vira `premium` **após** confirmação via webhook, nunca no clique.
- Dado um evento recebido em `mercadopago-webhook`, quando o token da querystring não bate com
  `MP_WEBHOOK_TOKEN`, então a requisição é rejeitada com 401 — o webhook é público mas autenticado
  por token, não por sessão de usuário.
- Dado uma assinatura ativa, quando o usuário cancela em `/assinatura`, então a assinatura é
  cancelada no gateway, `status` vira `canceled` com `canceled_at`, e um `payment_logs` de
  auditoria é criado.
- Dado qualquer evento de pagamento (criação, cancelamento, confirmação), então ele gera uma linha
  em `payment_logs` — nunca só atualiza `subscriptions` silenciosamente.

## E9 — Admin/Backoffice

**História.** Como administrador, quero gerenciar usuários, assinaturas e configurações do sistema,
para dar suporte e manter a operação sob controle sem acesso direto ao banco.

- Dado um usuário sem `role = admin`, quando ele tenta acessar `/admin/*`, então vê a tela "Acesso
  restrito" em vez do painel.
- Dado um admin autenticado, quando ele bloqueia (`blocked = true`) ou concede Premium manual a um
  usuário via `admin-user-actions`, então a ação é registrada em `admin_logs` com o `admin_id` e o
  payload da mudança.
- Dado um cupom criado pelo admin, quando `ativo = true` e dentro da validade e do limite de usos,
  então ele fica visível/aplicável; fora disso, só o próprio admin continua vendo (RLS `ativo = true
  OR has_role(admin)`).

## E10 — PWA/Onboarding

**História.** Como usuário, quero instalar o Copiloto como app no meu celular, para acessar mais
rápido sem abrir o navegador.

- Dado que o navegador suporta instalação PWA e o app ainda não foi instalado, quando o evento
  `beforeinstallprompt` dispara, então o `InstallButton` fica visível oferecendo a instalação.
