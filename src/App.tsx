import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { CopilotoFAB } from "@/components/CopilotoFAB";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Historico from "./pages/Historico";
import Categorias from "./pages/Categorias";
import Cartoes from "./pages/Cartoes";
import Metas from "./pages/Metas";
import Contas from "./pages/Contas";
import Perfil from "./pages/Perfil";
import ChatIA from "./pages/ChatIA";
import HistoricoIA from "./pages/HistoricoIA";
import Relatorios from "./pages/Relatorios";
import Planos from "./pages/Planos";
import Assinatura from "./pages/Assinatura";
import AdminLayout from "./pages/admin/AdminLayout";
import DashboardExec from "./pages/admin/DashboardExec";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import AdminAssinaturas from "./pages/admin/AdminAssinaturas";
import AdminFinanceiro from "./pages/admin/AdminFinanceiro";
import AdminGateway from "./pages/admin/AdminGateway";
import AdminIA from "./pages/admin/AdminIA";
import AdminRelatorios from "./pages/admin/AdminRelatorios";
import AdminCupons from "./pages/admin/AdminCupons";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminConfig from "./pages/admin/AdminConfig";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppShell>
      {children}
      <CopilotoFAB />
    </AppShell>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Shell><Dashboard /></Shell>} />
            <Route path="/historico" element={<Shell><Historico /></Shell>} />
            <Route path="/contas" element={<Shell><Contas /></Shell>} />
            <Route path="/relatorios" element={<Shell><Relatorios /></Shell>} />
            <Route path="/categorias" element={<Shell><Categorias /></Shell>} />
            <Route path="/cartoes" element={<Shell><Cartoes /></Shell>} />
            <Route path="/metas" element={<Shell><Metas /></Shell>} />
            <Route path="/ia" element={<Shell><ChatIA /></Shell>} />
            <Route path="/ia/historico" element={<Shell><HistoricoIA /></Shell>} />
            <Route path="/planos" element={<Shell><Planos /></Shell>} />
            <Route path="/assinatura" element={<Shell><Assinatura /></Shell>} />
            <Route path="/admin" element={<Shell><AdminLayout /></Shell>}>
              <Route index element={<DashboardExec />} />
              <Route path="usuarios" element={<AdminUsuarios />} />
              <Route path="assinaturas" element={<AdminAssinaturas />} />
              <Route path="financeiro" element={<AdminFinanceiro />} />
              <Route path="gateway" element={<AdminGateway />} />
              <Route path="ia" element={<AdminIA />} />
              <Route path="relatorios" element={<AdminRelatorios />} />
              <Route path="cupons" element={<AdminCupons />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="config" element={<AdminConfig />} />
            </Route>
            <Route path="/perfil" element={<Shell><Perfil /></Shell>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
