import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, CreditCard, Pencil, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Skeleton } from "@/components/ui/skeleton";

const BANDEIRAS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outro"];
const COLORS = ["#FF6A00", "#A855F7", "#3B82F6", "#10B981", "#EF4444", "#0EA5E9"];

interface FormState {
  nome: string;
  tipo: "credito" | "debito";
  bandeira: string;
  limite: string;
  dia_fechamento: string;
  dia_vencimento: string;
  cor: string;
}

const empty: FormState = { nome: "", tipo: "credito", bandeira: "Visa", limite: "", dia_fechamento: "", dia_vencimento: "", cor: COLORS[0] };

const Cartoes = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [delId, setDelId] = useState<string | null>(null);

  const { data: cartoes = [], isLoading } = useQuery({
    queryKey: ["cartoes"],
    queryFn: async () => (await supabase.from("cartoes").select("*").order("nome")).data ?? [],
  });

  const { data: gastos = [] } = useQuery({
    queryKey: ["gastos-cartoes"],
    queryFn: async () => (await supabase.from("gastos").select("cartao_id, valor, data, tipo").eq("tipo", "saida")).data ?? [],
  });

  const reset = () => { setForm(empty); setEditing(null); };

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.nome.trim()) throw new Error("Nome obrigatório");
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        bandeira: form.bandeira,
        cor: form.cor,
        limite: form.limite ? parseFloat(form.limite.replace(",", ".")) : null,
        dia_fechamento: form.dia_fechamento ? parseInt(form.dia_fechamento) : null,
        dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      };
      if (editing) {
        const { error } = await supabase.from("cartoes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cartoes").insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Cartão atualizado" : "Cartão criado");
      qc.invalidateQueries({ queryKey: ["cartoes"] });
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("cartoes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["cartoes"] }); },
  });

  const startEdit = (c: any) => {
    setEditing(c);
    setForm({
      nome: c.nome, tipo: c.tipo, bandeira: c.bandeira || "Visa",
      limite: c.limite ? String(c.limite) : "",
      dia_fechamento: c.dia_fechamento ? String(c.dia_fechamento) : "",
      dia_vencimento: c.dia_vencimento ? String(c.dia_vencimento) : "",
      cor: c.cor || COLORS[0],
    });
    setOpen(true);
  };

  // Calcula fatura aberta para cada cartão (gastos entre último fechamento e próximo)
  const faturas = useMemo(() => {
    const today = new Date();
    const map: Record<string, { aberta: number; venceEm: number | null; melhorDia: number | null; fechaEm: number | null; usado: number }> = {};
    cartoes.forEach((c: any) => {
      const dF = c.dia_fechamento;
      const dV = c.dia_vencimento;
      let inicio: Date | null = null;
      let fim: Date | null = null;
      let venceEm: number | null = null;
      let fechaEm: number | null = null;
      let melhorDia: number | null = null;

      if (dF) {
        const dia = today.getDate();
        if (dia > dF) {
          inicio = new Date(today.getFullYear(), today.getMonth(), dF + 1);
          fim = new Date(today.getFullYear(), today.getMonth() + 1, dF);
        } else {
          inicio = new Date(today.getFullYear(), today.getMonth() - 1, dF + 1);
          fim = new Date(today.getFullYear(), today.getMonth(), dF);
        }
        const proxFech = new Date(today.getFullYear(), today.getMonth(), dF);
        if (proxFech < today) proxFech.setMonth(proxFech.getMonth() + 1);
        fechaEm = Math.ceil((proxFech.getTime() - today.getTime()) / 86400000);
        // Melhor dia = dia seguinte ao fechamento
        melhorDia = (dF % 31) + 1;
      }
      if (dV) {
        const proxVenc = new Date(today.getFullYear(), today.getMonth(), dV);
        if (proxVenc < today) proxVenc.setMonth(proxVenc.getMonth() + 1);
        venceEm = Math.ceil((proxVenc.getTime() - today.getTime()) / 86400000);
      }

      const aberta = gastos
        .filter((g: any) => g.cartao_id === c.id)
        .filter((g: any) => {
          if (!inicio || !fim) return true;
          const d = new Date(g.data);
          return d >= inicio && d <= fim;
        })
        .reduce((s: number, g: any) => s + Number(g.valor), 0);

      const usado = gastos.filter((g: any) => g.cartao_id === c.id).reduce((s: number, g: any) => s + Number(g.valor), 0);

      map[c.id] = { aberta, venceEm, melhorDia, fechaEm, usado };
    });
    return map;
  }, [cartoes, gastos]);

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1">Pagamento</p>
          <h1 className="font-display text-3xl font-bold">Cartões</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button variant="hero"><Plus className="size-4" /> Novo cartão</Button></DialogTrigger>
          <DialogContent className="gradient-card border-border max-w-md">
            <DialogHeader><DialogTitle className="font-display">{editing ? "Editar cartão" : "Novo cartão"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Nubank" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credito">Crédito</SelectItem>
                      <SelectItem value="debito">Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bandeira</Label>
                  <Select value={form.bandeira} onValueChange={(v) => setForm({ ...form, bandeira: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BANDEIRAS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Limite (opcional)</Label><Input type="text" inputMode="decimal" value={form.limite} onChange={e => setForm({ ...form, limite: e.target.value })} placeholder="0,00" /></div>
              {form.tipo === "credito" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Dia fechamento</Label><Input type="number" min={1} max={31} value={form.dia_fechamento} onChange={e => setForm({ ...form, dia_fechamento: e.target.value })} placeholder="Ex: 25" /></div>
                  <div className="space-y-2"><Label>Dia vencimento</Label><Input type="number" min={1} max={31} value={form.dia_vencimento} onChange={e => setForm({ ...form, dia_vencimento: e.target.value })} placeholder="Ex: 5" /></div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })}
                      className={`size-8 rounded-full border-2 transition-all ${form.cor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
              <Button variant="hero" className="w-full" onClick={() => save.mutate()}>{editing ? "Salvar" : "Criar cartão"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-[1.6/1] rounded-xl" />)}
        {!isLoading && cartoes.length === 0 && (
          <Card className="gradient-card border-border p-10 text-center col-span-full">
            <CreditCard className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum cartão. Crie seu primeiro.</p>
          </Card>
        )}
        {cartoes.map((c: any) => {
          const f = faturas[c.id] || { aberta: 0, venceEm: null, melhorDia: null, fechaEm: null, usado: 0 };
          const limite = Number(c.limite || 0);
          const disponivel = Math.max(0, limite - f.usado);
          const pctUso = limite > 0 ? Math.min(100, (f.usado / limite) * 100) : 0;
          return (
            <Card key={c.id} className="border-border overflow-hidden flex flex-col animate-fade-in hover:scale-[1.01] transition-transform">
              {/* Card visual */}
              <div className="relative p-5 aspect-[1.7/1] flex flex-col justify-between" style={{ background: `linear-gradient(135deg, ${c.cor}, hsl(0 0% 8%))` }}>
                <div className="flex items-start justify-between">
                  <CreditCard className="size-7 text-white/80" />
                  <div className="flex">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(c)} className="text-white/80 hover:text-white hover:bg-white/10 size-8"><Pencil className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDelId(c.id)} className="text-white/80 hover:text-white hover:bg-white/10 size-8"><Trash2 className="size-3.5" /></Button>
                  </div>
                </div>
                <div>
                  <p className="text-white/70 text-[10px] uppercase tracking-widest">{c.bandeira || c.tipo}</p>
                  <p className="font-display text-xl font-bold text-white">{c.nome}</p>
                  <p className="text-white/80 text-[11px] uppercase tracking-wider">{c.tipo}</p>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3 bg-card">
                {limite > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Disponível</span>
                      <span className="font-semibold text-success tabular-nums">{formatBRL(disponivel)}</span>
                    </div>
                    <Progress value={pctUso} className="h-1.5" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Usado {formatBRL(f.usado)}</span>
                      <span>Limite {formatBRL(limite)}</span>
                    </div>
                  </div>
                )}

                {c.tipo === "credito" && (
                  <div className="rounded-lg bg-background/40 border border-border/40 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3" /> Fatura aberta</span>
                      <span className="font-display font-bold text-primary tabular-nums">{formatBRL(f.aberta)}</span>
                    </div>
                    {c.dia_vencimento && (
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="size-3" /> Vence dia {c.dia_vencimento}</span>
                        {f.venceEm !== null && <span className="text-warning font-semibold">em {f.venceEm}d</span>}
                      </div>
                    )}
                    {c.dia_fechamento && f.fechaEm !== null && f.fechaEm <= 3 && (
                      <p className="text-[10px] text-warning font-semibold">⚠️ Fecha em {f.fechaEm} dia(s)</p>
                    )}
                    {c.dia_fechamento && f.fechaEm !== null && f.fechaEm > 3 && f.melhorDia && (
                      <p className="text-[10px] text-success">💡 Melhor dia: {f.melhorDia}</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDelete
        open={!!delId}
        onOpenChange={(v) => !v && setDelId(null)}
        onConfirm={() => { if (delId) { del.mutate(delId); setDelId(null); } }}
        title="Excluir cartão?"
        description="Os lançamentos vinculados não serão removidos, apenas perderão a referência ao cartão."
      />
    </div>
  );
};

export default Cartoes;
