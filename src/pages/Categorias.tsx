import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Skeleton } from "@/components/ui/skeleton";

const PRESET_COLORS = ["#FF6A00", "#FF8C42", "#A855F7", "#10B981", "#3B82F6", "#EF4444", "#22C55E", "#EC4899"];

const Categorias = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(PRESET_COLORS[0]);
  const [delId, setDelId] = useState<string | null>(null);

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias").select("*").order("nome")).data ?? [],
  });

  const reset = () => { setNome(""); setCor(PRESET_COLORS[0]); setEditing(null); };

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !nome.trim()) throw new Error("Nome obrigatório");
      if (editing) {
        const { error } = await supabase.from("categorias").update({ nome: nome.trim(), cor }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categorias").insert({ user_id: user.id, nome: nome.trim(), cor, icone: "tag" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("categorias").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries({ queryKey: ["categorias"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error("Não foi possível excluir", { description: e.message }),
  });

  const startEdit = (c: any) => { setEditing(c); setNome(c.nome); setCor(c.cor); setOpen(true); };

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1">Tags</p>
          <h1 className="font-display text-3xl font-bold">Categorias</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button variant="hero"><Plus className="size-4" /> Nova categoria</Button>
          </DialogTrigger>
          <DialogContent className="gradient-card border-border max-w-sm">
            <DialogHeader><DialogTitle className="font-display">{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Streaming" /></div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setCor(c)}
                      className={`size-8 rounded-full border-2 transition-all ${cor === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <Button variant="hero" className="w-full" onClick={() => save.mutate()}>{editing ? "Salvar" : "Criar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        {cats.map((c: any) => (
          <Card key={c.id} className="gradient-card border-border p-4 flex items-center gap-3 group hover:border-primary/40 transition-all hover:scale-[1.01] animate-fade-in">
            <div className="size-12 rounded-xl flex items-center justify-center font-bold text-lg" style={{ background: c.cor + "22", color: c.cor }}>
              {c.nome.slice(0, 2).toUpperCase()}
            </div>
            <p className="flex-1 font-medium truncate">{c.nome}</p>
            <Button variant="ghost" size="icon" onClick={() => startEdit(c)}>
              <Pencil className="size-4 text-muted-foreground hover:text-primary" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDelId(c.id)}>
              <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </Card>
        ))}
      </div>

      <ConfirmDelete
        open={!!delId}
        onOpenChange={(v) => !v && setDelId(null)}
        onConfirm={() => { if (delId) { del.mutate(delId); setDelId(null); } }}
        title="Excluir categoria?"
        description="Os lançamentos vinculados ficarão sem categoria."
      />
    </div>
  );
};

export default Categorias;
