import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { InstallButton } from "@/components/InstallButton";
import { validatePassword } from "@/lib/password";
import { Checkbox } from "@/components/ui/checkbox";

const Auth = () => {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signInWithEmail(email, password);
    setBusy(false);
    if (error) toast.error("Não foi possível entrar", { description: error });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error("Aceite os termos para continuar", { description: "Marque a caixa de aceite dos Termos de Uso e da Política de Privacidade." });
      return;
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      toast.error("Senha fraca", { description: pwdCheck.reason });
      return;
    }
    setBusy(true);
    const { error } = await signUpWithEmail(email, password, nome || email.split("@")[0]);
    setBusy(false);
    if (error) toast.error("Não foi possível criar conta", { description: error });
    else toast.success("Conta criada!", { description: "Você já pode entrar." });
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error("Erro ao entrar com Google");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-dark">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 animate-float-up">
          <Logo size="xl" />
          <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Seu copiloto financeiro</p>
        </div>

        <Card className="gradient-card border-border/60 shadow-elevated p-7 animate-scale-in">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid grid-cols-2 w-full bg-muted/40 mb-5">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="le">Email</Label>
                  <Input id="le" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp">Senha</Label>
                  <Input id="lp" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sn">Nome</Label>
                  <Input id="sn" required value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="se">Email</Label>
                  <Input id="se" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sp">Senha</Label>
                  <Input id="sp" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres, com letra e número" />
                </div>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(v === true)} className="mt-0.5" />
                  <span>
                    Li e aceito os{" "}
                    <Link to="/termos" target="_blank" className="text-primary underline">Termos de Uso</Link>
                    {" "}e a{" "}
                    <Link to="/privacidade" target="_blank" className="text-primary underline">Política de Privacidade</Link>.
                  </span>
                </label>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground tracking-widest">ou</span>
            </div>
          </div>

          <Button type="button" variant="neon" size="lg" className="w-full" onClick={handleGoogle} disabled={busy}>
            <svg className="size-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.18v2.97h5.27c-.23 1.43-1.7 4.18-5.27 4.18-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.8 0 3.01.77 3.7 1.42l2.53-2.44C16.84 3.94 14.78 3 12.17 3 7.07 3 3 7.07 3 12.18c0 5.1 4.07 9.17 9.17 9.17 5.3 0 8.81-3.72 8.81-8.96 0-.6-.07-1.06-.16-1.29z"/></svg>
            Entrar com Google
          </Button>
        </Card>

        <div className="mt-6 flex justify-center">
          <InstallButton variant="outline" />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4 tracking-wider">
          Acelere suas decisões financeiras com IA.
        </p>
      </div>
    </div>
  );
};

export default Auth;
