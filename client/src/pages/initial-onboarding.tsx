import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContributionAreaSelector } from "@/components/contribution-area-selector";
import { ProfileActivityFields } from "@/components/profile-activity-fields";
import {
  onboardingAcceptanceUrl,
  onboardingReadyDestinationFromSearch,
  onboardingReadyDestinationHref,
  type OnboardingReadyDestination,
} from "@/lib/onboarding-ready-actions";
import { buildOnboardingConfigurationSummary } from "@/lib/onboarding-summary";
import { captureRequiredAcceptanceLocation } from "@/lib/acceptanceLocation";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, BellRing, BriefcaseBusiness, Building2, ChartNoAxesCombined,
  Check, CheckCircle2, ChevronDown, Circle, Globe2, Home, Info, Landmark, Loader2,
  LockKeyhole, Mail, MapPin, MessageSquareText, Network, ShieldCheck, Sparkles,
  Upload, UserRound,
} from "lucide-react";
import {
  INITIAL_ONBOARDING_NOTIFICATION_PREFERENCES,
  INITIAL_ONBOARDING_LOCATION_NOTICE,
  INITIAL_ONBOARDING_OBJECTIVE_COPY,
  INITIAL_ONBOARDING_OBJECTIVES,
  INITIAL_ONBOARDING_PURPOSE_TONES,
  INITIAL_ONBOARDING_READY_ACTION_TONES,
  INITIAL_ONBOARDING_STEPS,
  canAccessOnboardingStep,
  getInitialOnboardingSteps,
  getInitialOnboardingVisibleStepNumber,
  shouldOfferOnboardingCpf,
  type InitialOnboardingStep,
} from "@shared/initial-onboarding";
import builtLogo from "@assets/Logo_Built_3_Horizontal_Negativo.png";

type JourneyResponse = Record<string, any>;
type OnboardingData = {
  required: boolean;
  journey: { id?: string; flow_version?: number; current_step: InitialOnboardingStep; completed_steps: string[]; responses: JourneyResponse; status: string; start_destination?: string; updated_at?: string };
  next_url: string;
  profile: { nome?: string; email?: string };
  comunidade?: { nome?: string; territorio?: string; pais?: string } | null;
  recommendations?: Array<{ id: string; nome: string; descricao: string; foto?: string | null }>;
  terms?: Array<{ key: string; titulo: string; versao: string; origem: string; body: string }>;
};

const VISIBLE_STEPS: Array<{ key: InitialOnboardingStep; label: string; helper: string }> = [
  { key: "personalizacao", label: "Personalização", helper: "Sua jornada" },
  { key: "perfil", label: "Perfil e Validações", helper: "Quem você é" },
  { key: "configuracao", label: "Configuração", helper: "Preferências" },
  { key: "conexoes", label: "Conexões", helper: "Sua rede" },
  { key: "pronto", label: "Pronto!", helper: "Seu ambiente" },
];

const PURPOSES = [
  { key: "imoveis", icon: Home, tone: INITIAL_ONBOARDING_PURPOSE_TONES.imoveis, title: "Tenho um imóvel ou identifiquei uma oportunidade", description: "Quero cadastrar, analisar, desenvolver, vender, alugar ou estruturar um ativo." },
  { key: "profissional", icon: BriefcaseBusiness, tone: INITIAL_ONBOARDING_PURPOSE_TONES.profissional, title: "Sou profissional, fornecedor ou empresa", description: "Quero oferecer serviços, participar de demandas e me conectar a oportunidades." },
  { key: "capital", icon: Landmark, tone: INITIAL_ONBOARDING_PURPOSE_TONES.capital, title: "Sou investidor ou parceiro de capital", description: "Quero avaliar oportunidades para investir, coinvestir ou estruturar capital." },
] as const;

const PURPOSE_TONE_STYLES = {
  blue: {
    idle: "border-blue-200 bg-blue-50/20 hover:border-blue-400 hover:bg-blue-50/50",
    selected: "border-blue-500 bg-blue-50 ring-1 ring-blue-100",
    icon: "bg-blue-100 text-blue-600",
    check: "text-blue-600",
  },
  emerald: {
    idle: "border-emerald-200 bg-emerald-50/20 hover:border-emerald-400 hover:bg-emerald-50/50",
    selected: "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-100",
    icon: "bg-emerald-100 text-emerald-600",
    check: "text-emerald-600",
  },
  violet: {
    idle: "border-violet-200 bg-violet-50/20 hover:border-violet-400 hover:bg-violet-50/50",
    selected: "border-violet-500 bg-violet-50 ring-1 ring-violet-100",
    icon: "bg-violet-100 text-violet-600",
    check: "text-violet-600",
  },
} as const;

