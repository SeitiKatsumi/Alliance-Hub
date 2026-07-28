import { useEffect, useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type AccessLevel = "leitura" | "colaboracao" | "administracao" | "proprietario";

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
  divida_saldo?: string | number;
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
  diagnostico?: CarteiraDiagnostico | null;
}

interface CarteiraResumo {
  imoveis: CarteiraImovel[];
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
  resultado?: string | null;
  criado_em: string;
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

interface AccessResponse {
  owner?: { id?: string; membro_id?: string; nome?: string; email?: string; username?: string } | null;
  acessos: CarteiraAcesso[];
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

function Metric({ label, value, icon: Icon, tone = "text-slate-900", helper }: {
  label: string;
  value: string;
  icon: any;
  tone?: string;
  helper?: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
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
  const [form, setForm] = useState<Omit<CarteiraImovel, "id">>(EMPTY_PROPERTY);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      setForm(EMPTY_PROPERTY);
      return;
    }
    const { id: _id, diagnostico: _diagnostico, access_level: _access, is_owner: _owner, ...editable } = initial;
    setForm({ ...EMPTY_PROPERTY, ...editable });
  }, [open, initial]);

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
    const body = new FormData();
    body.append("files", file);
    const response = await fetch("/api/upload", { method: "POST", credentials: "include", body });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.fileIds?.[0]) setForm((current) => ({ ...current, foto: data.fileIds[0] }));
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
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Selecionar foto
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
              </label>
            </Button>
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
            <Label>Valor pago</Label>
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
            <Label>Titularidade</Label>
            <Input
              value={(form.titularidade || []).map((item) => item.nome).join(", ")}
              onChange={(event) => setForm({
                ...form,
                titularidade: event.target.value.split(",").map((nome) => ({ nome: nome.trim() })).filter((item) => item.nome),
              })}
              placeholder="Nome dos titulares, separados por vírgula"
            />
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
            disabled={saving || !form.nome || !form.tipo}
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
  onOpen,
  onEdit,
  onDelete,
}: {
  item: CarteiraImovel;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const diagnostic = item.diagnostico;
  const hasActions = Boolean(onEdit || onDelete);
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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <Building2 className="h-5 w-5" />
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
              <p className="text-[11px] text-muted-foreground">Valor estimado</p>
              <p className="font-semibold tabular-nums">{money(item.valor_atual, item.moeda)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Resultado registrado</p>
              <p className={`font-semibold tabular-nums ${metricTone(diagnostic?.indicadores?.resultado_liquido || 0)}`}>
                {money(diagnostic?.indicadores?.resultado_liquido || 0, item.moeda)}
              </p>
            </div>
          </div>
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
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CarteiraImovel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CarteiraImovel | null>(null);
  const { data, isLoading } = useQuery<CarteiraResumo>({ queryKey: ["/api/carteira/resumo"] });
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={compact ? "text-lg font-semibold" : "text-2xl font-bold"}>Carteira Patrimonial</h2>
          <p className="mt-1 text-sm text-muted-foreground">Seus imóveis, histórico, decisões e próximas ações em um só lugar.</p>
        </div>
        <Button
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => {
            setEditingItem(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo imóvel
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Metric label="Patrimônio líquido" value={money(totals?.patrimonio_total || 0)} icon={Landmark} helper={`Dívidas informadas: ${money(totals?.divida || 0)}`} />
        <Metric label="Valor pago" value={money(totals?.patrimonio_pago || 0)} icon={CircleDollarSign} />
        <Metric label="Valor atual estimado" value={money(totals?.patrimonio_atual || 0)} icon={Home} />
        <Metric label="Valorização registrada" value={money(totals?.valorizacao || 0)} icon={TrendingUp} tone={metricTone(totals?.valorizacao || 0)} />
        <Metric label="Receitas" value={money(totals?.receitas || 0)} icon={HandCoins} tone="text-emerald-700" />
        <Metric label="Despesas" value={money(totals?.despesas || 0)} icon={TrendingDown} tone="text-red-700" />
        <Metric label="Resultado líquido" value={money(totals?.resultado_liquido || 0)} icon={Wallet} tone={metricTone(totals?.resultado_liquido || 0)} helper={`${totals?.alertas_abertos || 0} alertas abertos`} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
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
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
            >
              Adicionar imóvel
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {imoveis.map((item) => (
            <PropertyCard
              key={item.id}
              item={item}
              onOpen={() => navigate(`/carteira/${item.id}`)}
              onEdit={canAccess(item.access_level, "administracao") ? () => {
                setEditingItem(item);
                setFormOpen(true);
              } : undefined}
              onDelete={item.is_owner ? () => setDeleteTarget(item) : undefined}
            />
          ))}
        </div>
      )}
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

function DetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferIdentifier, setTransferIdentifier] = useState("");
  const [pulseForm, setPulseForm] = useState({ ocupacao: "", receita: "", despesa: "", acontecimento: "", objetivo: "", data_referencia: new Date().toISOString().slice(0, 10) });
  const [pulsePreview, setPulsePreview] = useState<any | null>(null);
  const [importedLaunches, setImportedLaunches] = useState<any[]>([]);
  const [documentForm, setDocumentForm] = useState({
    file: null as File | null,
    nome: "",
    tipo: "Matrícula",
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
  const [demandForm, setDemandForm] = useState({ titulo: "", escopo: "", urgencia: "normal", tipo_resolucao: "solicitacao", especialidades: "", responsavel_user_id: "" });
  const [shareForm, setShareForm] = useState({ identificador: "", nivel: "leitura" as AccessLevel });
  const [demandNextSteps, setDemandNextSteps] = useState<Record<string, string>>({});
  const [demandProposals, setDemandProposals] = useState<Record<string, string>>({});

  const detailQuery = useQuery<CarteiraImovel>({ queryKey: ["/api/carteira/imoveis", id] });
  const launchesQuery = useQuery<CarteiraLancamento[]>({
    queryKey: ["/api/carteira/lancamentos", id],
    queryFn: async () => (await apiRequest("GET", `/api/carteira/lancamentos?imovel_id=${encodeURIComponent(id)}`)).json(),
  });
  const docsQuery = useQuery<CarteiraDocumento[]>({ queryKey: ["/api/carteira/imoveis", id, "documentos"] });
  const alertsQuery = useQuery<CarteiraAlerta[]>({ queryKey: ["/api/carteira/imoveis", id, "alertas"] });
  const eventsQuery = useQuery<CarteiraEvento[]>({ queryKey: ["/api/carteira/imoveis", id, "eventos"] });
  const alternativesQuery = useQuery<CarteiraAlternativasResult | null>({ queryKey: ["/api/carteira/imoveis", id, "alternativas"] });
  const demandsQuery = useQuery<CarteiraDemanda[]>({ queryKey: ["/api/carteira/imoveis", id, "demandas"] });
  const canManage = canAccess(detailQuery.data?.access_level, "administracao");
  const canCollaborate = canAccess(detailQuery.data?.access_level, "colaboracao");
  const isOwner = detailQuery.data?.is_owner === true;
  const accessQuery = useQuery<AccessResponse>({
    queryKey: ["/api/carteira/imoveis", id, "acessos"],
    enabled: canManage,
  });
  const imovel = detailQuery.data;
  const diagnostic = imovel?.diagnostico;

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
      setDocumentForm({ file: null, nome: "", tipo: "Matrícula", emissao: "", validade: "", observacao: "", origem: "declarada", status_validacao: "declarado", dados_extraidos: {} });
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
      ...demandForm,
      alternativa: selectedAlternative?.tipo || null,
      especialidades: demandForm.especialidades.split(",").map((item) => item.trim()).filter(Boolean),
    })).json(),
    onSuccess: () => {
      setDemandOpen(false);
      setDemandForm({ titulo: "", escopo: "", urgencia: "normal", tipo_resolucao: "solicitacao", especialidades: "", responsavel_user_id: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "demandas"] });
      invalidateAll();
      toast({ title: "Demanda criada" });
    },
  });
  const convertOpaMutation = useMutation({
    mutationFn: async (demandId: string) => (await apiRequest("POST", `/api/carteira/imoveis/${id}/demandas/${demandId}/converter-opa`, {})).json(),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "demandas"] });
      toast({ title: "Rascunho de OBA criado", description: "A OBA foi criada pausada para revisão." });
      if (data.opa_id) navigate(`/opas/${data.opa_id}`);
    },
    onError: (error: any) => toast({ title: "Erro ao criar OBA", description: error?.message, variant: "destructive" }),
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
      category: "land-bank",
      origem: "carteira",
      origem_carteira_id: id,
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
    onSuccess: () => { setPublishConfirm(false); toast({ title: "Imóvel publicado no Banco de Ativos" }); },
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

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="px-0 text-muted-foreground" onClick={() => navigate("/?tab=carteira")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar para a Carteira
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          {canManage && <Button variant="outline" title="Editar imóvel" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>}
          {canManage && <Button variant="outline" onClick={() => setPublishConfirm(true)}><Upload className="mr-2 h-4 w-4" />Publicar no Banco de Ativos</Button>}
          {isOwner && (
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{imovel.nome}</h1>
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
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Valor atual estimado" value={money(imovel.valor_atual, imovel.moeda)} icon={Home} helper={`Data-base: ${shortDate(imovel.valor_data_base)} · origem ${imovel.valor_origem || "declarada"}`} />
        <Metric label="Receitas registradas" value={money(diagnostic?.indicadores?.receitas || 0, imovel.moeda)} icon={TrendingUp} tone="text-emerald-700" />
        <Metric label="Despesas registradas" value={money(diagnostic?.indicadores?.despesas || 0, imovel.moeda)} icon={TrendingDown} tone="text-red-700" />
        <Metric label="Resultado líquido" value={money(diagnostic?.indicadores?.resultado_liquido || 0, imovel.moeda)} icon={Wallet} tone={metricTone(diagnostic?.indicadores?.resultado_liquido || 0)} />
      </div>

      <Tabs defaultValue="visao" className="space-y-5">
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
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="font-semibold">Alertas</h2><p className="text-sm text-muted-foreground">Pendências e mudanças que merecem atenção.</p></div>
            </div>
            {(alertsQuery.data || []).filter((item) => item.status !== "resolvido").length === 0 ? (
              <div className="border-y py-8 text-center text-sm text-muted-foreground">Nenhum alerta aberto.</div>
            ) : (
              <div className="divide-y border-y">
                {(alertsQuery.data || []).filter((item) => item.status !== "resolvido").map((alert) => (
                  <div key={alert.id} className="flex flex-wrap items-start gap-3 py-3">
                    <AlertTriangle className={`mt-0.5 h-4 w-4 ${alert.severidade === "alta" || alert.severidade === "critica" ? "text-red-600" : "text-amber-600"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{alert.titulo}</p>
                      {alert.descricao && <p className="mt-1 text-sm text-muted-foreground">{alert.descricao}</p>}
                      {alert.acao_sugerida && <p className="mt-1 text-xs text-blue-700">Ação sugerida: {alert.acao_sugerida}</p>}
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
              <div className="space-y-2"><Label>Tipo</Label><Select value={documentForm.tipo} onValueChange={(value) => setDocumentForm({ ...documentForm, tipo: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Matrícula", "IPTU / ITR", "Escritura", "Contrato de locação", "Laudo / inspeção", "Planta", "Fotos", "Orçamento", "Financiamento", "Planilha financeira", "Outro"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
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
          {(docsQuery.data || []).length === 0 ? (
            <div className="border-y py-12 text-center text-sm text-muted-foreground">Nenhum documento organizado.</div>
          ) : (
            <div className="divide-y border-y">
              {(docsQuery.data || []).map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.nome}</p><p className="text-xs text-muted-foreground">{doc.tipo} · versão {doc.versao} · origem {doc.origem}{doc.validade ? ` · válido até ${shortDate(doc.validade)}` : ""}</p></div>
                  <Badge variant="outline">{doc.status_validacao}</Badge>
                  {doc.file_url && <Button variant="outline" size="sm" onClick={() => window.open(doc.file_url, "_blank", "noopener,noreferrer")}>Abrir</Button>}
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
                        <Badge variant="outline">{demand.tipo_resolucao}</Badge>
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
                    {demand.opa_id ? (
                      <Button variant="outline" onClick={() => navigate(`/opas/${demand.opa_id}`)}><Link2 className="mr-2 h-4 w-4" />Abrir OBA</Button>
                    ) : canManage && (
                      <Button variant="outline" disabled={convertOpaMutation.isPending} onClick={() => convertOpaMutation.mutate(demand.id)}>Criar rascunho de OBA</Button>
                    )}
                  </div>
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
      <NewLaunchDialog open={launchOpen} onOpenChange={setLaunchOpen} imovelId={id} onSaved={invalidateAll} />
      <Dialog open={demandOpen} onOpenChange={setDemandOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova demanda</DialogTitle><DialogDescription>A demanda reutiliza as informações já registradas neste imóvel.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={demandForm.titulo} onChange={(event) => setDemandForm({ ...demandForm, titulo: event.target.value })} /></div>
            <div className="space-y-2"><Label>Escopo preliminar</Label><Textarea value={demandForm.escopo} onChange={(event) => setDemandForm({ ...demandForm, escopo: event.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tipo</Label><Select value={demandForm.tipo_resolucao} onValueChange={(value) => setDemandForm({ ...demandForm, tipo_resolucao: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solicitacao">Solicitação simples</SelectItem><SelectItem value="opa">Preparar OBA</SelectItem><SelectItem value="bia_sugerida">Pode exigir futura BIA</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Urgência</Label><Select value={demandForm.urgencia} onValueChange={(value) => setDemandForm({ ...demandForm, urgencia: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div></div>
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
            <div className="space-y-2"><Label>Especialidades, separadas por vírgula</Label><Input value={demandForm.especialidades} onChange={(event) => setDemandForm({ ...demandForm, especialidades: event.target.value })} placeholder="Avaliação, Regularização, Obras..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDemandOpen(false)}>Cancelar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={!demandForm.titulo || demandMutation.isPending} onClick={() => demandMutation.mutate()}>{demandMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar demanda</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={publishConfirm} onOpenChange={setPublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Publicar no Banco de Ativos?</AlertDialogTitle><AlertDialogDescription>Uma cópia das informações do imóvel será publicada no Banco de Ativos. O imóvel continuará privado e independente na sua Carteira.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => publishMutation.mutate()}>{publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar publicação</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
