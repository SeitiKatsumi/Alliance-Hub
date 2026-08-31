import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Eye, EyeOff, LogIn, UserPlus, Ticket, CheckCircle, XCircle, KeyRound, ArrowLeft, ArrowRight, Mail,
  Store, TrendingUp, Handshake, Shield, Send, Crown, FolderKanban, Scale, Lightbulb,
  ShieldCheck, CircleCheck, Truck, BriefcaseBusiness, Tags, Megaphone, Building2, Users,
  ChartNoAxesCombined, ReceiptText, CircleDollarSign, Camera, Info, Search, ChevronDown, X, MapPin, House,
} from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import builtLogo from "@assets/Logo_Built_2_Horizontal_Branca_Nova.png";
import { TERM_CONFIG, getRequiredTermKeys, type TermKey } from "./adesao";
import { formatRamosDisplay, formatRamosValue, formatSegmentosDisplay, formatSegmentosValue, getAllTipos, getNucleosForTipos, getSegmentosForRamos, getTipoDisplayName, parseRamosValue, parseSegmentosValue, RAMOS_SEGMENTOS } from "@/lib/ramos-segmentos";
import { PhoneInput, hasInternationalDialCode } from "@/components/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACCEPTANCE_LOCATION_NOTICE, captureRequiredAcceptanceLocation } from "@/lib/acceptanceLocation";
import { PROFILE_AREA_SCOPE_OPTIONS, PROFILE_LANGUAGE_OPTIONS } from "@shared/profile-taxonomy";
import { usePublicLabels } from "@/hooks/use-public-labels";

interface ConviteInfo {
  gerador_nome: string | null;
  comunidade_nome: string | null;
  tipo?: "unificado" | "vitrine" | "capital" | "membros" | "associacao_completa" | null;
  expires_at: string | null;
}

const CONVITE_INTERESSES: Record<string, string[]> = {
  unificado: [],
  vitrine: ["profissional"],
  capital: ["capital"],
  membros: ["profissional"],
  associacao_completa: ["profissional"],
};

const BUILT_CAPITAL_TIPO = "Alianças de Aporte Financeiro";
const BUILT_CAPITAL_RAMO = "Desenvolvimento Imobiliário & Negócios Aplicados";
const BUILT_CAPITAL_SEGMENTO = "Análise de viabilidade financeira e técnica";
const AREA_OPTIONS = getAllTipos().map(tipo => tipo.nome);
const DEFAULT_AREAS: string[] = [];
const PROPERTY_INTENT_OPTIONS = [
  ["gerir", "Apenas cadastrar e gerir"],
  ["vender", "Vender"],
  ["alugar", "Alugar"],
  ["reformar", "Reformar"],
  ["construir", "Construir"],
  ["regularizar", "Regularizar"],
  ["estruturar_alianca", "Estruturar uma Aliança BUILT"],
] as const;
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
const AREA_ICON_CONFIG: Record<string, { icon: typeof Crown; color: string; bg: string }> = {
  "Liderança Técnica": { icon: Crown, color: "text-blue-600", bg: "bg-blue-50" },
  "Liderança de Obras": { icon: Crown, color: "text-emerald-600", bg: "bg-emerald-50" },
  "Liderança Comercial": { icon: Crown, color: "text-purple-600", bg: "bg-purple-50" },
  "Liderança de Capital": { icon: Crown, color: "text-orange-600", bg: "bg-orange-50" },
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

function contributionAreaSortKey(value: string): string {
  return getTipoDisplayName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function sortContributionAreas<T>(items: T[], getValue: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const aKey = contributionAreaSortKey(getValue(a));
    const bKey = contributionAreaSortKey(getValue(b));
    const aIndex = CONTRIBUTION_AREA_ORDER_MAP.get(aKey) ?? 999;
    const bIndex = CONTRIBUTION_AREA_ORDER_MAP.get(bKey) ?? 999;
    return aIndex === bIndex ? aKey.localeCompare(bKey) : aIndex - bIndex;
  });
}

const AREA_INFO_CONFIG: Record<string, { nucleo: string; cpp: string; description: string; footer?: string }> = {
  "Liderança Técnica": { nucleo: "Diretoria da Aliança", cpp: "Liderança Técnica", description: "Coordenação técnica, integração das alianças técnicas, viabilidade, conformidade e prevenção de riscos." },
  "Liderança de Obras": { nucleo: "Diretoria da Aliança", cpp: "Liderança de Obras", description: "Coordenação da execução, integração de equipes, fornecedores, cronograma, qualidade e aderência aos projetos." },
  "Liderança Comercial": { nucleo: "Diretoria da Aliança", cpp: "Liderança Comercial", description: "Coordenação comercial, integração de vendas, locação, marketing, relacionamento e geração de receita." },
  "Liderança de Capital": { nucleo: "Diretoria da Aliança", cpp: "Liderança de Capital", description: "Coordenação econômica e financeira, integração de investimentos, captação, controle, prestação de contas e resultados." },
  "Projeto": { nucleo: "Núcleo de Alianças Técnicas", cpp: "CPP Técnica", description: "Arquitetos, engenheiros, projetistas, designers, urbanistas e demais profissionais responsáveis pela concepção, desenvolvimento, compatibilização e detalhamento técnico dos projetos.", footer: "Contribui para a viabilidade técnica, consistência dos projetos e conformidade das entregas." },
  "Jurídicas": { nucleo: "Núcleo de Alianças Técnicas", cpp: "CPP Técnica", description: "Profissionais especializados em direito imobiliário, societário, contratual, urbanístico, regulatório e compliance jurídico, responsáveis pela segurança jurídica das operações, contratos, ativos e relações da BIA.", footer: "Ajuda a garantir conformidade legal e prevenção de riscos." },
  "Inteligência": { nucleo: "Núcleo de Alianças Técnicas", cpp: "CPP Técnica", description: "Especialistas em inteligência de mercado, estudos de viabilidade, análise de produto, estratégia imobiliária, masterplan, posicionamento e modelagem da oportunidade.", footer: "Apoia decisões estratégicas e leitura de mercado da BIA." },
  "Integridade e sustentabilidade": { nucleo: "Núcleo de Alianças Técnicas", cpp: "CPP Técnica", description: "Profissionais de compliance, segurança, qualidade, consultoria, auditoria, meio ambiente e ESG, responsáveis por fortalecer conformidade, prevenção de riscos, qualidade das entregas e sustentabilidade da BIA." },
  "Execução": { nucleo: "Núcleo de Alianças de Obras", cpp: "CPP de Obra", description: "Profissionais e equipes responsáveis pela execução direta dos serviços de obra, incluindo engenheiros de obra, mestres, encarregados, supervisores, técnicos e demais executores especializados." },
  "Construção": { nucleo: "Núcleo de Alianças de Obras", cpp: "CPP de Obra", description: "Construtoras, empreiteiras, subempreiteiras e empresas especializadas responsáveis pela execução de etapas construtivas, frentes de serviço, instalações, montagem, reforma, retrofit ou construção integral." },
  "Fornecimento": { nucleo: "Núcleo de Alianças de Obras", cpp: "CPP de Obra", description: "Fornecedores de materiais, insumos, equipamentos, ferramentas, sistemas construtivos, soluções técnicas e serviços logísticos necessários à execução da obra.", footer: "Garante execução física com controle de prazo, custo, qualidade, fornecimento e aderência aos projetos aprovados." },
  "Comerciais": { nucleo: "Núcleo de Alianças Comerciais", cpp: "CPP Comercial", description: "Corretores, executivos de negócios, articuladores comerciais e parceiros de mercado responsáveis por prospecção, abertura de portas, negociação, captação de demanda e conversão de oportunidades." },
  "Vendas e Locação": { nucleo: "Núcleo de Alianças Comerciais", cpp: "CPP Comercial", description: "Corretores, consultores, imobiliárias, plataformas e canais especializados responsáveis pela comercialização, locação, permuta, ocupação ou distribuição comercial do ativo." },
  "Marketing": { nucleo: "Núcleo de Alianças Comerciais", cpp: "CPP Comercial", description: "Profissionais e empresas de marketing, branding, performance, conteúdo, mídia, eventos e relacionamento responsáveis por posicionar a BIA, gerar demanda qualificada e fortalecer a percepção de valor do ativo." },
  "Operações e Facilities": { nucleo: "Núcleo de Alianças Comerciais", cpp: "CPP Comercial", description: "Operadores, gestores de facilities, administradoras, manutenção, terceirização e prestadores responsáveis pela operação, conservação, eficiência, ocupação e experiência de uso do ativo." },
  "Gestão de Relacionamento com Cliente": { nucleo: "Núcleo de Alianças Comerciais", cpp: "CPP Comercial", description: "Profissionais e empresas responsáveis por atendimento, pós-venda, SAC, garantias, jornada do cliente, retenção, reputação e continuidade da relação comercial.", footer: "Transforma o ativo físico em ativo econômico por meio de venda, locação, operação, relacionamento e geração de receita." },
  "Aporte Financeiro": { nucleo: "Núcleo de Alianças de Capital", cpp: "CPP de Capital", description: "Investidores, cotistas, financiadores e parceiros de capital responsáveis por aportar recursos financeiros." },
  "Crédito e Captação": { nucleo: "Núcleo de Alianças de Capital", cpp: "CPP de Capital", description: "Bancos, instituições financeiras, fundos, securitizadoras, family offices e parceiros de crédito responsáveis por viabilizar recursos, financiamentos, antecipações, operações de crédito e demais instrumentos de captação para a BIA." },
  "Contábeis e Tributárias": { nucleo: "Núcleo de Alianças de Capital", cpp: "CPP de Capital", description: "Profissionais e empresas responsáveis pela contabilidade, planejamento tributário, obrigações fiscais e acessórias, apuração de tributos, relatórios contábeis, prestação de contas e conformidade fiscal da BIA." },
  "Gestão Financeira": { nucleo: "Núcleo de Alianças de Capital", cpp: "CPP de Capital", description: "Profissionais e empresas responsáveis pelo planejamento financeiro, fluxo de caixa, controladoria, projeções, acompanhamento orçamentário, gestão financeira da operação e suporte à tomada de decisão econômica da BIA.", footer: "Garante gestão econômica, financeira, contábil e tributária com controle de caixa, transparência, conformidade fiscal e apuração segura dos resultados." },
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

const PAIS_OPTIONS = [
  "Brasil", "Argentina", "Chile", "Colômbia", "Estados Unidos", "México", "Paraguai", "Peru", "Portugal", "Uruguai",
];

const ESTADO_OPTIONS = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo", "Goiás", "Maranhão",
  "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí",
  "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina", "São Paulo",
  "Sergipe", "Tocantins",
];

