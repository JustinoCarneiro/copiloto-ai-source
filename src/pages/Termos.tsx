import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { LegalDraftNotice } from "@/components/LegalDraftNotice";

const Termos = () => (
  <div className="min-h-screen px-4 py-10 bg-gradient-dark">
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-8 flex flex-col items-center gap-2">
        <Logo size="lg" />
      </div>

      <Card className="gradient-card border-border/60 shadow-elevated p-7 space-y-6 text-sm leading-relaxed">
        <h1 className="font-display text-2xl font-bold">Termos de Uso</h1>
        <LegalDraftNotice />

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">1. Sobre o serviço</h2>
          <p>
            O Copiloto AI ("nós", "o serviço") é um aplicativo de gestão financeira pessoal com um
            assistente de inteligência artificial que registra lançamentos e responde perguntas
            sobre o dinheiro do usuário. O serviço é operado por
            <strong> [RAZÃO SOCIAL / CNPJ — completar] </strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">2. Cadastro e conta</h2>
          <p>
            Para usar o Copiloto AI você precisa criar uma conta com e-mail e senha (ou login via
            Google). Você é responsável por manter suas credenciais em sigilo e por toda atividade
            realizada na sua conta.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">3. Assinatura, trial e cobrança</h2>
          <p>
            Toda conta nova começa com um período de teste gratuito de 7 dias. Após o teste, o uso
            continuado do plano mensal ou anual depende de assinatura paga, processada via Mercado
            Pago (Pix, cartão ou boleto). Você pode cancelar a qualquer momento pela página
            Assinatura; o cancelamento interrompe cobranças futuras, mas não gera reembolso
            automático de período já pago, exceto no caso do direito de arrependimento abaixo.
          </p>
          <p>
            <strong>Direito de arrependimento (Art. 49 do CDC):</strong> como o trial gratuito de 7
            dias já antecede toda cobrança, o cancelamento dentro dos primeiros 7 dias da primeira
            cobrança dá direito a reembolso integral, sem necessidade de justificativa.
            <em> [confirmar com jurídico se este texto reflete a política de reembolso real da
            empresa antes de publicar.]</em>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">4. Uso do assistente de IA</h2>
          <p>
            O Copiloto usa modelos de linguagem para responder perguntas e sugerir lançamentos.
            Toda métrica financeira apresentada pelo assistente vem de uma consulta real aos seus
            dados — o assistente não gera números "estimados". Lançamentos sugeridos pela IA nunca
            são gravados automaticamente: você sempre confirma antes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">5. Uso aceitável</h2>
          <p>
            Você concorda em não usar o serviço para fins ilegais, não tentar acessar dados de
            outros usuários, e não realizar engenharia reversa ou ataques à infraestrutura do
            serviço.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">6. Encerramento de conta</h2>
          <p>
            Você pode excluir sua conta a qualquer momento pela página Perfil. A exclusão remove
            permanentemente seus dados financeiros, conversas e cadastro, conforme detalhado na
            nossa <Link to="/privacidade" className="text-primary underline">Política de
            Privacidade</Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg">7. Alterações nestes termos</h2>
          <p>
            Podemos atualizar estes termos para refletir mudanças no serviço ou na legislação.
            Mudanças relevantes serão comunicadas por e-mail ou aviso no aplicativo.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-2">
          Última atualização: 2026-08-13. Dúvidas: <strong>[e-mail de contato — completar]</strong>.
        </p>
      </Card>

      <div className="mt-6 text-center">
        <Link to="/auth" className="text-sm text-primary underline">Voltar</Link>
      </div>
    </div>
  </div>
);

export default Termos;
