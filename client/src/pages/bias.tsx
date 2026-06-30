import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { capitalizeWords } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatBuiltInviteMessage } from "@/lib/invite-message";
import { getBiaPublicRef, getBiaUrl } from "@/lib/bia-url";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { InviteQrCode } from "@/components/invite-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Briefcase, Plus, Pencil, Trash2, MapPin, TrendingUp, TrendingDown,
  Search, Building2, Crown, Shield, Hammer, Wallet, AlertCircle,
  Navigation, Crosshair, Loader2, Award, FileText, Paperclip, Upload,
  X, ExternalLink, ChevronsUpDown, Check, DollarSign, CreditCard, ImageIcon,
  Clock, CheckCircle, XCircle, Bell, Ticket, Copy, RefreshCw, Target
} from "lucide-react";
import { PagamentoModal } from "@/components/PagamentoModal";
import { MapWheelGuard } from "@/components/map-wheel-guard";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from "react-simple-maps";

const BRAZIL_GEO = "/brazil-states.json";
const INVITE_APP_URL = "https://app.builtalliances.com";
const ASSET_CACHE_VERSION = "directus-db-20260616";
const INVITE_TYPE_OPTIONS = [
  { value: "vitrine", label: "Parceiro de Mercado" },
  { value: "capital", label: "Parceiro de Capital" },
];
const INVITE_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(INVITE_TYPE_OPTIONS.map((option) => [option.value, option.label])),
  membros: "BUILT Alliances",
  associacao_completa: "BUILT Alliances",
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
  return `${INVITE_APP_URL}${link.startsWith("/") ? "" : "/"}${link}`;
}

function directusAssetId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.id || value.uuid || value.directus_files_id || value.file || null;
  return String(value);
}

function versionAssetUrl(value?: any): string | null {
  if (!value) return null;
  if (typeof value === "string" && value.includes("/api/assets/")) {
    return `${value}${value.includes("?") ? "&" : "?"}v=${ASSET_CACHE_VERSION}`;
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  const assetId = directusAssetId(value);
  return assetId ? `/api/assets/${assetId}?v=${ASSET_CACHE_VERSION}` : null;
}

// ---- Types ----
interface AnexoFile {
  id: string;
  title?: string;
  filename?: string;
  url: string;
  size?: number;
}

interface Membro {
  id: string;
  nome?: string;
  Nome_de_usuario?: string;
  nome_completo?: string;
  primeiro_nome?: string;
  sobrenome?: string;
  empresa?: string;
  Outras_redes_as_quais_pertenco?: string[];
}

interface BiaDiretorSolicitacao {
  id: string;
  bia_id: string;
  diretor_membro_id: string;
  papel: string;
  campo_diretor: string;
  campo_percentual?: string;
  percentual?: string | number | null;
  status: string;
}

interface BiaSocioSolicitacao {
  id: string;
  bia_id: string;
  socio_membro_id: string;
  papel: string;
  campo_socios: string;
  status: string;
}

interface ComunidadeVinculo {
  id: string | number;
  nome?: string | null;
  sigla?: string | null;
  aliado?: string | { id?: string | null } | null;
  papel?: "membro" | "aliado" | "ambos";
  is_mae?: boolean;
}

interface ChamadaAlianca {
  id: string;
  bia_id: string;
  diretor_campo: string;
  ordem: number;
  escopo: string;
  titulo: string;
  data_hora: string;
  link_reuniao: string;
  opa_id?: string | null;
  destinatarios?: Array<{ id: string; nome?: string; email?: string }>;
}

interface BiasProjeto {
  id: string;
  codigo_publico?: string | null;
  nome_bia: string;
  situacao?: "ativa" | "em_formacao" | null;
  bia_publica?: boolean | null;
  destinacao?: string | null;
  selo_certified_alliance?: boolean | null;
  objetivo_alianca?: string;
  observacoes?: string;
  localizacao?: string;
  latitude?: number | null;
  longitude?: number | null;
  // Equipe
  autor_bia?: string | null;
  aliado_built?: string | null;
  diretor_alianca?: string | null;
  diretor_nucleo_tecnico?: string | null;
  diretor_execucao?: string | null;
  diretor_comercial?: string | null;
  diretor_capital?: string | null;
  socios_multiplicadores?: string[] | string | null;
  socios_guardioes?: string[] | string | null;
  terceiros?: string[] | string | null;
  // CPP
  valor_origem?: string | number;
  divisor_multiplicador?: string | number;
  perc_autor_opa?: string | number;
  perc_aliado_built?: string | number;
  perc_built?: string | number;
  perc_dir_alianca?: string | number;
  perc_dir_tecnico?: string | number;
  perc_dir_obras?: string | number;
  perc_dir_comercial?: string | number;
  perc_dir_capital?: string | number;
  cpp_autor_opa?: string | number;
  cpp_aliado_built?: string | number;
  cpp_built?: string | number;
  cpp_dir_alianca?: string | number;
  cpp_dir_tecnico?: string | number;
  cpp_dir_obras?: string | number;
  cpp_dir_comercial?: string | number;
  cpp_dir_capital?: string | number;
  custo_origem_bia?: string | number;
  custo_final_previsto?: string | number;
  // Receita
  valor_geral_venda_vgv?: string | number;
  valor_realizado_venda?: string | number;
  total_receita?: string | number;
  // Deduções (%)
  comissao_prevista_corretor?: string | number;
  ir_previsto?: string | number;
  inss_previsto?: string | number;
  manutencao_pos_obra_prevista?: string | number;
  // Resultado
  resultado_liquido?: string | number;
  lucro_previsto?: string | number;
  // Aportes
  inicio_aportes?: string | null;
  total_aportes?: string | number;
  imagem_directus_id?: string | null;
  imagem_url?: string | null;
  // Anexos
  Anexos?: AnexoFile[];
  // Moeda
  moeda?: string | null;
}

interface Oportunidade {
  id: string;
  nome_oportunidade?: string;
  tipo?: string;
  bia_id?: string;
  valor_origem_opa?: string | number;
  objetivo_alianca?: string;
  nucleo_alianca?: string;
  pais?: string;
  descricao?: string;
  imagem_directus_id?: string | null;
  imagem_url?: string | null;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: { city?: string; state?: string; country?: string };
}

// ---- Helpers ----
function getMembroNome(m: Membro): string {
  return m.Nome_de_usuario || m.nome_completo ||
    [m.primeiro_nome, m.sobrenome].filter(Boolean).join(" ") ||
    m.nome || "";
}

function relationId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "object") {
    const id = (value as { id?: string | number | null }).id;
    return id ? String(id) : "";
  }
  return String(value);
}

type AuraLowEvaluationMember = { nome: string; count: number };

async function getAuraEvaluationCount(membroId: string): Promise<number> {
  try {
    const response = await fetch(`/api/aura/score/${encodeURIComponent(membroId)}`, {
      credentials: "include",
    });
    if (!response.ok) return 0;
    const data = await response.json().catch(() => null);
    return Number(data?.n || 0);
  } catch {
    return 0;
  }
}

async function warnLowAuraEvaluations(
  membro: Membro,
  setLowAuraMember: (member: AuraLowEvaluationMember | null) => void,
): Promise<void> {
  const count = await getAuraEvaluationCount(membro.id);
  if (count >= 2) return;
  setLowAuraMember({ nome: getMembroNome(membro) || "Este membro", count });
}

