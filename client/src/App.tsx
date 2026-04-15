import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import OportunidadesPage from "@/pages/oportunidades";
import BiasPage from "@/pages/bias";
import BiaDetalhePage from "@/pages/bia-detalhe";
import OpaDetalhePage from "@/pages/opa-detalhe";
import MembrosPage from "@/pages/membros";
import AuraPage from "@/pages/aura";
import PainelPage from "@/pages/painel";
import AdminPage from "@/pages/admin";
import BiasCalculadoraPage from "@/pages/bias-calculadora";
import FluxoCaixaPage from "@/pages/fluxo-caixa";
import MeuPerfilPage from "@/pages/meu-perfil";
import DocumentacaoPage from "@/pages/documentacao";
import ResultadosPage from "@/pages/resultados";
import DiretoriaAliancaPage from "@/pages/diretoria-alianca";
import NucleoTecnicoPage from "@/pages/nucleo-tecnico";
import NucleoObraPage from "@/pages/nucleo-obra";
import NucleoComercialPage from "@/pages/nucleo-comercial";
import NucleoCapitalPage from "@/pages/nucleo-capital";
import VitrinePage from "@/pages/vitrine";
import VitrineDetalhePage from "@/pages/vitrine-detalhe";
import AreMembroPage from "@/pages/area-membros";
import MembroDetalhePage from "@/pages/membro-detalhe";
import ComunidadePage from "@/pages/comunidade";
import ComunidadeDetalhePage from "@/pages/comunidade-detalhe";
import BuiltCapitalPage from "@/pages/built-capital";
import LoginPage from "@/pages/login";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function ProtectedApp() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#001D34]">
        <div className="w-8 h-8 border-2 border-[#D7BB7D]/30 border-t-[#D7BB7D] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  async function handleLogout() {
    try {
      await logout();
      navigate("/");
    } catch {
      toast({ title: "Erro ao sair", variant: "destructive" });
    }
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center gap-2 p-3 border-b border-border bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{user?.nome || user?.username}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Switch>
              <Route path="/" component={PainelPage} />
              <Route path="/bias/:id" component={BiaDetalhePage} />
              <Route path="/bias" component={BiasPage} />
              <Route path="/opas/:id" component={OpaDetalhePage} />
              <Route path="/opas" component={OportunidadesPage} />
              <Route path="/bias-calculadora" component={BiasCalculadoraPage} />
              <Route path="/fluxo-caixa" component={FluxoCaixaPage} />
              <Route path="/resultados" component={ResultadosPage} />
              <Route path="/diretoria-alianca" component={DiretoriaAliancaPage} />
              <Route path="/nucleo-tecnico" component={NucleoTecnicoPage} />
              <Route path="/nucleo-obra" component={NucleoObraPage} />
              <Route path="/nucleo-comercial" component={NucleoComercialPage} />
              <Route path="/nucleo-capital" component={NucleoCapitalPage} />
              <Route path="/vitrine/:id" component={VitrineDetalhePage} />
              <Route path="/vitrine" component={VitrinePage} />
              <Route path="/area-membros" component={AreMembroPage} />
              <Route path="/membro/:id" component={MembroDetalhePage} />
              <Route path="/comunidade/:id" component={ComunidadeDetalhePage} />
              <Route path="/comunidade" component={ComunidadePage} />
              <Route path="/built-capital" component={BuiltCapitalPage} />
              <Route path="/membros" component={MembrosPage} />
              <Route path="/aura" component={AuraPage} />
              <Route path="/painel" component={PainelPage} />
              <Route path="/meu-perfil" component={MeuPerfilPage} />
              <Route path="/documentacao" component={DocumentacaoPage} />
              <Route path="/admin" component={AdminPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ProtectedApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
