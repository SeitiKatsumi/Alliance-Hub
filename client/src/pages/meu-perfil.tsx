import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteQrCode } from "@/components/invite-qr-code";
import { ModuleInfo } from "@/components/module-info";
import { AuraScore, getFaixaColor } from "@/components/aura-score";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  User, MapPin, Building2, Briefcase,
  Save, Loader2, Camera, CheckCircle, CheckCircle2, Globe, Navigation, Search,
  ImageIcon, X, Languages, Lock, Ticket, Copy, RefreshCw, ChevronDown,
  Store, TrendingUp, Flag, FolderKanban, Scale, Lightbulb, ShieldCheck,
  CircleCheck, Truck, BriefcaseBusiness, Tags, Megaphone, Users,
  ChartNoAxesCombined, ReceiptText, CircleDollarSign, KeyRound, Info, Eye, EyeOff,
  Home, Landmark, Settings2, Circle, Layers3, ArrowLeft, ArrowRight
} from "lucide-react";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatBuiltInviteMessage } from "@/lib/invite-message";
import { clampPhotoPosition, getPhotoObjectPosition } from "@/lib/photo-position";
import { RAMOS_SEGMENTOS, formatRamosDisplay, formatRamosValue, formatSegmentosDisplay, formatSegmentosValue, getSegmentosForRamos, getAllTipos, getNucleosForTipos, getTipoDisplayName, parseRamosValue, parseSegmentosValue } from "@/lib/ramos-segmentos";
import { PhoneInput, hasInternationalDialCode, normalizePhoneValue } from "@/components/phone-input";
import { COMPANY_ACCESS_KEYS, COMPANY_ACCESS_LABELS, normalizeCompanyAccess } from "@shared/company-access";
import { PROFILE_AREA_SCOPE_OPTIONS, PROFILE_LANGUAGE_OPTIONS } from "@shared/profile-taxonomy";
import { usePublicLabels } from "@/hooks/use-public-labels";
import {
  getProfileCategoryPending,
  getProfileCompletion,
  getProfileCompletionCategory,
  type ProfileDataCategory,
} from "@/lib/profile-completion";
import {
  INITIAL_ONBOARDING_OBJECTIVE_COPY,
  INITIAL_ONBOARDING_OBJECTIVES,
  normalizeAccountPurposeObjectives,
  type AccountPurpose,
  type AccountPurposeObjectives,
} from "@shared/initial-onboarding";
import { STRATEGIC_CELL_BUSINESS_TYPES, STRATEGIC_CELL_TYPES } from "@shared/strategic-cells";

type ProfileCategory = ProfileDataCategory | "account";
type StrategicCellTypeOption = {
  code: string;
  public_name: string;
  short_description: string;
  business_types: Array<{ code: string; public_name: string }>;
};

const DEFAULT_STRATEGIC_CELL_TYPES: StrategicCellTypeOption[] = STRATEGIC_CELL_TYPES.map((cell) => ({
  code: cell.code,
  public_name: cell.publicName,
  short_description: cell.description,
  business_types: STRATEGIC_CELL_BUSINESS_TYPES
    .filter(([cellCode]) => cellCode === cell.code)
    .map(([, code, , publicName]) => ({ code, public_name: publicName })),
}));

const PROFILE_FIELD_TARGETS: Record<string, { testId: string; category: ProfileDataCategory; formal?: boolean }> = {
  foto: { testId: "btn-trocar-foto", category: "identity" },
  nome: { testId: "input-perfil-nome", category: "identity" },
  email: { testId: "input-perfil-email", category: "identity" },
  nome_completo: { testId: "input-formalizacao-nome-completo", category: "identity", formal: true },
  cpf: { testId: "input-formalizacao-cpf", category: "identity", formal: true },
  telefone: { testId: "input-perfil-telefone", category: "identity" },
  whatsapp: { testId: "input-perfil-whatsapp", category: "identity" },
  nacionalidade: { testId: "input-perfil-nacionalidade", category: "identity", formal: true },
  data_nascimento: { testId: "input-perfil-data-nascimento", category: "identity", formal: true },
  rg: { testId: "input-perfil-rg", category: "identity", formal: true },
  estado_civil: { testId: "select-perfil-estado-civil", category: "identity", formal: true },
  localizacao: { testId: "btn-pick-location", category: "identity" },
  endereco: { testId: "input-perfil-endereco", category: "identity", formal: true },
  areas_contribuicao: { testId: "section-areas-contribuicao", category: "activity" },
  cargo: { testId: "input-perfil-cargo", category: "activity" },
  ramo_atuacao: { testId: "select-perfil-ramo", category: "activity" },
  segmento: { testId: "select-perfil-segmento", category: "activity" },
  area_atuacao: { testId: "select-perfil-area-atuacao", category: "activity" },
  especialidade: { testId: "input-perfil-especialidade-livre", category: "activity" },
  idiomas: { testId: "input-idioma-busca", category: "activity" },
  biografia: { testId: "input-perfil-aliado", category: "activity" },
  site: { testId: "input-perfil-link-site", category: "activity" },
  cnpj: { testId: "input-perfil-cnpj", category: "company" },
  logo_empresa: { testId: "btn-trocar-logo-empresa", category: "company" },
  regime_comunhao: { testId: "select-perfil-regime-comunhao", category: "identity", formal: true },
  conjuge_nome: { testId: "input-perfil-conjuge-nome", category: "identity", formal: true },
};

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
    country_code?: string;
  };
}