function AuraLowEvaluationDialog({ member, onClose }: {
  member: AuraLowEvaluationMember | null;
  onClose: () => void;
}) {
  const count = member?.count ?? 0;
  const evaluationLabel = count === 1 ? "avaliação" : "avaliações";
  return (
    <AlertDialog open={!!member} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Pouca avaliação de Aura
          </AlertDialogTitle>
          <AlertDialogDescription>
            {member?.nome} possui {count} {evaluationLabel} de Aura. Isso reduz a base reputacional disponível, mas você pode continuar com a inclusão na BIA.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={onClose}>Continuar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function n(v?: string | number | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function parseMemberList(value?: string[] | string | null): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {}
  return String(value).split(",").map((id) => id.trim()).filter(Boolean);
}

function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMoney(value: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return brl(value);
  }
}

// ---- Currency list (ISO 4217) ----
const CURRENCIES: { code: string; name: string }[] = [
  { code: "BRL", name: "Real Brasileiro" },
  { code: "USD", name: "Dólar Americano" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "Libra Esterlina" },
  { code: "JPY", name: "Iene Japonês" },
  { code: "CNY", name: "Yuan Chinês" },
  { code: "CHF", name: "Franco Suíço" },
  { code: "AUD", name: "Dólar Australiano" },
  { code: "CAD", name: "Dólar Canadense" },
  { code: "HKD", name: "Dólar de Hong Kong" },
  { code: "SGD", name: "Dólar de Singapura" },
  { code: "NOK", name: "Coroa Norueguesa" },
  { code: "SEK", name: "Coroa Sueca" },
  { code: "DKK", name: "Coroa Dinamarquesa" },
  { code: "NZD", name: "Dólar da Nova Zelândia" },
  { code: "MXN", name: "Peso Mexicano" },
  { code: "ARS", name: "Peso Argentino" },
  { code: "CLP", name: "Peso Chileno" },
  { code: "COP", name: "Peso Colombiano" },
  { code: "PEN", name: "Sol Peruano" },
  { code: "UYU", name: "Peso Uruguaio" },
  { code: "PYG", name: "Guarani Paraguaio" },
  { code: "BOB", name: "Boliviano" },
  { code: "VEF", name: "Bolívar Venezuelano" },
  { code: "ZAR", name: "Rand Sul-Africano" },
  { code: "INR", name: "Rúpia Indiana" },
  { code: "IDR", name: "Rúpia Indonésia" },
  { code: "MYR", name: "Ringgit Malaio" },
  { code: "PHP", name: "Peso Filipino" },
  { code: "THB", name: "Baht Tailandês" },
  { code: "VND", name: "Dong Vietnamita" },
  { code: "KRW", name: "Won Sul-Coreano" },
  { code: "TRY", name: "Lira Turca" },
  { code: "RUB", name: "Rublo Russo" },
  { code: "PLN", name: "Zlóti Polonês" },
  { code: "CZK", name: "Coroa Tcheca" },
  { code: "HUF", name: "Florim Húngaro" },
  { code: "RON", name: "Leu Romeno" },
  { code: "ILS", name: "Shekel Israelense" },
  { code: "SAR", name: "Riyal Saudita" },
  { code: "AED", name: "Dirham dos EAU" },
  { code: "QAR", name: "Riyal Catarense" },
  { code: "KWD", name: "Dinar Kuwaitiano" },
  { code: "BHD", name: "Dinar do Bahrein" },
  { code: "OMR", name: "Rial Omanense" },
  { code: "JOD", name: "Dinar Jordaniano" },
  { code: "EGP", name: "Libra Egípcia" },
  { code: "MAD", name: "Dirham Marroquino" },
  { code: "NGN", name: "Naira Nigeriana" },
  { code: "KES", name: "Xelim Queniano" },
  { code: "GHS", name: "Cedi Ganense" },
  { code: "TZS", name: "Xelim Tanzaniano" },
  { code: "ETB", name: "Birr Etíope" },
  { code: "UGX", name: "Xelim Ugandense" },
  { code: "PKR", name: "Rúpia Paquistanesa" },
  { code: "BDT", name: "Taka de Bangladesh" },
  { code: "LKR", name: "Rúpia do Sri Lanka" },
  { code: "NPR", name: "Rúpia Nepalesa" },
  { code: "MMK", name: "Kyat de Mianmar" },
  { code: "KHR", name: "Riel Cambojano" },
  { code: "TWD", name: "Novo Dólar Taiwanês" },
  { code: "HRK", name: "Kuna Croata" },
  { code: "BGN", name: "Lev Búlgaro" },
  { code: "UAH", name: "Hryvnia Ucraniana" },
  { code: "CRC", name: "Colón Costa-Riquenho" },
  { code: "GTQ", name: "Quetzal Guatemalteco" },
  { code: "HNL", name: "Lempira Hondurenha" },
  { code: "NIO", name: "Córdoba Nicaraguense" },
  { code: "PAB", name: "Balboa Panamenho" },
  { code: "DOP", name: "Peso Dominicano" },
  { code: "CUP", name: "Peso Cubano" },
  { code: "TTD", name: "Dólar de Trinidad e Tobago" },
  { code: "BBD", name: "Dólar de Barbados" },
  { code: "JMD", name: "Dólar Jamaicano" },
  { code: "ISK", name: "Coroa Islandesa" },
  { code: "MKD", name: "Denar Macedônio" },
  { code: "RSD", name: "Dinar Sérvio" },
  { code: "ALL", name: "Lek Albanês" },
  { code: "BAM", name: "Marco da Bósnia" },
  { code: "GEL", name: "Lari Georgiano" },
  { code: "AMD", name: "Dram Armênio" },
  { code: "AZN", name: "Manat Azerbaijano" },
  { code: "KZT", name: "Tenge Cazaque" },
  { code: "UZS", name: "Som Uzbeque" },
  { code: "MNT", name: "Tugrik Mongol" },
];

function formatInputBRL(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRLToNumber(formatted: string): number {
  if (!formatted) return 0;
  const cleaned = formatted.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function parsePercentToNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return parseFloat(String(value).replace(",", ".")) || 0;
}

function numToBRLStr(v?: string | number | null): string {
  const num = parseFloat(String(v ?? "")) || 0;
  if (!num) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- BRLInput component ----
function BRLInput({ label, field, form, setForm, testId, required }: {
  label: string; field: keyof FormState; form: FormState;
  setForm: (f: FormState) => void; testId?: string; required?: boolean;
}) {
  const isEmpty = required && parseBRLToNumber(String(form[field] ?? "")) <= 0;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="0,00"
          value={form[field] as string}
          onChange={(e) => setForm({ ...form, [field]: formatInputBRL(e.target.value) })}
          className="pl-9 h-8 text-sm tabular-nums"
          data-testid={testId ? `input-${field}` : undefined}
        />
      </div>
      {isEmpty && (
        <p className="text-[10px] text-red-400/70 font-mono">Campo obrigatório</p>
      )}
    </div>
  );
}

// ---- Form state type ----
const EMPTY_FORM = {
  nome_bia: "",
  situacao: "em_formacao" as "ativa" | "em_formacao",
  bia_publica: true,
  destinacao: "",
  selo_certified_alliance: false,
  localizacao: "",
  latitude: "",
  longitude: "",
  objetivo_alianca: "",
  observacoes: "",
  autor_bia: "",
  aliado_built: "",
  diretor_alianca: "",
  diretor_nucleo_tecnico: "",
  diretor_execucao: "",
  diretor_comercial: "",
  diretor_capital: "",
  socios_multiplicadores: [] as string[],
  socios_guardioes: [] as string[],
  terceiros: [] as string[],
  valor_origem: "",
  perc_autor_opa: "",
  perc_aliado_built: "",
  perc_built: "",
  perc_dir_alianca: "",
  perc_dir_tecnico: "",
  perc_dir_obras: "",
  perc_dir_comercial: "",
  perc_dir_capital: "",
  valor_geral_venda_vgv: "",
  valor_realizado_venda: "",
  comissao_prevista_corretor: "",
  ir_previsto: "",
  inss_previsto: "",
  manutencao_pos_obra_prevista: "",
  inicio_aportes: "",
  total_aportes: "",
  imagem_directus_id: "",
  moeda: "BRL",
};

type FormState = typeof EMPTY_FORM;
type ChamadaAlvoCampo =
  | "diretor_alianca"
  | "diretor_nucleo_tecnico"
  | "diretor_execucao"
  | "diretor_comercial"
  | "diretor_capital"
  | "socios_guardioes"
  | "socios_multiplicadores";

const DIRETOR_CHAMADA_LABELS: Partial<Record<ChamadaAlvoCampo, string>> = {
  diretor_alianca: "Diretor de Aliança",
  diretor_nucleo_tecnico: "Diretor de Núcleo Técnico",
  diretor_execucao: "Diretor de Núcleo de Obra",
  diretor_comercial: "Diretor Comercial",
  diretor_capital: "Diretor de Capital",
  socios_guardioes: "Sócios Guardiões",
  socios_multiplicadores: "Sócios Multiplicadores",
};

const DIRETOR_CHAMADA_TIPOS: Partial<Record<ChamadaAlvoCampo, string>> = {
  diretor_alianca: "Liderança",
  diretor_nucleo_tecnico: "Liderança",
  diretor_execucao: "Liderança",
  diretor_comercial: "Liderança",
  diretor_capital: "Liderança",
  socios_guardioes: "Aporte Financeiro",
  socios_multiplicadores: "Aporte Financeiro",
};

const DIRETOR_CHAMADA_PERCENT_FIELDS: Partial<Record<ChamadaAlvoCampo, keyof FormState>> = {
  diretor_alianca: "perc_dir_alianca",
  diretor_nucleo_tecnico: "perc_dir_tecnico",
  diretor_execucao: "perc_dir_obras",
  diretor_comercial: "perc_dir_comercial",
  diretor_capital: "perc_dir_capital",
};

const CHAMADA_ALIANCA_TITULO_OPA = "Chamada para aliança de Liderança";

const CHAMADA_SEQUENCE_LABELS: Record<number, string> = {
  1: "RO para a comunidade",
  2: "RO para o território",
  3: "RO nacional",
  4: "RO global",
};

function biaToForm(b: BiasProjeto): FormState {
  return {
    nome_bia: b.nome_bia || "",
    situacao: (b.situacao === "em_formacao" ?"em_formacao" : "ativa") as "ativa" | "em_formacao",
    bia_publica: b.bia_publica !== false,
    destinacao: b.destinacao || "",
    selo_certified_alliance: !!b.selo_certified_alliance,
    localizacao: b.localizacao || "",
    latitude: b.latitude != null ?String(b.latitude) : "",
    longitude: b.longitude != null ?String(b.longitude) : "",
    objetivo_alianca: b.objetivo_alianca || "",
    observacoes: b.observacoes || "",
    autor_bia: b.autor_bia || "",
    aliado_built: b.aliado_built || "",
    diretor_alianca: b.diretor_alianca || "",
    diretor_nucleo_tecnico: b.diretor_nucleo_tecnico || "",
    diretor_execucao: b.diretor_execucao || "",
    diretor_comercial: b.diretor_comercial || "",
    diretor_capital: b.diretor_capital || "",
    socios_multiplicadores: parseMemberList(b.socios_multiplicadores),
    socios_guardioes: parseMemberList(b.socios_guardioes),
    terceiros: parseMemberList(b.terceiros),
    valor_origem: numToBRLStr(b.valor_origem),
    perc_autor_opa: b.perc_autor_opa != null ?String(b.perc_autor_opa) : "",
    perc_aliado_built: b.perc_aliado_built != null ?String(b.perc_aliado_built) : "",
    perc_built: b.perc_built != null ?String(b.perc_built) : "",
    perc_dir_alianca: b.perc_dir_alianca != null ?String(b.perc_dir_alianca) : "",
    perc_dir_tecnico: b.perc_dir_tecnico != null ?String(b.perc_dir_tecnico) : "",
    perc_dir_obras: b.perc_dir_obras != null ?String(b.perc_dir_obras) : "",
    perc_dir_comercial: b.perc_dir_comercial != null ?String(b.perc_dir_comercial) : "",
    perc_dir_capital: b.perc_dir_capital != null ?String(b.perc_dir_capital) : "",
    valor_geral_venda_vgv: numToBRLStr(b.valor_geral_venda_vgv),
    valor_realizado_venda: numToBRLStr(b.valor_realizado_venda),
    comissao_prevista_corretor: b.comissao_prevista_corretor != null ?String(b.comissao_prevista_corretor) : "",
    ir_previsto: b.ir_previsto != null ?String(b.ir_previsto) : "",
    inss_previsto: b.inss_previsto != null ?String(b.inss_previsto) : "",
    manutencao_pos_obra_prevista: b.manutencao_pos_obra_prevista != null ?String(b.manutencao_pos_obra_prevista) : "",
    inicio_aportes: b.inicio_aportes || "",
    total_aportes: numToBRLStr(b.total_aportes),
    imagem_directus_id: b.imagem_directus_id || "",
    moeda: b.moeda || "BRL",
  };
}

// ---- Currency Combobox ----
function CurrencyCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = CURRENCIES.find(c => c.code === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:bg-muted/30 transition-colors"
          data-testid="btn-moeda-select"
        >
          <div className="flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {selected ?(
              <span><span className="font-medium">{selected.code}</span> — {selected.name}</span>
            ) : (
              <span className="text-muted-foreground">Selecionar moeda...</span>
            )}
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar moeda..." className="h-9" />
          <CommandList>
            <CommandEmpty>Moeda não encontrada.</CommandEmpty>
            <CommandGroup>
              {CURRENCIES.map(c => (
                <CommandItem
                  key={c.code}
                  value={`${c.code} ${c.name}`}
                  onSelect={() => { onChange(c.code); setOpen(false); }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Check className={`w-3.5 h-3.5 shrink-0 ${value === c.code ?"opacity-100 text-brand-gold" : "opacity-0"}`} />
                  <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{c.code}</span>
                  <span className="text-sm">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---- Sub-components ----
function FieldInput({ label, field, form, setForm, placeholder, type = "text" }: {
  label: string; field: keyof FormState; form: FormState;
  setForm: (f: FormState) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        step={type === "number" ?"0.01" : undefined}
        min={type === "number" ?"0" : undefined}
        placeholder={placeholder}
        value={String(form[field] ?? "")}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        className="h-8 text-sm"
        data-testid={`input-${field}`}
      />
    </div>
  );
}

function PercField({ label, field, form, setForm, baseValue }: {
  label: string; field: keyof FormState; form: FormState;
  setForm: (f: FormState) => void; baseValue?: number;
}) {
  const pct = parseFloat(form[field] as string) || 0;
  const equiv = baseValue && baseValue > 0 ?(pct / 100) * baseValue : null;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="0,00"
            value={String(form[field] ?? "")}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            className="pr-8 h-8 text-sm"
            data-testid={`input-${field}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
        </div>
        {equiv !== null && (
          <span className="text-xs text-muted-foreground tabular-nums min-w-[90px] text-right">
            = {brl(equiv)}
          </span>
        )}
      </div>
    </div>
  );
}

function MembroSelect({ label, field, form, setForm, membros, icon: Icon, required, filterFn, pending, disabled, disabledNote }: {
  label: string; field: keyof FormState; form: FormState;
  setForm: (f: FormState) => void; membros: Membro[]; icon?: any; required?: boolean;
  filterFn?: (m: Membro) => boolean;
  pending?: boolean;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const [lowAuraMember, setLowAuraMember] = useState<AuraLowEvaluationMember | null>(null);
  const isEmpty = required && !form[field];
  const options = filterFn ?membros.filter(filterFn) : membros;
  const selectedId = String(form[field] || "");
  const selectedMembro = selectedId ? membros.find((m) => m.id === selectedId) : null;
  const selectedLabel = selectedMembro
    ? `${getMembroNome(selectedMembro)}${selectedMembro.empresa ? ` · ${selectedMembro.empresa}` : ""}`
    : selectedId
      ? "Membro selecionado"
      : "Selecionar...";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      <Popover open={disabled ? false : open} onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={`h-8 w-full justify-between px-3 text-left text-sm font-normal disabled:cursor-not-allowed disabled:opacity-100 ${disabled ? "bg-muted/50 text-foreground" : ""} ${isEmpty ?"border-red-400/50 focus:border-red-400" : ""}`}
            data-testid={`select-${field}`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className={`truncate ${selectedId ? "" : "text-muted-foreground"}`}>
                {selectedLabel}
              </span>
              {pending && selectedId && (
                <Badge variant="outline" className="h-4 shrink-0 border-amber-300 bg-amber-50 px-1.5 text-[9px] font-medium text-amber-700">
                  <Clock className="mr-1 h-2.5 w-2.5" />
                  Pendente
                </Badge>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[280px] p-0"
          align="start"
          data-testid={`popover-${field}`}
        >
          <Command>
            <CommandInput placeholder="Buscar membro..." />
            <CommandList>
              <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="none nenhum"
                  onSelect={() => {
                    const nextForm = { ...form, [field]: "" };
                    if (field === "diretor_alianca" && form.aliado_built === form.diretor_alianca) {
                      nextForm.aliado_built = "";
                    }
                    setForm(nextForm);
                    setOpen(false);
                  }}
                  data-testid={`option-${field}-none`}
                >
                  <Check className={`mr-2 h-4 w-4 ${!selectedId ? "opacity-100" : "opacity-0"}`} />
                  — Nenhum —
                </CommandItem>
                {options.map((m) => {
                  const memberLabel = `${getMembroNome(m)}${m.empresa ? ` · ${m.empresa}` : ""}`;
                  return (
                    <CommandItem
                      key={m.id}
                      value={`${memberLabel} ${m.id}`}
                      onSelect={async () => {
                        await warnLowAuraEvaluations(m, setLowAuraMember);
                        const nextForm = { ...form, [field]: m.id };
                        if (field === "diretor_alianca" && !form.aliado_built) {
                          nextForm.aliado_built = m.id;
                        }
                        setForm(nextForm);
                        setOpen(false);
                      }}
                      data-testid={`option-${field}-${m.id}`}
                    >
                      <Check className={`mr-2 h-4 w-4 ${selectedId === m.id ? "opacity-100" : "opacity-0"}`} />
                      <span className="truncate">{memberLabel}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {isEmpty && (
        <p className="text-[10px] text-red-400/70 font-mono">Campo obrigatório</p>
      )}
      {disabled && disabledNote && (
        <p className="text-[10px] text-muted-foreground">{disabledNote}</p>
      )}
      <AuraLowEvaluationDialog member={lowAuraMember} onClose={() => setLowAuraMember(null)} />
    </div>
  );
}

function MultiMembroSelect({ label, field, form, setForm, membros, icon: Icon, note, pendingIds }: {
  label: string;
  field: "socios_multiplicadores" | "socios_guardioes" | "terceiros";
  form: FormState;
  setForm: (f: FormState) => void;
  membros: Membro[];
  icon?: any;
  note?: string;
  pendingIds?: Set<string>;
}) {
  const [lowAuraMember, setLowAuraMember] = useState<AuraLowEvaluationMember | null>(null);
  const selectedIds = parseMemberList(form[field] as string[] | string);
  const selectedSet = new Set(selectedIds);
  const oppositeField = field === "socios_multiplicadores"
    ?"socios_guardioes"
    : field === "socios_guardioes"
      ?"socios_multiplicadores"
      : null;
  const blockedIds = oppositeField ?new Set(parseMemberList(form[oppositeField] as string[] | string)) : new Set<string>();
  const blockedLabel = field === "socios_multiplicadores" ?"guardião" : "multiplicador";
  const selectedMembros = selectedIds
    .map((id) => membros.find((m) => m.id === id))
    .filter(Boolean) as Membro[];

  async function toggleMembro(id: string) {
    const alreadySelected = selectedSet.has(id);
    if (!alreadySelected && blockedIds.has(id)) return;
    if (!alreadySelected) {
      const membro = membros.find((item) => item.id === id);
      if (membro) await warnLowAuraEvaluations(membro, setLowAuraMember);
    }
    const next = alreadySelected
      ?selectedIds.filter((current) => current !== id)
      : [...selectedIds, id];
    const nextForm = { ...form, [field]: next };
    if (oppositeField) {
      nextForm[oppositeField] = parseMemberList(nextForm[oppositeField] as string[] | string).filter((current) => current !== id);
    }
    setForm(nextForm);
  }

  function handleListWheel(event: React.WheelEvent<HTMLDivElement>) {
    const list = event.currentTarget;
    if (list.scrollHeight <= list.clientHeight) return;

    event.preventDefault();
    event.stopPropagation();
    list.scrollTop += event.deltaY;
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left"
            data-testid={`select-${field}`}
          >
            <span className={selectedMembros.length ?"line-clamp-2" : "text-muted-foreground"}>
              {selectedMembros.length
                ?selectedMembros.map((m) => getMembroNome(m)).join(", ")
                : "Selecionar membros..."}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          disablePortal
          className="p-0 w-[360px]"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Buscar membro..." />
            <CommandList
              className="max-h-[300px] overscroll-contain"
              onWheel={handleListWheel}
            >
              <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
              <CommandGroup>
                {membros.map((m) => {
                  const checked = selectedSet.has(m.id);
                  const blocked = !checked && blockedIds.has(m.id);
                  return (
                    <CommandItem
                      key={m.id}
                      value={`${getMembroNome(m)} ${m.empresa || ""}`}
                      disabled={blocked}
                      onSelect={() => { void toggleMembro(m.id); }}
                    >
                      <Check className={`mr-2 h-4 w-4 ${checked ?"opacity-100" : "opacity-0"}`} />
                      <span className="truncate">{getMembroNome(m)}{m.empresa ?` · ${m.empresa}` : ""}</span>
                      {blocked && <span className="text-[10px] text-muted-foreground">já é {blockedLabel}</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedMembros.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedMembros.map((m) => {
            const isPending = pendingIds?.has(String(m.id));
            return (
            <Badge key={m.id} variant="secondary" className="gap-1 pr-1">
              {getMembroNome(m)}
              {isPending && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                  Pendente
                </span>
              )}
              <button type="button" onClick={() => { void toggleMembro(m.id); }} className="rounded-full hover:bg-background/80">
                <X className="w-3 h-3" />
              </button>
            </Badge>
            );
          })}
        </div>
      )}
      {note && <p className="text-[11px] text-muted-foreground leading-relaxed">{note}</p>}
      <AuraLowEvaluationDialog member={lowAuraMember} onClose={() => setLowAuraMember(null)} />
    </div>
  );
}

// ---- Location Picker Modal ----
function LocationPickerModal({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (localizacao: string, lat: number, lng: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<NominatimResult | null>(null);
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
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=8&accept-language=pt-BR,pt`;
      const res = await fetch(url, { headers: { "Accept-Language": "pt-BR,pt;q=0.9" } });
      if (!res.ok) throw new Error("Erro na busca");
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
    const lat = parseFloat(selected.lat);
    const lng = parseFloat(selected.lon);
    const displayName = selected.display_name;
    onSelect(displayName, lat, lng);
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
          <Input
            placeholder="Ex: São Paulo, SP — Copacabana, RJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
            data-testid="input-location-search"
            autoFocus
          />
          <Button
            onClick={handleSearch}
            disabled={loading || !search.trim()}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90 shrink-0"
            data-testid="btn-search-location"
          >
            {loading ?<Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-muted-foreground text-center py-2">{error}</p>
        )}

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
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                  {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                </p>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="p-3 rounded-lg bg-brand-gold/5 border border-brand-gold/25">
            <div className="flex items-start gap-2">
              <Crosshair className="w-4 h-4 text-brand-gold mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-brand-gold uppercase tracking-wide">Localização selecionada</p>
                <p className="text-sm mt-0.5 leading-tight">{selected.display_name}</p>
                <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                  Lat: {parseFloat(selected.lat).toFixed(6)} · Lng: {parseFloat(selected.lon).toFixed(6)}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${selected.lat},${selected.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-brand-gold/70 hover:text-brand-gold underline mt-1 inline-block"
                >
                  Verificar no Google Maps →
                </a>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
            data-testid="btn-confirm-location"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Confirmar localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Location Field ----
function LocationField({ form, setForm, onPickerOpen }: {
  form: FormState;
  setForm: (f: FormState) => void;
  onPickerOpen: () => void;
}) {
  const hasCoords = form.latitude && form.longitude;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Localização <span className="text-red-500">*</span></Label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9 h-auto w-full max-w-full border-brand-gold/30 hover:border-brand-gold hover:text-brand-gold gap-1.5 justify-start whitespace-normal px-3 py-2 text-left"
        onClick={onPickerOpen}
        data-testid="btn-pick-location"
      >
        <Navigation className="w-3.5 h-3.5 shrink-0" />
        <span className="min-w-0 flex-1 break-words leading-snug">
          {form.localizacao ?form.localizacao : "Selecionar no Mapa"}
        </span>
      </Button>
      {hasCoords && (
        <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
          <Crosshair className="w-3 h-3 text-brand-gold/60" />
          {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
        </p>
      )}
    </div>
  );
}

// ---- Brazil Map Header ----
const WORLD_GEO = "/world-countries-50m.json";

function BrazilMapHeader({ biasAll, membros, opas }: { biasAll: BiasProjeto[]; membros: Membro[]; opas: Oportunidade[] }) {
  const [, navigate] = useLocation();
  const [hoveredCluster, setHoveredCluster] = useState<{ center: [number, number]; items: BiasProjeto[] } | null>(null);
  const [selectedBia, setSelectedBia] = useState<BiasProjeto | null>(null);
  const [clusterBias, setClusterBias] = useState<BiasProjeto[] | null>(null);
  const [zoom, setZoom] = useState(3);
  const [center, setCenter] = useState<[number, number]>([-52, -15]);

  const biasWithCoords = useMemo(
    () => biasAll.filter(b => b.latitude != null && b.longitude != null),
    [biasAll]
  );

  // Group BIAs by proximity (within ~1km / 0.01 degree threshold)
  const clusters = useMemo(() => {
    const THRESHOLD = 0.01;
    const result: { center: [number, number]; items: BiasProjeto[] }[] = [];
    for (const b of biasWithCoords) {
      const lng = parseFloat(String(b.longitude));
      const lat = parseFloat(String(b.latitude));
      const existing = result.find(
        c => Math.abs(c.center[0] - lng) < THRESHOLD && Math.abs(c.center[1] - lat) < THRESHOLD
      );
      if (existing) {
        existing.items.push(b);
      } else {
        result.push({ center: [lng, lat], items: [b] });
      }
    }
    return result;
  }, [biasWithCoords]);
  const totalVgv = biasAll.reduce((s, b) => s + n(b.valor_geral_venda_vgv), 0);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 16));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 1));
  const handleReset = () => { setZoom(3); setCenter([-52, -15]); };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-orange-400/20"
      style={{ height: 360, background: "radial-gradient(ellipse at 50% 110%, #001428 0%, #000c1f 55%, #000408 100%)" }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(249,115,22,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.05) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-orange-400/40 rounded-tl-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-orange-400/40 rounded-tr-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-orange-400/40 rounded-bl-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-orange-400/40 rounded-br-2xl pointer-events-none" />

      {/* Top-left header */}
      <div className="absolute top-5 left-6 z-20">
        <p className="text-[10px] text-cyan-300/60 tracking-[0.35em] uppercase font-mono">// BUILT Alliances</p>
        <h2 className="text-xl font-bold tracking-[0.12em] font-mono mt-0.5 text-cyan-300">
          MAPA DE OPERAÇÕES
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          <span className="text-[10px] text-green-400/80 font-mono tracking-[0.2em] uppercase">Sistema Ativo</span>
        </div>
      </div>

      {/* Top-right stats */}
      <div className="absolute top-5 right-6 z-20 text-right font-mono">
        <div className="mb-3">
          <p className="text-[9px] text-cyan-300/50 tracking-widest uppercase">Alianças</p>
          <p className="text-4xl font-bold leading-none text-cyan-300">{biasAll.length}</p>
        </div>
        <div>
          <p className="text-[9px] text-cyan-300/50 tracking-widest uppercase">VGV Total</p>
          <p className="text-xs font-semibold text-cyan-300/70">
            {totalVgv > 0 ?brl(totalVgv) : "—"}
          </p>
        </div>
        <p className="text-[9px] text-cyan-300/35 mt-2">{biasWithCoords.length} geolocalizadas</p>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 flex items-center justify-center rounded border font-mono text-sm font-bold transition-colors"
          style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(249,115,22,0.35)", color: "#FB923C" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          data-testid="btn-map-zoom-in"
          title="Ampliar"
        >+</button>
        <button
          onClick={handleReset}
          className="w-7 h-7 flex items-center justify-center rounded border font-mono text-[9px] font-bold transition-colors"
          style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(249,115,22,0.25)", color: "#FB923C80" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.12)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          data-testid="btn-map-reset"
          title="Resetar zoom"
        >⊙</button>
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 flex items-center justify-center rounded border font-mono text-sm font-bold transition-colors"
          style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(249,115,22,0.35)", color: "#FB923C" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          data-testid="btn-map-zoom-out"
          title="Reduzir"
        >−</button>
      </div>

      {/* Map */}
      <MapWheelGuard>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [0, 10], scale: 160 }}
          style={{ width: "100%", height: "100%" }}
        >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          minZoom={1}
          maxZoom={16}
          onMoveEnd={({ coordinates, zoom: z }) => {
            setCenter(coordinates);
            setZoom(z);
          }}
        >
          {/* World layer — very subtle background */}
          <Geographies geography={WORLD_GEO}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: { fill: "#011630", stroke: "#D7BB7D28", strokeWidth: 0.3, outline: "none" },
                    hover:   { fill: "#011630", stroke: "#D7BB7D28", strokeWidth: 0.3, outline: "none" },
                    pressed: { fill: "#011630", outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Brazil states — same style as world */}
          <Geographies geography={BRAZIL_GEO}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: { fill: "#011630", stroke: "#D7BB7D28", strokeWidth: 0.3, outline: "none" },
                    hover:   { fill: "#011630", stroke: "#D7BB7D28", strokeWidth: 0.3, outline: "none" },
                    pressed: { fill: "#011630", outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {clusters.map((cluster, idx) => {
            const [lng, lat] = cluster.center;
            const isMulti = cluster.items.length > 1;
            const isHovered = hoveredCluster === cluster;
            const isSelected = !isMulti && selectedBia?.id === cluster.items[0]?.id;
            const isClusterSelected = isMulti && clusterBias === cluster.items;
            const r = Math.max(2, 5 / zoom);
            return (
              <Marker
                key={idx}
                coordinates={[lng, lat]}
                onMouseEnter={() => setHoveredCluster(cluster)}
                onMouseLeave={() => setHoveredCluster(null)}
                onClick={() => {
                  setHoveredCluster(null);
                  if (isMulti) {
                    setSelectedBia(null);
                    setClusterBias(cluster.items);
                  } else {
                    setClusterBias(null);
                    setSelectedBia(cluster.items[0]);
                  }
                }}
              >
                <g style={{ cursor: "pointer" }}>
                  {/* Pulse ring */}
                  <circle r={r * (isSelected || isClusterSelected ?5.5 : isHovered ?4.5 : 3.5)} fill="#D7BB7D" fillOpacity={isSelected || isClusterSelected ?0.12 : 0.06}>
                    <animate attributeName="r" from={r * (isSelected || isClusterSelected ?4 : 2.5)} to={r * (isSelected || isClusterSelected ?7 : 5)} dur={isSelected || isClusterSelected ?"1.2s" : "1.6s"} repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.4" to="0" dur={isSelected || isClusterSelected ?"1.2s" : "1.6s"} repeatCount="indefinite" />
                  </circle>
                  <circle r={r * (isSelected || isClusterSelected ?3 : isHovered ?2.5 : 2)} fill="#D7BB7D" fillOpacity={isSelected || isClusterSelected ?0.4 : isHovered ?0.3 : 0.18} />
                  <circle r={r * (isSelected || isClusterSelected ?1.6 : isHovered ?1.3 : 1)} fill="#D7BB7D" fillOpacity={0.95} />
                  <circle r={r * 0.7} fill="white" fillOpacity={0.95} />
                  {/* Count badge for clusters */}
                  {isMulti && (
                    <>
                      <circle
                        cx={r * 1.6}
                        cy={r * -1.6}
                        r={r * 1.2}
                        fill={isClusterSelected ?"#D7BB7D" : "#001D34"}
                        stroke="#D7BB7D"
                        strokeWidth={0.5}
                      />
                      <text
                        x={r * 1.6}
                        y={r * -1.6}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={r * 1.0}
                        fontWeight="bold"
                        fontFamily="monospace"
                        fill={isClusterSelected ?"#001D34" : "#D7BB7D"}
                      >
                        {cluster.items.length}
                      </text>
                    </>
                  )}
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
        </ComposableMap>
      </MapWheelGuard>

      {/* Hover tooltip bar — only when nothing selected/clustered */}
      {!selectedBia && !clusterBias && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-200 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(0,8,18,0.92) 0%, transparent 100%)",
            padding: "28px 24px 14px",
            opacity: hoveredCluster ?1 : 0,
            transform: hoveredCluster ?"translateY(0)" : "translateY(6px)",
          }}
        >
          {hoveredCluster && (
            <div className="flex items-end justify-between font-mono">
              <div>
                {hoveredCluster.items.length > 1 ?(
                  <>
                    <p className="text-[9px] text-brand-gold/40 tracking-[0.3em] uppercase">Clique para selecionar</p>
                    <p className="text-sm font-bold text-brand-gold mt-0.5">{hoveredCluster.items.length} BIAs neste local</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {hoveredCluster.items.slice(0, 3).map(b => (
                        <span key={b.id} className="text-[10px] text-brand-gold/60 font-mono">· {b.nome_bia}</span>
                      ))}
                      {hoveredCluster.items.length > 3 && <span className="text-[10px] text-brand-gold/40">+{hoveredCluster.items.length - 3}</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[9px] text-brand-gold/40 tracking-[0.3em] uppercase">Clique para ver detalhes</p>
                    <p className="text-sm font-bold text-brand-gold mt-0.5">{hoveredCluster.items[0].nome_bia}</p>
                    {hoveredCluster.items[0].localizacao && (
                      <p className="text-[11px] text-brand-gold/55 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{hoveredCluster.items[0].localizacao}
                      </p>
                    )}
                  </>
                )}
              </div>
              {hoveredCluster.items.length === 1 && n(hoveredCluster.items[0].valor_geral_venda_vgv) > 0 && (
                <div className="text-right">
                  <p className="text-[9px] text-brand-gold/40 uppercase tracking-wider">VGV</p>
                  <p className="text-sm text-brand-gold tabular-nums">{formatMoney(n(hoveredCluster.items[0].valor_geral_venda_vgv), hoveredCluster.items[0].moeda || "BRL")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cluster picker panel */}
      {clusterBias && !selectedBia && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 transition-all duration-300"
          style={{
            background: "linear-gradient(to top, rgba(0,8,20,0.98) 0%, rgba(0,12,28,0.96) 70%, transparent 100%)",
            padding: "32px 24px 18px",
          }}
        >
          <button
            onClick={() => setClusterBias(null)}
            className="absolute top-3 right-4 text-brand-gold/40 hover:text-brand-gold/80 transition-colors font-mono text-xs tracking-widest"
            data-testid="btn-map-close-cluster"
          >
            ✕ FECHAR
          </button>
          <div className="font-mono">
            <p className="text-[9px] text-brand-gold/40 tracking-[0.35em] uppercase mb-1">// {clusterBias.length} Alianças neste Local</p>
            <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent mb-3" />
            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {clusterBias.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBia(b); setClusterBias(null); }}
                  className="flex items-center justify-between gap-3 text-left px-3 py-2 rounded transition-colors"
                  style={{ background: "rgba(215,187,125,0.06)", border: "1px solid rgba(215,187,125,0.15)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(215,187,125,0.14)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(215,187,125,0.06)")}
                  data-testid={`btn-cluster-select-${b.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-brand-gold truncate">{b.nome_bia}</p>
                    {b.localizacao && <p className="text-[10px] text-brand-gold/40 truncate">{b.localizacao}</p>}
                  </div>
                  {n(b.valor_geral_venda_vgv) > 0 && (
                    <p className="text-[10px] text-brand-gold/70 tabular-nums shrink-0">{formatMoney(n(b.valor_geral_venda_vgv), b.moeda || "BRL")}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected BIA info panel */}
      {selectedBia && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 transition-all duration-300"
          style={{
            background: "linear-gradient(to top, rgba(0,8,20,0.98) 0%, rgba(0,12,28,0.96) 70%, transparent 100%)",
            padding: "32px 24px 18px",
          }}
        >
          {/* Close button */}
          <div className="absolute top-3 right-4 flex items-center gap-3">
            <button
              onClick={() => navigate(getBiaUrl(selectedBia))}
              className="text-brand-gold/70 hover:text-brand-gold transition-colors font-mono text-xs tracking-widest border border-brand-gold/20 hover:border-brand-gold/50 px-2 py-0.5 rounded"
              data-testid="btn-map-navigate-bia"
            >
              VER DETALHES →
            </button>
            <button
              onClick={() => setSelectedBia(null)}
              className="text-brand-gold/40 hover:text-brand-gold/80 transition-colors font-mono text-xs tracking-widest"
              data-testid="btn-map-close-panel"
            >
              ✕
            </button>
          </div>

          <div className="font-mono">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-brand-gold/40 tracking-[0.35em] uppercase mb-0.5">// Aliança Selecionada</p>
                <h3 className="text-base font-bold text-brand-gold leading-tight truncate">{selectedBia.nome_bia}</h3>
                {selectedBia.localizacao && (
                  <p className="text-[11px] text-brand-gold/50 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 shrink-0" />{selectedBia.localizacao}
                  </p>
                )}
              </div>

              {/* Key metrics */}
              <div className="flex gap-5 shrink-0 text-right">
                {n(selectedBia.valor_geral_venda_vgv) > 0 && (
                  <div>
                    <p className="text-[8px] text-brand-gold/35 tracking-widest uppercase">VGV</p>
                    <p className="text-xs font-semibold text-brand-gold tabular-nums">{formatMoney(n(selectedBia.valor_geral_venda_vgv), selectedBia.moeda || "BRL")}</p>
                  </div>
                )}
                {n(selectedBia.resultado_liquido) !== 0 && (
                  <div>
                    <p className="text-[8px] text-brand-gold/35 tracking-widest uppercase">Resultado</p>
                    <p className={`text-xs font-semibold tabular-nums ${n(selectedBia.resultado_liquido) >= 0 ?"text-green-400" : "text-red-400"}`}>
                      {formatMoney(n(selectedBia.resultado_liquido), selectedBia.moeda || "BRL")}
                    </p>
                  </div>
                )}
                {n(selectedBia.lucro_previsto) !== 0 && (
                  <div>
                    <p className="text-[8px] text-brand-gold/35 tracking-widest uppercase">Lucro Prev.</p>
                    <p className="text-xs font-semibold text-brand-gold/80 tabular-nums">{formatMoney(n(selectedBia.lucro_previsto), selectedBia.moeda || "BRL")}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent mb-3" />

            {/* Details row */}
            <div className="flex items-start gap-6">
              {/* Left: objetivo + OPAs */}
              <div className="flex-1 min-w-0 space-y-2">
                {selectedBia.objetivo_alianca && (
                  <p className="text-[10px] text-brand-gold/45 leading-relaxed line-clamp-2">{selectedBia.objetivo_alianca}</p>
                )}
                {(() => {
                  const biasOpas = opas.filter(o => o.bia_id === selectedBia.id);
                  if (!biasOpas.length) return null;
                  return (
                    <div>
                      <p className="text-[8px] text-brand-gold/35 tracking-[0.3em] uppercase mb-1.5">
                        OPAs Relacionadas ({biasOpas.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {biasOpas.map(opa => (
                          <span
                            key={opa.id}
                            className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-sm"
                            style={{ background: "rgba(215,187,125,0.1)", border: "1px solid rgba(215,187,125,0.25)", color: "#D7BB7D99" }}
                          >
                            <span style={{ color: "#D7BB7D60" }}>◆</span>
                            {opa.nome_oportunidade || "OPA sem nome"}
                            {n(opa.valor_origem_opa) > 0 && (
                              <span style={{ color: "#D7BB7D50" }}> · {formatMoney(n(opa.valor_origem_opa), selectedBia.moeda || "BRL")}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right: author + coords */}
              <div className="text-right shrink-0 space-y-0.5">
                {(() => {
                  const autor = membros.find(m => m.id === selectedBia.autor_bia);
                  return autor ?(
                    <p className="text-[9px] text-brand-gold/40">
                      <span className="text-brand-gold/25">Autor: </span>{getMembroNome(autor)}
                    </p>
                  ) : null;
                })()}
                <p className="text-[9px] text-brand-gold/25 font-mono">
                  {parseFloat(String(selectedBia.latitude)).toFixed(4)}, {parseFloat(String(selectedBia.longitude)).toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No coords hint */}
      {biasAll.length > 0 && biasWithCoords.length === 0 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <p className="text-[10px] text-brand-gold/30 font-mono tracking-wider">
            Adicione coordenadas às BIAs para visualizar no mapa
          </p>
        </div>
      )}

      {/* Decorative scan line */}
      <div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(to right, transparent, #D7BB7D40 20%, #D7BB7D60 50%, #D7BB7D40 80%, transparent)",
          animation: "scanLine 6s linear infinite",
          top: 0,
        }}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes scanLine {
            0% { top: 0%; opacity: 0; }
            5% { opacity: 1; }
            95% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
        `
      }} />
    </div>
  );
}

// ---- BIA Card ----
function BiaCard({ bia, membros, opas, onEdit, onDelete, aprovacaoPendente }: {
  bia: BiasProjeto; membros: Membro[]; opas: Oportunidade[];
  onEdit: () => void; onDelete: () => void; aprovacaoPendente?: boolean;
}) {
  const [, navigate] = useLocation();
  const membroMap = useMemo(() => {
    const map: Record<string, string> = {};
    membros.forEach((m) => { map[m.id] = getMembroNome(m); });
    return map;
  }, [membros]);

  const valorRealizado = n(bia.valor_realizado_venda);
  const vgv = n(bia.valor_geral_venda_vgv);
  const progresso = vgv > 0 ? Math.max(0, Math.min(100, Math.round((valorRealizado / vgv) * 100))) : bia.situacao === "ativa" ? 35 : 15;
  const situacaoLabel = bia.situacao === "em_formacao" ? "Em estruturação" : "Ativa";
  const situacaoClass = bia.situacao === "em_formacao"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-blue-200 bg-blue-50 text-blue-700";
  const biasOpas = opas.filter(o => o.bia_id === bia.id);
  const firstImageOpa = biasOpas.find(o => o.imagem_url || o.imagem_directus_id);
  const biaImageUrl = versionAssetUrl(bia.imagem_url) || versionAssetUrl(bia.imagem_directus_id);
  const imageUrl = biaImageUrl || versionAssetUrl(firstImageOpa?.imagem_url) || versionAssetUrl(firstImageOpa?.imagem_directus_id);
  const cppCount = [
    bia.cpp_autor_opa,
    bia.cpp_aliado_built,
    bia.cpp_built,
    bia.cpp_dir_alianca,
    bia.cpp_dir_tecnico,
    bia.cpp_dir_obras,
    bia.cpp_dir_comercial,
    bia.cpp_dir_capital,
  ].filter(value => n(value) > 0).length;
  const nucleosAtivos = [
    bia.diretor_nucleo_tecnico,
    bia.diretor_execucao,
    bia.diretor_comercial,
    bia.diretor_capital,
  ].filter(Boolean).length;

  const dirAlianca = bia.diretor_alianca ?membroMap[bia.diretor_alianca] : null;
  const aliadoBuilt = bia.aliado_built ?membroMap[bia.aliado_built] : null;

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-border/70 bg-card shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
      data-testid={`card-bia-${bia.id}`}
      onClick={() => navigate(getBiaUrl(bia))}
    >
      <CardContent className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-slate-100 lg:h-[96px] lg:w-[142px]">
            {imageUrl ? (
              <img src={imageUrl} alt={bia.nome_bia} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(37,99,235,0.18),rgba(241,245,249,0.95))] text-blue-500/35">
                <Building2 className="h-10 w-10" />
              </div>
            )}
          </div>

          <div className="min-w-0 lg:flex-[1.05]">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`h-5 px-2 text-[9px] font-semibold ${situacaoClass}`}>
                {situacaoLabel}
              </Badge>
              {aprovacaoPendente && (
                <Badge variant="outline" className="h-5 shrink-0 gap-1 border-amber-400/60 bg-amber-400/10 px-2 text-[9px] text-amber-600">
                  <Clock className="h-2.5 w-2.5" /> Aguardando aprovação
                </Badge>
              )}
              {bia.destinacao && (
                <Badge variant="secondary" className="h-5 bg-blue-500 px-2 text-[9px] font-medium text-white">
                  {bia.destinacao}
                </Badge>
              )}
            </div>
            <CardTitle className="line-clamp-1 text-sm font-semibold leading-tight sm:text-base" data-testid={`text-bia-nome-${bia.id}`}>
              {bia.nome_bia}
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              {bia.localizacao && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{bia.localizacao}</span>
                  {bia.latitude && bia.longitude && <Crosshair className="h-3 w-3 shrink-0 text-blue-500/60" aria-label="Geolocalizado" />}
                </span>
              )}
              {(bia.codigo_publico || bia.id) && <span className="font-mono text-[11px]">BIA-{getBiaPublicRef(bia).toUpperCase()}</span>}
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {bia.observacoes || bia.objetivo_alianca || "Aliança patrimonial integrada BUILT."}
            </p>
            {(aliadoBuilt || dirAlianca) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {aliadoBuilt && (
                  <Badge variant="outline" className="h-5 gap-1 text-[9px] font-normal">
                    <Building2 className="h-3 w-3" /> {aliadoBuilt}
                  </Badge>
                )}
                {dirAlianca && dirAlianca !== aliadoBuilt && (
                  <Badge variant="outline" className="h-5 gap-1 text-[9px] font-normal">
                    <Crown className="h-3 w-3" /> {dirAlianca}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-2 lg:max-w-[440px] lg:flex-[1.3] xl:max-w-[500px]">
            <div>
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span>Progresso geral</span>
                <span className="font-semibold text-foreground">{progresso}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${bia.situacao === "em_formacao" ? "bg-emerald-500" : "bg-blue-600"}`}
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-[72px_minmax(130px,1fr)_72px] gap-4">
              <div>
                <p className="text-[9px] text-muted-foreground">CPPs distribuídas</p>
                <p className="text-xs font-semibold text-foreground">{cppCount || biasOpas.length || "-"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-muted-foreground">VGV</p>
                <p className="break-words text-xs font-semibold leading-tight text-foreground" data-testid={`text-vgv-${bia.id}`}>{vgv > 0 ? formatMoney(vgv, bia.moeda || "BRL") : "-"}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Núcleos</p>
                <p className="text-xs font-semibold text-foreground">{nucleosAtivos || "-"}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 lg:ml-auto lg:w-[220px] lg:shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[112px] border-blue-200 px-4 text-xs text-blue-700 hover:bg-blue-50"
              onClick={(e) => { e.stopPropagation(); navigate(getBiaUrl(bia)); }}
              data-testid={`btn-view-bia-${bia.id}`}
            >
              Ver detalhes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- BIA Form Sheet ----
export function BiaFormSheet({ open, onClose, bia, membros, isLoading, canDelete = false, onRequestDelete }: {
  open: boolean;
  onClose: () => void;
  bia: BiasProjeto | null;
  membros: Membro[];
  isLoading: boolean;
  canDelete?: boolean;
  onRequestDelete?: (bia: BiasProjeto) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isEdit = !!bia;
  const membroLogadoId = user?.membro_directus_id || "";
  const canEditAliadoBuilt = user?.role === "admin" || user?.role === "manager";

  const EMPTY_INFO = {
    razao_social: "",
    cnpj: "",
    nome_fantasia: "",
    inscricao_estadual: "",
    banco: "",
    agencia: "",
    conta: "",
    tipo_conta: "",
    titular_conta: "",
    chave_pix: "",
    ativo_endereco: "",
    ativo_bairro: "",
    ativo_cidade: "",
    ativo_estado: "",
    ativo_pais: "",
    ativo_qualificacao: "",
    ativo_descricao_adicional: "",
    ativo_area_m2: "",
    ativo_numero: "",
    ativo_complemento: "",
    ativo_cep: "",
    ativo_numero_matricula: "",
    ativo_livro: "",
    ativo_folha: "",
    ativo_cartorio: "",
    ativo_comarca: "",
  };
  type InfoComercialForm = typeof EMPTY_INFO;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [infoForm, setInfoForm] = useState<InfoComercialForm>(EMPTY_INFO);
  const [activeTab, setActiveTab] = useState("geral");
  const [quickMemberOpen, setQuickMemberOpen] = useState(false);
  const [quickMemberName, setQuickMemberName] = useState("");
  const [quickMemberCompany, setQuickMemberCompany] = useState("");
  const [conviteDialogOpen, setConviteDialogOpen] = useState(false);
  const [conviteTipo, setConviteTipo] = useState("vitrine");
  const [chamadaDialogOpen, setChamadaDialogOpen] = useState(false);
  const [chamadaDiretorCampo, setChamadaDiretorCampo] = useState<ChamadaAlvoCampo | null>(null);
  const [chamadaDataHora, setChamadaDataHora] = useState("");
  const [chamadaLink, setChamadaLink] = useState("");
  const [chamadaOpaTitulo, setChamadaOpaTitulo] = useState(CHAMADA_ALIANCA_TITULO_OPA);
  const [chamadaOpaTipo, setChamadaOpaTipo] = useState("Liderança");
  const [chamadaOpaValor, setChamadaOpaValor] = useState("");
  const [chamadaOpaMem, setChamadaOpaMem] = useState("100");
  const [chamadaOpaDescricao, setChamadaOpaDescricao] = useState("");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [existingAnexos, setExistingAnexos] = useState<AnexoFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [biaImagePreview, setBiaImagePreview] = useState<string | null>(null);
  const [ativoCepLoading, setAtivoCepLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleAtivoCepChange = async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    setInfoForm(current => ({ ...current, ativo_cep: digits }));
    if (digits.length !== 8) return;

    setAtivoCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.erro) return;
      setInfoForm(current => ({
        ...current,
        ativo_cep: digits,
        ativo_endereco: data.logradouro || current.ativo_endereco,
        ativo_bairro: data.bairro || current.ativo_bairro,
        ativo_cidade: data.localidade || current.ativo_cidade,
        ativo_estado: data.uf || current.ativo_estado,
        ativo_pais: current.ativo_pais || "Brasil",
      }));
    } catch (error) {
      console.warn("[bia] Nao foi possivel buscar o CEP do ativo", error);
    } finally {
      setAtivoCepLoading(false);
    }
  };

  const { data: meuConvite } = useQuery<any>({
    queryKey: ["/api/meu-convite"],
    queryFn: async () => {
      const res = await fetch("/api/meu-convite", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.membro_directus_id && conviteDialogOpen,
    staleTime: 60000,
  });
  const meuConviteLink = normalizeInviteLink(meuConvite?.link);

  const gerarConviteMutation = useMutation({
    mutationFn: async ({ force = false, tipo = conviteTipo }: { force?: boolean; tipo?: string } = {}) => {
      const res = await fetch("/api/meu-convite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: !!force, tipo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao gerar convite");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meu-convite"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao gerar convite", description: err.message, variant: "destructive" });
    },
  });

  const { data: minhasComunidades = [] } = useQuery<ComunidadeVinculo[]>({
    queryKey: ["/api/membros", membroLogadoId, "comunidades"],
    queryFn: async () => {
      const res = await fetch(`/api/membros/${membroLogadoId}/comunidades`, { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json().catch(() => []);
      return Array.isArray(json) ? json : [];
    },
    enabled: open && !isEdit && !!membroLogadoId,
    staleTime: 60_000,
  });

  const comunidadeMaeDoMembro = useMemo(() => {
    if (!Array.isArray(minhasComunidades) || minhasComunidades.length === 0) return null;
    return minhasComunidades.find((comunidade) => comunidade.is_mae) || minhasComunidades[0] || null;
  }, [minhasComunidades]);

  function handleConviteTipoChange(tipo: string) {
    setConviteTipo(tipo);
    gerarConviteMutation.mutate({ force: true, tipo });
  }

  const dispararAliancaMutation = useMutation({
    mutationFn: async () => {
      if (!bia?.id || !chamadaDiretorCampo) throw new Error("BIA ou papel não informado");
      if (isDiretorChamadaField(chamadaDiretorCampo) && parseBRLToNumber(chamadaOpaValor) <= 0) {
        throw new Error("Ajuste o percentual DM deste diretor antes de disparar a chamada.");
      }
      const response = await apiRequest("POST", `/api/bias/${bia.id}/disparar-alianca`, {
        diretor_campo: chamadaDiretorCampo,
        data_hora: chamadaDataHora,
        link_reuniao: /^https?:\/\//i.test(chamadaLink.trim()) ? chamadaLink.trim() : `https://${chamadaLink.trim()}`,
        opa: {
          nome_oportunidade: chamadaOpaTitulo,
          tipo: chamadaOpaTipo,
          valor_origem_opa: parseBRLToNumber(chamadaOpaValor),
          Minimo_esforco_multiplicador: parseFloat(chamadaOpaMem.replace(",", ".")) || 0,
          descricao: chamadaOpaDescricao,
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      const count = Number(data?.destinatarios_count || 0);
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chamadas-alianca/minhas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      if (bia?.id) queryClient.invalidateQueries({ queryKey: ["/api/chamadas-alianca/bia", bia.id] });
      toast({
        title: "Aliança disparada",
        description: `OPA “${data?.opa?.nome_oportunidade || chamadaOpaTitulo}” criada e chamada enviada para ${count} membro${count !== 1 ? "s" : ""}.`,
      });
      setChamadaDialogOpen(false);
      setChamadaDiretorCampo(null);
      setChamadaDataHora("");
      setChamadaLink("");
      setChamadaOpaTitulo(CHAMADA_ALIANCA_TITULO_OPA);
      setChamadaOpaTipo("Liderança");
      setChamadaOpaValor("");
      setChamadaOpaMem("100");
      setChamadaOpaDescricao("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao disparar aliança",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const { data: diretorSolicitacoesPendentes = [] } = useQuery<BiaDiretorSolicitacao[]>({
    queryKey: ["/api/bia-diretor-solicitacoes/bia", bia?.id],
    queryFn: async () => {
      if (!bia?.id) return [];
      const res = await fetch(`/api/bia-diretor-solicitacoes/bia/${bia.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!bia?.id,
  });

  const { data: socioSolicitacoesPendentes = [] } = useQuery<BiaSocioSolicitacao[]>({
    queryKey: ["/api/bia-socio-solicitacoes/bia", bia?.id],
    queryFn: async () => {
      if (!bia?.id) return [];
      const res = await fetch(`/api/bia-socio-solicitacoes/bia/${bia.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!bia?.id,
  });

  const { data: chamadasAlianca = [] } = useQuery<ChamadaAlianca[]>({
    queryKey: ["/api/chamadas-alianca/bia", bia?.id],
    queryFn: async () => {
      if (!bia?.id) return [];
      const res = await fetch(`/api/chamadas-alianca/bia/${bia.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!bia?.id,
  });

  // Forma de pagamento do ativo de origem
  const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [vencimentosParcelas, setVencimentosParcelas] = useState<string[]>([]);
  const [valoresParcelas, setValoresParcelas] = useState<number[]>([]);
  const [valorAVista, setValorAVista] = useState(0);
  const [cppSummary, setCppSummary] = useState<{ cppCount: number; parcelas: number; contributorLabels: string[] } | null>(null);
  const [cppError, setCppError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(bia ?biaToForm(bia) : EMPTY_FORM);
      setInfoForm(EMPTY_INFO);
      setActiveTab("geral");
      setExistingAnexos(bia?.Anexos ?? []);
      setPendingFiles([]);
      setBiaImagePreview(versionAssetUrl(bia?.imagem_url) || versionAssetUrl(bia?.imagem_directus_id));
      setUploading(false);
      setFormaPagamento("");
      setNumeroParcelas("");
      setVencimento("");
      setVencimentosParcelas([]);
      setValoresParcelas([]);
      setValorAVista(0);
      setCppSummary(null);
      setCppError(null);
      if (bia?.id) {
        fetch(`/api/bias/${bia.id}/info-comercial`, { credentials: "include" })
          .then(r => r.ok ?r.json() : {})
          .then((data: any) => {
            setInfoForm({
              razao_social: data.razao_social || "",
              cnpj: data.cnpj || "",
              nome_fantasia: data.nome_fantasia || "",
              inscricao_estadual: data.inscricao_estadual || "",
              banco: data.banco || "",
              agencia: data.agencia || "",
              conta: data.conta || "",
              tipo_conta: data.tipo_conta || "",
              titular_conta: data.titular_conta || "",
              chave_pix: data.chave_pix || "",
              ativo_endereco: data.ativo_endereco || "",
              ativo_bairro: data.ativo_bairro || "",
              ativo_cidade: data.ativo_cidade || "",
              ativo_estado: data.ativo_estado || "",
              ativo_pais: data.ativo_pais || "",
              ativo_qualificacao: data.ativo_qualificacao || "",
              ativo_descricao_adicional: data.ativo_descricao_adicional || "",
              ativo_area_m2: data.ativo_area_m2 || "",
              ativo_numero: data.ativo_numero || "",
              ativo_complemento: data.ativo_complemento || "",
              ativo_cep: data.ativo_cep || "",
              ativo_numero_matricula: data.ativo_numero_matricula || "",
              ativo_livro: data.ativo_livro || "",
              ativo_folha: data.ativo_folha || "",
              ativo_cartorio: data.ativo_cartorio || "",
              ativo_comarca: data.ativo_comarca || "",
            });
          })
          .catch(() => {});
      }
    }
  }, [open, bia]);

  useEffect(() => {
    if (!open || isEdit) return;
    const aliadoId = relationId(comunidadeMaeDoMembro?.aliado);
    const diretorId = membroLogadoId;
    if (!aliadoId && !diretorId) return;

    setForm((current) => ({
      ...current,
      aliado_built: current.aliado_built || aliadoId || "",
      diretor_alianca: current.diretor_alianca || diretorId || "",
    }));
  }, [open, isEdit, comunidadeMaeDoMembro, membroLogadoId]);

  useEffect(() => {
    if (!open || !bia?.id || diretorSolicitacoesPendentes.length === 0) return;

    const diretorFields = new Set<keyof FormState>([
      "diretor_alianca",
      "diretor_nucleo_tecnico",
      "diretor_execucao",
      "diretor_comercial",
      "diretor_capital",
    ]);
    const percentualByDiretor: Partial<Record<keyof FormState, keyof FormState>> = {
      diretor_alianca: "perc_dir_alianca",
      diretor_nucleo_tecnico: "perc_dir_tecnico",
      diretor_execucao: "perc_dir_obras",
      diretor_comercial: "perc_dir_comercial",
      diretor_capital: "perc_dir_capital",
    };

    setForm((current) => {
      let changed = false;
      const next = { ...current };

      diretorSolicitacoesPendentes
        .filter((solicitacao) => solicitacao.status === "pendente")
        .forEach((solicitacao) => {
          const diretorField = solicitacao.campo_diretor as keyof FormState;
          if (!diretorFields.has(diretorField) || !solicitacao.diretor_membro_id) return;

          if (String(next[diretorField] || "") !== String(solicitacao.diretor_membro_id)) {
            (next as any)[diretorField] = solicitacao.diretor_membro_id;
            changed = true;
          }

          const percentualField = percentualByDiretor[diretorField];
          if (percentualField && solicitacao.percentual != null && String(next[percentualField] || "") !== String(solicitacao.percentual)) {
            (next as any)[percentualField] = String(solicitacao.percentual);
            changed = true;
          }
        });

      return changed ? next : current;
    });
  }, [open, bia?.id, diretorSolicitacoesPendentes]);

  useEffect(() => {
    if (!open || !bia?.id || socioSolicitacoesPendentes.length === 0) return;

    setForm((current) => {
      let changed = false;
      const next = { ...current };

      (["socios_guardioes", "socios_multiplicadores"] as const).forEach((field) => {
        const selected = parseMemberList(next[field] as string[] | string);
        const selectedSet = new Set(selected);
        socioSolicitacoesPendentes
          .filter((solicitacao) =>
            solicitacao.status === "pendente" &&
            solicitacao.campo_socios === field &&
            solicitacao.socio_membro_id
          )
          .forEach((solicitacao) => selectedSet.add(solicitacao.socio_membro_id));

        const merged = Array.from(selectedSet);
        if (merged.length !== selected.length) {
          (next as any)[field] = merged;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [open, bia?.id, socioSolicitacoesPendentes]);

  async function uploadFiles(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro no upload" }));
      throw new Error(err.error || "Erro no upload");
    }
    const result = await res.json();
    return result.fileIds as string[];
  }

  async function uploadBiaImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Falha no upload da imagem");
      const result = await res.json();
      const fileId = result.fileIds?.[0];
      if (!fileId) throw new Error("Upload sem arquivo retornado");
      setForm((current) => ({ ...current, imagem_directus_id: fileId }));
      setBiaImagePreview(URL.createObjectURL(file));
    } catch (e: any) {
      toast({ title: "Erro ao enviar imagem", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const valorRealizado = parseBRLToNumber(form.valor_realizado_venda);
  // valorOrigem é derivado da forma de pagamento (se definida) ou do campo manual
  const numParcelasInt = parseInt(numeroParcelas) || 0;
  const valorOrigem = (() => {
    if (formaPagamento === "parcelado") return valoresParcelas.reduce((s, v) => s + (v || 0), 0);
    if (formaPagamento === "a_vista") return valorAVista;
    return parseBRLToNumber(form.valor_origem);
  })();

  const diretorPendingByField = useMemo(() => {
    const fields: Array<keyof FormState> = [
      "diretor_alianca",
      "diretor_nucleo_tecnico",
      "diretor_execucao",
      "diretor_comercial",
      "diretor_capital",
    ];
    const result: Partial<Record<keyof FormState, boolean>> = {};

    fields.forEach((field) => {
      const selectedId = String(form[field] || "");
      if (!selectedId) return;

      const savedId = bia ? String((bia as any)[field] || "") : "";
      const hasPendingSolicitacao = diretorSolicitacoesPendentes.some((solicitacao) =>
        solicitacao.status === "pendente" &&
        solicitacao.campo_diretor === field &&
        solicitacao.diretor_membro_id === selectedId
      );

      result[field] = hasPendingSolicitacao || (isEdit && selectedId !== savedId);
    });

    return result;
  }, [
    bia,
    diretorSolicitacoesPendentes,
    form.diretor_alianca,
    form.diretor_nucleo_tecnico,
    form.diretor_execucao,
    form.diretor_comercial,
    form.diretor_capital,
    isEdit,
  ]);

  const socioPendingByField = useMemo(() => {
    const fields: Array<"socios_guardioes" | "socios_multiplicadores"> = [
      "socios_guardioes",
      "socios_multiplicadores",
    ];
    const result: Record<"socios_guardioes" | "socios_multiplicadores", Set<string>> = {
      socios_guardioes: new Set<string>(),
      socios_multiplicadores: new Set<string>(),
    };

    fields.forEach((field) => {
      const selectedIds = parseMemberList(form[field] as string[] | string);
      const savedIds = new Set(bia ? parseMemberList((bia as any)[field]) : []);

      selectedIds.forEach((id) => {
        const hasPendingSolicitacao = socioSolicitacoesPendentes.some((solicitacao) =>
          solicitacao.status === "pendente" &&
          solicitacao.campo_socios === field &&
          solicitacao.socio_membro_id === id
        );
        if (hasPendingSolicitacao || (isEdit && !savedIds.has(id)) || !isEdit) {
          result[field].add(id);
        }
      });
    });

    return result;
  }, [
    bia,
    form.socios_guardioes,
    form.socios_multiplicadores,
    isEdit,
    socioSolicitacoesPendentes,
  ]);

  function getNextChamadaOrder(field: ChamadaAlvoCampo) {
    const maxOrder = chamadasAlianca
      .filter((item) => item.diretor_campo === field)
      .reduce((max, item) => Math.max(max, Number(item.ordem) || 0), 0);
    return maxOrder + 1;
  }

  function isDiretorChamadaField(field: ChamadaAlvoCampo | null): boolean {
    return !!field && !!DIRETOR_CHAMADA_PERCENT_FIELDS[field];
  }

  function getChamadaDmValue(field: ChamadaAlvoCampo): number {
    const percentField = DIRETOR_CHAMADA_PERCENT_FIELDS[field];
    if (!percentField) return valorOrigem;
    const percent = parsePercentToNumber(form[percentField] as any);
    return valorOrigem * percent / 100;
  }

  function openChamadaDialog(field: ChamadaAlvoCampo) {
    const nextOrder = getNextChamadaOrder(field);
    const etapaLabel = CHAMADA_SEQUENCE_LABELS[nextOrder] || "RO para a comunidade";
    const opaValue = getChamadaDmValue(field);
    setChamadaDiretorCampo(field);
    setChamadaDataHora("");
    setChamadaLink("");
    setChamadaOpaTitulo(CHAMADA_ALIANCA_TITULO_OPA);
    setChamadaOpaTipo(DIRETOR_CHAMADA_TIPOS[field] || "Liderança");
    setChamadaOpaValor(opaValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setChamadaOpaMem("100");
    setChamadaOpaDescricao([
      `${etapaLabel} da BIA ${form.nome_bia || bia?.nome_bia || ""}.`,
      `Papel em aberto: ${DIRETOR_CHAMADA_LABELS[field] || "Papel da aliança"}.`,
    ].join("\n"));
    setChamadaDialogOpen(true);
    if (isDiretorChamadaField(field) && opaValue <= 0) {
      toast({
        title: "Valor da chamada zerado",
        description: `Ajuste o percentual DM de ${DIRETOR_CHAMADA_LABELS[field] || "diretoria"} antes de disparar a chamada.`,
        variant: "destructive",
      });
    }
  }

  const chamadaValorZerado = isDiretorChamadaField(chamadaDiretorCampo) && parseBRLToNumber(chamadaOpaValor) <= 0;

  function renderDispararAliancaButton(field: ChamadaAlvoCampo) {
    const cargoPreenchido = Array.isArray(form[field])
      ? parseMemberList(form[field] as string[] | string).length > 0
      : !!form[field];
    const nextOrder = getNextChamadaOrder(field);
    const concluded = nextOrder > 4;
    return (
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 border-blue-200 text-xs text-blue-700 hover:bg-blue-50"
          onClick={() => openChamadaDialog(field)}
          disabled={!isEdit || cargoPreenchido || concluded}
          data-testid={`btn-disparar-alianca-${field}`}
        >
          <Bell className="h-3.5 w-3.5" />
          {concluded ? "Ciclo concluído" : cargoPreenchido ? "Papel preenchido" : "Disparar chamada para aliança"}
        </Button>
      </div>
    );
  }

  const percTotal = ["perc_autor_opa","perc_aliado_built","perc_built","perc_dir_alianca","perc_dir_tecnico",
    "perc_dir_obras","perc_dir_comercial","perc_dir_capital"].reduce(
    (s, k) => s + (parseFloat(form[k as keyof FormState] as string) || 0), 0
  );
  const custoOrigemPreview = valorOrigem + (valorOrigem * percTotal / 100);
  const activeContributors = 1
    + (form.autor_bia && (parseFloat(form.perc_autor_opa) || 0) > 0 ?1 : 0)
    + (form.aliado_built && (parseFloat(form.perc_aliado_built) || 0) > 0 ?1 : 0)
    + (form.diretor_alianca && (parseFloat(form.perc_dir_alianca) || 0) > 0 ?1 : 0)
    + (form.diretor_nucleo_tecnico && (parseFloat(form.perc_dir_tecnico) || 0) > 0 ?1 : 0)
    + (form.diretor_execucao && (parseFloat(form.perc_dir_obras) || 0) > 0 ?1 : 0)
    + (form.diretor_comercial && (parseFloat(form.perc_dir_comercial) || 0) > 0 ?1 : 0)
    + (form.diretor_capital && (parseFloat(form.perc_dir_capital) || 0) > 0 ?1 : 0);
  const parcelasSync = formaPagamento === "parcelado" ?numParcelasInt : 1;
  const estimatedCppEntries = parcelasSync * activeContributors;
  const estimatedBaseEntries = parcelasSync;
  const estimatedEntries = parcelasSync * (1 + activeContributors);
  const estimatedSeconds = Math.max(5, Math.round(estimatedEntries * 0.5));
  const estimatedLabel = estimatedSeconds >= 60 ?`~${Math.ceil(estimatedSeconds / 60)} min` : `~${estimatedSeconds}s`;
  const hasIncompleteInstallments = formaPagamento === "parcelado" && (
    numParcelasInt <= 1 ||
    valoresParcelas.filter(v => v > 0).length !== numParcelasInt ||
    vencimentosParcelas.filter(Boolean).length !== numParcelasInt
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      setCppError(null);
      setCppSummary(null);
      if (formaPagamento === "parcelado") {
        if (numParcelasInt <= 1) {
          throw new Error("Informe a quantidade de parcelas do ativo de origem.");
        }
        if (valoresParcelas.filter(v => v > 0).length !== numParcelasInt) {
          throw new Error("Preencha o valor de todas as parcelas antes de salvar.");
        }
        if (vencimentosParcelas.filter(Boolean).length !== numParcelasInt) {
          throw new Error("Preencha a data de vencimento de todas as parcelas antes de salvar.");
        }
      }
      setUploading(pendingFiles.length > 0);
      let newFileIds: string[] = [];
      if (pendingFiles.length > 0) {
        newFileIds = await uploadFiles(pendingFiles);
        setUploading(false);
      }
      const existingIds = existingAnexos.map(a => a.id);
      const allAnexoIds = [...existingIds, ...newFileIds];
      const sociosMultiplicadores = parseMemberList(form.socios_multiplicadores);
      const multiplicadoresSet = new Set(sociosMultiplicadores);
      const sociosGuardioes = parseMemberList(form.socios_guardioes).filter((id) => !multiplicadoresSet.has(id));
      const terceiros = parseMemberList(form.terceiros);

      const payload: Record<string, any> = {
        nome_bia: form.nome_bia.trim(),
        situacao: form.situacao,
        bia_publica: form.bia_publica,
        destinacao: form.destinacao.trim() || null,
        selo_certified_alliance: form.selo_certified_alliance,
        localizacao: form.localizacao.trim() || null,
        latitude: form.latitude ?parseFloat(form.latitude) : null,
        longitude: form.longitude ?parseFloat(form.longitude) : null,
        objetivo_alianca: form.objetivo_alianca.trim() || null,
        observacoes: form.observacoes.trim() || null,
        autor_bia: form.autor_bia || null,
        aliado_built: form.aliado_built || null,
        diretor_alianca: form.diretor_alianca || null,
        diretor_nucleo_tecnico: form.diretor_nucleo_tecnico || null,
        diretor_execucao: form.diretor_execucao || null,
        diretor_comercial: form.diretor_comercial || null,
        diretor_capital: form.diretor_capital || null,
        socios_multiplicadores: sociosMultiplicadores,
        socios_guardioes: sociosGuardioes,
        terceiros,
        valor_origem: valorOrigem || null,
        _forma_pagamento: formaPagamento || null,
        _numero_parcelas: formaPagamento === "parcelado" ?numParcelasInt : null,
        _vencimento_origem: formaPagamento === "a_vista" ?(vencimento || null) : null,
        _vencimentos_parcelas: formaPagamento === "parcelado" ?vencimentosParcelas : [],
        _valores_parcelas: formaPagamento === "parcelado" ?valoresParcelas : [],
        perc_autor_opa: form.perc_autor_opa || null,
        perc_aliado_built: form.perc_aliado_built || null,
        perc_built: form.perc_built || null,
        perc_dir_alianca: form.perc_dir_alianca || null,
        perc_dir_tecnico: form.perc_dir_tecnico || null,
        perc_dir_obras: form.perc_dir_obras || null,
        perc_dir_comercial: form.perc_dir_comercial || null,
        perc_dir_capital: form.perc_dir_capital || null,
        valor_geral_venda_vgv: form.valor_geral_venda_vgv ?parseBRLToNumber(form.valor_geral_venda_vgv) : null,
        valor_realizado_venda: form.valor_realizado_venda ?parseBRLToNumber(form.valor_realizado_venda) : null,
        comissao_prevista_corretor: form.comissao_prevista_corretor || null,
        ir_previsto: form.ir_previsto || null,
        inss_previsto: form.inss_previsto || null,
        manutencao_pos_obra_prevista: form.manutencao_pos_obra_prevista || null,
        inicio_aportes: form.inicio_aportes || null,
        total_aportes: form.total_aportes ?parseBRLToNumber(form.total_aportes) : null,
        imagem_directus_id: form.imagem_directus_id || null,
        moeda: form.moeda || "BRL",
      };
      if (pendingFiles.length > 0 || allAnexoIds.length > 0) {
        payload.Anexos = allAnexoIds;
      }
      if (isEdit) {
        return apiRequest("PATCH", `/api/bias/${bia!.id}`, payload);
      } else {
        return apiRequest("POST", "/api/bias", payload);
      }
    },
    onSuccess: async (response: Response) => {
      const saved = await response.json().catch(() => null);
      const biaId = saved?.id ?? bia?.id;
      if (biaId) {
        await fetch(`/api/bias/${biaId}/info-comercial`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(infoForm),
        }).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ["/api/bias"] });
      if (biaId) queryClient.invalidateQueries({ queryKey: ["/api/bias", biaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/fluxo-caixa"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bia-diretor-solicitacoes/minhas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bia-socio-solicitacoes/minhas"] });
      if (biaId) {
        queryClient.invalidateQueries({ queryKey: ["/api/bia-diretor-solicitacoes/bia", biaId] });
        queryClient.invalidateQueries({ queryKey: ["/api/bia-socio-solicitacoes/bia", biaId] });
      }
      if (saved?._cppError) {
        const msg = String(saved._cppError).slice(0, 240);
        setCppError(msg);
        toast({
          title: "BIA salva, mas os lançamentos não foram gerados",
          description: msg,
          variant: "destructive",
        });
        return;
      }
      if (saved?._cppSummary) {
        setCppSummary(saved._cppSummary);
        const s = saved._cppSummary;
        const diretorCount = Number(saved?._diretor_solicitacoes || 0);
        const socioCount = Number(saved?._socio_solicitacoes || 0);
        const diretorFallbackText = saved?._diretor_flow_error
          ? " Convite de diretoria indisponível agora; diretores salvos diretamente na BIA."
          : "";
        const diretorText = diretorCount > 0
          ? ` ${diretorCount} solicitação${diretorCount !== 1 ? "ões" : ""} enviada${diretorCount !== 1 ? "s" : ""} para aceite de diretoria.`
          : "";
        const socioText = socioCount > 0
          ? ` ${socioCount} convite${socioCount !== 1 ? "s" : ""} de sócio enviado${socioCount !== 1 ? "s" : ""} para aceite.`
          : "";
        toast({
          title: isEdit ?"BIA atualizada!" : "BIA criada!",
          description: `${s.cppCount} lançamento${s.cppCount !== 1 ?"s" : ""} CPP gerado${s.cppCount !== 1 ?"s" : ""} para ${s.parcelas} parcela${s.parcelas !== 1 ?"s" : ""}.${diretorText}${diretorFallbackText}${socioText}`,
        });
      } else {
        const diretorCount = Number(saved?._diretor_solicitacoes || 0);
        const socioCount = Number(saved?._socio_solicitacoes || 0);
        const diretorFallbackText = saved?._diretor_flow_error
          ? "Convite de diretoria indisponível agora; diretores salvos diretamente na BIA."
          : "";
        const diretorText = diretorCount > 0
          ? `${diretorCount} solicitação${diretorCount !== 1 ? "ões" : ""} enviada${diretorCount !== 1 ? "s" : ""} ao${diretorCount !== 1 ? "s" : ""} diretor${diretorCount !== 1 ? "es" : ""} para aceite.`
          : "";
        const socioText = socioCount > 0
          ? `${socioCount} convite${socioCount !== 1 ? "s" : ""} de sócio enviado${socioCount !== 1 ? "s" : ""} para aceite.`
          : "";
        toast({
          title: isEdit ?"BIA atualizada!" : "BIA criada!",
          description: [diretorText, diretorFallbackText, socioText].filter(Boolean).join(" ") || form.nome_bia,
        });
      }
      onClose();
    },
    onError: (e: any) => {
      setUploading(false);
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  });

  const createQuickMemberMutation = useMutation({
    mutationFn: async () => {
      const nome = quickMemberName.trim();
      if (!nome) throw new Error("Nome é obrigatório");
      const response = await apiRequest("POST", "/api/membros/criar-favorecido", {
        nome,
        empresa: quickMemberCompany.trim() || undefined,
      });
      return response.json() as Promise<Membro>;
    },
    onSuccess: (novo) => {
      queryClient.setQueryData<Membro[]>(["/api/membros"], (prev = []) => {
        if (prev.some((m) => m.id === novo.id)) return prev;
        return [...prev, novo];
      });
      queryClient.invalidateQueries({ queryKey: ["/api/membros"] });
      setQuickMemberName("");
      setQuickMemberCompany("");
      setQuickMemberOpen(false);
      toast({ title: "Membro criado", description: getMembroNome(novo) });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar membro", description: e.message, variant: "destructive" });
    },
  });

  function getMissingRequiredFields(): string[] {
    const missing: string[] = [];
    if (!form.nome_bia.trim()) missing.push("Nome da BIA");
    if (!form.aliado_built) missing.push("Aliado BUILT");
    if (!form.diretor_alianca) missing.push("Diretor de Aliança");
    if (!infoForm.ativo_qualificacao.trim()) missing.push("Qualificação do ativo");
    if (!infoForm.ativo_area_m2.trim()) missing.push("Área do ativo");
    if (!infoForm.ativo_endereco.trim()) missing.push("Endereço do ativo");
    if (!infoForm.ativo_bairro.trim()) missing.push("Bairro do ativo");
    if (!infoForm.ativo_cidade.trim()) missing.push("Cidade do ativo");
    if (!infoForm.ativo_estado.trim()) missing.push("Estado do ativo");
    if (!infoForm.ativo_pais.trim()) missing.push("País do ativo");
    if (!infoForm.ativo_numero.trim()) missing.push("Número do endereço");
    if (!infoForm.ativo_complemento.trim()) missing.push("Complemento do ativo");
    if (!infoForm.ativo_cep.trim()) missing.push("CEP do ativo");
    if (!infoForm.ativo_numero_matricula.trim()) missing.push("Número da matrícula");
    if (!infoForm.ativo_livro.trim()) missing.push("Livro da matrícula");
    if (!infoForm.ativo_folha.trim()) missing.push("Folha da matrícula");
    if (!infoForm.ativo_cartorio.trim()) missing.push("Cartório");
    if (!infoForm.ativo_comarca.trim()) missing.push("Comarca");
    if (!isEdit) {
      if (!form.destinacao.trim()) missing.push("Destinação");
      if (!form.localizacao.trim()) missing.push("Localização");
      if (!form.objetivo_alianca.trim()) missing.push("Objetivo da aliança");
      if (!form.observacoes.trim()) missing.push("Observações");
      if (parseBRLToNumber(form.valor_geral_venda_vgv) <= 0) missing.push("VGV");
    }
    if (!isEdit && form.situacao === "ativa") {
      if (!infoForm.razao_social.trim()) missing.push("Razão social/Nome");
      if (!infoForm.cnpj.trim()) missing.push("CNPJ/CPF");
      if (!infoForm.banco.trim()) missing.push("Banco");
      if (!infoForm.conta.trim()) missing.push("Conta");
      if (!infoForm.titular_conta.trim()) missing.push("Titular da Conta");
    }
    return missing;
  }

  function handleSaveClick() {
    const missing = getMissingRequiredFields();
    if (missing.length > 0) {
      const infoFields = new Set([
        "Qualificação do ativo",
        "Área do ativo",
        "Endereço do ativo",
        "Número do endereço",
        "Complemento do ativo",
        "CEP do ativo",
        "Número da matrícula",
        "Livro da matrícula",
        "Folha da matrícula",
        "Cartório",
        "Comarca",
        "Razão social/Nome",
        "CNPJ/CPF",
        "Banco",
        "Conta",
        "Titular da Conta",
      ]);
      if (missing.some((field) => infoFields.has(field))) setActiveTab("info");
      else if (missing.includes("VGV")) setActiveTab("receita");
      toast({
        title: "Campos obrigatórios pendentes",
        description: `Preencha: ${missing.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  }

  function handleLocationSelect(localizacao: string, lat: number, lng: number) {
    setForm({ ...form, localizacao, latitude: String(lat), longitude: String(lng) });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {isEdit ?<Pencil className="w-4 h-4 text-brand-gold" /> : <Plus className="w-4 h-4 text-brand-gold" />}
              {isEdit ?`Editar BIA` : "Nova BIA"}
            </SheetTitle>
            <SheetDescription>{isEdit ?bia?.nome_bia : "Preencha os dados da nova aliança"}</SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid grid-cols-5">
              <TabsTrigger value="geral" data-testid="tab-geral">Geral</TabsTrigger>
              <TabsTrigger value="equipe" data-testid="tab-equipe">Equipe</TabsTrigger>
              <TabsTrigger value="cpp" data-testid="tab-cpp">DM</TabsTrigger>
              <TabsTrigger value="receita" data-testid="tab-receita">Análises</TabsTrigger>
              <TabsTrigger value="info" data-testid="tab-info">Informações</TabsTrigger>
            </TabsList>

            {/* Tab Geral */}
            <TabsContent value="geral" className="space-y-4 mt-4">
              <FieldInput label="Nome da BIA *" field="nome_bia" form={form} setForm={setForm} placeholder="Ex: BIA Residencial Norte" />

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Imagem da BIA</Label>
                <div className="rounded-xl border border-border bg-muted/20 p-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                      {biaImagePreview ? (
                        <img src={biaImagePreview} alt="Imagem da BIA" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-medium text-foreground">Capa da BIA</p>
                      <p className="text-[11px] text-muted-foreground">Use uma imagem horizontal para aparecer nos cards da BIA.</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={uploading}
                          data-testid="btn-upload-bia-imagem"
                        >
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          {biaImagePreview ? "Trocar imagem" : "Escolher imagem"}
                        </Button>
                        {biaImagePreview && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setForm((current) => ({ ...current, imagem_directus_id: "" }));
                              setBiaImagePreview(null);
                            }}
                            disabled={uploading}
                            data-testid="btn-remove-bia-imagem"
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpg,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadBiaImage(file);
                      e.target.value = "";
                    }}
                    data-testid="input-bia-imagem"
                  />
                </div>
              </div>

              {/* Status da BIA */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status da BIA</Label>
                <ToggleGroup
                  type="single"
                  value={form.situacao}
                  onValueChange={(v) => { if (v) setForm({ ...form, situacao: v as "ativa" | "em_formacao" }); }}
                  className="justify-start"
                  data-testid="toggle-situacao"
                >
                  <ToggleGroupItem
                    value="em_formacao"
                    className="data-[state=on]:bg-amber-500/15 data-[state=on]:text-amber-600 data-[state=on]:border-amber-500/40 border"
                    data-testid="toggle-em-formacao"
                  >
                    Em Formação
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="ativa"
                    className="data-[state=on]:bg-green-500/15 data-[state=on]:text-green-600 data-[state=on]:border-green-500/40 border"
                    data-testid="toggle-ativa"
                  >
                    Ativa
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Destinação */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Destinação <span className="text-red-500">*</span></Label>
                <ToggleGroup
                  type="single"
                  value={form.destinacao}
                  onValueChange={(v) => setForm({ ...form, destinacao: v || "" })}
                  className="justify-start flex-wrap gap-2"
                  data-testid="toggle-destinacao"
                >
                  {["Residencial", "Comercial", "Industrial", "Misto", "Hospedagem", "Rural"].map((opt) => (
                    <ToggleGroupItem
                      key={opt}
                      value={opt}
                      className="border border-input data-[state=on]:border-brand-gold data-[state=on]:bg-brand-gold/10 data-[state=on]:text-brand-gold text-sm px-4"
                      data-testid={`toggle-destinacao-${opt.toLowerCase()}`}
                    >
                      {opt}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {/* Visibilidade */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Visibilidade da BIA</Label>
                <ToggleGroup
                  type="single"
                  value={form.bia_publica ?"publica" : "privada"}
                  onValueChange={(v) => {
                    if (v) setForm({ ...form, bia_publica: v === "publica" });
                  }}
                  className="justify-start"
                  data-testid="toggle-visibilidade-bia"
                >
                  <ToggleGroupItem
                    value="publica"
                    className="border border-input data-[state=on]:border-brand-gold data-[state=on]:bg-brand-gold/10 data-[state=on]:text-brand-gold"
                    data-testid="toggle-bia-publica"
                  >
                    BIA Pública
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="privada"
                    className="border border-input data-[state=on]:border-brand-gold data-[state=on]:bg-brand-gold/10 data-[state=on]:text-brand-gold"
                    data-testid="toggle-bia-privada"
                  >
                    BIA Privada
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Moeda */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Moeda da BIA</Label>
                <CurrencyCombobox
                  value={form.moeda || "BRL"}
                  onChange={(v) => setForm({ ...form, moeda: v })}
                />
              </div>

              {/* Selo Certified Alliance */}
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-brand-gold" />
                  <div>
                    <p className="text-sm font-medium">Selo Certified Alliance</p>
                    <p className="text-xs text-muted-foreground">Esta BIA foi validada por um Aliado BUILT</p>
                  </div>
                </div>
                <Switch
                  checked={form.selo_certified_alliance}
                  onCheckedChange={(v) => setForm({ ...form, selo_certified_alliance: v })}
                  data-testid="switch-selo"
                />
              </div>

              <LocationField form={form} setForm={setForm} onPickerOpen={() => setLocationPickerOpen(true)} />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Objetivo da Aliança <span className="text-red-500">*</span></Label>
                <ToggleGroup
                  type="single"
                  value={form.objetivo_alianca}
                  onValueChange={(v) => setForm({ ...form, objetivo_alianca: v || "" })}
                  className="justify-start gap-2"
                  data-testid="toggle-objetivo"
                >
                  {["Renda", "Venda", "Operação"].map((opt) => (
                    <ToggleGroupItem
                      key={opt}
                      value={opt}
                      className="border border-input data-[state=on]:border-brand-gold data-[state=on]:bg-brand-gold/10 data-[state=on]:text-brand-gold text-sm px-4"
                      data-testid={`toggle-objetivo-${opt.toLowerCase()}`}
                    >
                      {opt}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrição <span className="text-red-500">*</span></Label>
                <Textarea
                  rows={3}
                  placeholder="Descrição da BIA..."
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  className="text-sm resize-none"
                  data-testid="input-observacoes"
                />
              </div>

              {/* Anexos */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs text-muted-foreground">Anexos</Label>
                  {(existingAnexos.length + pendingFiles.length) > 0 && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                      {existingAnexos.length + pendingFiles.length}
                    </span>
                  )}
                </div>

                {/* Existing files */}
                {existingAnexos.length > 0 && (
                  <div className="space-y-1.5">
                    {existingAnexos.map((a, i) => (
                      <div key={a.id} className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-foreground/80 truncate flex-1">{a.title || a.filename || a.id}</span>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setExistingAnexos(existingAnexos.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors"
                          data-testid={`btn-remove-anexo-existing-${i}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending files (not yet uploaded) */}
                {pendingFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md border border-brand-gold/20 bg-brand-gold/[0.04] px-3 py-2">
                        <FileText className="w-3.5 h-3.5 text-brand-gold/60 shrink-0" />
                        <span className="text-xs text-foreground/80 truncate flex-1">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                        <button
                          type="button"
                          onClick={() => setPendingFiles(pendingFiles.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors"
                          data-testid={`btn-remove-anexo-pending-${i}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* File picker button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.avi,.mkv,.webm,.zip,.rar"
                  style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
                  tabIndex={-1}
                  onChange={(e) => {
                    const selected = e.target.files;
                    if (!selected || selected.length === 0) return;
                    setPendingFiles(prev => [...prev, ...Array.from(selected)]);
                    e.target.value = "";
                  }}
                  data-testid="input-anexos-file"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:bg-muted/50 transition-colors text-sm text-muted-foreground w-full justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="btn-add-anexo"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ?"Enviando..." : "Adicionar arquivos"}
                </button>
              </div>
            </TabsContent>

            {/* Tab Equipe */}
            <TabsContent value="equipe" className="space-y-4 mt-4">
              <MembroSelect
                label="Autor da Oportunidade"
                field="autor_bia"
                form={form}
                setForm={setForm}
                membros={membros}
                icon={Target}
              />
              <MembroSelect
                label="Aliado BUILT"
                field="aliado_built"
                form={form}
                setForm={setForm}
                membros={membros}
                icon={Shield}
                required
                disabled={!canEditAliadoBuilt}
                disabledNote="Definido automaticamente pelo Aliado BUILT da comunidade."
                filterFn={(m) => !!(m.Outras_redes_as_quais_pertenco?.includes("BUILT_ALLIANCE_PARTNER")) || m.id === form.aliado_built}
              />
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Diretores</p>
              <MembroSelect label="Diretor de Aliança" field="diretor_alianca" form={form} setForm={setForm} membros={membros} icon={Crown} required pending={!!diretorPendingByField.diretor_alianca} />
              {renderDispararAliancaButton("diretor_alianca")}
              <MembroSelect label="Diretor de Núcleo Técnico" field="diretor_nucleo_tecnico" form={form} setForm={setForm} membros={membros} icon={Shield} pending={!!diretorPendingByField.diretor_nucleo_tecnico} />
              {renderDispararAliancaButton("diretor_nucleo_tecnico")}
              <MembroSelect label="Diretor de Núcleo de Obra" field="diretor_execucao" form={form} setForm={setForm} membros={membros} icon={Hammer} pending={!!diretorPendingByField.diretor_execucao} />
              {renderDispararAliancaButton("diretor_execucao")}
              <MembroSelect label="Diretor Comercial" field="diretor_comercial" form={form} setForm={setForm} membros={membros} icon={Building2} pending={!!diretorPendingByField.diretor_comercial} />
              {renderDispararAliancaButton("diretor_comercial")}
              <MembroSelect label="Diretor de Capital" field="diretor_capital" form={form} setForm={setForm} membros={membros} icon={Wallet} pending={!!diretorPendingByField.diretor_capital} />
              {renderDispararAliancaButton("diretor_capital")}
              <Separator />
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Papéis Patrimoniais</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Multiplicadores convertem entrega em CPP; Guardiões sustentam a BIA, caixa e chamadas futuras.
                  </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() => setConviteDialogOpen(true)}
                    data-testid="btn-convidar-parceiro-patrimonial"
                  >
                    <Ticket className="w-3.5 h-3.5 mr-1" />
                    Convidar parceiro
                  </Button>
                </div>
                <MultiMembroSelect
                  label="Sócios Guardiões"
                  field="socios_guardioes"
                  form={form}
                  setForm={setForm}
                  membros={membros}
                  icon={Shield}
                  pendingIds={socioPendingByField.socios_guardioes}
                  note="Responsáveis por manter a BIA, organizar o caixa e sustentar o projeto."
                />
                {renderDispararAliancaButton("socios_guardioes")}
                <MultiMembroSelect
                  label="Sócios Multiplicadores"
                  field="socios_multiplicadores"
                  form={form}
                  setForm={setForm}
                  membros={membros}
                  icon={TrendingUp}
                  pendingIds={socioPendingByField.socios_multiplicadores}
                  note="Participam entregando trabalho, técnica, execução, fornecimento, venda ou relacionamento convertido em CPP."
                />
                {renderDispararAliancaButton("socios_multiplicadores")}
              </div>
            </TabsContent>

            {/* Tab CPP */}
            <TabsContent value="cpp" className="space-y-4 mt-4">
              {/* Forma de Pagamento do Ativo de Origem */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPagamentoModalOpen(true)}
                  className="w-full rounded-lg border border-dashed border-brand-gold/40 bg-brand-gold/5 hover:bg-brand-gold/10 transition-colors p-3 text-left space-y-1"
                  data-testid="button-open-pagamento-bia"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium flex items-center gap-1.5 text-brand-gold">
                      <CreditCard className="w-3.5 h-3.5" />
                      Forma de Pagamento do Ativo de Origem
                    </span>
                    {formaPagamento && <span className="text-[10px] text-muted-foreground">✎ editar</span>}
                  </div>
                  {formaPagamento ?(
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>{formaPagamento === "a_vista" ?"À Vista" : `Parcelado em ${numeroParcelas}x`}</div>
                      {formaPagamento === "parcelado" && numParcelasInt > 0 && (
                        <div>{vencimentosParcelas.filter(v => v).length}/{numParcelasInt} datas · {valoresParcelas.filter(v => v > 0).length}/{numParcelasInt} valores</div>
                      )}
                      {formaPagamento === "a_vista" && vencimento && (
                        <div>Vence: {new Date(vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60">Clique para definir forma de pagamento e valores</p>
                  )}
                </button>

                {/* Valor de Origem derivado */}
                <div className="rounded-lg bg-muted/30 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Valor de Origem
                    {formaPagamento === "parcelado" && " (soma das parcelas)"}
                    {formaPagamento === "a_vista" && " (valor à vista)"}
                    {!formaPagamento && " (manual)"}
                  </span>
                  <span className="font-semibold tabular-nums text-brand-gold" data-testid="text-valor-origem-bia">
                    {brl(valorOrigem)}
                  </span>
                </div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Percentuais DM (% sobre Valor de Origem)</p>
              <div className="grid grid-cols-1 gap-3">
                <PercField label="Autor da Oportunidade" field="perc_autor_opa" form={form} setForm={setForm} baseValue={valorOrigem} />
                <PercField label="Aliado BUILT" field="perc_aliado_built" form={form} setForm={setForm} baseValue={valorOrigem} />
                <PercField label="BUILT" field="perc_built" form={form} setForm={setForm} baseValue={valorOrigem} />
                <PercField label="Diretor de Aliança" field="perc_dir_alianca" form={form} setForm={setForm} baseValue={valorOrigem} />
                <PercField label="Diretor Técnico" field="perc_dir_tecnico" form={form} setForm={setForm} baseValue={valorOrigem} />
                <PercField label="Diretor de Obras" field="perc_dir_obras" form={form} setForm={setForm} baseValue={valorOrigem} />
                <PercField label="Diretor Comercial" field="perc_dir_comercial" form={form} setForm={setForm} baseValue={valorOrigem} />
                <PercField label="Diretor de Capital" field="perc_dir_capital" form={form} setForm={setForm} baseValue={valorOrigem} />
              </div>
              {valorOrigem > 0 && (
                <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total DM (Î£ percentuais = {percTotal.toFixed(2)}%)</span>
                  <span className="font-semibold text-orange-600 tabular-nums">{brl(custoOrigemPreview - valorOrigem)}</span>
                </div>
              )}
              {formaPagamento && valorOrigem > 0 && (
                <div className={`rounded-lg border px-3 py-2 text-xs ${hasIncompleteInstallments ?"border-amber-300 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium">
                        Serão gerados {estimatedEntries} lançamento{estimatedEntries !== 1 ?"s" : ""} no financeiro
                      </p>
                      <p>
                        {estimatedBaseEntries} parcela{estimatedBaseEntries !== 1 ?"s" : ""} do Valor de Origem + {estimatedCppEntries} lançamento{estimatedCppEntries !== 1 ?"s" : ""} CPP. Tempo estimado: {estimatedLabel}.
                      </p>
                      {hasIncompleteInstallments && (
                        <p className="font-medium">Preencha todas as datas e valores das parcelas para gerar corretamente.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {saveMutation.isPending && formaPagamento && (
                <div className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-xs text-amber-800">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Gerando lançamentos no financeiro. Não feche esta janela.
                  </div>
                </div>
              )}
              {cppError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Erro ao gerar lançamentos: {cppError}</span>
                  </div>
                </div>
              )}
              {cppSummary && !cppError && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{cppSummary.cppCount} lançamento{cppSummary.cppCount !== 1 ?"s" : ""} CPP gerado{cppSummary.cppCount !== 1 ?"s" : ""} para {cppSummary.parcelas} parcela{cppSummary.parcelas !== 1 ?"s" : ""}.</span>
                  </div>
                </div>
              )}

            </TabsContent>

            {/* Tab Receita */}
            <TabsContent value="receita" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receita</p>
              <BRLInput label="VGV — Valor Geral de Venda (R$)" field="valor_geral_venda_vgv" form={form} setForm={setForm} required />
              <BRLInput label="Valor Realizado de Venda (R$)" field="valor_realizado_venda" form={form} setForm={setForm} />
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Deduções (% sobre Valor Realizado)</p>
              <PercField label="Comissão Prevista Corretor" field="comissao_prevista_corretor" form={form} setForm={setForm} baseValue={valorRealizado} />
              <PercField label="IR Previsto" field="ir_previsto" form={form} setForm={setForm} baseValue={valorRealizado} />
              <PercField label="INSS Previsto" field="inss_previsto" form={form} setForm={setForm} baseValue={valorRealizado} />
              <PercField label="Manutenção Pós Obra Prevista" field="manutencao_pos_obra_prevista" form={form} setForm={setForm} baseValue={valorRealizado} />
            </TabsContent>

            {/* Tab Informações */}
            <TabsContent value="info" className="space-y-6 mt-4">
              {form.situacao === "ativa" && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  BIA com situação <strong>Ativa</strong>: preencha os campos obrigatórios marcados com *.
                </p>
              )}

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Informações do Ativo</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Qualificação <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_qualificacao}
                      onChange={e => setInfoForm({ ...infoForm, ativo_qualificacao: e.target.value })}
                      placeholder="Casa, galpão, apartamento..."
                      data-testid="input-ativo-qualificacao"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Área (m²) <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_area_m2}
                      onChange={e => setInfoForm({ ...infoForm, ativo_area_m2: e.target.value })}
                      placeholder="Ex: 120,50"
                      data-testid="input-ativo-area-m2"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">Descrição adicional</label>
                    <Textarea
                      rows={2}
                      className="text-sm resize-none"
                      value={infoForm.ativo_descricao_adicional}
                      onChange={e => setInfoForm({ ...infoForm, ativo_descricao_adicional: e.target.value })}
                      placeholder="Informação complementar do ativo, se houver"
                      data-testid="input-ativo-descricao-adicional"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      CEP <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_cep}
                      onChange={e => handleAtivoCepChange(e.target.value)}
                      placeholder="00000-000"
                      inputMode="numeric"
                      data-testid="input-ativo-cep"
                    />
                    {ativoCepLoading && <p className="text-xs text-muted-foreground">Buscando CEP...</p>}
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Endereço <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_endereco}
                      onChange={e => setInfoForm({ ...infoForm, ativo_endereco: e.target.value })}
                      placeholder="Rua, avenida, estrada..."
                      data-testid="input-ativo-endereco"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Nº <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_numero}
                      onChange={e => setInfoForm({ ...infoForm, ativo_numero: e.target.value })}
                      placeholder="Número"
                      data-testid="input-ativo-numero"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Complemento <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_complemento}
                      onChange={e => setInfoForm({ ...infoForm, ativo_complemento: e.target.value })}
                      placeholder="Bloco, unidade, sala..."
                      data-testid="input-ativo-complemento"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Bairro <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_bairro}
                      onChange={e => setInfoForm({ ...infoForm, ativo_bairro: e.target.value })}
                      placeholder="Bairro"
                      data-testid="input-ativo-bairro"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Cidade <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_cidade}
                      onChange={e => setInfoForm({ ...infoForm, ativo_cidade: e.target.value })}
                      placeholder="Cidade"
                      data-testid="input-ativo-cidade"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Estado <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_estado}
                      onChange={e => setInfoForm({ ...infoForm, ativo_estado: e.target.value })}
                      placeholder="UF"
                      data-testid="input-ativo-estado"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      País <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_pais}
                      onChange={e => setInfoForm({ ...infoForm, ativo_pais: e.target.value })}
                      placeholder="País"
                      data-testid="input-ativo-pais"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Número da matrícula <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_numero_matricula}
                      onChange={e => setInfoForm({ ...infoForm, ativo_numero_matricula: e.target.value })}
                      placeholder="Número da matrícula"
                      data-testid="input-ativo-numero-matricula"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Livro <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_livro}
                      onChange={e => setInfoForm({ ...infoForm, ativo_livro: e.target.value })}
                      placeholder="Livro"
                      data-testid="input-ativo-livro"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Folha <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_folha}
                      onChange={e => setInfoForm({ ...infoForm, ativo_folha: e.target.value })}
                      placeholder="Folha"
                      data-testid="input-ativo-folha"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Cartório <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_cartorio}
                      onChange={e => setInfoForm({ ...infoForm, ativo_cartorio: e.target.value })}
                      placeholder="Cartório de registro"
                      data-testid="input-ativo-cartorio"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Comarca <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_comarca}
                      onChange={e => setInfoForm({ ...infoForm, ativo_comarca: e.target.value })}
                      placeholder="Comarca do registro"
                      data-testid="input-ativo-comarca"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Dados Comerciais</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Razão social/Nome {form.situacao === "ativa" && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.razao_social}
                      onChange={e => setInfoForm({ ...infoForm, razao_social: e.target.value })}
                      placeholder="Razão social ou nome"
                      data-testid="input-razao-social"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      CNPJ/CPF {form.situacao === "ativa" && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.cnpj}
                      onChange={e => setInfoForm({ ...infoForm, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00 ou 000.000.000-00"
                      data-testid="input-cnpj-comercial"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Nome Fantasia</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.nome_fantasia}
                      onChange={e => setInfoForm({ ...infoForm, nome_fantasia: e.target.value })}
                      placeholder="Nome fantasia"
                      data-testid="input-nome-fantasia"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Inscrição Estadual</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.inscricao_estadual}
                      onChange={e => setInfoForm({ ...infoForm, inscricao_estadual: e.target.value })}
                      placeholder="Inscrição estadual"
                      data-testid="input-inscricao-estadual"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Conta Bancária</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Banco {form.situacao === "ativa" && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.banco}
                      onChange={e => setInfoForm({ ...infoForm, banco: e.target.value })}
                      placeholder="Nome do banco"
                      data-testid="input-banco"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Agência</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.agencia}
                      onChange={e => setInfoForm({ ...infoForm, agencia: e.target.value })}
                      placeholder="0000"
                      data-testid="input-agencia"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Conta {form.situacao === "ativa" && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.conta}
                      onChange={e => setInfoForm({ ...infoForm, conta: e.target.value })}
                      placeholder="00000-0"
                      data-testid="input-conta"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Tipo de Conta</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.tipo_conta}
                      onChange={e => setInfoForm({ ...infoForm, tipo_conta: e.target.value })}
                      data-testid="select-tipo-conta"
                    >
                      <option value="">Selecione...</option>
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Conta Poupança</option>
                      <option value="pagamento">Conta de Pagamento</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Titular da Conta {form.situacao === "ativa" && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.titular_conta}
                      onChange={e => setInfoForm({ ...infoForm, titular_conta: e.target.value })}
                      placeholder="Nome completo do titular"
                      data-testid="input-titular-conta"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">Chave PIX</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.chave_pix}
                      onChange={e => setInfoForm({ ...infoForm, chave_pix: e.target.value })}
                      placeholder="CPF, CNPJ, email ou chave aleatória"
                      data-testid="input-chave-pix"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          </div>

          <div className="shrink-0 border-t bg-background px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {isEdit && canDelete && bia && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => onRequestDelete?.(bia)}
                    disabled={saveMutation.isPending || uploading}
                    data-testid="btn-delete-bia-edit"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Deletar BIA
                  </Button>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveClick}
                  disabled={saveMutation.isPending || uploading || isLoading || hasIncompleteInstallments}
                  className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
                  data-testid="btn-save-bia"
                >
                  {uploading ?"Enviando arquivos..." : saveMutation.isPending && formaPagamento ?"Gerando lançamentos..." : saveMutation.isPending ?"Salvando..." : isEdit ?"Salvar alterações" : "Criar BIA"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <LocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={handleLocationSelect}
      />

      <Dialog open={chamadaDialogOpen} onOpenChange={setChamadaDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Disparar chamada para aliança
            </DialogTitle>
            <DialogDescription>
              Revise os dados da reunião e edite as informações da OPA que será criada.
            </DialogDescription>
          </DialogHeader>

          {chamadaDiretorCampo && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm">
                <p className="font-semibold text-brand-navy">{DIRETOR_CHAMADA_LABELS[chamadaDiretorCampo]}</p>
                <p className="text-xs text-muted-foreground">
                  Próxima chamada: {CHAMADA_SEQUENCE_LABELS[getNextChamadaOrder(chamadaDiretorCampo)] || "Ciclo concluído"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data e hora da reunião *</Label>
                <Input
                  type="datetime-local"
                  value={chamadaDataHora}
                  onChange={(event) => setChamadaDataHora(event.target.value)}
                  data-testid="input-chamada-data-hora"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Link da reunião *</Label>
                <Input
                  type="url"
                  value={chamadaLink}
                  onChange={(event) => setChamadaLink(event.target.value)}
                  placeholder="https://..."
                  data-testid="input-chamada-link"
                />
              </div>
              <Separator />
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">Informações da OPA</p>
                  <p className="text-xs text-muted-foreground">Esses dados serão usados na OPA publicada pela chamada.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Título da OPA *</Label>
                  <Input
                    value={chamadaOpaTitulo}
                    onChange={(event) => setChamadaOpaTitulo(event.target.value)}
                    placeholder="Título da oportunidade"
                    data-testid="input-chamada-opa-titulo"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Input
                      value={chamadaOpaTipo}
                      readOnly
                      placeholder="Liderança"
                      className="bg-muted/40"
                      data-testid="input-chamada-opa-tipo"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Valor da OPA</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <Input
                        value={chamadaOpaValor}
                        readOnly
                        placeholder="0,00"
                        className="pl-9 bg-muted/40"
                        data-testid="input-chamada-opa-valor"
                      />
                    </div>
                    {chamadaValorZerado && (
                      <p className="text-xs text-destructive">
                        O percentual DM deste diretor está zerado. Ajuste a aba DM antes de disparar a chamada.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Mín. Esforço Multiplicador (%)</Label>
                  <Input
                    value={chamadaOpaMem}
                    onChange={(event) => setChamadaOpaMem(event.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="100"
                    data-testid="input-chamada-opa-mem"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Descrição / perfil buscado</Label>
                  <Textarea
                    value={chamadaOpaDescricao}
                    onChange={(event) => setChamadaOpaDescricao(event.target.value)}
                    rows={4}
                    placeholder="Descreva o perfil de aliado/líder buscado para esta chamada..."
                    data-testid="input-chamada-opa-descricao"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setChamadaDialogOpen(false)} disabled={dispararAliancaMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => dispararAliancaMutation.mutate()}
              disabled={!chamadaDataHora || !chamadaLink.trim() || !chamadaOpaTitulo.trim() || chamadaValorZerado || dispararAliancaMutation.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
              data-testid="btn-confirmar-disparar-alianca"
            >
              {dispararAliancaMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
              Disparar chamada para aliança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conviteDialogOpen} onOpenChange={setConviteDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-600" />
              Convidar parceiro
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              Gere e compartilhe um link de convite para novos parceiros entrarem na rede BUILT. O link é válido por 1 dia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Tipo de convite</p>
            <Select value={conviteTipo} onValueChange={handleConviteTipoChange}>
              <SelectTrigger data-testid="select-bia-tipo-convite">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {meuConvite?.tipo && (
              <p className="text-[11px] text-muted-foreground">
                Link ativo: {INVITE_TYPE_LABELS[meuConvite.tipo] || "Parceiro de Mercado"}
              </p>
            )}
          </div>

          {meuConviteLink ? (
            <div className="w-full min-w-0 space-y-3">
              <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-mono text-muted-foreground" data-testid="text-bia-convite-link">
                  {meuConviteLink}
                </span>
                <button
                  type="button"
                  title="Copiar link"
                  onClick={async () => {
                    const copied = await copyTextToClipboard(formatBuiltInviteMessage(meuConviteLink, meuConvite?.expires_at));
                    if (copied) {
                      toast({ title: "Convite copiado!", description: "A mensagem completa está pronta para compartilhar." });
                    } else {
                      toast({ title: "Não foi possível copiar", description: "Selecione o link e copie manualmente.", variant: "destructive" });
                    }
                  }}
                  className="shrink-0 rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                  data-testid="btn-bia-copiar-convite"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {meuConvite?.expires_at && (
                <p className="text-[11px] text-muted-foreground">
                  Expira em: {new Date(meuConvite.expires_at).toLocaleDateString("pt-BR")}
                </p>
              )}
              <button
                type="button"
                onClick={() => gerarConviteMutation.mutate({ force: true, tipo: conviteTipo })}
                disabled={gerarConviteMutation.isPending}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                data-testid="btn-bia-renovar-convite"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${gerarConviteMutation.isPending ? "animate-spin" : ""}`} />
                Gerar novo link
              </button>
              <InviteQrCode link={meuConviteLink} variant="light" />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-center space-y-3">
              <Ticket className="w-7 h-7 text-blue-600/70 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum link ativo no momento.</p>
              <Button
                onClick={() => gerarConviteMutation.mutate({ force: false, tipo: conviteTipo })}
                disabled={gerarConviteMutation.isPending}
                className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                data-testid="btn-bia-gerar-convite"
              >
                {gerarConviteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ticket className="w-4 h-4" />
                )}
                Gerar link de convite
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConviteDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickMemberOpen} onOpenChange={setQuickMemberOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand-gold" />
              Convidar parceiro
            </DialogTitle>
            <DialogDescription>
              Cadastre um parceiro simples para selecionar nos papéis patrimoniais da BIA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={quickMemberName}
                onChange={(e) => setQuickMemberName(e.target.value)}
                placeholder="Nome do membro"
                data-testid="input-quick-member-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input
                value={quickMemberCompany}
                onChange={(e) => setQuickMemberCompany(e.target.value)}
                placeholder="Empresa ou organização"
                data-testid="input-quick-member-company"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickMemberOpen(false)}
              disabled={createQuickMemberMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => createQuickMemberMutation.mutate()}
              disabled={!quickMemberName.trim() || createQuickMemberMutation.isPending}
              className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
              data-testid="btn-save-quick-member"
            >
              {createQuickMemberMutation.isPending ?"Convidando..." : "Convidar parceiro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PagamentoModal
        open={pagamentoModalOpen}
        onClose={() => setPagamentoModalOpen(false)}
        initialFormaPagamento={formaPagamento}
        initialNumeroParcelas={numeroParcelas}
        initialVencimento={vencimento}
        initialVencimentosParcelas={vencimentosParcelas}
        initialValoresParcelas={valoresParcelas}
        initialValorAVista={valorAVista}
        onConfirm={(d) => {
          setFormaPagamento(d.formaPagamento);
          setNumeroParcelas(d.numeroParcelas);
          setVencimento(d.vencimento);
          setVencimentosParcelas(d.vencimentosParcelas);
          setValoresParcelas(d.valoresParcelas);
          setValorAVista(d.valorAVista);
        }}
      />
    </>
  );
}

// ---- Main Page ----
export default function BiasPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const redes = user?.Outras_redes_as_quais_pertenco ?? [];
  const canCreateBia = !!user && (
    user.role === "admin" ||
    user.role === "manager" ||
    redes.includes("BUILT_FOUNDING_MEMBER") ||
    redes.includes("BUILT_ALLIANCE_PARTNER") ||
    (Array.isArray(user.tipos_alianca) && user.tipos_alianca.includes("Liderança"))
  );
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";
  const isAliadoBuilt = isAdminOrManager ||
    redes.includes("BUILT_FOUNDING_MEMBER") ||
    redes.includes("BUILT_ALLIANCE_PARTNER");
  const isDiretorAlianca = !isAliadoBuilt &&
    Array.isArray(user?.tipos_alianca) && user.tipos_alianca.includes("Liderança");
  const canEditBia = (bia?: BiasProjeto | null) => !!user && !!bia && (
    user.role === "admin" ||
    user.role === "manager" ||
    (!!user.membro_directus_id && (
      user.membro_directus_id === bia.aliado_built ||
      user.membro_directus_id === bia.diretor_alianca
    ))
  );

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBia, setEditingBia] = useState<BiasProjeto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BiasProjeto | null>(null);
  const [rejeitarTarget, setRejeitarTarget] = useState<{ id: string; biaNome: string } | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const canDeleteBia = !!user && (
    user.role === "admin" ||
    user.role === "aliado" ||
    redes.includes("BUILT_FOUNDING_MEMBER") ||
    redes.includes("BUILT_ALLIANCE_PARTNER") ||
    (!!editingBia?.aliado_built && editingBia.aliado_built === user.membro_directus_id)
  );

  const { data: biasRaw = [], isLoading: loadingBias, isError: biasLoadError, error: biasLoadErrorInfo } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const { data: membrosRaw = [], isLoading: loadingMembros } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
    queryFn: async () => {
      const res = await fetch("/api/membros", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: opasRaw = [] } = useQuery<Oportunidade[]>({
    queryKey: ["/api/oportunidades"],
  });

  // Approval queries
  const { data: aprovacoesPendentes = [] } = useQuery<any[]>({
    queryKey: ["/api/bia-aprovacoes"],
    enabled: isAliadoBuilt,
  });
  const { data: minhasAprovacoes = [] } = useQuery<any[]>({
    queryKey: ["/api/bia-aprovacoes/minha"],
    enabled: isDiretorAlianca,
  });

  const aprovarMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/bia-aprovacoes/${id}/aprovar`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bia-aprovacoes"] });
      toast({ title: "BIA aprovada com sucesso!" });
    },
    onError: (e: any) => toast({ title: "Erro ao aprovar", description: e.message, variant: "destructive" }),
  });

  const rejeitarMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      apiRequest("PATCH", `/api/bia-aprovacoes/${id}/rejeitar`, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bia-aprovacoes"] });
      setRejeitarTarget(null);
      setMotivoRejeicao("");
      toast({ title: "BIA rejeitada" });
    },
    onError: (e: any) => toast({ title: "Erro ao rejeitar", description: e.message, variant: "destructive" }),
  });

  // Map bia_id -> approval record for quick lookup
  const pendingBiaIds = useMemo(() => {
    const ids = new Set<string>();
    aprovacoesPendentes.filter(a => a.status === "pendente").forEach(a => ids.add(a.bia_id));
    minhasAprovacoes.filter(a => a.status === "pendente").forEach(a => ids.add(a.bia_id));
    return ids;
  }, [aprovacoesPendentes, minhasAprovacoes]);

  const membros = useMemo(
    () => [...(membrosRaw as Membro[])].sort((a, b) =>
      getMembroNome(a).localeCompare(getMembroNome(b), "pt-BR")
    ),
    [membrosRaw]
  );

  const bias = useMemo(() => {
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return (biasRaw as BiasProjeto[]).filter((b) => {
      const haystack = `${b.nome_bia} ${b.localizacao || ""} ${b.objetivo_alianca || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return haystack.includes(q);
    });
  }, [biasRaw, search]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bias/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bias"] });
      toast({ title: "BIA removida" });
      setDeleteTarget(null);
      setSheetOpen(false);
      setEditingBia(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    }
  });

  // Auto-open edit sheet when navigated here with ?edit=<id>
  const [, navigate] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    const criar = params.get("criar");
    const returnPath = window.location.pathname === "/area-aliancas" ? "/area-aliancas?tab=bias" : "/bias";
    if (criar === "true") {
      setEditingBia(null);
      setSheetOpen(true);
      navigate(returnPath, { replace: true });
    } else if (editId && (biasRaw as BiasProjeto[]).length > 0) {
      const target = (biasRaw as BiasProjeto[]).find(b => b.id === editId);
      if (target) {
        if (canEditBia(target)) {
          setEditingBia(target);
          setSheetOpen(true);
        } else {
          toast({ title: "Sem permissão para editar", description: "Apenas o Aliado BUILT ou o Diretor de Aliança desta BIA podem editar.", variant: "destructive" });
        }
        navigate(returnPath, { replace: true });
      }
    }
  }, [biasRaw, user?.membro_directus_id, user?.role]);

  const openCreate = () => { setEditingBia(null); setSheetOpen(true); };
  const openEdit = (b: BiasProjeto) => {
    if (!canEditBia(b)) {
      toast({ title: "Sem permissão para editar", description: "Apenas o Aliado BUILT ou o Diretor de Aliança desta BIA podem editar.", variant: "destructive" });
      return;
    }
    setEditingBia(b);
    setSheetOpen(true);
  };

  const loading = loadingBias || loadingMembros;

  const total = (biasRaw as BiasProjeto[]).length;
  const totalVgv = (biasRaw as BiasProjeto[]).reduce((s, b) => s + n(b.valor_geral_venda_vgv), 0);
  const totalRealizado = (biasRaw as BiasProjeto[]).reduce((s, b) => s + n(b.valor_realizado_venda), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-bias-title">
            <div className="p-2 rounded-lg bg-orange-50 text-orange-500">
              <Briefcase className="w-6 h-6" />
            </div>
            BIAs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Alianças Integradas BUILT — {total} BIA{total !== 1 ?"s" : ""} cadastrada{total !== 1 ?"s" : ""}</p>
        </div>
        {canCreateBia && (
          <Button
            className="gap-2 bg-blue-500 text-white hover:bg-blue-600"
            onClick={openCreate}
            data-testid="btn-create-bia"
          >
            <Plus className="w-4 h-4" /> Nova BIA
          </Button>
        )}
      </div>

      {/* Futuristic Brazil Map */}
      {!loading && (
        <BrazilMapHeader biasAll={biasRaw as BiasProjeto[]} membros={membros} opas={opasRaw as Oportunidade[]} />
      )}
      {loading && <Skeleton className="h-[360px] rounded-2xl" />}

      {/* Summary Cards */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="min-w-0">
            <CardContent className="min-w-0 p-4">
              <p className="text-xs text-muted-foreground">Total de BIAs</p>
              <p className="text-2xl font-bold text-brand-gold" data-testid="text-total-bias">{total}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardContent className="min-w-0 p-4">
              <p className="text-xs text-muted-foreground">VGV Total</p>
              <p className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-base font-bold tabular-nums tracking-tight lg:text-lg" data-testid="text-total-vgv" title={brl(totalVgv)}>
                {brl(totalVgv)}
              </p>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardContent className="min-w-0 p-4">
              <p className="text-xs text-muted-foreground">Realizado Total</p>
              <p className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-base font-bold tabular-nums tracking-tight lg:text-lg" title={brl(totalRealizado)}>
                {brl(totalRealizado)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approval Panel — visible to Aliado BUILT / admin when there are pending BIAs */}
      {isAliadoBuilt && aprovacoesPendentes.filter(a => a.status === "pendente").length > 0 && (
        <Card className="border-amber-400/40 bg-amber-50/40 dark:bg-amber-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Bell className="w-4 h-4" />
              BIAs aguardando sua aprovação ({aprovacoesPendentes.filter(a => a.status === "pendente").length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aprovacoesPendentes.filter(a => a.status === "pendente").map((ap) => (
              <div key={ap.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-background border border-amber-200/60 dark:border-amber-700/30">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{ap.bia_nome || ap.bia_id}</p>
                  <p className="text-xs text-muted-foreground">
                    Solicitado por <strong>{ap.solicitante_nome || ap.solicitante_email}</strong>
                    {ap.comunidade_nome ?` · ${ap.comunidade_nome}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white h-8"
                    onClick={() => aprovarMutation.mutate(ap.id)}
                    disabled={aprovarMutation.isPending}
                    data-testid={`btn-aprovar-bia-${ap.id}`}
                  >
                    {aprovarMutation.isPending ?<Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 h-8"
                    onClick={() => { setRejeitarTarget({ id: ap.id, biaNome: ap.bia_nome || ap.bia_id }); setMotivoRejeicao(""); }}
                    data-testid={`btn-rejeitar-bia-${ap.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Diretor: show notice about own pending BIAs */}
      {isDiretorAlianca && minhasAprovacoes.filter(a => a.status === "pendente").length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Você tem {minhasAprovacoes.filter(a => a.status === "pendente").length} BIA(s) aguardando aprovação do Aliado BUILT da sua comunidade. Você receberá um e-mail quando a decisão for tomada.
          </span>
        </div>
      )}

      {/* Search */}
      {total > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar BIA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-bias"
          />
        </div>
      )}

      {/* Content */}
      {loading ?(
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : biasLoadError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-semibold text-red-700 mb-2">Falha ao carregar o banco de dados</h3>
            <p className="text-sm text-red-600">
              Não foi possível conectar ao Directus agora. Os dados não foram apagados; a API de dados está retornando erro.
            </p>
            {biasLoadErrorInfo instanceof Error && (
              <p className="mt-3 text-xs font-mono text-red-500">{biasLoadErrorInfo.message}</p>
            )}
          </CardContent>
        </Card>
      ) : bias.length === 0 ?(
        <Card>
          <CardContent className="p-12 text-center">
            {search ?(
              <>
                <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma BIA encontrada para "{search}"</p>
              </>
            ) : (
              <>
                <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhuma BIA cadastrada</h3>
                <p className="text-sm text-muted-foreground/70 mb-4">Comece criando a primeira aliança BUILT</p>
                {canCreateBia && (
                  <Button
                    className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
                    onClick={openCreate}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Criar primeira BIA
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bias.map((b) => (
            <BiaCard
              key={b.id}
              bia={b}
              membros={membros}
              opas={opasRaw as Oportunidade[]}
              onEdit={() => openEdit(b)}
              onDelete={() => setDeleteTarget(b)}
              aprovacaoPendente={pendingBiaIds.has(b.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <BiaFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        bia={editingBia}
        membros={membros}
        isLoading={loading}
        canDelete={canDeleteBia}
        onRequestDelete={(target) => setDeleteTarget(target)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" /> Remover BIA
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a BIA <strong>{deleteTarget?.nome_bia}</strong>?
              Esta ação não pode ser desfeita e os dados serão excluídos do Directus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="btn-confirm-delete"
            >
              {deleteMutation.isPending ?"Removendo..." : "Sim, remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Dialog */}
      <Dialog open={!!rejeitarTarget} onOpenChange={(o) => { if (!o) { setRejeitarTarget(null); setMotivoRejeicao(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" /> Rejeitar BIA
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição da BIA <strong>{rejeitarTarget?.biaNome}</strong>. O Diretor de Aliança será notificado por e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="motivo-rejeicao">Motivo (opcional)</Label>
            <Textarea
              id="motivo-rejeicao"
              placeholder="Explique o motivo da rejeição..."
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              className="resize-none"
              rows={3}
              data-testid="textarea-motivo-rejeicao"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejeitarTarget(null); setMotivoRejeicao(""); }}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => rejeitarTarget && rejeitarMutation.mutate({ id: rejeitarTarget.id, motivo: motivoRejeicao })}
              disabled={rejeitarMutation.isPending}
              data-testid="btn-confirm-rejeitar"
            >
              {rejeitarMutation.isPending ?<Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