const CIDADE_OPTIONS = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasília", "Curitiba", "Porto Alegre", "Florianópolis", "Salvador",
  "Recife", "Fortaleza", "Goiânia", "Manaus", "Belém", "Vitória", "Campinas", "Santos", "Ribeirão Preto", "Sorocaba",
  "São José dos Campos", "Joinville", "Londrina", "Maringá", "Cuiabá", "Campo Grande", "Natal", "João Pessoa",
];

function getInteressesFromConvite(info?: ConviteInfo | null): string[] {
  return CONVITE_INTERESSES[info?.tipo || "unificado"] || [];
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, loginPending, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const publicLabel = usePublicLabels();

  // Initialize mode immediately from URL — avoids flash of wrong mode
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("reset")) return "reset";
    if (p.get("convite")) return "register";
    return "login";
  });

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Forgot / reset password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotResending, setForgotResending] = useState(false);
  const [forgotResentOk, setForgotResentOk] = useState(false);
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset") || "");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPassword2, setResetPassword2] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);
  const [showResetPass2, setShowResetPass2] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState("");

  // Clean up URL params after reading them and handle Google errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google_failed") {
      setError("Falha ao autenticar com Google. Tente novamente.");
    } else if (params.get("error") === "google_no_invite") {
      setError("Para acessar a plataforma é necessário um convite de um membro da rede BUILT. Acesse via e-mail e senha ou solicite seu convite.");
    }
    // Keep reset token in the URL until the password is actually changed.
    // Removing it on mount can leave the user stuck if the page reloads mid-flow.
    if (window.location.search && !params.get("reset")) {
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  // Register state
  const [regNome, setRegNome] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegPass2, setShowRegPass2] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regPreflightLoading, setRegPreflightLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regInvalidField, setRegInvalidField] = useState("");
  const [regConviteToken, setRegConviteToken] = useState(() => new URLSearchParams(window.location.search).get("convite") || "");
  const [conviteInfo, setConviteInfo] = useState<ConviteInfo | null>(null);
  const [conviteStatus, setConviteStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [conviteChecking, setConviteChecking] = useState(false);

  // Primeiro acesso modal state
  const [showInteressesModal, setShowInteressesModal] = useState(false);
  const [primeiroAcessoStep, setPrimeiroAcessoStep] = useState<"perfil" | "perfil_antigo" | "termos" | "solicitacao" | "final">("perfil");
  const [interessesSelecionados, setInteressesSelecionados] = useState<string[]>([]);
  const [propertyPath, setPropertyPath] = useState<"imovel" | "oportunidade" | "">("");
  const [propertyIntent, setPropertyIntent] = useState("");
  const propertyQuestionsRef = useRef<HTMLElement | null>(null);
  const [regEmpresa, setRegEmpresa] = useState("");
  const [regCargo, setRegCargo] = useState("");
  const [regCpf, setRegCpf] = useState("");
  const regCpfInputRef = useRef<HTMLInputElement | null>(null);
  const [regTelefone, setRegTelefone] = useState("");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [regCidade, setRegCidade] = useState("");
  const [regEstado, setRegEstado] = useState("");
  const [regPais, setRegPais] = useState("Brasil");
  const [regAreaAtuacao, setRegAreaAtuacao] = useState("");
  const [regIdiomas, setRegIdiomas] = useState("");
  const [regIdiomaInput, setRegIdiomaInput] = useState("");
  const [regLinkSite, setRegLinkSite] = useState("");
  const [regFotoPerfil, setRegFotoPerfil] = useState("");
  const [regFotoPreview, setRegFotoPreview] = useState("");
  const [regFotoUploading, setRegFotoUploading] = useState(false);
  const [regLogoEmpresa, setRegLogoEmpresa] = useState("");
  const [regLogoPreview, setRegLogoPreview] = useState("");
  const [regLogoUploading, setRegLogoUploading] = useState(false);
  const [regRamoAtuacao, setRegRamoAtuacao] = useState("");
  const [regSegmento, setRegSegmento] = useState("");
  const [regRamoSearch, setRegRamoSearch] = useState("");
  const [regRamoOpen, setRegRamoOpen] = useState(false);
  const [regSegmentoSearch, setRegSegmentoSearch] = useState("");
  const [regSegmentoOpen, setRegSegmentoOpen] = useState(false);
  const [regPerfilAliado, setRegPerfilAliado] = useState("");
  const [regTiposAlianca, setRegTiposAlianca] = useState<string[]>(DEFAULT_AREAS);
  const [adesaoToken, setAdesaoToken] = useState("");
  const [adesaoConvite, setAdesaoConvite] = useState<any>(null);
  const [checkedTerms, setCheckedTerms] = useState<Record<string, boolean>>({});
  const [activeTerm, setActiveTerm] = useState<TermKey>("codigo_etica");
  const [aceiteLoading, setAceiteLoading] = useState(false);
  const temFinalidadeImoveis = interessesSelecionados.includes("imoveis");
  const temFinalidadeProfissional = interessesSelecionados.includes("profissional");
  const temFinalidadeCapital = interessesSelecionados.includes("capital");
  const temPerfilProfissional = temFinalidadeProfissional || temFinalidadeCapital;
  const somenteFinalidadeCapital = temFinalidadeCapital && !temFinalidadeProfissional;
  const finalidadesProfissionaisLabel = [
    temFinalidadeProfissional ? "Profissional, fornecedor ou empresa" : "",
    temFinalidadeCapital ? "Parceiro de Capital" : "",
  ].filter(Boolean).join(" + ");
  const finalidadesSelecionadasLabel = [
    interessesSelecionados.includes("imoveis") ? "Imóveis e oportunidades" : "",
    finalidadesProfissionaisLabel,
  ].filter(Boolean).join(" + ");

  // Validate convite token when it changes
  useEffect(() => {
    if (!regConviteToken || regConviteToken.length < 10) {
      setConviteInfo(null);
      setConviteStatus("idle");
      return;
    }
    const timeout = setTimeout(async () => {
      setConviteChecking(true);
      try {
        const res = await fetch(`/api/convite-publico/${regConviteToken}`);
        if (res.ok) {
          const data = await res.json();
          setConviteInfo(data);
          setConviteStatus("valid");
        } else {
          setConviteInfo(null);
          setConviteStatus("invalid");
        }
      } catch {
        setConviteInfo(null);
        setConviteStatus("invalid");
      } finally {
        setConviteChecking(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [regConviteToken]);

  useEffect(() => {
    if (!temFinalidadeCapital) return;
    setRegRamoAtuacao(current => current || BUILT_CAPITAL_RAMO);
    setRegSegmento(current => current || BUILT_CAPITAL_SEGMENTO);
    setRegTiposAlianca(current => somenteFinalidadeCapital
      ? [BUILT_CAPITAL_TIPO]
      : current.includes(BUILT_CAPITAL_TIPO) ? current : [...current, BUILT_CAPITAL_TIPO]);
  }, [temFinalidadeCapital, somenteFinalidadeCapital]);

  const selectedRegRamos = parseRamosValue(regRamoAtuacao);
  const selectedRegSegmentos = parseSegmentosValue(regSegmento);
  const availableRegSegmentos = getSegmentosForRamos(selectedRegRamos);
  const normalizeSearch = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizedRegRamoSearch = normalizeSearch(regRamoSearch);
  const filteredRegRamos = RAMOS_SEGMENTOS.filter(ramo => normalizeSearch(ramo.nome).includes(normalizedRegRamoSearch));
  const normalizedRegSegmentoSearch = normalizeSearch(regSegmentoSearch);
  const filteredRegSegmentos = availableRegSegmentos.filter(segmento => normalizeSearch(segmento.nome).includes(normalizedRegSegmentoSearch));

  function toggleRegRamo(ramo: string) {
    const nextRamos = selectedRegRamos.includes(ramo)
      ? selectedRegRamos.filter(item => item !== ramo)
      : [...selectedRegRamos, ramo];
    const availableNames = new Set(getSegmentosForRamos(nextRamos).map(segmento => segmento.nome));
    const nextSegmentos = selectedRegSegmentos.filter(segmento => availableNames.has(segmento));
    setRegRamoAtuacao(formatRamosValue(nextRamos) || "");
    setRegSegmento(formatSegmentosValue(nextSegmentos) || "");
  }

  function clearRegRamos() {
    setRegRamoAtuacao("");
    setRegSegmento("");
    setRegRamoSearch("");
    setRegSegmentoSearch("");
  }

  function toggleRegSegmento(segmento: string) {
    const nextSegmentos = selectedRegSegmentos.includes(segmento)
      ? selectedRegSegmentos.filter(item => item !== segmento)
      : [...selectedRegSegmentos, segmento];
    setRegSegmento(formatSegmentosValue(nextSegmentos) || "");
  }

  function clearRegSegmentos() {
    setRegSegmento("");
    setRegSegmentoSearch("");
  }

  useEffect(() => {
    return () => {
      if (regFotoPreview) URL.revokeObjectURL(regFotoPreview);
      if (regLogoPreview) URL.revokeObjectURL(regLogoPreview);
    };
  }, [regFotoPreview, regLogoPreview]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const submitted = new FormData(e.currentTarget);
    try {
      await login({
        email: String(submitted.get("email") || email).trim(),
        password: String(submitted.get("password") || password),
      });
      navigate("/");
    } catch (err: any) {
      const msg = err?.message || "Credenciais inválidas";
      setError(msg);
      toast({ title: "Erro ao entrar", description: msg, variant: "destructive" });
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setRegInvalidField("");
    if (!regConviteToken) {
      setRegError("Informe o código de convite para se cadastrar.");
      setRegInvalidField("convite");
      return;
    }
    if (conviteStatus === "invalid" || conviteChecking) {
      setRegError("Código de convite inválido ou expirado.");
      setRegInvalidField("convite");
      return;
    }
    if (!regNome.trim() || regNome.trim().length < 2) {
      setRegError("Informe seu nome completo.");
      setRegInvalidField("nome");
      return;
    }
    const normalizedEmail = regEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setRegError("Informe um e-mail válido.");
      setRegInvalidField("email");
      return;
    }
    if (regPassword !== regPassword2) {
      setRegError("As senhas não coincidem");
      setRegInvalidField("password2");
      return;
    }
    if (regPassword.length < 4) {
      setRegError("Senha deve ter pelo menos 4 caracteres");
      setRegInvalidField("password");
      return;
    }
    const normalizedUsername = (regUsername || normalizedEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_")).trim().toLowerCase();
    if (normalizedUsername.length < 3) {
      setRegError("O nome de usuário deve ter pelo menos 3 caracteres.");
      setRegInvalidField("username");
      return;
    }

    setRegPreflightLoading(true);
    try {
      const response = await fetch("/api/register/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convite_token: regConviteToken,
          email: normalizedEmail,
          username: normalizedUsername,
        }),
      });
      const validation = await response.json().catch(() => ({}));
      if (!response.ok || !validation.valid) {
        setRegError(validation.error || "Revise os dados informados.");
        setRegInvalidField(validation.field || "");
        return;
      }
      setRegEmail(normalizedEmail);
      setRegUsername(validation.username || normalizedUsername);
    } catch {
      setRegError("Não foi possível validar seus dados agora. Tente novamente.");
      return;
    } finally {
      setRegPreflightLoading(false);
    }

    setRegLoading(true);
    try {
      const response = await fetch("/api/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          convite_token: regConviteToken,
          nome: regNome.trim(),
          email: normalizedEmail,
          username: normalizedUsername,
          password: regPassword,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setRegError(result.error || "Não foi possível iniciar seu cadastro.");
        setRegInvalidField(result.field || "");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      navigate(result.next_url || "/onboarding/personalizacao");
    } catch {
      setRegError("Não foi possível iniciar seu cadastro agora. Tente novamente.");
    } finally {
      setRegLoading(false);
    }
  }

  function toggleInteresse(valor: string) {
    setRegError("");
    setInteressesSelecionados(prev =>
      prev.includes(valor) ?prev.filter(v => v !== valor) : [...prev, valor]
    );
  }

  function toggleAreaContribuicao(tipo: string) {
    if (somenteFinalidadeCapital || (temFinalidadeCapital && tipo === BUILT_CAPITAL_TIPO)) return;
    setRegTiposAlianca(prev => prev.includes(tipo) ? prev.filter(item => item !== tipo) : [...prev, tipo]);
  }

  async function handleRegFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (regFotoPreview) URL.revokeObjectURL(regFotoPreview);
    setRegFotoPreview(URL.createObjectURL(file));
    setRegFotoUploading(true);
    setRegError("");
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.fileIds?.[0]) throw new Error(json.error || "Upload da foto falhou");
      setRegFotoPerfil(json.fileIds[0]);
    } catch (err: any) {
      setRegFotoPerfil("");
      setRegFotoPreview("");
      setRegError(err.message || "Nao foi possivel enviar a foto de perfil.");
    } finally {
      setRegFotoUploading(false);
    }
  }

  async function handleRegLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (regLogoPreview) URL.revokeObjectURL(regLogoPreview);
    setRegLogoPreview(URL.createObjectURL(file));
    setRegLogoUploading(true);
    setRegError("");
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.fileIds?.[0]) throw new Error(json.error || "Upload da marca falhou");
      setRegLogoEmpresa(json.fileIds[0]);
    } catch (err: any) {
      setRegLogoEmpresa("");
      setRegLogoPreview("");
      setRegError(err.message || "Nao foi possivel enviar a marca da empresa.");
    } finally {
      setRegLogoUploading(false);
    }
  }

  function getRegIdiomasList() {
    return regIdiomas.split(",").map(idioma => idioma.trim()).filter(Boolean);
  }

  function addRegIdioma(idioma?: string) {
    const value = (idioma || regIdiomaInput).trim();
    if (!value) return;
    const atuais = getRegIdiomasList();
    if (!atuais.some(item => item.toLowerCase() === value.toLowerCase())) {
      setRegIdiomas([...atuais, value].join(", "));
    }
    setRegIdiomaInput("");
  }

  function removeRegIdioma(idioma: string) {
    setRegIdiomas(getRegIdiomasList().filter(item => item !== idioma).join(", "));
  }

  async function handleConfirmarCadastro(interessesOverride?: string[]) {
    const selectedInteresses = interessesOverride && interessesOverride.length > 0 ? interessesOverride : interessesSelecionados;
    if (selectedInteresses.length === 0) return;
    setRegError("");
    const isInvestidor = selectedInteresses.includes("capital");
    const isProfessional = selectedInteresses.some((item) => ["profissional", "vitrine", "membros", "capital"].includes(item));
    if (selectedInteresses.includes("imoveis") && (!propertyPath || !propertyIntent)) {
      setRegError("Responda como deseja iniciar sua jornada de imóvel ou oportunidade.");
      propertyQuestionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (isProfessional && !regCpf.trim()) {
      setRegError("Informe seu CPF para continuar.");
      regCpfInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => regCpfInputRef.current?.focus(), 250);
      return;
    }
    if (isProfessional && !hasInternationalDialCode(regTelefone)) {
      setRegError("Informe seu telefone com código internacional.");
      return;
    }
    if (isProfessional && !regCidade.trim()) {
      setRegError("Informe sua cidade para continuar.");
      return;
    }
    if (isProfessional && !regEstado.trim()) {
      setRegError("Informe seu estado para continuar.");
      return;
    }
    if (isProfessional && !regPais.trim()) {
      setRegError("Informe seu país para continuar.");
      return;
    }
    if (isProfessional && !regRamoAtuacao.trim()) {
      setRegError("Selecione seu ramo de atuação.");
      return;
    }
    if (isProfessional && !regSegmento.trim()) {
      setRegError("Selecione seu segmento.");
      return;
    }
    if (isProfessional && regTiposAlianca.length === 0) {
      setRegError("Selecione pelo menos uma área de contribuição.");
      return;
    }
    setRegLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: regNome,
          email: regEmail,
          username: regUsername || regEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
          password: regPassword,
          convite_token: regConviteToken,
          interesses: selectedInteresses,
          cpf: regCpf,
          telefone: regTelefone,
          whatsapp: regWhatsapp,
          empresa: regEmpresa,
          cargo: regCargo,
          cidade: regCidade,
          estado: regEstado,
          pais: regPais,
          area_atuacao: regAreaAtuacao,
          idiomas: regIdiomas.split(",").map(idioma => idioma.trim()).filter(Boolean),
          link_site: regLinkSite,
          foto_perfil: regFotoPerfil,
          logo_empresa: regLogoEmpresa,
          ramo_atuacao: regRamoAtuacao,
          segmento: regSegmento,
          especialidade_livre: regPerfilAliado,
          tipos_alianca: isProfessional ? regTiposAlianca : [],
          nucleos_alianca: isProfessional ? getNucleosForTipos(regTiposAlianca) : [],
          jornada_imovel: selectedInteresses.includes("imoveis") ? {
            path: propertyPath,
            intencao: propertyIntent,
          } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conta");
      if (data.onboarding_token || data.vitrine_token) {
        const token = data.onboarding_token || data.vitrine_token;
        setAdesaoToken(token);
        const conviteRes = await fetch(`/api/convites/${token}`);
        const conviteData = conviteRes.ok ? await conviteRes.json() : null;
        setAdesaoConvite(conviteData);
        const required = getRequiredTermKeys(selectedInteresses);
        setActiveTerm(required[0] || "codigo_etica");
        setCheckedTerms({});
        setShowInteressesModal(true);
        setPrimeiroAcessoStep("termos");
      } else if (data.pagamento_token) {
        navigate(`/pagamento/${data.pagamento_token}`);
      } else {
        toast({ title: "Conta criada!", description: "Você já pode fazer login." });
        setEmail(regEmail);
        setMode("login");
      }
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  const requiredTermKeys = getRequiredTermKeys(interessesSelecionados);
  const activeTermKey = requiredTermKeys.includes(activeTerm) ? activeTerm : requiredTermKeys[0] || "codigo_etica";
  const activeTermConfig = TERM_CONFIG[activeTermKey];
  const allTermsAccepted = requiredTermKeys.every((key) => checkedTerms[key]);

  async function handleAceitarTermosCadastro() {
    if (!adesaoToken || !allTermsAccepted) return;
    setAceiteLoading(true);
    setRegError("");
    try {
      const now = new Date().toISOString();
      const termosAceitos = Object.fromEntries(requiredTermKeys.map((key) => [key, true]));
      const termosVersoes = Object.fromEntries(requiredTermKeys.map((key) => [key, TERM_CONFIG[key].version]));
      const aceite_localizacao = await captureRequiredAcceptanceLocation();
      const res = await fetch(`/api/convites/${adesaoToken}/aceitar-termos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termos_aceitos: termosAceitos,
          termos_versoes: termosVersoes,
          aceito_em: now,
          aceite_localizacao,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao aceitar termos");
      setAdesaoConvite(data);
      if (data.jornada_imoveis_concluida) {
        const redirectUrl = data.redirect_url || "/";
        setShowInteressesModal(false);
        navigate(redirectUrl);
        await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        return;
      }
      setPrimeiroAcessoStep("solicitacao");
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setAceiteLoading(false);
    }
  }

  async function handleEnviarSolicitacaoCadastro() {
    if (!adesaoToken) return;
    setAceiteLoading(true);
    setRegError("");
    try {
      const res = await fetch(`/api/convites/${adesaoToken}/solicitar-acesso`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar solicitação");
      setAdesaoConvite(data);
      setPrimeiroAcessoStep("final");
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setAceiteLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar o e-mail agora.");
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err.message || "Não foi possível enviar o e-mail agora.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResend() {
    if (forgotResending) return;
    setForgotResending(true);
    setForgotError("");
    setForgotResentOk(false);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível reenviar o e-mail agora.");
      setForgotResentOk(true);
      setTimeout(() => setForgotResentOk(false), 4000);
    } catch (err: any) {
      setForgotError(err.message || "Não foi possível reenviar o e-mail agora.");
    } finally {
      setForgotResending(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    if (resetPassword !== resetPassword2) { setResetError("As senhas não coincidem"); return; }
    if (resetPassword.length < 4) { setResetError("Senha deve ter pelo menos 4 caracteres"); return; }
    setResetLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao redefinir senha");
      setResetDone(true);
      window.history.replaceState({}, "", "/login");
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  }

  const inputCls = "h-12 rounded-md border-white/20 bg-[#071321]/70 text-white placeholder:text-white/35 shadow-inner shadow-black/20 focus:border-[#E2B652] focus:ring-[#E2B652]/20";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111E] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_18%,rgba(42,66,96,0.28),transparent_28%),linear-gradient(120deg,#060C15_0%,#0B1A2B_44%,#08121F_100%)]" />
      <div className="pointer-events-none absolute -right-24 -top-36 h-[34rem] w-[34rem] rotate-45 border border-[#D7BB7D]/20" />
      <div className="pointer-events-none absolute -right-16 bottom-16 h-72 w-72 rotate-45 border border-[#D7BB7D]/15" />
      <div className="pointer-events-none absolute left-14 top-28 h-px w-44 rotate-[31deg] bg-[#D7BB7D]/70" />

      <div className="relative grid min-h-screen lg:grid-cols-[35%_65%]">
        <aside className="relative hidden min-h-screen overflow-hidden border-r border-white/5 bg-[#07111E] lg:block">
          <div className="absolute inset-y-0 right-0 w-[68%] overflow-hidden">
            <img src="/dashboard-env/built-env-01.png" alt="" className="h-full w-full object-cover object-left" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07111E] via-[#07111E]/25 to-[#07111E]/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111E]/80 via-transparent to-[#07111E]/20" />
          </div>
          <div className="relative z-10 flex min-h-screen flex-col justify-between p-16">
            <div />
            <div className="mb-28 max-w-52">
              <p className="text-4xl font-light leading-tight tracking-wide text-white">
                Build it.<br />
                <span className="text-[#E2B652]">Own it.</span>
              </p>
              <p className="mt-9 text-sm leading-relaxed text-white/85">
                Builders United for<br />
                Investment, Logistics<br />
                and Trade
              </p>
              <span className="mt-8 block h-0.5 w-6 bg-[#E2B652]" />
            </div>
            <div>
              <img src="/bni-badge.png" alt="BNI Proud Member" className="h-auto w-20 rounded border border-white/20 bg-white p-1" />
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[520px]">
            <div className="mb-8 flex flex-col items-center text-center">
              <img src={builtLogo} alt="BUILT Alliances" className="w-52 sm:w-60" />
              <span className="mt-3 h-0.5 w-10 bg-[#E2B652]" />
            </div>

            <Card className="border-white/20 bg-[#0B1725]/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
              {mode === "forgot" ? (
                <>
                  <CardHeader className="pb-2 pt-8 px-8">
                    <button onClick={() => setMode("login")} className="mb-3 flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white/75">
                      <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
                    </button>
                    <h2 className="text-lg font-semibold text-white">Esqueci minha senha</h2>
                    <p className="mt-0.5 text-xs text-white/45">Informe seu e-mail e enviaremos um link para redefinir a senha.</p>
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    {forgotSent ? (
                      <div className="space-y-3 py-4 text-center">
                        <CheckCircle className="mx-auto h-10 w-10 text-green-400" />
                        <p className="text-sm text-white/80">Se existe uma conta com este e-mail, voce recebera um link em instantes.</p>
                        <p className="text-xs text-white/40">Nao recebeu? Verifique sua caixa de spam ou reenvie abaixo.</p>
                        {forgotError && <p className="text-sm text-red-400">{forgotError}</p>}
                        <button onClick={handleResend} disabled={forgotResending} data-testid="btn-reenviar-email" className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#D7BB7D]/30 py-2.5 text-sm font-semibold text-[#D7BB7D] transition-colors hover:bg-[#D7BB7D]/10 disabled:cursor-not-allowed disabled:opacity-50">
                          {forgotResending ? "Reenviando..." : forgotResentOk ? "E-mail reenviado!" : "Reenviar e-mail"}
                        </button>
                        <button onClick={() => { setMode("login"); setForgotSent(false); setForgotEmail(""); setForgotResentOk(false); }} className="text-xs text-white/35 transition-colors hover:text-white/65">Voltar ao login</button>
                      </div>
                    ) : (
                      <form onSubmit={handleForgot} className="space-y-5">
                        <div className="space-y-2">
                          <Label className="text-sm text-white/75">E-mail da conta</Label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                            <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="seu@email.com" className={`${inputCls} pl-11`} required data-testid="input-forgot-email" />
                          </div>
                        </div>
                        <Button type="submit" disabled={forgotLoading} className="h-12 w-full bg-[#E2B652] font-bold text-[#07111E] hover:bg-[#F0C762]" data-testid="button-forgot-submit">
                          {forgotLoading ? "Enviando..." : "Enviar link de redefinicao"}
                        </Button>
                        {forgotError && <p className="text-center text-sm text-red-400">{forgotError}</p>}
                      </form>
                    )}
                  </CardContent>
                </>
              ) : mode === "reset" ? (
                <>
                  <CardHeader className="pb-2 pt-8 px-8">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><KeyRound className="h-5 w-5 text-[#D7BB7D]" />Nova senha</h2>
                    <p className="mt-0.5 text-xs text-white/45">Defina sua nova senha de acesso a plataforma.</p>
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    {resetDone ? (
                      <div className="space-y-3 py-4 text-center">
                        <CheckCircle className="mx-auto h-10 w-10 text-green-400" />
                        <p className="text-sm text-white/80">Senha redefinida com sucesso!</p>
                        <button onClick={() => { setMode("login"); setResetDone(false); }} className="text-xs text-[#D7BB7D] hover:underline">Fazer login</button>
                      </div>
                    ) : !resetToken ? (
                      <div className="space-y-3 py-4 text-center">
                        <XCircle className="mx-auto h-10 w-10 text-red-400" />
                        <p className="text-sm text-white/80">Link de redefinicao invalido ou incompleto.</p>
                        <button onClick={() => { setMode("forgot"); setResetError(""); }} className="text-xs text-[#D7BB7D] hover:underline">Solicitar novo link</button>
                      </div>
                    ) : (
                      <form onSubmit={handleResetPassword} className="space-y-5">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-sm text-white/75">Nova senha</Label>
                            <div className="relative">
                              <Input type={showResetPass ? "text" : "password"} value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Min. 4 chars" className={`${inputCls} pr-10`} required data-testid="input-reset-password" />
                              <button type="button" onClick={() => setShowResetPass(v => !v)} aria-label={showResetPass ? "Ocultar nova senha" : "Mostrar nova senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                                {showResetPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm text-white/75">Confirmar</Label>
                            <div className="relative">
                              <Input type={showResetPass2 ? "text" : "password"} value={resetPassword2} onChange={e => setResetPassword2(e.target.value)} placeholder="Repita" className={`${inputCls} pr-10 ${resetPassword2 && resetPassword !== resetPassword2 ? "border-red-500/40" : ""}`} required data-testid="input-reset-password2" />
                              <button type="button" onClick={() => setShowResetPass2(v => !v)} aria-label={showResetPass2 ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                                {showResetPass2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                        {resetError && <p className="text-center text-sm text-red-400">{resetError}</p>}
                        <Button type="submit" disabled={resetLoading} className="h-12 w-full bg-[#E2B652] font-bold text-[#07111E] hover:bg-[#F0C762]" data-testid="button-reset-submit">
                          {resetLoading ? "Salvando..." : "Salvar nova senha"}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </>
              ) : mode === "login" ? (
                <CardContent className="px-8 py-8">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm text-white/75">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
                        <Input id="email" name="email" type="email" data-testid="input-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" className={`${inputCls} pl-12`} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm text-white/75">Senha</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
                        <Input id="password" name="password" data-testid="input-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" autoComplete="current-password" className={`${inputCls} pl-12 pr-11`} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 transition-colors hover:text-white/75">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs font-semibold text-[#E2B652] transition-colors hover:text-[#F0C762]" data-testid="link-forgot-password">
                        Esqueci minha senha
                      </button>
                    </div>
                    {error && <p className="text-center text-sm text-red-400">{error}</p>}
                    <Button type="submit" data-testid="button-login" disabled={loginPending} className="h-12 w-full bg-[#E2B652] font-bold text-[#07111E] hover:bg-[#F0C762]">
                      {loginPending ? (
                        "Entrando..."
                      ) : (
                        <span className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
                          <span />
                          <span>Entrar</span>
                          <ArrowRight className="ml-auto h-5 w-5" />
                        </span>
                      )}
                    </Button>
                  </form>
                  <div className="my-6 flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/15" />
                    <span className="text-xs text-white/45">ou</span>
                    <div className="h-px flex-1 bg-white/15" />
                  </div>
                  <Button type="button" data-testid="button-google-login" onClick={() => { window.location.href = "/auth/google"; }} className="h-12 w-full gap-3 border border-white/20 bg-transparent font-semibold text-white hover:bg-white/10" variant="ghost">
                    <SiGoogle className="h-5 w-5 text-[#EA4335]" />
                    Entrar com Google
                  </Button>
                </CardContent>
              ) : (
                <>
                  <CardHeader className="pb-2 pt-8 px-8">
                    <button onClick={() => setMode("login")} className="mb-3 flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white/75">
                      <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
                    </button>
                    <h2 className="text-lg font-semibold text-white">Criar conta</h2>
                    <p className="mt-0.5 text-xs text-white/45">Preencha seus dados para solicitar acesso.</p>
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    <form onSubmit={handleRegister} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-sm text-white/75"><Ticket className="h-3.5 w-3.5 text-[#D7BB7D]" />Codigo de convite <span className="text-red-400">*</span></Label>
                        <div className="relative">
                          <Input value={regConviteToken} onChange={e => { setRegConviteToken(e.target.value.trim()); if (regInvalidField === "convite") setRegInvalidField(""); }} placeholder="Cole o codigo do seu convite" className={`${inputCls} pr-8 ${conviteStatus === "valid" ? "border-green-500/50" : conviteStatus === "invalid" || regInvalidField === "convite" ? "border-red-500/70" : ""}`} data-testid="input-reg-convite" />
                          {conviteChecking && <span className="absolute right-2.5 top-2.5"><span className="block h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white/70" /></span>}
                          {!conviteChecking && conviteStatus === "valid" && <CheckCircle className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-green-400" />}
                          {!conviteChecking && conviteStatus === "invalid" && <XCircle className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-red-400" />}
                        </div>
                        {conviteStatus === "valid" && conviteInfo && <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-300">Convite de <strong>{conviteInfo.gerador_nome || "membro BUILT"}</strong>{conviteInfo.comunidade_nome ? ` - ${conviteInfo.comunidade_nome}` : ""}</div>}
                        {conviteStatus === "invalid" && <p className="text-xs text-red-400">Codigo invalido ou ja utilizado.</p>}
                      </div>
                      <div className="space-y-1.5"><Label className="text-sm text-white/75">Nome completo</Label><Input value={regNome} onChange={e => { setRegNome(e.target.value); if (regInvalidField === "nome") setRegInvalidField(""); }} placeholder="Seu nome" className={`${inputCls} ${regInvalidField === "nome" ? "border-red-500/70" : ""}`} data-testid="input-reg-nome" required /></div>
                      <div className="space-y-1.5"><Label className="text-sm text-white/75">E-mail</Label><Input type="email" value={regEmail} onChange={e => { setRegEmail(e.target.value); if (regInvalidField === "email") setRegInvalidField(""); }} placeholder="seu@email.com" className={`${inputCls} ${regInvalidField === "email" ? "border-red-500/70" : ""}`} data-testid="input-reg-email" required /></div>
                      <div className="space-y-1.5"><Label className="text-sm text-white/75">Nome de usuario</Label><Input value={regUsername} onChange={e => { setRegUsername(e.target.value); if (regInvalidField === "username") setRegInvalidField(""); }} placeholder={regEmail ? regEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase() : "seu_usuario"} className={`${inputCls} ${regInvalidField === "username" ? "border-red-500/70" : ""}`} data-testid="input-reg-username" /></div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label className="text-sm text-white/75">Senha</Label><div className="relative"><Input type={showRegPass ? "text" : "password"} value={regPassword} onChange={e => { setRegPassword(e.target.value); if (regInvalidField === "password") setRegInvalidField(""); }} placeholder="Min. 4 chars" className={`${inputCls} pr-8 ${regInvalidField === "password" ? "border-red-500/70" : ""}`} data-testid="input-reg-password" required /><button type="button" onClick={() => setShowRegPass(v => !v)} aria-label={showRegPass ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">{showRegPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div></div>
                        <div className="space-y-1.5"><Label className="text-sm text-white/75">Confirmar</Label><div className="relative"><Input type={showRegPass2 ? "text" : "password"} value={regPassword2} onChange={e => { setRegPassword2(e.target.value); if (regInvalidField === "password2") setRegInvalidField(""); }} placeholder="Repita" className={`${inputCls} pr-8 ${((regPassword2 && regPassword !== regPassword2) || regInvalidField === "password2") ? "border-red-500/70" : ""}`} data-testid="input-reg-password2" required /><button type="button" onClick={() => setShowRegPass2(v => !v)} aria-label={showRegPass2 ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">{showRegPass2 ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div></div>
                      </div>
                      {regError && <p className="text-center text-sm text-red-400">{regError}</p>}
                      <Button type="submit" data-testid="button-register" disabled={regLoading || regPreflightLoading || conviteChecking || conviteStatus === "invalid"} className="h-12 w-full bg-[#E2B652] font-bold text-[#07111E] hover:bg-[#F0C762]">
                        {regPreflightLoading ? "Validando dados..." : regLoading ? "Criando conta..." : <span className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Criar conta</span>}
                      </Button>
                    </form>
                  </CardContent>
                </>
              )}
            </Card>

            {mode === "login" && (
              <button type="button" onClick={() => setMode("register")} className="mx-auto mt-6 flex h-12 w-full max-w-72 items-center justify-center rounded-md border border-[#D7BB7D]/80 text-sm font-bold text-[#E2B652] transition-colors hover:bg-[#D7BB7D]/10">
                Novo Cadastro
              </button>
            )}

            <p className="mt-8 text-center text-xs text-white/35">
              &copy; {new Date().getFullYear()} BUILT Alliances. Todos os direitos reservados.
            </p>
          </div>
        </main>
      </div>

      {/* Interests modal — step 2 of registration */}
      <Dialog open={showInteressesModal} onOpenChange={(open) => { if (!regLoading) setShowInteressesModal(open); }}>
        <DialogContent className="!fixed !inset-0 !left-0 !top-0 !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-hidden border-0 bg-white p-0 text-[#001D34] shadow-none sm:!rounded-none [&>button.absolute]:hidden">
          <div className="grid h-dvh max-h-dvh min-h-0 md:grid-cols-[220px_1fr]">
            <aside className="hidden md:flex flex-col justify-between bg-[#001D34] p-6 text-white">
              <div>
                <img src={builtLogo} alt="BUILT" className="w-28" />
                <div className="mt-12 space-y-3">
                  <p className="text-xs text-white/70">Primeiro acesso</p>
                  <p className="text-sm font-semibold">
                    {primeiroAcessoStep === "perfil_antigo"
                      ? "Escolha suas finalidades"
                      : primeiroAcessoStep === "perfil"
                        ? "Complete seu perfil"
                        : primeiroAcessoStep === "termos"
                          ? "Aceites do convite"
                          : primeiroAcessoStep === "solicitacao"
                            ? "Solicitação de acesso"
                            : "Acesso concluído"}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    {primeiroAcessoStep === "perfil_antigo" ? (
                      <span className="h-3 w-3 rounded-full bg-[#D7BB7D]" />
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-white/40 text-xs">1</span>
                    )}
                    <span className="h-px flex-1 bg-[#D7BB7D]" />
                    {primeiroAcessoStep === "perfil_antigo" ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-white/40 text-xs">2</span>
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-[#D7BB7D] text-xs font-bold text-[#001D34]">2</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/60">Precisa de ajuda? Fale com nosso time.</p>
            </aside>

            <div className="flex min-h-0 flex-col">
          <DialogHeader className="hidden">
            <DialogTitle className="text-white text-lg font-semibold">Onde você quer participar?</DialogTitle>
            <DialogDescription className="text-white/50 text-sm">
              Selecione uma ou mais áreas de interesse. Isso determina seu fluxo de adesão.
            </DialogDescription>
          </DialogHeader>

          {primeiroAcessoStep === "perfil" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:px-4 md:px-8 md:py-8 md:pb-6">
                <div className="mb-3 space-y-2 md:mb-6">
                  <p className="text-[11px] font-medium text-slate-500 md:text-xs">Inicio / Primeiro acesso</p>
                  <div className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-0.5 text-xl leading-none md:text-3xl">👋</span>
                    <h2 className="max-w-[17rem] text-[26px] font-extrabold leading-[1.08] text-[#001D34] sm:max-w-none md:text-2xl">
                      Vamos personalizar sua experiência
                    </h2>
                  </div>
                  <p className="max-w-2xl text-[15px] leading-relaxed text-slate-600 md:text-sm">
                    Conte-nos mais sobre você para recomendarmos oportunidades, BIAs e conexões mais relevantes.
                  </p>
                </div>
                <div className="grid gap-3 md:gap-4 lg:grid-cols-[1fr_330px]">
                  <div className="space-y-3 md:space-y-4">
                    <section className="rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
                      <h3 className="text-base font-extrabold leading-tight text-[#001D34] md:text-sm md:font-bold">1. Como você quer usar a BUILT?</h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-500 md:text-xs">
                        Marque uma ou mais opções. Você poderá alterar essas finalidades depois.
                      </p>
                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 md:gap-3 lg:grid-cols-3">
                        {[
                          { id: "imoveis", titulo: "Tenho um imóvel ou identifiquei uma oportunidade", desc: "Quero cadastrar, analisar e administrar imóveis.", icon: <House className="h-5 w-5" />, color: "blue" },
                          { id: "profissional", titulo: "Prestador de serviços, fornecedor ou profissional independente", desc: "Atuo oferecendo serviços, insumos ou experiência profissional.", icon: <Store className="h-5 w-5" />, color: "blue" },
                          { id: "capital", titulo: "Parceiro de Capital", desc: "Atuo como investidor ou parceiro de capital.", icon: <TrendingUp className="h-5 w-5" />, color: "green" },
                        ].map((papel) => {
                          const selected = interessesSelecionados.includes(papel.id);
                          const selectedCardClass = papel.color === "green" ? "border-emerald-500 bg-emerald-50/50" : "border-blue-500 bg-blue-50/50";
                          const iconClass = papel.color === "green"
                            ? selected ? "bg-emerald-100 text-emerald-700" : "bg-emerald-50 text-emerald-700"
                            : selected ? "bg-blue-100 text-blue-700" : "bg-blue-50 text-blue-700";
                          const checkClass = papel.color === "green" ? "text-emerald-600" : "text-blue-600";
                          return (
                            <button
                              key={papel.id}
                              type="button"
                              data-testid={`interesse-${papel.id}`}
                              onClick={() => toggleInteresse(papel.id)}
                              className={`rounded-lg border p-3 text-left transition-colors md:p-3 ${selected ? selectedCardClass : "border-slate-200 hover:border-blue-300"}`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full md:h-10 md:w-10 ${iconClass}`}>{papel.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[15px] font-extrabold leading-snug text-[#001D34] md:text-sm md:font-bold">{papel.titulo}</p>
                                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600 md:text-xs">{papel.desc}</p>
                                </div>
                                {selected && <CheckCircle className={`ml-auto h-4 w-4 shrink-0 ${checkClass}`} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {temFinalidadeImoveis && (
                      <section ref={propertyQuestionsRef} className="rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
                        <div>
                          <h3 className="text-base font-extrabold leading-tight text-[#001D34] md:text-sm md:font-bold">2. Sobre o imóvel ou oportunidade</h3>
                          <p className="mt-1 text-[13px] leading-relaxed text-slate-500 md:text-xs">
                            Estas respostas preparam seu primeiro cadastro. Nada será publicado sem sua confirmação.
                          </p>
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="text-sm font-bold text-[#001D34]">O imóvel é seu?</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {[
                              ["imovel", "Tenho um imóvel", "O imóvel ficará na sua área privada de gestão."],
                              ["oportunidade", "Identifiquei uma oportunidade", "Você será registrado como originador, não como proprietário."],
                            ].map(([value, title, description]) => {
                              const selected = propertyPath === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setPropertyPath(value as "imovel" | "oportunidade")}
                                  className={`min-h-20 rounded-md border p-3 text-left transition-colors ${selected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}
                                >
                                  <span className="flex items-center justify-between gap-3 text-sm font-bold text-[#001D34]">
                                    {title}
                                    {selected && <CheckCircle className="h-4 w-4 shrink-0 text-blue-600" />}
                                  </span>
                                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="text-sm font-bold text-[#001D34]">O que você deseja fazer?</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {PROPERTY_INTENT_OPTIONS.map(([value, label]) => {
                              const selected = propertyIntent === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setPropertyIntent(value)}
                                  className={`min-h-11 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${selected ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:border-blue-300"}`}
                                >
                                  {selected && <CheckCircle className="mr-1.5 inline h-3.5 w-3.5" />}
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      </section>
                    )}

                    <section className={`${temPerfilProfissional ? "" : "hidden"} rounded-xl border border-slate-200 bg-white p-3.5 md:p-4`}>
                      <h3 className="text-base font-extrabold leading-tight text-[#001D34] md:text-sm md:font-bold">{temFinalidadeImoveis ? "3" : "2"}. {publicLabel("ContributionArea")}</h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-500 md:text-xs">{somenteFinalidadeCapital ? "Para BUILT Capital, Aporte Financeiro é selecionado automaticamente." : "Selecione as áreas em que você pode contribuir."}</p>
                      <div className="mt-3 grid max-h-[18rem] gap-2 overflow-y-auto pr-1 sm:max-h-none sm:grid-cols-2 sm:overflow-visible sm:pr-0 lg:grid-cols-3">
                        {sortContributionAreas(somenteFinalidadeCapital ? [BUILT_CAPITAL_TIPO] : AREA_OPTIONS, (tipo) => tipo).map((tipo) => {
                          const selected = regTiposAlianca.includes(tipo);
                          const label = getTipoDisplayName(tipo);
                          const iconConfig = AREA_ICON_CONFIG[label] || { icon: FolderKanban, color: "text-slate-600", bg: "bg-slate-50" };
                          const AreaIcon = iconConfig.icon;
                          return (
                            <div
                              key={tipo}
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleAreaContribuicao(tipo)}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                toggleAreaContribuicao(tipo);
                              }}
                              className={`relative flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-[13px] font-semibold transition-colors md:min-h-10 md:text-xs ${selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-700 hover:border-blue-300"}`}
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
                      <p className="mt-2 text-xs text-slate-500">Áreas selecionadas: {regTiposAlianca.length}</p>
                    </section>

                    <div className={`${temPerfilProfissional ? "grid" : "hidden"} gap-3 md:gap-4 lg:grid-cols-2`}>
                      <section className="rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
                        <h3 className="text-sm font-bold text-[#001D34]">{temFinalidadeImoveis ? "4" : "3"}. Ramo de atuação</h3>
                        <div className="mt-2 space-y-2">
                          <Popover open={regRamoOpen} onOpenChange={(open) => {
                            setRegRamoOpen(open);
                            if (!open) setRegRamoSearch("");
                          }}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-auto min-h-10 w-full justify-between rounded-md border-slate-200 bg-white px-3 py-2 text-left font-normal text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {selectedRegRamos.length
                                    ? `${selectedRegRamos.length} ramo${selectedRegRamos.length > 1 ? "s" : ""} selecionado${selectedRegRamos.length > 1 ? "s" : ""}`
                                    : "Buscar e selecionar ramos"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] border-slate-200 bg-white p-0 text-slate-900">
                              <div className="border-b border-slate-100 p-3">
                                <div className="relative">
                                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                  <Input
                                    autoFocus
                                    value={regRamoSearch}
                                    onChange={(event) => setRegRamoSearch(event.target.value)}
                                    placeholder="Pesquisar ramo..."
                                    className="h-9 border-slate-200 bg-white pl-9 text-sm text-slate-900 placeholder:text-slate-400"
                                  />
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                                  <span>{selectedRegRamos.length} de {RAMOS_SEGMENTOS.length} selecionado{selectedRegRamos.length !== 1 ? "s" : ""}</span>
                                  {selectedRegRamos.length > 0 && (
                                    <button type="button" onClick={clearRegRamos} className="font-medium text-blue-600 hover:text-blue-700">
                                      Limpar
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="max-h-72 overflow-y-auto p-2">
                                {filteredRegRamos.length > 0 ? (
                                  filteredRegRamos.map(ramo => {
                                    const checked = selectedRegRamos.includes(ramo.nome);
                                    return (
                                      <label
                                        key={ramo.codigo}
                                        className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors ${checked ? "bg-blue-50 text-slate-950" : "text-slate-700 hover:bg-slate-50"}`}
                                      >
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={() => toggleRegRamo(ramo.nome)}
                                          className="mt-0.5 border-slate-300 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
                                        />
                                        <span className="leading-5">{ramo.nome}</span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum ramo encontrado.</p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>

                          {selectedRegRamos.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {selectedRegRamos.map(ramo => (
                                <span key={ramo} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                  <span className="truncate">{ramo}</span>
                                  <button type="button" onClick={() => toggleRegRamo(ramo)} className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700" aria-label={`Remover ${ramo}`}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <h3 className="mt-4 text-sm font-bold text-[#001D34]">{temFinalidadeImoveis ? "5" : "4"}. Segmento</h3>
                        <div className="mt-2 space-y-2">
                          <Popover open={regSegmentoOpen} onOpenChange={(open) => {
                            setRegSegmentoOpen(open);
                            if (!open) setRegSegmentoSearch("");
                          }}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={selectedRegRamos.length === 0}
                                className="h-auto min-h-10 w-full justify-between rounded-md border-slate-200 bg-white px-3 py-2 text-left font-normal text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {selectedRegRamos.length === 0
                                    ? "Selecione ao menos um ramo primeiro"
                                    : selectedRegSegmentos.length
                                      ? `${selectedRegSegmentos.length} segmento${selectedRegSegmentos.length > 1 ? "s" : ""} selecionado${selectedRegSegmentos.length > 1 ? "s" : ""}`
                                      : "Buscar e selecionar segmentos"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] border-slate-200 bg-white p-0 text-slate-900">
                              <div className="border-b border-slate-100 p-3">
                                <div className="relative">
                                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                  <Input
                                    autoFocus
                                    value={regSegmentoSearch}
                                    onChange={(event) => setRegSegmentoSearch(event.target.value)}
                                    placeholder="Pesquisar segmento..."
                                    className="h-9 border-slate-200 bg-white pl-9 text-sm text-slate-900 placeholder:text-slate-400"
                                  />
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                                  <span>{selectedRegSegmentos.length} de {availableRegSegmentos.length} selecionado{selectedRegSegmentos.length !== 1 ? "s" : ""}</span>
                                  {selectedRegSegmentos.length > 0 && (
                                    <button type="button" onClick={clearRegSegmentos} className="font-medium text-blue-600 hover:text-blue-700">
                                      Limpar
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="max-h-72 overflow-y-auto p-2">
                                {filteredRegSegmentos.length > 0 ? (
                                  filteredRegSegmentos.map(segmento => {
                                    const checked = selectedRegSegmentos.includes(segmento.nome);
                                    return (
                                      <label
                                        key={segmento.codigo}
                                        className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors ${checked ? "bg-blue-50 text-slate-950" : "text-slate-700 hover:bg-slate-50"}`}
                                      >
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={() => toggleRegSegmento(segmento.nome)}
                                          className="mt-0.5 border-slate-300 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
                                        />
                                        <span className="leading-5">{segmento.nome}</span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum segmento encontrado.</p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>

                          {selectedRegSegmentos.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {selectedRegSegmentos.map(segmento => (
                                <span key={segmento} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                  <span className="truncate">{segmento}</span>
                                  <button type="button" onClick={() => toggleRegSegmento(segmento)} className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700" aria-label={`Remover ${segmento}`}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </section>
                      <section className="rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
                        <h3 className="text-sm font-bold text-[#001D34]">5. Perfil Técnico</h3>
                        <Textarea value={regPerfilAliado} onChange={e => setRegPerfilAliado(e.target.value.slice(0, 500))} rows={6} placeholder="Descreva suas principais competências, especialidades e diferenciais técnicos." className="mt-2 resize-none" />
                        <p className="mt-1 text-right text-[11px] text-slate-400">{regPerfilAliado.length}/500</p>
                      </section>
                    </div>

                    <section className={`${temPerfilProfissional ? "" : "hidden"} rounded-xl border border-slate-200 bg-white p-4`}>
                      <h3 className="text-sm font-bold text-[#001D34]">Dados complementares</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-blue-100 text-sm font-bold text-[#001D34]">
                          {regFotoPreview ? (
                            <img src={regFotoPreview} alt="Foto de perfil" className="h-full w-full object-cover" />
                          ) : (
                            <Camera className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#001D34]">Foto de perfil</p>
                          <p className="text-[11px] text-slate-500">Adicione uma imagem para aparecer no seu perfil.</p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
                          {regFotoUploading ? "Enviando..." : regFotoPerfil ? "Trocar foto" : "Adicionar foto"}
                          <input type="file" accept="image/*" onChange={handleRegFotoChange} disabled={regFotoUploading} className="hidden" />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg bg-white text-sm font-bold text-[#001D34]">
                          {regLogoPreview ? (
                            <img src={regLogoPreview} alt="Marca da empresa" className="h-full w-full object-contain p-1" />
                          ) : (
                            <Building2 className="h-5 w-5 text-slate-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#001D34]">Marca da empresa</p>
                          <p className="text-[11px] text-slate-500">Adicione o logo que aparecerá junto ao nome da empresa.</p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
                          {regLogoUploading ? "Enviando..." : regLogoEmpresa ? "Trocar marca" : "Adicionar marca"}
                          <input type="file" accept="image/*" onChange={handleRegLogoChange} disabled={regLogoUploading} className="hidden" />
                        </label>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Input value={regEmpresa} onChange={e => setRegEmpresa(e.target.value)} placeholder="Empresa" />
                        <Input value={regCargo} onChange={e => setRegCargo(e.target.value)} placeholder="Cargo" />
                        <div className="space-y-1.5">
                          <Label htmlFor="cadastro-cpf" className="text-xs font-semibold text-slate-700">CPF *</Label>
                          <Input
                            id="cadastro-cpf"
                            ref={regCpfInputRef}
                            value={regCpf}
                            onChange={e => setRegCpf(e.target.value)}
                            placeholder="000.000.000-00"
                            data-testid="input-cadastro-cpf"
                          />
                        </div>
                        <PhoneInput value={regTelefone} onChange={setRegTelefone} required placeholder="Telefone *" data-testid="input-cadastro-telefone" />
                        <PhoneInput value={regWhatsapp} onChange={setRegWhatsapp} placeholder="WhatsApp" data-testid="input-cadastro-whatsapp" />
                        <Input value={regCidade} onChange={e => setRegCidade(e.target.value)} placeholder="Cidade *" list="cadastro-cidades" />
                        <Input value={regEstado} onChange={e => setRegEstado(e.target.value)} placeholder="Estado *" list="cadastro-estados" />
                        <Input value={regPais} onChange={e => setRegPais(e.target.value)} placeholder="País *" list="cadastro-paises" />
                        <Select value={regAreaAtuacao} onValueChange={setRegAreaAtuacao}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Área de atuação" />
                          </SelectTrigger>
                          <SelectContent>
                            {PROFILE_AREA_SCOPE_OPTIONS.map(option => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input value={regLinkSite} onChange={e => setRegLinkSite(e.target.value)} placeholder="Site / Portfolio" />
                        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                          {getRegIdiomasList().length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {getRegIdiomasList().map(idioma => (
                                <span key={idioma} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                  {idioma}
                                  <button type="button" onClick={() => removeRegIdioma(idioma)} className="text-blue-500 hover:text-blue-800">×</button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Input
                              value={regIdiomaInput}
                              onChange={e => setRegIdiomaInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter" || e.key === ",") {
                                  e.preventDefault();
                                  addRegIdioma();
                                }
                              }}
                              placeholder="Idiomas falados"
                              list="cadastro-idiomas"
                            />
                            <Button type="button" variant="outline" onClick={() => addRegIdioma()} className="shrink-0">Adicionar</Button>
                          </div>
                        </div>
                      </div>
                      <datalist id="cadastro-cidades">{CIDADE_OPTIONS.map(option => <option key={option} value={option} />)}</datalist>
                      <datalist id="cadastro-estados">{ESTADO_OPTIONS.map(option => <option key={option} value={option} />)}</datalist>
                      <datalist id="cadastro-paises">{PAIS_OPTIONS.map(option => <option key={option} value={option} />)}</datalist>
                      <datalist id="cadastro-idiomas">{PROFILE_LANGUAGE_OPTIONS.map(option => <option key={option} value={option} />)}</datalist>
                    </section>
                  </div>
                  <aside className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
                      <p className="text-sm font-bold text-[#001D34]">Resumo do seu perfil</p>
                      <div className="mt-4 flex items-center gap-3 border-b border-slate-100 pb-4">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-lg font-bold text-[#001D34]">{(regNome || "BU").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-[#001D34]">{regNome || "Seu nome"}</p>
                          {(regEmpresa || regLogoPreview) && (
                            <div className="mt-1 flex min-w-0 items-center gap-2">
                              <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded border border-slate-200 bg-white">
                                {regLogoPreview ? (
                                  <img src={regLogoPreview} alt="Marca da empresa" className="h-full w-full object-contain p-0.5" />
                                ) : (
                                  <Building2 className="h-3.5 w-3.5 text-slate-500" />
                                )}
                              </span>
                              <span className="truncate text-xs font-semibold text-slate-700">{regEmpresa || "Empresa"}</span>
                            </div>
                          )}
                          <p className="mt-1 text-xs text-slate-500">{regCargo || finalidadesSelecionadasLabel || "Escolha como quer usar a BUILT"}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3 text-xs">
                        {temPerfilProfissional && <div className="grid grid-cols-2 gap-2">
                          <p className="font-bold text-slate-700">CPF</p>
                          <p className={regCpf ? "text-slate-600" : "font-semibold text-red-600"}>{regCpf || "Pendente"}</p>
                        </div>}
                        <div><p className="font-bold text-slate-700">Como quero usar a BUILT</p><p className="mt-1 text-slate-600">{finalidadesSelecionadasLabel || "Nenhuma opção selecionada"}</p></div>
                        {temPerfilProfissional && <div><p className="font-bold text-slate-700">Áreas de contribuição ({regTiposAlianca.length})</p><div className="mt-2 flex flex-wrap gap-1.5">{regTiposAlianca.map(tipo => <span key={tipo} className="rounded bg-blue-50 px-2 py-1 font-semibold text-blue-700">{getTipoDisplayName(tipo)}</span>)}</div></div>}
                        {temPerfilProfissional && <div className="grid grid-cols-2 gap-2"><p className="font-bold text-slate-700">Ramo</p><p className="text-slate-600">{formatRamosDisplay(regRamoAtuacao) || "-"}</p><p className="font-bold text-slate-700">Segmento</p><p className="text-slate-600">{formatSegmentosDisplay(regSegmento) || "-"}</p><p className="font-bold text-slate-700">Localização</p><p className="text-slate-600">{[regCidade, regEstado].filter(Boolean).join(", ") || "-"}</p></div>}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
                      <p className="text-sm font-bold text-[#001D34]">Permissões iniciais</p>
                      <div className="mt-3 space-y-2 text-xs text-slate-600">{(temFinalidadeImoveis && !temPerfilProfissional
                        ? ["Cadastrar e administrar imóveis", "Criar demandas a partir dos imóveis", "Explorar oportunidades imobiliárias", "Receber comunicações da BUILT"]
                        : ["Receber recomendações personalizadas", "Acessar oportunidades e BIAs compatíveis", "Conectar-se com aliados recomendados", "Receber comunicações da BUILT"]
                      ).map(item => <p key={item} className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-emerald-600" />{item}</p>)}</div>
                    </div>
                  </aside>
                </div>
                {regError && <p className="text-red-600 text-sm text-center mt-3">{regError}</p>}
                <p className="mt-4 text-center text-xs text-slate-500">
                  Você poderá alterar essas informações depois nas configurações do seu perfil.
                </p>
              </div>
              <div className="sticky bottom-0 z-10 mt-0 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-3 py-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
                <Button type="button" variant="ghost" onClick={() => setShowInteressesModal(false)} disabled={regLoading} className="h-11 flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 md:h-10"><ArrowLeft className="w-4 h-4 mr-1.5" />Voltar</Button>
                <Button type="button" onClick={() => handleConfirmarCadastro()} disabled={regLoading || regFotoUploading || regLogoUploading || interessesSelecionados.length === 0} className="h-12 flex-1 bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 md:h-10">{regFotoUploading ? "Enviando foto..." : regLogoUploading ? "Enviando marca..." : regLoading ? "Criando..." : "Concluir e acessar a BUILT"}</Button>
              </div>
            </>
          ) : primeiroAcessoStep === "perfil_antigo" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-6 md:px-8 md:py-8">
              <div className="mb-4 space-y-2 md:mb-6">
                <p className="text-xs text-slate-500">Inicio / Primeiro acesso</p>
                <h2 className="text-xl font-bold text-[#001D34] md:text-2xl">Como você quer usar a BUILT?</h2>
                <p className="max-w-2xl text-sm text-slate-600">
                  Marque uma ou mais opções. Você poderá alterar essas finalidades depois.
                </p>
              </div>

          <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
            {[
              {
                valor: "imoveis",
                icone: <House className="w-5 h-5" />,
                titulo: "Tenho um imóvel ou identifiquei uma oportunidade",
                descricao: "Quero cadastrar, analisar e administrar imóveis.",
                gratuito: true,
              },
              {
                valor: "profissional",
                icone: <Store className="w-5 h-5" />,
                titulo: "Sou profissional, fornecedor ou empresa",
                descricao: "Quero oferecer serviços, produtos ou experiência profissional.",
                gratuito: true,
              },
              {
                valor: "capital",
                icone: <TrendingUp className="w-5 h-5" />,
                titulo: "Sou investidor ou parceiro de capital",
                descricao: "Quero avaliar negócios e contribuir com capital.",
                gratuito: true,
              },
            ].map(({ valor, icone, titulo, descricao, gratuito }) => {
              const selecionado = interessesSelecionados.includes(valor);
              return (
                <button
                  key={valor}
                  type="button"
                  data-testid={`interesse-${valor}`}
                  onClick={() => toggleInteresse(valor)}
                  className={`w-full flex flex-col gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg md:min-h-48 md:gap-4 md:p-4 ${
                    selecionado
                      ?"border-blue-500 ring-2 ring-blue-500/20"
                      : "border-slate-200 hover:border-[#D7BB7D]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="relative -m-3 mb-3 h-14 overflow-hidden rounded-t-xl border-b border-slate-200 bg-gradient-to-br from-slate-100 via-white to-[#D7BB7D]/20 md:-m-4 md:mb-4 md:h-24">
                      <div className="absolute right-4 top-3 flex items-end gap-1 md:right-5 md:top-4">
                        <span className="h-6 w-2 rounded-full bg-[#D7BB7D]/70 md:h-8" />
                        <span className="h-10 w-2 rounded-full bg-[#0B6F91]/70 md:h-14" />
                        <span className="h-7 w-2 rounded-full bg-slate-400/60 md:h-10" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap md:gap-3">
                      <span className={`grid h-9 w-9 place-items-center rounded-full md:h-10 md:w-10 ${selecionado ?"bg-blue-600 text-white" : "bg-[#001D34] text-[#D7BB7D]"}`}>
                        {icone}
                      </span>
                      <p className="text-base font-bold text-[#001D34] md:text-lg">{titulo}</p>
                      {gratuito ?(
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 border border-green-500/20">
                          Gratuito
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#D7BB7D]/10 text-[#D7BB7D] border border-[#D7BB7D]/20">
                          Taxa de adesão
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-sm mt-2 leading-relaxed md:mt-3">{descricao}</p>
                  </div>
                  <span className={`shrink-0 w-full rounded-md border px-3 py-2 text-center text-sm font-semibold transition-all ${
                    selecionado ?"border-blue-600 bg-blue-600 text-white" : "border-[#001D34] text-[#001D34]"
                  }`}>
                    {selecionado ? "Selecionado" : "Selecionar"}
                  </span>
                </button>
              );
            })}
          </div>

          {regError && <p className="text-red-600 text-sm text-center mt-3">{regError}</p>}

              </div>

          <div className="sticky bottom-0 z-10 mt-0 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
            <Button
              type="button"
              variant="ghost"
              data-testid="button-voltar-interesses"
              onClick={() => setShowInteressesModal(false)}
              disabled={regLoading}
              className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Voltar
            </Button>
            <Button
              type="button"
              data-testid="button-confirmar-cadastro"
              onClick={() => {
                const professional = interessesSelecionados.some((item) => item === "profissional" || item === "capital");
                if (professional) {
                  setRegError("");
                  setPrimeiroAcessoStep("perfil");
                  return;
                }
                handleConfirmarCadastro();
              }}
              disabled={regLoading || interessesSelecionados.length === 0}
              className="flex-1 bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold disabled:opacity-50"
            >
              {regLoading ?(
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#001D34]/30 border-t-[#001D34] rounded-full animate-spin" />
                  Criando...
                </span>
              ) : (
                interessesSelecionados.some((item) => item === "profissional" || item === "capital")
                  ? "Continuar e completar perfil"
                  : "Continuar para os aceites"
              )}
            </Button>
          </div>
            </>
          ) : primeiroAcessoStep === "termos" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-6 md:px-8 md:py-8">
              <div className="mb-4 space-y-2 md:mb-6">
                <p className="text-xs text-slate-500">Inicio / Primeiro acesso / Aceites</p>
                <h2 className="text-xl font-bold text-[#001D34] md:text-2xl">Termos de Acesso BUILT</h2>
                <p className="max-w-2xl text-sm text-slate-600">
                  Leia e confirme os termos aplicáveis às finalidades escolhidas: {finalidadesSelecionadasLabel}.
                </p>
              </div>

              <div className="rounded-xl border border-[#D7BB7D]/40 bg-[#D7BB7D]/10 p-4 mb-4 flex items-center gap-3">
                <Shield className="w-5 h-5 text-[#D7BB7D]" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#A8843A]">Aderindo a</p>
                  <p className="text-sm font-bold text-[#001D34]">{adesaoConvite?.comunidade?.nome || conviteInfo?.comunidade_nome || "Rede BUILT"}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D7BB7D]/30 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-[#D7BB7D]/30 bg-[#FCFAF5]">
                  {(() => {
                    const ActiveIcon = activeTermConfig.icon;
                    return <ActiveIcon className="w-4 h-4 text-[#D7BB7D]" />;
                  })()}
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{activeTermConfig.title}</span>
                </div>
                <div className="max-h-56 overflow-y-auto p-4 md:max-h-72 md:p-5">
                  <div className="text-sm md:text-base text-slate-700 leading-7 whitespace-pre-wrap">{activeTermConfig.body}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#D7BB7D]/30 bg-white p-4 space-y-3 shadow-sm">
                <p className="text-[10px] font-semibold text-[#A8843A] uppercase tracking-[0.2em]">Termos aplicaveis</p>
                <div className="flex flex-wrap gap-2">
                  {requiredTermKeys.map((key) => {
                    const config = TERM_CONFIG[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTerm(key)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${activeTermKey === key ? "border-[#D7BB7D] bg-[#D7BB7D]/20 text-[#001D34]" : "border-slate-200 text-slate-600 hover:border-[#D7BB7D]/50 hover:text-[#001D34]"}`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {requiredTermKeys.map((key) => {
                  const config = TERM_CONFIG[key];
                  const accepted = !!checkedTerms[key];
                  return (
                    <label key={key} className="flex items-start gap-3 cursor-pointer group">
                      <button
                        type="button"
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${accepted ? "bg-[#D7BB7D] border-[#D7BB7D]" : "border-slate-300 group-hover:border-[#D7BB7D]"}`}
                        onClick={() => setCheckedTerms((current) => ({ ...current, [key]: !current[key] }))}
                      >
                        {accepted && <CheckCircle className="w-3.5 h-3.5 text-[#001D34]" />}
                      </button>
                      <span className="text-sm text-slate-700 leading-relaxed">
                        Li e concordo com o{" "}
                        <button
                          type="button"
                          className="font-bold text-[#A8843A] hover:underline"
                          onClick={() => setActiveTerm(key)}
                        >
                          {config.label}
                        </button>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>{ACCEPTANCE_LOCATION_NOTICE}</span>
              </div>

              {regError && <p className="text-red-600 text-sm text-center mt-3">{regError}</p>}

              </div>

              <div className="sticky bottom-0 z-10 mt-0 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row md:static md:mt-5 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowInteressesModal(false)}
                  disabled={aceiteLoading}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={handleAceitarTermosCadastro}
                  disabled={aceiteLoading || !allTermsAccepted}
                  className="flex-1 bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold disabled:opacity-50"
                >
                  {aceiteLoading ? "Salvando..." : "Aceitar termos e avancar"}
                </Button>
              </div>
            </>
          ) : primeiroAcessoStep === "solicitacao" ? (
            <div className="flex min-h-[430px] flex-col justify-center text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <h2 className="text-2xl font-bold text-[#001D34]">Termos aceitos</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
                Agora envie sua solicitacao para o membro que te convidou registrar a percepcao de Aura.
              </p>
              {regError && <p className="text-red-600 text-sm text-center mt-4">{regError}</p>}
              <div className="mx-auto mt-6 flex w-full max-w-xl gap-3">
                <Button variant="ghost" onClick={() => setPrimeiroAcessoStep("termos")} className="flex-1 border border-slate-200">
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Voltar
                </Button>
                <Button onClick={handleEnviarSolicitacaoCadastro} disabled={aceiteLoading} className="flex-1 bg-[#D7BB7D] hover:bg-[#C4A96A] text-[#001D34] font-semibold">
                  <Send className="w-4 h-4 mr-1.5" />
                  {aceiteLoading ? "Enviando..." : "Enviar solicitacao"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[430px] flex-col justify-center text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <h2 className="text-2xl font-bold text-[#001D34]">Solicitacao enviada</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
                Sua solicitacao foi enviada. Acompanhe seu e-mail para os proximos passos.
              </p>
              <Button
                onClick={() => {
                  setShowInteressesModal(false);
                  setMode("login");
                  setEmail(regEmail);
                }}
                className="mx-auto mt-6 bg-[#001D34] text-white hover:bg-[#002946]"
              >
                Voltar para login
              </Button>
            </div>
          )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