const INVITE_APP_URL = "https://app.builtalliances.com";
const FOTO_CROP_BOX = 320;
const FOTO_CROP_OUTPUT = 640;
const ESTADO_CIVIL_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União estável" },
];
const REGIME_COMUNHAO_OPTIONS = [
  { value: "comunhao_parcial", label: "Comunhão parcial de bens" },
  { value: "comunhao_universal", label: "Comunhão universal de bens" },
  { value: "separacao_total", label: "Separação total de bens" },
  { value: "participacao_final", label: "Participação final nos aquestos" },
];
const CONTRIBUTION_AREA_ORDER = [
  "lideranca tecnica",
  "projeto",
  "juridicas",
  "inteligencia",
  "integridade e sustentabilidade",
  "lideranca de obras",
  "execucao",
  "fornecimento",
  "construcao",
  "lideranca comercial",
  "comerciais",
  "vendas e locacao",
  "marketing",
  "operacoes e facilities",
  "gestao de relacionamento com cliente",
  "relacionamento",
  "lideranca de capital",
  "aporte financeiro",
  "investimento",
  "credito e captacao",
  "contabeis e tributarias",
  "gestao financeira",
];
const CONTRIBUTION_AREA_ORDER_MAP = new Map(CONTRIBUTION_AREA_ORDER.map((key, index) => [key, index]));
const AREA_ICON_CONFIG: Record<string, { icon: typeof Flag; color: string; bg: string }> = {
  "Liderança Técnica": { icon: Flag, color: "text-blue-600", bg: "bg-blue-50" },
  "Liderança de Obras": { icon: Flag, color: "text-emerald-600", bg: "bg-emerald-50" },
  "Liderança Comercial": { icon: Flag, color: "text-purple-600", bg: "bg-purple-50" },
  "Liderança de Capital": { icon: Flag, color: "text-orange-600", bg: "bg-orange-50" },
  "Projeto": { icon: FolderKanban, color: "text-blue-600", bg: "bg-blue-50" },
  "Jurídicas": { icon: Scale, color: "text-blue-600", bg: "bg-blue-50" },
  "Inteligência": { icon: Lightbulb, color: "text-blue-600", bg: "bg-blue-50" },
  "Integridade e sustentabilidade": { icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-50" },
  "Execução": { icon: CircleCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
  "Fornecimento": { icon: Truck, color: "text-emerald-600", bg: "bg-emerald-50" },
  "Construção": { icon: Building2, color: "text-emerald-600", bg: "bg-emerald-50" },
  "Comerciais": { icon: BriefcaseBusiness, color: "text-purple-600", bg: "bg-purple-50" },
  "Vendas e Locação": { icon: Tags, color: "text-purple-600", bg: "bg-purple-50" },
  "Marketing": { icon: Megaphone, color: "text-purple-600", bg: "bg-purple-50" },
  "Operações e Facilities": { icon: Building2, color: "text-purple-600", bg: "bg-purple-50" },
  "Gestão de Relacionamento com Cliente": { icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
  "Relacionamento": { icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
  "Aporte Financeiro": { icon: ChartNoAxesCombined, color: "text-orange-600", bg: "bg-orange-50" },
  "Crédito e Captação": { icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50" },
  "Contábeis e Tributárias": { icon: ReceiptText, color: "text-orange-600", bg: "bg-orange-50" },
  "Gestão Financeira": { icon: CircleDollarSign, color: "text-orange-600", bg: "bg-orange-50" },
};

const AREA_INFO_CONFIG: Record<string, { nucleo: string; cpp: string; description: string; footer?: string }> = {
  "Liderança Técnica": {
    nucleo: "Diretoria da Aliança",
    cpp: "Liderança Técnica",
    description: "Coordenação técnica, integração das alianças técnicas, viabilidade, conformidade e prevenção de riscos.",
  },
  "Liderança de Obras": {
    nucleo: "Diretoria da Aliança",
    cpp: "Liderança de Obras",
    description: "Coordenação da execução, integração de equipes, fornecedores, cronograma, qualidade e aderência aos projetos.",
  },
  "Liderança Comercial": {
    nucleo: "Diretoria da Aliança",
    cpp: "Liderança Comercial",
    description: "Coordenação comercial, integração de vendas, locação, marketing, relacionamento e geração de receita.",
  },
  "Liderança de Capital": {
    nucleo: "Diretoria da Aliança",
    cpp: "Liderança de Capital",
    description: "Coordenação econômica e financeira, integração de investimentos, captação, controle, prestação de contas e resultados.",
  },
  "Projeto": {
    nucleo: "Núcleo de Alianças Técnicas",
    cpp: "CPP Técnica",
    description: "Arquitetos, engenheiros, projetistas, designers, urbanistas e demais profissionais responsáveis pela concepção, desenvolvimento, compatibilização e detalhamento técnico dos projetos.",
    footer: "Contribui para a viabilidade técnica, consistência dos projetos e conformidade das entregas.",
  },
  "Jurídicas": {
    nucleo: "Núcleo de Alianças Técnicas",
    cpp: "CPP Técnica",
    description: "Profissionais especializados em direito imobiliário, societário, contratual, urbanístico, regulatório e compliance jurídico, responsáveis pela segurança jurídica das operações, contratos, ativos e relações da BIA.",
    footer: "Ajuda a garantir conformidade legal e prevenção de riscos.",
  },
  "Inteligência": {
    nucleo: "Núcleo de Alianças Técnicas",
    cpp: "CPP Técnica",
    description: "Especialistas em inteligência de mercado, estudos de viabilidade, análise de produto, estratégia imobiliária, masterplan, posicionamento e modelagem da oportunidade.",
    footer: "Apoia decisões estratégicas e leitura de mercado da BIA.",
  },
  "Integridade e sustentabilidade": {
    nucleo: "Núcleo de Alianças Técnicas",
    cpp: "CPP Técnica",
    description: "Profissionais de compliance, segurança, qualidade, consultoria, auditoria, meio ambiente e ESG, responsáveis por fortalecer conformidade, prevenção de riscos, qualidade das entregas e sustentabilidade da BIA.",
  },
  "Execução": {
    nucleo: "Núcleo de Alianças de Obras",
    cpp: "CPP de Obra",
    description: "Profissionais e equipes responsáveis pela execução direta dos serviços de obra, incluindo engenheiros de obra, mestres, encarregados, supervisores, técnicos e demais executores especializados.",
  },
  "Construção": {
    nucleo: "Núcleo de Alianças de Obras",
    cpp: "CPP de Obra",
    description: "Construtoras, empreiteiras, subempreiteiras e empresas especializadas responsáveis pela execução de etapas construtivas, frentes de serviço, instalações, montagem, reforma, retrofit ou construção integral.",
  },
  "Fornecimento": {
    nucleo: "Núcleo de Alianças de Obras",
    cpp: "CPP de Obra",
    description: "Fornecedores de materiais, insumos, equipamentos, ferramentas, sistemas construtivos, soluções técnicas e serviços logísticos necessários à execução da obra.",
    footer: "Garante execução física com controle de prazo, custo, qualidade, fornecimento e aderência aos projetos aprovados.",
  },
  "Comerciais": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Corretores, executivos de negócios, articuladores comerciais e parceiros de mercado responsáveis por prospecção, abertura de portas, negociação, captação de demanda e conversão de oportunidades.",
  },
  "Vendas e Locação": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Corretores, consultores, imobiliárias, plataformas e canais especializados responsáveis pela comercialização, locação, permuta, ocupação ou distribuição comercial do ativo.",
  },
  "Marketing": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Profissionais e empresas de marketing, branding, performance, conteúdo, mídia, eventos e relacionamento responsáveis por posicionar a BIA, gerar demanda qualificada e fortalecer a percepção de valor do ativo.",
  },
  "Operações e Facilities": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Operadores, gestores de facilities, administradoras, manutenção, terceirização e prestadores responsáveis pela operação, conservação, eficiência, ocupação e experiência de uso do ativo.",
  },
  "Gestão de Relacionamento com Cliente": {
    nucleo: "Núcleo de Alianças Comerciais",
    cpp: "CPP Comercial",
    description: "Profissionais e empresas responsáveis por atendimento, pós-venda, SAC, garantias, jornada do cliente, retenção, reputação e continuidade da relação comercial.",
    footer: "Transforma o ativo físico em ativo econômico por meio de venda, locação, operação, relacionamento e geração de receita.",
  },
  "Aporte Financeiro": {
    nucleo: "Núcleo de Alianças de Capital",
    cpp: "CPP de Capital",
    description: "Investidores, cotistas, financiadores e parceiros de capital responsáveis por aportar recursos financeiros.",
  },
  "Crédito e Captação": {
    nucleo: "Núcleo de Alianças de Capital",
    cpp: "CPP de Capital",
    description: "Bancos, instituições financeiras, fundos, securitizadoras, family offices e parceiros de crédito responsáveis por viabilizar recursos, financiamentos, antecipações, operações de crédito e demais instrumentos de captação para a BIA.",
  },
  "Contábeis e Tributárias": {
    nucleo: "Núcleo de Alianças de Capital",
    cpp: "CPP de Capital",
    description: "Profissionais e empresas responsáveis pela contabilidade, planejamento tributário, obrigações fiscais e acessórias, apuração de tributos, relatórios contábeis, prestação de contas e conformidade fiscal da BIA.",
  },
  "Gestão Financeira": {
    nucleo: "Núcleo de Alianças de Capital",
    cpp: "CPP de Capital",
    description: "Profissionais e empresas responsáveis pelo planejamento financeiro, fluxo de caixa, controladoria, projeções, acompanhamento orçamentário, gestão financeira da operação e suporte à tomada de decisão econômica da BIA.",
    footer: "Garante gestão econômica, financeira, contábil e tributária com controle de caixa, transparência, conformidade fiscal e apuração segura dos resultados.",
  },
};

function ContributionAreaInfo({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const info = AREA_INFO_CONFIG[label];

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => () => clearCloseTimer(), []);

  if (!info) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Informações sobre ${label}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(value => !value);
          }}
          onMouseEnter={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        onMouseEnter={() => {
          clearCloseTimer();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        className="w-80 max-w-[calc(100vw-2rem)] space-y-2 text-left"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{info.nucleo}</p>
          <p className="text-[10px] font-semibold text-blue-600">{info.cpp}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-[#001D34]">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{info.description}</p>
        </div>
        {info.footer && <p className="border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">{info.footer}</p>}
      </PopoverContent>
    </Popover>
  );
}

const ACCOUNT_PURPOSE_OPTIONS: Array<{
  id: AccountPurpose;
  title: string;
  description: string;
  icon: typeof Building2;
}> = [
  {
    id: "imoveis",
    title: "Tenho um imóvel ou identifiquei uma oportunidade",
    description: "Quero cadastrar, analisar e administrar imóveis.",
    icon: Home,
  },
  {
    id: "profissional",
    title: "Sou profissional, fornecedor ou empresa",
    description: "Atuo oferecendo serviços, insumos ou experiência profissional.",
    icon: BriefcaseBusiness,
  },
  {
    id: "capital",
    title: "Sou investidor ou parceiro de capital",
    description: "Atuo como investidor ou parceiro de capital.",
    icon: Landmark,
  },
];

const ACCOUNT_PURPOSE_STYLES: Record<AccountPurpose, {
  selected: string;
  icon: string;
  option: string;
  action: string;
}> = {
  imoveis: {
    selected: "border-blue-500 bg-blue-50/70",
    icon: "bg-blue-100 text-blue-700",
    option: "border-blue-500 bg-blue-50 text-blue-700",
    action: "bg-blue-600 text-white hover:bg-blue-700",
  },
  profissional: {
    selected: "border-emerald-500 bg-emerald-50/70",
    icon: "bg-emerald-100 text-emerald-700",
    option: "border-emerald-500 bg-emerald-50 text-emerald-700",
    action: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  capital: {
    selected: "border-violet-500 bg-violet-50/70",
    icon: "bg-violet-100 text-violet-700",
    option: "border-violet-500 bg-violet-50 text-violet-700",
    action: "bg-violet-600 text-white hover:bg-violet-700",
  },
};

function normalizeInviteLink(link?: string | null) {
  if (!link) return "";
  if (/^https?:\/\/built\.dna11\.com\.br/i.test(link)) {
    return link.replace(/^https?:\/\/built\.dna11\.com\.br/i, INVITE_APP_URL);
  }
  if (/^https?:\/\/app\.builtalliances\.com\.br/i.test(link)) {
    return link.replace(/^https?:\/\/app\.builtalliances\.com\.br/i, INVITE_APP_URL);
  }
  if (/^https?:\/\//i.test(link)) return link;
  return `${INVITE_APP_URL}${link.startsWith("/") ?"" : "/"}${link}`;
}

function LocationPickerModal({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (cidade: string, estado: string, pais: string, lat: number, lng: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<NominatimResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) { setSearch(""); setResults([]); setSelected(null); setError(""); }
  }, [open]);

  async function handleSearch() {
    if (!search.trim()) return;
    setLoading(true); setError(""); setResults([]); setSelected(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=8&addressdetails=1&accept-language=pt-BR,pt`;
      const res = await fetch(url, { headers: { "Accept-Language": "pt-BR,pt;q=0.9" } });
      if (!res.ok) throw new Error();
      const data: NominatimResult[] = await res.json();
      if (data.length === 0) setError("Nenhum resultado encontrado. Tente um nome mais específico.");
      setResults(data);
    } catch {
      setError("Falha ao buscar localização. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!selected) return;
    const addr = selected.address || {};
    const cidade = addr.city || addr.town || addr.municipality || addr.village || selected.display_name.split(",")[0];
    const estado = addr.state || "";
    const pais = addr.country || "";
    onSelect(cidade, estado, pais, parseFloat(selected.lat), parseFloat(selected.lon));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-brand-gold" />
            Selecionar Localização
          </DialogTitle>
          <DialogDescription>
            Pesquise uma cidade, endereço ou ponto de referência para obter a localização exata com coordenadas GPS.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <input
            autoFocus
            placeholder="Ex: São Paulo, SP — Copacabana, RJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            data-testid="input-location-search"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !search.trim()}
            className="px-3 py-2 rounded-md bg-brand-gold text-brand-navy hover:bg-brand-gold/90 disabled:opacity-50 shrink-0"
            data-testid="btn-search-location"
          >
            {loading ?<Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-sm text-muted-foreground text-center py-2">{error}</p>}
        {results.length > 0 && (
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {results.map((r) => (
              <button
                key={r.place_id}
                onClick={() => setSelected(r)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors border ${
                  selected?.place_id === r.place_id
                    ?"bg-brand-gold/10 border-brand-gold/40 text-brand-gold"
                    : "hover:bg-muted border-transparent"
                }`}
                data-testid={`location-result-${r.place_id}`}
              >
                <p className="font-medium leading-tight">{r.display_name}</p>
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm border border-input hover:bg-muted">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="px-4 py-2 rounded-md text-sm bg-brand-gold text-brand-navy hover:bg-brand-gold/90 disabled:opacity-50 flex items-center gap-2"
            data-testid="btn-confirm-location"
          >
            <MapPin className="w-3.5 h-3.5" />
            Confirmar localização
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EspecialidadeOption {
  id: string;
  nome_especialidade: string;
}

const REDES_DISPONIVEIS = [
  { value: "BUILT_PROUD_MEMBER", label: "BUILT Proud Member", badge: "/built-proud-member.png" },
  { value: "BUILT_FOUNDING_MEMBER", label: "BUILT Founding Member", badge: "/built-founding-member.png" },
  { value: "BUILT_ALLIANCE_PARTNER", label: "BUILT Alliance Partner", badge: "/built-alliance-partner.png" },
  { value: "BUILT_CAPITAL_PARTNER", label: "BUILT Capital Partner", badge: "/built-capital-partner.png" },
  { value: "BNI", label: "BNI", badge: "/bni-badge.png" },
];

interface Membro {
  id: string;
  nome: string;
  nome_completo?: string | null;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  nacionalidade?: string | null;
  nome_mae?: string | null;
  nome_pai?: string | null;
  data_nascimento?: string | null;
  profissao?: string | null;
  cpf?: string | null;
  rg?: string | null;
  estado_civil?: string | null;
  regime_comunhao?: string | null;
  conjuge_nome_completo?: string | null;
  conjuge_nacionalidade?: string | null;
  conjuge_nome_mae?: string | null;
  conjuge_nome_pai?: string | null;
  conjuge_data_nascimento?: string | null;
  conjuge_profissao?: string | null;
  conjuge_email?: string | null;
  conjuge_telefone?: string | null;
  conjuge_cpf?: string | null;
  conjuge_rg?: string | null;
  mesmo_endereco?: boolean | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  titular_cep?: string | null;
  titular_endereco?: string | null;
  titular_numero?: string | null;
  titular_complemento?: string | null;
  titular_bairro?: string | null;
  titular_cidade?: string | null;
  titular_estado?: string | null;
  titular_pais?: string | null;
  conjuge_cep?: string | null;
  conjuge_endereco?: string | null;
  conjuge_numero?: string | null;
  conjuge_complemento?: string | null;
  conjuge_bairro?: string | null;
  conjuge_cidade?: string | null;
  conjuge_estado?: string | null;
  conjuge_pais?: string | null;
  cidade?: string;
  estado?: string;
  pais?: string;
  latitude?: string | null;
  longitude?: string | null;
  empresa?: string;
  cnpj?: string | null;
  cargo?: string;
  especialidade?: string;
  especialidade_id?: string | null;
  foto?: string | null;
  foto_perfil?: string | null;
  foto_posicao_x?: number | string | null;
  foto_posicao_y?: number | string | null;
  perfil_aliado?: string;
  nucleo_alianca?: string;
  tipo_alianca?: string;
  nucleos_alianca?: string[] | null;
  tipos_alianca?: string[] | null;
  tipo_de_cadastro?: string;
  na_vitrine?: boolean;
  em_membros_built?: boolean;
  em_built_capital?: boolean;
  link_site?: string;
  logo_empresa?: string | null;
  especialidade_livre?: string;
  ramo_atuacao?: string | null;
  segmento?: string | null;
  area_atuacao?: string | null;
  idiomas?: string[] | null;
  Outras_redes_as_quais_pertenco?: string[] | null;
}

const PROFILE_EDITABLE_FIELDS: Array<keyof Membro> = [
  "nome",
  "nome_completo",
  "email",
  "telefone",
  "whatsapp",
  "nacionalidade",
  "nome_mae",
  "nome_pai",
  "data_nascimento",
  "profissao",
  "cpf",
  "rg",
  "estado_civil",
  "regime_comunhao",
  "conjuge_nome_completo",
  "conjuge_nacionalidade",
  "conjuge_nome_mae",
  "conjuge_nome_pai",
  "conjuge_data_nascimento",
  "conjuge_profissao",
  "conjuge_email",
  "conjuge_telefone",
  "conjuge_cpf",
  "conjuge_rg",
  "mesmo_endereco",
  "cep",
  "endereco",
  "numero",
  "complemento",
  "bairro",
  "titular_cep",
  "titular_endereco",
  "titular_numero",
  "titular_complemento",
  "titular_bairro",
  "titular_cidade",
  "titular_estado",
  "titular_pais",
  "conjuge_cep",
  "conjuge_endereco",
  "conjuge_numero",
  "conjuge_complemento",
  "conjuge_bairro",
  "conjuge_cidade",
  "conjuge_estado",
  "conjuge_pais",
  "cidade",
  "estado",
  "pais",
  "latitude",
  "longitude",
  "empresa",
  "cnpj",
  "cargo",
  "foto_perfil",
  "foto_posicao_x",
  "foto_posicao_y",
  "perfil_aliado",
  "nucleo_alianca",
  "tipo_alianca",
  "nucleos_alianca",
  "tipos_alianca",
  "na_vitrine",
  "em_membros_built",
  "em_built_capital",
  "link_site",
  "logo_empresa",
  "especialidade_livre",
  "ramo_atuacao",
  "segmento",
  "area_atuacao",
  "idiomas",
  "Outras_redes_as_quais_pertenco",
];

function buildProfilePayload(form: Partial<Membro>): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const field of PROFILE_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(form, field)) {
      payload[field] = form[field];
    }
  }
  return payload;
}

function profileSnapshot(form: Partial<Membro>): string {
  return JSON.stringify(buildProfilePayload(form));
}

function sameCodeSet(left: string[] = [], right: string[] = []): boolean {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

function isEmailLikeValue(value?: string | null): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function sanitizeLinkSite(value?: string | null): string {
  const text = String(value || "").trim();
  return text && !isEmailLikeValue(text) ? text : "";
}

function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=200&height=200&fit=cover`;
}

function getInitials(nome: string): string {
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function contributionKey(tipo: string): string {
  return getTipoDisplayName(tipo)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function sortContributionAreas<T>(items: T[], getValue: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const aKey = contributionKey(getValue(a));
    const bKey = contributionKey(getValue(b));
    const aIndex = CONTRIBUTION_AREA_ORDER_MAP.get(aKey) ?? 999;
    const bIndex = CONTRIBUTION_AREA_ORDER_MAP.get(bKey) ?? 999;
    return aIndex === bIndex ? aKey.localeCompare(bKey) : aIndex - bIndex;
  });
}

function canonicalContributionArea(tipo: string): string {
  const key = contributionKey(tipo);
  if (key === "lideranca") return "Alianças de Liderança Comercial";
  if (key === "governanca") return "Alianças de Integridade e sustentabilidade";
  if (key === "credito" || key === "captacao") return "Alianças de Crédito e Captação";
  return tipo;
}

function uniqueContributionAreas(tipos?: string[] | null): string[] {
  const seen = new Set<string>();
  return (tipos || []).map((tipo) => canonicalContributionArea(String(tipo || "").trim())).filter((tipo) => {
    const label = String(tipo || "").trim();
    if (!label) return false;
    const key = contributionKey(label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasAporteFinanceiro(tipos?: string[] | null): boolean {
  const aporteKey = contributionKey("Aporte Financeiro");
  return uniqueContributionAreas(tipos).some((tipo) => contributionKey(tipo) === aporteKey);
}

export default function MeuPerfilPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const publicLabel = usePublicLabels();
  const isSuperAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const requestedProfileField = new URLSearchParams(window.location.search).get("campo");
  const requestedProfileTarget = requestedProfileField ? PROFILE_FIELD_TARGETS[requestedProfileField] : undefined;
  const [activeCategory, setActiveCategory] = useState<ProfileCategory | null>(requestedProfileTarget?.category || null);

  const membroId = user?.membro_directus_id;

  const [accountPurposes, setAccountPurposes] = useState<AccountPurpose[]>([]);
  const [accountObjectives, setAccountObjectives] = useState<AccountPurposeObjectives>({});
  const [configuringPurpose, setConfiguringPurpose] = useState<AccountPurpose | null>(null);
  const [purposeObjectiveDraft, setPurposeObjectiveDraft] = useState<string[]>([]);

  const { data: accountPurposesData, isLoading: loadingAccountPurposes } = useQuery<{
    finalidades: AccountPurpose[];
    intencoes?: AccountPurposeObjectives;
  }>({
    queryKey: ["/api/minha-conta/finalidades"],
    queryFn: async () => {
      const response = await fetch("/api/minha-conta/finalidades", { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível carregar as finalidades da conta.");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: membro, isLoading } = useQuery<Membro>({
    queryKey: ["/api/membros", membroId],
    queryFn: () => fetch(`/api/membros/${membroId}`).then(r => r.json()),
    enabled: !!membroId && !user?.company_employee,
  });

  // All authenticated members may generate a personal invite link
  const hasConvitePermission = true;

  const [form, setForm] = useState<Partial<Membro>>({});
  const profileBaselineRef = useRef("");
  const pendingProfileSnapshotRef = useRef("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [idiomaInput, setIdiomaInput] = useState("");
  const [ramoSearch, setRamoSearch] = useState("");
  const [ramoOpen, setRamoOpen] = useState(false);
  const [segmentoSearch, setSegmentoSearch] = useState("");
  const [segmentoOpen, setSegmentoOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const { data: auraData } = useQuery<{ score: number | null; n: number; faixa: string | null }>({
    queryKey: ["/api/aura/score", membroId],
    enabled: !!membroId,
  });
  const { data: minhasCelulas = [] } = useQuery<Array<{
    id: string;
    community_id: string;
    community_name: string;
    name: string;
    membership_status: "INTERESTED" | "PENDING" | "ACTIVE" | "REJECTED";
  }>>({
    queryKey: ["/api/me/celulas"],
    queryFn: () => fetch("/api/me/celulas", { credentials: "include" }).then((response) => response.ok ? response.json() : []),
    enabled: !!user && !user.company_employee,
  });
  const { data: strategicCellTypes = [] } = useQuery<StrategicCellTypeOption[]>({
    queryKey: ["/api/strategic-cell-types"],
    queryFn: async () => {
      const response = await fetch("/api/strategic-cell-types", { credentials: "include" });
      if (!response.ok) throw new Error("Falha ao carregar Tipos de Negocio");
      return response.json();
    },
    placeholderData: DEFAULT_STRATEGIC_CELL_TYPES,
    enabled: !!user && !user.company_employee,
  });
  const { data: strategicCellPreferences } = useQuery<{
    strategic_cell_type_codes: string[];
    business_type_codes: string[];
  }>({
    queryKey: ["/api/me/celulas-preferencias"],
    queryFn: () => fetch("/api/me/celulas-preferencias", { credentials: "include" }).then((response) => response.ok ? response.json() : { strategic_cell_type_codes: [], business_type_codes: [] }),
    enabled: !!membroId && !user?.company_employee,
  });
  const [strategicCellDraft, setStrategicCellDraft] = useState({ strategic_cell_type_codes: [] as string[], business_type_codes: [] as string[] });
  const [showPasswordFields, setShowPasswordFields] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fotoCropRef = useRef<HTMLDivElement>(null);
  const fotoCropImageRef = useRef<HTMLImageElement>(null);
  const fotoDragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [isDraggingFoto, setIsDraggingFoto] = useState(false);
  const [fotoCropOpen, setFotoCropOpen] = useState(false);
  const [fotoCropSrc, setFotoCropSrc] = useState<string | null>(null);
  const [fotoCropFileName, setFotoCropFileName] = useState("foto-perfil.jpg");
  const [fotoCropNatural, setFotoCropNatural] = useState({ width: 1, height: 1 });
  const [fotoCropZoom, setFotoCropZoom] = useState(1);
  const [fotoCropOffset, setFotoCropOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (strategicCellPreferences) setStrategicCellDraft(strategicCellPreferences);
  }, [strategicCellPreferences]);

  useEffect(() => {
    if (!accountPurposesData) return;
    if (accountPurposesData.finalidades?.length) {
      setAccountPurposes(accountPurposesData.finalidades);
      setAccountObjectives(normalizeAccountPurposeObjectives(accountPurposesData.intencoes, accountPurposesData.finalidades));
      return;
    }
    if (!membroId) {
      setAccountPurposes(["imoveis"]);
      setAccountObjectives({ imoveis: [] });
      return;
    }
    const legacyPurposes: AccountPurpose[] = ["profissional"];
    if (membro?.em_built_capital) legacyPurposes.push("capital");
    setAccountPurposes(legacyPurposes);
    setAccountObjectives(normalizeAccountPurposeObjectives({}, legacyPurposes));
  }, [accountPurposesData, membro, membroId]);

  function handleLocationSelect(cidade: string, estado: string, pais: string, lat: number, lng: number) {
    setForm(f => ({ ...f, cidade, estado, pais, latitude: String(lat), longitude: String(lng) }));
  }

  function applyContributionAreas(current: Partial<Membro>, tipos: string[]): Partial<Membro> {
    const tiposAlianca = uniqueContributionAreas(tipos);
    const shouldSelectCapital = hasAporteFinanceiro(tiposAlianca);
    return {
      ...current,
      tipos_alianca: tiposAlianca,
      nucleos_alianca: getNucleosForTipos(tiposAlianca),
      em_built_capital: shouldSelectCapital ? true : current.em_built_capital,
    };
  }

  useEffect(() => {
    if (membro) {
      const tiposAlianca = uniqueContributionAreas(membro.tipos_alianca);
      const nextForm = {
        ...membro,
        nome_completo: membro.nome_completo || membro.nome || null,
        link_site: sanitizeLinkSite(membro.link_site),
        tipos_alianca: tiposAlianca,
        em_built_capital: hasAporteFinanceiro(tiposAlianca) ? true : membro.em_built_capital,
      };
      profileBaselineRef.current = profileSnapshot(nextForm);
      setForm(nextForm);
    }
  }, [membro]);

  const hasProfileChanges = Boolean(profileBaselineRef.current) && profileBaselineRef.current !== profileSnapshot(form);
  const hasStrategicCellChanges = Boolean(strategicCellPreferences) && !sameCodeSet(
    strategicCellDraft.business_type_codes,
    strategicCellPreferences?.business_type_codes,
  );
  const hasUnsavedChanges = hasProfileChanges || hasStrategicCellChanges;

  useEffect(() => {
    if (isLoading || !requestedProfileTarget) return;
    const frame = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-testid="${requestedProfileTarget.testId}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = target.matches("input, button, textarea, [tabindex]")
        ? target
        : target.querySelector<HTMLElement>("input, button, textarea, [tabindex]:not([tabindex='-1'])");
      focusable?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeCategory, isLoading, requestedProfileTarget]);

  useEffect(() => {
    return () => {
      if (fotoCropSrc) URL.revokeObjectURL(fotoCropSrc);
    };
  }, [fotoCropSrc]);

  const { data: especialidadesOptions = [] } = useQuery<EspecialidadeOption[]>({
    queryKey: ["/api/especialidades"],
    queryFn: () => fetch("/api/especialidades").then(r => r.json()),
  });

  const { data: meuConvite, refetch: refetchConvite } = useQuery<any>({
    queryKey: ["/api/meu-convite"],
    queryFn: async () => {
      const res = await fetch("/api/meu-convite", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
    enabled: !user?.company_employee,
  });
  const meuConviteLink = normalizeInviteLink(meuConvite?.link);

  const gerarConviteMutation = useMutation({
    mutationFn: async ({ force = false }: { force?: boolean } = {}) => {
      const res = await fetch("/api/meu-convite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: !!force, tipo: "unificado" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar convite");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meu-convite"] });
    },
    onError: (err: any) => toast({ title: "Erro ao gerar convite", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Membro>) =>
      apiRequest("PATCH", `/api/membros/${membroId}`, data),
    onSuccess: () => {
      profileBaselineRef.current = pendingProfileSnapshotRef.current || profileSnapshot(form);
      pendingProfileSnapshotRef.current = "";
      queryClient.invalidateQueries({ queryKey: ["/api/membros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Perfil atualizado com sucesso!" });
    },
    onError: (err: any) => {
      pendingProfileSnapshotRef.current = "";
      toast({
        title: "Erro ao salvar",
        description: err?.message || "Não foi possível atualizar o perfil.",
        variant: "destructive",
      });
    },
  });

  const updateAccountPurposesMutation = useMutation({
    mutationFn: async ({ finalidades, intencoes }: { finalidades: AccountPurpose[]; intencoes: AccountPurposeObjectives }) => {
      const response = await fetch("/api/minha-conta/finalidades", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalidades, intencoes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar as finalidades.");
      return data as { finalidades: AccountPurpose[]; intencoes: AccountPurposeObjectives };
    },
    onSuccess: (data) => {
      setAccountPurposes(data.finalidades);
      setAccountObjectives(normalizeAccountPurposeObjectives(data.intencoes, data.finalidades));
      setConfiguringPurpose(null);
      setPurposeObjectiveDraft([]);
      queryClient.invalidateQueries({ queryKey: ["/api/minha-conta/finalidades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Finalidades da conta atualizadas" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar finalidades", description: error.message, variant: "destructive" });
    },
  });

  const updateStrategicCellPreferencesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/me/celulas-preferencias", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(strategicCellDraft),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar suas Células.");
      return data;
    },
    onSuccess: (data) => {
      const nextPreferences = { strategic_cell_type_codes: data.strategic_cell_type_codes, business_type_codes: data.business_type_codes };
      setStrategicCellDraft(nextPreferences);
      queryClient.setQueryData(["/api/me/celulas-preferencias"], nextPreferences);
      queryClient.invalidateQueries({ queryKey: ["/api/me/celulas-preferencias"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/celulas"] });
      toast({ title: "Células atualizadas", description: `Vínculos sincronizados em ${data.communities_linked} comunidade(s).` });
    },
    onError: (error: any) => toast({ title: "Erro ao atualizar Células", description: error.message, variant: "destructive" }),
  });

  function openPurposeConfiguration(purpose: AccountPurpose) {
    setConfiguringPurpose(purpose);
    setPurposeObjectiveDraft(accountObjectives[purpose] || []);
  }

  function togglePurposeObjective(objective: string) {
    setPurposeObjectiveDraft((current) => current.includes(objective)
      ? current.filter((item) => item !== objective)
      : [...current, objective]);
  }

  function savePurposeConfiguration() {
    if (!configuringPurpose) return;
    if (!purposeObjectiveDraft.length) {
      toast({
        title: "Selecione ao menos uma intenção",
        description: INITIAL_ONBOARDING_OBJECTIVE_COPY[configuringPurpose].question,
        variant: "destructive",
      });
      return;
    }
    const finalidades = accountPurposes.includes(configuringPurpose)
      ? accountPurposes
      : [...accountPurposes, configuringPurpose];
    const intencoes = normalizeAccountPurposeObjectives({
      ...accountObjectives,
      [configuringPurpose]: purposeObjectiveDraft,
    }, finalidades);
    updateAccountPurposesMutation.mutate({ finalidades, intencoes });
  }

  function removeConfiguredPurpose() {
    if (!configuringPurpose || !accountPurposes.includes(configuringPurpose)) return;
    if (accountPurposes.length <= 1) {
      toast({ title: "Mantenha uma finalidade", description: "Sua conta precisa ter ao menos uma finalidade ativa.", variant: "destructive" });
      return;
    }
    const finalidades = accountPurposes.filter((purpose) => purpose !== configuringPurpose);
    const intencoes = normalizeAccountPurposeObjectives(accountObjectives, finalidades);
    updateAccountPurposesMutation.mutate({ finalidades, intencoes });
  }

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const res = await fetch("/api/me/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao alterar senha");
      return data;
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Senha alterada com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao alterar senha", description: err.message, variant: "destructive" });
    },
  });

  function getCropDrawSize(zoom = fotoCropZoom, natural = fotoCropNatural) {
    const width = Math.max(1, natural.width);
    const height = Math.max(1, natural.height);
    const aspect = width / height;
    if (aspect >= 1) return { width: FOTO_CROP_BOX * zoom * aspect, height: FOTO_CROP_BOX * zoom };
    return { width: FOTO_CROP_BOX * zoom, height: (FOTO_CROP_BOX * zoom) / aspect };
  }

  function clampCropOffset(offset: { x: number; y: number }, zoom = fotoCropZoom, natural = fotoCropNatural) {
    const draw = getCropDrawSize(zoom, natural);
    const maxX = Math.max(0, (draw.width - FOTO_CROP_BOX) / 2);
    const maxY = Math.max(0, (draw.height - FOTO_CROP_BOX) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
  }

  function resetFotoCrop() {
    setFotoCropZoom(1);
    setFotoCropOffset({ x: 0, y: 0 });
    setFotoCropNatural({ width: 1, height: 1 });
    fotoDragRef.current = null;
    setIsDraggingFoto(false);
  }

  function closeFotoCropModal() {
    setFotoCropOpen(false);
    setFotoCropSrc((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    resetFotoCrop();
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !membroId) return;
    if (fotoCropSrc) URL.revokeObjectURL(fotoCropSrc);
    resetFotoCrop();
    setFotoCropFileName(file.name || "foto-perfil.jpg");
    setFotoCropSrc(URL.createObjectURL(file));
    setFotoCropOpen(true);
  }

  async function uploadCroppedFoto() {
    if (!membroId || !fotoCropImageRef.current) return;
    setUploadingFoto(true);
    try {
      const img = fotoCropImageRef.current;
      const draw = getCropDrawSize();
      const canvas = document.createElement("canvas");
      canvas.width = FOTO_CROP_OUTPUT;
      canvas.height = FOTO_CROP_OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const ratio = FOTO_CROP_OUTPUT / FOTO_CROP_BOX;
      const dx = (FOTO_CROP_BOX / 2 - draw.width / 2 + fotoCropOffset.x) * ratio;
      const dy = (FOTO_CROP_BOX / 2 - draw.height / 2 + fotoCropOffset.y) * ratio;
      ctx.drawImage(img, dx, dy, draw.width * ratio, draw.height * ratio);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível recortar a foto")), "image/jpeg", 0.92);
      });
      const fd = new FormData();
      const safeName = fotoCropFileName.replace(/\.[^.]+$/, "") || "foto-perfil";
      fd.append("files", blob, `${safeName}-recortada.jpg`);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.fileIds?.[0]) throw new Error(json.error || "Upload falhou");
      const uuid = json.fileIds[0];
      await apiRequest("PATCH", `/api/membros/${membroId}`, { foto_perfil: uuid, foto_posicao_x: 50, foto_posicao_y: 50 });
      setForm(f => ({ ...f, foto_perfil: uuid, foto: uuid, foto_posicao_x: 50, foto_posicao_y: 50 }));
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membros-built"] });
      toast({ title: "Foto de perfil atualizada!" });
      closeFotoCropModal();
    } catch {
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      setUploadingFoto(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !membroId) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.fileIds?.[0]) throw new Error(json.error || "Upload falhou");
      const uuid = json.fileIds[0];
      await apiRequest("PATCH", `/api/membros/${membroId}`, { logo_empresa: uuid });
      setForm(f => ({ ...f, logo_empresa: uuid }));
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      toast({ title: "Logo da empresa atualizado!" });
    } catch {
      toast({ title: "Erro ao enviar logo", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  function set(field: keyof Membro, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const selectedRamos = parseRamosValue(form.ramo_atuacao);
  const selectedSegmentos = parseSegmentosValue(form.segmento);
  const availableSegmentos = getSegmentosForRamos(selectedRamos);
  const normalizedRamoSearch = ramoSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filteredRamos = RAMOS_SEGMENTOS.filter((ramo) =>
    ramo.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedRamoSearch)
  );
  const normalizedSegmentoSearch = segmentoSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filteredSegmentos = availableSegmentos.filter((segmento) =>
    segmento.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedSegmentoSearch)
  );

  function toggleRamo(ramo: string) {
    setForm(current => {
      const currentRamos = parseRamosValue(current.ramo_atuacao);
      const nextRamos = currentRamos.includes(ramo)
        ? currentRamos.filter(item => item !== ramo)
        : [...currentRamos, ramo];
      const availableNames = new Set(getSegmentosForRamos(nextRamos).map(segmento => segmento.nome));
      const nextSegmentos = parseSegmentosValue(current.segmento).filter(segmento => availableNames.has(segmento));
      return {
        ...current,
        ramo_atuacao: formatRamosValue(nextRamos),
        segmento: formatSegmentosValue(nextSegmentos),
      };
    });
  }

  function clearRamos() {
    setForm(current => ({ ...current, ramo_atuacao: null, segmento: null }));
    setRamoSearch("");
    setSegmentoSearch("");
  }

  function toggleSegmento(segmento: string) {
    setForm(current => {
      const currentSegmentos = parseSegmentosValue(current.segmento);
      const nextSegmentos = currentSegmentos.includes(segmento)
        ? currentSegmentos.filter(item => item !== segmento)
        : [...currentSegmentos, segmento];
      return { ...current, segmento: formatSegmentosValue(nextSegmentos) };
    });
  }

  function clearSegmentos() {
    setForm(current => ({ ...current, segmento: null }));
    setSegmentoSearch("");
  }

  function handleSave() {
    if (!hasProfileChanges) {
      if (hasStrategicCellChanges) updateStrategicCellPreferencesMutation.mutate();
      return;
    }
    const normalizedTelefone = normalizePhoneValue(form.telefone);
    const normalizedWhatsapp = normalizePhoneValue(form.whatsapp);
    if (!String(form.email || "").trim()) {
      toast({ title: "E-mail obrigatório", description: "Informe um e-mail para salvar o perfil.", variant: "destructive" });
      return;
    }
    if (!hasInternationalDialCode(normalizedTelefone) && !hasInternationalDialCode(normalizedWhatsapp)) {
      toast({ title: "Contato obrigatório", description: "Informe telefone ou WhatsApp com código internacional.", variant: "destructive" });
      return;
    }
    if (String(form.empresa || "").trim() && !String(form.cnpj || "").trim()) {
      openProfileCategory("company");
      toast({ title: "CNPJ obrigatório", description: "Preencha o CNPJ na seção Empresa e Vitrine que foi aberta.", variant: "destructive" });
      return;
    }
    const tiposAlianca = uniqueContributionAreas(form.tipos_alianca);
    const shouldSelectCapital = hasAporteFinanceiro(tiposAlianca);
    const linkSite = sanitizeLinkSite(form.link_site);
    const payload: Record<string, any> = {
      ...buildProfilePayload(form),
      telefone: normalizedTelefone || null,
      whatsapp: normalizedWhatsapp || null,
      link_site: linkSite || null,
      tipos_alianca: tiposAlianca,
      nucleos_alianca: getNucleosForTipos(tiposAlianca),
      em_built_capital: shouldSelectCapital ? true : form.em_built_capital,
    };
    // Send Especialidades as Directus M2M array
    payload.Especialidades = form.especialidade_id
      ?[{ especialidades_id: form.especialidade_id }]
      : [];
    if (!accountPurposes.length) {
      toast({ title: "Escolha uma finalidade", description: "Selecione ao menos uma finalidade para a sua conta.", variant: "destructive" });
      return;
    }
    pendingProfileSnapshotRef.current = profileSnapshot(form);
    updateAccountPurposesMutation.mutate({ finalidades: accountPurposes, intencoes: accountObjectives });
    updateMutation.mutate(payload as any);
    if (hasStrategicCellChanges) updateStrategicCellPreferencesMutation.mutate();
  }

  function handleChangePassword() {
    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Campos obrigatórios", description: "Preencha a senha atual, a nova senha e a confirmação.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "Senha muito curta", description: "A nova senha deve ter pelo menos 4 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas diferentes", description: "A confirmação precisa ser igual à nova senha.", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  }

  const purposeDialog = configuringPurpose ? (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !updateAccountPurposesMutation.isPending) {
          setConfiguringPurpose(null);
          setPurposeObjectiveDraft([]);
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-[#001D34]">
            {(() => {
              const PurposeIcon = ACCOUNT_PURPOSE_OPTIONS.find((item) => item.id === configuringPurpose)?.icon || BriefcaseBusiness;
              return (
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${ACCOUNT_PURPOSE_STYLES[configuringPurpose].icon}`}>
                  <PurposeIcon className="h-5 w-5" />
                </span>
              );
            })()}
            <span>{INITIAL_ONBOARDING_OBJECTIVE_COPY[configuringPurpose].title}</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            {INITIAL_ONBOARDING_OBJECTIVE_COPY[configuringPurpose].question}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[52vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {INITIAL_ONBOARDING_OBJECTIVES[configuringPurpose].map((objective) => {
            const selected = purposeObjectiveDraft.includes(objective);
            return (
              <button
                key={objective}
                type="button"
                onClick={() => togglePurposeObjective(objective)}
                className={`flex min-h-12 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selected ? ACCOUNT_PURPOSE_STYLES[configuringPurpose].option : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {selected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
                <span>{objective}</span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {accountPurposes.includes(configuringPurpose) && accountPurposes.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={removeConfiguredPurpose}
                disabled={updateAccountPurposesMutation.isPending}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Remover finalidade
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfiguringPurpose(null);
                setPurposeObjectiveDraft([]);
              }}
              disabled={updateAccountPurposesMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={savePurposeConfiguration}
              disabled={updateAccountPurposesMutation.isPending || !purposeObjectiveDraft.length}
              className={`gap-2 ${ACCOUNT_PURPOSE_STYLES[configuringPurpose].action}`}
              data-testid="btn-salvar-intencoes"
            >
              {updateAccountPurposesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar intenções
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  if (user?.company_employee) {
    const companyPermissions = normalizeCompanyAccess(user.company_permissions);
    return (
      <div className="min-h-full bg-slate-50 px-4 py-6 text-[#001D34] sm:px-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <h1 className="text-2xl font-bold">Meu acesso empresarial</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">Consulte os acessos liberados pelo responsável da empresa e gerencie sua senha.</p>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold">{user.nome}</p>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                {user.company_employee_role && <p className="mt-1 text-sm text-slate-600">{user.company_employee_role}</p>}
              </div>
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <p className="font-semibold">Conta vinculada</p>
                <p className="mt-0.5 text-xs">{user.company_owner_nome || "Responsável da empresa"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold">Áreas liberadas</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {COMPANY_ACCESS_KEYS.map((key) => {
                const level = companyPermissions[key];
                return (
                  <div key={key} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2.5">
                    <span className="text-sm font-medium">{COMPANY_ACCESS_LABELS[key]}</span>
                    <span className={`rounded px-2 py-1 text-[11px] font-semibold ${
                      level === "edit"
                        ? "bg-blue-50 text-blue-700"
                        : level === "view"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                    }`}>
                      {level === "edit" ? "Pode editar" : level === "view" ? "Pode visualizar" : "Sem acesso"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold">Alterar minha senha</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="relative">
                <Input type={showPasswordFields.currentPassword ? "text" : "password"} autoComplete="current-password" placeholder="Senha atual" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} className="pr-10" />
                <button type="button" onClick={() => setShowPasswordFields((fields) => ({ ...fields, currentPassword: !fields.currentPassword }))} aria-label={showPasswordFields.currentPassword ? "Ocultar senha atual" : "Mostrar senha atual"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPasswordFields.currentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
              <div className="relative">
                <Input type={showPasswordFields.newPassword ? "text" : "password"} autoComplete="new-password" placeholder="Nova senha" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} className="pr-10" />
                <button type="button" onClick={() => setShowPasswordFields((fields) => ({ ...fields, newPassword: !fields.newPassword }))} aria-label={showPasswordFields.newPassword ? "Ocultar nova senha" : "Mostrar nova senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPasswordFields.newPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
              <div className="relative">
                <Input type={showPasswordFields.confirmPassword ? "text" : "password"} autoComplete="new-password" placeholder="Confirmar nova senha" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="pr-10" />
                <button type="button" onClick={() => setShowPasswordFields((fields) => ({ ...fields, confirmPassword: !fields.confirmPassword }))} aria-label={showPasswordFields.confirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPasswordFields.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending}
                className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {changePasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Alterar senha
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!membroId) {
    return (
      <div className="min-h-full bg-slate-50 px-4 py-6 text-[#001D34] sm:px-6">
        <div className="mx-auto max-w-4xl space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Minha conta</h1>
            <p className="mt-1 text-sm text-slate-600">Escolha como deseja usar a BUILT. Você pode alterar essas opções quando quiser.</p>
          </div>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold">Finalidades da conta</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {ACCOUNT_PURPOSE_OPTIONS.map((purpose) => {
                const Icon = purpose.icon;
                const selected = accountPurposes.includes(purpose.id);
                return (
                  <div
                    key={purpose.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPurposeConfiguration(purpose.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openPurposeConfiguration(purpose.id);
                      }
                    }}
                    className={`min-h-36 cursor-pointer rounded-lg border p-4 text-left transition-colors ${selected ? ACCOUNT_PURPOSE_STYLES[purpose.id].selected : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-blue-600"><Icon className="h-5 w-5" /></span>
                      {selected && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                    </div>
                    <p className="mt-3 text-sm font-semibold">{purpose.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{purpose.description}</p>
                    {selected ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          openPurposeConfiguration(purpose.id);
                        }}
                        className="mt-3 h-8 gap-1 text-xs text-blue-700"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Configurar intenções
                      </Button>
                    ) : (
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                        <Settings2 className="h-3.5 w-3.5" />
                        Selecionar e configurar
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                disabled={loadingAccountPurposes || updateAccountPurposesMutation.isPending || !accountPurposes.length}
                onClick={() => updateAccountPurposesMutation.mutate({ finalidades: accountPurposes, intencoes: accountObjectives })}
                className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {updateAccountPurposesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar finalidades
              </Button>
            </div>
          </section>
          <section className="rounded-lg border border-blue-100 bg-blue-50 p-5">
            <p className="font-semibold">Gestão gratuita de imóveis liberada</p>
            <p className="mt-1 text-sm text-slate-600">Cadastre e administre seus imóveis pela Carteira, sem limite de quantidade.</p>
            <Button type="button" className="mt-4 bg-[#001D34] text-white hover:bg-[#003052]" onClick={() => { window.location.href = "/?tab=carteira"; }}>
              Abrir Meus Imóveis
            </Button>
          </section>
          {purposeDialog}
        </div>
      </div>
    );
  }

  const foto = fotoUrl(membro?.foto);
  const nome = form.nome || membro?.nome || user?.nome || "";
  const fotoPosition = getPhotoObjectPosition(form);
  const fotoCropDraw = getCropDrawSize();
  const prestadorSelecionado = accountPurposes.includes("profissional");
  const capitalSelecionado = accountPurposes.includes("capital");
  const tiposAliancaSelecionados = uniqueContributionAreas(form.tipos_alianca);
  const papeisBuilt = [
    accountPurposes.includes("imoveis") ? "Imóvel ou oportunidade" : "",
    prestadorSelecionado ? "Prestador de serviços, fornecedor ou profissional independente" : "",
    capitalSelecionado ? "Parceiro de Capital" : "",
  ].filter(Boolean);
  const profileCompletion = getProfileCompletion(form);
  const categoryPending = {
    identity: getProfileCategoryPending(form, "identity"),
    activity: getProfileCategoryPending(form, "activity"),
    company: getProfileCategoryPending(form, "company"),
  };
  const recommendedCategory = profileCompletion.missing.length
    ? getProfileCompletionCategory(profileCompletion.missing[0].key)
    : "activity";
  const recommendationCopy = {
    identity: "Complete seus dados essenciais",
    activity: "Complete sua atuação profissional",
    company: "Complete os dados da sua empresa",
  }[recommendedCategory];
  const recommendationItems = categoryPending[recommendedCategory].slice(0, 2);
  const categoryCopy: Record<ProfileCategory, { title: string; description: string }> = {
    identity: { title: "Identidade e contato", description: "Informações básicas, foto, localização e formalização." },
    activity: { title: "Atuação e interesses", description: "Sua atuação profissional, expertise e áreas de interesse." },
    company: { title: "Empresa e Vitrine", description: "Informações da empresa e presença na Vitrine BUILT." },
    account: { title: "Conta e segurança", description: "Acesso, senha e seu link pessoal de convite." },
  };
  const profileCategories = [
    { key: "identity" as const, icon: User, pending: categoryPending.identity.length },
    { key: "activity" as const, icon: Briefcase, pending: categoryPending.activity.length },
    { key: "company" as const, icon: Store, pending: categoryPending.company.length },
    { key: "account" as const, icon: ShieldCheck, pending: null },
  ];

  function openProfileCategory(category: ProfileCategory) {
    setActiveCategory(category);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function closeProfileCategory() {
    const url = new URL(window.location.href);
    url.searchParams.delete("campo");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setActiveCategory(null);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  const profilePreview = (
    <section className="profile-section p-4 sm:p-6" data-testid="profile-preview">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold text-[#001D34]"
            data-testid="profile-preview-avatar"
          >
            {foto ? <img src={foto} alt={nome} className="h-full w-full object-cover" style={{ objectPosition: fotoPosition }} /> : getInitials(nome || "BU")}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold leading-snug text-[#001D34] sm:text-xl">{nome || "Seu nome"}</p>
                <p className="mt-2 text-sm text-slate-500">{form.cargo || form.especialidade || "Cargo"}</p>
              </div>

              {membroId && (
                <a
                  href={`/aura/${encodeURIComponent(membroId)}`}
                  className="group inline-flex min-h-24 w-fit shrink-0 items-center gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Abrir minha Aura"
                  data-testid="profile-preview-aura"
                >
                  <AuraScore score={auraData?.score ?? null} size="md" showLabel={false} />
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                    {auraData?.score != null ? (auraData.faixa || "Aura") : "Em formação"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </a>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2" aria-label="Áreas de contribuição selecionadas">
              {tiposAliancaSelecionados.length > 0 ? tiposAliancaSelecionados.slice(0, 4).map((tipo) => (
                <span key={tipo} className="rounded bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{getTipoDisplayName(tipo)}</span>
              )) : <span className="text-xs text-slate-500">Nenhuma área selecionada</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-end sm:justify-between xl:min-w-56 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          {user?.membership?.active && (
            <div data-testid="membership-renewal-preview">
              <p className="text-xs text-slate-500">Próxima renovação</p>
              <p className="mt-2 text-lg font-bold text-[#001D34]">
                {user.membership.next_renewal_at
                  ? new Date(user.membership.next_renewal_at).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                  : "Sem data definida"}
              </p>
            </div>
          )}
          <span className={profileCompletion.missing.length === 0
            ? "inline-flex w-fit items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700"
            : "inline-flex w-fit items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700"
          }>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {profileCompletion.missing.length === 0 ? "Completo" : `${profileCompletion.percentage}% completo`}
          </span>
        </div>
      </div>
    </section>
  );

  const profileHub = (
    <div className="w-full space-y-4" data-testid="profile-hub">
      {profilePreview}

        {profileCompletion.missing.length > 0 && <section className="profile-section p-4 sm:p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[10px] border-blue-100 text-2xl font-bold text-[#001D34]" aria-label={`Perfil ${profileCompletion.percentage}% completo`}>
              {profileCompletion.percentage}%
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-[#001D34]">Seu perfil está {profileCompletion.percentage}% completo</p>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">Informações completas geram recomendações, conexões e oportunidades melhores para você.</p>
            </div>
            <Button type="button" onClick={() => openProfileCategory(recommendedCategory)} className="shrink-0 bg-blue-600 text-white hover:bg-blue-700" data-testid="btn-continuar-perfil">
              Continuar preenchimento
            </Button>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${profileCompletion.percentage}%` }} />
          </div>
        </section>}

        <div className="grid gap-3 sm:grid-cols-2">
          {profileCategories.map(({ key, icon: CategoryIcon, pending }) => {
            const complete = pending === 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => openProfileCategory(key)}
                className="profile-section group flex min-h-40 flex-col p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:p-5"
                data-testid={`profile-category-${key}`}
              >
                <span className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600"><CategoryIcon className="h-6 w-6" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#001D34]">{categoryCopy[key].title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">{categoryCopy[key].description}</span>
                  </span>
                </span>
                <span className="mt-auto flex items-end justify-between gap-3 pt-5">
                  {pending === null ? null : complete ? (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3 w-3" />Completo</span>
                  ) : (
                    <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">{pending} {pending === 1 ? "item pendente" : "itens pendentes"}</span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-blue-700">Editar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                </span>
              </button>
            );
          })}
        </div>

        {profileCompletion.missing.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5" data-testid="profile-recommendation">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600"><Flag className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-500">Próxima etapa recomendada</p>
              <p className="mt-1 text-sm font-bold text-[#001D34]">{recommendationCopy}</p>
              <p className="mt-1 text-xs text-slate-500">
                {recommendationItems.length > 0 ? `Faltam apenas ${categoryPending[recommendedCategory].length} ${categoryPending[recommendedCategory].length === 1 ? "item" : "itens"} para fortalecer seu perfil.` : "Revise suas informações para mantê-las atualizadas."}
              </p>
            </div>
            {recommendationItems.length > 0 && (
              <ul className="min-w-36 space-y-1 text-xs text-slate-700">
                {recommendationItems.map((item) => <li key={item.key} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" />{item.label}</li>)}
              </ul>
            )}
            <Button type="button" variant="outline" onClick={() => openProfileCategory(recommendedCategory)} className="shrink-0 border-amber-300 bg-white text-amber-700 hover:bg-amber-100" data-testid="btn-completar-recomendacao">
              Completar agora
            </Button>
          </div>
        </section>}
    </div>
  );

  const profileSummary = (
    <section className="profile-section p-4">
      <p className="text-sm font-bold text-[#001D34]">Resumo do seu perfil</p>
      <div className="mt-4 flex items-center gap-3 border-b border-slate-100 pb-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-100 text-lg font-bold text-[#001D34]">
          {foto ? <img src={foto} alt={nome} className="h-full w-full object-cover" style={{ objectPosition: fotoPosition }} /> : getInitials(nome || "BU")}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-[#001D34]">{nome || "Seu nome"}</p>
          <p className="mt-1 text-xs text-slate-500">{form.cargo || form.especialidade || "Área de Alianças"}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3 text-xs">
        {user?.membership?.active && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3" data-testid="membership-renewal-summary">
            <p className="font-bold text-slate-700">Próxima renovação</p>
            <p className="mt-1 text-sm font-semibold text-[#001D34]">
              {user.membership.next_renewal_at
                ? new Date(user.membership.next_renewal_at).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                : "Sem data definida"}
            </p>
            {user.membership.frozen_at && <p className="mt-1 text-[11px] font-medium text-blue-700">Prazo congelado pela BUILT</p>}
            {user.membership.billing_suspended && <p className="mt-1 text-[11px] font-medium text-amber-700">Cobrança suspensa pela BUILT</p>}
          </div>
        )}
        {membroId && (
          <a
            href={`/aura/${encodeURIComponent(membroId)}`}
            className="flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ borderColor: auraData?.score != null ? `${getFaixaColor(auraData.score)}30` : undefined }}
            aria-label="Abrir minha Aura"
            data-testid="link-resumo-aura"
          >
            <AuraScore score={auraData?.score ?? null} size="sm" showLabel={false} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#001D34]">Aura Percebida</span>
              <span className="mt-1 block text-xs text-slate-500">
                {auraData?.score != null ? auraData.faixa : "Aguardando avaliações"}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-500">
                {auraData?.score != null ? "resultado atual da rede" : "sem avaliações"}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-blue-700" aria-hidden="true">→</span>
          </a>
        )}
        {minhasCelulas.length > 0 && (
          <div className="rounded-lg border bg-white p-3" data-testid="summary-minhas-celulas">
            <p className="flex items-center gap-2 font-bold text-slate-700"><Layers3 className="h-4 w-4 text-blue-600" />Suas Células</p>
            <div className="mt-2 space-y-1.5">
              {minhasCelulas.map((cell) => (
                <a key={cell.id} href={`/comunidade/${cell.community_id}#celulas`} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700">
                  <span className="min-w-0"><strong className="block truncate text-xs">{cell.name}</strong><span className="block truncate text-[10px] text-slate-500">{cell.community_name}</span></span>
                  <span className="shrink-0 text-[10px]">{cell.membership_status === "ACTIVE" ? "Participante" : cell.membership_status === "PENDING" ? "Em análise" : "Interesse"}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="font-bold text-slate-700">Papel na BUILT</p>
          <p className="mt-1 break-words text-slate-600">{papeisBuilt.join(" + ") || "-"}</p>
        </div>
        <div>
          <p className="font-bold text-slate-700">Áreas de contribuição ({tiposAliancaSelecionados.length})</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tiposAliancaSelecionados.length > 0 ? tiposAliancaSelecionados.map(tipo => (
              <span key={tipo} className="max-w-full rounded bg-blue-50 px-2 py-1 font-semibold text-blue-700">{getTipoDisplayName(tipo)}</span>
            )) : <span className="text-slate-500">-</span>}
          </div>
        </div>
        <div className="grid grid-cols-[minmax(88px,110px)_minmax(0,1fr)] gap-2">
          <p className="font-bold text-slate-700">Ramo</p><p className="break-words text-slate-600">{formatRamosDisplay(form.ramo_atuacao) || "-"}</p>
          <p className="font-bold text-slate-700">Segmento</p><p className="break-words text-slate-600">{formatSegmentosDisplay(form.segmento) || "-"}</p>
          <p className="font-bold text-slate-700">Área de atuação</p><p className="break-words text-slate-600">{form.area_atuacao || "-"}</p>
          <p className="font-bold text-slate-700">Localização</p><p className="break-words text-slate-600">{[form.cidade, form.estado].filter(Boolean).join(", ") || "-"}</p>
        </div>
      </div>
    </section>
  );

  return (
    <div className="profile-light-page min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 text-brand-navy">
      <style>{`
        .profile-light-page { background: #f8fafc !important; color: #001d34 !important; }
        .profile-light-page * { min-width: 0; }
        .profile-light-page .profile-aside { background: #001d34; }
        .profile-light-page .profile-onboarding-card,
        .profile-light-page .profile-section {
          border: 1px solid #e2e8f0 !important;
          background: #ffffff !important;
          border-radius: 0.75rem !important;
          box-shadow: none !important;
        }
        .profile-light-page .profile-media-row,
        .profile-light-page .profile-onboarding-card .rounded-xl[style],
        .profile-light-page .profile-onboarding-card .rounded-lg[style] {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
        }
        .profile-light-page input,
        .profile-light-page textarea,
        .profile-light-page button[role="combobox"] {
          background: #f8fafc !important;
          border-color: #d8dee8 !important;
          color: #001d34 !important;
          font-family: inherit !important;
          min-height: 2.5rem;
          box-shadow: none !important;
        }
        .profile-light-page label,
        .profile-light-page .profile-section,
        .profile-light-page .profile-onboarding-card,
        .profile-light-page .profile-section .font-mono,
        .profile-light-page .profile-onboarding-card .font-mono {
          font-family: inherit !important;
          letter-spacing: 0 !important;
        }
        .profile-light-page .profile-section .uppercase,
        .profile-light-page .profile-onboarding-card .uppercase {
          text-transform: none !important;
        }
        .profile-light-page input::placeholder,
        .profile-light-page textarea::placeholder { color: #94a3b8 !important; }
        .profile-light-page input:focus,
        .profile-light-page textarea:focus,
        .profile-light-page button[role="combobox"]:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12) !important;
        }
        .profile-light-page [class*="text-white"] { color: #475569 !important; }
        .profile-light-page .profile-aside [class*="text-white"] { color: inherit !important; }
        .profile-light-page h1,
        .profile-light-page h2,
        .profile-light-page h3,
        .profile-light-page .font-bold { color: #001d34 !important; }
        .profile-light-page [class*="text-brand-gold"],
        .profile-light-page [data-testid^="chip-"],
        .profile-light-page [data-testid^="btn-rede-"] span { color: #1d4ed8 !important; }
        .profile-light-page [data-testid="btn-salvar-perfil"],
        .profile-light-page [data-testid="btn-continuar-perfil"],
        .profile-light-page [data-testid="btn-add-company-employee"] { color: #ffffff !important; }
        .profile-light-page [data-testid="profile-preview-aura"] svg circle:first-of-type {
          stroke: #dbe3ee;
        }
        .profile-light-page [data-testid="switch-perfil-na-vitrine"] {
          background: #cbd5e1 !important;
          border: 1px solid #94a3b8 !important;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.12) !important;
        }
        .profile-light-page [data-testid="switch-perfil-na-vitrine"][data-state="checked"] {
          background: #d7bb7d !important;
          border-color: #9a7430 !important;
        }
        .profile-light-page [data-testid="switch-perfil-na-vitrine"] span {
          background: #ffffff !important;
          border: 1px solid rgba(15, 23, 42, 0.12) !important;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.24) !important;
        }
        .profile-light-page .bg-black\\/60,
        .profile-light-page .bg-black\\/50 { background: rgba(0, 29, 52, 0.68) !important; }
        .profile-light-page .bg-black\\/60 svg,
        .profile-light-page .bg-black\\/50 svg { color: #ffffff !important; }
        .profile-light-page > .mx-auto > .absolute { display: none !important; }
        .profile-light-page > .mx-auto > .relative.z-10 > .relative.shrink-0 { display: none; }
        @media (max-width: 640px) {
          .profile-light-page .profile-section,
          .profile-light-page .profile-onboarding-card {
            border-radius: 0.625rem !important;
          }
        }
      `}</style>
      <header className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        {activeCategory && (
          <button type="button" onClick={closeProfileCategory} className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-semibold text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" data-testid="btn-voltar-profile-hub">
            <ArrowLeft className="h-4 w-4" /> Voltar para Meu Perfil
          </button>
        )}
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#001D34]">
          {activeCategory ? categoryCopy[activeCategory].title : "Meu Perfil"}
          <ModuleInfo title="Meu Perfil" description="Controle o nome público, finalidades, áreas de contribuição, atuação, contatos e dados de formalização usados nos módulos da BUILT." />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          {activeCategory ? categoryCopy[activeCategory].description : "Gerencie suas informações por categoria."}
        </p>
      </header>

      {/* Form */}
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {isLoading ?(
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 bg-white/5" />)}
          </div>
        ) : activeCategory === null ? (
          profileHub
        ) : (
          <>
            {activeCategory !== "account" && <div className="xl:hidden">
              {profileSummary}
            </div>}
            <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,330px)]">
              <div className="min-w-0 space-y-4">
                {activeCategory === "activity" && <>
                <section className="profile-section p-4">
                  <h3 className="text-sm font-bold text-[#001D34]">1. Como você quer usar a BUILT?</h3>
                  <p className="mt-1 text-xs text-slate-500">Selecione um perfil e configure o que deseja fazer na plataforma.</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {ACCOUNT_PURPOSE_OPTIONS.map((purpose) => {
                      const PurposeIcon = purpose.icon;
                      const selected = accountPurposes.includes(purpose.id);
                      return (
                        <div
                          key={purpose.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openPurposeConfiguration(purpose.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openPurposeConfiguration(purpose.id);
                            }
                          }}
                          className={`flex min-h-40 cursor-pointer flex-col rounded-lg border p-3 text-left transition-colors ${
                            selected ? ACCOUNT_PURPOSE_STYLES[purpose.id].selected : "border-slate-200 bg-white hover:border-blue-300"
                          }`}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${ACCOUNT_PURPOSE_STYLES[purpose.id].icon}`}>
                              <PurposeIcon className="h-5 w-5" />
                            </span>
                            {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />}
                          </span>
                          <span className="mt-3 block break-words text-sm font-bold text-[#001D34]">{purpose.title}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-slate-600">{purpose.description}</span>
                          {selected ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                openPurposeConfiguration(purpose.id);
                              }}
                              className="mt-auto h-8 gap-1 pt-0 text-xs text-blue-700"
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                              Configurar intenções
                            </Button>
                          ) : (
                            <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-blue-700">
                              <Settings2 className="h-3.5 w-3.5" />
                              Selecionar e configurar
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="profile-section p-4" data-testid="section-areas-contribuicao">
                  <h3 className="text-sm font-bold text-[#001D34]">2. {publicLabel("ContributionArea")}</h3>
                  <p className="mt-1 text-xs text-slate-500">Selecione as áreas em que você pode contribuir.</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                    {sortContributionAreas(getAllTipos(), (tipo) => tipo.nome).map((tipo) => {
                      const currentTipos = uniqueContributionAreas(form.tipos_alianca);
                      const selected = currentTipos.some((current) => contributionKey(current) === contributionKey(tipo.nome));
                      const label = getTipoDisplayName(tipo.nome);
                      const iconConfig = AREA_ICON_CONFIG[label] || { icon: FolderKanban, color: "text-slate-600", bg: "bg-slate-50" };
                      const AreaIcon = iconConfig.icon;
                      return (
                        <div
                          key={tipo.nome}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            const current = uniqueContributionAreas(form.tipos_alianca);
                            const tipoKey = contributionKey(tipo.nome);
                            const novos = selected ? current.filter(x => contributionKey(x) !== tipoKey) : [...current, tipo.nome];
                            setForm(f => applyContributionAreas(f, novos));
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            const current = uniqueContributionAreas(form.tipos_alianca);
                            const tipoKey = contributionKey(tipo.nome);
                            const novos = selected ? current.filter(x => contributionKey(x) !== tipoKey) : [...current, tipo.nome];
                            setForm(f => applyContributionAreas(f, novos));
                          }}
                          className={`flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                            selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-700 hover:border-blue-300"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${iconConfig.bg} ${iconConfig.color}`}>
                              <AreaIcon className="h-4 w-4" />
                            </span>
                            <span className="truncate">{label}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <ContributionAreaInfo label={label} />
                            {selected && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Áreas selecionadas: {tiposAliancaSelecionados.length}</p>
                </section>

                <section className="profile-section p-4" data-testid="section-celulas-interesse">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#001D34]"><Layers3 className="h-4 w-4 text-blue-600" />3. Tipos de Negócio de interesse</h3>
                  <p className="mt-1 text-xs text-slate-500">Selecione os negócios que interessam a você. O sistema vincula automaticamente cada escolha à Célula correspondente em todas as suas Comunidades.</p>
                  <div className="mt-4 space-y-4">
                    {strategicCellTypes.map((cell) => <div key={cell.code}>
                      <p className="mb-2 text-[11px] font-semibold text-slate-500">{cell.public_name}</p>
                      <div className="flex flex-wrap gap-2">{cell.business_types.map((businessType) => {
                        const selected = strategicCellDraft.business_type_codes.includes(businessType.code);
                        return <button key={businessType.code} type="button" aria-pressed={selected} onClick={() => setStrategicCellDraft((current) => {
                          const businessTypeCodes = selected ? current.business_type_codes.filter((code) => code !== businessType.code) : [...current.business_type_codes, businessType.code];
                          return {
                            business_type_codes: businessTypeCodes,
                            strategic_cell_type_codes: strategicCellTypes.filter((item) => item.business_types.some((type) => businessTypeCodes.includes(type.code))).map((item) => item.code),
                          };
                        })} className={`rounded-full border px-3 py-2 text-xs ${selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>{businessType.public_name}</button>;
                      })}</div>
                    </div>)}
                  </div>
                </section>
                </>}

            {activeCategory === "identity" && <>
            {/* Dados pessoais */}
            <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel icon={User} label="Dados Pessoais" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nome que aparecerá no perfil">
                    <Input
                      value={form.nome || ""}
                      onChange={e => set("nome", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-nome"
                    />
                  </Field>
                  <Field label="E-mail *">
                    <Input
                      value={form.email || ""}
                      onChange={e => set("email", e.target.value)}
                      type="email"
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-email"
                    />
                  </Field>
                  <Field label="Telefone *">
                    <PhoneInput
                      value={form.telefone || ""}
                      onChange={value => set("telefone", value)}
                      required
                      className="bg-white/5 border-white/10"
                      inputClassName="text-white placeholder:text-white/20"
                      selectClassName="bg-white/10 text-white"
                      data-testid="input-perfil-telefone"
                    />
                  </Field>
                  <Field label="WhatsApp">
                    <PhoneInput
                      value={form.whatsapp || ""}
                      onChange={value => set("whatsapp", value)}
                      className="bg-white/5 border-white/10"
                      inputClassName="text-white placeholder:text-white/20"
                      selectClassName="bg-white/10 text-white"
                      data-testid="input-perfil-whatsapp"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* Localização */}
            <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel icon={MapPin} label="Localização" />
                <div
                  className="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all hover:border-brand-gold/30"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
                  onClick={() => setLocationPickerOpen(true)}
                  data-testid="btn-pick-location"
                >
                  <MapPin className="w-4 h-4 text-brand-gold/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {form.cidade ?(
                      <p className="text-sm text-white truncate">
                        {[form.cidade, form.estado, form.pais].filter(Boolean).join(", ")}
                      </p>
                    ) : (
                      <p className="text-sm text-white/25">Selecionar localização…</p>
                    )}
                  </div>
                  <Navigation className="w-3.5 h-3.5 text-brand-gold/40 shrink-0" />
                </div>
                {form.latitude && form.longitude && (
                  <p className="text-[10px] text-white/20 font-mono px-1">
                    GPS: {parseFloat(form.latitude as string).toFixed(5)}, {parseFloat(form.longitude as string).toFixed(5)}
                  </p>
                )}
              </CardContent>
            </Card>
            </>}

            {/* Profissional */}
            {activeCategory !== "account" &&
            <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel
                  icon={activeCategory === "identity" ? User : activeCategory === "company" ? Building2 : Briefcase}
                  label={activeCategory === "identity" ? "Formalização e foto" : activeCategory === "company" ? "Dados da empresa" : "Perfil profissional"}
                />

                {activeCategory === "identity" && <>
                <DadosFormalizacaoSection
                  form={form}
                  setField={set}
                  setForm={setForm}
                  openInitially={requestedProfileTarget?.formal === true}
                />

                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleFotoChange}
                  data-testid="input-foto-perfil"
                />
                </>}
                {activeCategory === "company" &&
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoChange}
                  data-testid="input-logo-empresa"
                />
                }

                {activeCategory === "identity" &&
                <div className="profile-media-row flex flex-wrap items-center gap-3 rounded-lg p-3">
                  <button
                    type="button"
                    onClick={() => fotoInputRef.current?.click()}
                    disabled={uploadingFoto}
                    className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-100 text-sm font-bold text-[#001D34]"
                    title="Clique para trocar a foto"
                    data-testid="btn-trocar-foto"
                  >
                    {uploadingFoto ?(
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    ) : foto ?(
                      <img src={foto} alt={nome} className="h-full w-full object-cover" style={{ objectPosition: fotoPosition }} />
                    ) : (
                      <Camera className="h-5 w-5 text-blue-600" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#001D34]">Foto de perfil</p>
                    <p className="text-[11px] text-slate-500">Adicione uma imagem para aparecer no seu perfil.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fotoInputRef.current?.click()}
                    disabled={uploadingFoto}
                    className="shrink-0 border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                  >
                    {uploadingFoto ? "Enviando..." : foto ? "Trocar foto" : "Adicionar foto"}
                  </Button>
                </div>
                }

                {activeCategory === "company" &&
                <div className="profile-media-row flex flex-wrap items-center gap-3 rounded-lg p-3">
                  <button
                    type="button"
                    className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white"
                    onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                    title="Clique para enviar a logo"
                    data-testid="btn-upload-logo-empresa"
                  >
                    {uploadingLogo ?(
                      <Loader2 className="w-6 h-6 text-brand-gold animate-spin" />
                    ) : form.logo_empresa ?(
                      <>
                        <img
                          src={`/api/assets/${form.logo_empresa}?width=160&height=160&fit=contain`}
                          alt="Logo da empresa"
                          className="w-full h-full object-contain p-1"
                        />
                      </>
                    ) : (
                      <ImageIcon className="h-5 w-5 text-slate-500" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#001D34]">Marca da empresa</p>
                    <p className="text-[11px] text-slate-500">Adicione o logo que aparecera junto ao nome da empresa.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40"
                      data-testid="btn-trocar-logo-empresa"
                    >
                      {uploadingLogo ? "Enviando..." : form.logo_empresa ?"Trocar marca" : "Adicionar marca"}
                    </button>
                    {form.logo_empresa && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, logo_empresa: null }));
                          apiRequest("PATCH", `/api/membros/${membroId}`, { logo_empresa: null });
                        }}
                        className="inline-flex items-center justify-center rounded-md border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-500 hover:border-red-200 hover:text-red-600"
                        data-testid="btn-remover-logo-empresa"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
                }

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeCategory === "company" && <>
                  <Field label="Empresa">
                    <Input
                      value={form.empresa || ""}
                      onChange={e => set("empresa", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-empresa"
                    />
                  </Field>
                  <Field label={`CNPJ${String(form.empresa || "").trim() ? " *" : ""}`}>
                    <Input
                      value={form.cnpj || ""}
                      onChange={e => set("cnpj", e.target.value)}
                      required={!!String(form.empresa || "").trim()}
                      placeholder="00.000.000/0000-00"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-cnpj"
                    />
                  </Field>
                  </>}
                  {activeCategory === "activity" && <>
                  <Field label="Ramo de Atuação">
                    <div className="space-y-2" data-testid="select-perfil-ramo">
                      <Popover open={ramoOpen} onOpenChange={(open) => {
                        setRamoOpen(open);
                        if (!open) setRamoSearch("");
                      }}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-auto min-h-11 w-full justify-between rounded-md border-white/10 bg-white/5 px-3 py-2 text-left font-normal text-white hover:bg-white/10 hover:text-white"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {selectedRamos.length
                                ? `${selectedRamos.length} ramo${selectedRamos.length > 1 ? "s" : ""} selecionado${selectedRamos.length > 1 ? "s" : ""}`
                                : "Buscar e selecionar ramos"}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-white/60" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-[var(--radix-popover-trigger-width)] border-slate-200 bg-white p-0 text-slate-900"
                        >
                          <div className="border-b border-slate-100 p-3">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <Input
                                autoFocus
                                value={ramoSearch}
                                onChange={(event) => setRamoSearch(event.target.value)}
                                placeholder="Pesquisar ramo..."
                                className="h-9 border-slate-200 bg-white pl-9 text-sm text-slate-900 placeholder:text-slate-400"
                                data-testid="input-search-perfil-ramo"
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                              <span>{selectedRamos.length} de {RAMOS_SEGMENTOS.length} selecionado{selectedRamos.length !== 1 ? "s" : ""}</span>
                              {selectedRamos.length > 0 && (
                                <button
                                  type="button"
                                  onClick={clearRamos}
                                  className="font-medium text-blue-600 hover:text-blue-700"
                                >
                                  Limpar
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-72 overflow-y-auto p-2">
                            {filteredRamos.length > 0 ? (
                              filteredRamos.map(r => {
                                const checked = selectedRamos.includes(r.nome);
                                return (
                                  <label
                                    key={r.codigo}
                                    className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors ${
                                      checked ? "bg-blue-50 text-slate-950" : "text-slate-700 hover:bg-slate-50"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() => toggleRamo(r.nome)}
                                      className="mt-0.5 border-slate-300 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
                                    />
                                    <span className="leading-5">{r.nome}</span>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum ramo encontrado.</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {selectedRamos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedRamos.map(ramo => (
                            <span
                              key={ramo}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                            >
                              <span className="truncate">{ramo}</span>
                              <button
                                type="button"
                                onClick={() => toggleRamo(ramo)}
                                className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
                                aria-label={`Remover ${ramo}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Field>
                  <Field label="Cargo">
                    <Input
                      value={form.cargo || ""}
                      onChange={e => set("cargo", e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-perfil-cargo"
                    />
                  </Field>
                  <Field label="Segmento">
                    <div className="space-y-2" data-testid="select-perfil-segmento">
                      <Popover open={segmentoOpen} onOpenChange={(open) => {
                        setSegmentoOpen(open);
                        if (!open) setSegmentoSearch("");
                      }}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={selectedRamos.length === 0}
                            className="h-auto min-h-11 w-full justify-between rounded-md border-white/10 bg-white/5 px-3 py-2 text-left font-normal text-white hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {selectedRamos.length === 0
                                ? "Selecione ao menos um ramo primeiro"
                                : selectedSegmentos.length
                                  ? `${selectedSegmentos.length} segmento${selectedSegmentos.length > 1 ? "s" : ""} selecionado${selectedSegmentos.length > 1 ? "s" : ""}`
                                  : "Buscar e selecionar segmentos"}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-white/60" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-[var(--radix-popover-trigger-width)] border-slate-200 bg-white p-0 text-slate-900"
                        >
                          <div className="border-b border-slate-100 p-3">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <Input
                                autoFocus
                                value={segmentoSearch}
                                onChange={(event) => setSegmentoSearch(event.target.value)}
                                placeholder="Pesquisar segmento..."
                                className="h-9 border-slate-200 bg-white pl-9 text-sm text-slate-900 placeholder:text-slate-400"
                                data-testid="input-search-perfil-segmento"
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                              <span>{selectedSegmentos.length} de {availableSegmentos.length} selecionado{selectedSegmentos.length !== 1 ? "s" : ""}</span>
                              {selectedSegmentos.length > 0 && (
                                <button
                                  type="button"
                                  onClick={clearSegmentos}
                                  className="font-medium text-blue-600 hover:text-blue-700"
                                >
                                  Limpar
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-72 overflow-y-auto p-2">
                            {filteredSegmentos.length > 0 ? (
                              filteredSegmentos.map(s => {
                                const checked = selectedSegmentos.includes(s.nome);
                                return (
                                  <label
                                    key={s.codigo}
                                    className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors ${
                                      checked ? "bg-blue-50 text-slate-950" : "text-slate-700 hover:bg-slate-50"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() => toggleSegmento(s.nome)}
                                      className="mt-0.5 border-slate-300 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
                                    />
                                    <span className="leading-5">{s.nome}</span>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum segmento encontrado.</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {selectedSegmentos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedSegmentos.map(segmento => (
                            <span
                              key={segmento}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                            >
                              <span className="truncate">{segmento}</span>
                              <button
                                type="button"
                                onClick={() => toggleSegmento(segmento)}
                                className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
                                aria-label={`Remover ${segmento}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Field>
                  <Field label="Área de atuação">
                    <Select
                      value={form.area_atuacao || ""}
                      onValueChange={v => setForm(f => ({ ...f, area_atuacao: v }))}
                    >
                      <SelectTrigger
                        className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                        data-testid="select-perfil-area-atuacao"
                      >
                        <SelectValue placeholder="Selecione a área" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#001428] border-white/10 text-white">
                        {PROFILE_AREA_SCOPE_OPTIONS.map(option => (
                          <SelectItem
                            key={option}
                            value={option}
                            className="text-white/80 focus:bg-brand-gold/10 focus:text-white"
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  </>}
                </div>

                {activeCategory === "activity" && <>
                {/* Especialidade livre */}
                <Field label="Especialidade (Descreva seus produtos e serviços)">
                  <Input
                    value={form.especialidade_livre || ""}
                    onChange={e => set("especialidade_livre", e.target.value)}
                    placeholder="Ex: Gestão de contratos, Retrofit, BIM..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                    data-testid="input-perfil-especialidade-livre"
                  />
                </Field>

                {/* Idiomas Falados */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/40 font-mono flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5" />
                    Idiomas Falados
                  </Label>
                  {/* Chips de idiomas selecionados */}
                  {(form.idiomas || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(form.idiomas || []).map(idioma => (
                        <span
                          key={idioma}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono border"
                          style={{ background: "rgba(215,187,125,0.12)", borderColor: "rgba(215,187,125,0.35)", color: "#D7BB7D" }}
                          data-testid={`chip-idioma-${idioma}`}
                        >
                          {idioma}
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, idiomas: (f.idiomas || []).filter(i => i !== idioma) }))}
                            className="ml-0.5 rounded-full hover:text-white transition-colors"
                            data-testid={`btn-remover-idioma-${idioma}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Input + sugestões */}
                  <div className="relative">
                    <Input
                      value={idiomaInput}
                      onChange={e => setIdiomaInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && idiomaInput.trim()) {
                          const val = idiomaInput.trim();
                          if (!(form.idiomas || []).includes(val)) {
                            setForm(f => ({ ...f, idiomas: [...(f.idiomas || []), val] }));
                          }
                          setIdiomaInput("");
                          e.preventDefault();
                        }
                      }}
                      placeholder="Buscar ou digitar idioma..."
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                      data-testid="input-idioma-busca"
                    />
                    {/* Dropdown de sugestões */}
                    {idiomaInput.length > 0 && (
                      <div
                        className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-white/10 overflow-hidden"
                        style={{ background: "#001428", maxHeight: "180px", overflowY: "auto" }}
                      >
                        {[
                          ...PROFILE_LANGUAGE_OPTIONS.filter(i =>
                            i.toLowerCase().includes(idiomaInput.toLowerCase()) && !(form.idiomas || []).includes(i)
                          ),
                          ...(PROFILE_LANGUAGE_OPTIONS.some(i => i.toLowerCase() === idiomaInput.trim().toLowerCase()) || (form.idiomas || []).includes(idiomaInput.trim())
                            ?[]
                            : [idiomaInput.trim()]
                          ),
                        ].map(sugestao => (
                          <button
                            key={sugestao}
                            type="button"
                            onClick={() => {
                              if (!(form.idiomas || []).includes(sugestao)) {
                                setForm(f => ({ ...f, idiomas: [...(f.idiomas || []), sugestao] }));
                              }
                              setIdiomaInput("");
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-brand-gold/10 hover:text-white transition-colors font-mono"
                            data-testid={`opt-idioma-${sugestao}`}
                          >
                            {sugestao === idiomaInput.trim() && !PROFILE_LANGUAGE_OPTIONS.some(i => i.toLowerCase() === sugestao.toLowerCase())
                              ?`+ Adicionar "${sugestao}"`
                              : sugestao}
                          </button>
                        ))}
                        {PROFILE_LANGUAGE_OPTIONS.filter(i =>
                          i.toLowerCase().includes(idiomaInput.toLowerCase()) && !(form.idiomas || []).includes(i)
                        ).length === 0 && (form.idiomas || []).includes(idiomaInput.trim()) && (
                          <p className="px-3 py-2 text-xs text-white/30 font-mono">Idioma já adicionado</p>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Atalhos rápidos */}
                  <div className="flex flex-wrap gap-1.5">
                    {PROFILE_LANGUAGE_OPTIONS.slice(0, 6).filter(i => !(form.idiomas || []).includes(i)).map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, idiomas: [...(f.idiomas || []), i] }))}
                        className="px-2 py-0.5 rounded text-[11px] font-mono border border-white/10 text-white/40 hover:border-brand-gold/30 hover:text-white/70 transition-colors"
                        data-testid={`btn-quick-idioma-${i}`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/20 font-mono">
                    Digite para buscar, pressione Enter para adicionar qualquer idioma.
                  </p>
                </div>

                <Field label="Site / Portfólio">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <Input
                      value={form.link_site || ""}
                      onChange={e => set("link_site", e.target.value)}
                      type="url"
                      placeholder="https://www.seusite.com.br"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 pl-10"
                      data-testid="input-perfil-link-site"
                    />
                  </div>
                </Field>
                <Field label="Biografia">
                  <Textarea
                    value={form.perfil_aliado || ""}
                    onChange={e => set("perfil_aliado", e.target.value)}
                    rows={3}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 resize-none"
                    data-testid="input-perfil-aliado"
                  />
                </Field>

                {/* Selos */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/40 font-mono">Selos</Label>
                  <div className="flex flex-wrap gap-3">
                    {REDES_DISPONIVEIS.map(rede => {
                      const redes = form.Outras_redes_as_quais_pertenco || [];
                      const selected = redes.includes(rede.value);
                      const isBuiltSeal = rede.value.startsWith("BUILT_");
                      const locked = isBuiltSeal && !isSuperAdmin;
                      return (
                        <button
                          key={rede.value}
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            if (locked) return;
                            const current = form.Outras_redes_as_quais_pertenco || [];
                            setForm(f => ({
                              ...f,
                              Outras_redes_as_quais_pertenco: selected
                                ?current.filter(r => r !== rede.value)
                                : [...current, rede.value],
                            }));
                          }}
                          data-testid={`btn-rede-${rede.value.toLowerCase()}`}
                          className="relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all"
                          style={{
                            background: selected ?"rgba(215,187,125,0.1)" : "rgba(255,255,255,0.03)",
                            borderColor: selected ?"rgba(215,187,125,0.4)" : "rgba(255,255,255,0.08)",
                            boxShadow: selected ?"0 0 12px rgba(215,187,125,0.1)" : "none",
                            cursor: locked ?"not-allowed" : "pointer",
                            opacity: locked && !selected ?0.4 : 1,
                          }}
                        >
                          <img
                            src={rede.badge}
                            alt={rede.label}
                            className="h-10 w-auto object-contain rounded"
                            style={{ opacity: selected ?1 : 0.4, filter: selected ?"none" : "grayscale(0.5)" }}
                          />
                          {/* Badge de estado */}
                          {selected ?(
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: "#D7BB7D" }}>
                              <CheckCircle2 className="w-3 h-3 text-[#001D34]" />
                            </span>
                          ) : locked ?(
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
                              <Lock className="w-2.5 h-2.5 text-white/50" />
                            </span>
                          ) : null}
                          <span className="text-[10px] font-mono" style={{ color: selected ?"#D7BB7D" : "rgba(255,255,255,0.3)" }}>
                            {rede.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-white/20 font-mono">
                    Selecione selos para exibir no seu perfil.
                  </p>
                </div>
                </>}
              </CardContent>
            </Card>}

            {/* Vitrine BUILT */}
            {activeCategory === "company" && prestadorSelecionado && <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="pt-5 space-y-4">
                <SectionLabel icon={Globe} label="Vitrine BUILT" />
                <div
                  className="flex flex-col gap-4 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                      Aparecer na Vitrine
                      <span title="Opção exclusiva para profissionais independentes, prestadores de serviços e fornecedores" aria-label="Opção exclusiva para profissionais independentes, prestadores de serviços e fornecedores">
                        <Info className="h-4 w-4 text-white/45" />
                      </span>
                    </p>
                    <p className="text-xs text-white/35 leading-relaxed">
                      Quando ativo, os dados deste perfil serao usados no seu card publico da Vitrine.
                    </p>
                  </div>
                  <Switch
                    checked={!!form.na_vitrine}
                    onCheckedChange={checked => setForm(f => ({ ...f, na_vitrine: checked }))}
                    className="data-[state=checked]:bg-brand-gold data-[state=unchecked]:bg-white/15"
                    data-testid="switch-perfil-na-vitrine"
                  />
                </div>
              </CardContent>
            </Card>}

            {activeCategory === "account" &&
            <section className="profile-section p-4" data-testid="section-alterar-senha">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-bold text-[#001D34]">Alterar senha</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Senha atual">
                  <div className="relative">
                    <Input
                      type={showPasswordFields.currentPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                      className="bg-slate-50 border-slate-200 pr-10 text-[#001D34]"
                      data-testid="input-senha-atual"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      onClick={() => setShowPasswordFields(f => ({ ...f, currentPassword: !f.currentPassword }))}
                      aria-label={showPasswordFields.currentPassword ? "Ocultar senha atual" : "Mostrar senha atual"}
                      data-testid="btn-toggle-senha-atual"
                    >
                      {showPasswordFields.currentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Nova senha">
                  <div className="relative">
                    <Input
                      type={showPasswordFields.newPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                      className="bg-slate-50 border-slate-200 pr-10 text-[#001D34]"
                      data-testid="input-nova-senha"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      onClick={() => setShowPasswordFields(f => ({ ...f, newPassword: !f.newPassword }))}
                      aria-label={showPasswordFields.newPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                      data-testid="btn-toggle-nova-senha"
                    >
                      {showPasswordFields.newPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirmar nova senha">
                  <div className="relative">
                    <Input
                      type={showPasswordFields.confirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      className="bg-slate-50 border-slate-200 pr-10 text-[#001D34]"
                      data-testid="input-confirmar-nova-senha"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      onClick={() => setShowPasswordFields(f => ({ ...f, confirmPassword: !f.confirmPassword }))}
                      aria-label={showPasswordFields.confirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                      data-testid="btn-toggle-confirmar-nova-senha"
                    >
                      {showPasswordFields.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changePasswordMutation.isPending}
                  className="w-full gap-2 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 md:col-span-3"
                  data-testid="btn-alterar-senha"
                >
                  {changePasswordMutation.isPending ?(
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  {changePasswordMutation.isPending ? "Alterando..." : "Alterar senha"}
                </Button>
              </div>
            </section>}

            {/* Meu Convite */}
            {activeCategory === "account" &&
            <Card className="profile-onboarding-card" style={{ background: "#ffffff" }}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Ticket className="w-3.5 h-3.5 text-brand-gold/50" />
                  <span className="text-xs font-mono uppercase tracking-widest text-white/30">Meu Convite</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <p className="text-xs text-white/40 leading-relaxed">
                  Compartilhe seu link para convidar uma pessoa para a jornada BUILT. O link é válido por 1 dia.
                </p>
                {meuConviteLink ?(
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <span className="flex-1 text-xs font-mono text-white/60 truncate" data-testid="text-convite-link">{meuConviteLink}</span>
                      <button
                        onClick={async () => {
                          const copied = await copyTextToClipboard(formatBuiltInviteMessage(meuConviteLink, meuConvite?.expires_at));
                          if (copied) {
                            toast({ title: "Convite copiado!", description: "A mensagem completa está pronta para compartilhar." });
                          } else {
                            toast({ title: "Não foi possível copiar", description: "Selecione o link e copie manualmente.", variant: "destructive" });
                          }
                        }}
                        className="text-brand-gold hover:text-brand-gold/70 transition-colors"
                        data-testid="btn-copiar-convite"
                        title="Copiar link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {meuConvite.expires_at && (
                      <p className="text-[10px] font-mono text-white/25">
                        Expira em: {new Date(meuConvite.expires_at).toLocaleDateString("pt-BR")}
                        {meuConvite.status === "usado" && <span className="ml-2 text-amber-400/60">· utilizado</span>}
                      </p>
                    )}
                    <button
                      onClick={() => gerarConviteMutation.mutate({ force: true })}
                      disabled={gerarConviteMutation.isPending}
                      className="flex items-center gap-1.5 text-xs font-mono text-white/30 hover:text-white/50 transition-colors"
                      data-testid="btn-renovar-convite"
                    >
                      <RefreshCw className={`w-3 h-3 ${gerarConviteMutation.isPending ?"animate-spin" : ""}`} />
                      Gerar novo link
                    </button>
                    <InviteQrCode link={meuConviteLink} />
                  </div>
                ) : (
                  <Button
                    onClick={() => gerarConviteMutation.mutate({ force: false })}
                    disabled={gerarConviteMutation.isPending}
                    size="sm"
                    className="gap-2 font-mono text-xs"
                    style={{ background: "rgba(215,187,125,0.15)", color: "#D7BB7D", border: "1px solid rgba(215,187,125,0.3)" }}
                    data-testid="btn-gerar-convite"
                  >
                    {gerarConviteMutation.isPending ?(
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Ticket className="w-3.5 h-3.5" />
                    )}
                    Gerar link de convite
                  </Button>
                )}
              </CardContent>
            </Card>}

              </div>

              <aside className="min-w-0 space-y-4">
                {activeCategory === "account" ? profileSummary : <div className="hidden xl:block">{profileSummary}</div>}

                {activeCategory === "account" && <>
                <section className="profile-section p-4">
                  <p className="text-sm font-bold text-[#001D34]">Informações atuais</p>
                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    {[
                      form.email && `E-mail: ${form.email}`,
                      form.whatsapp && `WhatsApp: ${form.whatsapp}`,
                      form.empresa && `Empresa: ${form.empresa}`,
                      sanitizeLinkSite(form.link_site) && `Site: ${sanitizeLinkSite(form.link_site)}`,
                    ].filter(Boolean).map(item => (
                      <p key={String(item)} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="break-all">{item}</span>
                      </p>
                    ))}
                  </div>
                </section>

                </>}
              </aside>
            </div>

            {activeCategory !== "account" && hasUnsavedChanges &&
            <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending || updateStrategicCellPreferencesMutation.isPending}
                className="gap-2 bg-blue-600 px-6 text-white shadow-lg hover:bg-blue-700"
                data-testid="btn-salvar-perfil"
              >
                {updateMutation.isPending || updateStrategicCellPreferencesMutation.isPending ?(
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {updateMutation.isPending || updateStrategicCellPreferencesMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>}
          </>
        )}
      </div>

      <LocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={handleLocationSelect}
      />

      {purposeDialog}

      <Dialog open={fotoCropOpen} onOpenChange={(open) => { if (!open && !uploadingFoto) closeFotoCropModal(); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-brand-gold" />
              Ajustar foto de perfil
            </DialogTitle>
            <DialogDescription>
              Arraste a imagem até encaixar a parte importante dentro do círculo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              ref={fotoCropRef}
              className={`relative mx-auto overflow-hidden rounded-xl bg-slate-950 ${isDraggingFoto ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ width: FOTO_CROP_BOX, height: FOTO_CROP_BOX, maxWidth: "100%", touchAction: "none" }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                fotoDragRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  offsetX: fotoCropOffset.x,
                  offsetY: fotoCropOffset.y,
                };
                setIsDraggingFoto(true);
              }}
              onPointerMove={(e) => {
                const start = fotoDragRef.current;
                if (!start) return;
                setFotoCropOffset(clampCropOffset({
                  x: start.offsetX + e.clientX - start.x,
                  y: start.offsetY + e.clientY - start.y,
                }));
              }}
              onPointerUp={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                fotoDragRef.current = null;
                setIsDraggingFoto(false);
              }}
              onPointerCancel={() => {
                fotoDragRef.current = null;
                setIsDraggingFoto(false);
              }}
              onWheel={(e) => {
                e.preventDefault();
                const direction = e.deltaY > 0 ? -1 : 1;
                const nextZoom = Math.max(1, Math.min(3, fotoCropZoom + direction * 0.08));
                setFotoCropZoom(nextZoom);
                setFotoCropOffset((offset) => clampCropOffset(offset, nextZoom));
              }}
              data-testid="modal-crop-foto"
            >
              {fotoCropSrc && (
                <img
                  ref={fotoCropImageRef}
                  src={fotoCropSrc}
                  alt="Prévia da foto"
                  draggable={false}
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    setFotoCropNatural({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
                    setFotoCropOffset({ x: 0, y: 0 });
                  }}
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: fotoCropDraw.width,
                    height: fotoCropDraw.height,
                    transform: `translate(-50%, -50%) translate(${fotoCropOffset.x}px, ${fotoCropOffset.y}px)`,
                  }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-black/45" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="rounded-full border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.45)]"
                  style={{ width: FOTO_CROP_BOX - 28, height: FOTO_CROP_BOX - 28 }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-45">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="border border-white/35" />
                ))}
              </div>
              <div className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-white" />
              <div className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-white" />
              <div className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-white" />
              <div className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-white" />
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Use o scroll do mouse sobre a imagem para aproximar ou afastar.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeFotoCropModal} disabled={uploadingFoto}>
              Cancelar
            </Button>
            <Button
              onClick={uploadCroppedFoto}
              disabled={uploadingFoto || !fotoCropSrc}
              className="gap-2 bg-brand-navy text-white hover:bg-brand-navy/90"
              data-testid="btn-confirmar-recorte-foto"
            >
              {uploadingFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {uploadingFoto ? "Salvando..." : "Salvar foto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DadosFormalizacaoSection({
  form,
  setField,
  setForm,
  openInitially = false,
}: {
  form: Partial<Membro>;
  setField: (field: keyof Membro, value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<Partial<Membro>>>;
  openInitially?: boolean;
}) {
  const estadoCivil = String(form.estado_civil || "").toLowerCase();
  const temConjuge = ["casado", "casada", "uniao_estavel", "união_estável"].includes(estadoCivil);
  const mesmoEndereco = form.mesmo_endereco !== false;
  const [open, setOpen] = useState(openInitially);
  const [cepLoading, setCepLoading] = useState<string | null>(null);

  const applyCep = async (
    rawCep: string,
    fields: {
      cep: keyof Membro;
      endereco: keyof Membro;
      bairro: keyof Membro;
      cidade: keyof Membro;
      estado: keyof Membro;
      pais: keyof Membro;
    },
  ) => {
    const digits = rawCep.replace(/\D/g, "").slice(0, 8);
    setField(fields.cep, digits);
    if (digits.length !== 8) return;

    const loadingKey = String(fields.cep);
    setCepLoading(loadingKey);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.erro) return;
      setForm(current => {
        const next = { ...current, [fields.cep]: digits } as Partial<Membro>;
        if (data.logradouro) next[fields.endereco] = data.logradouro;
        if (data.bairro) next[fields.bairro] = data.bairro;
        if (data.localidade) next[fields.cidade] = data.localidade;
        if (data.uf) next[fields.estado] = data.uf;
        Object.assign(next, { [fields.pais]: current[fields.pais] || "Brasil" });
        return next;
      });
    } catch (error) {
      console.warn("[perfil] Nao foi possivel buscar o CEP", error);
    } finally {
      setCepLoading(current => (current === loadingKey ? null : current));
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-slate-200 bg-white">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
          data-testid="toggle-dados-formalizacao"
        >
          <ReceiptText className="w-3.5 h-3.5 text-[#9a7430]" />
          <span className="text-sm font-semibold text-[#001D34]">Dados para formalização</span>
          <div className="h-px flex-1 bg-slate-200" />
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-4 pb-4">
        <p className="text-xs text-slate-500">
          Estes dados serão exigidos somente quando você aceitar um papel de diretor ou sócio em uma BIA.
        </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome completo">
          <Input value={form.nome_completo || ""} onChange={e => setField("nome_completo", e.target.value)} data-testid="input-formalizacao-nome-completo" />
        </Field>
        <Field label="Nacionalidade">
          <Input value={form.nacionalidade || ""} onChange={e => setField("nacionalidade", e.target.value)} data-testid="input-perfil-nacionalidade" />
        </Field>
        <Field label="Profissão">
          <Input value={form.profissao || ""} onChange={e => setField("profissao", e.target.value)} data-testid="input-perfil-profissao" />
        </Field>
        <Field label="Nome da mãe">
          <Input value={form.nome_mae || ""} onChange={e => setField("nome_mae", e.target.value)} data-testid="input-perfil-nome-mae" />
        </Field>
        <Field label="Nome do pai">
          <Input value={form.nome_pai || ""} onChange={e => setField("nome_pai", e.target.value)} data-testid="input-perfil-nome-pai" />
        </Field>
        <Field label="Data de nascimento">
          <Input type="date" value={form.data_nascimento || ""} onChange={e => setField("data_nascimento", e.target.value)} data-testid="input-perfil-data-nascimento" />
        </Field>
        <Field label="CPF">
          <Input value={form.cpf || ""} onChange={e => setField("cpf", e.target.value)} inputMode="numeric" placeholder="000.000.000-00" data-testid="input-formalizacao-cpf" />
        </Field>
        <Field label="RG">
          <Input value={form.rg || ""} onChange={e => setField("rg", e.target.value)} data-testid="input-perfil-rg" />
        </Field>
        <Field label="Estado civil">
          <Select value={form.estado_civil || ""} onValueChange={value => setField("estado_civil", value)}>
            <SelectTrigger data-testid="select-perfil-estado-civil">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_CIVIL_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {temConjuge && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Regime de comunhão">
              <Select value={form.regime_comunhao || ""} onValueChange={value => setField("regime_comunhao", value)}>
                <SelectTrigger data-testid="select-perfil-regime-comunhao">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {REGIME_COMUNHAO_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nome completo do cônjuge">
              <Input value={form.conjuge_nome_completo || ""} onChange={e => setField("conjuge_nome_completo", e.target.value)} data-testid="input-perfil-conjuge-nome" />
            </Field>
            <Field label="Nacionalidade do cônjuge">
              <Input value={form.conjuge_nacionalidade || ""} onChange={e => setField("conjuge_nacionalidade", e.target.value)} />
            </Field>
            <Field label="Profissão do cônjuge">
              <Input value={form.conjuge_profissao || ""} onChange={e => setField("conjuge_profissao", e.target.value)} />
            </Field>
            <Field label="Nome da mãe do cônjuge">
              <Input value={form.conjuge_nome_mae || ""} onChange={e => setField("conjuge_nome_mae", e.target.value)} />
            </Field>
            <Field label="Nome do pai do cônjuge">
              <Input value={form.conjuge_nome_pai || ""} onChange={e => setField("conjuge_nome_pai", e.target.value)} />
            </Field>
            <Field label="Data de nascimento do cônjuge">
              <Input type="date" value={form.conjuge_data_nascimento || ""} onChange={e => setField("conjuge_data_nascimento", e.target.value)} />
            </Field>
            <Field label="E-mail do cônjuge">
              <Input type="email" value={form.conjuge_email || ""} onChange={e => setField("conjuge_email", e.target.value)} />
            </Field>
            <Field label="Telefone do cônjuge">
              <PhoneInput value={form.conjuge_telefone || ""} onChange={value => setField("conjuge_telefone", value)} />
            </Field>
            <Field label="CPF do cônjuge">
              <Input value={form.conjuge_cpf || ""} onChange={e => setField("conjuge_cpf", e.target.value)} />
            </Field>
            <Field label="RG do cônjuge">
              <Input value={form.conjuge_rg || ""} onChange={e => setField("conjuge_rg", e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <Checkbox
              checked={mesmoEndereco}
              onCheckedChange={checked => setForm(current => ({ ...current, mesmo_endereco: checked === true }))}
              data-testid="checkbox-perfil-mesmo-endereco"
            />
            Ambos residem no mesmo local
          </label>
        </div>
      )}

      {temConjuge && !mesmoEndereco ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Endereço do titular</p>
            <Field label="CEP"><Input value={form.titular_cep || ""} onChange={e => applyCep(e.target.value, { cep: "titular_cep", endereco: "titular_endereco", bairro: "titular_bairro", cidade: "titular_cidade", estado: "titular_estado", pais: "titular_pais" })} inputMode="numeric" /></Field>
            {cepLoading === "titular_cep" && <p className="text-xs text-slate-500">Buscando CEP...</p>}
            <Field label="Endereço"><Input value={form.titular_endereco || ""} onChange={e => setField("titular_endereco", e.target.value)} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nº"><Input value={form.titular_numero || ""} onChange={e => setField("titular_numero", e.target.value)} /></Field>
              <Field label="Complemento"><Input value={form.titular_complemento || ""} onChange={e => setField("titular_complemento", e.target.value)} /></Field>
            </div>
            <Field label="Bairro"><Input value={form.titular_bairro || ""} onChange={e => setField("titular_bairro", e.target.value)} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Cidade"><Input value={form.titular_cidade || ""} onChange={e => setField("titular_cidade", e.target.value)} /></Field>
              <Field label="Estado"><Input value={form.titular_estado || ""} onChange={e => setField("titular_estado", e.target.value)} /></Field>
              <Field label="País"><Input value={form.titular_pais || ""} onChange={e => setField("titular_pais", e.target.value)} /></Field>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Endereço do cônjuge</p>
            <Field label="CEP"><Input value={form.conjuge_cep || ""} onChange={e => applyCep(e.target.value, { cep: "conjuge_cep", endereco: "conjuge_endereco", bairro: "conjuge_bairro", cidade: "conjuge_cidade", estado: "conjuge_estado", pais: "conjuge_pais" })} inputMode="numeric" /></Field>
            {cepLoading === "conjuge_cep" && <p className="text-xs text-slate-500">Buscando CEP...</p>}
            <Field label="Endereço"><Input value={form.conjuge_endereco || ""} onChange={e => setField("conjuge_endereco", e.target.value)} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nº"><Input value={form.conjuge_numero || ""} onChange={e => setField("conjuge_numero", e.target.value)} /></Field>
              <Field label="Complemento"><Input value={form.conjuge_complemento || ""} onChange={e => setField("conjuge_complemento", e.target.value)} /></Field>
            </div>
            <Field label="Bairro"><Input value={form.conjuge_bairro || ""} onChange={e => setField("conjuge_bairro", e.target.value)} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Cidade"><Input value={form.conjuge_cidade || ""} onChange={e => setField("conjuge_cidade", e.target.value)} /></Field>
              <Field label="Estado"><Input value={form.conjuge_estado || ""} onChange={e => setField("conjuge_estado", e.target.value)} /></Field>
              <Field label="País"><Input value={form.conjuge_pais || ""} onChange={e => setField("conjuge_pais", e.target.value)} /></Field>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="CEP">
            <Input value={form.cep || ""} onChange={e => applyCep(e.target.value, { cep: "cep", endereco: "endereco", bairro: "bairro", cidade: "cidade", estado: "estado", pais: "pais" })} inputMode="numeric" data-testid="input-perfil-cep" />
            {cepLoading === "cep" && <p className="mt-1 text-xs text-slate-500">Buscando CEP...</p>}
          </Field>
          <Field label="Endereço">
            <Input value={form.endereco || ""} onChange={e => setField("endereco", e.target.value)} data-testid="input-perfil-endereco" />
          </Field>
          <Field label="Nº">
            <Input value={form.numero || ""} onChange={e => setField("numero", e.target.value)} data-testid="input-perfil-numero" />
          </Field>
          <Field label="Complemento">
            <Input value={form.complemento || ""} onChange={e => setField("complemento", e.target.value)} data-testid="input-perfil-complemento" />
          </Field>
          <Field label="Bairro">
            <Input value={form.bairro || ""} onChange={e => setField("bairro", e.target.value)} data-testid="input-perfil-bairro" />
          </Field>
          <Field label="Cidade">
            <Input value={form.cidade || ""} onChange={e => setField("cidade", e.target.value)} data-testid="input-perfil-cidade-contratual" />
          </Field>
          <Field label="Estado">
            <Input value={form.estado || ""} onChange={e => setField("estado", e.target.value)} data-testid="input-perfil-estado-contratual" />
          </Field>
          <Field label="País">
            <Input value={form.pais || ""} onChange={e => setField("pais", e.target.value)} data-testid="input-perfil-pais-contratual" />
          </Field>
        </div>
      )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-3.5 h-3.5 text-[#9a7430]" />
      <span className="text-sm font-semibold text-[#001D34]">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}
