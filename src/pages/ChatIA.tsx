import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, History } from "lucide-react";
import { Link } from "react-router-dom";
import { CopilotoChat } from "@/components/CopilotoChat";
import { PremiumGate } from "@/components/PremiumGate";

const ChatIA = () => {
  const [params] = useSearchParams();
  const conversaId = params.get("c");

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-6rem)]">
      <header className="mb-3 md:mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1 flex items-center gap-2"><Sparkles className="size-3" /> Inteligência</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Copiloto</h1>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/ia/historico"><History className="size-4" /> Histórico</Link></Button>
      </header>

      <PremiumGate
        feature="Copiloto"
        description="Converse com IA por texto ou voz. Ela interpreta seus gastos, consulta seus dados e responde com informações reais."
      >
        <Card className="flex-1 gradient-card border-border overflow-hidden min-h-0">
          <CopilotoChat key={conversaId ?? "new"} conversaId={conversaId} />
        </Card>
      </PremiumGate>
    </div>
  );
};

export default ChatIA;
