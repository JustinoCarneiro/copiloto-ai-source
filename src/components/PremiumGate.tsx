import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { usePremium } from "@/hooks/usePremium";

interface PremiumGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
  /** Se true, renderiza um overlay desfocado por cima do conteúdo. */
  blurMode?: boolean;
}

export const PremiumGate = ({ feature, description, children, blurMode = false }: PremiumGateProps) => {
  const { isPro, isLoading } = usePremium();

  if (isLoading) return <>{children}</>;
  if (isPro) return <>{children}</>;

  if (blurMode) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none blur-sm opacity-40">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <PaywallCard feature={feature} description={description} />
        </div>
      </div>
    );
  }

  return <PaywallCard feature={feature} description={description} />;
};

const PaywallCard = ({ feature, description }: { feature: string; description?: string }) => (
  <Card className="gradient-card border-primary/40 p-8 text-center max-w-md mx-auto shadow-elevated">
    <div className="size-14 rounded-2xl gradient-primary mx-auto flex items-center justify-center mb-4 animate-pulse-glow">
      <Lock className="size-6 text-primary-foreground" />
    </div>
    <p className="text-xs uppercase tracking-[0.3em] text-primary mb-2">Premium</p>
    <h3 className="font-display text-xl font-bold mb-2">{feature}</h3>
    <p className="text-sm text-muted-foreground mb-5">
      {description ?? "Disponível no plano premium. Faça upgrade para desbloquear."}
    </p>
    <Link to="/planos">
      <Button variant="hero" size="lg" className="w-full">
        <Sparkles className="size-4" /> Ver planos
      </Button>
    </Link>
  </Card>
);

/** Versão menor inline, para listas/cards. */
export const PremiumLockBadge = ({ label = "Premium" }: { label?: string }) => (
  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
    <Lock className="size-3" /> {label}
  </span>
);
