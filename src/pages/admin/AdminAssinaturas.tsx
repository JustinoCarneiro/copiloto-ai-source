import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL } from "@/lib/format";

export default function AdminAssinaturas() {
  const [status, setStatus] = useState<string>("all");
  const q = useQuery({
    queryKey: ["admin-subs", status],
    queryFn: async () => {
      let query = supabase.from("subscriptions").select("*, profile:profiles!inner(email,nome)").order("created_at", { ascending: false }).limit(200);
      if (status !== "all") query = query.eq("status", status);
      const { data } = await query;
      return data ?? [];
    },
  });
  const list = q.data ?? [];

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex justify-end">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="canceled">Canceladas</SelectItem>
            <SelectItem value="overdue">Em atraso</SelectItem>
            <SelectItem value="trialing">Trial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase text-muted-foreground border-b border-border/60">
              <th className="p-3">Usuário</th><th className="p-3">Plano</th><th className="p-3">Status</th>
              <th className="p-3">Valor</th><th className="p-3">Ciclo</th><th className="p-3">Próx. cobrança</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s: any) => (
              <tr key={s.id} className="border-b border-border/40 hover:bg-muted/20">
                <td className="p-3">
                  <div className="font-medium text-xs">{s.profile?.email ?? s.user_id}</div>
                </td>
                <td className="p-3"><Badge variant="outline">{s.plano}</Badge></td>
                <td className="p-3 capitalize">{s.status}</td>
                <td className="p-3">{s.amount ? formatBRL(Number(s.amount)) : "—"}</td>
                <td className="p-3">{s.billing_cycle ?? "—"}</td>
                <td className="p-3">{s.next_due_date ? new Date(s.next_due_date).toLocaleDateString("pt-BR") : "—"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem assinaturas.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