const READY_ACTION_TONE_STYLES = {
  blue: {
    card: "border-blue-200 bg-gradient-to-br from-blue-50/90 via-white to-white hover:border-blue-400 hover:shadow-blue-100/80",
    icon: "bg-blue-100 text-blue-700 ring-blue-200",
    title: "text-blue-950",
    button: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white",
  },
  emerald: {
    card: "border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-white hover:border-emerald-400 hover:shadow-emerald-100/80",
    icon: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    title: "text-emerald-950",
    button: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white",
  },
  violet: {
    card: "border-violet-200 bg-gradient-to-br from-violet-50/90 via-white to-white hover:border-violet-400 hover:shadow-violet-100/80",
    icon: "bg-violet-100 text-violet-700 ring-violet-200",
    title: "text-violet-950",
    button: "border-violet-600 bg-violet-600 text-white hover:bg-violet-700 hover:text-white",
  },
  cyan: {
    card: "border-cyan-200 bg-gradient-to-br from-cyan-50/90 via-white to-white hover:border-cyan-400 hover:shadow-cyan-100/80",
    icon: "bg-cyan-100 text-cyan-700 ring-cyan-200",
    title: "text-cyan-950",
    button: "border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700 hover:text-white",
  },
} as const;

const OBJECTIVES: Record<string, readonly string[]> = INITIAL_ONBOARDING_OBJECTIVES;

