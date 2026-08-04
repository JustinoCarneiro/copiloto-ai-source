import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, monthLabel, formatDateLong, parseBoldSegments } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Wallet, FileDown, Copy, Share2, TrendingUp, BarChart3, Sparkles, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { usePremium } from "@/hooks/usePremium";
import { PremiumLockBadge } from "@/components/PremiumGate";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const monthsBack = (n: number) => {
  const arr: { value: string; label: string; date: Date }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: monthLabel(d),
      date: d,
    });
  }
  return arr;
};

const Relatorios = () => {
  const { user } = useAuth();
  const { isPro } = usePremium();
  const months = useMemo(() => monthsBack(12), []);
  const [mes, setMes] = useState(months[0].value);
  const [catFilter, setCatFilter] = useState("all");

  const selected = months.find(m => m.value === mes)!;
  const start = new Date(selected.date.getFullYear(), selected.date.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(selected.date.getFullYear(), selected.date.getMonth() + 1, 0).toISOString().slice(0, 10);

  // Mês anterior para insights
  const prev = new Date(selected.date.getFullYear(), selected.date.getMonth() - 1, 1);
  const prevStart = new Date(prev.getFullYear(), prev.getMonth(), 1).toISOString().slice(0, 10);
  const prevEnd = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias").select("*")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio", user?.id, mes],
    queryFn: async () => {
      const [cur, prv] = await Promise.all([
        supabase.from("gastos").select("*, categoria:categorias(nome,cor)").gte("data", start).lte("data", end).order("data", { ascending: false }),
        supabase.from("gastos").select("valor,tipo").gte("data", prevStart).lte("data", prevEnd),
      ]);
      return { gastos: cur.data ?? [], anterior: prv.data ?? [] };
    },
    enabled: !!user,
  });

  const filtered = (data?.gastos ?? []).filter((g: any) => catFilter === "all" || g.categoria_id === catFilter);

  const totalEntrada = filtered.filter((g: any) => g.tipo === "entrada").reduce((s: number, g: any) => s + Number(g.valor), 0);
  const totalSaida = filtered.filter((g: any) => g.tipo === "saida").reduce((s: number, g: any) => s + Number(g.valor), 0);
  const saldo = totalEntrada - totalSaida;

  // Por categoria (saídas)
  const porCategoria = filtered
    .filter((g: any) => g.tipo === "saida")
    .reduce((acc: Record<string, { nome: string; cor: string; total: number }>, g: any) => {
      const key = g.categoria_id || "sem";
      const nome = g.categoria?.nome || "Sem categoria";
      const cor = g.categoria?.cor || "#888";
      acc[key] = acc[key] || { nome, cor, total: 0 };
      acc[key].total += Number(g.valor);
      return acc;
    }, {});
  const ranking = Object.values(porCategoria).sort((a, b) => b.total - a.total);

  // Insights
  const prevSaida = (data?.anterior ?? []).filter((g: any) => g.tipo === "saida").reduce((s: number, g: any) => s + Number(g.valor), 0);
  const variacao = prevSaida > 0 ? ((totalSaida - prevSaida) / prevSaida) * 100 : 0;
  const maior = ranking[0];

  const insights: string[] = [];
  if (maior) insights.push(`Sua maior categoria foi **${maior.nome}** com ${formatBRL(maior.total)}.`);
  if (prevSaida > 0) {
    if (variacao > 5) insights.push(`Você gastou **${variacao.toFixed(0)}% a mais** que no mês anterior.`);
    else if (variacao < -5) insights.push(`Você gastou **${Math.abs(variacao).toFixed(0)}% a menos** que no mês anterior. 🎉`);
    else insights.push(`Seu gasto está estável em relação ao mês anterior.`);
  }
  if (saldo < 0) insights.push(`Atenção: seu saldo do mês está **negativo** em ${formatBRL(Math.abs(saldo))}.`);
  else if (totalEntrada > 0) insights.push(`Você economizou **${((saldo / totalEntrada) * 100).toFixed(0)}%** das suas entradas.`);

  const buildResumo = () => {
    const lines = [
      `📊 Relatório Financeiro — ${selected.label}`,
      ``,
      `Entradas: ${formatBRL(totalEntrada)}`,
      `Saídas: ${formatBRL(totalSaida)}`,
      `Saldo: ${formatBRL(saldo)}`,
      ``,
      `Top categorias:`,
      ...ranking.slice(0, 5).map((c, i) => `${i + 1}. ${c.nome}: ${formatBRL(c.total)}`),
      ``,
      `— Gerado pelo Copiloto AI`,
    ];
    return lines.join("\n");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildResumo());
    toast.success("Resumo copiado!");
  };

  const handleShareWhats = () => {
    const txt = encodeURIComponent(buildResumo());
    window.open(`https://wa.me/?text=${txt}`, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Relatório financeiro — ${selected.label}`);
    const body = encodeURIComponent(buildResumo());
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handlePDF = () => {
    if (!isPro) {
      toast.error("Disponível no plano Premium");
      return;
    }
    const doc = new jsPDF();
    const orange: [number, number, number] = [255, 106, 0];

    // Cabeçalho
    doc.setFillColor(...orange);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("COPILOTO AI", 14, 13);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório Financeiro", 14, 21);

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.text(`Gerado em ${formatDateLong(new Date())}`, 196, 13, { align: "right" });
    doc.text(selected.label, 196, 21, { align: "right" });

    // Resumo
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Resumo do mês", 14, 42);

    autoTable(doc, {
      startY: 46,
      theme: "plain",
      styles: { fontSize: 11, cellPadding: 4 },
      body: [
        ["Entradas", formatBRL(totalEntrada)],
        ["Saídas", formatBRL(totalSaida)],
        ["Saldo", formatBRL(saldo)],
      ],
      columnStyles: {
        0: { fontStyle: "bold", textColor: [80, 80, 80] },
        1: { halign: "right", fontStyle: "bold", textColor: saldo < 0 ? [200, 30, 30] : [20, 120, 50] },
      },
    });

    // Categorias
    let y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Gastos por categoria", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Categoria", "Total", "% do total"]],
      body: ranking.map(c => [
        c.nome,
        formatBRL(c.total),
        totalSaida > 0 ? `${((c.total / totalSaida) * 100).toFixed(1)}%` : "0%",
      ]),
      headStyles: { fillColor: orange, textColor: 255 },
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });

    // Lançamentos
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Lançamentos", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Data", "Descrição", "Categoria", "Tipo", "Valor"]],
      body: filtered.map((g: any) => [
        new Date(g.data + "T00:00:00").toLocaleDateString("pt-BR"),
        g.descricao + (g.destino ? ` (${g.destino})` : ""),
        g.categoria?.nome || "—",
        g.tipo === "entrada" ? "Entrada" : "Saída",
        formatBRL(g.valor),
      ]),
      headStyles: { fillColor: orange, textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 4: { halign: "right" } },
    });

    // Rodapé
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Copiloto AI · Página ${i} de ${pages}`, 105, 290, { align: "center" });
    }

    doc.save(`copiloto-ai-${mes}.pdf`);
    toast.success("PDF gerado!");
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1 flex items-center gap-2"><BarChart3 className="size-3" /> Análises</p>
          <h1 className="font-display text-3xl font-bold">Relatórios</h1>
        </div>
      </header>

      {/* Filtros */}
      <Card className="gradient-card border-border p-4 grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Mês</label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Categoria</label>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col justify-end">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} title="Copiar resumo"><Copy className="size-4" /></Button>
            <Button variant="outline" size="sm" onClick={handleShareWhats} title="WhatsApp"><Share2 className="size-4" /></Button>
            <Button variant="outline" size="sm" onClick={handleShareEmail} title="Email"><Share2 className="size-4 rotate-45" /></Button>
          </div>
        </div>
      </Card>

      {/* Cards resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="gradient-card border-border p-5">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 rounded-md bg-success/15"><ArrowUpRight className="size-4 text-success" /></div><p className="text-xs uppercase text-muted-foreground tracking-wider">Entradas</p></div>
          <p className="font-display text-2xl font-bold text-success tabular-nums">{formatBRL(totalEntrada)}</p>
        </Card>
        <Card className="gradient-card border-border p-5">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 rounded-md bg-destructive/15"><ArrowDownRight className="size-4 text-destructive" /></div><p className="text-xs uppercase text-muted-foreground tracking-wider">Saídas</p></div>
          <p className="font-display text-2xl font-bold text-destructive tabular-nums">{formatBRL(totalSaida)}</p>
        </Card>
        <Card className="gradient-card border-primary/30 p-5">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 rounded-md bg-primary/15"><Wallet className="size-4 text-primary" /></div><p className="text-xs uppercase text-muted-foreground tracking-wider">Saldo</p></div>
          <p className={`font-display text-2xl font-bold tabular-nums ${saldo < 0 ? "text-destructive" : "text-primary"}`}>{formatBRL(saldo)}</p>
        </Card>
      </div>

      {/* Insights */}
      <Card className="gradient-card border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-primary" />
            <h2 className="font-display font-bold">Insights inteligentes</h2>
          </div>
          {!isPro && <PremiumLockBadge />}
        </div>
        {!isPro ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">Insights automáticos disponíveis no Premium.</p>
            <Link to="/planos"><Button variant="hero" size="sm"><Sparkles className="size-4" /> Desbloquear</Button></Link>
          </div>
        ) : insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar insights neste mês.</p>
        ) : (
          <ul className="space-y-2">
            {insights.map((t, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <TrendingUp className="size-4 text-primary mt-0.5 shrink-0" />
                <span>
                  {parseBoldSegments(t).map((seg, si) =>
                    seg.bold ? (
                      <strong key={si} className="text-foreground">{seg.text}</strong>
                    ) : (
                      <span key={si}>{seg.text}</span>
                    )
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Ranking categorias */}
      <Card className="gradient-card border-border p-5">
        <h2 className="font-display font-bold mb-4 flex items-center gap-2"><BarChart3 className="size-4 text-primary" /> Categorias mais gastas</h2>
        {ranking.length === 0 ? (
          <p className="text-center py-6 text-sm text-muted-foreground">Sem gastos neste mês.</p>
        ) : (
          <ul className="space-y-3">
            {ranking.map((c, i) => {
              const pct = totalSaida > 0 ? (c.total / totalSaida) * 100 : 0;
              return (
                <li key={i} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ background: c.cor }} />
                      {c.nome}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatBRL(c.total)} <span className="text-[10px]">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.cor }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Botão PDF */}
      <Card className="gradient-card border-border p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <h3 className="font-display font-bold">Exportar relatório completo</h3>
          <p className="text-sm text-muted-foreground">PDF profissional com resumo, categorias e lançamentos.</p>
        </div>
        <Button variant="hero" size="lg" onClick={handlePDF} className="shrink-0">
          <FileDown className="size-4" /> Gerar PDF {!isPro && <PremiumLockBadge label="PRO" />}
        </Button>
      </Card>

      {isLoading && <p className="text-center text-sm text-muted-foreground">Carregando...</p>}
    </div>
  );
};

export default Relatorios;
