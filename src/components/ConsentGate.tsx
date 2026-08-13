import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Cobre tanto contas novas (cadastro por e-mail sem passar pelo checkbox por algum motivo, ou
// login via Google — que não passa pelo form de cadastro) quanto contas já existentes antes desta
// mudança: qualquer usuário autenticado com profiles.terms_accepted_at nulo vê este bloqueio antes
// de acessar o resto do app, e o aceite fica registrado com timestamp real.
export const ConsentGate = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-consent", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("terms_accepted_at").eq("user_id", user!.id).single()).data,
    enabled: !!user,
  });

  if (!user || isLoading) return <>{children}</>;

  const needsConsent = !profile?.terms_accepted_at;
  if (!needsConsent) return <>{children}</>;

  const accept = async () => {
    setBusy(true);
    await supabase.from("profiles").update({ terms_accepted_at: new Date().toISOString() }).eq("user_id", user.id);
    await qc.invalidateQueries({ queryKey: ["profile-consent"] });
    setBusy(false);
  };

  return (
    <>
      <Dialog open>
        <DialogContent className="[&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Antes de continuar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Atualizamos nossos Termos de Uso e Política de Privacidade. Pra continuar usando o
            Copiloto AI, confirme que leu e concorda com eles.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
            <span>
              Li e aceito os{" "}
              <Link to="/termos" target="_blank" className="text-primary underline">Termos de Uso</Link>
              {" "}e a{" "}
              <Link to="/privacidade" target="_blank" className="text-primary underline">Política de Privacidade</Link>.
            </span>
          </label>
          <DialogFooter>
            <Button variant="hero" disabled={!checked || busy} onClick={accept}>
              {busy ? <Loader2 className="animate-spin" /> : "Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
