import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Check, Trash2, Wallet, CheckCircle2, Clock, Pencil, DollarSign, Receipt, Calendar, CreditCard as CardIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Skeleton } from "@/components/ui/skeleton";

interface FormState {
  descricao: string; destino: string; valor: string;
  tipo: "fixa" | "avulsa" | "parcelada";
  parcelas: string; dia: string;
}
const empty: FormState = { descricao: "", destino: "", valor: "", tipo: "avulsa", parcelas: "1", dia: "" };

type Filter = "todas" | "fixa" | "parcelada" | "avulsa" | "pagas" | "pendentes";

const Contas = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [delId, setDelId] = useState<string | null>(null);
  const [payConta, setPayConta] = useState<any>(null);
  const [payVal, setPayVal] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payObs, setPayObs] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [openItem, setOpenItem] = useState<string>("");

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ["contas"],
    queryFn: async () => (await supabase.from("contas").select("*").order("data_vencimento", { ascending: true, nullsFirst: false })).data ?? [],
  });

  const { data: parcelas = [] } = useQuery({
    queryKey: ["parcelas"],
    queryFn: async () => (await supabase.from("parcelas").select("*").order("numero", { ascending: true })).data ?? [],
  });

  const { data: pagamentosAll = [] } = useQuery({
    queryKey: ["pagamentos-all"],
    queryFn: async () => (await supabase.from("pagamentos_contas").select("*").order("data", { ascending: false })).data ?? [],
  });

  const reset = () => { setForm(empty); setEditing(null); };

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.descricao.trim() || !form.valor) throw new Error("Preencha os campos");
      const valor = parseFloat(form.valor.replace(",", "."));
      const dia = form.dia ? parseInt(form.dia) : null;
      const dataVenc = dia ? new Date(new Date().getFullYear(), new Date().getMonth(), dia).toISOString().slice(0, 10) : null;
      const totalParc = form.tipo === "parcelada" ? Math.max(1, parseInt(form.parcelas) || 1) : 1;

      if (editing) {
        const { error } = await supabase.from("contas").update({
          descricao: form.descricao, destino: form.destino || null, valor,
          tipo: form.tipo, total_parcelas: totalParc, dia_vencimento: dia, data_vencimento: dataVenc,
        }).eq("id", editing.id);
        if (error) throw error;
        return;
      }

      const { data: conta, error } = await supabase.from("contas").insert({
        user_id: user.id, descricao: form.descricao, destino: form.destino || null,
        valor, tipo: form.tipo, total_parcelas: totalParc,
        dia_vencimento: dia, data_vencimento: dataVenc,
      }).select().single();
      if (error) throw error;

      if (form.tipo === "parcelada" && conta) {
        const parcelaValor = valor / totalParc;
        const today = new Date();
        const rows = Array.from({ length: totalParc }).map((_, i) => ({
          user_id: user.id, conta_id: conta.id, numero: i + 1, valor: parcelaValor,
          data_vencimento: new Date(today.getFullYear(), today.getMonth() + i, dia ?? today.getDate()).toISOString().slice(0, 10),
        }));
        await supabase.from("parcelas").insert(rows);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Conta atualizada ✓" : "Conta cadastrada ✓");
      qc.invalidateQueries({ queryKey: ["contas"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pagar = useMutation({
    mutationFn: async () => {
      if (!user || !payConta || !payVal) throw new Error("Informe um valor");
      const v = parseFloat(payVal.replace(",", "."));
      if (isNaN(v) || v <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("pagamentos_contas").insert({
        user_id: user.id, conta_id: payConta.id, valor: v,
        data: payDate, observacao: payObs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado ✓");
      qc.invalidateQueries({ queryKey: ["contas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pagamentos-all"] });
      qc.invalidateQueries({ queryKey: ["cartoes"] });
      qc.invalidateQueries({ queryKey: ["relatorios"] });
      setPayConta(null); setPayVal(""); setPayObs("");
      setPayDate(new Date().toISOString().slice(0, 10));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePagoParcela = useMutation({
    mutationFn: async ({ id, pago }: { id: string; pago: boolean }) => {
      const { error } = await supabase.from("parcelas").update({ pago }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("pagamentos_contas").delete().eq("conta_id", id);
      await supabase.from("parcelas").delete().eq("conta_id", id);
      const { error } = await supabase.from("contas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta excluída");
      qc.invalidateQueries({ queryKey: ["contas"] });
      qc.invalidateQueries({ queryKey: ["parcelas"] });
      qc.invalidateQueries({ queryKey: ["pagamentos-all"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const startEdit = (c: any) => {
    setEditing(c);
    setForm({
      descricao: c.descricao, destino: c.destino || "", valor: String(c.valor),
      tipo: c.tipo, parcelas: String(c.total_parcelas || 1), dia: c.dia_vencimento ? String(c.dia_vencimento) : "",
    });
    setOpen(true);
  };

  const openPay = (c: any) => {
    const restante = Math.max(0, Number(c.valor) - Number(c.valor_pago || 0));
    setPayConta(c);
    setPayVal(restante > 0 ? String(restante.toFixed(2)).replace(".", ",") : "");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayObs("");
  };

  // Sorting + filtering
  const contasSorted = useMemo(() => {
    const arr = [...contas];
    arr.sort((a: any, b: any) => {
      const da = a.data_vencimento ? new Date(a.data_vencimento).getTime() : Infinity;
      const db = b.data_vencimento ? new Date(b.data_vencimento).getTime() : Infinity;
      return da - db;
    });
    return arr.filter((c: any) => {
      const parcelasConta = parcelas.filter((p: any) => p.conta_id === c.id);
      const isParcelada = c.tipo === "parcelada" && parcelasConta.length > 0;
      const pagas = parcelasConta.filter((p: any) => p.pago).length;
      const total = parcelasConta.length || c.total_parcelas || 1;
      const quitado = isParcelada ? pagas === total : (c.status === "pago" || c.pago);
      switch (filter) {
        case "fixa": return c.tipo === "fixa";
        case "parcelada": return c.tipo === "parcelada";
        case "avulsa": return c.tipo === "avulsa";
        case "pagas": return quitado;
        case "pendentes": return !quitado;
        default: return true;
      }
    });
  }, [contas, parcelas, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "pendentes", label: "Pendentes" },
    { key: "pagas", label: "Pagas" },
    { key: "fixa", label: "Fixas" },
    { key: "parcelada", label: "Parceladas" },
    { key: "avulsa", label: "Avulsas" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1">Financeiro</p>
          <h1 className="font-display text-3xl font-bold">Contas</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button variant="hero"><Plus className="size-4" /> Nova conta</Button></DialogTrigger>
          <DialogContent className="gradient-card border-border max-w-md">
            <DialogHeader><DialogTitle className="font-display">{editing ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); save.mutate(); }} className="space-y-3">
              <div className="space-y-2"><Label>Descrição</Label><Input required value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Aluguel" /></div>
              <div className="space-y-2"><Label>Destino</Label><Input value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })} placeholder="Ex: Imobiliária" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Valor</Label><Input required type="text" inputMode="decimal" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0,00" /></div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })} disabled={!!editing}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixa">Fixa mensal</SelectItem>
                      <SelectItem value="avulsa">Avulsa</SelectItem>
                      <SelectItem value="parcelada">Parcelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Dia vencimento</Label><Input type="number" min={1} max={31} value={form.dia} onChange={e => setForm({ ...form, dia: e.target.value })} placeholder="Ex: 10" /></div>
                {form.tipo === "parcelada" && !editing && <div className="space-y-2"><Label>Nº parcelas</Label><Input type="number" min={1} max={48} value={form.parcelas} onChange={e => setForm({ ...form, parcelas: e.target.value })} /></div>}
              </div>
              <Button type="submit" variant="hero" className="w-full">{editing ? "Salvar" : "Salvar conta"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all border",
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        {!isLoading && contasSorted.length === 0 && (
          <Card className="gradient-card border-border p-12 text-center">
            <Wallet className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
          </Card>
        )}

        <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem} className="space-y-2.5">
          {contasSorted.map((c: any) => {
            const parcelasConta = parcelas.filter((p: any) => p.conta_id === c.id);
            const isParcelada = c.tipo === "parcelada" && parcelasConta.length > 0;
            const pagas = parcelasConta.filter((p: any) => p.pago).length;
            const total = parcelasConta.length || c.total_parcelas || 1;
            const pctParc = total > 0 ? (pagas / total) * 100 : 0;
            const proxima = parcelasConta.find((p: any) => !p.pago);
            const dias = c.data_vencimento && c.status !== "pago" ? daysUntil(c.data_vencimento) : null;

            const valor = Number(c.valor);
            const pago = Number(c.valor_pago || 0);
            const restante = Math.max(0, valor - pago);
            const pctPago = valor > 0 ? Math.min(100, (pago / valor) * 100) : 0;
            const status = c.status || (c.pago ? "pago" : "pendente");
            const quitado = isParcelada ? pagas === total : status === "pago";

            const historicoConta = pagamentosAll.filter((p: any) => p.conta_id === c.id);
            const ultimoPag = historicoConta[0];

            const statusInfo = quitado
              ? { label: "Pago", cls: "border-success/40 text-success bg-success/10", dot: "bg-success" }
              : status === "parcial"
              ? { label: "Parcial", cls: "border-warning/40 text-warning bg-warning/10", dot: "bg-warning" }
              : dias !== null && dias < 0
              ? { label: "Vencida", cls: "border-destructive/40 text-destructive bg-destructive/10", dot: "bg-destructive" }
              : dias !== null && dias <= 3
              ? { label: "Urgente", cls: "border-destructive/40 text-destructive bg-destructive/10", dot: "bg-destructive" }
              : { label: "Em aberto", cls: "border-border text-muted-foreground bg-muted/30", dot: "bg-muted-foreground" };

            const vencLabel = c.data_vencimento
              ? (dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : dias !== null && dias > 0 ? `Vence ${formatDate(c.data_vencimento)}` : `Venceu ${formatDate(c.data_vencimento)}`)
              : c.dia_vencimento ? `Dia ${c.dia_vencimento}` : "Sem vencimento";

            return (
              <AccordionItem
                key={c.id}
                value={c.id}
                className={cn(
                  "gradient-card border border-border rounded-2xl overflow-hidden transition-all animate-fade-in",
                  "data-[state=open]:border-primary/50 data-[state=open]:shadow-[0_0_20px_hsl(var(--primary)/0.15)]",
                  quitado && "opacity-75"
                )}
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:text-muted-foreground">
                  <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className={cn(
                      "size-10 rounded-full flex items-center justify-center shrink-0",
                      quitado ? "gradient-primary" : status === "parcial" ? "bg-warning/20 border border-warning/40" : "bg-muted"
                    )}>
                      {quitado
                        ? <CheckCircle2 className="size-5 text-primary-foreground" />
                        : <Clock className={cn("size-4", status === "parcial" ? "text-warning" : "text-muted-foreground")} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[15px] font-semibold leading-tight truncate", quitado && "line-through")}>{c.descricao}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={cn("inline-flex items-center gap-1 text-[11px] px-1.5 h-5 rounded-md border", statusInfo.cls)}>
                          <span className={cn("size-1.5 rounded-full", statusInfo.dot)} />
                          {statusInfo.label}
                        </span>
                        {isParcelada && (
                          <span className="text-[11px] px-1.5 h-5 rounded-md border border-primary/40 text-primary bg-primary/5 inline-flex items-center">
                            {pagas}/{total}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground truncate">{vencLabel}</span>
                      </div>
                    </div>
                    <p className="font-display text-[18px] font-bold text-primary tabular-nums shrink-0 ml-2">{formatBRL(valor)}</p>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-4 pb-4 pt-1">
                  <div className="space-y-4 border-t border-border/50 pt-3">
                    {/* Detalhes grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px]">
                      {c.destino && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Destino</p>
                          <p className="font-medium truncate">{c.destino}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground">Tipo</p>
                        <p className="font-medium capitalize">{c.tipo}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1"><Calendar className="size-3" /> Vencimento</p>
                        <p className="font-medium">{c.data_vencimento ? formatDate(c.data_vencimento) : c.dia_vencimento ? `Dia ${c.dia_vencimento}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valor total</p>
                        <p className="font-semibold tabular-nums">{formatBRL(valor)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valor pago</p>
                        <p className="font-semibold text-warning tabular-nums">{formatBRL(isParcelada ? (pagas * (valor / total)) : pago)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Saldo restante</p>
                        <p className="font-semibold text-primary tabular-nums">{formatBRL(isParcelada ? ((total - pagas) * (valor / total)) : restante)}</p>
                      </div>
                      {isParcelada && (
                        <>
                          <div>
                            <p className="text-muted-foreground">Parcelas pagas</p>
                            <p className="font-semibold tabular-nums">{pagas}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Restantes</p>
                            <p className="font-semibold tabular-nums">{total - pagas}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Progresso</span>
                        <span className="tabular-nums">{Math.round(isParcelada ? pctParc : pctPago)}%</span>
                      </div>
                      <Progress value={isParcelada ? pctParc : pctPago} className="h-2 transition-all duration-500" />
                    </div>

                    {/* Próximo vencimento parcela */}
                    {isParcelada && proxima && (
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 flex items-center gap-2 text-[12px]">
                        <AlertTriangle className="size-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground">Próxima:</span>
                        <span className="font-semibold">{proxima.numero}ª</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="tabular-nums">{formatBRL(proxima.valor)}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(proxima.data_vencimento)}</span>
                      </div>
                    )}

                    {/* Histórico de pagamentos */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Receipt className="size-3" /> Histórico de pagamentos
                      </p>
                      {historicoConta.length === 0 ? (
                        <p className="text-[12px] text-muted-foreground italic">Nenhum pagamento registrado.</p>
                      ) : (
                        <ul className="divide-y divide-border/40 max-h-40 overflow-y-auto rounded-lg bg-background/30 border border-border/40">
                          {historicoConta.map((h: any) => (
                            <li key={h.id} className="flex justify-between items-center px-2.5 py-2 text-[12px]">
                              <div>
                                <p className="font-semibold text-primary tabular-nums">{formatBRL(h.valor)}</p>
                                <p className="text-[10px] text-muted-foreground">{formatDate(h.data)}{h.observacao ? ` · ${h.observacao}` : ""}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="size-7" onClick={async () => {
                                await supabase.from("pagamentos_contas").delete().eq("id", h.id);
                                qc.invalidateQueries({ queryKey: ["pagamentos-all"] });
                                qc.invalidateQueries({ queryKey: ["contas"] });
                                qc.invalidateQueries({ queryKey: ["dashboard"] });
                                toast.success("Pagamento removido");
                              }}>
                                <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {ultimoPag && (
                        <p className="text-[11px] text-muted-foreground">Último pagamento: <span className="text-foreground font-medium">{formatDate(ultimoPag.data)}</span></p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 text-[12px] font-medium transition-all hover:scale-[1.02]"
                        onClick={() => startEdit(c)}
                      >
                        <Pencil className="size-3.5" /> Editar
                      </Button>
                      {isParcelada ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 text-[12px] font-medium border-success/40 text-success hover:bg-success/10 hover:text-success transition-all hover:scale-[1.02]"
                          disabled={!proxima}
                          onClick={() => proxima && togglePagoParcela.mutate({ id: proxima.id, pago: true })}
                        >
                          <Check className="size-3.5" /> {proxima ? `Pagar ${proxima.numero}ª` : "Quitado"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 text-[12px] font-medium border-success/40 text-success hover:bg-success/10 hover:text-success transition-all hover:scale-[1.02]"
                          disabled={quitado}
                          onClick={() => openPay(c)}
                        >
                          <DollarSign className="size-3.5" /> Pagar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 text-[12px] font-medium border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive transition-all hover:scale-[1.02]"
                        onClick={() => setDelId(c.id)}
                      >
                        <Trash2 className="size-3.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Pagamento parcial dialog */}
      <Dialog open={!!payConta} onOpenChange={(v) => !v && setPayConta(null)}>
        <DialogContent className="gradient-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Registrar pagamento</DialogTitle></DialogHeader>
          {payConta && (
            <div className="space-y-4">
              <div className="rounded-lg bg-background/40 border border-border/40 p-3 space-y-1">
                <p className="font-medium">{payConta.descricao}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total</span><span className="tabular-nums">{formatBRL(payConta.valor)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Já pago</span><span className="tabular-nums text-warning">{formatBRL(payConta.valor_pago || 0)}</span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-border/40">
                  <span className="font-semibold">Restante</span>
                  <span className="font-display font-bold text-primary tabular-nums">{formatBRL(Math.max(0, Number(payConta.valor) - Number(payConta.valor_pago || 0)))}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor pago (R$)</Label>
                <Input autoFocus type="text" inputMode="decimal" value={payVal} onChange={e => setPayVal(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea rows={2} value={payObs} onChange={e => setPayObs(e.target.value)} placeholder="Ex: Pix via banco X" />
              </div>
              <Button variant="hero" className="w-full" onClick={() => pagar.mutate()} disabled={pagar.isPending}>
                {pagar.isPending ? "Salvando..." : "Confirmar pagamento"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!delId}
        onOpenChange={(v) => !v && setDelId(null)}
        onConfirm={() => { if (delId) { del.mutate(delId); setDelId(null); } }}
        title="Excluir conta?"
        description="A conta, suas parcelas e pagamentos serão removidos."
      />
    </div>
  );
};

export default Contas;
