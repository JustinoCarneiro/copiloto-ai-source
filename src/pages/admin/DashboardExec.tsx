import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, Crown, TrendingUp, DollarSign, AlertCircle, Check, X, Activity, Percent } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";

export default function DashboardExec() {
  const metrics = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-metrics");
      if (error) throw error;
      return data as any;
    },
  });
  const m = metrics.data ?? {};
  const series = m.series ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric icon={Users} label="Usuários" value={m.totalUsers ?? 0} />
        <Metric icon={Activity} label="Ativos 30d" value={m.usuariosAtivos ?? 0} />
        <Metric icon={Crown} label="Premium" value={m.premiumUsers ?? 0} accent />
        <Metric icon={Percent} label="Conversão" value={`${(m.conversaoPct ?? 0).toFixed(1)}%`} />
        <Metric icon={TrendingUp} label="MRR" value={formatBRL(m.mrr ?? 0)} />
        <Metric icon={TrendingUp} label="ARR" value={formatBRL(m.arr ?? 0)} />
        <Metric icon={DollarSign} label="Receita total" value={formatBRL(m.receitaTotal ?? 0)} />
        <Metric icon={DollarSign} label="Receita prevista" value={formatBRL(m.receitaPrevista ?? 0)} />
        <Metric icon={DollarSign} label="Ticket médio" value={formatBRL(m.ticketMedio ?? 0)} />
        <Metric icon={Percent} label="Churn mensal" value={`${(m.churnPct ?? 0).toFixed(1)}%`} />
        <Metric icon={X} label="Canceladas" value={m.assinaturasCanceladas ?? 0} />
        <Metric icon={AlertCircle} label="Pendentes" value={m.pagamentosPendentes ?? 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Crescimento de usuários (6 meses)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="usuarios" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">MRR (6 meses)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Receita mensal</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Bar dataKey="receita" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Novas assinaturas</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="assinaturas" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

const Metric = ({ icon: Icon, label, value, accent }: any) => (
  <Card className={`p-4 ${accent ? "border-primary/40 bg-primary/5" : ""}`}>
    <div className="flex items-center gap-2 text-[11px] uppercase text-muted-foreground tracking-wider">
      <Icon className="size-3.5" /> {label}
    </div>
    <div className="font-display text-xl md:text-2xl font-bold mt-1">{value}</div>
  </Card>
);
