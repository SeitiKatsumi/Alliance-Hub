import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileSearch,
  FileText,
  FolderOpen,
  HandCoins,
  History,
  Home,
  KeyRound,
  Landmark,
  Lightbulb,
  Link2,
  Loader2,
  MapPin,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import OpportunityCloseDialog from "@/components/opportunity-close-dialog";
import OpportunityDistributionControls from "@/components/opportunity-distribution-controls";
import { ModuleInfo } from "@/components/module-info";

type AccessLevel = "leitura" | "colaboracao" | "administracao" | "proprietario";

interface ImovelSocio {
  id?: string;
  nome: string;
  email?: string | null;
  user_id?: string | null;
  membro_id?: string | null;
  map_percentual: number;
  status?: "pendente" | "aceito" | "recusado" | "revogado";
}

interface CarteiraDiagnostico {
  situacao: string;
  classificacoes: string[];
  oportunidade: string;
  risco: string;
  recomendacao: string;
  proxima_acao: string;
  confianca: "baixa" | "moderada" | "alta";
  cobertura: { preenchidos: number; total: number; percentual: number };
  dados_faltantes: string[];
  indicadores: {
    ocupacao: string;
    receitas: number;
    despesas: number;
    resultado_liquido: number;
    documentos_ativos: number;
    alertas_abertos: number;
  };
}

interface CarteiraImovel {
  id: string;
  nome: string;
  tipo: string;
  area_m2: string | number;
  valor_pago: string | number;
  valor_atual: string | number;
  moeda: string;
  descricao?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  matricula?: string;
  cartorio?: string;
  foto?: string;
  status?: string;
  ocupacao?: string;
  objetivo?: string;
  titularidade?: Array<{ nome: string; percentual?: number | string }>;
  participacao_percentual?: number;
  socios?: ImovelSocio[];
  map_percentual_usuario?: number;
  socios_pendentes?: number;
  bia_origem?: { id: string; bia_id?: string; nome_bia: string; status: string; valor_origem: number } | null;
  situacao_pagamento?: "quitado" | "financiado";
  forma_pagamento?: string;
  instituicao_financeira?: string;
  condicoes_financiamento?: string;
  parcelas_pagas?: number;
  parcelas_restantes?: number;
  divida_saldo?: string | number;
  liquidez_sugerida?: "baixa" | "media" | "alta" | null;
  liquidez_confirmada?: "baixa" | "media" | "alta" | null;
  valor_data_base?: string;
  valor_origem?: string;
  area_origem?: string;
  ocupacao_origem?: string;
  dados_origem?: Record<string, string>;
  frequencia_pulso?: "mensal" | "trimestral" | "desativado";
  proximo_pulso_em?: string | null;
  ultima_atualizacao?: string | null;
  access_level?: AccessLevel;
  is_owner?: boolean;
  can_delete?: boolean;
  diagnostico?: CarteiraDiagnostico | null;
  contas_a_pagar?: number;
  estimativa_mercado?: {
    valor: number; moeda: string; data_base?: string | null;
    status: "atualizada" | "desatualizada" | "sem_amostra" | "sem_dados";
    raio_km: number; quantidade_comparaveis: number; confianca?: string | null;
    fonte: string; precisa_atualizar: boolean; valor_fallback?: number | null;
  };
  valor_utilizado_no_total?: number;
  valor_utilizado_no_total_brl?: number;
  valor_aquisicao_brl?: number;
  valor_utilizado_origem?: string;
}

interface CarteiraResumo {
  period: "12m" | "all";
  imoveis: CarteiraImovel[];
  aliancas: Array<{
    id: string; codigo?: string | null; nome: string; situacao?: string | null; moeda: string;
    map_percent: number; aportes_oficiais: number; patrimonio_liquido_oficial?: number | null;
    valor_participacao?: number | null; valor_participacao_brl?: number | null; data_base?: string | null; metodologia?: string | null;
    liquidez?: string | null; confirmado: boolean; can_manage_patrimonio?: boolean; can_delete?: boolean;
    receitas_participacao?: number; despesas_participacao?: number; contas_a_pagar_participacao?: number; evolucao_patrimonial_percentual?: number | null;
  }>;
  totais: {
    patrimonio_total: number;
    patrimonio_pago: number;
    patrimonio_atual: number;
    divida: number;
    valorizacao: number;
    receitas: number;
    despesas: number;
    resultado_liquido: number;
    alertas_abertos: number;
    total_investido_aliancas: number;
    valor_participacoes_aliancas: number;
    percentual_baixa_liquidez: number;
    contas_a_pagar: number;
    patrimonio_total_estimado_brl?: number;
    valor_aquisicao_total_brl?: number;
    valor_estimado_imoveis_brl?: number;
    valor_participacoes_aliancas_brl?: number;
    investido_aliancas_brl?: number;
    valorizacao_registrada_brl?: number;
    valorizacao_cobertura?: {
      propertiesIncluded: number; propertiesTotal: number;
      alliancesIncluded: number; alliancesTotal: number;
    };
  };
  cambio?: {
    moeda_base: "BRL"; fonte: string; fonte_url: string;
    cotacoes: Array<{ moeda: string; taxaBrl: number; data: string; fonte: string; fetchedAt: string }>;
    moedas_necessarias: string[]; moedas_excluidas: string[]; precisa_atualizar: boolean;
  };
}

interface CarteiraLancamento {
  id: string;
  imovel_id: string;
  tipo: "receita" | "despesa";
  categoria: string;
  valor: number;
  data: string;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  status?: string;
  descricao: string;
  origem?: string;
}

interface CarteiraDocumento {
  id: string;
  file_id: string;
  file_url?: string;
  nome: string;
  tipo: string;
  versao: number;
  emissao?: string | null;
  validade?: string | null;
  origem: string;
  status_validacao: string;
  observacao?: string | null;
  criado_em: string;
}

interface CarteiraAlerta {
  id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  descricao?: string | null;
  impacto?: string | null;
  acao_sugerida?: string | null;
  acao_registrada?: string | null;
  acao_registrada_em?: string | null;
  prazo?: string | null;
  status: string;
}

interface CarteiraEvento {
  id: string;
  tipo: string;
  origem: string;
  titulo?: string;
  payload?: Record<string, unknown>;
  criado_em: string;
}

interface CarteiraAlternativa {
  tipo: "manter" | "renda" | "vender" | "transformar";
  titulo: string;
  capital_necessario: string;
  resultado_esperado: string;
  prazo: string;
  risco: "baixo" | "medio" | "alto";
  premissas: string[];
  validacoes: string[];
  aderencia: number;
  justificativa: string;
}

interface CarteiraAlternativasResult {
  alternativas: CarteiraAlternativa[];
  melhor_alternativa: string | null;
  resumo: string;
  preliminar: boolean;
  aviso: string;
}

interface CarteiraDemanda {
  id: string;
  codigo?: string | null;
  tipo_resolucao: string;
  alternativa?: string | null;
  titulo: string;
  escopo?: string | null;
  urgencia: string;
  especialidades?: string[];
  status: string;
  responsavel_user_id?: string | null;
  propostas?: Array<Record<string, unknown>>;
  documentos?: Array<{ file_id?: string; nome?: string; criado_em?: string }>;
  proximas_etapas?: Array<{ descricao?: string; status?: string; criado_em?: string }>;
  opa_id?: string | null;
  oportunidade_id?: string | null;
  economic_opportunity_id?: string | null;
  visibilidade?: "privada" | "publicada" | "restrita" | "pausada";
  resumo_publico?: string | null;
  expira_em?: string | null;
  fluxo_disparo?: "imediato" | "gradual";
  total_interesses?: number | string;
  resultado?: string | null;
  criado_em: string;
}

interface DemandaInteresse {
  id: string;
  membro_nome?: string | null;
  mensagem?: string | null;
  status: "interesse_recebido" | "em_analise" | "selecionado" | "nao_selecionado" | "retirado";
  criado_em?: string;
}

interface DemandProfessionalRecommendation {
  id: string;
  user_id?: string | null;
  nome: string;
  cargo?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  estado?: string | null;
  especialidades?: string[];
  aderencia: number;
  motivos?: string[];
  aura?: { score?: number | null; faixa?: string | null; avaliacoes?: number } | null;
}

interface CarteiraAcesso {
  id: string;
  user_id?: string | null;
  membro_id?: string | null;
  nivel: AccessLevel;
  nome?: string | null;
  email?: string | null;
  username?: string | null;
}

interface CarteiraAcessoTemporario extends CarteiraAcesso {
  demanda_id: string;
  demanda_titulo?: string | null;
  demanda_codigo?: string | null;
  motivo?: string | null;
  concedido_em?: string | null;
  expira_em?: string | null;
}

interface AccessResponse {
  owner?: { id?: string; membro_id?: string; nome?: string; email?: string; username?: string } | null;
  acessos: CarteiraAcesso[];
  acessos_temporarios?: CarteiraAcessoTemporario[];
  current_level: AccessLevel;
  is_owner: boolean;
}

interface MarketM2Analysis {
  amostra_suficiente: boolean;
  quantidade_comparaveis: number;
  area_min: number;
  area_max: number;
  classificacao?: "abaixo" | "media" | "acima" | null;
  preco_m2_informado?: number | null;
  referencia_m2_media?: number | null;
  referencia_m2_min?: number | null;
  referencia_m2_max?: number | null;
  resumo?: string;
  fontes?: Array<{ titulo?: string; url: string; trecho?: string }>;
}

const EMPTY_PROPERTY: Omit<CarteiraImovel, "id"> = {
  nome: "",
  tipo: "",
  area_m2: "",
  valor_pago: "",
  valor_atual: "",
  moeda: "BRL",
  descricao: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  pais: "Brasil",
  matricula: "",
  cartorio: "",
  foto: "",
  status: "ativo",
  ocupacao: "desconhecido",
  objetivo: "indefinido",
  titularidade: [],
  participacao_percentual: 100,
  socios: [],
  situacao_pagamento: "quitado",
  forma_pagamento: "",
  instituicao_financeira: "",
  condicoes_financiamento: "",
  parcelas_pagas: 0,
  parcelas_restantes: 0,
  divida_saldo: "",
  valor_data_base: new Date().toISOString().slice(0, 10),
  valor_origem: "declarada",
  area_origem: "declarada",
  ocupacao_origem: "declarada",
  dados_origem: {},
  frequencia_pulso: "mensal",
};

function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(parseNumber(value));
}

function shortDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function canAccess(level: AccessLevel | undefined, required: "leitura" | "colaboracao" | "administracao") {
  const ranks: Record<string, number> = { leitura: 1, colaboracao: 2, administracao: 3, proprietario: 4 };
  return (ranks[level || "leitura"] || 0) >= ranks[required];
}

function pulseDue(item: CarteiraImovel) {
  return Boolean(item.proximo_pulso_em && item.frequencia_pulso !== "desativado" && item.proximo_pulso_em <= new Date().toISOString().slice(0, 10));
}

function metricTone(value: number) {
  return value >= 0 ? "text-emerald-700" : "text-red-700";
}

function carteiraPhotoUrl(value?: string | null) {
  const photo = String(value || "").trim();
  if (!photo) return null;
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(photo) || photo.startsWith("/api/assets/")) return photo;
  return `/api/assets/${encodeURIComponent(photo)}`;
}

