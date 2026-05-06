import { Switch, Route, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "./lib/queryClient";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch as UiSwitch } from "@/components/ui/switch";
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
import AguardandoAprovacaoPage from "@/pages/aguardando-aprovacao";
import ConvitePage from "@/pages/convite";
import AdesaoPage from "@/pages/adesao";
import AvaliarAuraCandidatoPage from "@/pages/avaliar-aura-candidato";
import PagamentoPage from "@/pages/pagamento";
import PagamentoSucessoPage from "@/pages/pagamento-sucesso";
import { useAuth } from "@/hooks/use-auth";
import { Briefcase, Loader2, LogOut, MapPin, Navigation, Save, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface OnboardingMembro {
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  latitude?: string | null;
  longitude?: string | null;
  empresa?: string;
  cargo?: string;
  especialidade_livre?: string;
  na_vitrine?: boolean;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    municipality?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

function PerfilLocationPickerModal({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (data: { localizacao: string; cidade: string; estado: string; pais: string; latitude: string; longitude: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [selected, setSelected] = useState<NominatimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setSelected(null);
      setError("");
    }
  }, [open]);

  async function handleSearch() {
    if (!search.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setSelected(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=8&addressdetails=1&accept-language=pt-BR,pt`;
      const response = await fetch(url, { headers: { "Accept-Language": "pt-BR,pt;q=0.9" } });
      if (!response.ok) throw new Error();
      const data: NominatimResult[] = await response.json();
      if (data.length === 0) setError("Nenhum resultado encontrado. Tente outro termo.");
      setResults(data);
    } catch {
      setError("Falha ao buscar localização.");
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!selected) return;
    const addr = selected.address || {};
    const cidade = addr.city || addr.town || addr.municipality || addr.village || "";
    const estado = addr.state || "";
    const pais = addr.country || "";
    onSelect({
      localizacao: selected.display_name,
      cidade,
      estado,
      pais,
      latitude: selected.lat,
      longitude: selected.lon,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-brand-gold" />
            Selecionar localização
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Busque cidade, país ou endereço para preencher seu perfil.</p>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            onKeyDown={event => event.key === "Enter" && handleSearch()}
            placeholder="Ex: Tokyo, São Paulo, Vila Velha..."
            data-testid="input-onboarding-location-search"
          />
          <Button type="button" onClick={handleSearch} disabled={loading || !search.trim()} data-testid="btn-onboarding-location-search">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {results.map(result => (
            <button
              key={result.place_id}
              type="button"
              onClick={() => setSelected(result)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${selected?.place_id === result.place_id ? "bg-muted" : ""}`}
            >
              {result.display_name}
            </button>
          ))}
          {error && <p className="px-3 py-2 text-sm text-destructive">{error}</p>}
          {!error && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Digite uma localização para buscar.</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={handleConfirm} disabled={!selected} data-testid="btn-onboarding-location-confirm">
            <MapPin className="h-4 w-4 mr-2" />
            Confirmar localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PerfilOnboardingModal({ membroId }: { membroId?: string | null }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<OnboardingMembro>>({});
  const [completed, setCompleted] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  const { data: membro, isLoading } = useQuery<OnboardingMembro>({
    queryKey: ["/api/membros", membroId],
    queryFn: () => fetch(`/api/membros/${membroId}`).then(r => r.json()),
    enabled: !!membroId,
  });

  useEffect(() => {
    if (membro) setForm(membro);
  }, [membro]);

  const requiredMissing = [membro?.nome, membro?.email, membro?.empresa, membro?.cidade]
    .some(value => !String(value || "").trim());
  const shouldOpen = !!membroId && !completed && !isLoading && !!membro && requiredMissing;

  const salvarMutation = useMutation({
    mutationFn: async (payload: Partial<OnboardingMembro>) => {
      const response = await apiRequest("PATCH", `/api/membros/${membroId}`, payload);
      return response.json().catch(() => null);
    },
    onSuccess: () => {
      setCompleted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Perfil atualizado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao salvar perfil", variant: "destructive" }),
  });

  function setField(field: keyof OnboardingMembro, value: string | boolean) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function handleSave() {
    const required = [
      { field: "nome" as const, label: "Nome" },
      { field: "email" as const, label: "E-mail" },
      { field: "empresa" as const, label: "Empresa" },
      { field: "cidade" as const, label: "Localização" },
    ];
    const missing = required.find(item => !String(form[item.field] || "").trim());
    if (missing) {
      toast({ title: `Preencha o campo: ${missing.label}`, variant: "destructive" });
      return;
    }

    salvarMutation.mutate({
      nome: String(form.nome || "").trim(),
      email: String(form.email || "").trim(),
      telefone: String(form.telefone || "").trim() || null,
      whatsapp: String(form.whatsapp || "").trim() || null,
      empresa: String(form.empresa || "").trim(),
      cargo: String(form.cargo || "").trim() || null,
      cidade: String(form.cidade || "").trim(),
      estado: String(form.estado || "").trim() || null,
      pais: String(form.pais || "").trim() || null,
      latitude: String(form.latitude || "").trim() || null,
      longitude: String(form.longitude || "").trim() || null,
      especialidade_livre: String(form.especialidade_livre || "").trim() || null,
      na_vitrine: !!form.na_vitrine,
    });
  }

  return (
    <Dialog open={shouldOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-xl" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-brand-gold" />
            Complete seu perfil
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Antes de continuar, preencha as informacoes principais. Esses dados tambem alimentam seu card, caso voce escolha aparecer na Vitrine.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome || ""} onChange={e => setField("nome", e.target.value)} data-testid="input-onboarding-nome" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input type="email" value={form.email || ""} onChange={e => setField("email", e.target.value)} data-testid="input-onboarding-email" />
          </div>
          <div className="space-y-1.5">
            <Label>Empresa *</Label>
            <Input value={form.empresa || ""} onChange={e => setField("empresa", e.target.value)} data-testid="input-onboarding-empresa" />
          </div>
          <div className="space-y-1.5">
            <Label>Cargo</Label>
            <Input value={form.cargo || ""} onChange={e => setField("cargo", e.target.value)} data-testid="input-onboarding-cargo" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Localização *</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 font-normal"
              onClick={() => setLocationPickerOpen(true)}
              data-testid="btn-onboarding-pick-location"
            >
              <Navigation className="h-4 w-4 text-brand-gold" />
              {[form.cidade, form.estado, form.pais].filter(Boolean).join(", ") || "Selecionar no Mapa"}
            </Button>
            {form.latitude && form.longitude && (
              <p className="text-[11px] text-muted-foreground font-mono">
                {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp || ""} onChange={e => setField("whatsapp", e.target.value)} data-testid="input-onboarding-whatsapp" />
          </div>
          <div className="space-y-1.5">
            <Label>Especialidade</Label>
            <Input value={form.especialidade_livre || ""} onChange={e => setField("especialidade_livre", e.target.value)} data-testid="input-onboarding-especialidade" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Aparecer na Vitrine</p>
            <p className="text-xs text-muted-foreground">Usar os dados do perfil no seu card publico.</p>
          </div>
          <UiSwitch
            checked={!!form.na_vitrine}
            onCheckedChange={checked => setField("na_vitrine", checked)}
            data-testid="switch-onboarding-na-vitrine"
          />
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={salvarMutation.isPending} className="gap-2" data-testid="btn-salvar-onboarding-perfil">
            {salvarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar perfil
          </Button>
        </DialogFooter>
      </DialogContent>
      <PerfilLocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={(data) => setForm(current => ({
          ...current,
          cidade: data.cidade || data.localizacao,
          estado: data.estado,
          pais: data.pais,
          latitude: data.latitude,
          longitude: data.longitude,
        }))}
      />
    </Dialog>
  );
}

function TermsRedirect({ token }: { token: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(`/adesao/${token}`); }, [token]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001D34]">
      <div className="w-8 h-8 border-2 border-[#D7BB7D]/30 border-t-[#D7BB7D] rounded-full animate-spin" />
    </div>
  );
}

function ProtectedApp() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
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

  // Block pending vitrine users — route based on their current stage
  if (user?.pending_vitrine) {
    const convitePendente = user.convite_pendente ?? null;
    if (convitePendente?.token && ["termos_pendentes", "termos_aceitos", "aguardando_avaliacao_aura"].includes(convitePendente.status)) {
      return <TermsRedirect token={convitePendente.token} />;
    }
    return <AguardandoAprovacaoPage />;
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
        <PerfilOnboardingModal membroId={user?.membro_directus_id} />
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
              <Route path="/aguardando-aprovacao" component={AguardandoAprovacaoPage} />
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
        <Switch>
          <Route path="/convite/:token" component={ConvitePage} />
          <Route path="/adesao/:token" component={AdesaoPage} />
          <Route path="/avaliar-aura/:token" component={AvaliarAuraCandidatoPage} />
          <Route path="/pagamento/sucesso" component={PagamentoSucessoPage} />
          <Route path="/pagamento/:token" component={PagamentoPage} />
          <Route component={ProtectedApp} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
