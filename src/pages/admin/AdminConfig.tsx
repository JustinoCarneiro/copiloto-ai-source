import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminConfig() {
  const q = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => (await (supabase as any).from("app_settings").select("*")).data ?? [],
  });

  const [settings, setSettings] = useState<Record<string, string>>({});
  useEffect(() => {
    const map: Record<string, string> = {};
    (q.data ?? []).forEach((s: any) => { map[s.key] = typeof s.value === "object" ? JSON.stringify(s.value) : String(s.value); });
    setSettings(map);
  }, [q.data]);

  const save = async (key: string) => {
    let value: any = settings[key];
    try { value = JSON.parse(value); } catch { /* keep string */ }
    const { error } = await (supabase as any).from("app_settings").upsert({ key, value }, { onConflict: "key" });
    if (error) toast.error(error.message); else toast.success("Salvo");
  };

  const keys = Object.keys(settings).length ? Object.keys(settings) : ["ia_daily_limit_free", "ia_daily_limit_premium", "trial_dias"];

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold">Configurações globais</h3>
      <div className="space-y-3">
        {keys.map((k) => (
          <div key={k} className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">{k}</Label>
              <Input value={settings[k] ?? ""} onChange={(e) => setSettings({ ...settings, [k]: e.target.value })} placeholder="valor (JSON aceito)" />
            </div>
            <Button size="sm" onClick={() => save(k)}>Salvar</Button>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-border/40">
        <Label className="text-xs">Nova chave</Label>
        <div className="flex gap-2 mt-1">
          <Input placeholder="chave" onKeyDown={(e) => { if (e.key === "Enter") { const k = (e.target as HTMLInputElement).value.trim(); if (k) { setSettings({ ...settings, [k]: "" }); (e.target as HTMLInputElement).value = ""; } } }} />
        </div>
      </div>
    </Card>
  );
}
