import { NavLink, Outlet } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { Card } from "@/components/ui/card";
import { Shield, LayoutDashboard, Users, CreditCard, DollarSign, Zap, Bot, FileText, Ticket, ScrollText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard },
  { to: "/admin/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/admin/gateway", label: "Gateway", icon: Zap },
  { to: "/admin/ia", label: "IA", icon: Bot },
  { to: "/admin/relatorios", label: "Relatórios", icon: FileText },
  { to: "/admin/cupons", label: "Cupons", icon: Ticket },
  { to: "/admin/logs", label: "Logs", icon: ScrollText },
  { to: "/admin/config", label: "Configurações", icon: Settings },
];

export default function AdminLayout() {
  const { isAdmin, isLoading } = useRole();
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <Shield className="size-10 mx-auto mb-3 text-muted-foreground" />
        <h2 className="font-display text-xl font-bold mb-1">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-primary flex items-center gap-2">
          <Shield className="size-3" /> Super Admin
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Painel administrativo</h1>
      </header>

      <nav className="flex gap-1 overflow-x-auto scrollbar-thin pb-1 border-b border-border/60">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-all shrink-0",
                isActive ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )
            }
          >
            <it.icon className="size-3.5 md:size-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
