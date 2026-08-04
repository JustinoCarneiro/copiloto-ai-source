import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Trash2, MessageSquare, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";

const HistoricoIA = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: conversas = [] } = useQuery({
    queryKey: ["ia_conversas", search],
    queryFn: async () => {
      // Se houver busca, primeiro procura em mensagens
      let ids: string[] | null = null;
      if (search.trim()) {
        const { data: msgs } = await supabase.from("ia_mensagens").select("conversa_id").ilike("content", `%${search}%`).limit(200);
        ids = Array.from(new Set((msgs ?? []).map((m: any) => m.conversa_id)));
      }
      let query = supabase.from("ia_conversas").select("*").order("updated_at", { ascending: false });
      if (ids !== null) {
        if (ids.length === 0 && !search.trim()) return [];
        // combina: titulo OR id in ids
        const idFilter = ids.length > 0 ? `id.in.(${ids.join(",")}),` : "";
        query = query.or(`${idFilter}titulo.ilike.%${search}%`);
      }
      const { data } = await query;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ia_conversas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Conversa excluída"); qc.invalidateQueries({ queryKey: ["ia_conversas"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = conversas;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1 flex items-center gap-2">
          <Sparkles className="size-3" /> Copiloto
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Histórico da IA</h1>
        <p className="text-sm text-muted-foreground mt-1">Conversas dos últimos 15 dias. Depois disso são apagadas automaticamente.</p>
      </header>

      <Input placeholder="Pesquisar conversas..." value={search} onChange={e => setSearch(e.target.value)} />

      <Card className="gradient-card border-border divide-y divide-border/60">
        {filtered.length === 0 && (
          <p className="text-center py-12 text-muted-foreground text-sm">Nenhuma conversa salva.</p>
        )}
        {filtered.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3 p-3 md:p-4 hover:bg-muted/20 transition-colors">
            <div className="size-9 md:size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MessageSquare className="size-4 md:size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate text-sm md:text-base">{c.titulo}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString("pt-BR")}</p>
            </div>
            <Button asChild variant="ghost" size="icon" className="size-8 md:size-9">
              <Link to={`/ia?c=${c.id}`}><ArrowRight className="size-4 text-primary" /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="size-8 md:size-9" onClick={() => setDeletingId(c.id)}>
              <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
      </Card>

      <ConfirmDelete
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        onConfirm={() => { if (deletingId) del.mutate(deletingId); setDeletingId(null); }}
        title="Excluir conversa?"
        description="A conversa e todas as mensagens serão removidas permanentemente."
      />
    </div>
  );
};

export default HistoricoIA;
