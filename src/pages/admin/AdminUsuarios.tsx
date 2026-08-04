import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Crown, X, Lock, Unlock, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";

export default function AdminUsuarios() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cycle, setCycle] = useState<"mensal" | "anual">("mensal");
  const [movUserId, setMovUserId] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["admin-users", q],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users${q ? `?q=${encodeURIComponent(q)}` : ""}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${sess.session?.access_token}` } });
      const j = await r.json();
      return (j?.users ?? []) as any[];
    },
  });

  const act = useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await supabase.functions.invoke("admin-user-actions", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-metrics"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const movs = useQuery({
    queryKey: ["admin-movs", movUserId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-user-actions", { body: { action: "movements", userId: movUserId } });
      if (error) throw error;
      return data as any;
    },
    enabled: !!movUserId,
  });

  const list = users.data ?? [];

  return (
    <Card className="gradient-card p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou email" className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ciclo:</span>
          <Select value={cycle} onValueChange={(v) => setCycle(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="anual">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 md:mx-0">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase text-muted-foreground border-b border-border/60">
              <th className="p-3">Usuário</th>
              <th className="p-3">Plano</th>
              <th className="p-3">Status</th>
              <th className="p-3">Bloqueado</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u: any) => {
              const s = u.subscription;
              const active = s?.plano === "premium" && s?.status === "active";
              return (
                <tr key={u.user_id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="p-3">
                    <div className="font-medium">{u.nome ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={active ? "border-primary/40 text-primary" : "text-muted-foreground"}>
                      {s?.plano ?? "free"}{s?.billing_cycle ? ` · ${s.billing_cycle}` : ""}
                    </Badge>
                  </td>
                  <td className="p-3 capitalize text-muted-foreground">{s?.status ?? "—"}</td>
                  <td className="p-3">{u.blocked ? <Badge variant="destructive">Bloqueado</Badge> : <span className="text-muted-foreground">Ativo</span>}</td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setMovUserId(u.user_id)}><Eye className="size-3" /></Button>
                    {!active ? (
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ action: "set_plan", userId: u.user_id, plano: "premium", cycle })} disabled={act.isPending}>
                        <Crown className="size-3" /> Premium
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act.mutate({ action: "set_plan", userId: u.user_id, plano: "free" })} disabled={act.isPending}>
                        <X className="size-3" /> Free
                      </Button>
                    )}
                    {u.blocked ? (
                      <Button size="sm" variant="ghost" onClick={() => act.mutate({ action: "unblock", userId: u.user_id })}><Unlock className="size-3" /></Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act.mutate({ action: "block", userId: u.user_id })}><Lock className="size-3" /></Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && !users.isLoading && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
        {users.isLoading && <div className="p-4 text-center text-muted-foreground text-xs"><Loader2 className="size-4 inline animate-spin" /> Carregando…</div>}
      </div>

      <Dialog open={!!movUserId} onOpenChange={(o) => !o && setMovUserId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Movimentações do usuário</DialogTitle></DialogHeader>
          {movs.isLoading ? <Loader2 className="size-5 animate-spin mx-auto" /> : (
            <div className="space-y-4 text-sm">
              <section>
                <h4 className="font-semibold mb-2">Últimos gastos</h4>
                <div className="space-y-1">
                  {(movs.data?.gastos ?? []).map((g: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs border-b border-border/40 py-1">
                      <span>{g.data} · {g.descricao}</span>
                      <span className={g.tipo === "entrada" ? "text-success" : "text-destructive"}>{formatBRL(g.valor)}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h4 className="font-semibold mb-2">Contas</h4>
                <div className="space-y-1">
                  {(movs.data?.contas ?? []).map((c: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs border-b border-border/40 py-1">
                      <span>{c.data_vencimento ?? "—"} · {c.descricao} · {c.status}</span>
                      <span>{formatBRL(c.valor)}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h4 className="font-semibold mb-2">Pagamentos</h4>
                <div className="space-y-1">
                  {(movs.data?.pagamentos ?? []).map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs border-b border-border/40 py-1">
                      <span>{new Date(p.created_at).toLocaleString("pt-BR")} · {p.event}</span>
                      <span>{p.amount ? formatBRL(Number(p.amount)) : "—"}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
