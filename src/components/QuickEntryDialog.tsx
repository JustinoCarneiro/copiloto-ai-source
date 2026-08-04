import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/format";

interface EditableGasto {
  id: string;
  descricao: string;
  destino: string | null;
  valor: number;
  tipo: "saida" | "entrada";
  forma_pagamento: string;
  cartao_id: string | null;
  categoria_id: string | null;
  parcelas: number | null;
  data: string;
}

interface Props {
  initial?: Partial<FormState>;
  editGasto?: EditableGasto;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

interface FormState {
  descricao: string;
  destino: string;
  valor: string;
  tipo: "saida" | "entrada";
  forma_pagamento: "debito" | "credito" | "dinheiro" | "pix";
  cartao_id: string;
  categoria_id: string;
  parcelas: string;
  data: string;
}

const emptyForm = (): FormState => ({
  descricao: "", destino: "", valor: "", tipo: "saida",
  forma_pagamento: "debito", cartao_id: "none", categoria_id: "none",
  parcelas: "1", data: new Date().toISOString().slice(0, 10),
});

const INVALIDATE_KEYS = ["gastos", "dashboard", "relatorios", "cartoes", "contas", "ranking", "metas"];

export const QuickEntryDialog = ({ initial, editGasto, trigger, open: openProp, onOpenChange }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const isEdit = !!editGasto;

  const [form, setForm] = useState<FormState>(() => {
    if (editGasto) {
      return {
        descricao: editGasto.descricao,
        destino: editGasto.destino ?? "",
        valor: String(editGasto.valor).replace(".", ","),
        tipo: editGasto.tipo,
        forma_pagamento: (editGasto.forma_pagamento as any) ?? "debito",
        cartao_id: editGasto.cartao_id ?? "none",
        categoria_id: editGasto.categoria_id ?? "none",
        parcelas: String(editGasto.parcelas ?? 1),
        data: editGasto.data,
      };
    }
    return { ...emptyForm(), ...(initial as any) };
  });

  useEffect(() => {
    if (editGasto && open) {
      setForm({
        descricao: editGasto.descricao,
        destino: editGasto.destino ?? "",
        valor: String(editGasto.valor).replace(".", ","),
        tipo: editGasto.tipo,
        forma_pagamento: (editGasto.forma_pagamento as any) ?? "debito",
        cartao_id: editGasto.cartao_id ?? "none",
        categoria_id: editGasto.categoria_id ?? "none",
        parcelas: String(editGasto.parcelas ?? 1),
        data: editGasto.data,
      });
    }
  }, [editGasto?.id, open]);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias", user?.id],
    queryFn: async () => (await supabase.from("categorias").select("*").order("nome")).data ?? [],
    enabled: !!user,
  });

  const { data: cartoes = [] } = useQuery({
    queryKey: ["cartoes", user?.id],
    queryFn: async () => (await supabase.from("cartoes").select("*").order("nome")).data ?? [],
    enabled: !!user,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["gastos_historico", editGasto?.id],
    queryFn: async () => {
      if (!editGasto) return [];
      const { data } = await supabase
        .from("gastos_historico")
        .select("*")
        .eq("gasto_id", editGasto.id)
        .order("changed_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!editGasto && open,
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      const valor = parseFloat(form.valor.replace(",", "."));
      if (!valor || valor <= 0) throw new Error("Valor inválido");
      const parcelas = Math.max(1, parseInt(form.parcelas) || 1);
      const payload = {
        descricao: form.descricao,
        destino: form.destino || null,
        valor,
        tipo: form.tipo,
        forma_pagamento: form.forma_pagamento,
        cartao_id: form.cartao_id !== "none" ? form.cartao_id : null,
        categoria_id: form.categoria_id !== "none" ? form.categoria_id : null,
        parcelas,
        valor_parcela: parcelas > 1 ? valor / parcelas : null,
        data: form.data,
      };
      if (isEdit) {
        const { error } = await supabase.from("gastos").update(payload).eq("id", editGasto!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("gastos").insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Lançamento atualizado" : "Lançamento salvo!");
      INVALIDATE_KEYS.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      setOpen(false);
      if (!isEdit) setForm(emptyForm());
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const catName = (id: string) => categorias.find((c: any) => c.id === id)?.nome ?? id.slice(0, 8);
  const cardName = (id: string) => cartoes.find((c: any) => c.id === id)?.nome ?? id.slice(0, 8);
  const labelField = (k: string): string => ({
    descricao: "Descrição", destino: "Destino", valor: "Valor", tipo: "Tipo",
    forma_pagamento: "Pagamento", categoria_id: "Categoria", cartao_id: "Cartão",
    parcelas: "Parcelas", data: "Data",
  } as any)[k] ?? k;
  const fmtVal = (k: string, v: any): string => {
    if (v == null) return "—";
    if (k === "valor") return formatBRL(Number(v));
    if (k === "categoria_id") return catName(String(v));
    if (k === "cartao_id") return cardName(String(v));
    if (k === "data") return formatDate(String(v));
    return String(v);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md gradient-card border-border max-h-[92vh] overflow-y-auto scrollbar-thin w-[calc(100vw-1.5rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="font-display gradient-text">{isEdit ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={form.tipo === "saida" ? "hero" : "outline"} onClick={() => setForm(f => ({...f, tipo: "saida"}))}>Saída</Button>
            <Button type="button" variant={form.tipo === "entrada" ? "hero" : "outline"} onClick={() => setForm(f => ({...f, tipo: "entrada"}))}>Entrada</Button>
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input type="text" inputMode="decimal" placeholder="0,00" required className="text-2xl font-display h-14"
              value={form.valor} onChange={e => setForm(f => ({...f, valor: e.target.value}))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input required value={form.descricao} onChange={e => setForm(f => ({...f, descricao: e.target.value}))} placeholder="Ex: Almoço" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" required value={form.data} onChange={e => setForm(f => ({...f, data: e.target.value}))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Destino</Label>
            <Input value={form.destino} onChange={e => setForm(f => ({...f, destino: e.target.value}))} placeholder="Ex: iFood, Uber, Mercado..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.categoria_id} onValueChange={v => setForm(f => ({...f, categoria_id: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={(v: any) => setForm(f => ({...f, forma_pagamento: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(form.forma_pagamento === "credito" || form.forma_pagamento === "debito") && cartoes.length > 0 && (
            <div className="space-y-2">
              <Label>Cartão</Label>
              <Select value={form.cartao_id} onValueChange={v => setForm(f => ({...f, cartao_id: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {cartoes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.forma_pagamento === "credito" && (
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Input type="number" min={1} max={48} value={form.parcelas} onChange={e => setForm(f => ({...f, parcelas: e.target.value}))} />
              {parseInt(form.parcelas) > 1 && form.valor && (
                <p className="text-xs text-muted-foreground">
                  {form.parcelas}x de R$ {(parseFloat(form.valor.replace(",", ".")) / parseInt(form.parcelas)).toFixed(2)}
                </p>
              )}
            </div>
          )}

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="animate-spin" /> : isEdit ? "Salvar alterações" : "Salvar lançamento"}
          </Button>
        </form>

        {isEdit && historico.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
            <p className="text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
              <History className="size-3" /> Histórico de alterações
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
              {historico.map((h: any) => (
                <div key={h.id} className="text-xs bg-background/40 rounded-lg p-2 border border-border/40">
                  <p className="text-muted-foreground mb-1">{new Date(h.changed_at).toLocaleString("pt-BR")}</p>
                  {Object.entries(h.changes as Record<string, [any, any]>).map(([k, [oldV, newV]]) => (
                    <p key={k} className="truncate">
                      <span className="text-primary font-medium">{labelField(k)}:</span>{" "}
                      <span className="line-through text-muted-foreground">{fmtVal(k, oldV)}</span>
                      {" → "}
                      <span className="font-medium">{fmtVal(k, newV)}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const FloatingActionButton = () => (
  <QuickEntryDialog
    trigger={
      <Button
        variant="hero"
        className="fixed bottom-24 right-4 md:bottom-28 md:right-8 z-40 size-14 md:size-16 rounded-full p-0 shadow-glow animate-pulse-glow"
        aria-label="Novo lançamento"
      >
        <Plus className="size-6 md:size-7" />
      </Button>
    }
  />
);