function pathStep(path: string): InitialOnboardingStep {
  const value = path.split("/onboarding/")[1]?.split(/[?#]/)[0];
  return INITIAL_ONBOARDING_STEPS.includes(value as InitialOnboardingStep) ? value as InitialOnboardingStep : "personalizacao";
}

function toggleList(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function InitialOnboardingPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const step = pathStep(location);
  const { data, isLoading, refetch } = useQuery<OnboardingData>({
    queryKey: ["/api/onboarding"],
    queryFn: async () => {
      const response = await fetch("/api/onboarding", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Não foi possível carregar o onboarding.");
      return response.json();
    },
    staleTime: 0,
  });
  const [forms, setForms] = useState<JourneyResponse>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState<Record<string, boolean>>({});
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const flowVersion = Number(data?.journey?.flow_version || 1);
  const onboardingSteps = getInitialOnboardingSteps(flowVersion);
  const acceptsBeforeOnboarding = flowVersion >= 2;

  useEffect(() => {
    if (!data?.journey) return;
    setForms({
      ...(data.journey.responses || {}),
      configuracao: { visibility: "private", ...((data.journey.responses || {}).configuracao || {}) },
      conexoes: { connections: true, opportunities: true, capital: true, messages: true, ...((data.journey.responses || {}).conexoes || {}) },
    });
    if (data.required && data.next_url && !canAccessOnboardingStep(data.journey.current_step, step, data.journey.flow_version)) {
      navigate(data.next_url);
    }
  }, [data?.journey?.updated_at, data?.journey?.current_step]);

  const purposes: string[] = forms.personalizacao?.purposes || [];
  const updateStep = (key: string, value: any) => setForms((current: any) => ({
    ...current,
    [step]: { ...(current[step] || {}), [key]: value },
  }));

  useEffect(() => {
    if (!data?.journey || step === "aceites" || !forms[step]) return;
    const timer = window.setTimeout(() => {
      fetch(`/api/onboarding/etapas/${step}?draft=1`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forms[step]),
      }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [forms[step], step, data?.journey?.id]);

  const saveMutation = useMutation({
    mutationFn: async (_options?: { destination?: OnboardingReadyDestination }) => {
      const response = await apiRequest("PUT", `/api/onboarding/etapas/${step}`, forms[step] || {});
      return response.json();
    },
    onSuccess: async (result, options) => {
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      if (result.redirect_url) {
        navigate(onboardingReadyDestinationHref(options?.destination) || result.redirect_url || "/");
      } else {
        navigate(options?.destination ? onboardingAcceptanceUrl(options.destination) : result.next_url);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: any) => toast({ title: "Revise esta etapa", description: error.message, variant: "destructive" }),
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      const locationEvidence = await captureRequiredAcceptanceLocation();
      const response = await apiRequest("POST", "/api/onboarding/finalizar-aceites", { termos_aceitos: termsAccepted, aceite_localizacao: locationEvidence });
      return response.json();
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      if (result.next_url) {
        navigate(result.next_url);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const selectedDestination = onboardingReadyDestinationFromSearch(window.location.search);
      navigate(onboardingReadyDestinationHref(selectedDestination) || result.redirect_url || "/");
    },
    onError: (error: any) => toast({ title: "Não foi possível concluir", description: error.message, variant: "destructive" }),
  });

  const visibleStepNumber = getInitialOnboardingVisibleStepNumber(step, flowVersion);
  const currentIndex = visibleStepNumber === null ? -1 : visibleStepNumber - 1;
  const completed = new Set(data?.journey?.completed_steps || []);
  const selectedObjectives = forms.personalizacao?.objectives || {};

  const nextDisabled = useMemo(() => {
    if (step === "personalizacao") return purposes.length === 0 || !forms.personalizacao?.start_destination;
    if (step === "perfil" && purposes.includes("profissional")) return !forms.perfil?.professional?.role;
    if (step === "configuracao") return !forms.configuracao?.visibility;
    return false;
  }, [forms, purposes, step]);

  if (isLoading || !data) return <div className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>;

  const goBack = () => {
    const index = onboardingSteps.indexOf(step);
    if (index <= 0) return;
    navigate(`/onboarding/${onboardingSteps[index - 1]}`);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-[#001D34] md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen bg-[#001D34] px-5 py-6 text-white md:flex md:flex-col">
        <img src={builtLogo} alt="BUILT Alliances" className="h-16 w-auto max-w-[180px] object-contain object-left" />
        <nav className="mt-10 space-y-2">
          {VISIBLE_STEPS.map((item, index) => {
            const done = completed.has(item.key);
            const active = step === item.key || (step === "aceites" && visibleStepNumber === 5 && item.key === "pronto");
            return <button key={item.key} disabled={!done && index > currentIndex} onClick={() => done && navigate(`/onboarding/${item.key}`)} className={`flex w-full items-start gap-3 rounded-md px-3 py-3 text-left ${active ? "bg-white/10" : "opacity-75"}`}>
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-emerald-500" : active ? "bg-blue-600" : "border border-white/50"}`}>{done ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
              <span><strong className="block text-sm">{item.label}</strong><small className="text-white/60">{item.helper}</small></span>
            </button>;
          })}
        </nav>
        <div className="mt-auto rounded-md border border-white/15 p-3 text-xs text-white/75"><ShieldCheck className="mb-2 h-5 w-5 text-[#D7BB7D]" />Seu progresso fica salvo e seus dados permanecem privados.</div>
      </aside>

      <div className="min-w-0 pb-24 md:pb-20">
        <header className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="md:hidden"><strong>BUILT.</strong><span className="ml-3 text-xs text-slate-500">{visibleStepNumber === null ? "Antes de começar" : `Etapa ${visibleStepNumber} de 5`}</span></div>
            <div className="hidden md:block"><span className="text-sm text-slate-500">Seu onboarding BUILT</span></div>
            <div className="min-w-0 text-right"><strong className="block truncate text-sm">{data.profile?.nome}</strong><small className="block truncate text-slate-500">{data.profile?.email}</small></div>
          </div>
          <div className="mx-auto mt-3 flex max-w-7xl gap-1 md:hidden">{VISIBLE_STEPS.map((item, index) => <span key={item.key} className={`h-1 flex-1 rounded ${index <= currentIndex ? "bg-blue-600" : "bg-slate-200"}`} />)}</div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {!(step === "aceites" && acceptsBeforeOnboarding) && <div className="mb-6 md:hidden"><button className="flex w-full items-center justify-between rounded-md border bg-white p-3 text-sm font-semibold" onClick={() => setSummaryOpen(!summaryOpen)}>Resumo da sua jornada <ChevronDown className={`h-4 w-4 transition ${summaryOpen ? "rotate-180" : ""}`} /></button>{summaryOpen && <JourneySummary purposes={purposes} objectives={selectedObjectives} configuration={forms.configuracao} start={forms.personalizacao?.start_destination} comunidade={data.comunidade} />}</div>}
          <div className={`grid gap-6 ${step === "aceites" && acceptsBeforeOnboarding ? "mx-auto max-w-4xl" : "lg:grid-cols-[minmax(0,1fr)_300px]"}`}>
            <section className="min-w-0">
              {step === "personalizacao" && <Personalization forms={forms} setForms={setForms} purposes={purposes} objectives={selectedObjectives} />}
              {step === "perfil" && <ProfileStep forms={forms} setForms={setForms} purposes={purposes} />}
              {step === "configuracao" && <ConfigurationStep forms={forms} setForms={setForms} purposes={purposes} />}
              {step === "conexoes" && <ConnectionsStep forms={forms} setForms={setForms} data={data} />}
              {step === "pronto" && <ReadyStep forms={forms} data={data} acceptsBeforeOnboarding={acceptsBeforeOnboarding} onSelectDestination={(destination: OnboardingReadyDestination) => saveMutation.mutate({ destination })} pendingDestination={saveMutation.isPending ? saveMutation.variables?.destination : undefined} />}
              {step === "aceites" && <TermsStep terms={data.terms || []} accepted={termsAccepted} setAccepted={setTermsAccepted} active={activeTerm} setActive={setActiveTerm} beforeOnboarding={acceptsBeforeOnboarding} />}
            </section>
            {!(step === "aceites" && acceptsBeforeOnboarding) && <aside className="hidden lg:block"><JourneySummary purposes={purposes} objectives={selectedObjectives} configuration={forms.configuracao} start={forms.personalizacao?.start_destination} comunidade={data.comunidade} /></aside>}
          </div>
        </main>

        <footer className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-4 py-3 backdrop-blur md:left-[220px] md:px-8">
          <div className="mx-auto flex max-w-7xl gap-3"><Button variant="outline" className="h-11 flex-1 md:max-w-48" onClick={goBack} disabled={step === "personalizacao" || (step === "aceites" && acceptsBeforeOnboarding)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>{step === "aceites" ? <Button className="h-11 flex-[2] bg-blue-600 text-white hover:bg-blue-700" disabled={(data.terms || []).some((term) => !termsAccepted[term.key]) || finishMutation.isPending} onClick={() => finishMutation.mutate()}>{finishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{acceptsBeforeOnboarding ? "Aceitar e começar" : "Aceitar e entrar"}<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button className="h-11 flex-[2] bg-blue-600 text-white hover:bg-blue-700" disabled={nextDisabled || saveMutation.isPending} onClick={() => saveMutation.mutate({})}>{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{step === "pronto" ? (acceptsBeforeOnboarding ? "Concluir onboarding e entrar" : "Revisar aceites e entrar") : "Salvar e continuar"}<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
        </footer>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <div className="rounded-md border bg-white p-4 md:p-5"><h2 className="text-base font-bold md:text-lg">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}<div className="mt-5">{children}</div></div>;
}

function Choice({ selected, onClick, icon: Icon, tone, title, description }: any) {
  const styles = PURPOSE_TONE_STYLES[tone as keyof typeof PURPOSE_TONE_STYLES] || PURPOSE_TONE_STYLES.blue;
  return <button type="button" onClick={onClick} className={`relative min-h-32 rounded-md border p-4 text-left transition ${selected ? styles.selected : styles.idle}`}><span className={`mb-3 grid h-10 w-10 place-items-center rounded-md ${styles.icon}`}><Icon className="h-5 w-5" /></span><strong className="block text-sm leading-snug">{title}</strong><span className="mt-2 block text-xs leading-relaxed text-slate-500">{description}</span>{selected && <CheckCircle2 className={`absolute right-3 top-3 h-5 w-5 ${styles.check}`} />}</button>;
}

function Personalization({ forms, setForms, purposes, objectives }: any) {
  const personal = forms.personalizacao || {};
  const set = (patch: any) => setForms((current: any) => ({ ...current, personalizacao: { ...(current.personalizacao || {}), ...patch } }));
  return <div className="space-y-5"><div><h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><span aria-hidden="true">👋</span><span>Vamos personalizar sua experiência</span></h1><p className="mt-2 text-sm text-slate-500">Isso nos ajuda a conectar você com soluções e oportunidades relevantes.</p></div><Panel title="1. Como você quer usar a BUILT?" subtitle="Selecione uma ou mais opções."><div className="grid gap-3 md:grid-cols-3">{PURPOSES.map(({ key, ...item }) => <Choice key={key} {...item} selected={purposes.includes(key)} onClick={() => { const next = toggleList(purposes, key); set({ purposes: next, start_destination: next.length === 1 ? (next[0] === "imoveis" ? "imovel" : next[0]) : personal.start_destination }); }} />)}</div></Panel>{purposes.length > 0 && <Panel title="2. O que você deseja fazer agora?" subtitle="As opções acompanham os perfis selecionados."><div className="grid gap-4 md:grid-cols-3">{purposes.map((purpose: string) => { const copy = INITIAL_ONBOARDING_OBJECTIVE_COPY[purpose as keyof typeof INITIAL_ONBOARDING_OBJECTIVE_COPY]; return <div key={purpose} className="rounded-md bg-slate-50 p-3"><strong className="text-sm">{copy?.title}</strong><p className="mt-1 text-xs text-slate-500">{copy?.question}</p><div className="mt-3 space-y-2">{OBJECTIVES[purpose].map((objective) => <button type="button" key={objective} onClick={() => set({ objectives: { ...objectives, [purpose]: toggleList(objectives[purpose] || [], objective) } })} className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-xs ${objectives[purpose]?.includes(objective) ? "border-blue-500 bg-blue-50 text-blue-700" : "bg-white"}`}>{objectives[purpose]?.includes(objective) ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}{objective}</button>)}</div></div>; })}</div></Panel>}{purposes.length > 1 && <Panel title="3. Por onde você quer começar agora?"><div className="grid gap-3 md:grid-cols-3">{purposes.map((purpose: string) => <button type="button" onClick={() => set({ start_destination: purpose === "imoveis" ? "imovel" : purpose })} key={purpose} className={`rounded-md border p-4 text-left text-sm font-semibold ${personal.start_destination === (purpose === "imoveis" ? "imovel" : purpose) ? "border-blue-500 bg-blue-50" : ""}`}>{purpose === "imoveis" ? "Cadastrar meu primeiro imóvel" : purpose === "profissional" ? "Configurar meu perfil profissional" : "Configurar minha atuação em capital"}</button>)}</div></Panel>}</div>;
}

function OnboardingDocumentUpload({ value, onUploaded }: { value?: any; onUploaded: (file: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const uploadFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("purpose", "comprovante_profissional");
      const response = await fetch("/api/onboarding/upload", { method: "POST", credentials: "include", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar o documento.");
      onUploaded(result.file);
    } catch (uploadError: any) {
      setError(uploadError?.message || "Não foi possível enviar o documento.");
    } finally {
      setUploading(false);
    }
  };
  return <div className="space-y-1.5"><Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" disabled={uploading} onChange={(event) => uploadFile(event.target.files?.[0])} />{uploading ? <small className="flex items-center gap-1 text-blue-700"><Loader2 className="h-3 w-3 animate-spin" />Enviando</small> : value?.file_id ? <small className="text-emerald-700">Enviado: {value.original_name}</small> : <small className="text-amber-700">Pendente</small>}{error && <small className="block text-red-600">{error}</small>}</div>;
}

function ProfileStep({ forms, setForms, purposes }: any) {
  const profile = forms.perfil || {};
  const set = (patch: any) => setForms((current: any) => ({ ...current, perfil: { ...(current.perfil || {}), ...patch } }));
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold md:text-3xl">Perfil e Validações</h1><p className="mt-2 text-sm text-slate-500">Informe o necessário para os recursos que você escolheu.</p></div><Panel title="Resumo das suas escolhas"><div className="flex flex-wrap gap-2">{purposes.map((purpose: string) => <span key={purpose} className="rounded bg-slate-100 px-3 py-2 text-sm">{PURPOSES.find((item) => item.key === purpose)?.title}</span>)}</div></Panel>{purposes.includes("imoveis") && <Panel title="Imóvel ou oportunidade" subtitle="Este perfil já está habilitado."><div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" />Cadastro disponível após os aceites.</div></Panel>}{purposes.includes("profissional") && <Panel title="Profissional, fornecedor ou empresa" subtitle="Os dados ficam como informados ou enviados; não há verificação externa nesta etapa."><div className="grid gap-4 md:grid-cols-2"><div><Label>Empresa</Label><Input value={profile.professional?.empresa || ""} onChange={(e) => set({ professional: { ...(profile.professional || {}), empresa: e.target.value } })} /></div><div><Label>Função profissional *</Label><Input value={profile.professional?.role || ""} onChange={(e) => set({ professional: { ...(profile.professional || {}), role: e.target.value } })} /></div><div><Label>Registro profissional</Label><Input value={profile.professional?.registro || ""} onChange={(e) => set({ professional: { ...(profile.professional || {}), registro: e.target.value } })} /></div><div><Label>Documento comprobatório</Label><OnboardingDocumentUpload value={profile.professional?.document} onUploaded={(document) => set({ professional: { ...(profile.professional || {}), document } })} /></div></div></Panel>}{purposes.includes("capital") && <Panel title="Parceiro de capital" subtitle="Dados adicionais poderão ser solicitados conforme a operação."><div className="grid gap-4 md:grid-cols-2"><div><Label>Tipo de atuação</Label><Select value={profile.capital?.type || ""} onValueChange={(value) => set({ capital: { ...(profile.capital || {}), type: value } })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="pessoa_fisica">Pessoa física</SelectItem><SelectItem value="pessoa_juridica">Pessoa jurídica</SelectItem></SelectContent></Select></div><div><Label>Faixa de interesse</Label><Input value={profile.capital?.range || ""} onChange={(e) => set({ capital: { ...(profile.capital || {}), range: e.target.value } })} placeholder="Ex.: até R$ 500 mil" /></div></div></Panel>}<Panel title="Contato"><div className="grid gap-4 md:grid-cols-2"><div><Label>Telefone</Label><Input value={profile.telefone || ""} onChange={(e) => set({ telefone: e.target.value })} /></div>{shouldOfferOnboardingCpf(purposes) ? <div><Label>CPF</Label><Input value={profile.cpf || ""} onChange={(e) => set({ cpf: e.target.value })} inputMode="numeric" placeholder="000.000.000-00" /></div> : null}</div></Panel></div>;
}

function ConfigurationStep({ forms, setForms, purposes }: any) {
  const config = forms.configuracao || {};
  const set = (patch: any) => setForms((current: any) => ({ ...current, configuracao: { ...(current.configuracao || {}), ...patch } }));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Configuração</h1>
        <p className="mt-2 text-sm text-slate-500">Escolha interesses e privacidade. Nada será publicado automaticamente.</p>
      </div>
      <Panel title="Áreas de Contribuição" subtitle="Selecione as áreas em que você contribui ou tem interesse.">
        <ContributionAreaSelector value={config.areas} onChange={(areas) => set({ areas })} />
      </Panel>
      <Panel title="Áreas de atuação" subtitle="Use a mesma classificação do seu perfil BUILT.">
        <ProfileActivityFields value={config} onChange={set} />
      </Panel>
      <Panel title="Privacidade e visibilidade">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { key: "private", label: "Perfil privado", text: "Visível apenas para você e acessos autorizados." },
            { key: "community", label: "Minha comunidade", text: "Visibilidade restrita à sua comunidade." },
            { key: "network", label: "Rede BUILT", text: "Visível na rede, nunca na Vitrine automaticamente." },
          ].map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => set({ visibility: item.key })}
              className={`rounded-md border p-4 text-left ${(config.visibility || "private") === item.key ? "border-blue-500 bg-blue-50" : ""}`}
            >
              <strong className="text-sm">{item.label}</strong>
              <span className="mt-2 block text-xs text-slate-500">{item.text}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

const CONNECTION_PREFERENCE_ICONS = {
  connections: Mail,
  opportunities: BellRing,
  capital: ChartNoAxesCombined,
  messages: MessageSquareText,
} as const;

const CONNECTION_PREFERENCE_STYLES = {
  blue: { icon: "bg-blue-50 text-blue-600", row: "hover:bg-blue-50/40", toggle: "data-[state=checked]:bg-blue-600" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", row: "hover:bg-emerald-50/40", toggle: "data-[state=checked]:bg-emerald-600" },
  violet: { icon: "bg-violet-50 text-violet-600", row: "hover:bg-violet-50/40", toggle: "data-[state=checked]:bg-violet-600" },
  teal: { icon: "bg-teal-50 text-teal-600", row: "hover:bg-teal-50/40", toggle: "data-[state=checked]:bg-teal-600" },
} as const;

function RecommendationAvatar({ src, name }: { src?: string | null; name?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = String(name || "BUILT").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-violet-100 font-semibold text-blue-700 ring-2 ring-white shadow-sm">{src && !failed ? <img src={src} alt={name ? `Foto de ${name}` : "Foto do perfil"} className="h-full w-full object-cover" onError={() => setFailed(true)} /> : <span aria-label="Avatar sem foto" className="text-xs">{initials || <UserRound className="h-5 w-5" />}</span>}</div>;
}

function ConnectionsStep({ forms, setForms, data }: any) {
  const connection = forms.conexoes || {};
  const recommendations = (data.recommendations || []).slice(0, 5);
  const set = (patch: any) => setForms((current: any) => ({ ...current, conexoes: { ...(current.conexoes || {}), ...patch } }));
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold md:text-3xl">Conexões</h1><p className="mt-2 text-sm text-slate-500">Conheça sua rede. Nenhuma conexão será criada automaticamente.</p></div>
      <Panel title="Sua Rede BUILT">
        <div className="rounded-md bg-blue-50 p-4"><strong>{data.comunidade?.nome || "Comunidade de origem"}</strong><p className="mt-1 text-sm text-slate-600">{[data.comunidade?.territorio, data.comunidade?.pais].filter(Boolean).join(" · ") || "Vínculo preservado pelo convite"}</p></div>
        <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">{["Comunidade", "Regional", "Nacional", "Global", "Vitrine"].map((label) => <div key={label}><span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-slate-100"><Network className="h-4 w-4" /></span>{label}</div>)}</div>
      </Panel>
      <Panel title="Conexões recomendadas" subtitle="Sugestões informativas baseadas no seu perfil e na sua comunidade.">
        {recommendations.length ? <div className="divide-y overflow-hidden rounded-lg border bg-white">{recommendations.map((item: any) => <div key={item.id} className="flex items-center gap-3 p-3 transition hover:bg-slate-50"><RecommendationAvatar src={item.foto} name={item.nome} /><div className="min-w-0"><strong className="block truncate text-sm">{item.nome}</strong><span className="block truncate text-xs text-slate-500">{item.descricao}</span></div><span className="ml-auto hidden items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 sm:flex"><Sparkles className="h-3 w-3" />Recomendado</span></div>)}</div> : <div className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">Novas recomendações aparecerão conforme seu perfil e sua rede forem atualizados.</div>}
      </Panel>
      <Panel title="Como você quer receber atualizações?" subtitle="Escolha os temas que deseja acompanhar na rede BUILT.">
        <div className="divide-y overflow-hidden rounded-lg border bg-white">
          {INITIAL_ONBOARDING_NOTIFICATION_PREFERENCES.map((item) => {
            const Icon = CONNECTION_PREFERENCE_ICONS[item.key];
            const styles = CONNECTION_PREFERENCE_STYLES[item.tone];
            return <label key={item.key} className={`flex cursor-pointer items-center gap-3 p-3 transition sm:p-4 ${styles.row}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${styles.icon}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.label}</strong><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span></span><Switch aria-label={item.label} checked={connection[item.key] !== false} onCheckedChange={(checked) => set({ [item.key]: checked })} className={styles.toggle} /></label>;
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-800"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>Suas escolhas ficam salvas no onboarding. Elas não criam conexões nem publicam seu perfil automaticamente.</span></div>
      </Panel>
    </div>
  );
}

function ReadyStep({ forms, data, acceptsBeforeOnboarding, onSelectDestination, pendingDestination }: any) {
  const purposes = forms.personalizacao?.purposes || [];
  const actionSubtitle = acceptsBeforeOnboarding ? "Escolha para onde deseja ir ao concluir o onboarding." : "Escolha para onde deseja ir após revisar e aceitar os documentos obrigatórios.";
  return <div className="space-y-5"><div><h1 className="text-3xl font-bold">Pronto!</h1><p className="mt-2 text-sm text-slate-500">Seu ambiente inicial está preparado. Conclua para acessar a plataforma.</p></div><Panel title="Seu onboarding foi concluído"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded bg-blue-50 p-4"><small>Perfis selecionados</small><strong className="mt-1 block text-xl">{purposes.length}</strong></div><div className="rounded bg-emerald-50 p-4"><small>Configuração</small><strong className="mt-1 block text-emerald-700">Concluída</strong></div><div className="rounded bg-violet-50 p-4"><small>Comunidade principal</small><strong className="mt-1 block text-sm">{data.comunidade?.nome || "Definida pelo convite"}</strong></div></div></Panel><Panel title="Próximas ações recomendadas" subtitle={actionSubtitle}><div className="grid gap-3 md:grid-cols-2">{purposes.includes("imoveis") && <ReadyAction destination="imovel" icon={Home} title="Cadastrar seu primeiro imóvel" text="Organize o ativo e acompanhe documentos, análises e demandas." actionLabel="Cadastrar imóvel" onSelect={onSelectDestination} pendingDestination={pendingDestination} />}{purposes.includes("profissional") && <ReadyAction destination="profissional" icon={BriefcaseBusiness} title="Completar seu perfil profissional" text="Apresente serviços, especialidades e experiências." actionLabel="Completar perfil" onSelect={onSelectDestination} pendingDestination={pendingDestination} />}{purposes.includes("capital") && <ReadyAction destination="capital" icon={Landmark} title="Configurar sua atuação em capital" text="Acompanhe oportunidades compatíveis com seus interesses." actionLabel="Acessar BUILT Capital" onSelect={onSelectDestination} pendingDestination={pendingDestination} />}<ReadyAction destination="rede" icon={Network} title="Conhecer a rede BUILT" text="Veja pessoas, empresas e alianças recomendadas." actionLabel="Explorar a rede" onSelect={onSelectDestination} pendingDestination={pendingDestination} /></div></Panel><Panel title="Acessos preparados"><div className="grid gap-2 sm:grid-cols-2">{["Ambiente inicial privado", "Agenda e Alertas", "Perfil e configurações", "Recomendações personalizadas"].map((item) => <div key={item} className="flex items-center gap-2 rounded border p-3 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{item}</div>)}</div></Panel></div>;
}

function ReadyAction({ destination, icon: Icon, title, text, actionLabel, onSelect, pendingDestination }: any) {
  const pending = pendingDestination === destination;
  const tone = READY_ACTION_TONE_STYLES[INITIAL_ONBOARDING_READY_ACTION_TONES[destination as keyof typeof INITIAL_ONBOARDING_READY_ACTION_TONES]];
  return <div className={`flex min-h-48 gap-3 rounded-xl border p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone.card}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ${tone.icon}`}><Icon className="h-5 w-5" /></span><div className="flex min-w-0 flex-1 flex-col"><strong className={`text-sm ${tone.title}`}>{title}</strong><p className="mt-1 text-xs leading-relaxed text-slate-600">{text}</p><Button type="button" variant="outline" size="sm" className={`mt-auto w-full shadow-sm ${tone.button}`} disabled={Boolean(pendingDestination)} onClick={() => onSelect(destination)}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>;
}

function TermsStep({ terms, accepted, setAccepted, active, setActive, beforeOnboarding }: any) {
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold md:text-3xl">Aceites obrigatórios</h1><p className="mt-2 text-sm text-slate-500">{beforeOnboarding ? "Antes de personalizar sua experiência, revise e aceite os documentos da plataforma." : "Revise cada documento antes de entrar."} Registraremos versão, identidade, horário e evidência do aceite.</p></div><div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><strong className="block text-sm">{INITIAL_ONBOARDING_LOCATION_NOTICE.title}</strong><p className="mt-1 text-xs leading-relaxed text-amber-900/80">{INITIAL_ONBOARDING_LOCATION_NOTICE.description}</p></div></div><div className="space-y-3">{terms.map((term: any) => <div key={term.key} className="rounded-md border bg-white"><button type="button" className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setActive(active === term.key ? null : term.key)}><ShieldCheck className="h-5 w-5 text-blue-600" /><div className="min-w-0 flex-1"><strong className="block text-sm">{term.titulo}</strong><small className="text-slate-500">Versão {term.versao} · {term.origem}</small></div><ChevronDown className={`h-4 w-4 transition ${active === term.key ? "rotate-180" : ""}`} /></button>{active === term.key && <div className="max-h-72 overflow-y-auto border-t bg-slate-50 p-4 text-xs leading-relaxed whitespace-pre-line text-slate-700">{term.body}</div>}<label className="flex items-start gap-3 border-t p-4 text-sm"><Checkbox checked={accepted[term.key] === true} onCheckedChange={(checked) => setAccepted((current: any) => ({ ...current, [term.key]: checked === true }))} /><span>Li e aceito este documento.</span></label></div>)}</div><div className="flex gap-3 rounded-md bg-blue-50 p-4 text-sm text-blue-900"><LockKeyhole className="h-5 w-5 shrink-0" /><span>O aceite fica vinculado à sua identidade e à versão apresentada. Seus dados não serão publicados por esta ação.</span></div></div>;
}

function JourneySummary({ purposes, objectives, configuration, start, comunidade }: any) {
  const configurationSummary = buildOnboardingConfigurationSummary(configuration);
  return <div className="mt-3 rounded-md border bg-white p-4 lg:sticky lg:top-24 lg:mt-0"><h2 className="font-bold">Resumo da sua jornada</h2><div className="mt-5"><small className="font-semibold text-slate-500">Perfis selecionados</small><div className="mt-2 space-y-2">{purposes.length ? purposes.map((purpose: string) => <div key={purpose} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />{PURPOSES.find((item) => item.key === purpose)?.title}</div>) : <span className="text-sm text-slate-400">Nenhum ainda</span>}</div></div>{Object.values(objectives || {}).flat().length > 0 && <div className="mt-5 border-t pt-4"><small className="font-semibold text-slate-500">Intenções</small><p className="mt-2 text-sm">{Object.values(objectives).flat().slice(0, 4).join(" · ")}</p></div>}{configurationSummary.contributionAreas.length > 0 && <div className="mt-5 border-t pt-4"><small className="font-semibold text-slate-500">Áreas de contribuição</small><div className="mt-2 flex flex-wrap gap-1.5">{configurationSummary.contributionAreas.map((area) => <span key={area} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{area}</span>)}</div></div>}{configurationSummary.activity.length > 0 && <div className="mt-5 border-t pt-4"><small className="font-semibold text-slate-500">Atuação</small><div className="mt-2 space-y-2">{configurationSummary.activity.map((item) => <p key={item.label} className="text-xs leading-relaxed"><strong className="text-slate-700">{item.label}:</strong> <span className="text-slate-600">{item.value}</span></p>)}</div></div>}<div className="mt-5 border-t pt-4"><small className="font-semibold text-slate-500">Comunidade de origem</small><p className="mt-2 text-sm">{comunidade?.nome || "Definida pelo convite"}</p></div>{start && <div className="mt-5 rounded bg-blue-50 p-3"><small className="font-semibold text-blue-700">Próximo ambiente</small><p className="mt-1 text-sm">{start === "imovel" ? "Cadastro de imóvel" : start === "profissional" ? "Perfil profissional" : "Capital"}</p></div>}</div>;
}
