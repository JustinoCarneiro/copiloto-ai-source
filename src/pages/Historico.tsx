import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, formatDate } from "@/lib/format";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { QuickEntryDialog } from "@/components/QuickEntryDialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";

const INVALIDATE = ["gastos", "dashboard", "relatorios", "cartoes", "contas", "ranking", "metas"];

const Historico = () => {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroCat, setFiltroCat] = useState<string>(params.get("cat") || "all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const cat = params.get("cat");
    if (cat) setFiltroCat(cat);
  }, [params]);

  const { data: gastos = [] } = useQuery({
    queryKey: ["gastos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gastos")
        .select("*, categoria:categorias(nome,cor), cartao:cartoes(nome)")
        .order("data", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias").select("*")).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gastos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído");
      INVALIDATE.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const filtered = gastos.filter((g: any) => {
    if (filtroTipo !== "all" && g.tipo !== filtroTipo) return false;
    if (filtroCat !== "all" && g.categoria_id !== filtroCat) return false;
    if (search && !`${g.descricao} ${g.destino || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1">Lançamentos</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Histórico</h1>
      </header>

      <Card className="gradient-card border-border p-3 md:p-4 grid gap-2 md:grid-cols-3">
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCat} onValueChange={setFiltroCat}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="gradient-card border-border divide-y divide-border/60">
        {filtered.length === 0 && (
          <p className="text-center py-12 text-muted-foreground text-sm">Nenhum lançamento.</p>
        )}
        {filtered.map((g: any) => (
          <div key={g.id} className="flex items-center gap-2 md:gap-3 p-3 md:p-4 hover:bg-muted/20 transition-colors">
            <div
              className="size-9 md:size-10 rounded-lg flex items-center justify-center font-bold text-xs md:text-sm shrink-0"
              style={{ background: (g.categoria?.cor ?? "#FF6A00") + "22", color: g.categoria?.cor ?? "#FF6A00" }}
            >
              {(g.categoria?.nome ?? g.descricao).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate text-sm md:text-base">{g.descricao}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                {[g.destino, g.cartao?.nome, g.forma_pagamento].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-display font-bold tabular-nums text-sm md:text-base ${g.tipo === "entrada" ? "text-success" : "text-foreground"}`}>
                {g.tipo === "entrada" ? "+" : "−"} {formatBRL(g.valor)}
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{formatDate(g.data)}</p>
            </div>
            <div className="flex shrink-0">
              <Button variant="ghost" size="icon" className="size-8 md:size-9" onClick={() => setEditing(g)} aria-label="Editar">
                <Pencil className="size-3.5 md:size-4 text-muted-foreground hover:text-primary" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 md:size-9" onClick={() => setDeletingId(g.id)} aria-label="Excluir">
                <Trash2 className="size-3.5 md:size-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </Card>

      {editing && (
        <QuickEntryDialog
          key={editing.id}
          editGasto={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}

      <ConfirmDelete
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        onConfirm={() => { if (deletingId) del.mutate(deletingId); setDeletingId(null); }}
        title="Excluir lançamento?"
        description="Essa ação não poderá ser desfeita. O lançamento e seu histórico de alterações serão removidos."
      />
    </div>
  );
};

export default Historico;
