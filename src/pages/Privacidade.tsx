import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { LegalDraftNotice } from "@/components/LegalDraftNotice";

const Privacidade = () => (
  <div className="min-h-screen px-4 py-10 bg-gradient-dark">
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-8 flex flex-col items-center gap-2">
        <Logo size="lg" />
      </div>

      <Card className="gradient-card border-border/60 shadow-elevated p-7 space-y-6 text-sm leading-relaxed">
        <h1 className="font-display text-2xl font-bold">Política de Privacidade</h1>
        <LegalDraftNotice />

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">1. Controlador dos dados</h2>
          <p>
            Os dados pessoais tratados pelo Copiloto AI são de responsabilidade de
            <strong> [RAZÃO SOCIAL / CNPJ — completar] </strong>, controladora nos termos da Lei
            Geral de Proteção de Dados (Lei 13.709/2018 — LGPD). Encarregado (DPO):
            <strong> [nome/e-mail — completar] </strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">2. Dados que coletamos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Cadastro:</strong> nome, e-mail, senha (armazenada com hash) ou identidade do provedor Google.</li>
            <li><strong>Dados financeiros:</strong> lançamentos, contas, cartões e metas que você registra — o núcleo do serviço.</li>
            <li><strong>Conversas com a IA:</strong> mensagens trocadas com o assistente, guardadas por até 15 dias e apagadas automaticamente depois disso.</li>
            <li><strong>Dados de pagamento:</strong> processados diretamente pelo Mercado Pago; não armazenamos número de cartão nem dados sensíveis de pagamento nos nossos servidores.</li>
            <li><strong>Dados técnicos:</strong> logs de erro e uso da aplicação, para diagnóstico e segurança.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">3. Para que usamos seus dados</h2>
          <p>
            Para prestar o serviço (registrar e analisar suas finanças), processar sua assinatura,
            responder suporte, e cumprir obrigações legais. Base legal: execução de contrato (Art.
            7º, V, LGPD) e, quando aplicável, consentimento (Art. 7º, I).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">4. Com quem compartilhamos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Mercado Pago:</strong> processamento de pagamentos.</li>
            <li><strong>Provedor de IA (gateway de modelos de linguagem):</strong> o conteúdo das suas mensagens ao assistente é enviado para gerar a resposta.</li>
            <li><strong>Supabase:</strong> infraestrutura de banco de dados e autenticação (hospedagem).</li>
          </ul>
          <p>Não vendemos dados pessoais a terceiros.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">5. Seus direitos (Art. 18 LGPD)</h2>
          <p>
            Você pode confirmar a existência de tratamento, acessar, corrigir, solicitar
            portabilidade ou eliminação dos seus dados, e revogar consentimento a qualquer momento.
            Acesso e exclusão estão disponíveis diretamente na página <strong>Perfil</strong> do
            aplicativo ("Exportar meus dados" e "Excluir minha conta"). Para outras solicitações,
            contate <strong>[e-mail de contato — completar]</strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">6. Retenção e exclusão</h2>
          <p>
            Dados financeiros são mantidos enquanto sua conta existir. Conversas com a IA são
            apagadas automaticamente após 15 dias. Ao excluir sua conta, removemos permanentemente
            seus dados financeiros, conversas e cadastro — exceto registros que a legislação
            fiscal/contábil exija manter por prazo determinado (ex.: comprovantes de pagamento).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">7. Segurança</h2>
          <p>
            Cada usuário só acessa os próprios dados — isolamento reforçado por controle de acesso
            no banco de dados (Row Level Security), conexões criptografadas (HTTPS) e senhas nunca
            armazenadas em texto puro.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">8. Alterações nesta política</h2>
          <p>
            Podemos atualizar esta política periodicamente. Mudanças relevantes serão comunicadas
            por e-mail ou aviso no aplicativo.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-2">
          Última atualização: 2026-08-13. Contato do encarregado: <strong>[completar]</strong>.
        </p>
      </Card>

      <div className="mt-6 text-center">
        <Link to="/auth" className="text-sm text-primary underline">Voltar</Link>
      </div>
    </div>
  </div>
);

export default Privacidade;
