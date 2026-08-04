import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/hooks/usePremium";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ExternalLink, XCircle, RefreshCw, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { formatBRL } from "@/lib/format";

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "Ativa", className: "bg-success/20 text-success border-success/40" },
  trialing: { label: "Trial", className: "bg-primary/20 text-primary border-primary/40" },
  pending: { label: "Aguardando pagamento", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/40" },
  overdue: { label: "Em atraso", className: "bg-destructive/20 text-destructive border-destructive/40" },
  canceled: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
  free: { label: "Gratuito", className: "bg-muted text-muted-foreground border-border" },
};

const Assinatura = () => {
  const { user } = useAuth();
  const p = usePremium();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ["payment_logs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("payment_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!user,
  });

  const cancelar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("payments-cancel");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success("Assinatura cancelada");
      p.refetch();
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["payment_logs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cancelar"),
  });

  const badge = statusLabels[p.status] ?? statusLabels.free;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-primary flex items-center gap-2">
          <Crown className="size-3" /> Minha Assinatura
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Gerencie seu plano</h1>
      </header>

      <Card className="gradient-card p-6 space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Plano atual</p>
            <p className="font-display text-2xl font-bold mt-1">
              {p.plano === "premium" ? "Premium" : p.trialActive ? "Trial Premium" : "Gratuito"}
              {p.billingCycle && <span className="text-muted-foreground text-base font-normal ml-2">· {p.billingCycle}</span>}
            </p>
          </div>
          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/60">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Valor</p>
            <p className="font-semibold mt-1">{p.amount ? formatBRL(p.amount) : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Próxima cobrança</p>
            <p className="font-semibold mt-1">{p.nextDueDate ? p.nextDueDate.toLocaleDateString("pt-BR") : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Forma de pagamento</p>
            <p className="font-semibold mt-1 capitalize">{p.paymentMethod?.toLowerCase() ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Trial</p>
            <p className="font-semibold mt-1">{p.trialActive ? `${p.trialDaysLeft} dias` : "—"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t border-border/60">
          {p.lastInvoiceUrl && (
            <a href={p.lastInvoiceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="size-3.5" /> Atualizar pagamento</Button>
            </a>
          )}
          <Link to="/planos"><Button variant="outline" size="sm"><RefreshCw className="size-3.5" /> {p.plano === "premium" ? "Trocar plano" : "Assinar Premium"}</Button></Link>
          {p.subscriptionId && p.status !== "canceled" && (
            <>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmOpen(true)}>
                <XCircle className="size-3.5" /> Cancelar
              </Button>
              <ConfirmDelete
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Cancelar assinatura?"
                description="Você perderá acesso às funções Premium ao final do período pago."
                onConfirm={() => cancelar.mutate()}
              />
            </>
          )}
        </div>
      </Card>

      <Card className="gradient-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="size-4 text-primary" />
          <h2 className="font-display font-bold">Histórico de pagamentos</h2>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-background/40">
                <div>
                  <p className="text-sm font-medium">{l.event}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <div className="text-right">
                  {l.amount && <p className="text-sm font-semibold">{formatBRL(Number(l.amount))}</p>}
                  {l.status && <p className="text-[11px] text-muted-foreground capitalize">{l.status}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Assinatura;
