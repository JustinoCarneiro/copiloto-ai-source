import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminRelatorios() {
  const usuarios = useQuery({
    queryKey: ["rep-usuarios"],
    queryFn: async () => (await supabase.from("profiles").select("nome,email,blocked,created_at")).data ?? [],
  });
  const receita = useQuery({
    queryKey: ["rep-receita"],
    queryFn: async () => (await supabase.from("payment_logs").select("user_id,gateway,event,status,amount,created_at").eq("status", "active")).data ?? [],
  });

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Usuários</h3>
        <p className="text-sm text-muted-foreground">{usuarios.data?.length ?? 0} registros</p>
        <Button onClick={() => download("usuarios.csv", toCSV(usuarios.data ?? []))}><Download className="size-4" /> Exportar CSV</Button>
      </Card>
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Receita</h3>
        <p className="text-sm text-muted-foreground">{receita.data?.length ?? 0} pagamentos confirmados</p>
        <Button onClick={() => download("receita.csv", toCSV(receita.data ?? []))}><Download className="size-4" /> Exportar CSV</Button>
      </Card>
    </div>
  );
}
