import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";

export default function AdminFinanceiro() {
  const q = useQuery({
    queryKey: ["admin-financeiro"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_logs").select("amount,status,event,created_at,gateway").order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });
  const logs = q.data ?? [];
  const byMonth: Record<string, number> = {};
  logs.forEach((l: any) => {
    if (l.status !== "active" || !l.amount) return;
    const k = new Date(l.created_at).toISOString().slice(0, 7);
    byMonth[k] = (byMonth[k] ?? 0) + Number(l.amount);
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Receita por mês</h3>
        <div className="space-y-1">
          {Object.entries(byMonth).sort().reverse().slice(0, 12).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm border-b border-border/40 py-1.5">
              <span>{k}</span><span className="font-semibold">{formatBRL(v)}</span>
            </div>
          ))}
          {Object.keys(byMonth).length === 0 && <p className="text-sm text-muted-foreground">Sem receita registrada.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Últimas transações</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-left text-[11px] uppercase text-muted-foreground border-b border-border/60"><th className="p-2">Data</th><th className="p-2">Gateway</th><th className="p-2">Evento</th><th className="p-2">Status</th><th className="p-2 text-right">Valor</th></tr></thead>
            <tbody>
              {logs.slice(0, 50).map((l: any) => (
                <tr key={l.id ?? `${l.created_at}-${l.event}`} className="border-b border-border/40">
                  <td className="p-2 text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-2">{l.gateway}</td>
                  <td className="p-2">{l.event}</td>
                  <td className="p-2 capitalize">{l.status}</td>
                  <td className="p-2 text-right">{l.amount ? formatBRL(Number(l.amount)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