function Metric({ label, value, icon: Icon, tone = "text-slate-900", helper, description }: {
  label: string;
  value: string;
  icon: any;
  tone?: string;
  helper?: string;
  description?: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              {description && <ModuleInfo title={label} description={description} />}
            </div>
            <p className={`mt-1 truncate text-lg font-bold tabular-nums ${tone}`}>{value}</p>
            {helper && <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>}
          </div>
          <Icon className="h-4 w-4 shrink-0 text-blue-600" />
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: CarteiraImovel | null;
  onSave: (payload: Omit<CarteiraImovel, "id">) => void;
  saving?: boolean;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState<Omit<CarteiraImovel, "id">>(EMPTY_PROPERTY);
  const [cepLoading, setCepLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [resendingPartnerId, setResendingPartnerId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoUrl = carteiraPhotoUrl(form.foto);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      setForm({
        ...EMPTY_PROPERTY,
        socios: [{ nome: user?.nome || "Proprietário principal", email: user?.email || "", user_id: user?.id || null, membro_id: user?.membro_directus_id || null, map_percentual: 100, status: "aceito" }],
      });
      return;
    }
    const { id: _id, diagnostico: _diagnostico, access_level: _access, is_owner: _owner, ...editable } = initial;
    setForm({
      ...EMPTY_PROPERTY,
      ...editable,
      socios: initial.socios?.length ? initial.socios : [{ nome: user?.nome || "Proprietário principal", email: user?.email || "", user_id: user?.id || null, membro_id: user?.membro_directus_id || null, map_percentual: initial.participacao_percentual ?? 100, status: "aceito" }],
    });
  }, [open, initial, user]);

  const mapTotal = (form.socios || []).reduce((sum, item) => sum + Number(item.map_percentual || 0), 0);

  async function updateCep(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const cep = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setForm((current) => ({ ...current, cep }));
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (!data?.erro) {
        setForm((current) => ({
          ...current,
          cep,
          endereco: data.logradouro || current.endereco,
          complemento: data.complemento || current.complemento,
          bairro: data.bairro || current.bairro,
          cidade: data.localidade || current.cidade,
          estado: data.uf || current.estado,
          pais: "Brasil",
        }));
      }
    } finally {
      setCepLoading(false);
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
    if (!(file.type.startsWith("image/") || allowedExtensions.includes(extension))) {
      toast({ title: "Selecione uma imagem válida", description: "Use JPG, PNG, WebP, HEIC ou HEIF.", variant: "destructive" });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "A foto é muito grande", description: "Escolha uma imagem de até 25 MB.", variant: "destructive" });
      return;
    }

    setUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append("files", file);
      const response = await fetch("/api/upload", { method: "POST", credentials: "include", body });
      const data = await response.json().catch(() => ({}));
      const fileId = data.fileIds?.[0];
      if (!response.ok || !fileId) throw new Error(data.error || "O servidor não retornou a foto enviada.");
      setForm((current) => ({ ...current, foto: fileId }));
      toast({ title: "Foto adicionada", description: "Ela será salva junto com os dados do imóvel." });
    } catch (error: any) {
      toast({ title: "Não foi possível enviar a foto", description: error?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function resendPartnerInvite(partner: ImovelSocio) {
    if (!initial?.id || !partner.id) return;
    setResendingPartnerId(partner.id);
    try {
      await apiRequest("POST", `/api/carteira/imoveis/${initial.id}/socios/${partner.id}/reenviar`, {});
      setForm((current) => ({ ...current, socios: current.socios?.map((item) => item.id === partner.id ? { ...item, status: "pendente" } : item) }));
      toast({ title: "Convite reenviado", description: `Enviamos uma nova confirmação para ${partner.email}.` });
    } catch (error: any) {
      toast({ title: "Não foi possível reenviar", description: error?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setResendingPartnerId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar imóvel" : "Novo imóvel na Carteira"}</DialogTitle>
          <DialogDescription>Comece com o essencial. Informações adicionais podem ser incluídas aos poucos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Foto do imóvel</Label>
            <div className="flex flex-col gap-3 rounded-md border border-dashed bg-slate-50 p-3 sm:flex-row sm:items-center">
              <div className="relative flex aspect-[16/10] w-full shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white sm:w-44">
                {photoUrl ? (
                  <img src={photoUrl} alt="Prévia do imóvel" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-8 w-8 text-slate-300" />
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                  className="hidden"
                  disabled={uploadingPhoto}
                  onChange={(event) => {
                    void uploadPhoto(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                  data-testid="input-carteira-foto"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingPhoto}
                  onClick={() => photoInputRef.current?.click()}
                  data-testid="btn-carteira-selecionar-foto"
                >
                  {uploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {uploadingPhoto ? "Enviando..." : form.foto ? "Trocar foto" : "Selecionar foto"}
                </Button>
                {form.foto && !uploadingPhoto && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setForm((current) => ({ ...current, foto: "" }))}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                )}
                <p className="basis-full text-xs text-muted-foreground">JPG, PNG, WebP ou foto do celular, com até 25 MB.</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Identificação *</Label>
            <Input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Apartamento Jardim..." />
          </div>
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={(value) => setForm({ ...form, tipo: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {["Terreno", "Casa", "Apartamento", "Prédio", "Loja", "Galpão", "Rural", "Outro"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ocupação *</Label>
            <Select value={form.ocupacao} onValueChange={(value) => setForm({ ...form, ocupacao: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ocupado">Ocupado</SelectItem>
                <SelectItem value="parcial">Parcialmente ocupado</SelectItem>
                <SelectItem value="vazio">Vazio</SelectItem>
                <SelectItem value="uso_proprio">Uso próprio</SelectItem>
                <SelectItem value="desconhecido">Desconhecido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Objetivo *</Label>
            <Select value={form.objetivo} onValueChange={(value) => setForm({ ...form, objetivo: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="renda">Gerar renda</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="valorizacao">Valorização</SelectItem>
                <SelectItem value="uso">Uso próprio</SelectItem>
                <SelectItem value="reforma">Reforma</SelectItem>
                <SelectItem value="construcao">Construção</SelectItem>
                <SelectItem value="indefinido">Ainda não definido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Área aproximada (m²)</Label>
            <Input inputMode="decimal" value={String(form.area_m2 || "")} onChange={(event) => setForm({ ...form, area_m2: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Origem da área</Label>
            <Select value={form.area_origem || "declarada"} onValueChange={(value) => setForm({ ...form, area_origem: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="declarada">Declarada</SelectItem>
                <SelectItem value="extraida">Extraída de documento</SelectItem>
                <SelectItem value="externa">Fonte externa</SelectItem>
                <SelectItem value="validada">Validada</SelectItem>
                <SelectItem value="estimada">Estimada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Moeda</Label>
            <Select value={form.moeda} onValueChange={(value) => setForm({ ...form, moeda: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor de aquisição</Label>
            <Input inputMode="decimal" value={String(form.valor_pago || "")} onChange={(event) => setForm({ ...form, valor_pago: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Valor atual estimado</Label>
            <Input inputMode="decimal" value={String(form.valor_atual || "")} onChange={(event) => setForm({ ...form, valor_atual: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Data-base do valor</Label>
            <Input type="date" value={form.valor_data_base || ""} onChange={(event) => setForm({ ...form, valor_data_base: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Origem do valor</Label>
            <Select value={form.valor_origem || "declarada"} onValueChange={(value) => setForm({ ...form, valor_origem: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="declarada">Declarado pelo usuário</SelectItem>
                <SelectItem value="extraida">Extraído de documento</SelectItem>
                <SelectItem value="externa">Fonte externa</SelectItem>
                <SelectItem value="validada">Validado</SelectItem>
                <SelectItem value="estimada">Estimado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Saldo de dívida</Label>
            <Input inputMode="decimal" value={String(form.divida_saldo || "")} onChange={(event) => setForm({ ...form, divida_saldo: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Situação do pagamento</Label>
            <Select value={form.situacao_pagamento || "quitado"} onValueChange={(value: "quitado" | "financiado") => setForm({ ...form, situacao_pagamento: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="quitado">Quitado</SelectItem><SelectItem value="financiado">Financiado</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Input value={form.forma_pagamento || ""} onChange={(event) => setForm({ ...form, forma_pagamento: event.target.value })} placeholder="À vista, financiamento..." />
          </div>
          {form.situacao_pagamento === "financiado" && <>
            <div className="space-y-2">
              <Label>Instituição financeira</Label>
              <Input value={form.instituicao_financeira || ""} onChange={(event) => setForm({ ...form, instituicao_financeira: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Condições do financiamento</Label>
              <Input value={form.condicoes_financiamento || ""} onChange={(event) => setForm({ ...form, condicoes_financiamento: event.target.value })} placeholder="Taxa, prazo e sistema de amortização" />
            </div>
            <div className="space-y-2">
              <Label>Parcelas pagas</Label>
              <Input type="number" min="0" value={form.parcelas_pagas || 0} onChange={(event) => setForm({ ...form, parcelas_pagas: Number(event.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Parcelas restantes</Label>
              <Input type="number" min="0" value={form.parcelas_restantes || 0} onChange={(event) => setForm({ ...form, parcelas_restantes: Number(event.target.value) })} />
            </div>
          </>}
          <div className="space-y-2">
            <Label>Liquidez confirmada</Label>
            <Select value={form.liquidez_confirmada || "nao_confirmada"} onValueChange={(value) => setForm({ ...form, liquidez_confirmada: value === "nao_confirmada" ? null : value as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="nao_confirmada">Não confirmada</SelectItem><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-3 rounded-md border bg-slate-50 p-4 sm:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><Label className="text-base">Sócios e MAP de origem</Label><p className="mt-1 text-xs text-muted-foreground">Convide coproprietários por e-mail. A composição precisa totalizar exatamente 100%.</p></div>
              <Badge variant={Math.abs(mapTotal - 100) < 0.0001 ? "default" : "destructive"}>{mapTotal.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%</Badge>
            </div>
            {(form.socios || []).map((socio, index) => (
              <div key={socio.id || index} className="grid gap-2 rounded-md border bg-white p-3 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
                <div className="space-y-1"><Label>Nome</Label><Input value={socio.nome} onChange={(event) => setForm({ ...form, socios: form.socios?.map((item, itemIndex) => itemIndex === index ? { ...item, nome: event.target.value } : item) })} /></div>
                <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={socio.email || ""} disabled={index === 0} onChange={(event) => setForm({ ...form, socios: form.socios?.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item) })} /></div>
                <div className="space-y-1"><Label>MAP (%)</Label><Input type="number" min="0.0001" max="100" step="0.01" value={socio.map_percentual} onChange={(event) => setForm({ ...form, socios: form.socios?.map((item, itemIndex) => itemIndex === index ? { ...item, map_percentual: Number(event.target.value) } : item) })} /></div>
                <div className="flex items-center gap-1 pb-0.5">
                  {socio.status && <Badge variant="outline">{socio.status}</Badge>}
                  {initial?.id && socio.id && index > 0 && socio.status !== "aceito" && <Button type="button" variant="ghost" size="icon" aria-label={`Reenviar convite para ${socio.nome || socio.email}`} disabled={resendingPartnerId === socio.id} onClick={() => void resendPartnerInvite(socio)}>{resendingPartnerId === socio.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>}
                  {index > 0 && <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${socio.nome || "sócio"}`} onClick={() => setForm({ ...form, socios: form.socios?.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setForm({ ...form, socios: [...(form.socios || []), { nome: "", email: "", map_percentual: 0, status: "pendente" }] })}><UserPlus className="mr-2 h-4 w-4" />Adicionar coproprietário</Button>
            <p className="text-xs text-muted-foreground">Os percentuais são declarações econômicas e não substituem escritura, matrícula ou documentos de titularidade.</p>
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <div className="relative">
              <Input value={form.cep || ""} onChange={(event) => void updateCep(event.target.value)} maxLength={9} />
              {cepLoading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={form.endereco || ""} onChange={(event) => setForm({ ...form, endereco: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input value={form.numero || ""} onChange={(event) => setForm({ ...form, numero: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input value={form.complemento || ""} onChange={(event) => setForm({ ...form, complemento: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={form.bairro || ""} onChange={(event) => setForm({ ...form, bairro: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.cidade || ""} onChange={(event) => setForm({ ...form, cidade: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={form.estado || ""} onChange={(event) => setForm({ ...form, estado: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>País</Label>
            <Input value={form.pais || ""} onChange={(event) => setForm({ ...form, pais: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Matrícula</Label>
            <Input value={form.matricula || ""} onChange={(event) => setForm({ ...form, matricula: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cartório</Label>
            <Input value={form.cartorio || ""} onChange={(event) => setForm({ ...form, cartorio: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Frequência do Pulso</Label>
            <Select value={form.frequencia_pulso} onValueChange={(value: "mensal" | "trimestral" | "desativado") => setForm({ ...form, frequencia_pulso: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="desativado">Desativado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao || ""} onChange={(event) => setForm({ ...form, descricao: event.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={saving || uploadingPhoto || !form.nome || !form.tipo || Math.abs(mapTotal - 100) >= 0.0001 || (form.socios || []).some((item) => !item.nome || !item.email)}
            onClick={() => onSave(form)}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Salvar alterações" : "Adicionar imóvel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PropertyCard({
  item,
  portfolioTotal,
  onOpen,
  onEdit,
  onDelete,
}: {
  item: CarteiraImovel;
  portfolioTotal: number;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const diagnostic = item.diagnostico;
  const hasActions = Boolean(onEdit || onDelete);
  const photoUrl = carteiraPhotoUrl(item.foto);
  const ownership = Math.min(100, Math.max(0, Number(item.map_percentual_usuario ?? item.participacao_percentual ?? 100)));
  const ownedValue = parseNumber(item.valor_utilizado_no_total_brl ?? item.valor_atual) * ownership / 100;
  const portfolioShare = portfolioTotal > 0 ? Math.max(0, ownedValue) / portfolioTotal * 100 : 0;
  const acquisition = parseNumber(item.valor_aquisicao_brl ?? item.valor_pago) * ownership / 100;
  const evolution = acquisition > 0 ? (ownedValue - acquisition) / acquisition * 100 : null;
  return (
    <Card className="relative overflow-hidden border-border/70 transition-colors hover:border-blue-300">
      <CardContent className="p-0">
        {hasActions && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
            {onEdit && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 bg-white"
                onClick={onEdit}
                aria-label={`Editar ${item.nome}`}
                title="Editar imóvel"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={onDelete}
                aria-label={`Excluir ${item.nome}`}
                title="Excluir imóvel"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        <button type="button" onClick={onOpen} className={`w-full p-4 text-left ${hasActions ? "pr-24" : ""}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-50 text-blue-600">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{item.nome}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[item.bairro, item.cidade, item.estado].filter(Boolean).join(", ") || item.tipo}
                  </p>
                </div>
                {!hasActions && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{diagnostic?.situacao || "Preliminar"}</Badge>
                <Badge variant="outline">{item.ocupacao || "Ocupação pendente"}</Badge>
                {pulseDue(item) && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pulso pendente</Badge>}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">Sua fração ({ownership.toFixed(2)}%)</p>
              <p className="font-semibold tabular-nums">{money(ownedValue)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Resultado registrado</p>
              <p className={`font-semibold tabular-nums ${metricTone(diagnostic?.indicadores?.resultado_liquido || 0)}`}>
                {money(diagnostic?.indicadores?.resultado_liquido || 0, item.moeda)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{portfolioShare.toFixed(1)}% do patrimônio total · {money(item.contas_a_pagar || 0, item.moeda)} a pagar{evolution == null ? "" : ` · evolução ${evolution.toFixed(1)}%`}</p>
          <div className="mt-3 space-y-1 text-xs">
            <p><span className="font-medium text-foreground">Oportunidade:</span> <span className="text-muted-foreground">{diagnostic?.oportunidade || "Complete os dados do imóvel."}</span></p>
            <p><span className="font-medium text-foreground">Próxima ação:</span> <span className="text-blue-700">{diagnostic?.proxima_acao || "Realizar Pulso Patrimonial"}</span></p>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

export function CarteiraDashboardPanel({ compact = false }: { compact?: boolean }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isPlatformAdmin = ["admin", "superadmin"].includes(String(user?.role || "").toLowerCase());
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("todos");
  const [period, setPeriod] = useState<"12m" | "all">("12m");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CarteiraImovel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CarteiraImovel | null>(null);
  const [deleteAllianceTarget, setDeleteAllianceTarget] = useState<CarteiraResumo["aliancas"][number] | null>(null);
  const [aporteTarget, setAporteTarget] = useState<CarteiraResumo["aliancas"][number] | null>(null);
  const [aporteValor, setAporteValor] = useState("");
  const [aporteObservacao, setAporteObservacao] = useState("");
  const [aporteFile, setAporteFile] = useState<File | null>(null);
  const [gestaoTarget, setGestaoTarget] = useState<CarteiraResumo["aliancas"][number] | null>(null);
  const [snapshotForm, setSnapshotForm] = useState({ patrimonio_liquido: "", data_base: new Date().toISOString().slice(0, 10), metodologia: "Avaliação dos diretores", liquidez: "media" });
  const automaticRefreshKey = useRef("");
  const { data, isLoading } = useQuery<CarteiraResumo>({
    queryKey: ["/api/carteira/resumo", period],
    queryFn: async () => {
      const response = await fetch(`/api/carteira/resumo?period=${period}`, { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível carregar a Carteira.");
      return response.json();
    },
  });
  function invalidateDashboard() {
    queryClient.invalidateQueries({ queryKey: ["/api/carteira/resumo"] });
    queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis"] });
  }
  const createMutation = useMutation({
    mutationFn: async (payload: Omit<CarteiraImovel, "id">) => (await apiRequest("POST", "/api/carteira/imoveis", payload)).json(),
    onSuccess: (item: CarteiraImovel) => {
      invalidateDashboard();
      setFormOpen(false);
      navigate(`/carteira/${item.id}`);
    },
    onError: (error: any) => toast({ title: "Não foi possível adicionar o imóvel", description: error?.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Omit<CarteiraImovel, "id"> }) =>
      (await apiRequest("PATCH", `/api/carteira/imoveis/${id}`, payload)).json(),
    onSuccess: () => {
      invalidateDashboard();
      setFormOpen(false);
      setEditingItem(null);
      toast({ title: "Imóvel atualizado" });
    },
    onError: (error: any) => toast({ title: "Não foi possível atualizar o imóvel", description: error?.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/carteira/imoveis/${id}`),
    onSuccess: (_data, deletedId) => {
      queryClient.removeQueries({ queryKey: ["/api/carteira/imoveis", deletedId] });
      invalidateDashboard();
      setDeleteTarget(null);
      toast({ title: "Imóvel excluído da Carteira" });
    },
    onError: (error: any) => toast({ title: "Não foi possível excluir o imóvel", description: error?.message, variant: "destructive" }),
  });
  useEffect(() => {
    if (!data) return;
    const pendingProperties = data.imoveis.filter((item) => item.estimativa_mercado?.precisa_atualizar
      && ["proprietario", "administracao"].includes(String(item.access_level || "")));
    const pendingCurrencies = data.cambio?.precisa_atualizar ? data.cambio.moedas_necessarias : [];
    const key = `${pendingCurrencies.slice().sort().join(",")}|${pendingProperties.map((item) => item.id).sort().join(",")}`;
    if (!key.replace("|", "") || automaticRefreshKey.current === key) return;
    automaticRefreshKey.current = key;
    void (async () => {
      let changed = false;
      if (pendingCurrencies.length) {
        const response = await fetch("/api/carteira/cotacoes/atualizar", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moedas: pendingCurrencies }),
        }).catch(() => null);
        changed = Boolean(response?.ok) || changed;
      }
      for (const item of pendingProperties) {
        const response = await fetch(`/api/carteira/imoveis/${encodeURIComponent(item.id)}/avaliacao/pesquisar`, {
          method: "POST", credentials: "include",
        }).catch(() => null);
        changed = Boolean(response?.ok) || changed;
      }
      if (changed) queryClient.invalidateQueries({ queryKey: ["/api/carteira/resumo"] });
    })();
  }, [data]);
  const deleteAllianceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bias/${id}`),
    onSuccess: () => {
      invalidateDashboard();
      queryClient.invalidateQueries({ queryKey: ["/api/bias"] });
      setDeleteAllianceTarget(null);
      toast({ title: "BIA excluída" });
    },
    onError: (error: any) => toast({ title: "Não foi possível excluir a BIA", description: error?.message, variant: "destructive" }),
  });
  const aporteMutation = useMutation({
    mutationFn: async () => {
      if (!aporteTarget || !aporteFile) throw new Error("Informe o valor e envie o comprovante.");
      const body = new FormData();
      body.append("valor", aporteValor);
      body.append("observacao", aporteObservacao);
      body.append("comprovante", aporteFile);
      const response = await fetch(`/api/bias/${aporteTarget.id}/aporte-solicitacoes`, { method: "POST", credentials: "include", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar o aporte.");
      return data;
    },
    onSuccess: () => {
      setAporteTarget(null);
      setAporteValor("");
      setAporteObservacao("");
      setAporteFile(null);
      toast({ title: "Aporte enviado para aprovação" });
    },
    onError: (error: any) => toast({ title: "Não foi possível enviar o aporte", description: error?.message, variant: "destructive" }),
  });
  const aporteRequestsQuery = useQuery<any[]>({
    queryKey: ["/api/bias", gestaoTarget?.id, "aporte-solicitacoes"],
    enabled: Boolean(gestaoTarget),
    queryFn: async () => (await apiRequest("GET", `/api/bias/${gestaoTarget!.id}/aporte-solicitacoes`)).json(),
  });
  const snapshotMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/bias/${gestaoTarget!.id}/patrimonio`, { ...snapshotForm, patrimonio_liquido: parseNumber(snapshotForm.patrimonio_liquido), moeda: gestaoTarget?.moeda || "BRL" }),
    onSuccess: () => { invalidateDashboard(); toast({ title: "Valor patrimonial oficial registrado" }); },
    onError: (error: any) => toast({ title: "Não foi possível registrar o patrimônio", description: error?.message, variant: "destructive" }),
  });
  const aporteDecisionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) => apiRequest("PATCH", `/api/bias/${gestaoTarget!.id}/aporte-solicitacoes/${id}`, { action }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bias", gestaoTarget?.id, "aporte-solicitacoes"] }); invalidateDashboard(); },
    onError: (error: any) => toast({ title: "Não foi possível registrar a decisão", description: error?.message, variant: "destructive" }),
  });
  const imoveis = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.imoveis || []).filter((item) => {
      const text = [item.nome, item.tipo, item.bairro, item.cidade, item.estado, item.diagnostico?.situacao].join(" ").toLowerCase();
      const groupMatch = group === "todos"
        || (group === "renda" && (item.diagnostico?.indicadores?.resultado_liquido || 0) > 0)
        || (group === "otimizar" && item.diagnostico?.classificacoes?.some((value) => value.includes("ineficiente") || value.includes("Subutilizado")))
        || (group === "custos" && (item.diagnostico?.indicadores?.resultado_liquido || 0) < 0)
        || (group === "atencao" && (item.diagnostico?.indicadores?.alertas_abertos || 0) > 0);
      return (!query || text.includes(query)) && groupMatch;
    });
  }, [data?.imoveis, group, search]);
  const totals = data?.totais;
  const excludedCurrencies = data?.cambio?.moedas_excluidas || [];
  const currencyNotice = excludedCurrencies.length
    ? ` Valores em ${excludedCurrencies.join(", ")} estão temporariamente fora do consolidado por falta de cotação oficial.`
    : " Valores em outras moedas são convertidos para BRL pela cotação de venda PTAX mais recente disponível.";
  const valuationCoverage = totals?.valorizacao_cobertura;
  const valuationCoverageText = valuationCoverage
    ? ` O cálculo inclui ${valuationCoverage.propertiesIncluded} de ${valuationCoverage.propertiesTotal} imóveis e ${valuationCoverage.alliancesIncluded} de ${valuationCoverage.alliancesTotal} alianças com as duas bases disponíveis.`
    : "";
  const portfolioRegions = useMemo(() => {
    const groups = new Map<string, { assets: number; value: number }>();
    for (const item of data?.imoveis || []) {
      const key = [item.bairro, item.cidade].filter(Boolean).join(", ") || "Localização não informada";
      const current = groups.get(key) || { assets: 0, value: 0 };
      const share = Math.min(100, Math.max(0, Number(item.map_percentual_usuario ?? item.participacao_percentual ?? 100))) / 100;
      current.assets += 1;
      current.value += parseNumber(item.valor_utilizado_no_total_brl ?? item.valor_atual) * share;
      groups.set(key, current);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].value - a[1].value);
  }, [data?.imoveis]);
  const maxRegionValue = Math.max(1, ...portfolioRegions.map(([, summary]) => Math.max(0, summary.value)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={compact ? "text-lg font-semibold" : "text-2xl font-bold"}>Carteira Patrimonial</h2>
          <p className="mt-1 text-sm text-muted-foreground">Imóveis próprios e participações econômicas em alianças, consolidados em um só lugar.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => document.getElementById("meus-imoveis")?.scrollIntoView({ behavior: "smooth" })}>Meus imóveis</Button>
            <Button size="sm" variant="outline" onClick={() => document.getElementById("minhas-aliancas")?.scrollIntoView({ behavior: "smooth" })}>Minhas Alianças</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as "12m" | "all")}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="12m">Últimos 12 meses</SelectItem><SelectItem value="all">Todo o período</SelectItem></SelectContent></Select>
          <Button variant="outline" onClick={() => navigate("/carteira/novo?path=oportunidade&step=cadastro")}>
            <Lightbulb className="mr-2 h-4 w-4" />
            Identifiquei uma oportunidade
          </Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => navigate("/carteira/novo?path=imovel&step=cadastro")}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar meu imóvel
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Patrimônio Total Estimado" value={money(totals?.patrimonio_total_estimado_brl ?? totals?.patrimonio_total ?? 0)} icon={Landmark} helper={`Dívidas informadas separadamente: ${money(totals?.divida || 0)}`} description={`Soma o valor estimado dos imóveis próprios, respeitando sua fração de propriedade, ao valor confirmado das participações nas BIAs pelo MAP. Dívidas e contas a pagar não são descontadas deste total.${currencyNotice}`} />
        <Metric label="Valor de aquisição" value={money(totals?.valor_aquisicao_total_brl ?? totals?.patrimonio_pago ?? 0)} icon={CircleDollarSign} description={`Soma o valor pago pelos imóveis, proporcional à sua propriedade, aos aportes oficiais realizados nas BIAs.${currencyNotice}`} />
        <Metric label="Valor estimado dos Imóveis Próprios" value={money(totals?.valor_estimado_imoveis_brl ?? totals?.patrimonio_atual ?? 0)} icon={Home} description={`Soma as estimativas dos imóveis em carteira. A pesquisa usa ao menos três anúncios comparáveis do mesmo tipo, dentro de um raio de até 10 km, e é renovada a cada 30 dias. Quando a pesquisa não está disponível, permanece o último valor válido ou o valor declarado.${currencyNotice}`} />
        <Metric label="Investido em alianças" value={money(totals?.investido_aliancas_brl ?? totals?.total_investido_aliancas ?? 0)} icon={Users} helper={`Valor oficial atual: ${money(totals?.valor_participacoes_aliancas_brl ?? totals?.valor_participacoes_aliancas ?? 0)}`} description={`Soma os aportes oficiais que você realizou nas BIAs. Uma BIA sem snapshot patrimonial confirmado permanece neste indicador, mas ainda não entra no Patrimônio Total Estimado.${currencyNotice}`} />
        <Metric label="Valorização registrada" value={money(totals?.valorizacao_registrada_brl ?? totals?.valorizacao ?? 0)} icon={TrendingUp} tone={metricTone(totals?.valorizacao_registrada_brl ?? totals?.valorizacao ?? 0)} description={`Diferença entre o valor estimado e o valor de aquisição dos imóveis, somada à diferença entre as participações confirmadas nas BIAs e os aportes oficiais. Ativos sem as duas bases ficam fora deste cálculo.${valuationCoverageText}${currencyNotice}`} />
        <Metric label="Receitas" value={money(totals?.receitas || 0)} icon={HandCoins} tone="text-emerald-700" description={`Soma das receitas registradas para os imóveis no período selecionado (${period === "12m" ? "últimos 12 meses" : "todo o período"}).`} />
        <Metric label="Despesas" value={money(totals?.despesas || 0)} icon={TrendingDown} tone="text-red-700" description={`Soma das despesas registradas para os imóveis no período selecionado (${period === "12m" ? "últimos 12 meses" : "todo o período"}).`} />
        <Metric label="Resultado líquido" value={money(totals?.resultado_liquido || 0)} icon={Wallet} tone={metricTone(totals?.resultado_liquido || 0)} helper={`${totals?.alertas_abertos || 0} alertas abertos`} description="Resultado das receitas menos as despesas registradas para os imóveis no período selecionado." />
        <Metric label="Parcelas e contas a pagar" value={money(totals?.contas_a_pagar || 0)} icon={CalendarClock} description="Soma das parcelas e despesas pendentes, agendadas ou vencidas dos imóveis. Este valor aparece separadamente e não é descontado do Patrimônio Total Estimado." />
      </div>

      <div id="meus-imoveis" className="flex flex-col gap-2 scroll-mt-20 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar imóvel, cidade ou situação..." className="pl-9" />
        </div>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os imóveis</SelectItem>
            <SelectItem value="renda">Gerando renda</SelectItem>
            <SelectItem value="otimizar">Precisam de otimização</SelectItem>
            <SelectItem value="custos">Consumindo patrimônio</SelectItem>
            <SelectItem value="atencao">Com alertas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-md bg-muted" />)}
        </div>
      ) : imoveis.length === 0 ? (
        <div className="border-y py-16 text-center">
          <Home className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">{data?.imoveis?.length ? "Nenhum imóvel encontrado" : "Sua Carteira está pronta para começar"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{data?.imoveis?.length ? "Ajuste os filtros da busca." : "Cadastre o primeiro imóvel com as informações que você já possui."}</p>
          {!data?.imoveis?.length && (
            <Button
              className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => navigate("/carteira/novo?path=imovel&step=cadastro")}
            >
              Cadastrar meu imóvel
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {imoveis.map((item) => (
            <PropertyCard
              key={item.id}
              item={item}
              portfolioTotal={totals?.patrimonio_total_estimado_brl ?? totals?.patrimonio_total ?? 0}
              onOpen={() => navigate(`/carteira/${item.id}`)}
              onEdit={canAccess(item.access_level, "administracao") ? () => {
                setEditingItem(item);
                setFormOpen(true);
              } : undefined}
              onDelete={(item.can_delete ?? (item.is_owner || isPlatformAdmin)) ? () => setDeleteTarget(item) : undefined}
            />
          ))}
        </div>
      )}
      <section id="minhas-aliancas" className="scroll-mt-20 space-y-3 border-t pt-5">
        <div>
          <h3 className="text-lg font-semibold">Minhas Alianças</h3>
          <p className="text-sm text-muted-foreground">Todas as alianças formais aparecem aqui. Apenas MAP com valor patrimonial oficial confirmado entra no total.</p>
        </div>
        {(data?.aliancas || []).length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Você ainda não participa formalmente de uma aliança.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data?.aliancas.map((item) => (
              <Card key={item.id} className="border-border/70">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-semibold">{item.nome}</p><p className="text-xs text-muted-foreground">{item.codigo || item.situacao || "Aliança BUILT"}</p></div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">MAP {item.map_percent.toFixed(2)}%</Badge>
                      {(item.can_delete ?? isPlatformAdmin) && (
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setDeleteAllianceTarget(item)} aria-label={`Excluir ${item.nome}`} title="Excluir BIA">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Aportes oficiais</p><p className="font-semibold">{money(item.aportes_oficiais, item.moeda)}</p></div><div><p className="text-xs text-muted-foreground">Sua participação</p><p className="font-semibold">{item.valor_participacao == null ? "Aguardando valor oficial" : money(item.valor_participacao, item.moeda)}</p></div></div>
                  <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs"><div><p className="text-muted-foreground">Receitas</p><p className="font-semibold text-emerald-700">{money(item.receitas_participacao || 0, item.moeda)}</p></div><div><p className="text-muted-foreground">Despesas</p><p className="font-semibold text-red-700">{money(item.despesas_participacao || 0, item.moeda)}</p></div><div><p className="text-muted-foreground">A pagar</p><p className="font-semibold">{money(item.contas_a_pagar_participacao || 0, item.moeda)}</p></div></div>
                  {item.evolucao_patrimonial_percentual != null && <p className={`text-xs font-medium ${metricTone(item.evolucao_patrimonial_percentual)}`}>Evolução patrimonial: {item.evolucao_patrimonial_percentual.toFixed(1)}%</p>}
                  <p className="text-xs text-muted-foreground">{item.valor_participacao_brl == null || !(totals?.patrimonio_total_estimado_brl ?? totals?.patrimonio_total) ? "Ainda não entra no patrimônio consolidado." : `${(item.valor_participacao_brl / (totals?.patrimonio_total_estimado_brl ?? totals?.patrimonio_total ?? 1) * 100).toFixed(1)}% do patrimônio total estimado.`}</p>
                  <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => navigate(`/bias/${item.id}`)}>Abrir aliança</Button><Button variant="outline" onClick={() => setAporteTarget(item)}><HandCoins className="mr-2 h-4 w-4" />Enviar aporte</Button></div>
                  {item.can_manage_patrimonio && <Button className="w-full" variant="outline" onClick={() => { setGestaoTarget(item); setSnapshotForm((current) => ({ ...current, patrimonio_liquido: item.patrimonio_liquido_oficial == null ? "" : String(item.patrimonio_liquido_oficial), data_base: item.data_base || current.data_base, metodologia: item.metodologia || current.metodologia, liquidez: item.liquidez || current.liquidez })); }}><ShieldCheck className="mr-2 h-4 w-4" />Gestão patrimonial</Button>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      {portfolioRegions.length > 0 && <section className="space-y-3 border-t pt-5">
        <div><h3 className="text-lg font-semibold">Mapa de calor patrimonial por região</h3><p className="text-sm text-muted-foreground">Quanto mais intensa a cor, maior o patrimônio estimado da Carteira naquela região. Endereços privados não são exibidos.</p></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{portfolioRegions.map(([region, summary]) => <div key={region} className="rounded-md border p-3" style={{ backgroundColor: `rgba(37, 99, 235, ${0.08 + 0.42 * Math.max(0, summary.value) / maxRegionValue})` }}><p className="font-medium">{region}</p><p className="text-xs text-slate-700">{summary.assets} ativo(s) · {money(summary.value)}</p></div>)}</div>
      </section>}
      <Dialog open={Boolean(aporteTarget)} onOpenChange={(open) => !open && setAporteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar aporte para aprovação</DialogTitle><DialogDescription>O lançamento e o MAP só serão alterados após a aprovação de um diretor autorizado em {aporteTarget?.nome}.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="aporte-valor">Valor</Label><Input id="aporte-valor" type="number" min="0.01" step="0.01" value={aporteValor} onChange={(event) => setAporteValor(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="aporte-comprovante">Comprovante (PDF, JPG ou PNG)</Label><Input id="aporte-comprovante" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setAporteFile(event.target.files?.[0] || null)} /></div>
            <div className="space-y-2"><Label htmlFor="aporte-observacao">Observação</Label><Textarea id="aporte-observacao" value={aporteObservacao} onChange={(event) => setAporteObservacao(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAporteTarget(null)}>Cancelar</Button><Button disabled={aporteMutation.isPending || !aporteFile || Number(aporteValor) <= 0} onClick={() => aporteMutation.mutate()}>{aporteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar para aprovação</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(gestaoTarget)} onOpenChange={(open) => !open && setGestaoTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gestão patrimonial · {gestaoTarget?.nome}</DialogTitle>
            <DialogDescription>Somente diretores autorizados registram o valor oficial e decidem solicitações de aporte.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>Patrimônio líquido oficial</Label><Input inputMode="decimal" value={snapshotForm.patrimonio_liquido} onChange={(event) => setSnapshotForm({ ...snapshotForm, patrimonio_liquido: event.target.value })} /></div>
            <div className="space-y-2"><Label>Data-base</Label><Input type="date" value={snapshotForm.data_base} onChange={(event) => setSnapshotForm({ ...snapshotForm, data_base: event.target.value })} /></div>
            <div className="space-y-2"><Label>Metodologia</Label><Input value={snapshotForm.metodologia} onChange={(event) => setSnapshotForm({ ...snapshotForm, metodologia: event.target.value })} /></div>
            <div className="space-y-2"><Label>Liquidez</Label><Select value={snapshotForm.liquidez} onValueChange={(value) => setSnapshotForm({ ...snapshotForm, liquidez: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div>
            <Button className="sm:col-span-2" disabled={snapshotMutation.isPending || parseNumber(snapshotForm.patrimonio_liquido) < 0 || !snapshotForm.metodologia} onClick={() => snapshotMutation.mutate()}>{snapshotMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar novo snapshot oficial</Button>
          </div>
          <div className="space-y-2 border-t pt-4">
            <p className="font-semibold">Solicitações de aporte</p>
            {aporteRequestsQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : !(aporteRequestsQuery.data || []).some((item) => item.status === "pending") ? <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p> : (aporteRequestsQuery.data || []).filter((item) => item.status === "pending").map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                <div className="min-w-0 flex-1"><p className="font-medium">{money(item.valor, item.moeda || gestaoTarget?.moeda)}</p><p className="text-xs text-muted-foreground">Membro {item.membro_id}</p></div>
                <Button size="sm" variant="outline" disabled={aporteDecisionMutation.isPending} onClick={() => aporteDecisionMutation.mutate({ id: item.id, action: "reject" })}>Rejeitar</Button>
                <Button size="sm" disabled={aporteDecisionMutation.isPending} onClick={() => aporteDecisionMutation.mutate({ id: item.id, action: "approve" })}>Aprovar</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <PropertyFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingItem(null);
        }}
        initial={editingItem}
        onSave={(payload) => {
          if (editingItem) updateMutation.mutate({ id: editingItem.id, payload });
          else createMutation.mutate(payload);
        }}
        saving={createMutation.isPending || updateMutation.isPending}
      />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e também removerá os lançamentos, documentos e o histórico vinculados a este imóvel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir imóvel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(deleteAllianceTarget)} onOpenChange={(open) => !open && setDeleteAllianceTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteAllianceTarget?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente e removerá a BIA da plataforma.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAllianceMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteAllianceMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteAllianceTarget) deleteAllianceMutation.mutate(deleteAllianceTarget.id);
              }}
            >
              {deleteAllianceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir BIA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewLaunchDialog({ open, onOpenChange, imovelId, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; imovelId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ tipo: "despesa", categoria: "Manutenção", valor: "", data: new Date().toISOString().slice(0, 10), status: "pago", descricao: "" });
  const mutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/carteira/lancamentos", { ...form, valor: parseNumber(form.valor), imovel_id: imovelId, origem: "declarada" })).json(),
    onSuccess: () => {
      onOpenChange(false);
      setForm({ tipo: "despesa", categoria: "Manutenção", valor: "", data: new Date().toISOString().slice(0, 10), status: "pago", descricao: "" });
      onSaved();
    },
    onError: (error: any) => toast({ title: "Erro ao salvar lançamento", description: error?.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(value) => setForm({ ...form, tipo: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Categoria</Label><Input value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} /></div>
          <div className="space-y-2"><Label>Valor</Label><Input inputMode="decimal" value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} /></div>
          <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })} /></div>
          <div className="space-y-2"><Label>Status</Label>
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pago">Pago</SelectItem><SelectItem value="agendado">Agendado</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="vencido">Vencido</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={mutation.isPending || !form.valor || !form.descricao} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DemandInterestsManager({ imovelId, demand }: { imovelId: string; demand: CarteiraDemanda }) {
  const { toast } = useToast();
  const queryKey = ["/api/carteira/imoveis", imovelId, "demandas", demand.id, "interesses"] as const;
  const interestsQuery = useQuery<DemandaInteresse[]>({
    queryKey,
    enabled: demand.visibilidade === "publicada",
  });
  const statusMutation = useMutation({
    mutationFn: ({ interestId, status }: { interestId: string; status: DemandaInteresse["status"] }) =>
      apiRequest("PATCH", `/api/carteira/imoveis/${imovelId}/demandas/${demand.id}/interesses/${interestId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Interesse atualizado" });
    },
    onError: (error: any) => toast({ title: "Erro ao atualizar interesse", description: error?.message, variant: "destructive" }),
  });

  if (demand.visibilidade !== "publicada") return null;
  const interests = interestsQuery.data || [];

  return (
    <div className="ml-8 border-t pt-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4 text-blue-600" />
        Interessados na Vitrine
        <Badge variant="outline">{interests.length}</Badge>
      </div>
      {interestsQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando interessados...</p>
      ) : interests.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ainda não há manifestações de interesse.</p>
      ) : (
        <div className="space-y-2">
          {interests.map((interest) => (
            <div key={interest.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{interest.membro_nome || "Membro BUILT"}</p>
                {interest.mensagem && <p className="mt-0.5 text-xs text-muted-foreground">{interest.mensagem}</p>}
              </div>
              <Select
                value={interest.status}
                onValueChange={(status) => statusMutation.mutate({ interestId: interest.id, status: status as DemandaInteresse["status"] })}
              >
                <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interesse_recebido">Interesse recebido</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                  <SelectItem value="selecionado">Selecionado</SelectItem>
                  <SelectItem value="nao_selecionado">Não selecionado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CARTEIRA_DETAIL_TABS = ["visao", "pulso", "documentos", "analise", "demandas", "acessos"] as const;
type CarteiraDetailTab = (typeof CARTEIRA_DETAIL_TABS)[number];

function carteiraDetailTabFromSearch(search: string): CarteiraDetailTab {
  const requestedTab = new URLSearchParams(search).get("tab");
  return CARTEIRA_DETAIL_TABS.includes(requestedTab as CarteiraDetailTab)
    ? requestedTab as CarteiraDetailTab
    : "visao";
}

function DetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const isPlatformAdmin = ["admin", "superadmin"].includes(String(user?.role || "").toLowerCase());
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [activeDetailTab, setActiveDetailTab] = useState<CarteiraDetailTab>(() =>
    carteiraDetailTabFromSearch(window.location.search),
  );
  const [editOpen, setEditOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [originOpen, setOriginOpen] = useState(false);
  const [originForm, setOriginForm] = useState({ nome_bia: "", valor_origem: "", ciente_divida: false, papeis: {} as Record<string, "guardiao" | "multiplicador"> });
  const [transferIdentifier, setTransferIdentifier] = useState("");
  const [pulseForm, setPulseForm] = useState({ ocupacao: "", receita: "", despesa: "", acontecimento: "", objetivo: "", data_referencia: new Date().toISOString().slice(0, 10) });
  const [pulsePreview, setPulsePreview] = useState<any | null>(null);
  const [importedLaunches, setImportedLaunches] = useState<any[]>([]);
  const [financingFile, setFinancingFile] = useState<File | null>(null);
  const [financingPreview, setFinancingPreview] = useState<{ preview_id: string; arquivo: string; parcelas: any[] } | null>(null);
  const [documentForm, setDocumentForm] = useState({
    file: null as File | null,
    nome: "",
    tipo: "Registro",
    emissao: "",
    validade: "",
    observacao: "",
    origem: "declarada",
    status_validacao: "declarado",
    dados_extraidos: {} as Record<string, unknown>,
  });
  const [alternativeForm, setAlternativeForm] = useState({ capacidade_investimento: "", prazo: "12 meses", preferencia: "equilibrio" });
  const [demandOpen, setDemandOpen] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState<CarteiraAlternativa | null>(null);
  const [demandForm, setDemandForm] = useState({
    titulo: "",
    escopo: "",
    tipo_demanda: "servico_fornecimento" as "venda" | "locacao" | "servico_fornecimento",
    urgencia: "normal",
    ajuda: "ainda_nao_sei",
    especialidades: "",
    responsavel_user_id: "",
    modalidade_distribuicao: "pulso" as "direcionada" | "pulso",
    destinatarios: [] as string[],
    publicar: false,
    fluxo_disparo: "gradual" as "imediato" | "gradual",
    validade_dias: "60",
  });
  const [demandProfessionalSearch, setDemandProfessionalSearch] = useState("");
  const [editingDemand, setEditingDemand] = useState<CarteiraDemanda | null>(null);
  const [closingDemand, setClosingDemand] = useState<CarteiraDemanda | null>(null);
  const [demandEditForm, setDemandEditForm] = useState({ titulo: "", escopo: "", resumo_publico: "", urgencia: "normal", especialidades: "", responsavel_user_id: "", status: "aberta", expira_em: "", fluxo_disparo: "imediato" as "imediato" | "gradual" });
  const [opportunityDemand, setOpportunityDemand] = useState<CarteiraDemanda | null>(null);
  const [opportunityConsent, setOpportunityConsent] = useState(false);
  const [shareForm, setShareForm] = useState({ identificador: "", nivel: "leitura" as AccessLevel });
  const [demandNextSteps, setDemandNextSteps] = useState<Record<string, string>>({});
  const [demandProposals, setDemandProposals] = useState<Record<string, string>>({});

  const detailQuery = useQuery<CarteiraImovel>({ queryKey: ["/api/carteira/imoveis", id] });
  const originPreviewQuery = useQuery<any>({
    queryKey: ["/api/carteira/imoveis", id, "origem-bia", "preview"],
    enabled: originOpen,
    queryFn: async () => (await apiRequest("GET", `/api/carteira/imoveis/${id}/origem-bia/preview`)).json(),
  });
  useEffect(() => {
    const preview = originPreviewQuery.data;
    if (!originOpen || !preview) return;
    setOriginForm((current) => ({
      ...current,
      nome_bia: current.nome_bia || `BIA ${preview.imovel?.nome || "Imóvel"}`,
      valor_origem: current.valor_origem || String(preview.valor_origem_sugerido || ""),
      papeis: Object.keys(current.papeis).length ? current.papeis : Object.fromEntries((preview.socios || []).map((item: ImovelSocio) => [String(item.id), "guardiao"])),
    }));
  }, [originOpen, originPreviewQuery.data]);
  const launchesQuery = useQuery<CarteiraLancamento[]>({
    queryKey: ["/api/carteira/lancamentos", id],
    queryFn: async () => (await apiRequest("GET", `/api/carteira/lancamentos?imovel_id=${encodeURIComponent(id)}`)).json(),
  });
  const docsQuery = useQuery<CarteiraDocumento[]>({ queryKey: ["/api/carteira/imoveis", id, "documentos"] });
  const alertsQuery = useQuery<CarteiraAlerta[]>({ queryKey: ["/api/carteira/imoveis", id, "alertas"] });
  const eventsQuery = useQuery<CarteiraEvento[]>({ queryKey: ["/api/carteira/imoveis", id, "eventos"] });
  const alternativesQuery = useQuery<CarteiraAlternativasResult | null>({ queryKey: ["/api/carteira/imoveis", id, "alternativas"] });
  const demandsQuery = useQuery<CarteiraDemanda[]>({ queryKey: ["/api/carteira/imoveis", id, "demandas"] });
  const demandRecommendationsQuery = useQuery<{ recomendacoes: DemandProfessionalRecommendation[] }>({
    queryKey: ["/api/carteira/imoveis", id, "profissionais-recomendados", demandForm.tipo_demanda, demandForm.especialidades, demandProfessionalSearch],
    enabled: demandOpen && demandForm.modalidade_distribuicao === "direcionada",
    queryFn: async () => (await apiRequest(
      "GET",
      `/api/carteira/imoveis/${id}/profissionais-recomendados?tipo_demanda=${encodeURIComponent(demandForm.tipo_demanda)}&especialidades=${encodeURIComponent(demandForm.especialidades)}&q=${encodeURIComponent(demandProfessionalSearch)}`,
    )).json(),
  });
  const canManage = canAccess(detailQuery.data?.access_level, "administracao");
  const canCollaborate = canAccess(detailQuery.data?.access_level, "colaboracao");
  const isOwner = detailQuery.data?.is_owner === true;
  const canDelete = detailQuery.data?.can_delete ?? (isOwner || isPlatformAdmin);
  const accessQuery = useQuery<AccessResponse>({
    queryKey: ["/api/carteira/imoveis", id, "acessos"],
    enabled: canManage,
  });
  const imovel = detailQuery.data;
  const diagnostic = imovel?.diagnostico;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextTab = carteiraDetailTabFromSearch(window.location.search);

    setActiveDetailTab((currentTab) => currentTab === nextTab ? currentTab : nextTab);

    if (params.get("tab") !== nextTab) {
      params.set("tab", nextTab);
      navigate(`${window.location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [location, navigate]);

  const updateDetailTab = (value: string) => {
    if (!CARTEIRA_DETAIL_TABS.includes(value as CarteiraDetailTab)) return;

    const nextTab = value as CarteiraDetailTab;
    const params = new URLSearchParams(window.location.search);
    params.set("tab", nextTab);
    setActiveDetailTab(nextTab);
    navigate(`${window.location.pathname}?${params.toString()}`);
  };

  const marketQuery = useQuery<MarketM2Analysis>({
    queryKey: ["/api/ai/preco-m2", "carteira", id, imovel?.valor_atual, imovel?.area_m2, imovel?.bairro, imovel?.cidade],
    enabled: Boolean(imovel && parseNumber(imovel.valor_atual) > 0 && parseNumber(imovel.area_m2) > 0 && (imovel.bairro || imovel.cidade)),
    staleTime: 10 * 60 * 1000,
    queryFn: async () => (await apiRequest("POST", "/api/ai/preco-m2", {
      origem: "carteira",
      nome: imovel?.nome,
      tipo: imovel?.tipo,
      valor: parseNumber(imovel?.valor_atual),
      area_m2: parseNumber(imovel?.area_m2),
      moeda: imovel?.moeda,
      cep: imovel?.cep,
      endereco: imovel?.endereco,
      bairro: imovel?.bairro,
      cidade: imovel?.cidade,
      estado: imovel?.estado,
      pais: imovel?.pais,
    })).json(),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/carteira/resumo"] });
    queryClient.invalidateQueries({ queryKey: ["/api/carteira/lancamentos", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "eventos"] });
    queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "alertas"] });
  }

  const editMutation = useMutation({
    mutationFn: async (payload: Omit<CarteiraImovel, "id">) => (await apiRequest("PATCH", `/api/carteira/imoveis/${id}`, payload)).json(),
    onSuccess: () => { setEditOpen(false); invalidateAll(); toast({ title: "Imóvel atualizado" }); },
    onError: (error: any) => toast({ title: "Erro ao atualizar", description: error?.message, variant: "destructive" }),
  });
  const originMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/carteira/imoveis/${id}/origem-bia`, originForm)).json(),
    onSuccess: (data: any) => {
      setOriginOpen(false);
      invalidateAll();
      toast({ title: data.status === "aguardando_aprovacao" ? "Solicitação enviada para aprovação" : "Convites de MOU enviados", description: "O MAP inicial será ativado uma única vez após todos os aceites." });
    },
    onError: (error: any) => toast({ title: "Não foi possível originar a BIA", description: error?.message, variant: "destructive" }),
  });
  const cancelOriginMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/carteira/imoveis/${id}/origem-bia/cancelar`, {}),
    onSuccess: () => { invalidateAll(); toast({ title: "Solicitação de origem cancelada" }); },
    onError: (error: any) => toast({ title: "Não foi possível cancelar", description: error?.message, variant: "destructive" }),
  });
  const deletePropertyMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/carteira/imoveis/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/carteira/imoveis", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/resumo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis"] });
      setDeleteConfirm(false);
      toast({ title: "Imóvel excluído da Carteira" });
      navigate("/?tab=carteira&view=imoveis");
    },
    onError: (error: any) => toast({ title: "Não foi possível excluir o imóvel", description: error?.message, variant: "destructive" }),
  });
  const deleteLaunchMutation = useMutation({
    mutationFn: (launchId: string) => apiRequest("DELETE", `/api/carteira/lancamentos/${launchId}`),
    onSuccess: invalidateAll,
  });
  const previewMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/carteira/imoveis/${id}/pulso/preview`, pulseForm)).json(),
    onSuccess: (data: any) => setPulsePreview({ ...data.preview, lancamentos: [...(data.preview?.lancamentos || []), ...importedLaunches] }),
    onError: (error: any) => toast({ title: "Não foi possível gerar a prévia", description: error?.message, variant: "destructive" }),
  });
  const confirmPulseMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/carteira/imoveis/${id}/pulsos`, { preview: pulsePreview })).json(),
    onSuccess: () => {
      setPulsePreview(null);
      setImportedLaunches([]);
      setPulseForm({ ocupacao: "", receita: "", despesa: "", acontecimento: "", objetivo: "", data_referencia: new Date().toISOString().slice(0, 10) });
      invalidateAll();
      toast({ title: "Pulso Patrimonial registrado" });
    },
    onError: (error: any) => toast({ title: "Erro ao registrar o Pulso", description: error?.message, variant: "destructive" }),
  });
  const documentMutation = useMutation({
    mutationFn: async () => {
      if (!documentForm.file) throw new Error("Selecione um arquivo.");
      const formData = new FormData();
      formData.append("files", documentForm.file);
      const upload = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
      const uploadData = await upload.json().catch(() => ({}));
      if (!upload.ok || !uploadData.fileIds?.[0]) throw new Error(uploadData.error || "Não foi possível enviar o arquivo.");
      return (await apiRequest("POST", `/api/carteira/imoveis/${id}/documentos`, {
        file_id: uploadData.fileIds[0],
        nome: documentForm.nome || documentForm.file.name,
        tipo: documentForm.tipo,
        emissao: documentForm.emissao || null,
        validade: documentForm.validade || null,
        origem: documentForm.origem,
        status_validacao: documentForm.status_validacao,
        dados_extraidos: documentForm.dados_extraidos,
        observacao: documentForm.observacao || null,
      })).json();
    },
    onSuccess: () => {
      setDocumentForm({ file: null, nome: "", tipo: "Registro", emissao: "", validade: "", observacao: "", origem: "declarada", status_validacao: "declarado", dados_extraidos: {} });
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "documentos"] });
      invalidateAll();
      toast({ title: "Documento organizado na Carteira" });
    },
    onError: (error: any) => toast({ title: "Erro ao adicionar documento", description: error?.message, variant: "destructive" }),
  });
  const documentPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!documentForm.file) throw new Error("Selecione um arquivo.");
      const body = new FormData();
      body.append("file", documentForm.file);
      const response = await fetch(`/api/carteira/imoveis/${id}/documentos/preview`, {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível analisar o documento.");
      return data.preview;
    },
    onSuccess: (preview: any) => {
      setDocumentForm((current) => ({
        ...current,
        nome: preview.nome || current.nome,
        tipo: preview.tipo || current.tipo,
        emissao: preview.emissao || "",
        validade: preview.validade || "",
        observacao: preview.observacao || "",
        origem: "extraida",
        status_validacao: "extraido",
        dados_extraidos: preview.dados_extraidos || {},
      }));
      toast({ title: "Prévia preparada", description: "Revise os dados extraídos antes de adicionar o documento." });
    },
    onError: (error: any) => toast({ title: "Erro ao analisar documento", description: error?.message, variant: "destructive" }),
  });
  const financingPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!financingFile) throw new Error("Selecione uma planilha ou PDF do banco.");
      const body = new FormData();
      body.append("file", financingFile);
      const response = await fetch(`/api/carteira/imoveis/${id}/financiamento/preview`, { method: "POST", credentials: "include", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível extrair as parcelas.");
      return data;
    },
    onSuccess: setFinancingPreview,
    onError: (error: any) => toast({ title: "Erro ao importar financiamento", description: error?.message, variant: "destructive" }),
  });
  const financingConfirmMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/carteira/imoveis/${id}/financiamento/${financingPreview!.preview_id}/confirmar`, { parcelas: financingPreview!.parcelas }),
    onSuccess: () => { setFinancingFile(null); setFinancingPreview(null); queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "documentos"] }); invalidateAll(); toast({ title: "Financiamento importado" }); },
    onError: (error: any) => toast({ title: "Não foi possível confirmar o financiamento", description: error?.message, variant: "destructive" }),
  });
  const confirmMarketMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/carteira/imoveis/${id}/avaliacao/confirmar`, {
      valor_atual: Number(marketQuery.data?.referencia_m2_media || 0) * parseNumber(imovel?.area_m2),
      data_base: new Date().toISOString().slice(0, 10),
      fontes: marketQuery.data?.fontes || [],
      amostra: marketQuery.data?.quantidade_comparaveis || 0,
      regiao: [imovel?.bairro, imovel?.cidade, imovel?.estado].filter(Boolean).join(", "),
      confianca: (marketQuery.data?.quantidade_comparaveis || 0) >= 5 ? "alta" : "moderada",
    }),
    onSuccess: () => { invalidateAll(); toast({ title: "Valor de mercado confirmado", description: "O histórico e a data-base foram preservados." }); },
    onError: (error: any) => toast({ title: "Não foi possível confirmar o valor", description: error?.message, variant: "destructive" }),
  });
  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => apiRequest("DELETE", `/api/carteira/imoveis/${id}/documentos/${documentId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "documentos"] }); invalidateAll(); },
  });
  const alternativesMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/carteira/imoveis/${id}/alternativas`, alternativeForm)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "alternativas"] }),
    onError: (error: any) => toast({ title: "Erro ao comparar alternativas", description: error?.message, variant: "destructive" }),
  });
  const demandMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/carteira/imoveis/${id}/demandas`, {
      titulo: demandForm.titulo,
      escopo: demandForm.escopo,
      urgencia: demandForm.urgencia,
      tipo_demanda: demandForm.tipo_demanda,
      modalidade_distribuicao: demandForm.modalidade_distribuicao,
      destinatarios: demandForm.destinatarios,
      responsavel_user_id: demandForm.responsavel_user_id || null,
      publicar: demandForm.publicar,
      consentimento_publicacao: demandForm.publicar,
      fluxo_disparo: demandForm.modalidade_distribuicao === "pulso" ? "gradual" : "imediato",
      validade_dias: Math.max(1, Number(demandForm.validade_dias || 60)),
      alternativa: selectedAlternative?.tipo || null,
      especialidades: demandForm.especialidades.split(",").map((item) => item.trim()).filter(Boolean).length
        ? demandForm.especialidades.split(",").map((item) => item.trim()).filter(Boolean)
        : demandForm.ajuda === "ainda_nao_sei" ? [] : [demandForm.ajuda],
    })).json(),
    onSuccess: () => {
      setDemandOpen(false);
      setDemandProfessionalSearch("");
      setDemandForm({ titulo: "", escopo: "", tipo_demanda: "servico_fornecimento", urgencia: "normal", ajuda: "ainda_nao_sei", especialidades: "", responsavel_user_id: "", modalidade_distribuicao: "pulso", destinatarios: [], publicar: false, fluxo_disparo: "gradual", validade_dias: "60" });
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "demandas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine/demandas"] });
      invalidateAll();
      toast({ title: demandForm.publicar ? "Demanda criada e publicada" : "Demanda criada" });
    },
    onError: (error: any) => toast({ title: "Erro ao criar demanda", description: error?.message, variant: "destructive" }),
  });
  const convertOpportunityMutation = useMutation({
    mutationFn: async (demandId: string) => (await apiRequest("POST", `/api/carteira/imoveis/${id}/demandas/${demandId}/converter-oportunidade`, {
      autorizacao_compartilhamento: opportunityConsent,
    })).json(),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "demandas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
      setOpportunityDemand(null);
      setOpportunityConsent(false);
      toast({ title: "Oportunidade identificada", description: "Ela agora pode seguir para análise preliminar." });
      if (data.oportunidade_codigo || data.oportunidade?.codigo) {
        navigate(`/area-aliancas/oportunidades/${data.oportunidade_codigo || data.oportunidade.codigo}`);
      }
    },
    onError: (error: any) => toast({ title: "Erro ao criar oportunidade", description: error?.message, variant: "destructive" }),
  });
  const demandPublicationMutation = useMutation({
    mutationFn: async ({ demandId, action }: { demandId: string; action: "publicar" | "pausar" | "retirar" }) =>
      (await apiRequest("POST", `/api/carteira/imoveis/${id}/demandas/${demandId}/publicacao`, {
        action,
        consentimento_publicacao: action === "publicar",
      })).json(),
    onSuccess: () => {
      setEditingDemand(null);
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "demandas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine/demandas"] });
      toast({ title: "Publicação da demanda atualizada" });
    },
    onError: (error: any) => toast({ title: "Erro na publicação", description: error?.message, variant: "destructive" }),
  });
  const updateDemandMutation = useMutation({
    mutationFn: async ({ demandId, patch }: { demandId: string; patch: Record<string, unknown> }) =>
      (await apiRequest("PATCH", `/api/carteira/imoveis/${id}/demandas/${demandId}`, patch)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "demandas"] });
      invalidateAll();
      toast({ title: "Demanda atualizada" });
    },
    onError: (error: any) => toast({ title: "Erro ao atualizar a demanda", description: error?.message, variant: "destructive" }),
  });
  const shareMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/carteira/imoveis/${id}/acessos`, shareForm)).json(),
    onSuccess: () => {
      setShareForm({ identificador: "", nivel: "leitura" });
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "acessos"] });
      invalidateAll();
    },
    onError: (error: any) => toast({ title: "Erro ao compartilhar", description: error?.message, variant: "destructive" }),
  });
  const revokeMutation = useMutation({
    mutationFn: (accessId: string) => apiRequest("DELETE", `/api/carteira/imoveis/${id}/acessos/${accessId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "acessos"] }),
  });
  const transferMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/carteira/imoveis/${id}/transferir-proprietario`, {
      identificador: transferIdentifier,
    })).json(),
    onSuccess: () => {
      setTransferOpen(false);
      setTransferIdentifier("");
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "acessos"] });
      invalidateAll();
      toast({ title: "Administração principal transferida", description: "Você permaneceu com nível de administração." });
    },
    onError: (error: any) => toast({ title: "Erro ao transferir", description: error?.message, variant: "destructive" }),
  });
  const publishMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/land-bank-assets", {
      category: /(terreno|lote|gleba|área|area)/i.test(String(imovel?.tipo || "")) ? "land-bank" : "built-asset-bank",
      origem: "carteira",
      origem_tipo: "ativo_proprio",
      origem_carteira_id: id,
      visibilidade: "publicada",
      autorizacao_compartilhamento: true,
      qualificacao: imovel?.nome,
      tipo: imovel?.tipo,
      descricao: imovel?.descricao,
      area_m2: imovel?.area_m2,
      valor: imovel?.valor_atual,
      moeda: imovel?.moeda,
      cep: imovel?.cep,
      endereco: imovel?.endereco,
      numero: imovel?.numero,
      bairro: imovel?.bairro,
      cidade: imovel?.cidade,
      estado: imovel?.estado,
      pais: imovel?.pais,
      foto: imovel?.foto,
    })).json(),
    onSuccess: () => {
      setPublishConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
      toast({ title: "Imóvel enviado para análise de oportunidades" });
    },
    onError: (error: any) => toast({ title: "Erro ao publicar", description: error?.message, variant: "destructive" }),
  });

  async function importPulseFile(file?: File, audio = false) {
    if (!file) return;
    const body = new FormData();
    body.append(audio ? "audio" : "file", file);
    const response = await fetch(audio ? "/api/carteira/transcrever-audio" : "/api/carteira/importar-anexos", {
      method: "POST",
      credentials: "include",
      body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast({ title: "Não foi possível analisar o arquivo", description: data.error, variant: "destructive" });
    const launches = Array.isArray(data.lancamentos) ? data.lancamentos : [];
    setImportedLaunches((current) => [...current, ...launches]);
    if (data.texto) setPulseForm((current) => ({ ...current, acontecimento: [current.acontecimento, data.texto].filter(Boolean).join("\n") }));
    toast({ title: "Prévia da IA preparada", description: `${launches.length} lançamento(s) sugerido(s).` });
  }

  async function attachDemandDocument(demand: CarteiraDemanda, file?: File) {
    if (!file) return;
    const body = new FormData();
    body.append("files", file);
    const response = await fetch("/api/upload", { method: "POST", credentials: "include", body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.fileIds?.[0]) {
      toast({ title: "Erro ao anexar documento", description: data.error || "O arquivo não pôde ser enviado.", variant: "destructive" });
      return;
    }
    updateDemandMutation.mutate({
      demandId: demand.id,
      patch: {
        documentos: [
          ...(demand.documentos || []),
          { file_id: data.fileIds[0], nome: file.name, criado_em: new Date().toISOString() },
        ],
      },
    });
  }

  if (detailQuery.isLoading) return <div className="p-8"><div className="h-72 animate-pulse rounded-md bg-muted" /></div>;
  if (!imovel) return <div className="p-8 text-center text-muted-foreground">Imóvel não encontrado ou sem permissão de acesso.</div>;

  const alternatives = alternativesQuery.data?.alternativas || [];
  const photoUrl = carteiraPhotoUrl(imovel.foto);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="px-0 text-muted-foreground" onClick={() => navigate("/?tab=carteira")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar para a Carteira
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          {canManage && <Button variant="outline" title="Editar imóvel" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>}
          {imovel.is_owner && !imovel.bia_origem && <Button variant="outline" onClick={() => setOriginOpen(true)}><Link2 className="mr-2 h-4 w-4" />Originar BIA</Button>}
          {imovel.bia_origem?.bia_id && <Button variant="outline" onClick={() => navigate(`/bias/${imovel.bia_origem?.bia_id}`)}><Link2 className="mr-2 h-4 w-4" />Abrir BIA vinculada</Button>}
          {imovel.is_owner && imovel.bia_origem && imovel.bia_origem.status !== "ativa" && <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" disabled={cancelOriginMutation.isPending} onClick={() => window.confirm("Cancelar a solicitação e os convites de MOU desta BIA?") && cancelOriginMutation.mutate()}>{cancelOriginMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Cancelar origem</Button>}
          {canManage && <Button variant="outline" onClick={() => setPublishConfirm(true)}><Sparkles className="mr-2 h-4 w-4" />Explorar oportunidades</Button>}
          {canDelete && (
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          )}
        </div>
      </div>

      <section className="border-y bg-slate-50 py-6">
        <div className="px-4">
          <div className={photoUrl ? "grid items-start gap-5 md:grid-cols-[180px_minmax(0,1fr)]" : ""}>
            {photoUrl && (
              <img
                src={photoUrl}
                alt={`Foto de ${imovel.nome}`}
                className="aspect-[4/3] w-full rounded-md border bg-white object-cover md:w-[180px]"
              />
            )}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{imovel.nome}</h1>
                  <ModuleInfo title="Imóvel da Carteira" description="Reúne patrimônio, financiamento, documentos, receitas, despesas, avaliação, Pulso e demandas deste imóvel." />
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{diagnostic?.situacao || "Preliminar"}</Badge>
                  <Badge variant="outline">{imovel.access_level}</Badge>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {[imovel.endereco, imovel.numero, imovel.bairro, imovel.cidade, imovel.estado, imovel.pais].filter(Boolean).join(", ") || "Localização ainda não informada"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{imovel.tipo || "Tipo pendente"}</span><span>•</span>
                  <span>{parseNumber(imovel.area_m2).toLocaleString("pt-BR")} m²</span><span>•</span>
                  <span>Atualizado em {shortDate(imovel.ultima_atualizacao)}</span>
                </div>
              </div>
              {pulseDue(imovel) && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <CalendarClock className="h-4 w-4" />Pulso Patrimonial pendente
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Valor atual estimado" value={money(imovel.valor_atual, imovel.moeda)} icon={Home} helper={`Data-base: ${shortDate(imovel.valor_data_base)} · origem ${imovel.valor_origem || "declarada"}`} />
        <Metric label="Receitas registradas" value={money(diagnostic?.indicadores?.receitas || 0, imovel.moeda)} icon={TrendingUp} tone="text-emerald-700" />
        <Metric label="Despesas registradas" value={money(diagnostic?.indicadores?.despesas || 0, imovel.moeda)} icon={TrendingDown} tone="text-red-700" />
        <Metric label="Resultado líquido" value={money(diagnostic?.indicadores?.resultado_liquido || 0, imovel.moeda)} icon={Wallet} tone={metricTone(diagnostic?.indicadores?.resultado_liquido || 0)} />
      </div>

      <Tabs value={activeDetailTab} onValueChange={updateDetailTab} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-muted/40 p-1 md:grid-cols-6">
          <TabsTrigger value="visao"><Home className="mr-2 h-4 w-4" />Visão</TabsTrigger>
          <TabsTrigger value="pulso"><RefreshCw className="mr-2 h-4 w-4" />Pulso</TabsTrigger>
          <TabsTrigger value="documentos"><FolderOpen className="mr-2 h-4 w-4" />Documentos</TabsTrigger>
          <TabsTrigger value="analise"><BarChart3 className="mr-2 h-4 w-4" />Análise</TabsTrigger>
          <TabsTrigger value="demandas"><Target className="mr-2 h-4 w-4" />Demandas</TabsTrigger>
          <TabsTrigger value="acessos"><Users className="mr-2 h-4 w-4" />Acessos</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-6">
          <section>
            <div className="grid gap-3 md:grid-cols-5">
              {[
                ["Situação", diagnostic?.situacao || "Preliminar", ShieldCheck],
                ["Oportunidade", diagnostic?.oportunidade || "Complete os dados", Lightbulb],
                ["Risco", diagnostic?.risco || "Ainda não avaliado", AlertTriangle],
                ["Recomendação", diagnostic?.recomendacao || "Realize o Pulso", Sparkles],
                ["Próxima ação", diagnostic?.proxima_acao || "Atualizar imóvel", ChevronRight],
              ].map(([label, value, Icon]: any) => (
                <div key={label} className="min-h-32 border-y px-3 py-4">
                  <Icon className="h-4 w-4 text-blue-600" />
                  <p className="mt-3 text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-semibold">Sócios e MAP de origem</h2><p className="text-sm text-muted-foreground">Participações econômicas confirmadas ou aguardando aceite.</p></div>
              <Badge variant="outline">{(imovel.socios || []).reduce((sum, item) => sum + Number(item.map_percentual || 0), 0).toLocaleString("pt-BR")}%</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(imovel.socios || []).map((socio) => (
                <div key={socio.id || socio.email} className="rounded-md border bg-white p-3">
                  <div className="flex items-start justify-between gap-2"><p className="font-medium">{socio.nome}</p><Badge variant={socio.status === "aceito" ? "default" : "outline"}>{socio.status || "pendente"}</Badge></div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{socio.email}</p>
                  <p className="mt-3 text-lg font-bold text-blue-700">{Number(socio.map_percentual).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% MAP</p>
                </div>
              ))}
            </div>
            {!(imovel.socios || []).length && <p className="border-y py-6 text-center text-sm text-muted-foreground">Revise a composição societária na edição do imóvel.</p>}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="font-semibold">Alertas</h2><p className="text-sm text-muted-foreground">Pendências e mudanças que merecem atenção.</p></div>
            </div>
            {(alertsQuery.data || []).filter((item) => !["resolvido", "ignorado"].includes(item.status)).length === 0 ? (
              <div className="border-y py-8 text-center text-sm text-muted-foreground">Nenhum alerta aberto.</div>
            ) : (
              <div className="divide-y border-y">
                {(alertsQuery.data || []).filter((item) => !["resolvido", "ignorado"].includes(item.status)).map((alert) => (
                  <div key={alert.id} className="flex flex-wrap items-start gap-3 py-3">
                    <AlertTriangle className={`mt-0.5 h-4 w-4 ${alert.severidade === "alta" || alert.severidade === "critica" ? "text-red-600" : "text-amber-600"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{alert.titulo}</p>
                      {alert.descricao && <p className="mt-1 text-sm text-muted-foreground">{alert.descricao}</p>}
                      {alert.acao_sugerida && <p className="mt-1 text-xs text-blue-700">Ação sugerida: {alert.acao_sugerida}</p>}
                      {alert.acao_registrada && <p className="mt-1 text-xs font-medium text-emerald-700">Ação registrada: {alert.acao_registrada}</p>}
                    </div>
                    <Badge variant="outline">{alert.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="font-semibold">Receitas e despesas</h2><p className="text-sm text-muted-foreground">Histórico financeiro exclusivo deste imóvel.</p></div>
              {canCollaborate && <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setLaunchOpen(true)}><Plus className="mr-2 h-4 w-4" />Lançamento</Button>}
            </div>
            {(launchesQuery.data || []).length === 0 ? (
              <div className="border-y py-10 text-center text-sm text-muted-foreground">Nenhum lançamento registrado.</div>
            ) : (
              <div className="divide-y border-y">
                {(launchesQuery.data || []).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-3">
                    <Badge className={item.tipo === "receita" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>{item.tipo}</Badge>
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.descricao}</p><p className="text-xs text-muted-foreground">{item.categoria} · {shortDate(item.data)} · {item.status || "pendente"}</p></div>
                    <p className={`font-bold tabular-nums ${item.tipo === "receita" ? "text-emerald-700" : "text-red-700"}`}>{item.tipo === "receita" ? "+" : "-"}{money(item.valor, imovel.moeda)}</p>
                    {canCollaborate && <Button size="icon" variant="ghost" onClick={() => deleteLaunchMutation.mutate(item.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3"><h2 className="font-semibold">Linha do tempo</h2><p className="text-sm text-muted-foreground">Origem, data e histórico das mudanças importantes.</p></div>
            <div className="divide-y border-y">
              {(eventsQuery.data || []).slice(0, 12).map((event) => (
                <div key={event.id} className="flex gap-3 py-3">
                  <History className="mt-0.5 h-4 w-4 text-blue-600" />
                  <div className="flex-1"><p className="text-sm font-medium">{event.titulo || event.tipo}</p><p className="text-xs text-muted-foreground">{shortDate(event.criado_em)} · origem {event.origem}</p></div>
                </div>
              ))}
              {!eventsQuery.data?.length && <div className="py-8 text-center text-sm text-muted-foreground">O histórico começará na próxima atualização.</div>}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="pulso" className="space-y-5">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold">Pulso Patrimonial</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cinco respostas curtas mantêm o imóvel atualizado sem refazer todo o cadastro.</p>
          </div>
          {!canCollaborate ? (
            <div className="border-y py-10 text-center text-sm text-muted-foreground">Seu acesso é somente para leitura.</div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                <div className="space-y-2"><Label>1. O imóvel continua com o mesmo uso ou ocupação?</Label>
                  <Select value={pulseForm.ocupacao} onValueChange={(value) => setPulseForm({ ...pulseForm, ocupacao: value })}><SelectTrigger><SelectValue placeholder={imovel.ocupacao || "Selecione"} /></SelectTrigger><SelectContent><SelectItem value="ocupado">Ocupado</SelectItem><SelectItem value="parcial">Parcialmente ocupado</SelectItem><SelectItem value="vazio">Vazio</SelectItem><SelectItem value="uso_proprio">Uso próprio</SelectItem><SelectItem value="desconhecido">Desconhecido</SelectItem></SelectContent></Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>2. Quanto gerou de receita?</Label><Input inputMode="decimal" value={pulseForm.receita} onChange={(event) => setPulseForm({ ...pulseForm, receita: event.target.value })} placeholder="R$ 0,00" /></div>
                  <div className="space-y-2"><Label>3. Quanto gerou de despesas?</Label><Input inputMode="decimal" value={pulseForm.despesa} onChange={(event) => setPulseForm({ ...pulseForm, despesa: event.target.value })} placeholder="R$ 0,00" /></div>
                </div>
                <div className="space-y-2"><Label>4. Ocorreu reforma, problema, proposta ou mudança relevante?</Label><Textarea rows={5} value={pulseForm.acontecimento} onChange={(event) => setPulseForm({ ...pulseForm, acontecimento: event.target.value })} placeholder="Descreva com suas palavras..." /></div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild><label className="cursor-pointer"><Paperclip className="mr-2 h-4 w-4" />Arquivo ou imagem<input type="file" className="hidden" accept=".pdf,.csv,.txt,.xlsx,.xls,.png,.jpg,.jpeg,.webp" onChange={(event) => void importPulseFile(event.target.files?.[0])} /></label></Button>
                  <Button variant="outline" asChild><label className="cursor-pointer"><Mic className="mr-2 h-4 w-4" />Áudio<input type="file" className="hidden" accept="audio/*" onChange={(event) => void importPulseFile(event.target.files?.[0], true)} /></label></Button>
                  {importedLaunches.length > 0 && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{importedLaunches.length} sugestão(ões) da IA</Badge>}
                </div>
                <div className="space-y-2"><Label>5. Seu objetivo continua o mesmo?</Label>
                  <Select value={pulseForm.objetivo} onValueChange={(value) => setPulseForm({ ...pulseForm, objetivo: value })}><SelectTrigger><SelectValue placeholder={imovel.objetivo || "Selecione"} /></SelectTrigger><SelectContent><SelectItem value="renda">Gerar renda</SelectItem><SelectItem value="venda">Venda</SelectItem><SelectItem value="valorizacao">Valorização</SelectItem><SelectItem value="uso">Uso próprio</SelectItem><SelectItem value="reforma">Reforma</SelectItem><SelectItem value="construcao">Construção</SelectItem><SelectItem value="indefinido">Ainda não definido</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2"><Label>Período de referência</Label><Input type="date" value={pulseForm.data_referencia} onChange={(event) => setPulseForm({ ...pulseForm, data_referencia: event.target.value })} /></div>
                <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()}>{previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Gerar prévia</Button>
              </div>
              <aside className="border-l pl-5">
                <p className="font-semibold">Próxima atualização</p>
                <p className="mt-1 text-sm text-muted-foreground">{shortDate(imovel.proximo_pulso_em)} · frequência {imovel.frequencia_pulso || "mensal"}</p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">A IA apenas organiza o que foi informado. Nada é salvo ou substituído sem a sua confirmação.</p>
              </aside>
            </div>
          )}
          {pulsePreview && (
            <section className="border-y border-blue-200 bg-blue-50/40 py-5">
              <div className="px-4">
                <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-blue-600" /><h3 className="font-semibold">Prévia editável</h3></div>
                <p className="mt-2 text-sm text-muted-foreground">{pulsePreview.resumo}</p>
                <div className="mt-4 space-y-2">
                  {(pulsePreview.lancamentos || []).map((item: any, index: number) => (
                    <div key={index} className="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-[110px_1fr_140px]">
                      <Select value={item.tipo} onValueChange={(value) => setPulsePreview((current: any) => ({ ...current, lancamentos: current.lancamentos.map((entry: any, itemIndex: number) => itemIndex === index ? { ...entry, tipo: value } : entry) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent></Select>
                      <Input value={item.descricao} onChange={(event) => setPulsePreview((current: any) => ({ ...current, lancamentos: current.lancamentos.map((entry: any, itemIndex: number) => itemIndex === index ? { ...entry, descricao: event.target.value } : entry) }))} />
                      <Input inputMode="decimal" value={item.valor} onChange={(event) => setPulsePreview((current: any) => ({ ...current, lancamentos: current.lancamentos.map((entry: any, itemIndex: number) => itemIndex === index ? { ...entry, valor: parseNumber(event.target.value) } : entry) }))} />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setPulsePreview(null)}>Descartar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={confirmPulseMutation.isPending} onClick={() => confirmPulseMutation.mutate()}>{confirmPulseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar atualização</Button></div>
              </div>
            </section>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="space-y-6">
          <div><h2 className="text-lg font-semibold">Documentos do imóvel</h2><p className="mt-1 text-sm text-muted-foreground">Arquivos organizados por tipo, versão, data e origem.</p></div>
          {canCollaborate && (
            <section className="grid gap-4 border-y py-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  onChange={(event) => setDocumentForm({
                    ...documentForm,
                    file: event.target.files?.[0] || null,
                    nome: event.target.files?.[0]?.name || "",
                    origem: "declarada",
                    status_validacao: "declarado",
                    dados_extraidos: {},
                  })}
                />
              </div>
              <div className="space-y-2"><Label>Nome</Label><Input value={documentForm.nome} onChange={(event) => setDocumentForm({ ...documentForm, nome: event.target.value })} /></div>
              <div className="space-y-2"><Label>Tipo</Label><Select value={documentForm.tipo} onValueChange={(value) => setDocumentForm({ ...documentForm, tipo: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Registro", "IPTU / ITR", "Escritura", "Contrato de locação", "Laudo / inspeção", "Planta", "Fotos", "Orçamento", "Financiamento", "Planilha financeira", "Outro"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label>Emissão</Label><Input type="date" value={documentForm.emissao} onChange={(event) => setDocumentForm({ ...documentForm, emissao: event.target.value })} /></div><div className="space-y-2"><Label>Validade</Label><Input type="date" value={documentForm.validade} onChange={(event) => setDocumentForm({ ...documentForm, validade: event.target.value })} /></div></div>
              <div className="space-y-2 md:col-span-2"><Label>Observação</Label><Input value={documentForm.observacao} onChange={(event) => setDocumentForm({ ...documentForm, observacao: event.target.value })} /></div>
              <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                <Button variant="outline" disabled={!documentForm.file || documentPreviewMutation.isPending} onClick={() => documentPreviewMutation.mutate()}>
                  {documentPreviewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Analisar com IA
                </Button>
                <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={!documentForm.file || documentMutation.isPending} onClick={() => documentMutation.mutate()}>{documentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Adicionar documento</Button>
                {documentForm.status_validacao === "extraido" && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Prévia extraída · revise antes de salvar</Badge>}
              </div>
            </section>
          )}
          {canManage && <section className="space-y-3 rounded-md border border-blue-100 bg-blue-50/40 p-4">
            <div><h3 className="font-semibold">Importar parcelas do financiamento</h3><p className="text-sm text-muted-foreground">Envie XLS, XLSX, CSV ou PDF do banco. Revise a prévia antes de gravar lançamentos e saldo devedor.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input type="file" accept=".xls,.xlsx,.csv,.pdf" onChange={(event) => { setFinancingFile(event.target.files?.[0] || null); setFinancingPreview(null); }} />
              <Button variant="outline" disabled={!financingFile || financingPreviewMutation.isPending} onClick={() => financingPreviewMutation.mutate()}>{financingPreviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar prévia</Button>
            </div>
            {financingPreview && <div className="space-y-2">
              <p className="text-sm font-medium">{financingPreview.arquivo} · {financingPreview.parcelas.length} parcela(s)</p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">{financingPreview.parcelas.map((item, index) => <div key={index} className="grid gap-2 rounded-md border bg-white p-2 sm:grid-cols-[80px_1fr_130px_130px_40px]">
                <Input type="number" min="1" value={item.parcela} aria-label="Número da parcela" onChange={(event) => setFinancingPreview({ ...financingPreview, parcelas: financingPreview.parcelas.map((row, rowIndex) => rowIndex === index ? { ...row, parcela: Number(event.target.value) } : row) })} />
                <Input type="date" value={item.data_vencimento || item.data || ""} aria-label="Vencimento" onChange={(event) => setFinancingPreview({ ...financingPreview, parcelas: financingPreview.parcelas.map((row, rowIndex) => rowIndex === index ? { ...row, data_vencimento: event.target.value } : row) })} />
                <Input inputMode="decimal" value={item.valor} aria-label="Valor da parcela" onChange={(event) => setFinancingPreview({ ...financingPreview, parcelas: financingPreview.parcelas.map((row, rowIndex) => rowIndex === index ? { ...row, valor: parseNumber(event.target.value) } : row) })} />
                <Select value={item.status || "pendente"} onValueChange={(value) => setFinancingPreview({ ...financingPreview, parcelas: financingPreview.parcelas.map((row, rowIndex) => rowIndex === index ? { ...row, status: value } : row) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pago">Pago</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="agendado">Agendado</SelectItem><SelectItem value="vencido">Vencido</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent></Select>
                <Button size="icon" variant="ghost" aria-label="Remover parcela" onClick={() => setFinancingPreview({ ...financingPreview, parcelas: financingPreview.parcelas.filter((_, rowIndex) => rowIndex !== index) })}><Trash2 className="h-4 w-4" /></Button>
              </div>)}</div>
              <Button disabled={!financingPreview.parcelas.length || financingConfirmMutation.isPending} onClick={() => financingConfirmMutation.mutate()}>{financingConfirmMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar parcelas</Button>
            </div>}
          </section>}
          {(docsQuery.data || []).length === 0 ? (
            <div className="border-y py-12 text-center text-sm text-muted-foreground">Nenhum documento organizado.</div>
          ) : (
            <div className="divide-y border-y">
              {(docsQuery.data || []).map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.nome}</p><p className="text-xs text-muted-foreground">{doc.tipo === "Matrícula" ? "Registro" : doc.tipo} · versão {doc.versao} · origem {doc.origem}{doc.validade ? ` · válido até ${shortDate(doc.validade)}` : ""}</p></div>
                  <Badge variant="outline">{doc.status_validacao}</Badge>
                  {doc.file_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">Abrir</a>
                    </Button>
                  )}
                  {canManage && <Button variant="ghost" size="icon" onClick={() => deleteDocumentMutation.mutate(doc.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analise" className="space-y-7">
          <section>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Diagnóstico patrimonial</h2><p className="mt-1 text-sm text-muted-foreground">Regras objetivas, dados faltantes e confiança da conclusão.</p></div><Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Confiança {diagnostic?.confianca || "baixa"}</Badge></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="border-y py-4"><p className="text-xs text-muted-foreground">Cobertura</p><p className="mt-1 text-xl font-bold">{diagnostic?.cobertura?.percentual || 0}%</p><p className="text-xs text-muted-foreground">{diagnostic?.cobertura?.preenchidos || 0} de {diagnostic?.cobertura?.total || 7} grupos</p></div>
              <div className="border-y py-4 md:col-span-2"><p className="text-xs text-muted-foreground">Dados que podem alterar a conclusão</p><div className="mt-2 flex flex-wrap gap-2">{diagnostic?.dados_faltantes?.length ? diagnostic.dados_faltantes.map((item) => <Badge key={item} variant="outline">{item}</Badge>) : <span className="text-sm text-emerald-700">Nenhuma lacuna essencial identificada.</span>}</div></div>
            </div>
          </section>
          <section className="border-y border-blue-100 bg-slate-50 py-5">
            <div className="px-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" /><h3 className="font-semibold">IA de preço por m²</h3></div>
              {marketQuery.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Pesquisando imóveis comparáveis...</p> : marketQuery.data?.amostra_suficiente ? (
                <>
                  <p className="mt-3 text-sm text-blue-800">Baseado em {marketQuery.data.quantidade_comparaveis} imóveis comparáveis entre {marketQuery.data.area_min} e {marketQuery.data.area_max} m².</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="border-y py-3"><p className="text-xs text-muted-foreground">Informado</p><p className="font-bold">{money(marketQuery.data.preco_m2_informado, imovel.moeda)}/m²</p></div><div className="border-y py-3"><p className="text-xs text-muted-foreground">Referência média</p><p className="font-bold">{money(marketQuery.data.referencia_m2_media, imovel.moeda)}/m²</p></div><div className="border-y py-3"><p className="text-xs text-muted-foreground">Faixa</p><p className="font-bold">{money(marketQuery.data.referencia_m2_min, imovel.moeda)} – {money(marketQuery.data.referencia_m2_max, imovel.moeda)}</p></div></div>
                  {!!marketQuery.data.fontes?.length && <div className="mt-3 flex flex-wrap gap-2">{marketQuery.data.fontes.slice(0, 5).map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">Comparável {index + 1}</a>)}</div>}
                  {canManage && Number(marketQuery.data.referencia_m2_media || 0) > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-white p-3"><div><p className="text-xs text-muted-foreground">Valor sugerido para confirmação</p><p className="font-bold">{money(Number(marketQuery.data.referencia_m2_media) * parseNumber(imovel.area_m2), imovel.moeda)}</p></div><Button disabled={confirmMarketMutation.isPending} onClick={() => confirmMarketMutation.mutate()}>{confirmMarketMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar valor sugerido</Button></div>}
                </>
              ) : <p className="mt-3 text-sm text-muted-foreground">{marketQuery.data?.resumo || "Ainda não há comparáveis suficientes para exibir uma média."}</p>}
            </div>
          </section>
          <section>
            <div><h2 className="text-lg font-semibold">O que fazer com este imóvel?</h2><p className="mt-1 text-sm text-muted-foreground">Compare caminhos pela aderência ao seu objetivo, sem promessa de resultado.</p></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="space-y-2"><Label>Quanto pode investir?</Label><Input inputMode="decimal" value={alternativeForm.capacidade_investimento} onChange={(event) => setAlternativeForm({ ...alternativeForm, capacidade_investimento: event.target.value })} /></div>
              <div className="space-y-2"><Label>Em quanto tempo precisa de resultado?</Label><Input value={alternativeForm.prazo} onChange={(event) => setAlternativeForm({ ...alternativeForm, prazo: event.target.value })} /></div>
              <div className="space-y-2"><Label>Preferência</Label><Select value={alternativeForm.preferencia} onValueChange={(value) => setAlternativeForm({ ...alternativeForm, preferencia: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="renda">Renda recorrente</SelectItem><SelectItem value="liquidez">Liquidez pela venda</SelectItem><SelectItem value="equilibrio">Equilíbrio</SelectItem></SelectContent></Select></div>
            </div>
            {canCollaborate && <Button className="mt-4 bg-blue-600 text-white hover:bg-blue-700" disabled={alternativesMutation.isPending} onClick={() => alternativesMutation.mutate()}>{alternativesMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Comparar alternativas</Button>}
            {alternativesQuery.data?.resumo && <p className="mt-4 border-l-2 border-blue-500 pl-3 text-sm leading-relaxed text-muted-foreground">{alternativesQuery.data.resumo}</p>}
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {alternatives.map((item, index) => (
                <Card key={item.tipo} className={index === 0 ? "border-blue-300" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.titulo}</p><p className="mt-1 text-xs text-muted-foreground">{item.justificativa}</p></div><Badge className={index === 0 ? "bg-blue-600 text-white hover:bg-blue-600" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>{item.aderencia}%</Badge></div>
                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Capital:</span> {item.capital_necessario}</p><p><span className="text-muted-foreground">Prazo:</span> {item.prazo}</p><p className="sm:col-span-2"><span className="text-muted-foreground">Resultado:</span> {item.resultado_esperado}</p></div>
                    <div className="mt-3 flex flex-wrap gap-1">{item.validacoes.map((value) => <Badge key={value} variant="outline" className="text-[10px]">{value}</Badge>)}</div>
                    {canManage && <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSelectedAlternative(item); setDemandForm({ ...demandForm, titulo: `${item.titulo} — ${imovel.nome}`, escopo: item.justificativa }); setDemandOpen(true); }}>Transformar em demanda</Button>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="demandas" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Demandas da Carteira</h2><p className="mt-1 text-sm text-muted-foreground">Acompanhe responsáveis, estágio, documentos e resultado.</p></div>{canManage && <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { setSelectedAlternative(null); setDemandOpen(true); }}><Plus className="mr-2 h-4 w-4" />Nova demanda</Button>}</div>
          {(demandsQuery.data || []).length === 0 ? <div className="border-y py-12 text-center text-sm text-muted-foreground">Nenhuma demanda aberta para este imóvel.</div> : (
            <div className="divide-y border-y">
              {(demandsQuery.data || []).map((demand) => (
                <div key={demand.id} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <Target className="mt-0.5 h-5 w-5 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{demand.titulo}</p>
                        <Badge variant="outline">Demanda de serviço</Badge>
                        {demand.codigo && <Badge variant="outline" className="font-mono text-[10px]">{demand.codigo}</Badge>}
                        <Badge variant="outline" className={demand.visibilidade === "publicada" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                          {demand.visibilidade === "publicada" ? "Na Vitrine" : demand.visibilidade === "pausada" ? "Publicação pausada" : "Privada"}
                        </Badge>
                      </div>
                      {demand.escopo && <p className="mt-1 text-sm text-muted-foreground">{demand.escopo}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">Criada em {shortDate(demand.criado_em)} · urgência {demand.urgencia}</p>
                    </div>
                    {canManage ? (
                      <Select value={demand.status} onValueChange={(status) => updateDemandMutation.mutate({ demandId: demand.id, patch: { status } })}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rascunho">Rascunho</SelectItem>
                          <SelectItem value="aberta">Aberta</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="aguardando">Aguardando</SelectItem>
                          <SelectItem value="concluida">Concluída</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : <Badge variant="outline">{demand.status}</Badge>}
                    {canManage && !["concluida", "convertida", "encerrada_sem_acordo", "expirada", "cancelada", "arquivada"].includes(demand.status) && (
                      <Button variant="outline" onClick={() => {
                        setEditingDemand(demand);
                        setDemandEditForm({
                          titulo: demand.titulo || "",
                          escopo: demand.escopo || "",
                          resumo_publico: demand.resumo_publico || "",
                          urgencia: demand.urgencia || "normal",
                          especialidades: (demand.especialidades || []).join(", "),
                          responsavel_user_id: demand.responsavel_user_id || "",
                          status: demand.status || "aberta",
                          expira_em: demand.expira_em ? new Date(demand.expira_em).toISOString().slice(0, 10) : "",
                          fluxo_disparo: demand.fluxo_disparo === "gradual" ? "gradual" : "imediato",
                        });
                      }}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                    )}
                    {canManage && !["concluida", "convertida", "encerrada_sem_acordo", "expirada", "cancelada", "arquivada"].includes(demand.status) && (
                      <Button variant="outline" onClick={() => setClosingDemand(demand)}>Encerrar</Button>
                    )}
                    {demand.opa_id ? (
                      <Button variant="outline" onClick={() => navigate(`/opas/${demand.opa_id}`)}><Link2 className="mr-2 h-4 w-4" />Abrir OBA</Button>
                    ) : demand.economic_opportunity_id ? (
                      <Button variant="outline" onClick={() => navigate(`/area-aliancas?tab=oportunidades&tipo=oportunidades`)}><Lightbulb className="mr-2 h-4 w-4" />Abrir oportunidade</Button>
                    ) : demand.oportunidade_id ? (
                      <Button variant="outline" onClick={() => navigate(`/oportunidades/${demand.oportunidade_id}`)}><Lightbulb className="mr-2 h-4 w-4" />Abrir ativo relacionado</Button>
                    ) : canManage && (
                      <Button variant="outline" onClick={() => { setOpportunityDemand(demand); setOpportunityConsent(false); }}><Lightbulb className="mr-2 h-4 w-4" />Identificar oportunidade</Button>
                    )}
                  </div>
                  {canManage && (
                    <div className="ml-8 flex flex-wrap gap-2">
                      {demand.visibilidade === "publicada" ? (
                        <Button variant="ghost" size="sm" onClick={() => demandPublicationMutation.mutate({ demandId: demand.id, action: "pausar" })}>Pausar na Vitrine</Button>
                      ) : demand.visibilidade !== "restrita" ? (
                        <Button variant="ghost" size="sm" onClick={() => demandPublicationMutation.mutate({ demandId: demand.id, action: "publicar" })}><Upload className="mr-2 h-3.5 w-3.5" />Publicar na Vitrine</Button>
                      ) : null}
                      {demand.visibilidade === "pausada" && (
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => demandPublicationMutation.mutate({ demandId: demand.id, action: "retirar" })}>Retirar publicação</Button>
                      )}
                    </div>
                  )}
                  {canManage && demand.visibilidade === "restrita" && demand.codigo && <div className="ml-8"><OpportunityDistributionControls code={demand.codigo} onUpdated={() => demandsQuery.refetch()} /></div>}
                  {!!demand.proximas_etapas?.length && (
                    <div className="ml-8 flex flex-wrap gap-2">
                      {demand.proximas_etapas.map((step, index) => <Badge key={`${step.descricao}-${index}`} variant="outline"><Clock3 className="mr-1 h-3 w-3" />{step.descricao}</Badge>)}
                    </div>
                  )}
                  {!!demand.propostas?.length && (
                    <div className="ml-8 space-y-1 text-sm text-muted-foreground">
                      {demand.propostas.map((proposal: any, index) => <p key={`${proposal.descricao}-${index}`}><HandCoins className="mr-1 inline h-3.5 w-3.5" />{String(proposal.descricao || "Proposta registrada")}</p>)}
                    </div>
                  )}
                  {canManage && (
                    <div className="ml-8 grid gap-2 lg:grid-cols-2">
                      <div className="flex gap-2">
                        <Input
                          value={demandNextSteps[demand.id] || ""}
                          onChange={(event) => setDemandNextSteps((current) => ({ ...current, [demand.id]: event.target.value }))}
                          placeholder="Registrar próxima etapa..."
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          disabled={!demandNextSteps[demand.id] || updateDemandMutation.isPending}
                          onClick={() => {
                            const descricao = demandNextSteps[demand.id];
                            updateDemandMutation.mutate({
                              demandId: demand.id,
                              patch: {
                                proximas_etapas: [
                                  ...(demand.proximas_etapas || []),
                                  { descricao, status: "pendente", criado_em: new Date().toISOString() },
                                ],
                              },
                            });
                            setDemandNextSteps((current) => ({ ...current, [demand.id]: "" }));
                          }}
                        >
                          <Plus className="h-4 w-4" /><span className="sr-only">Adicionar etapa</span>
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={demandProposals[demand.id] || ""}
                          onChange={(event) => setDemandProposals((current) => ({ ...current, [demand.id]: event.target.value }))}
                          placeholder="Registrar proposta recebida..."
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          disabled={!demandProposals[demand.id] || updateDemandMutation.isPending}
                          onClick={() => {
                            const descricao = demandProposals[demand.id];
                            updateDemandMutation.mutate({
                              demandId: demand.id,
                              patch: {
                                propostas: [
                                  ...(demand.propostas || []),
                                  { descricao, criado_em: new Date().toISOString() },
                                ],
                              },
                            });
                            setDemandProposals((current) => ({ ...current, [demand.id]: "" }));
                          }}
                        >
                          <Plus className="h-4 w-4" /><span className="sr-only">Adicionar proposta</span>
                        </Button>
                      </div>
                      <Button variant="outline" asChild>
                        <label className="cursor-pointer">
                          <Paperclip className="mr-2 h-4 w-4" />Anexar documento
                          <input type="file" className="hidden" onChange={(event) => void attachDemandDocument(demand, event.target.files?.[0])} />
                        </label>
                      </Button>
                    </div>
                  )}
                  {!!demand.documentos?.length && <p className="ml-8 text-xs text-muted-foreground">{demand.documentos.length} documento(s) vinculado(s)</p>}
                  {demand.resultado && <p className="ml-8 border-l-2 border-emerald-500 pl-3 text-sm text-muted-foreground">{demand.resultado}</p>}
                  {canManage && <DemandInterestsManager imovelId={id} demand={demand} />}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="acessos" className="space-y-5">
          <div><h2 className="text-lg font-semibold">Acessos do imóvel</h2><p className="mt-1 text-sm text-muted-foreground">Compartilhe somente com pessoas autorizadas e defina o nível de colaboração.</p></div>
          {!canManage ? <div className="border-y py-10 text-center text-sm text-muted-foreground">Somente administradores deste imóvel podem gerenciar acessos.</div> : (
            <>
              <section className="grid gap-3 border-y py-5 md:grid-cols-[1fr_220px_auto]">
                <div className="space-y-2"><Label>E-mail ou usuário cadastrado</Label><Input value={shareForm.identificador} onChange={(event) => setShareForm({ ...shareForm, identificador: event.target.value })} placeholder="pessoa@exemplo.com" /></div>
                <div className="space-y-2"><Label>Nível</Label><Select value={shareForm.nivel} onValueChange={(value: AccessLevel) => setShareForm({ ...shareForm, nivel: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="leitura">Somente leitura</SelectItem><SelectItem value="colaboracao">Colaboração</SelectItem><SelectItem value="administracao">Administração</SelectItem></SelectContent></Select></div>
                <Button className="self-end bg-blue-600 text-white hover:bg-blue-700" disabled={!shareForm.identificador || shareMutation.isPending} onClick={() => shareMutation.mutate()}><UserPlus className="mr-2 h-4 w-4" />Compartilhar</Button>
              </section>
              <div className="divide-y border-y">
                <div className="flex items-center gap-3 py-3"><ShieldCheck className="h-5 w-5 text-blue-600" /><div className="flex-1"><p className="font-medium">{accessQuery.data?.owner?.nome || accessQuery.data?.owner?.email || "Proprietário principal"}</p><p className="text-xs text-muted-foreground">Proprietário · acesso permanente</p></div><Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">proprietário</Badge></div>
                {(accessQuery.data?.acessos || []).map((access) => <div key={access.id} className="flex items-center gap-3 py-3"><Users className="h-5 w-5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{access.nome || access.email || access.username || access.membro_id || "Usuário autorizado"}</p><p className="text-xs text-muted-foreground">{access.email || access.username || access.user_id}</p></div><Badge variant="outline">{access.nivel}</Badge><Button variant="ghost" size="icon" onClick={() => revokeMutation.mutate(access.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button></div>)}
                {(accessQuery.data?.acessos_temporarios || []).map((access) => (
                  <div key={`temporary-${access.id}`} className="flex items-center gap-3 py-3">
                    <Clock3 className="h-5 w-5 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{access.nome || access.email || access.username || access.membro_id || "Profissional selecionado"}</p>
                      <p className="text-xs text-muted-foreground">
                        {access.demanda_titulo || access.demanda_codigo || "Demanda direcionada"}
                        {access.expira_em ? ` · até ${shortDate(access.expira_em)}` : " · até o encerramento"}
                      </p>
                    </div>
                    <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">temporário</Badge>
                    <Badge variant="outline">{access.nivel}</Badge>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="border-y py-4"><KeyRound className="h-4 w-4 text-blue-600" /><p className="mt-2 font-medium">Leitura</p><p className="mt-1 text-xs text-muted-foreground">Consulta dados, documentos, alertas e análises.</p></div>
                <div className="border-y py-4"><Pencil className="h-4 w-4 text-blue-600" /><p className="mt-2 font-medium">Colaboração</p><p className="mt-1 text-xs text-muted-foreground">Registra Pulso, lançamentos e documentos.</p></div>
                <div className="border-y py-4"><ShieldCheck className="h-4 w-4 text-blue-600" /><p className="mt-2 font-medium">Administração</p><p className="mt-1 text-xs text-muted-foreground">Edita o imóvel, cria demandas e gerencia acessos.</p></div>
              </div>
              {imovel.is_owner && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-y py-4">
                  <div>
                    <p className="font-medium">Administração principal</p>
                    <p className="mt-1 text-xs text-muted-foreground">A transferência torna outra pessoa proprietária. Você permanece como administrador.</p>
                  </div>
                  <Button variant="outline" onClick={() => setTransferOpen(true)}><ShieldCheck className="mr-2 h-4 w-4" />Transferir</Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <PropertyFormDialog open={editOpen} onOpenChange={setEditOpen} initial={imovel} onSave={(payload) => editMutation.mutate(payload)} saving={editMutation.isPending} />
      <Dialog open={originOpen} onOpenChange={(open) => { setOriginOpen(open); if (!open) setOriginForm({ nome_bia: "", valor_origem: "", ciente_divida: false, papeis: {} }); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Originar uma BIA deste imóvel</DialogTitle><DialogDescription>O imóvel e seu histórico permanecem na Carteira. O MAP abaixo será congelado após todos aceitarem o MOU.</DialogDescription></DialogHeader>
          {originPreviewQuery.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div> : (
            <div className="space-y-4">
              {!!originPreviewQuery.data?.impedimentos?.length && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Antes de continuar:</p><ul className="mt-1 list-disc pl-5">{originPreviewQuery.data.impedimentos.map((item: string) => <li key={item}>{item}</li>)}</ul></div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Nome da BIA</Label><Input value={originForm.nome_bia} onChange={(event) => setOriginForm({ ...originForm, nome_bia: event.target.value })} /></div>
                <div className="space-y-2"><Label>Valor de origem bruto</Label><Input inputMode="decimal" value={originForm.valor_origem} onChange={(event) => setOriginForm({ ...originForm, valor_origem: event.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Papel de cada participante</Label>{(originPreviewQuery.data?.socios || []).map((socio: ImovelSocio) => <div key={socio.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_130px_180px] sm:items-center"><div><p className="font-medium">{socio.nome}</p><p className="text-xs text-muted-foreground">{socio.map_percentual}% do MAP</p></div><Badge variant="outline">{socio.status}</Badge><Select value={originForm.papeis[String(socio.id)] || ""} onValueChange={(value: "guardiao" | "multiplicador") => setOriginForm({ ...originForm, papeis: { ...originForm.papeis, [String(socio.id)]: value } })}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger><SelectContent><SelectItem value="guardiao">Guardião</SelectItem><SelectItem value="multiplicador">Multiplicador</SelectItem></SelectContent></Select></div>)}</div>
              {Number(originPreviewQuery.data?.divida || 0) > 0 && <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3"><Checkbox checked={originForm.ciente_divida} onCheckedChange={(checked) => setOriginForm({ ...originForm, ciente_divida: checked === true })} /><span className="text-sm">Estou ciente de que o valor de origem é bruto e que o saldo devedor de {money(originPreviewQuery.data.divida, imovel.moeda)} permanecerá registrado separadamente.</span></label>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setOriginOpen(false)}>Cancelar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={!originPreviewQuery.data?.pronto || !originForm.nome_bia.trim() || !(parseNumber(originForm.valor_origem) > 0) || (Number(originPreviewQuery.data?.divida || 0) > 0 && !originForm.ciente_divida) || Object.keys(originForm.papeis).length !== (originPreviewQuery.data?.socios || []).length || originMutation.isPending} onClick={() => originMutation.mutate()}>{originMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar e solicitar MOUs</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <NewLaunchDialog open={launchOpen} onOpenChange={setLaunchOpen} imovelId={id} onSaved={invalidateAll} />
      <Dialog open={demandOpen} onOpenChange={setDemandOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] sm:max-w-xl">
          <DialogHeader><DialogTitle>Nova demanda</DialogTitle><DialogDescription>Descreva o que precisa ser resolvido neste imóvel. A BUILT ajuda a encontrar os membros adequados.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>O que você precisa?</Label><Input value={demandForm.titulo} onChange={(event) => setDemandForm({ ...demandForm, titulo: event.target.value })} placeholder={`Ex.: Avaliar o valor de ${imovel.nome}`} /></div>
            <div className="space-y-2"><Label>Conte um pouco mais</Label><Textarea value={demandForm.escopo} onChange={(event) => setDemandForm({ ...demandForm, escopo: event.target.value })} placeholder="Descreva o resultado esperado, o contexto e qualquer restrição importante." /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo da demanda</Label>
                <Select value={demandForm.tipo_demanda} onValueChange={(value: "venda" | "locacao" | "servico_fornecimento") => setDemandForm({ ...demandForm, tipo_demanda: value, destinatarios: [] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Venda</SelectItem>
                    <SelectItem value="locacao">Locação</SelectItem>
                    <SelectItem value="servico_fornecimento">Serviço ou fornecimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>De que tipo de ajuda você precisa?</Label>
                <Select value={demandForm.ajuda} onValueChange={(value) => setDemandForm({ ...demandForm, ajuda: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ainda_nao_sei">Ainda não sei</SelectItem>
                    <SelectItem value="Avaliação">Avaliação</SelectItem>
                    <SelectItem value="Corretagem">Venda ou locação</SelectItem>
                    <SelectItem value="Engenharia">Engenharia ou vistoria</SelectItem>
                    <SelectItem value="Arquitetura">Arquitetura ou projeto</SelectItem>
                    <SelectItem value="Jurídico">Jurídico ou regularização</SelectItem>
                    <SelectItem value="Obras">Obras ou manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Urgência</Label><Select value={demandForm.urgencia} onValueChange={(value) => setDemandForm({ ...demandForm, urgencia: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div>
            </div>
            {!!(accessQuery.data?.owner?.id || accessQuery.data?.acessos?.some((access) => access.user_id)) && (
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={demandForm.responsavel_user_id || "sem_responsavel"} onValueChange={(value) => setDemandForm({ ...demandForm, responsavel_user_id: value === "sem_responsavel" ? "" : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_responsavel">Definir depois</SelectItem>
                    {accessQuery.data?.owner?.id && <SelectItem value={accessQuery.data.owner.id}>{accessQuery.data.owner.nome || accessQuery.data.owner.email || "Proprietário"}</SelectItem>}
                    {(accessQuery.data?.acessos || []).filter((access) => access.user_id).map((access) => <SelectItem key={access.id} value={access.user_id!}>{access.nome || access.email || access.username || "Colaborador"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Outras especialidades (opcional)</Label><Input value={demandForm.especialidades} onChange={(event) => setDemandForm({ ...demandForm, especialidades: event.target.value })} placeholder="Separe por vírgulas" /></div>
            <div className="space-y-2">
              <Label>Como deseja encontrar profissionais?</Label>
              <div className="grid grid-cols-2 overflow-hidden rounded-md border p-1">
                <Button type="button" variant={demandForm.modalidade_distribuicao === "direcionada" ? "default" : "ghost"} className="rounded" onClick={() => setDemandForm({ ...demandForm, modalidade_distribuicao: "direcionada", publicar: false })}>Escolher profissionais</Button>
                <Button type="button" variant={demandForm.modalidade_distribuicao === "pulso" ? "default" : "ghost"} className="rounded" onClick={() => setDemandForm({ ...demandForm, modalidade_distribuicao: "pulso", destinatarios: [] })}>Pulso BUILT</Button>
              </div>
            </div>
            {demandForm.modalidade_distribuicao === "direcionada" ? (
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Profissionais recomendados</p>
                  <p className="text-xs text-muted-foreground">Os escolhidos receberão a Demanda e acesso temporário de leitura ao imóvel.</p>
                </div>
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={demandProfessionalSearch} onChange={(event) => setDemandProfessionalSearch(event.target.value)} placeholder="Buscar por nome, empresa ou cargo" /></div>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {demandRecommendationsQuery.isLoading && <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando profissionais aderentes...</div>}
                  {(demandRecommendationsQuery.data?.recomendacoes || []).map((professional) => {
                    const selected = demandForm.destinatarios.includes(professional.id);
                    return (
                      <button
                        type="button"
                        key={professional.id}
                        className={`flex w-full items-start gap-3 rounded-md border p-3 text-left ${selected ? "border-blue-500 bg-blue-50" : "hover:bg-muted/50"}`}
                        onClick={() => setDemandForm({
                          ...demandForm,
                          destinatarios: selected
                            ? demandForm.destinatarios.filter((memberId) => memberId !== professional.id)
                            : [...demandForm.destinatarios, professional.id],
                        })}
                      >
                        <Checkbox checked={selected} className="mt-0.5" />
                        <span className="min-w-0 flex-1"><span className="block font-medium">{professional.nome}</span><span className="block text-xs text-muted-foreground">{[professional.empresa, professional.cidade, professional.estado].filter(Boolean).join(" · ") || "Membro BUILT"}</span><span className="mt-1 block text-xs text-blue-700">{professional.aderencia}% de aderência{professional.aura?.score != null ? ` · Aura ${professional.aura.score}` : ""}</span></span>
                      </button>
                    );
                  })}
                  {!demandRecommendationsQuery.isLoading && !(demandRecommendationsQuery.data?.recomendacoes || []).length && <p className="py-4 text-sm text-muted-foreground">Nenhum profissional encontrado com estes filtros.</p>}
                </div>
                <p className="text-xs font-medium text-blue-700">{demandForm.destinatarios.length} profissional(is) selecionado(s)</p>
              </div>
            ) : (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                <p className="font-medium">Distribuição progressiva</p>
                <p className="mt-1 text-xs leading-relaxed text-blue-800">Comunidade → Regional → Nacional → Global → Vitrine Geral, com quatro horas entre as etapas. O Pulso pausa quando um membro manifesta interesse.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Validade</Label><Input type="number" min="1" value={demandForm.validade_dias} onChange={(event) => setDemandForm({ ...demandForm, validade_dias: event.target.value })} /><p className="text-xs text-muted-foreground">Dias; o padrão é 60.</p>
            </div>
            {demandForm.modalidade_distribuicao === "pulso" && <label className="flex cursor-pointer items-start gap-3 border-t pt-4">
              <Checkbox checked={demandForm.publicar} onCheckedChange={(checked) => setDemandForm({ ...demandForm, publicar: checked === true })} />
              <span className="text-sm leading-relaxed"><strong>Iniciar o Pulso BUILT ao criar</strong><br /><span className="text-muted-foreground">Autorizo a distribuição do resumo. Endereço exato, documentos e contato permanecem privados até eu selecionar um profissional.</span></span>
            </label>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDemandOpen(false)}>Cancelar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={!demandForm.titulo || (demandForm.modalidade_distribuicao === "direcionada" && demandForm.destinatarios.length === 0) || demandMutation.isPending} onClick={() => demandMutation.mutate()}>{demandMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar demanda</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editingDemand)} onOpenChange={(open) => { if (!open) setEditingDemand(null); }}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] sm:max-w-2xl">
          <DialogHeader><DialogTitle>Editar Demanda</DialogTitle><DialogDescription>Atualizações em uma publicação ficam registradas no histórico da oportunidade.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Título</Label><Input value={demandEditForm.titulo} onChange={(event) => setDemandEditForm({ ...demandEditForm, titulo: event.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={demandEditForm.escopo} onChange={(event) => setDemandEditForm({ ...demandEditForm, escopo: event.target.value })} /></div>
            <div className="space-y-2"><Label>Resumo público</Label><Textarea value={demandEditForm.resumo_publico} onChange={(event) => setDemandEditForm({ ...demandEditForm, resumo_publico: event.target.value })} placeholder="Evite endereço exato, contatos e documentos privados." /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Urgência</Label><Select value={demandEditForm.urgencia} onValueChange={(value) => setDemandEditForm({ ...demandEditForm, urgencia: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={demandEditForm.status} onValueChange={(value) => setDemandEditForm({ ...demandEditForm, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="aberta">Aberta</SelectItem><SelectItem value="em_negociacao">Em negociação</SelectItem><SelectItem value="contratada">Contratada</SelectItem><SelectItem value="em_execucao">Em execução</SelectItem><SelectItem value="concluida">Concluída</SelectItem><SelectItem value="encerrada_sem_acordo">Encerrada sem acordo</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Validade</Label><Input type="date" value={demandEditForm.expira_em} onChange={(event) => setDemandEditForm({ ...demandEditForm, expira_em: event.target.value })} /></div>
              <div className="space-y-2"><Label>Distribuição</Label><Select value={demandEditForm.fluxo_disparo} onValueChange={(value: "imediato" | "gradual") => setDemandEditForm({ ...demandEditForm, fluxo_disparo: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="imediato">Vitrine geral imediatamente</SelectItem><SelectItem value="gradual">Fluxo territorial a cada 12h</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Especialidades</Label><Input value={demandEditForm.especialidades} onChange={(event) => setDemandEditForm({ ...demandEditForm, especialidades: event.target.value })} placeholder="Separe por vírgulas" /></div>
            {!!(accessQuery.data?.owner?.id || accessQuery.data?.acessos?.some((access) => access.user_id)) && <div className="space-y-2"><Label>Responsável</Label><Select value={demandEditForm.responsavel_user_id || "sem_responsavel"} onValueChange={(value) => setDemandEditForm({ ...demandEditForm, responsavel_user_id: value === "sem_responsavel" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sem_responsavel">Definir depois</SelectItem>{accessQuery.data?.owner?.id && <SelectItem value={accessQuery.data.owner.id}>{accessQuery.data.owner.nome || accessQuery.data.owner.email || "Proprietário"}</SelectItem>}{(accessQuery.data?.acessos || []).filter((access) => access.user_id).map((access) => <SelectItem key={access.id} value={access.user_id!}>{access.nome || access.email || access.username || "Colaborador"}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditingDemand(null)}>Cancelar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={!demandEditForm.titulo.trim() || updateDemandMutation.isPending} onClick={() => editingDemand && updateDemandMutation.mutate({ demandId: editingDemand.id, patch: { ...demandEditForm, especialidades: demandEditForm.especialidades.split(",").map((item) => item.trim()).filter(Boolean), expira_em: demandEditForm.expira_em ? new Date(`${demandEditForm.expira_em}T23:59:59`).toISOString() : null } })}>{updateDemandMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {closingDemand && <OpportunityCloseDialog open opportunityCode={closingDemand.codigo || closingDemand.id} onOpenChange={(open) => !open && setClosingDemand(null)} onSuccess={() => { setClosingDemand(null); demandsQuery.refetch(); queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] }); }} />}
      <AlertDialog open={publishConfirm} onOpenChange={setPublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Explorar oportunidades para este imóvel?</AlertDialogTitle><AlertDialogDescription>A BUILT poderá analisar estratégias como venda, locação, reforma, desenvolvimento ou parceria. Você autoriza o compartilhamento das informações do ativo com a rede, mantendo endereço exato, documentos e contato protegidos até a seleção de interessados.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => publishMutation.mutate()}>{publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar para análise</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(opportunityDemand)} onOpenChange={(open) => { if (!open) { setOpportunityDemand(null); setOpportunityConsent(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transformar necessidade em oportunidade</DialogTitle>
            <DialogDescription>Use este caminho quando a demanda revelou um potencial econômico maior para o imóvel. Isso não cria uma BIA nem uma OBA.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-l-2 border-blue-500 pl-3">
              <p className="font-medium">{opportunityDemand?.titulo}</p>
              {opportunityDemand?.escopo && <p className="mt-1 text-sm text-muted-foreground">{opportunityDemand.escopo}</p>}
            </div>
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox checked={opportunityConsent} onCheckedChange={(checked) => setOpportunityConsent(checked === true)} />
              <span className="text-sm leading-relaxed">Autorizo a BUILT a analisar esta oportunidade e compartilhar o resumo necessário com revisores e membros, preservando os dados privados.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpportunityDemand(null)}>Cancelar</Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={!opportunityConsent || convertOpportunityMutation.isPending} onClick={() => opportunityDemand && convertOpportunityMutation.mutate(opportunityDemand.id)}>
              {convertOpportunityMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar oportunidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {imovel.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e também removerá os lançamentos, documentos e o histórico vinculados a este imóvel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePropertyMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deletePropertyMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deletePropertyMutation.mutate();
              }}
            >
              {deletePropertyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir imóvel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={transferOpen} onOpenChange={setTransferOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir a administração principal?</AlertDialogTitle>
            <AlertDialogDescription>Somente o novo proprietário poderá excluir o imóvel ou realizar outra transferência. Você permanecerá com acesso de administração.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>E-mail ou usuário do novo proprietário</Label>
            <Input value={transferIdentifier} onChange={(event) => setTransferIdentifier(event.target.value)} placeholder="pessoa@exemplo.com" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={!transferIdentifier || transferMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                transferMutation.mutate();
              }}
            >
              {transferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar transferência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CarteiraPage() {
  const params = useParams<{ id?: string }>();
  if (params.id) return <DetailPage id={params.id} />;
  return <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><CarteiraDashboardPanel /></div>;
}
