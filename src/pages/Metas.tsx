import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, PiggyBank, Pencil, Coins, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { PremiumGate } from "@/components/PremiumGate";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Skeleton } from "@/components/ui/skeleton";

const Metas = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [obj, setObj] = useState("");
  const [atual, setAtual] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const [depositMeta, setDepositMeta] = useState<any>(null);
  const [depositVal, setDepositVal] = useState("");
  const [depositMode, setDepositMode] = useState<"deposit" | "withdraw">("deposit");

  const ensureCofrinhoCategoria = async () => {
    if (!user) throw new Error("Sem usuário");
    const { data: existing } = await supabase
      .from("categorias").select("id").eq("user_id", user.id).ilike("nome", "Cofrinho").maybeSingle();
    if (existing) return existing.id as string;
    const { data: created, error } = await supabase
      .from("categorias")
      .insert({ user_id: user.id, nome: "Cofrinho", icone: "piggy-bank", cor: "#A855F7" })
      .select("id").single();
    if (error) throw error;
    return created!.id as string;
  };

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["metas"],
    queryFn: async () => (await supabase.from("metas").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const reset = () => { setNome(""); setObj(""); setAtual(""); setEditing(null); };

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !nome.trim() || !obj) throw new Error("Preencha nome e objetivo");
      const payload = {
        nome: nome.trim(),
        valor_objetivo: parseFloat(obj.replace(",", ".")),
        valor_atual: atual ? parseFloat(atual.replace(",", ".")) : 0,
      };
      if (editing) {
        const { error } = await supabase.from("metas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("metas").insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Cofrinho atualizado!" : "Cofrinho criado!");
      qc.invalidateQueries({ queryKey: ["metas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deposit = useMutation({
    mutationFn: async () => {
      if (!user || !depositMeta || !depositVal) return;
      const val = parseFloat(depositVal.replace(",", "."));
      if (isNaN(val) || val <= 0) throw new Error("Valor inválido");
      const atual = Number(depositMeta.valor_atual);
      if (depositMode === "withdraw" && val > atual) throw new Error("Valor maior que o guardado");
      const novoValor = depositMode === "deposit" ? atual + val : atual - val;
      const catId = await ensureCofrinhoCategoria();
      const { error: eGasto } = await supabase.from("gastos").insert({
        user_id: user.id,
        descricao: `${depositMode === "deposit" ? "Depósito" : "Resgate"} · ${depositMeta.nome}`,
        destino: "Cofrinho",
        valor: val,
        tipo: depositMode === "deposit" ? "saida" : "entrada",
        forma_pagamento: "pix",
        categoria_id: catId,
        data: new Date().toISOString().slice(0, 10),
      });
      if (eGasto) throw eGasto;
      const { error } = await supabase.from("metas")
        .update({ valor_atual: novoValor })
        .eq("id", depositMeta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(depositMode === "deposit" ? "Depósito registrado 🎉" : "Resgate registrado");
      qc.invalidateQueries({ queryKey: ["metas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["gastos"] });
      qc.invalidateQueries({ queryKey: ["relatorios"] });
      setDepositMeta(null); setDepositVal("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("metas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Cofrinho excluído"); qc.invalidateQueries({ queryKey: ["metas"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const startEdit = (m: any) => {
    setEditing(m);
    setNome(m.nome);
    setObj(String(m.valor_objetivo));
    setAtual(String(m.valor_atual));
    setOpen(true);
  };

  return (
    <PremiumGate feature="Cofrinhos" description="Crie metas de poupança ilimitadas e acompanhe seu progresso para realizar seus sonhos.">
      <div className="space-y-5 animate-fade-in">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1">Metas</p>
            <h1 className="font-display text-3xl font-bold">Cofrinhos</h1>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button variant="hero"><Plus className="size-4" /> Novo cofrinho</Button></DialogTrigger>
            <DialogContent className="gradient-card border-border max-w-sm">
              <DialogHeader><DialogTitle className="font-display">{editing ? "Editar cofrinho" : "Novo cofrinho"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Viagem Japão" /></div>
                <div className="space-y-2"><Label>Valor objetivo</Label><Input type="text" inputMode="decimal" value={obj} onChange={e => setObj(e.target.value)} placeholder="0,00" /></div>
                <div className="space-y-2"><Label>{editing ? "Valor guardado" : "Já tenho guardado (opcional)"}</Label><Input type="text" inputMode="decimal" value={atual} onChange={e => setAtual(e.target.value)} placeholder="0,00" /></div>
                <Button variant="hero" className="w-full" onClick={() => save.mutate()}>{editing ? "Salvar" : "Criar cofrinho"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          {!isLoading && metas.length === 0 && (
            <Card className="gradient-card border-border p-10 text-center col-span-full">
              <PiggyBank className="size-10 text-primary mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Crie seu primeiro cofrinho.</p>
            </Card>
          )}
          {metas.map((m: any) => {
            const pct = Math.min(100, (Number(m.valor_atual) / Number(m.valor_objetivo)) * 100);
            const falta = Math.max(0, Number(m.valor_objetivo) - Number(m.valor_atual));
            return (
              <Card key={m.id} className="gradient-card border-border p-5 space-y-3 hover:border-primary/40 transition-all animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-10 rounded-lg gradient-primary flex items-center justify-center shrink-0"><PiggyBank className="size-5 text-primary-foreground" /></div>
                    <h3 className="font-display font-bold truncate">{m.nome}</h3>
                  </div>
                  <div className="flex">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(m)}><Pencil className="size-4 text-muted-foreground hover:text-primary" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDelId(m.id)}><Trash2 className="size-4 text-muted-foreground hover:text-destructive" /></Button>
                  </div>
                </div>
                <Progress value={pct} className="h-2.5" />
                <div className="flex justify-between text-sm">
                  <span className="font-display font-bold text-primary tabular-nums">{formatBRL(m.valor_atual)}</span>
                  <span className="text-muted-foreground tabular-nums">/ {formatBRL(m.valor_objetivo)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Faltam <span className="text-foreground font-semibold">{formatBRL(falta)}</span></p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="neon" size="sm" onClick={() => { setDepositMode("deposit"); setDepositMeta(m); setDepositVal(""); }}>
                    <Coins className="size-4" /> Depositar
                  </Button>
                  <Button variant="outline" size="sm" disabled={Number(m.valor_atual) <= 0} onClick={() => { setDepositMode("withdraw"); setDepositMeta(m); setDepositVal(""); }}>
                    <ArrowDownToLine className="size-4" /> Resgatar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Deposit/Withdraw dialog */}
        <Dialog open={!!depositMeta} onOpenChange={(v) => !v && setDepositMeta(null)}>
          <DialogContent className="gradient-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">
                {depositMode === "deposit" ? "Depositar em" : "Resgatar de"} {depositMeta?.nome}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input autoFocus type="text" inputMode="decimal" value={depositVal} onChange={e => setDepositVal(e.target.value)} placeholder="0,00" />
              </div>
              <p className="text-xs text-muted-foreground">
                {depositMode === "deposit"
                  ? "Será registrada uma saída na categoria Cofrinho."
                  : "Será registrada uma entrada na categoria Cofrinho."}
              </p>
              <Button variant="hero" className="w-full" onClick={() => deposit.mutate()}>
                {depositMode === "deposit" ? "Confirmar depósito" : "Confirmar resgate"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDelete
          open={!!delId}
          onOpenChange={(v) => !v && setDelId(null)}
          onConfirm={() => { if (delId) { del.mutate(delId); setDelId(null); } }}
          title="Excluir cofrinho?"
          description="O valor guardado será apenas removido do registro, não afeta seu saldo."
        />
      </div>
    </PremiumGate>
  );
};

export default Metas;
