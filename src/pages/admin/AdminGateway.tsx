import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, AlertCircle } from "lucide-react";

export default function AdminGateway() {
  const q = useQuery({
    queryKey: ["admin-gateway-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_logs").select("*").eq("gateway", "mercadopago").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });
  const logs = q.data ?? [];
  const ultimoWebhook = logs[0];

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-primary" />
          <h3 className="font-semibold">Mercado Pago</h3>
          <Badge variant="outline" className="border-primary/40 text-primary ml-auto">Ativo</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <StatusItem ok label="Access Token configurado" />
          <StatusItem ok label="Webhook Token configurado" />
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t border-border/40">
          Último webhook recebido: {ultimoWebhook ? new Date(ultimoWebhook.created_at).toLocaleString("pt-BR") : "nenhum ainda"}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Webhooks recentes</h3>
        <div className="space-y-1">
          {logs.map((l: any) => (
            <div key={l.id} className="text-xs border-b border-border/40 py-1.5 flex justify-between">
              <span>{new Date(l.created_at).toLocaleString("pt-BR")} · {l.event}</span>
              <span className="text-muted-foreground">{l.status}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum webhook recebido ainda.</p>}
        </div>
      </Card>
    </div>
  );
}

const StatusItem = ({ ok, label }: { ok: boolean; label: string }) => (
  <div className="flex items-center gap-2">
    {ok ? <CheckCircle2 className="size-4 text-success" /> : <AlertCircle className="size-4 text-destructive" />}
    <span>{label}</span>
  </div>
);
