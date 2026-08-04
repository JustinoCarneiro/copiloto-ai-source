import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePremium } from "@/hooks/usePremium";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Crown, Sparkles, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Ciclo = "mensal" | "anual";

const PRICES = { mensal: 19.9, anual: 199.9 };

const features = {
  free: [
    "Cadastro de entradas e gastos",
    "Dashboard básico",
    "Categorias e cartões",
    "Histórico de transações",
  ],
  premium: [
    "IA por texto, voz e imagem (OCR)",
    "Relatórios em PDF + compartilhamento",
    "Cofrinhos e metas ilimitados",
    "Parcelamentos inteligentes",
    "Controle completo de cartões",
    "Ranking de gastos e insights",
    "Próximos vencimentos e alertas",
    "Suporte prioritário + novas features",
  ],
};

const Planos = () => {
  const { plano, trialActive, trialDaysLeft, isPro, billingCycle, status, refetch } = usePremium();
  const qc = useQueryClient();
  const [ciclo, setCiclo] = useState<Ciclo>("anual");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");

  const economia = ((PRICES.mensal * 12 - PRICES.anual) / (PRICES.mensal * 12)) * 100;

  const assinar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("payments-subscribe", {
        body: { cycle: ciclo, cpfCnpj: cpfCnpj || undefined, phone: phone || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { checkoutUrl: string | null; subscriptionId: string };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      refetch();
      setCheckoutOpen(false);
      if (d.checkoutUrl) {
        toast.success("Assinatura criada!", { description: "Você será redirecionado para o pagamento." });
        window.open(d.checkoutUrl, "_blank", "noopener");
      } else {
        toast.success("Assinatura criada! Acesse Minha Assinatura para pagar.");
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar assinatura"),
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-primary flex items-center justify-center gap-2">
          <Crown className="size-3" /> Planos & Assinatura
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          Acelere com o <span className="gradient-text">Copiloto AI</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Liberte sua IA financeira pessoal e tome decisões mais inteligentes em segundos.
        </p>
      </header>

      {isPro && (
        <Card className="gradient-card border-primary/40 p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg gradient-primary flex items-center justify-center">
              <Crown className="size-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-display font-bold text-primary">
                {plano === "premium" && status === "active"
                  ? `Premium ${billingCycle ?? ""}`
                  : trialActive
                  ? "Trial Premium ativo"
                  : "Assinatura pendente"}
              </p>
              <p className="text-xs text-muted-foreground">
                {trialActive
                  ? `${trialDaysLeft} dias gratuitos restantes.`
                  : "Aproveite todas as funcionalidades."}
              </p>
            </div>
          </div>
          <Link to="/assinatura"><Button variant="outline" size="sm">Gerenciar</Button></Link>
        </Card>
      )}

      <div className="flex justify-center">
        <div className="inline-flex bg-card border border-border rounded-full p-1">
          <button
            onClick={() => setCiclo("mensal")}
            className={cn("px-5 py-2 rounded-full text-sm font-medium transition-all", ciclo === "mensal" ? "gradient-primary text-primary-foreground" : "text-muted-foreground")}
          >Mensal</button>
          <button
            onClick={() => setCiclo("anual")}
            className={cn("px-5 py-2 rounded-full text-sm font-medium transition-all relative", ciclo === "anual" ? "gradient-primary text-primary-foreground" : "text-muted-foreground")}
          >
            Anual
            <span className="absolute -top-2 -right-2 text-[9px] bg-success text-white px-1.5 py-0.5 rounded-full font-bold">-{economia.toFixed(0)}%</span>
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="gradient-card border-border p-7 flex flex-col">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Gratuito</p>
            <h2 className="font-display text-2xl font-bold">Free</h2>
            <div className="mt-3">
              <span className="font-display text-4xl font-bold">R$ 0</span>
              <span className="text-muted-foreground text-sm">/sempre</span>
            </div>
          </div>
          <ul className="space-y-2.5 mb-6 flex-1">
            {features.free.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" disabled className="w-full">
            {plano === "free" && !isPro ? "Plano atual" : "Plano básico"}
          </Button>
        </Card>

        <Card className="relative gradient-card border-primary/40 p-7 flex flex-col shadow-elevated overflow-hidden">
          <div className="absolute inset-0 gradient-glow pointer-events-none" />
          <div className="absolute top-3 right-3">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full gradient-primary text-primary-foreground">
              Mais popular
            </span>
          </div>
          <div className="relative mb-5">
            <p className="text-xs uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
              <Sparkles className="size-3" /> Recomendado
            </p>
            <h2 className="font-display text-2xl font-bold">Premium</h2>
            <div className="mt-3">
              {ciclo === "mensal" ? (
                <>
                  <span className="font-display text-4xl font-bold gradient-text">R$ 19,90</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </>
              ) : (
                <>
                  <span className="font-display text-4xl font-bold gradient-text">R$ 199,90</span>
                  <span className="text-muted-foreground text-sm">/ano</span>
                  <p className="text-xs text-success mt-1">
                    Equivale a R$ {(PRICES.anual / 12).toFixed(2).replace(".", ",")}/mês — economize {economia.toFixed(0)}%
                  </p>
                </>
              )}
            </div>
          </div>
          <ul className="relative space-y-2.5 mb-6 flex-1">
            {features.premium.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <div className="size-4 rounded-full gradient-primary flex items-center justify-center mt-0.5 shrink-0">
                  <Check className="size-3 text-primary-foreground" />
                </div>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button
            variant="hero"
            size="lg"
            className="relative w-full"
            disabled={plano === "premium" && status === "active" && billingCycle === ciclo}
            onClick={() => setCheckoutOpen(true)}
          >
            <Zap className="size-4" />
            {plano === "premium" && status === "active" && billingCycle === ciclo
              ? "Plano ativo"
              : `Assinar ${ciclo === "mensal" ? "Mensal" : "Anual"}`}
          </Button>
          <p className="relative text-[10px] text-center text-muted-foreground mt-3">
            Pagamento via Pix, boleto ou cartão · Cancele quando quiser
          </p>
        </Card>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar assinatura Premium</DialogTitle>
            <DialogDescription>
              Plano {ciclo === "mensal" ? "Mensal (R$ 19,90/mês)" : "Anual (R$ 199,90/ano)"} — pagamento seguro via Mercado Pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cpf">CPF ou CNPJ (opcional)</Label>
              <Input id="cpf" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label htmlFor="phone">Celular (opcional)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <p className="text-xs text-muted-foreground">
              Você será redirecionado para o checkout do Mercado Pago para escolher a forma de pagamento (Pix, cartão ou boleto).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>Cancelar</Button>
            <Button variant="hero" onClick={() => assinar.mutate()} disabled={assinar.isPending}>
              {assinar.isPending ? <><Loader2 className="size-4 animate-spin" /> Criando...</> : "Ir para pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-center text-xs text-muted-foreground">
        Já assinante? <Link to="/assinatura" className="text-primary hover:underline">Ver minha assinatura</Link>
      </p>
    </div>
  );
};

export default Planos;
