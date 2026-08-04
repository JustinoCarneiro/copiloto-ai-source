import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export default function AdminLogs() {
  const q = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => (await (supabase as any).from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const logs = q.data ?? [];
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">Logs administrativos</h3>
      <div className="space-y-1">
        {logs.map((l: any) => (
          <div key={l.id} className="text-xs border-b border-border/40 py-1.5">
            <div className="flex justify-between">
              <span className="font-medium">{l.action}</span>
              <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div className="text-muted-foreground">
              admin: {l.admin_id} · alvo: {l.target_user_id ?? "—"}
            </div>
            {l.payload && Object.keys(l.payload).length > 0 && (
              <pre className="text-[10px] mt-1 bg-muted/20 p-1 rounded overflow-x-auto">{JSON.stringify(l.payload)}</pre>
            )}
          </div>
        ))}
        {logs.length === 0 && <p className="text-sm text-muted-foreground">Sem logs.</p>}
      </div>
    </Card>
  );
}
