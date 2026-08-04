import { NavLink, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LayoutDashboard, History, Tags, CreditCard, PiggyBank, User, LogOut, Wallet, Sparkles, BarChart3, Crown, Receipt, Shield, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePremium } from "@/hooks/usePremium";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/contas", label: "Contas", icon: Wallet },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/categorias", label: "Categorias", icon: Tags },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/metas", label: "Cofrinhos", icon: PiggyBank },
  { to: "/assinatura", label: "Minha Assinatura", icon: Receipt },
  { to: "/perfil", label: "Perfil", icon: User },
];

const mobileItems = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/contas", label: "Contas", icon: Wallet },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/perfil", label: "Perfil", icon: User },
];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const { isPro, trialActive, trialDaysLeft, plano } = usePremium();
  const { isAdmin } = useIsAdmin();
  const navItems = isAdmin ? [...items, { to: "/admin", label: "Admin", icon: Shield }] : items;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:flex-col w-64 border-r border-border/60 bg-sidebar/80 backdrop-blur-xl sticky top-0 h-screen p-5">
        <Link to="/" className="flex items-center justify-center mb-6 group">
          <Logo size="xl" />
        </Link>

        {/* Plano badge */}
        <Link to="/planos" className="mb-5">
          <div className={cn(
            "rounded-xl border p-3 text-center transition-all",
            isPro
              ? "border-primary/40 bg-primary/10 hover:bg-primary/15"
              : "border-border bg-muted/30 hover:border-primary/40"
          )}>
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Crown className={cn("size-3.5", isPro ? "text-primary" : "text-muted-foreground")} />
              <span className={isPro ? "text-primary" : "text-muted-foreground"}>
                {plano === "premium" ? "Premium" : trialActive ? "Trial Premium" : "Plano Free"}
              </span>
            </div>
            {trialActive && (
              <p className="text-[10px] text-muted-foreground mt-1">{trialDaysLeft}d restantes · ver planos</p>
            )}
            {!isPro && plano === "free" && (
              <p className="text-[10px] text-muted-foreground mt-1">Fazer upgrade →</p>
            )}
          </div>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_16px_hsl(24_100%_50%/0.15)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 pt-4 border-t border-border/60">
          <Link to="/ia">
            <Button variant="hero" size="default" className="w-full justify-start">
              <Sparkles className="size-4" /> Copiloto IA
            </Button>
          </Link>
          <Button variant="ghost" size="default" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="size-4" /> Sair
          </Button>
          <p className="text-[10px] text-muted-foreground/70 px-2 truncate">{user?.email}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar border-r border-border/60">
              <div className="flex flex-col h-full p-5">
                <Link to="/" className="flex items-center justify-center mb-6">
                  <Logo size="lg" />
                </Link>
                <Link to="/planos" className="mb-5">
                  <div className={cn(
                    "rounded-xl border p-3 text-center transition-all",
                    isPro ? "border-primary/40 bg-primary/10" : "border-border bg-muted/30"
                  )}>
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                      <Crown className={cn("size-3.5", isPro ? "text-primary" : "text-muted-foreground")} />
                      <span className={isPro ? "text-primary" : "text-muted-foreground"}>
                        {plano === "premium" ? "Premium" : trialActive ? "Trial Premium" : "Plano Free"}
                      </span>
                    </div>
                    {trialActive && (
                      <p className="text-[10px] text-muted-foreground mt-1">{trialDaysLeft}d restantes · ver planos</p>
                    )}
                    {!isPro && plano === "free" && (
                      <p className="text-[10px] text-muted-foreground mt-1">Fazer upgrade →</p>
                    )}
                  </div>
                </Link>
                <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
                  {navItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === "/"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                          isActive
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )
                      }
                    >
                      <Icon className="size-4" />
                      {label}
                    </NavLink>
                  ))}
                </nav>
                <div className="space-y-2 pt-4 border-t border-border/60">
                  <Link to="/ia" onClick={() => setMenuOpen(false)}>
                    <Button variant="hero" size="default" className="w-full justify-start">
                      <Sparkles className="size-4" /> Copiloto IA
                    </Button>
                  </Link>
                  <Button variant="ghost" size="default" className="w-full justify-start text-muted-foreground" onClick={signOut}>
                    <LogOut className="size-4" /> Sair
                  </Button>
                  <p className="text-[10px] text-muted-foreground/70 px-2 truncate">{user?.email}</p>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {trialActive && (
            <Link to="/planos">
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                Trial {trialDaysLeft}d
              </Badge>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="size-4" /></Button>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in" key={location.pathname}>
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-xl border-t border-border/60 px-2 py-2 grid grid-cols-5 gap-1">
        {mobileItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-1.5 rounded-lg text-[10px] transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
