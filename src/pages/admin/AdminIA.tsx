import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Bot, DollarSign, MessageSquare } from "lucide-react";

export default function AdminIA() {
  const q = useQuery({
    queryKey: ["admin-ia-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-ia-stats");
      if (error) throw error;
      return data as any;
    },
  });
  const d = q.data ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase text-muted-foreground"><MessageSquare className="size-3.5" /> Total mensagens</div>
          <div className="font-display text-2xl font-bold mt-1">{d.totalMensagens ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase text-muted-foreground"><DollarSign className="size-3.5" /> Custo estimado</div>
          <div className="font-display text-2xl font-bold mt-1">US$ {d.custoEstimadoUSD ?? "0"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase text-muted-foreground"><Bot className="size-3.5" /> Modelo</div>
          <div className="font-display text-sm font-bold mt-1">Gemini 3 Flash</div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Top usuários por consumo</h3>
        <div className="space-y-1">
          {(d.topUsuarios ?? []).map((u: any) => (
            <div key={u.user_id} className="flex justify-between text-sm border-b border-border/40 py-1.5">
              <span className="truncate">{u.email ?? u.user_id}</span>
              <span className="text-primary font-semibold">{u.count} msgs</span>
            </div>
          ))}
          {(d.topUsuarios ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Últimas perguntas</h3>
        <div className="space-y-2">
          {(d.ultimasPerguntas ?? []).map((m: any) => (
            <div key={m.created_at + m.user_id} className="text-xs border-b border-border/40 pb-1.5">
              <div className="text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</div>
              <div className="truncate">{m.content}</div>
            </div>
          ))}
          {(d.ultimasPerguntas ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem perguntas ainda.</p>}
        </div>
      </Card>
    </div>
  );
}
