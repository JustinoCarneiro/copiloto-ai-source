import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBRL, monthRange, daysUntil } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Sparkles, PiggyBank, AlertCircle, CalendarClock, Trophy, Crown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { usePremium } from "@/hooks/usePremium";
import { PremiumLockBadge } from "@/components/PremiumGate";
import { InstallButton } from "@/components/InstallButton";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { user } = useAuth();
  const { start, end } = monthRange();
  const { isPro, trialActive, trialDaysLeft } = usePremium();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.id, start],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const [gastos, contas, metas, vencimentos] = await Promise.all([
        supabase.from("gastos").select("valor, tipo, categoria_id, categoria:categorias(nome,cor)").gte("data", start).lte("data", end),
        supabase.from("contas").select("*").eq("pago", false).order("data_vencimento", { ascending: true, nullsFirst: false }).limit(5),
        supabase.from("metas").select("*").order("created_at", { ascending: false }).limit(4),
        supabase.from("contas").select("*").eq("pago", false).gte("data_vencimento", today).lte("data_vencimento", in60).order("data_vencimento", { ascending: true }).limit(5),
      ]);
      const gs = gastos.data ?? [];
      const totalSaida = gs.filter(g => g.tipo === "saida").reduce((s, g) => s + Number(g.valor), 0);
      const totalEntrada = gs.filter(g => g.tipo === "entrada").reduce((s, g) => s + Number(g.valor), 0);
      const totalAPagar = (contas.data ?? []).reduce((s, c) => s + Number(c.valor), 0);

      // Ranking categorias (saídas)
      const porCat = gs.filter(g => g.tipo === "saida").reduce((acc: any, g: any) => {
        const key = g.categoria_id || "sem";
        const nome = g.categoria?.nome || "Sem categoria";
        const cor = g.categoria?.cor || "#888";
        acc[key] = acc[key] || { id: key, nome, cor, total: 0 };
        acc[key].total += Number(g.valor);
        return acc;
      }, {});
      const ranking = Object.values(porCat).sort((a: any, b: any) => b.total - a.total).slice(0, 5) as any[];

      return {
        saldo: totalEntrada - totalSaida,
        totalSaida,
        totalEntrada,
        totalAPagar,
        contas: contas.data ?? [],
        metas: metas.data ?? [],
        vencimentos: vencimentos.data ?? [],
        ranking,
      };
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1">Painel</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Bem-vindo de volta</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <InstallButton variant="outline" />
          {trialActive && (
            <Link to="/planos">
              <Button variant="outline" size="default">
                <Crown className="size-4 text-primary" /> Trial · {trialDaysLeft}d
              </Button>
            </Link>
          )}
          <Link to="/ia">
            <Button variant="hero" size="lg">
              <Sparkles className="size-4" /> Conversar com IA
            </Button>
          </Link>
        </div>
      </header>

      {/* Saldo principal */}
      <Card className="relative overflow-hidden gradient-card border-primary/30 p-7 shadow-elevated">
        <div className="absolute inset-0 gradient-glow pointer-events-none" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Saldo do mês</p>
          <p className={`font-display text-4xl md:text-5xl font-bold ${data && data.saldo < 0 ? "text-destructive" : "text-glow"}`}>
            {isLoading ? "—" : formatBRL(data?.saldo ?? 0)}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 max-w-sm">
            <div className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-md bg-success/15"><ArrowUpRight className="size-4 text-success" /></div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Entradas</p>
                <p className="font-semibold">{formatBRL(data?.totalEntrada ?? 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-md bg-destructive/15"><ArrowDownRight className="size-4 text-destructive" /></div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Gastos</p>
                <p className="font-semibold">{formatBRL(data?.totalSaida ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Próximos vencimentos */}
      <Card className="gradient-card border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" />
            <h2 className="font-display font-bold">Próximos vencimentos</h2>
          </div>
          <Link to="/contas"><Button variant="ghost" size="sm">Ver todas</Button></Link>
        </div>
        {!data?.vencimentos.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta vencendo nos próximos 60 dias ✨</p>
        ) : (
          <ul className="space-y-2">
            {data.vencimentos.map((c: any) => {
              const dias = daysUntil(c.data_vencimento);
              const status = dias <= 3 ? "danger" : dias <= 7 ? "warning" : "ok";
              const colorClass = status === "danger"
                ? "border-destructive/40 bg-destructive/5"
                : status === "warning"
                ? "border-warning/40 bg-warning/5"
                : "border-border bg-background/30";
              const textClass = status === "danger" ? "text-destructive" : status === "warning" ? "text-warning" : "text-muted-foreground";
              return (
                <li key={c.id} className={cn("flex items-center justify-between p-3 rounded-lg border transition-colors", colorClass)}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.descricao}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.destino || c.tipo}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-display font-semibold text-primary tabular-nums">{formatBRL(c.valor)}</p>
                    <p className={cn("text-[10px] uppercase tracking-wider font-bold", textClass)}>
                      {dias === 0 ? "Vence hoje" : dias === 1 ? "Amanhã" : `em ${dias} dias`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Top gastos do mês */}
      <Card className="gradient-card border-border p-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-primary" />
            <h2 className="font-display font-bold">Top gastos do mês</h2>
          </div>
          {!isPro && <PremiumLockBadge />}
        </div>
        {!isPro ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">Veja seus maiores gastos do mês.</p>
            <Link to="/planos"><Button variant="hero" size="sm"><Sparkles className="size-4" /> Desbloquear</Button></Link>
          </div>
        ) : !data?.ranking.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sem gastos ainda este mês.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,220px)_1fr] items-center">
            <div className="h-52 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.ranking}
                    dataKey="total"
                    nameKey="nome"
                    innerRadius="60%"
                    outerRadius="90%"
                    paddingAngle={2}
                    stroke="none"
                    onClick={(_, i) => {
                      const item = data.ranking[i];
                      if (item?.id && item.id !== "sem") navigate(`/historico?cat=${item.id}`);
                    }}
                    className="cursor-pointer"
                  >
                    {data.ranking.map((c: any, i: number) => (
                      <Cell key={i} fill={c.cor} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => formatBRL(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total saídas</p>
                <p className="font-display font-bold text-primary text-lg tabular-nums">{formatBRL(data.totalSaida)}</p>
              </div>
            </div>
            <ol className="space-y-2.5">
              {data.ranking.map((c: any, i: number) => {
                const pct = data.totalSaida > 0 ? (c.total / data.totalSaida) * 100 : 0;
                return (
                  <li
                    key={i}
                    onClick={() => c.id !== "sem" && navigate(`/historico?cat=${c.id}`)}
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/20 rounded-lg p-1.5 -mx-1.5 transition-colors"
                  >
                    <span className="size-3 rounded-full shrink-0" style={{ background: c.cor }} />
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{c.nome}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">{pct.toFixed(0)}%</span>
                    <span className="font-display text-sm font-semibold text-primary tabular-nums shrink-0 min-w-[70px] text-right">{formatBRL(c.total)}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Card>

      {/* Cofrinhos */}
      <Card className="gradient-card border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PiggyBank className="size-4 text-primary" />
            <h2 className="font-display font-bold">Cofrinhos</h2>
          </div>
          {!isPro && <PremiumLockBadge />}
        </div>
        {!isPro ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">Cofrinhos disponíveis no Premium.</p>
            <Link to="/planos"><Button variant="hero" size="sm"><Sparkles className="size-4" /> Desbloquear</Button></Link>
          </div>
        ) : data?.metas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">Crie sua primeira meta</p>
            <Link to="/metas"><Button variant="neon" size="sm">Criar cofrinho</Button></Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {data?.metas.map((m: any) => {
              const pct = Math.min(100, (Number(m.valor_atual) / Number(m.valor_objetivo)) * 100);
              return (
                <li key={m.id} className="space-y-1.5">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="font-medium truncate">{m.nome}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">{formatBRL(m.valor_atual)} / {formatBRL(m.valor_objetivo)}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </li>
              );
            })}
          </ul>
        )}
      </Card>


      {data && data.saldo < 0 && (
        <Card className="border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Saldo negativo este mês</p>
            <p className="text-muted-foreground">Pergunte ao Copiloto IA como reorganizar seus gastos.</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
