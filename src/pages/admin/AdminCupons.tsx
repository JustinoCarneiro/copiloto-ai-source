import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminCupons() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ codigo: "", desconto_pct: "10", validade: "", uso_max: "" });

  const q = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => (await (supabase as any).from("coupons").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        codigo: form.codigo.trim().toUpperCase(),
        desconto_pct: Number(form.desconto_pct),
        validade: form.validade || null,
        uso_max: form.uso_max ? Number(form.uso_max) : null,
      };
      const { error } = await (supabase as any).from("coupons").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cupom criado"); setForm({ codigo: "", desconto_pct: "10", validade: "", uso_max: "" }); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (c: any) => {
      const { error } = await (supabase as any).from("coupons").update({ ativo: !c.ativo }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Novo cupom</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div><Label className="text-xs">Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="PROMO10" /></div>
          <div><Label className="text-xs">Desconto (%)</Label><Input type="number" value={form.desconto_pct} onChange={(e) => setForm({ ...form, desconto_pct: e.target.value })} /></div>
          <div><Label className="text-xs">Validade</Label><Input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} /></div>
          <div><Label className="text-xs">Uso máximo</Label><Input type="number" value={form.uso_max} onChange={(e) => setForm({ ...form, uso_max: e.target.value })} placeholder="ilimitado" /></div>
        </div>
        <Button onClick={() => create.mutate()} disabled={!form.codigo || create.isPending}><Plus className="size-4" /> Criar</Button>
      </Card>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-left text-[11px] uppercase text-muted-foreground border-b border-border/60"><th className="p-2">Código</th><th className="p-2">Desconto</th><th className="p-2">Validade</th><th className="p-2">Uso</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead>
            <tbody>
              {(q.data ?? []).map((c: any) => (
                <tr key={c.id} className="border-b border-border/40">
                  <td className="p-2 font-mono">{c.codigo}</td>
                  <td className="p-2">{c.desconto_pct}%</td>
                  <td className="p-2">{c.validade ?? "—"}</td>
                  <td className="p-2">{c.usos}{c.uso_max ? `/${c.uso_max}` : ""}</td>
                  <td className="p-2"><Badge variant="outline" className={c.ativo ? "border-success/40 text-success" : "text-muted-foreground"} onClick={() => toggle.mutate(c)} style={{ cursor: "pointer" }}>{c.ativo ? "Ativo" : "Inativo"}</Badge></td>
                  <td className="p-2 text-right"><Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(c.id)}><Trash2 className="size-3" /></Button></td>
                </tr>
              ))}
              {(q.data ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum cupom.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
