import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Perfil = () => {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwd, setPwd] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("user_id", user!.id).single()).data,
    enabled: !!user,
  });

  useEffect(() => { if (profile?.nome) setNome(profile.nome); }, [profile]);

  const saveName = async () => {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ nome }).eq("user_id", user!.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Atualizado!"); qc.invalidateQueries({queryKey:["profile"]}); }
  };

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Senha alterada"); setPwd(""); }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-1">Conta</p>
        <h1 className="font-display text-3xl font-bold">Perfil</h1>
      </header>

      <Card className="gradient-card border-border p-6 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-20 border-2 border-primary/40 shadow-glow-sm">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary font-display text-2xl">
              {(profile?.nome ?? user?.email ?? "U").slice(0,1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-display font-bold text-xl truncate">{profile?.nome || "—"}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={e=>setNome(e.target.value)} /></div>
          <Button variant="hero" onClick={saveName} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Salvar"}</Button>
        </div>
      </Card>

      <Card className="gradient-card border-border p-6 space-y-3">
        <h2 className="font-display font-bold">Alterar senha</h2>
        <form onSubmit={changePwd} className="space-y-3">
          <Input type="password" minLength={6} required value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Nova senha" />
          <Button type="submit" variant="neon" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Atualizar senha"}</Button>
        </form>
      </Card>

      <Card className="gradient-card border-destructive/30 p-6">
        <h2 className="font-display font-bold mb-2">Sair</h2>
        <Button variant="outline" onClick={signOut}>Encerrar sessão</Button>
      </Card>
    </div>
  );
};

export default Perfil;
