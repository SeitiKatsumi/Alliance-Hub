import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  Plus,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  FileText,
  Tag,
  RefreshCw,
  BarChart3,
  Users,
  Pencil,
  UserCheck,
  Layers,
  Paperclip,
  Upload,
  X,
  Eye,
  Download,
  File,
  Image,
  Filter,
  Search,
  RotateCcw,
  ChevronsUpDown,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  CalendarClock,
  CalendarCheck,
  Receipt,
  CreditCard,
  BadgePercent,
  ArrowLeftRight,
  SendHorizontal,
  ThumbsUp,
  ThumbsDown,
  Divide,
  PlusCircle,
  ExternalLink,
} from "lucide-react";

interface BiasProjeto {
  id: string;
  nome_bia: string;
  objetivo_alianca?: string;
  valor_origem?: string | number | null;
  diretor_alianca?: string | null;
  diretor_nucleo_tecnico?: string | null;
  diretor_execucao?: string | null;
  diretor_comercial?: string | null;
  diretor_capital?: string | null;
  aliado_built?: string | null;
  socios_multiplicadores?: string[] | string | null;
  socios_guardioes?: string[] | string | null;
  terceiros?: string[] | string | null;
}

interface TransferenciaCotas {
  id: string;
  bia_id: string;
  membro_origem_id: string;
  membro_destino_id: string;
  valor_total: string | null;
  percentual_transferencia: string | null;
  status: "pendente" | "aceita" | "rejeitada";
  solicitado_por: string | null;
  observacoes: string | null;
  anexos?: (AnexoFile | string)[] | null;
  motivo_rejeicao: string | null;
  criado_em: string;
}

interface Membro {
  id: string;
  nome?: string;
  Nome_de_usuario?: string | null;
  nome_completo?: string;
  primeiro_nome?: string;
  sobrenome?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  empresa?: string;
  cargo?: string;
  tipo_pessoa?: string;
  tipo_de_cadastro?: string;
  perfil_aliado?: string;
  nucleo_alianca?: string;
}

type PapelFavorecidoBia = "socios_multiplicadores" | "socios_guardioes" | "terceiros";

interface TipoCPP {
  id: number;
  Nome: string;
  Descricao?: string;
}

interface CategoriaItem {
  id: number;
  Nome_da_categoria: string;
  Descricao_das_categorias?: string;
  Tipo_de_categoria?: string | null;
  bia_id?: string | null;
}

interface AnexoFile {
  id: string;
  title?: string;
  filename?: string;
  url: string;
  size?: number;
}

interface RateioItem {
  id: string;
  membroId: string;
  valor: string;
  anexos?: globalThis.File[];
}

type RateioModo = "percentual" | "valor";

type StatusPagamento = "pendente" | "pago" | "vencido" | "cancelado" | "parcial" | "agendado";

interface FluxoCaixaItem {
  id: string;
  bia: string | { id: string };
  tipo: "entrada" | "saida";
  valor: number | string;
  data: string;
  descricao: string;
  membro_responsavel: string | { id: string; nome?: string } | null;
  status: StatusPagamento | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  Categoria: (CategoriaItem | number)[];
  tipo_de_cpp: (TipoCPP | number)[];
  Favorecido: (Membro | string)[];
  anexos: (AnexoFile | string)[];
  pagamento_provider?: "asaas" | "stripe" | null;
  pagamento_id?: string | null;
  pagamento_url?: string | null;
  pagamento_status?: string | null;
  pagamento_pais?: "brasil" | "fora" | null;
  pagamento_pagador_nome?: string | null;
  pagamento_pagador_email?: string | null;
  pagamento_pagador_documento?: string | null;
  pagamento_gerado_em?: string | null;
}

const STATUS_OPTIONS: { value: StatusPagamento; label: string }[] = [
  { value: "pendente",  label: "Pendente" },
  { value: "agendado",  label: "Agendado" },
  { value: "pago",      label: "Pago" },
  { value: "parcial",   label: "Parcialmente Pago" },
  { value: "vencido",   label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

function getStatusConfig(status: StatusPagamento | null | undefined) {
  switch (status) {
    case "pago":      return { label: "Pago",              color: "text-green-600 bg-green-500/10 border-green-500/40",  Icon: CheckCircle2 };
    case "parcial":   return { label: "Parcial",           color: "text-blue-600 bg-blue-500/10 border-blue-500/40",     Icon: BadgePercent };
    case "vencido":   return { label: "Vencido",           color: "text-red-600 bg-red-500/10 border-red-500/40",        Icon: AlertCircle };
    case "cancelado": return { label: "Cancelado",         color: "text-gray-500 bg-gray-500/10 border-gray-400/40",     Icon: XCircle };
    case "agendado":  return { label: "Agendado",          color: "text-purple-600 bg-purple-500/10 border-purple-500/40", Icon: CalendarClock };
    case "pendente":
    default:          return { label: status ? "Pendente" : "—", color: "text-amber-600 bg-amber-500/10 border-amber-500/40", Icon: Clock };
  }
}

function isVencido(item: FluxoCaixaItem): boolean {
  if (!item.data_vencimento) return false;
  if (item.status === "pago" || item.status === "cancelado") return false;
  return item.data_vencimento < new Date().toISOString().split("T")[0];
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function fluxoValorToNumber(value: number | string): number {
  if (typeof value === "number") return value;
  const raw = String(value || "").trim();
  if (!raw) return 0;
  if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
  return Number(raw) || 0;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

function getMembroNome(membro: Membro): string {
  if (membro.Nome_de_usuario) return membro.Nome_de_usuario;
  if (membro.nome) return membro.nome;
  if (membro.nome_completo) return membro.nome_completo;
  return [membro.primeiro_nome, membro.sobrenome].filter(Boolean).join(" ") || "Sem nome";
}

function getRelId(val: string | { id: string | number } | number | null): string | null {
  if (!val) return null;
  if (typeof val === "object" && val !== null) return String((val as any).id);
  return String(val);
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

function getCppName(cpp: TipoCPP | number, cppMap: Record<number, string>): string {
  if (typeof cpp === "object" && cpp !== null) return cpp.Nome || "CPP";
  return cppMap[cpp] || "CPP";
}

function getFavName(fav: Membro | string, membroMap: Record<string, string>): string {
  if (typeof fav === "object" && fav !== null) {
    const f = fav as any;
    if (f.Nome_de_usuario || f.nome || f.nome_completo || f.primeiro_nome) return getMembroNome(fav as Membro);
    return membroMap[f.id] || "";
  }
  return membroMap[fav as string] || "";
}

function getCatName(cat: CategoriaItem | number, catMap: Record<number, string>): string {
  if (typeof cat === "object" && cat !== null) return stripPlanoContaCode(cat.Nome_da_categoria || "Categoria");
  return stripPlanoContaCode(catMap[cat] || "Categoria");
}

function normalizeText(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isDivisorDeibLancamento(item: FluxoCaixaItem, catMap: Record<number, string>): boolean {
  const descricao = normalizeText(item.descricao);
  const hasDivisor = descricao.startsWith("divisor multiplicador");
  const hasDeib = (item.Categoria || []).some((cat) => {
    const name = normalizeText(typeof cat === "object" && cat !== null ? cat.Nome_da_categoria : catMap[cat]);
    return name.includes("direito economico institucional built") && (name.includes("dei-b") || name.includes("built"));
  });
  return hasDivisor && hasDeib;
}

function readableApiError(error: Error): string {
  const raw = error.message || "Erro inesperado";
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      if (parsed?.error) return String(parsed.error);
    } catch {}
  }
  return raw.replace(/^\d+:\s*/, "");
}

function stripPlanoContaCode(name?: string | null): string {
  return (name || "").replace(/^\d+(?:\.\d+)*\s+/, "").trim();
}

function getPlanoContaGroup(cat?: CategoriaItem | null): string {
  return (cat?.Descricao_das_categorias || "Outras categorias").trim();
}

function isValorOrigemCategoriaName(name?: string | null): boolean {
  const normalized = (name || "").trim().toLowerCase();
  return normalized === "valor de origem" || normalized.endsWith(" valor de origem");
}

function parseBRLToNumber(formatted: string): number {
  if (!formatted) return 0;
  const cleaned = formatted.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function formatInputBRL(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInputPercent(value: string): string {
  const cleaned = value
    .replace(/[^\d,.]/g, "")
    .replace(/\./g, ",");
  const [integerPart, ...decimalParts] = cleaned.split(",");
  const integer = integerPart.replace(/\D/g, "");
  const decimal = decimalParts.join("").replace(/\D/g, "").slice(0, 2);
  if (!integer && !decimal) return "";
  return decimalParts.length > 0 ? `${integer || "0"},${decimal}` : integer;
}

function getFileIcon(url: string) {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return Image;
  return File;
}

function getFileName(url: string) {
  const parts = url.split("/");
  const full = parts[parts.length - 1];
  if (full.length > 25) return full.substring(0, 10) + "..." + full.substring(full.length - 10);
  return full;
}

function SearchableMembroSelect({
  membros,
  value,
  onValueChange,
  placeholder,
  testId,
  allowNone,
  allowCreate,
  onCreateNew,
}: {
  membros: Membro[];
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  testId: string;
  allowNone?: boolean;
  allowCreate?: boolean;
  onCreateNew?: (nome: string, papel: PapelFavorecidoBia) => Promise<Membro | null>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<PapelFavorecidoBia>("terceiros");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() =>
    [...membros].sort((a, b) => getMembroNome(a).localeCompare(getMembroNome(b), "pt-BR")),
    [membros]
  );

  const selectedLabel = useMemo(() => {
    if (!value || value === "__none__") return allowNone ? "Nenhum" : "";
    const found = membros.find((m) => m.id === value);
    return found ? getMembroNome(found) : "";
  }, [value, membros, allowNone]);

  const filtered = useMemo(() => {
    if (!search || search.length < 3) return search ? [] : sorted;
    const s = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return sorted.filter((m) => {
      const nome = getMembroNome(m).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return nome.includes(s);
    });
  }, [sorted, search]);

  function handleSelect(id: string) {
    onValueChange(id);
    setOpen(false);
    setSearch("");
    setCreateMode(false);
    setCreateName("");
    setCreateRole("terceiros");
  }

  async function handleCreate() {
    const nome = (createMode ? createName : search).trim();
    if (!nome || !onCreateNew) return;
    setCreating(true);
    try {
      const newMembro = await onCreateNew(nome, createRole);
      if (newMembro) {
        onValueChange(newMembro.id);
        setOpen(false);
        setSearch("");
        setCreateMode(false);
        setCreateName("");
        setCreateRole("terceiros");
      }
    } finally {
      setCreating(false);
    }
  }

  function handleOpenCreate() {
    setCreateMode(true);
    setCreateName(search);
    setCreateRole("terceiros");
    setTimeout(() => createInputRef.current?.focus(), 50);
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSearch(""); setCreateMode(false); setCreateName(""); setCreateRole("terceiros"); } }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={testId}
          type="button"
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
        <div className="flex flex-col">
          {!createMode && (
            <div className="flex items-center border-b px-3 py-2 gap-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Digite para buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {!createMode ? (
            <>
              <div className="max-h-52 overflow-y-auto py-1">
                {allowNone && (
                  <button
                    type="button"
                    onClick={() => handleSelect("__none__")}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground ${value === "__none__" ? "font-medium" : ""}`}
                  >
                    <Check className={`h-4 w-4 ${value === "__none__" ? "opacity-100" : "opacity-0"}`} />
                    Nenhum
                  </button>
                )}
                {search && search.length > 0 && search.length < 3 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Digite ao menos 3 letras...</p>
                ) : filtered.length === 0 && search.length >= 3 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum membro encontrado.</p>
                ) : filtered.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(m.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground ${value === m.id ? "font-medium" : ""}`}
                  >
                    <Check className={`h-4 w-4 ${value === m.id ? "opacity-100" : "opacity-0"}`} />
                    {getMembroNome(m)}
                  </button>
                ))}
              </div>
              {allowCreate && onCreateNew && (
                <div className="border-t p-1.5">
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-sm text-brand-navy hover:bg-brand-navy/5 hover:text-brand-navy font-medium transition-colors"
                    data-testid={`${testId}-create-btn`}
                  >
                    <Plus className="h-4 w-4 shrink-0 text-brand-gold" />
                    {search.length >= 3 ? `Adicionar "${search}" como favorecido` : "Adicionar novo favorecido"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Novo favorecido externo</p>
              <input
                ref={createInputRef}
                className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold"
                placeholder="Nome do favorecido..."
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
                  if (e.key === "Escape") { setCreateMode(false); setCreateName(""); }
                }}
              />
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Tipo na equipe da BIA</p>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    { value: "socios_multiplicadores" as PapelFavorecidoBia, label: "Sócio Multiplicador" },
                    { value: "socios_guardioes" as PapelFavorecidoBia, label: "Sócio Guardião" },
                    { value: "terceiros" as PapelFavorecidoBia, label: "Terceiro" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCreateRole(option.value)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-left transition-colors ${
                        createRole === option.value
                          ? "border-brand-gold bg-brand-gold/10 text-brand-navy font-medium"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <Check className={`h-3.5 w-3.5 ${createRole === option.value ? "opacity-100" : "opacity-0"}`} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCreateMode(false); setCreateName(""); setCreateRole("terceiros"); }}
                  className="flex-1 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!createName.trim() || creating}
                  className="flex-1 px-3 py-1.5 text-xs rounded-md bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-50 transition-colors font-medium"
                  data-testid={`${testId}-create-confirm`}
                >
                  {creating ? "Criando..." : "Criar favorecido"}
                </button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CategoriaCombobox({
  categorias,
  value,
  onValueChange,
  formTipo,
  biaId,
  prefix,
}: {
  categorias: CategoriaItem[];
  value: number | null;
  onValueChange: (v: number | null) => void;
  formTipo: string;
  biaId?: string;
  prefix: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const base = categorias.filter((cat) => {
      if (!cat.Tipo_de_categoria) return true;
      const norm = cat.Tipo_de_categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return norm === formTipo;
    });
    const sorted = [...base].sort((a, b) => a.Nome_da_categoria.localeCompare(b.Nome_da_categoria, "pt-BR", { numeric: true }));
    if (!search.trim()) return sorted;
    const s = search.toLowerCase();
    return sorted.filter((c) =>
      stripPlanoContaCode(c.Nome_da_categoria).toLowerCase().includes(s) ||
      getPlanoContaGroup(c).toLowerCase().includes(s)
    );
  }, [categorias, formTipo, search]);

  const selected = categorias.find((c) => c.id === value);
  const exactMatch = filtered.some((c) => stripPlanoContaCode(c.Nome_da_categoria).toLowerCase() === search.toLowerCase());
  const grouped = useMemo(() => {
    const groups: Record<string, CategoriaItem[]> = {};
    for (const cat of filtered) {
      const group = getPlanoContaGroup(cat);
      if (!groups[group]) groups[group] = [];
      groups[group].push(cat);
    }
    return Object.entries(groups);
  }, [filtered]);

  async function handleCreate() {
    const nome = (createMode ? createName : search).trim();
    if (!nome) {
      setCreateMode(true);
      return;
    }
    setCreating(true);
    try {
      const res = await apiRequest("POST", "/api/categorias", {
        Nome_da_categoria: nome,
        Tipo_de_categoria: formTipo === "entrada" ? "Entrada" : "Saída",
        Descricao_das_categorias: "Categorias da BIA",
        bia_id: biaId || null,
      });
      const created: CategoriaItem = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/categorias"] });
      onValueChange(created.id);
      setSearch("");
      setCreateName("");
      setCreateMode(false);
      setOpen(false);
      toast({ title: `Categoria "${created.Nome_da_categoria}" criada para esta BIA!` });
    } catch {
      toast({ title: "Erro ao criar categoria", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setCreateMode(false); setCreateName(""); } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`${prefix}-select-categoria`}
          className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selected ? (
            <span className="min-w-0 text-left leading-tight">
              <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {getPlanoContaGroup(selected)}
              </span>
              <span className="block truncate">{stripPlanoContaCode(selected.Nome_da_categoria)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Nenhuma</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start">
        {createMode ? (
          <div className="p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Nova categoria desta BIA</p>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Nome da categoria..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
                if (e.key === "Escape") {
                  setCreateMode(false);
                  setCreateName("");
                }
              }}
              data-testid={`${prefix}-input-nova-categoria`}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => { setCreateMode(false); setCreateName(""); }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1 bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
                disabled={!createName.trim() || creating}
                onClick={handleCreate}
                data-testid={`${prefix}-button-criar-categoria`}
              >
                {creating ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        ) : (
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar categoria..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => { onValueChange(null); setSearch(""); setOpen(false); }}
              >
                <Check className={`mr-2 h-4 w-4 ${value === null ? "opacity-100" : "opacity-0"}`} />
                Nenhuma
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            {filtered.length === 0 && (
              <CommandGroup heading="Categorias">
                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
              </CommandGroup>
            )}
            {grouped.map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {filtered.length === 0 && !search && (
                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
              )}
              {items.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={String(cat.id)}
                  onSelect={() => { onValueChange(cat.id); setSearch(""); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === cat.id ? "opacity-100" : "opacity-0"}`} />
                  {stripPlanoContaCode(cat.Nome_da_categoria)}
                </CommandItem>
              ))}
            </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__create__"
                onSelect={() => {
                  if (search.trim() && !exactMatch) handleCreate();
                  else {
                    setCreateName(search.trim());
                    setCreateMode(true);
                  }
                }}
                disabled={creating}
                className="text-brand-gold cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                {creating
                  ? "Criando..."
                  : search.trim() && !exactMatch
                    ? `Nova categoria: "${search.trim()}"`
                    : "Nova categoria"}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilePickerButton({
  prefix,
  uploading,
  onFilesSelected,
}: {
  prefix: string;
  uploading: boolean;
  onFilesSelected: (files: globalThis.File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    onFilesSelected(Array.from(selected));
    e.target.value = "";
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx"
        onChange={handleChange}
        disabled={uploading}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
        tabIndex={-1}
        data-testid={`${prefix}-input-file`}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:bg-muted/50 transition-colors text-sm text-muted-foreground w-full justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid={`${prefix}-button-upload`}
      >
        <Upload className="w-4 h-4" />
        {uploading ? "Enviando..." : "Selecionar arquivos"}
      </button>
    </div>
  );
}

function InlineFilePickerButton({
  prefix,
  uploading,
  onFilesSelected,
  count = 0,
}: {
  prefix: string;
  uploading: boolean;
  onFilesSelected: (files: globalThis.File[]) => void;
  count?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    onFilesSelected(Array.from(selected));
    e.target.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx"
        onChange={handleChange}
        disabled={uploading}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
        tabIndex={-1}
        data-testid={`${prefix}-input-file`}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={`h-9 w-9 inline-flex items-center justify-center rounded-md border transition-colors shrink-0 ${
          count > 0
            ? "border-brand-gold/60 bg-brand-gold/10 text-brand-navy hover:bg-brand-gold/20"
            : "border-border text-muted-foreground hover:text-brand-navy hover:border-brand-gold/50"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={count > 0 ? `${count} anexo(s) individual(is)` : "Adicionar anexo individual"}
        data-testid={`${prefix}-button-upload`}
      >
        <Paperclip className="w-4 h-4" />
        {count > 0 && <span className="ml-0.5 text-[10px] font-semibold">{count}</span>}
      </button>
    </>
  );
}

function LancamentoFormFields({
  formTipo, setFormTipo,
  formValor, setFormValor,
  formData, setFormData,
  formDescricao, setFormDescricao,
  formCategorias, setFormCategorias,
  formMembro, setFormMembro,
  formFavorecido, setFormFavorecido,
  rateioTipo, setRateioTipo,
  rateioModo, setRateioModo,
  rateioItems, setRateioItems,
  formTiposCpp, setFormTiposCpp,
  formStatus, setFormStatus,
  formDataVencimento, setFormDataVencimento,
  formDataPagamento, setFormDataPagamento,
  membros, tiposCpp, categorias,
  favorecidos,
  selectedBiaId,
  prefix,
  pendingFiles, setPendingFiles,
  existingAnexos, setExistingAnexos,
  uploading,
  isCreate,
  onCreateFavorecido,
}: {
  formTipo: "entrada" | "saida";
  setFormTipo: (v: "entrada" | "saida") => void;
  formValor: string;
  setFormValor: (v: string) => void;
  formData: string;
  setFormData: (v: string) => void;
  formDescricao: string;
  setFormDescricao: (v: string) => void;
  formCategorias: number | null;
  setFormCategorias: (v: number | null) => void;
  formMembro: string;
  setFormMembro: (v: string) => void;
  formFavorecido: string;
  setFormFavorecido: (v: string) => void;
  rateioTipo: "individual" | "grupo";
  setRateioTipo: (v: "individual" | "grupo") => void;
  rateioModo: RateioModo;
  setRateioModo: (v: RateioModo) => void;
  rateioItems: RateioItem[];
  setRateioItems: (items: RateioItem[]) => void;
  formTiposCpp: number | null;
  setFormTiposCpp: (v: number | null) => void;
  formStatus: StatusPagamento | "";
  setFormStatus: (v: StatusPagamento | "") => void;
  formDataVencimento: string;
  setFormDataVencimento: (v: string) => void;
  formDataPagamento: string;
  setFormDataPagamento: (v: string) => void;
  membros: Membro[];
  favorecidos?: Membro[];
  tiposCpp: TipoCPP[];
  categorias: CategoriaItem[];
  selectedBiaId?: string;
  prefix: string;
  pendingFiles: globalThis.File[];
  setPendingFiles: (files: globalThis.File[]) => void;
  existingAnexos: AnexoFile[];
  setExistingAnexos: (files: AnexoFile[]) => void;
  uploading: boolean;
  isCreate?: boolean;
  onCreateFavorecido?: (nome: string, papel: PapelFavorecidoBia) => Promise<Membro | null>;
}) {
  const favorecidosOptions = favorecidos ?? membros;
  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const formatted = formatInputBRL(raw);
    setFormValor(formatted);
  }

  function addRateioItem() {
    setRateioItems([...rateioItems, { id: String(Date.now() + Math.random()), membroId: "__none__", valor: "", anexos: [] }]);
  }

  function removeRateioItem(id: string) {
    setRateioItems(rateioItems.filter((item) => item.id !== id));
  }

  function updateRateioItem(id: string, field: "membroId" | "valor", value: string) {
    setRateioItems(rateioItems.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  const valorTotal = parseBRLToNumber(formValor);
  const getRateioItemValor = (item: RateioItem) => {
    const rawValue = parseBRLToNumber(item.valor);
    return rateioModo === "percentual" ? (valorTotal * rawValue) / 100 : rawValue;
  };
  const totalRateado = rateioItems.reduce((acc, item) => acc + getRateioItemValor(item), 0);

  function addRateioItemFiles(id: string, files: globalThis.File[]) {
    setRateioItems(rateioItems.map((item) =>
      item.id === id ? { ...item, anexos: [...(item.anexos || []), ...files] } : item
    ));
  }

  function removeRateioItemFile(id: string, fileIndex: number) {
    setRateioItems(rateioItems.map((item) =>
      item.id === id
        ? { ...item, anexos: (item.anexos || []).filter((_, i) => i !== fileIndex) }
        : item
    ));
  }

  function removePendingFile(index: number) {
    setPendingFiles(pendingFiles.filter((_, i) => i !== index));
  }

  function removeExistingAnexo(index: number) {
    setExistingAnexos(existingAnexos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={formTipo} onValueChange={(v) => { setFormTipo(v as "entrada" | "saida"); setFormCategorias(null); }}>
          <SelectTrigger data-testid={`${prefix}-select-tipo`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="entrada">
              <span className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-green-500" />
                Entrada (Aporte)
              </span>
            </SelectItem>
            <SelectItem value="saida">
              <span className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-500" />
                Saída (Custo)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Valor (R$)</Label>
        <Input
          type="text"
          inputMode="numeric"
          value={formValor}
          onChange={handleValorChange}
          placeholder="0,00"
          data-testid={`${prefix}-input-valor`}
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> Data do Lançamento
        </Label>
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50 text-muted-foreground text-sm" data-testid={`${prefix}-input-data`}>
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          {formData ? new Date(formData + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={formDescricao}
          onChange={(e) => setFormDescricao(e.target.value)}
          placeholder="Descrição do lançamento"
          data-testid={`${prefix}-input-descricao`}
        />
      </div>

      <div className="space-y-2">
        <Label>Categoria</Label>
        <CategoriaCombobox
          categorias={categorias}
          value={formCategorias}
          onValueChange={setFormCategorias}
          formTipo={formTipo}
          biaId={selectedBiaId}
          prefix={prefix}
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          Responsável pelo Lançamento
          {formTipo === "entrada" && <span className="text-red-500 text-xs">*obrigatório</span>}
        </Label>
        <SearchableMembroSelect
          membros={membros}
          value={formMembro}
          onValueChange={setFormMembro}
          placeholder="Selecione um membro..."
          testId={`${prefix}-select-membro`}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Favorecido</Label>
          {isCreate && (
            <div className="flex gap-0.5 p-0.5 bg-muted rounded-md">
              <button
                type="button"
                onClick={() => { setRateioTipo("individual"); }}
                className={`px-2.5 py-1 text-xs rounded transition-all ${rateioTipo === "individual" ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`${prefix}-rateio-individual`}
              >
                Individual
              </button>
              <button
                type="button"
                onClick={() => { setRateioTipo("grupo"); if (rateioItems.length === 0) addRateioItem(); }}
                className={`px-2.5 py-1 text-xs rounded transition-all ${rateioTipo === "grupo" ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`${prefix}-rateio-grupo`}
              >
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />Em Grupo</span>
              </button>
            </div>
          )}
        </div>

        {(!isCreate || rateioTipo === "individual") ? (
          <SearchableMembroSelect
            membros={favorecidosOptions}
            value={formFavorecido}
            onValueChange={setFormFavorecido}
            placeholder="Selecione o favorecido..."
            testId={`${prefix}-select-favorecido`}
            allowNone
            allowCreate={!!onCreateFavorecido}
            onCreateNew={onCreateFavorecido}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-3">
              <div className="flex gap-0.5 p-0.5 bg-muted rounded-md shrink-0">
                <button
                  type="button"
                  onClick={() => setRateioModo("percentual")}
                  className={`px-2.5 py-1 text-xs rounded transition-all ${rateioModo === "percentual" ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid={`${prefix}-rateio-modo-percentual`}
                >
                  <span className="flex items-center gap-1"><BadgePercent className="w-3 h-3" />%</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRateioModo("valor")}
                  className={`px-2.5 py-1 text-xs rounded transition-all ${rateioModo === "valor" ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid={`${prefix}-rateio-modo-valor`}
                >
                  <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />R$</span>
                </button>
              </div>
            </div>

            {valorTotal > 0 && (
              <div className={`flex items-center justify-between text-xs px-2 py-1.5 rounded border ${Math.abs(totalRateado - valorTotal) < 0.01 ? "bg-green-50 border-green-200 text-green-700" : totalRateado > valorTotal ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                <span>Rateado: <strong>{formatBRL(totalRateado)}</strong></span>
                <span>Valor total: <strong>{formatBRL(valorTotal)}</strong></span>
                {Math.abs(totalRateado - valorTotal) < 0.01 && <span className="font-medium">✓ Balanceado</span>}
                {totalRateado > valorTotal && <span className="font-medium">⚠ Excede valor total</span>}
                {totalRateado < valorTotal && totalRateado > 0 && <span className="text-amber-600 font-medium">Diferença: {formatBRL(valorTotal - totalRateado)}</span>}
              </div>
            )}

            <div className="space-y-2">
              {rateioItems.map((item, idx) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 min-w-0">
                      <SearchableMembroSelect
                        membros={favorecidosOptions}
                        value={item.membroId}
                        onValueChange={(v) => updateRateioItem(item.id, "membroId", v)}
                        placeholder={`Favorecido ${idx + 1}...`}
                        testId={`${prefix}-rateio-membro-${idx}`}
                        allowNone
                      />
                    </div>
                    <div className="w-32 shrink-0 relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={item.valor}
                        onChange={(e) => updateRateioItem(
                          item.id,
                          "valor",
                          rateioModo === "percentual" ? formatInputPercent(e.target.value) : formatInputBRL(e.target.value)
                        )}
                        placeholder="0,00"
                        className="text-sm h-9 pr-9"
                        data-testid={`${prefix}-rateio-valor-${idx}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {rateioModo === "percentual" ? "%" : "R$"}
                      </span>
                    </div>
                    <InlineFilePickerButton
                      prefix={`${prefix}-rateio-anexo-${idx}`}
                      uploading={uploading}
                      count={(item.anexos || []).length}
                      onFilesSelected={(files) => addRateioItemFiles(item.id, files)}
                    />
                    <button
                      type="button"
                      onClick={() => removeRateioItem(item.id)}
                      className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                      data-testid={`${prefix}-rateio-remove-${idx}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {(item.anexos || []).length > 0 && (
                    <div className="pl-1 flex flex-wrap gap-1.5">
                      {(item.anexos || []).map((file, fileIndex) => (
                        <span key={`${file.name}-${fileIndex}`} className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                          <Paperclip className="w-3 h-3" />
                          <span className="max-w-[180px] truncate">{file.name}</span>
                          <button
                            type="button"
                            className="text-blue-700 hover:text-red-600"
                            onClick={() => removeRateioItemFile(item.id, fileIndex)}
                            data-testid={`${prefix}-rateio-anexo-remove-${idx}-${fileIndex}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRateioItem}
              className="w-full border-dashed"
              data-testid={`${prefix}-rateio-adicionar`}
            >
              <Plus className="w-3 h-3 mr-1" />
              Adicionar Favorecido
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tipo de CPP</Label>
        <Select
          value={formTiposCpp != null ? String(formTiposCpp) : "__none__"}
          onValueChange={(v) => setFormTiposCpp(v === "__none__" ? null : parseInt(v, 10))}
        >
          <SelectTrigger data-testid={`${prefix}-select-tipo-cpp`}>
            <SelectValue placeholder="Selecione um tipo de CPP..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum</SelectItem>
            {tiposCpp.map((cpp) => (
              <SelectItem key={cpp.id} value={String(cpp.id)}>
                {cpp.Nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-t border-border/50 pt-4 mt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
          <Receipt className="w-3.5 h-3.5" /> Controle Financeiro
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">Status do Pagamento <span className="text-red-500 text-xs">*obrigatório</span></Label>
            <Select
              value={formStatus || "__none__"}
              onValueChange={(v) => setFormStatus(v === "__none__" ? "" : v as StatusPagamento)}
            >
              <SelectTrigger data-testid={`${prefix}-select-status`}>
                <SelectValue placeholder="Selecione o status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não definido</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Vencimento <span className="text-red-500 text-xs">*obrigatório</span></Label>
              <Input
                type="date"
                value={formDataVencimento}
                onChange={(e) => setFormDataVencimento(e.target.value)}
                data-testid={`${prefix}-input-data-vencimento`}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><CalendarCheck className="w-3.5 h-3.5" /> Data do Pagamento</Label>
              <Input
                type="date"
                value={formDataPagamento}
                onChange={(e) => setFormDataPagamento(e.target.value)}
                data-testid={`${prefix}-input-data-pagamento`}
              />
            </div>
          </div>

        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          Comprovantes / Anexos
        </Label>

        {existingAnexos.length > 0 && (
          <div className="space-y-1">
            {existingAnexos.map((anexo, i) => {
              const displayName = anexo.filename || anexo.title || anexo.id;
              const IconComp = getFileIcon(displayName);
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm">
                  <IconComp className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-gold hover:underline flex-1" data-testid={`link-anexo-existing-${i}`}>
                    {displayName}
                  </a>
                  {anexo.size && <span className="text-xs text-muted-foreground shrink-0">{(Number(anexo.size) / 1024).toFixed(0)} KB</span>}
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeExistingAnexo(i)} data-testid={`button-remove-existing-anexo-${i}`}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="space-y-1">
            {pendingFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950/30 text-sm">
                <Upload className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removePendingFile(i)} data-testid={`button-remove-pending-file-${i}`}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <FilePickerButton
          prefix={prefix}
          uploading={uploading}
          onFilesSelected={(files) => setPendingFiles([...pendingFiles, ...files])}
        />
        <p className="text-xs text-muted-foreground">PDF, imagens, Word ou Excel. Máx. 10MB por arquivo.</p>
      </div>
    </div>
  );
}

export default function FluxoCaixaPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [selectedBiaId, setSelectedBiaId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [profileMembro, setProfileMembro] = useState<Membro | null>(null);
  const [anexosModal, setAnexosModal] = useState<{ id: string; anexos: any[] } | null>(null);
  const [boletoItem, setBoletoItem] = useState<FluxoCaixaItem | null>(null);
  const [boletoPais, setBoletoPais] = useState<"brasil" | "fora">("brasil");
  const [boletoNome, setBoletoNome] = useState("");
  const [boletoEmail, setBoletoEmail] = useState("");
  const [boletoDocumento, setBoletoDocumento] = useState("");
  const [boletoUrl, setBoletoUrl] = useState("");

  const [formTipo, setFormTipo] = useState<"entrada" | "saida">("entrada");
  const [formValor, setFormValor] = useState<string>("");
  const [formData, setFormData] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formDescricao, setFormDescricao] = useState<string>("");
  const [formCategorias, setFormCategorias] = useState<number | null>(null);
  const [formMembro, setFormMembro] = useState<string>("");
  const [formFavorecido, setFormFavorecido] = useState<string>("__none__");
  const [rateioTipo, setRateioTipo] = useState<"individual" | "grupo">("individual");
  const [rateioModo, setRateioModo] = useState<RateioModo>("percentual");
  const [rateioItems, setRateioItems] = useState<RateioItem[]>([]);
  const [formTiposCpp, setFormTiposCpp] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState<StatusPagamento | "">("");
  const [formDataVencimento, setFormDataVencimento] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formDataPagamento, setFormDataPagamento] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<globalThis.File[]>([]);
  const [existingAnexos, setExistingAnexos] = useState<AnexoFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // Transferência de cotas state
  interface Destinatario { membroId: string; percentual: number; }
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferOrigemId, setTransferOrigemId] = useState<string>("");
  const [transferObservacoes, setTransferObservacoes] = useState<string>("");
  const [transferValorRef, setTransferValorRef] = useState<number>(0);
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([{ membroId: "", percentual: 100 }]);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [transferPendingFiles, setTransferPendingFiles] = useState<globalThis.File[]>([]);
  const [transferExistingAnexos, setTransferExistingAnexos] = useState<AnexoFile[]>([]);
  const [transferUploading, setTransferUploading] = useState(false);
  const [rejeicaoDialogId, setRejeicaoDialogId] = useState<string | null>(null);
  const [rejeicaoMotivo, setRejeicaoMotivo] = useState<string>("");

  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterCategoria, setFilterCategoria] = useState<string>("todos");
  const [filterMembro, setFilterMembro] = useState<string>("todos");
  const [filterFavorecido, setFilterFavorecido] = useState<string>("todos");
  const [filterTipoCpp, setFilterTipoCpp] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterDescricao, setFilterDescricao] = useState<string>("");
  const [filterDataDe, setFilterDataDe] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [filterDataAte, setFilterDataAte] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  });

  // Defaults used to detect when filters differ from initial state
  const defaultDataDe = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const defaultDataAte = (() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  })();

  const { data: bias = [], isLoading: loadingBias } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  // Auto-select the last used BIA (or first in list) when bias loads
  useEffect(() => {
    if (bias.length > 0 && !selectedBiaId) {
      const lastUsed = localStorage.getItem("fluxo-caixa-bia-id");
      const found = lastUsed ? bias.find((b) => b.id === lastUsed) : null;
      setSelectedBiaId(found ? lastUsed! : bias[0].id);
    }
  }, [bias, selectedBiaId]);

  function handleBiaChange(id: string) {
    setSelectedBiaId(id);
    localStorage.setItem("fluxo-caixa-bia-id", id);
  }

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
  });

  const { data: tiposCpp = [] } = useQuery<TipoCPP[]>({
    queryKey: ["/api/tipos-cpp"],
  });

  const { data: categorias = [] } = useQuery<CategoriaItem[]>({
    queryKey: ["/api/categorias", selectedBiaId],
    queryFn: () => fetch(`/api/categorias${selectedBiaId ? `?bia_id=${encodeURIComponent(selectedBiaId)}` : ""}`).then((r) => {
      if (!r.ok) throw new Error("Erro ao buscar categorias");
      return r.json();
    }),
  });

  const { data: allFluxo = [], isLoading: loadingFluxo } = useQuery<FluxoCaixaItem[]>({
    queryKey: ["/api/fluxo-caixa"],
  });

  const { data: transferencias = [] } = useQuery<TransferenciaCotas[]>({
    queryKey: ["/api/transferencia-cotas", selectedBiaId],
    queryFn: async () => {
      if (!selectedBiaId) return [];
      const res = await fetch(`/api/transferencia-cotas?bia_id=${selectedBiaId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedBiaId,
  });

  const totalPercentual = destinatarios.reduce((s, d) => s + (d.percentual || 0), 0);
  const destValidos = destinatarios.every((d) => d.membroId !== "");
  const hasDuplicateDest = destinatarios.length !== new Set(destinatarios.map((d) => d.membroId).filter(Boolean)).size;

  const createTransferMutation = useMutation({
    mutationFn: async () => {
      if (!transferOrigemId) throw new Error("Membro de origem não definido");
      if (!destValidos) throw new Error("Selecione todos os membros destinatários");
      if (hasDuplicateDest) throw new Error("Destinatários duplicados");
      if (totalPercentual > 100) throw new Error("A soma dos percentuais não pode exceder 100%");
      if (totalPercentual <= 0) throw new Error("A soma dos percentuais deve ser maior que 0%");
      const observacoes = transferObservacoes.trim();
      if (!observacoes) throw new Error("Informe o motivo da transferência");
      setTransferUploading(true);
      try {
        const newFileIds = await uploadFiles(transferPendingFiles);
        const anexos = [...transferExistingAnexos.map((a) => a.id), ...newFileIds];
        if (editingTransferId) {
          const dest = destinatarios[0];
          const valor = parseFloat(((dest.percentual / 100) * transferValorRef).toFixed(2));
          await apiRequest("PATCH", `/api/transferencia-cotas/${editingTransferId}`, {
            action: "editar",
            membro_destino_id: dest.membroId,
            valor_total: valor,
            percentual_transferencia: dest.percentual,
            observacoes,
            anexos,
          });
          return;
        }
        for (const dest of destinatarios) {
          const valor = parseFloat(((dest.percentual / 100) * transferValorRef).toFixed(2));
          await apiRequest("POST", "/api/transferencia-cotas", {
            bia_id: selectedBiaId,
            membro_origem_id: transferOrigemId,
            membro_destino_id: dest.membroId,
            valor_total: valor,
            percentual_transferencia: dest.percentual,
            observacoes,
            anexos,
          });
        }
      } finally {
        setTransferUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transferencia-cotas", selectedBiaId] });
      setTransferDialogOpen(false);
      const wasEditing = !!editingTransferId;
      const n = destinatarios.length;
      resetTransferForm();
      toast({
        title: wasEditing ? "Solicitação atualizada" : "Solicitação enviada",
        description: wasEditing
          ? "A solicitação de transferência foi atualizada."
          : `${n} solicitaç${n === 1 ? "ão criada" : "ões criadas"}. Aguardando aprovação do Diretor de Aliança ou Aliado BUILT.`,
      });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function handleDividirIgualmente() {
    const n = destinatarios.length;
    if (n === 0) return;
    const base = Math.floor(100 / n);
    const resto = 100 - base * n;
    setDestinatarios(destinatarios.map((d, i) => ({ ...d, percentual: i === n - 1 ? base + resto : base })));
  }

  function updateDestinatario(idx: number, field: "membroId" | "percentual", value: string | number) {
    setDestinatarios((prev) => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }

  function addDestinatario() {
    setDestinatarios((prev) => [...prev, { membroId: "", percentual: 0 }]);
  }

  function removeDestinatario(idx: number) {
    setDestinatarios((prev) => prev.filter((_, i) => i !== idx));
  }

  const aceitarTransferMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/transferencia-cotas/${id}`, { action: "aceitar" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transferencia-cotas", selectedBiaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/fluxo-caixa"] });
      toast({ title: "Transferência aceita!", description: "As cotas foram transferidas com sucesso." });
    },
    onError: (e: any) => toast({ title: "Erro ao aceitar", description: e.message, variant: "destructive" }),
  });

  const rejeitarTransferMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      return apiRequest("PATCH", `/api/transferencia-cotas/${id}`, { action: "rejeitar", motivo_rejeicao: motivo || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transferencia-cotas", selectedBiaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/fluxo-caixa"] });
      setRejeicaoDialogId(null);
      setRejeicaoMotivo("");
      toast({ title: "Solicitação rejeitada" });
    },
    onError: (e: any) => toast({ title: "Erro ao rejeitar", description: e.message, variant: "destructive" }),
  });

  const MARCA_VALOR_ORIGEM = "Valor de Origem da BIA";
  const isValorOrigemAuto = (item: FluxoCaixaItem) => item.descricao === MARCA_VALOR_ORIGEM;

  const fluxoItemsAll = useMemo(() => {
    if (!selectedBiaId) return [];
    return allFluxo
      .filter((item) => {
        const biaId = typeof item.bia === "object" && item.bia !== null ? (item.bia as any).id : item.bia;
        return biaId === selectedBiaId;
      })
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [allFluxo, selectedBiaId]);

  // itens que entram no fluxo de caixa (excluindo o lançamento automático de Valor de Origem)
  const fluxoItemsContabeis = useMemo(() => {
    return fluxoItemsAll.filter((item) => !isValorOrigemAuto(item));
  }, [fluxoItemsAll]);

  const fluxoItems = useMemo(() => {
    const filtered = fluxoItemsAll.filter((item) => {
      if (filterTipo !== "todos" && item.tipo !== filterTipo) return false;
      if (filterDescricao && !(item.descricao || "").toLowerCase().includes(filterDescricao.toLowerCase())) return false;
      if (filterCategoria !== "todos") {
        const catArr = item.Categoria || [];
        const hasCat = catArr.some((c) => String(getRelId(c as any)) === filterCategoria);
        if (!hasCat) return false;
      }
      if (filterMembro !== "todos") {
        const mid = getRelId(item.membro_responsavel as any);
        if (mid !== filterMembro) return false;
      }
      if (filterFavorecido !== "todos") {
        const favArr = item.Favorecido || [];
        const hasFav = favArr.some((f) => String(getRelId(f as any)) === filterFavorecido);
        if (!hasFav) return false;
      }
      if (filterTipoCpp !== "todos") {
        const cppArr = item.tipo_de_cpp || [];
        const hasCpp = cppArr.some((c) => String(getRelId(c as any)) === filterTipoCpp);
        if (!hasCpp) return false;
      }
      if (filterDataDe && item.data_vencimento && item.data_vencimento < filterDataDe) return false;
      if (filterDataAte && item.data_vencimento && item.data_vencimento > filterDataAte) return false;
      if (filterStatus !== "todos") {
        const effectiveStatus = isVencido(item) ? "vencido" : (item.status || "pendente");
        if (effectiveStatus !== filterStatus) return false;
      }
      return true;
    });

    const statusPriority = (item: FluxoCaixaItem): number => {
      const effective = isVencido(item) ? "vencido" : (item.status || "pendente");
      if (effective === "agendado") return 0;
      if (effective === "vencido") return 1;
      return 2;
    };

    return filtered.sort((a, b) => {
      const pa = statusPriority(a);
      const pb = statusPriority(b);
      if (pa !== pb) return pa - pb;
      const da = a.data_vencimento || "";
      const db = b.data_vencimento || "";
      if (da && db) return db < da ? -1 : db > da ? 1 : 0;
      if (da) return -1;
      if (db) return 1;
      return 0;
    });
  }, [fluxoItemsAll, filterTipo, filterCategoria, filterMembro, filterFavorecido, filterTipoCpp, filterDescricao, filterDataDe, filterDataAte, filterStatus]);

  const totals = useMemo(() => {
    const entradas = fluxoItemsContabeis
      .filter((i) => i.tipo === "entrada" && i.status === "pago")
      .reduce((sum, i) => sum + (parseFloat(String(i.valor)) || 0), 0);
    const saidas = fluxoItemsContabeis
      .filter((i) => i.tipo === "saida" && i.status === "pago")
      .reduce((sum, i) => sum + (parseFloat(String(i.valor)) || 0), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [fluxoItemsContabeis]);

  const today = new Date().toISOString().split("T")[0];
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const financialDashboard = useMemo(() => {
    const allBia = fluxoItemsContabeis;
    const contasPagar = allBia.filter(
      (i) => i.tipo === "saida" && i.status === "agendado" && !isVencido(i)
    );
    const vencidas = allBia.filter((i) => i.tipo === "saida" && isVencido(i));
    const aVencer7 = allBia.filter(
      (i) => i.tipo === "saida" && i.data_vencimento
        && i.data_vencimento >= today && i.data_vencimento <= in7days
        && i.status !== "pago" && i.status !== "cancelado"
    );
    const aReceber = allBia.filter(
      (i) => i.tipo === "entrada" && (i.status === "pendente" || i.status === "agendado" || !i.status)
    );
    const sum = (arr: FluxoCaixaItem[]) => arr.reduce((s, i) => s + (parseFloat(String(i.valor)) || 0), 0);
    return {
      contasPagar: { count: contasPagar.length, valor: sum(contasPagar) },
      vencidas:    { count: vencidas.length,    valor: sum(vencidas) },
      aVencer7:    { count: aVencer7.length,    valor: sum(aVencer7) },
      aReceber:    { count: aReceber.length,    valor: sum(aReceber) },
    };
  }, [fluxoItemsAll, today, in7days]);

  const selectedBia = bias.find((b) => b.id === selectedBiaId);
  const favorecidosDaBia = useMemo(() => {
    if (!selectedBia) return [];
    const ids = new Set<string>();
    [
      selectedBia.aliado_built,
      selectedBia.diretor_alianca,
      selectedBia.diretor_nucleo_tecnico,
      selectedBia.diretor_execucao,
      selectedBia.diretor_comercial,
      selectedBia.diretor_capital,
      ...parseMemberList(selectedBia.socios_multiplicadores),
      ...parseMemberList(selectedBia.socios_guardioes),
      ...parseMemberList(selectedBia.terceiros),
    ].filter(Boolean).forEach((id) => ids.add(String(id)));
    return membros.filter((m) => ids.has(m.id));
  }, [membros, selectedBia]);

  const aportesPorMembro = useMemo(() => {
    const entradas = fluxoItemsContabeis.filter((i) => i.tipo === "entrada" && i.Favorecido && i.Favorecido.length > 0);
    const map: Record<string, number> = {};
    const nameMap: Record<string, string> = {};
    entradas.forEach((i) => {
      const fav = (i.Favorecido || [])[0] as any;
      const mid = getRelId(fav);
      if (mid) {
        map[mid] = (map[mid] || 0) + (parseFloat(String(i.valor)) || 0);
        if (!nameMap[mid] && typeof fav === "object" && fav !== null) {
          const n = fav.Nome_de_usuario || fav.nome || fav.nome_completo || fav.razao_social;
          if (n) nameMap[mid] = n;
        }
      }
    });
    const totalAportesComMembro = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([membroId, valor]) => ({
        membroId,
        inlineName: nameMap[membroId] || null,
        valor,
        percentual: totalAportesComMembro > 0 ? (valor / totalAportesComMembro) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [fluxoItemsContabeis]);

  const alocacaoPorPapel = useMemo(() => {
    const multiplicadores = new Set(parseMemberList(selectedBia?.socios_multiplicadores));
    const guardioes = new Set(parseMemberList(selectedBia?.socios_guardioes));
    return {
      guardioes: aportesPorMembro.filter((item) => guardioes.has(item.membroId)),
      multiplicadores: aportesPorMembro.filter((item) => multiplicadores.has(item.membroId)),
      naoClassificados: aportesPorMembro.filter((item) => !guardioes.has(item.membroId) && !multiplicadores.has(item.membroId)),
    };
  }, [aportesPorMembro, selectedBia]);

  async function uploadFiles(files: globalThis.File[]): Promise<string[]> {
    if (files.length === 0) return [];
    const formDataObj = new FormData();
    files.forEach((f) => formDataObj.append("files", f));
    const response = await fetch("/api/upload", { method: "POST", body: formDataObj });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Erro no upload" }));
      throw new Error(err.error || "Erro ao enviar arquivos");
    }
    const result = await response.json();
    return result.fileIds;
  }

  function normalizeTransferAnexos(anexos?: (AnexoFile | string)[] | null): AnexoFile[] {
    if (!Array.isArray(anexos)) return [];
    return anexos
      .filter(Boolean)
      .map((anexo) => {
        if (typeof anexo === "string") {
          return { id: anexo, filename: "Anexo", url: `/api/assets/${anexo}` };
        }
        return {
          id: anexo.id,
          title: anexo.title,
          filename: anexo.filename || anexo.title || "Anexo",
          url: anexo.url || `/api/assets/${anexo.id}`,
          size: anexo.size,
        };
      })
      .filter((anexo) => !!anexo.id);
  }

  function resetTransferForm() {
    setEditingTransferId(null);
    setTransferOrigemId("");
    setTransferValorRef(0);
    setTransferObservacoes("");
    setDestinatarios([{ membroId: "", percentual: 100 }]);
    setTransferPendingFiles([]);
    setTransferExistingAnexos([]);
  }

  function openTransferDialog(membroId: string, valor: number) {
    resetTransferForm();
    setTransferOrigemId(membroId);
    setTransferValorRef(valor);
    setTransferDialogOpen(true);
  }

  function openEditTransferDialog(transfer: TransferenciaCotas) {
    const percentual = parseFloat(transfer.percentual_transferencia || "0") || 0;
    const valor = parseFloat(transfer.valor_total || "0") || 0;
    const aporteOrigem = aportesPorMembro.find((a) => a.membroId === transfer.membro_origem_id)?.valor;
    const valorRef = percentual > 0 ? valor / (percentual / 100) : (aporteOrigem || valor);
    setEditingTransferId(transfer.id);
    setTransferOrigemId(transfer.membro_origem_id);
    setTransferValorRef(Number.isFinite(valorRef) ? valorRef : 0);
    setDestinatarios([{ membroId: transfer.membro_destino_id, percentual }]);
    setTransferObservacoes(transfer.observacoes || "");
    setTransferPendingFiles([]);
    setTransferExistingAnexos(normalizeTransferAnexos(transfer.anexos));
    setTransferDialogOpen(true);
  }

  function removeTransferPendingFile(index: number) {
    setTransferPendingFiles((files) => files.filter((_, i) => i !== index));
  }

  function removeTransferExistingAnexo(index: number) {
    setTransferExistingAnexos((files) => files.filter((_, i) => i !== index));
  }

  function buildPayload(newFileIds: string[]) {
    const existingIds = existingAnexos.map((a) => a.id);
    const allIds = [...existingIds, ...newFileIds];
    const payload: Record<string, unknown> = {
      bia: selectedBiaId,
      tipo: formTipo,
      valor: parseBRLToNumber(formValor),
      data: formData,
      descricao: formDescricao,
      membro_responsavel: formMembro || null,
      status: formStatus || null,
      data_vencimento: formDataVencimento || null,
      data_pagamento: formDataPagamento || null,
      Categoria: formCategorias != null ? [formCategorias] : [],
      tipo_de_cpp: formTiposCpp != null ? [formTiposCpp] : [],
      Favorecido: formFavorecido && formFavorecido !== "__none__" ? [formFavorecido] : [],
      anexos: allIds,
    };
    return payload;
  }

  function getRateioValorFinal(item: RateioItem) {
    const rawValue = parseBRLToNumber(item.valor);
    const valorTotal = parseBRLToNumber(formValor);
    return rateioModo === "percentual" ? Number(((valorTotal * rawValue) / 100).toFixed(2)) : rawValue;
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      try {
        const newFileIds = await uploadFiles(pendingFiles);
        if (rateioTipo === "grupo" && rateioItems.length > 0) {
          const base = buildPayload(newFileIds);
          for (const item of rateioItems) {
            const itemFileIds = await uploadFiles(item.anexos || []);
            const payload = {
              ...base,
              valor: getRateioValorFinal(item),
              Favorecido: item.membroId && item.membroId !== "__none__" ? [item.membroId] : [],
              anexos: [...newFileIds, ...itemFileIds],
            };
            await apiRequest("POST", "/api/fluxo-caixa", payload);
          }
        } else {
          await apiRequest("POST", "/api/fluxo-caixa", buildPayload(newFileIds));
        }
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fluxo-caixa"] });
      const count = rateioTipo === "grupo" ? rateioItems.length : 1;
      toast({ title: count > 1 ? `${count} lançamentos criados com sucesso` : "Lançamento criado com sucesso" });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar lançamento", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      setUploading(true);
      try {
        const newFileIds = await uploadFiles(pendingFiles);
        const payload = buildPayload(newFileIds);
        delete payload.bia;
        await apiRequest("PATCH", `/api/fluxo-caixa/${id}`, payload);
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fluxo-caixa"] });
      toast({ title: "Lançamento atualizado com sucesso" });
      resetForm();
      setEditDialogOpen(false);
      setEditingItemId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar lançamento", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/fluxo-caixa/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fluxo-caixa"] });
      toast({ title: "Lançamento excluído" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const gerarBoletoMutation = useMutation({
    mutationFn: async () => {
      if (!boletoItem) throw new Error("Lancamento nao selecionado");
      const res = await apiRequest("POST", `/api/fluxo-caixa/${boletoItem.id}/gerar-pagamento`, {
        pais: boletoPais,
        nome: boletoNome.trim(),
        email: boletoEmail.trim(),
        documento: boletoDocumento.trim(),
      });
      return res.json() as Promise<{ provider: "asaas" | "stripe"; id: string; url: string; status: string }>;
    },
    onSuccess: (data) => {
      setBoletoUrl(data.url);
      queryClient.invalidateQueries({ queryKey: ["/api/fluxo-caixa"] });
      toast({ title: "Pagamento gerado", description: "O link de pagamento esta pronto." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao gerar pagamento", description: readableApiError(error), variant: "destructive" });
    },
  });

  function openBoletoDialog(item: FluxoCaixaItem) {
    setBoletoItem(item);
    setBoletoPais(item.pagamento_pais || "brasil");
    setBoletoNome(item.pagamento_pagador_nome || "");
    setBoletoEmail(item.pagamento_pagador_email || "");
    setBoletoDocumento(item.pagamento_pagador_documento || "");
    setBoletoUrl(item.pagamento_url || "");
  }

  function resetForm() {
    setFormTipo("entrada");
    setFormValor("");
    setFormData(new Date().toISOString().split("T")[0]);
    setFormDescricao("");
    setFormCategorias(null);
    setFormMembro(currentUser?.membro_directus_id || "");
    setFormFavorecido("__none__");
    setRateioTipo("individual");
    setRateioModo("percentual");
    setRateioItems([]);
    setFormTiposCpp(null);
    setFormStatus("");
    setFormDataVencimento(new Date().toISOString().split("T")[0]);
    setFormDataPagamento("");
    setPendingFiles([]);
    setExistingAnexos([]);
  }

  async function handleCreateFavorecido(nome: string, papel: PapelFavorecidoBia): Promise<Membro | null> {
    if (!selectedBia) {
      toast({ title: "Selecione uma BIA antes de criar o favorecido", variant: "destructive" });
      return null;
    }
    try {
      const res = await apiRequest("POST", "/api/membros/criar-favorecido", { nome });
      const newMembro: Membro = await res.json();
      queryClient.setQueryData<Membro[]>(["/api/membros"], (prev) =>
        prev ? [...prev, newMembro] : [newMembro]
      );
      const multiplicadores = parseMemberList(selectedBia.socios_multiplicadores).filter((id) => id !== newMembro.id);
      const guardioes = parseMemberList(selectedBia.socios_guardioes).filter((id) => id !== newMembro.id);
      const terceiros = parseMemberList(selectedBia.terceiros).filter((id) => id !== newMembro.id);
      if (papel === "socios_multiplicadores") multiplicadores.push(newMembro.id);
      if (papel === "socios_guardioes") guardioes.push(newMembro.id);
      if (papel === "terceiros") terceiros.push(newMembro.id);
      await apiRequest("PATCH", `/api/bias/${selectedBia.id}`, {
        socios_multiplicadores: multiplicadores,
        socios_guardioes: guardioes,
        terceiros,
      });
      queryClient.setQueryData<BiasProjeto[]>(["/api/bias"], (prev = []) =>
        prev.map((b) => b.id === selectedBia.id
          ? { ...b, socios_multiplicadores: multiplicadores, socios_guardioes: guardioes, terceiros }
          : b
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/bias"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membros"] });
      return newMembro;
    } catch (error: any) {
      toast({ title: "Erro ao criar favorecido", description: error.message, variant: "destructive" });
      return null;
    }
  }

  function openEditDialog(item: FluxoCaixaItem) {
    setEditingItemId(item.id);
    setFormTipo(item.tipo);
    const numVal = parseFloat(String(item.valor)) || 0;
    setFormValor(numVal > 0 ? numVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
    setFormData(item.data || new Date().toISOString().split("T")[0]);
    setFormDescricao(item.descricao || "");

    const catArr = item.Categoria || [];
    const firstCat = catArr.length > 0 ? getRelId(catArr[0] as any) : null;
    setFormCategorias(firstCat ? parseInt(firstCat, 10) : null);

    setFormMembro(getRelId(item.membro_responsavel as any) || "");

    const favArr = item.Favorecido || [];
    const firstFav = favArr.length > 0 ? getRelId(favArr[0] as any) : null;
    setFormFavorecido(firstFav || "__none__");

    const cppArr = item.tipo_de_cpp || [];
    const firstCpp = cppArr.length > 0 ? getRelId(cppArr[0] as any) : null;
    setFormTiposCpp(firstCpp ? parseInt(firstCpp, 10) : null);

    setFormStatus((item.status as StatusPagamento) || "");
    setFormDataVencimento(item.data_vencimento || "");
    setFormDataPagamento(item.data_pagamento || "");

    setPendingFiles([]);
    const rawAnexos = item.anexos || [];
    const normalizedAnexos: AnexoFile[] = rawAnexos.map((a: any) =>
      typeof a === "string"
        ? { id: a, url: a, filename: a.split("/").pop() || a }
        : a
    );
    setExistingAnexos(normalizedAnexos);

    setEditDialogOpen(true);
  }

  function handleSubmit() {
    if (!formValor || parseBRLToNumber(formValor) <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    if (!formDescricao.trim()) {
      toast({ title: "Informe uma descrição", variant: "destructive" });
      return;
    }
    if (formTipo === "entrada" && !formMembro) {
      toast({ title: "Entradas precisam de um membro responsável", variant: "destructive" });
      return;
    }
    if (!formDataVencimento) {
      toast({ title: "Informe a data de vencimento", variant: "destructive" });
      return;
    }
    if (!formStatus) {
      toast({ title: "Selecione o status do pagamento", variant: "destructive" });
      return;
    }
    if (rateioTipo === "grupo") {
      if (rateioItems.length === 0) {
        toast({ title: "Adicione pelo menos um favorecido no rateio", variant: "destructive" });
        return;
      }
      for (const item of rateioItems) {
        if (!item.membroId || item.membroId === "__none__") {
          toast({ title: "Selecione o membro para todos os itens do rateio", variant: "destructive" });
          return;
        }
        if (!item.valor || parseBRLToNumber(item.valor) <= 0) {
          toast({ title: "Informe o valor para todos os itens do rateio", variant: "destructive" });
          return;
        }
      }
    }
    createMutation.mutate();
  }

  function handleEditSubmit() {
    if (!editingItemId) return;
    if (!formValor || parseBRLToNumber(formValor) <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    if (!formDescricao.trim()) {
      toast({ title: "Informe uma descrição", variant: "destructive" });
      return;
    }
    if (formTipo === "entrada" && !formMembro) {
      toast({ title: "Entradas precisam de um membro responsável", variant: "destructive" });
      return;
    }
    if (!formDataVencimento) {
      toast({ title: "Informe a data de vencimento", variant: "destructive" });
      return;
    }
    if (!formStatus) {
      toast({ title: "Selecione o status do pagamento", variant: "destructive" });
      return;
    }
    updateMutation.mutate(editingItemId);
  }

  const membroMap = useMemo(() => {
    const map: Record<string, string> = {};
    membros.forEach((m) => { map[m.id] = getMembroNome(m); });
    return map;
  }, [membros]);

  const cppMap = useMemo(() => {
    const map: Record<number, string> = {};
    tiposCpp.forEach((c) => { map[c.id] = c.Nome; });
    return map;
  }, [tiposCpp]);

  const catMap = useMemo(() => {
    const map: Record<number, string> = {};
    categorias.forEach((c) => { map[c.id] = c.Nome_da_categoria; });
    return map;
  }, [categorias]);

  if (loadingBias) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
              <Wallet className="w-6 h-6" />
            </div>
            Gestão Financeira
          </h1>
          <p className="text-muted-foreground mt-1">Gestão de entradas e saídas por BIA</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedBiaId} onValueChange={handleBiaChange}>
            <SelectTrigger className="w-[280px]" data-testid="select-bia">
              <SelectValue placeholder="Selecione uma BIA..." />
            </SelectTrigger>
            <SelectContent>
              {bias.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedBiaId && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-novo-lancamento" onClick={() => { resetForm(); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Lançamento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-brand-gold" />
                    Novo Lançamento
                  </DialogTitle>
                </DialogHeader>
                <LancamentoFormFields
                  formTipo={formTipo} setFormTipo={setFormTipo}
                  formValor={formValor} setFormValor={setFormValor}
                  formData={formData} setFormData={setFormData}
                  formDescricao={formDescricao} setFormDescricao={setFormDescricao}
                  formCategorias={formCategorias} setFormCategorias={setFormCategorias}
                  formMembro={formMembro} setFormMembro={setFormMembro}
                  formFavorecido={formFavorecido} setFormFavorecido={setFormFavorecido}
                  rateioTipo={rateioTipo} setRateioTipo={setRateioTipo}
                  rateioModo={rateioModo} setRateioModo={setRateioModo}
                  rateioItems={rateioItems} setRateioItems={setRateioItems}
                  formTiposCpp={formTiposCpp} setFormTiposCpp={setFormTiposCpp}
                  formStatus={formStatus} setFormStatus={setFormStatus}
                  formDataVencimento={formDataVencimento} setFormDataVencimento={setFormDataVencimento}
                  formDataPagamento={formDataPagamento} setFormDataPagamento={setFormDataPagamento}
                  membros={membros} favorecidos={favorecidosDaBia} tiposCpp={tiposCpp}
                  categorias={categorias}
                  selectedBiaId={selectedBiaId}
                  prefix="create"
                  pendingFiles={pendingFiles} setPendingFiles={setPendingFiles}
                  existingAnexos={existingAnexos} setExistingAnexos={setExistingAnexos}
                  uploading={uploading}
                  isCreate
                  onCreateFavorecido={handleCreateFavorecido}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" data-testid="button-cancelar">Cancelar</Button>
                  </DialogClose>
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || uploading}
                    data-testid="button-salvar-lancamento"
                  >
                    {createMutation.isPending || uploading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    {uploading ? "Enviando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {!selectedBiaId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">Selecione uma BIA para iniciar</h3>
            <p className="text-sm text-muted-foreground/70 mt-2">Escolha um projeto de aliança no seletor acima para gerenciar o fluxo de caixa</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const valorOrigemTotal = parseFloat(String(selectedBia?.valor_origem || 0)) || 0;
              const catValorOrigemIds = new Set(
                categorias
                  .filter((c) => isValorOrigemCategoriaName(c.Nome_da_categoria))
                  .map((c) => c.id)
              );
              const valorOrigemPago = fluxoItemsContabeis
                .filter((i) => i.tipo === "saida" && i.status === "pago" && i.Categoria.some((c) => {
                  const id = typeof c === "object" && c !== null ? (c as CategoriaItem).id : c;
                  return catValorOrigemIds.has(Number(id));
                }))
                .reduce((sum, i) => sum + (parseFloat(String(i.valor)) || 0), 0);
              const percPago = valorOrigemTotal > 0 ? (valorOrigemPago / valorOrigemTotal) * 100 : 0;
              return (
                <Card className="border-brand-gold/40 bg-brand-gold/5" data-testid="panel-valor-origem">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Valor de Origem da BIA</CardTitle>
                    <DollarSign className="w-4 h-4 text-brand-gold" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-brand-gold" data-testid="text-valor-origem">
                      {formatBRL(valorOrigemPago)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      de {formatBRL(valorOrigemTotal)} ({percPago.toFixed(0)}% pago)
                    </p>
                  </CardContent>
                </Card>
              );
            })()}

            <Card className="border-green-500/30" data-testid="panel-total-aportes">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Total de Entradas</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600" data-testid="text-total-entradas">{formatBRL(totals.entradas)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fluxoItemsContabeis.filter((i) => i.tipo === "entrada" && i.status === "pago").length} entrada(s) pagas
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-500/30" data-testid="panel-custo-obra">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Total de Saídas</CardTitle>
                <TrendingDown className="w-4 h-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600" data-testid="text-total-saidas">{formatBRL(totals.saidas)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fluxoItemsContabeis.filter((i) => i.tipo === "saida" && i.status === "pago").length} saída(s) pagas
                </p>
              </CardContent>
            </Card>

            <Card className={totals.saldo >= 0 ? "border-brand-gold/30" : "border-red-500/30"} data-testid="panel-saldo">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Saldo</CardTitle>
                <BarChart3 className={`w-4 h-4 ${totals.saldo >= 0 ? "text-brand-gold" : "text-red-500"}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${totals.saldo >= 0 ? "text-brand-gold" : "text-red-600"}`} data-testid="text-saldo">
                  {formatBRL(totals.saldo)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Entradas − Saídas</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="panel-financeiro">
            <Card className="border-red-500/40 bg-red-500/5" data-testid="panel-contas-pagar">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">A Pagar</CardTitle>
                <DollarSign className="w-3.5 h-3.5 text-red-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm font-bold text-red-600 leading-tight break-all" data-testid="text-contas-pagar-valor">{formatBRL(financialDashboard.contasPagar.valor)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{financialDashboard.contasPagar.count} lançamento(s)</p>
              </CardContent>
            </Card>

            <Card className="border-red-700/40 bg-red-700/5" data-testid="panel-vencidas">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Vencidas</CardTitle>
                <AlertCircle className="w-3.5 h-3.5 text-red-700" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm font-bold text-red-700 leading-tight break-all" data-testid="text-vencidas-valor">{formatBRL(financialDashboard.vencidas.valor)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{financialDashboard.vencidas.count} lançamento(s)</p>
              </CardContent>
            </Card>

            <Card className="border-amber-500/40 bg-amber-500/5" data-testid="panel-a-vencer">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Vencem em 7 dias</CardTitle>
                <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm font-bold text-amber-600 leading-tight break-all" data-testid="text-a-vencer-valor">{formatBRL(financialDashboard.aVencer7.valor)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{financialDashboard.aVencer7.count} lançamento(s)</p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/40 bg-blue-500/5" data-testid="panel-a-receber">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">A Receber</CardTitle>
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm font-bold text-blue-600 leading-tight break-all" data-testid="text-a-receber-valor">{formatBRL(financialDashboard.aReceber.valor)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{financialDashboard.aReceber.count} entrada(s)</p>
              </CardContent>
            </Card>


          </div>

          {aportesPorMembro.length > 0 && (
            <Card data-testid="panel-participacao-aportes">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-brand-gold" />
                  Mapa de Alocação Patrimonial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {[
                    { title: "Sócios Guardiões", items: alocacaoPorPapel.guardioes, cls: "border-brand-gold/50 text-brand-gold bg-brand-gold/10" },
                    { title: "Sócios Multiplicadores", items: alocacaoPorPapel.multiplicadores, cls: "border-green-500/50 text-green-600 bg-green-500/10" },
                    { title: "Não classificados", items: alocacaoPorPapel.naoClassificados, cls: "border-muted-foreground/40 text-muted-foreground bg-muted/40" },
                  ].filter((group) => group.items.length > 0).map((group) => (
                    <div key={group.title} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${group.cls}`}>{group.items.length}</Badge>
                      </div>
                      {group.items.map((item) => (
                    <div key={item.membroId} className="space-y-1" data-testid={`aporte-membro-${item.membroId}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {membroMap[item.membroId] || item.inlineName || "Membro desconhecido"}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-muted-foreground">{formatBRL(item.valor)}</span>
                          <Badge variant="outline" className="border-brand-gold/50 text-brand-gold bg-brand-gold/10 min-w-[60px] justify-center" data-testid={`text-perc-membro-${item.membroId}`}>
                            {item.percentual.toFixed(1)}%
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-brand-navy hover:bg-brand-gold/10"
                            title="Solicitar transferência de cotas"
                            data-testid={`btn-transfer-membro-${item.membroId}`}
                            onClick={() => {
                              openTransferDialog(item.membroId, item.valor);
                            }}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
                            Transferir
                          </Button>
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold/70 transition-all duration-500"
                          style={{ width: `${item.percentual}%` }}
                          data-testid={`bar-membro-${item.membroId}`}
                        />
                      </div>
                    </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dialog de solicitação de transferência */}
          <Dialog open={transferDialogOpen} onOpenChange={(open) => { setTransferDialogOpen(open); if (!open) resetTransferForm(); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-brand-gold" />
                  {editingTransferId ? "Editar Transferência de Cotas" : "Solicitar Transferência de Cotas"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-2">

                {/* Origem */}
                <div className="rounded-md bg-muted/40 border px-3 py-2.5 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Membro de Origem</p>
                  <p className="text-sm font-semibold">{membroMap[transferOrigemId] || transferOrigemId}</p>
                  <p className="text-xs text-muted-foreground">
                    Cotas totais: {formatBRL(transferValorRef)}&nbsp;
                    ({aportesPorMembro.find(a => a.membroId === transferOrigemId)?.percentual.toFixed(1)}% do capital total da BIA)
                  </p>
                </div>

                {/* Destinatários */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide">Destinatários</Label>
                    {!editingTransferId && (
                    <div className="flex gap-1.5">
                      {destinatarios.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleDividirIgualmente}
                          data-testid="btn-dividir-igualmente"
                        >
                          <Divide className="w-3 h-3 mr-1" />
                          Dividir igualmente
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-brand-gold border-brand-gold/50 hover:bg-brand-gold/10"
                        onClick={addDestinatario}
                        data-testid="btn-add-destinatario"
                      >
                        <PlusCircle className="w-3.5 h-3.5 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    )}
                  </div>

                  {destinatarios.map((dest, idx) => {
                    const valorDest = parseFloat(((dest.percentual / 100) * transferValorRef).toFixed(2));
                    const isDuplicate = hasDuplicateDest && dest.membroId !== "" &&
                      destinatarios.findIndex((d, i) => i !== idx && d.membroId === dest.membroId) !== -1;
                    return (
                      <div key={idx} className="space-y-1.5 rounded-lg border bg-muted/20 p-3" data-testid={`destinatario-row-${idx}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground w-4 shrink-0">{idx + 1}.</span>
                          <Select
                            value={dest.membroId}
                            onValueChange={(v) => updateDestinatario(idx, "membroId", v)}
                          >
                            <SelectTrigger className={`flex-1 h-8 text-sm ${isDuplicate ? "border-red-500" : ""}`} data-testid={`select-dest-${idx}`}>
                              <SelectValue placeholder="Selecione o membro..." />
                            </SelectTrigger>
                            <SelectContent>
                              {membros
                                .filter((m) => m.id !== transferOrigemId)
                                .map((m) => (
                                  <SelectItem key={m.id} value={m.id}>{getMembroNome(m)}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {destinatarios.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-red-500"
                              onClick={() => removeDestinatario(idx)}
                              data-testid={`btn-remove-dest-${idx}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pl-6">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={dest.percentual}
                            onChange={(e) => updateDestinatario(idx, "percentual", Number(e.target.value))}
                            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-brand-gold"
                            data-testid={`slider-dest-${idx}`}
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={dest.percentual}
                              onChange={(e) => updateDestinatario(idx, "percentual", Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                              className="w-14 text-right text-xs font-semibold border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold"
                              data-testid={`input-perc-dest-${idx}`}
                            />
                            <span className="text-xs text-brand-gold font-semibold">%</span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 w-24 text-right">
                            {formatBRL(valorDest)}
                          </span>
                        </div>
                        {isDuplicate && (
                          <p className="text-xs text-red-500 pl-6">Membro já selecionado</p>
                        )}
                      </div>
                    );
                  })}

                  {/* Barra de total */}
                  <div className={`flex items-center justify-between rounded-md px-3 py-2 border text-sm ${
                    totalPercentual > 100 ? "bg-red-500/10 border-red-500/40" :
                    totalPercentual === 100 ? "bg-green-500/10 border-green-500/40" :
                    "bg-muted/60"
                  }`}>
                    <span className="text-xs text-muted-foreground">Total alocado</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${totalPercentual > 100 ? "text-red-500" : totalPercentual === 100 ? "text-green-600" : ""}`}>
                        {totalPercentual}%
                      </span>
                      {totalPercentual < 100 && totalPercentual > 0 && (
                        <span className="text-xs text-muted-foreground">({100 - totalPercentual}% disponível)</span>
                      )}
                      {totalPercentual > 100 && (
                        <span className="text-xs text-red-500">excede em {totalPercentual - 100}%</span>
                      )}
                      {totalPercentual === 100 && (
                        <span className="text-xs text-green-600">✓ completo</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="transfer-obs" className="text-xs font-medium">
                    Observação / motivo <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="transfer-obs"
                    value={transferObservacoes}
                    onChange={(e) => setTransferObservacoes(e.target.value)}
                    placeholder="Escreva o motivo da transferência..."
                    className="min-h-[88px]"
                    data-testid="input-transfer-obs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-medium">
                    <Paperclip className="w-3.5 h-3.5" />
                    Anexo
                  </Label>

                  {transferExistingAnexos.length > 0 && (
                    <div className="space-y-1">
                      {transferExistingAnexos.map((anexo, i) => {
                        const displayName = anexo.filename || anexo.title || anexo.id;
                        const IconComp = getFileIcon(displayName);
                        return (
                          <div key={anexo.id || i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm">
                            <IconComp className="w-4 h-4 text-muted-foreground shrink-0" />
                            <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-gold hover:underline flex-1">
                              {displayName}
                            </a>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeTransferExistingAnexo(i)} data-testid={`button-remove-transfer-existing-anexo-${i}`}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {transferPendingFiles.length > 0 && (
                    <div className="space-y-1">
                      {transferPendingFiles.map((file, i) => (
                        <div key={`${file.name}-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950/30 text-sm">
                          <Upload className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeTransferPendingFile(i)} data-testid={`button-remove-transfer-pending-file-${i}`}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <FilePickerButton
                    prefix="transfer-anexo"
                    uploading={transferUploading || createTransferMutation.isPending}
                    onFilesSelected={(files) => setTransferPendingFiles([...transferPendingFiles, ...files])}
                  />
                </div>

                <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                  {destinatarios.length === 1
                    ? <>Serão transferidos <strong>{destinatarios[0].percentual}% das cotas</strong> ({formatBRL(parseFloat(((destinatarios[0].percentual / 100) * transferValorRef).toFixed(2)))}) para o destinatário selecionado.</>
                    : <>Serão criadas <strong>{destinatarios.length} solicitações</strong> totalizando <strong>{totalPercentual}%</strong> das cotas ({formatBRL(parseFloat(((totalPercentual / 100) * transferValorRef).toFixed(2)))}).</>
                  } Necessária aprovação do Diretor de Aliança ou Aliado BUILT.
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Cancelar</Button>
                </DialogClose>
                <Button
                  size="sm"
                  className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
                  disabled={!destValidos || hasDuplicateDest || totalPercentual > 100 || totalPercentual <= 0 || !transferObservacoes.trim() || createTransferMutation.isPending || transferUploading}
                  onClick={() => createTransferMutation.mutate()}
                  data-testid="btn-submit-transfer"
                >
                  <SendHorizontal className="w-4 h-4 mr-1.5" />
                  {createTransferMutation.isPending || transferUploading
                    ? "Salvando..."
                    : editingTransferId
                      ? "Salvar Alterações"
                    : destinatarios.length > 1
                      ? `Solicitar (${destinatarios.length} destinatários)`
                      : "Solicitar Transferência"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog de rejeição com motivo */}
          <AlertDialog open={!!rejeicaoDialogId} onOpenChange={(open) => { if (!open) { setRejeicaoDialogId(null); setRejeicaoMotivo(""); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rejeitar Transferência</AlertDialogTitle>
                <AlertDialogDescription>
                  Informe o motivo da rejeição (opcional) e confirme.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={rejeicaoMotivo}
                onChange={(e) => setRejeicaoMotivo(e.target.value)}
                placeholder="Motivo da rejeição..."
                className="my-2"
                data-testid="input-rejeicao-motivo"
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    if (rejeicaoDialogId) {
                      rejeitarTransferMutation.mutate({ id: rejeicaoDialogId, motivo: rejeicaoMotivo });
                    }
                  }}
                  data-testid="btn-confirm-rejeitar"
                >
                  Confirmar Rejeição
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Painel de Solicitações de Transferência de Cotas */}
          {selectedBiaId && (
            <Card data-testid="panel-transferencias">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ArrowLeftRight className="w-5 h-5 text-brand-gold" />
                  Solicitações de Transferência de Cotas
                  {transferencias.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">{transferencias.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transferencias.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma solicitação de transferência para esta BIA.
                  </p>
                )}
                {transferencias.length > 0 && (
                <div className="space-y-3">
                  {transferencias.map((t) => {
                    const myMembroId = currentUser?.membro_directus_id;
                    const isOrigem = myMembroId && myMembroId === t.membro_origem_id;
                    const isDiretorAlianca = myMembroId && selectedBia?.diretor_alianca && myMembroId === selectedBia.diretor_alianca;
                    const isAliadoBuilt = myMembroId && selectedBia?.aliado_built && myMembroId === selectedBia.aliado_built;
                    const canApprove =
                      !isOrigem &&
                      (isDiretorAlianca || isAliadoBuilt || currentUser?.role === "admin");
                    const canEdit = t.status === "pendente" && (isOrigem || currentUser?.role === "admin");
                    const transferAnexos = normalizeTransferAnexos(t.anexos);
                    const statusConfig =
                      t.status === "aceita"
                        ? { label: "Aceita", cls: "text-green-600 bg-green-500/10 border-green-500/40" }
                        : t.status === "rejeitada"
                        ? { label: "Rejeitada", cls: "text-red-600 bg-red-500/10 border-red-500/40" }
                        : { label: "Pendente", cls: "text-amber-600 bg-amber-500/10 border-amber-500/40" };
                    return (
                      <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border bg-muted/30" data-testid={`transfer-item-${t.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{membroMap[t.membro_origem_id] || t.membro_origem_id}</span>
                            <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{membroMap[t.membro_destino_id] || t.membro_destino_id}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {t.percentual_transferencia && (
                              <Badge variant="outline" className="text-xs border-brand-gold/40 text-brand-gold bg-brand-gold/10 px-1.5 py-0">
                                {parseFloat(t.percentual_transferencia).toFixed(0)}%
                              </Badge>
                            )}
                            {t.valor_total && (
                              <span className="text-xs text-muted-foreground">{formatBRL(parseFloat(t.valor_total))}</span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(t.criado_em).toLocaleDateString("pt-BR")}
                            </span>
                            {t.observacoes && (
                              <span className="text-xs text-muted-foreground italic truncate max-w-[120px]" title={t.observacoes}>"{t.observacoes}"</span>
                            )}
                          </div>
                          {t.status === "rejeitada" && t.motivo_rejeicao && (
                            <p className="text-xs text-red-500 mt-0.5">Motivo: {t.motivo_rejeicao}</p>
                          )}
                          {transferAnexos.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {transferAnexos.map((anexo, ai) => {
                                const name = anexo.filename || anexo.title || anexo.id;
                                return (
                                  <a
                                    key={`${anexo.id}-${ai}`}
                                    href={anexo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-brand-gold hover:border-brand-gold/40"
                                    data-testid={`link-transfer-anexo-${t.id}-${ai}`}
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    <span className="max-w-[140px] truncate">{name}</span>
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`text-xs ${statusConfig.cls}`}>{statusConfig.label}</Badge>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-brand-navy border-brand-gold/50 hover:bg-brand-gold/10"
                              onClick={() => openEditTransferDialog(t)}
                              data-testid={`btn-editar-transfer-${t.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                          )}
                          {t.status === "pendente" && canApprove && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-green-600 border-green-500/50 hover:bg-green-500/10"
                                disabled={aceitarTransferMutation.isPending}
                                onClick={() => aceitarTransferMutation.mutate(t.id)}
                                data-testid={`btn-aceitar-${t.id}`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                                Aceitar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-red-600 border-red-500/50 hover:bg-red-500/10"
                                disabled={rejeitarTransferMutation.isPending}
                                onClick={() => { setRejeicaoDialogId(t.id); setRejeicaoMotivo(""); }}
                                data-testid={`btn-rejeitar-${t.id}`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                                Rejeitar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card data-testid="panel-lancamentos">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-brand-gold" />
                  Lançamentos — {selectedBia?.nome_bia}
                </CardTitle>
                {(filterTipo !== "todos" || filterCategoria !== "todos" || filterMembro !== "todos" || filterFavorecido !== "todos" || filterTipoCpp !== "todos" || filterStatus !== "todos" || filterDescricao || filterDataDe !== defaultDataDe || filterDataAte !== defaultDataAte) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterTipo("todos");
                      setFilterCategoria("todos");
                      setFilterMembro("todos");
                      setFilterFavorecido("todos");
                      setFilterTipoCpp("todos");
                      setFilterStatus("todos");
                      setFilterDescricao("");
                      const _now = new Date();
                      const _lastDay = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();
                      setFilterDataDe(`${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-01`);
                      setFilterDataAte(`${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_lastDay).padStart(2, "0")}`);
                    }}
                    className="text-muted-foreground hover:text-foreground gap-1"
                    data-testid="button-limpar-filtros"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Limpar filtros
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 mt-3" data-testid="panel-filtros">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Tipo
                  </Label>
                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger className="h-8 text-xs" data-testid="filter-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Categoria
                  </Label>
                  <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                    <SelectTrigger className="h-8 text-xs" data-testid="filter-categoria">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {getPlanoContaGroup(cat)} / {stripPlanoContaCode(cat.Nome_da_categoria)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> Responsável
                  </Label>
                  <Select value={filterMembro} onValueChange={setFilterMembro}>
                    <SelectTrigger className="h-8 text-xs" data-testid="filter-membro">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {favorecidosDaBia.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{getMembroNome(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Favorecido
                  </Label>
                  <Select value={filterFavorecido} onValueChange={setFilterFavorecido}>
                    <SelectTrigger className="h-8 text-xs" data-testid="filter-favorecido">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {membros.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{getMembroNome(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Tipo CPP
                  </Label>
                  <Select value={filterTipoCpp} onValueChange={setFilterTipoCpp}>
                    <SelectTrigger className="h-8 text-xs" data-testid="filter-tipo-cpp">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {tiposCpp.map((cpp) => (
                        <SelectItem key={cpp.id} value={String(cpp.id)}>{cpp.Nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Status
                  </Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 text-xs" data-testid="filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Search className="w-3 h-3" /> Descrição
                  </Label>
                  <Input
                    value={filterDescricao}
                    onChange={(e) => setFilterDescricao(e.target.value)}
                    placeholder="Buscar..."
                    className="h-8 text-xs"
                    data-testid="filter-descricao"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" /> Vencimento — De
                  </Label>
                  <Input
                    type="date"
                    value={filterDataDe}
                    onChange={(e) => setFilterDataDe(e.target.value)}
                    className="h-8 text-xs w-36"
                    data-testid="filter-data-de"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={filterDataAte}
                    onChange={(e) => setFilterDataAte(e.target.value)}
                    className="h-8 text-xs w-36"
                    data-testid="filter-data-ate"
                  />
                </div>
                {(filterDataDe || filterDataAte) && (
                  <button
                    type="button"
                    onClick={() => { setFilterDataDe(""); setFilterDataAte(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground pb-0.5"
                    data-testid="button-limpar-datas"
                  >
                    ✕ limpar datas
                  </button>
                )}
              </div>

              {fluxoItems.length !== fluxoItemsAll.length && (
                <p className="text-xs text-muted-foreground mt-2" data-testid="text-filter-count">
                  Mostrando {fluxoItems.length} de {fluxoItemsAll.length} lançamentos
                </p>
              )}
            </CardHeader>
            <CardContent>
              {loadingFluxo ? (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : fluxoItems.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-muted-foreground">Nenhum lançamento registrado</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Clique em "Novo Lançamento" para começar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-lancamentos">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">Vencimento</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">Valor</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Descrição</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">Categoria</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">Favorecido</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">Tipo CPP</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">Anexos</th>
                        <th className="py-3 px-3 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fluxoItems.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-lancamento-${item.id}`}>
                          {/* Vencimento */}
                          <td className="py-3 px-3 text-sm whitespace-nowrap" data-testid={`text-vencimento-${item.id}`}>
                            {item.data_vencimento ? (
                              <span className={`flex items-center gap-1 ${isVencido(item) && item.status !== "pago" && item.status !== "cancelado" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                <CalendarClock className="w-3 h-3" />
                                {formatDate(item.data_vencimento)}
                              </span>
                            ) : "-"}
                          </td>
                          {/* Status */}
                          <td className="py-3 px-3 whitespace-nowrap" data-testid={`text-status-${item.id}`}>
                            {(() => {
                              const effective = isVencido(item) && item.status !== "pago" && item.status !== "cancelado" ? "vencido" : (item.status || null);
                              const { label, color, Icon } = getStatusConfig(effective as StatusPagamento | null);
                              return (
                                <Badge variant="outline" className={`gap-1 ${color}`}>
                                  <Icon className="w-3 h-3" />
                                  {label}
                                </Badge>
                              );
                            })()}
                          </td>
                          {/* Valor */}
                          <td className={`py-3 px-3 text-right font-semibold whitespace-nowrap ${item.tipo === "entrada" ? "text-green-600" : "text-red-600"}`}>
                            {item.tipo === "entrada" ? "+" : "-"}{formatBRL(parseFloat(String(item.valor)) || 0)}
                          </td>
                          {/* Descrição */}
                          <td className="py-3 px-3" data-testid={`text-descricao-${item.id}`}>{item.descricao || "-"}</td>
                          {/* Categoria */}
                          <td className="py-3 px-3">
                            {item.Categoria && item.Categoria.length > 0 ? (
                              <Badge variant="secondary" className="gap-1 whitespace-nowrap">
                                <Tag className="w-3 h-3" />
                                {item.Categoria.map((c) => getCatName(c, catMap)).join(", ")}
                              </Badge>
                            ) : "-"}
                          </td>
                          {/* Favorecido */}
                          <td className="py-3 px-3" data-testid={`text-favorecido-${item.id}`}>
                            {item.Favorecido && item.Favorecido.length > 0 ? (
                              <span className="flex flex-col gap-0.5">
                                {item.Favorecido.map((f, idx) => {
                                  const favId = getRelId(f as any) || "";
                                  const nome = getFavName(f, membroMap);
                                  const membro = membros.find((m) => m.id === favId);
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => membro && setProfileMembro(membro)}
                                      className="flex items-center gap-1 text-brand-navy hover:text-brand-gold underline decoration-dotted underline-offset-2 transition-colors cursor-pointer bg-transparent border-none p-0 text-left whitespace-nowrap"
                                      data-testid={`link-favorecido-${item.id}-${idx}`}
                                    >
                                      <UserCheck className="w-3 h-3 shrink-0" />
                                      {nome}
                                    </button>
                                  );
                                })}
                              </span>
                            ) : "-"}
                          </td>
                          {/* Tipo CPP */}
                          <td className="py-3 px-3" data-testid={`text-tipo-cpp-${item.id}`}>
                            {item.tipo_de_cpp && item.tipo_de_cpp.length > 0 ? (
                              <Badge variant="secondary" className="gap-1 whitespace-nowrap">
                                <Layers className="w-3 h-3" />
                                {item.tipo_de_cpp.map((c) => getCppName(c, cppMap)).join(", ")}
                              </Badge>
                            ) : "-"}
                          </td>
                          {/* Anexos */}
                          <td className="py-3 px-2 text-center" data-testid={`text-anexos-${item.id}`}>
                            {item.anexos && item.anexos.length > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 gap-1 text-xs hover:bg-brand-gold/10 hover:border-brand-gold/40"
                                onClick={() => setAnexosModal({ id: item.id, anexos: item.anexos as any[] })}
                                data-testid={`button-anexos-${item.id}`}
                              >
                                <Paperclip className="w-3 h-3" />
                                {item.anexos.length}
                              </Button>
                            ) : "-"}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1">
                              {isDivisorDeibLancamento(item, catMap) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-brand-gold"
                                  onClick={() => openBoletoDialog(item)}
                                  data-testid={`button-gerar-boleto-${item.id}`}
                                  title={item.pagamento_url ? "Ver ou gerar novo pagamento" : "Gerar boleto"}
                                >
                                  <Receipt className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-brand-gold"
                                onClick={() => openEditDialog(item)}
                                data-testid={`button-edit-${item.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                onClick={() => setDeleteConfirmId(item.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setEditingItemId(null); } setEditDialogOpen(open); }}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-brand-gold" />
                  Editar Lançamento
                </DialogTitle>
              </DialogHeader>
              <LancamentoFormFields
                formTipo={formTipo} setFormTipo={setFormTipo}
                formValor={formValor} setFormValor={setFormValor}
                formData={formData} setFormData={setFormData}
                formDescricao={formDescricao} setFormDescricao={setFormDescricao}
                formCategorias={formCategorias} setFormCategorias={setFormCategorias}
                formMembro={formMembro} setFormMembro={setFormMembro}
                formFavorecido={formFavorecido} setFormFavorecido={setFormFavorecido}
                rateioTipo={rateioTipo} setRateioTipo={setRateioTipo}
                rateioModo={rateioModo} setRateioModo={setRateioModo}
                rateioItems={rateioItems} setRateioItems={setRateioItems}
                formTiposCpp={formTiposCpp} setFormTiposCpp={setFormTiposCpp}
                formStatus={formStatus} setFormStatus={setFormStatus}
                formDataVencimento={formDataVencimento} setFormDataVencimento={setFormDataVencimento}
                formDataPagamento={formDataPagamento} setFormDataPagamento={setFormDataPagamento}
                membros={membros} favorecidos={favorecidosDaBia} tiposCpp={tiposCpp}
                categorias={categorias}
                selectedBiaId={selectedBiaId}
                prefix="edit"
                pendingFiles={pendingFiles} setPendingFiles={setPendingFiles}
                existingAnexos={existingAnexos} setExistingAnexos={setExistingAnexos}
                uploading={uploading}
                onCreateFavorecido={handleCreateFavorecido}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingItemId(null); }} data-testid="button-cancelar-edit">
                  Cancelar
                </Button>
                <Button
                  onClick={handleEditSubmit}
                  disabled={updateMutation.isPending || uploading}
                  data-testid="button-salvar-edit"
                >
                  {updateMutation.isPending || uploading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Pencil className="w-4 h-4 mr-2" />
                  )}
                  {uploading ? "Enviando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!boletoItem} onOpenChange={(open) => { if (!open) { setBoletoItem(null); setBoletoUrl(""); gerarBoletoMutation.reset(); } }}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-brand-gold" />
                  Gerar boleto
                </DialogTitle>
              </DialogHeader>
              {boletoItem && (
                <div className="space-y-4">
                  <div className="rounded-md border border-brand-gold/30 bg-brand-gold/5 p-3 text-sm">
                    <div className="text-muted-foreground">Valor do lancamento</div>
                    <div className="text-lg font-bold text-brand-navy">{formatBRL(Math.abs(fluxoValorToNumber(boletoItem.valor)))}</div>
                    <div className="mt-1 text-muted-foreground">{boletoItem.descricao}</div>
                  </div>

                  <div className="space-y-2">
                    <Label>Local do pagador</Label>
                    <Select
                      value={boletoPais}
                      onValueChange={(value) => {
                        setBoletoPais(value as "brasil" | "fora");
                        setBoletoUrl("");
                      }}
                    >
                      <SelectTrigger data-testid="select-boleto-pais">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brasil">Brasil</SelectItem>
                        <SelectItem value="fora">Fora do Brasil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="boleto-nome">Nome do pagador <span className="text-red-500">*</span></Label>
                      <Input
                        id="boleto-nome"
                        value={boletoNome}
                        onChange={(e) => setBoletoNome(e.target.value)}
                        placeholder="Nome completo ou razao social"
                        data-testid="input-boleto-nome"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="boleto-email">Email <span className="text-red-500">*</span></Label>
                      <Input
                        id="boleto-email"
                        type="email"
                        value={boletoEmail}
                        onChange={(e) => setBoletoEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        data-testid="input-boleto-email"
                      />
                    </div>
                  </div>

                  {boletoPais === "brasil" && (
                    <div className="space-y-2">
                      <Label htmlFor="boleto-documento">CPF/CNPJ <span className="text-red-500">*</span></Label>
                      <Input
                        id="boleto-documento"
                        value={boletoDocumento}
                        onChange={(e) => setBoletoDocumento(e.target.value)}
                        placeholder="Somente numeros ou formatado"
                        data-testid="input-boleto-documento"
                      />
                    </div>
                  )}

                  {boletoUrl && (
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="text-sm font-medium text-brand-navy">Link de pagamento gerado</div>
                      <div className="break-all text-sm text-muted-foreground">{boletoUrl}</div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => window.open(boletoUrl, "_blank")} data-testid="button-abrir-boleto">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Abrir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard?.writeText(boletoUrl);
                            toast({ title: "Link copiado" });
                          }}
                          data-testid="button-copiar-boleto"
                        >
                          Copiar link
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setBoletoItem(null)} data-testid="button-cancelar-boleto">
                  Cancelar
                </Button>
                <Button
                  onClick={() => gerarBoletoMutation.mutate()}
                  disabled={
                    gerarBoletoMutation.isPending ||
                    !boletoNome.trim() ||
                    !boletoEmail.trim() ||
                    (boletoPais === "brasil" && !boletoDocumento.trim())
                  }
                  data-testid="button-confirmar-gerar-boleto"
                >
                  {gerarBoletoMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : boletoPais === "brasil" ? (
                    <Receipt className="w-4 h-4 mr-2" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  {boletoPais === "brasil" ? "Gerar boleto" : "Gerar fatura"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <Trash2 className="w-5 h-5" />
                  Excluir lançamento
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O lançamento será excluído permanentemente do Directus.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    if (deleteConfirmId) {
                      deleteMutation.mutate(deleteConfirmId);
                      setDeleteConfirmId(null);
                    }
                  }}
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={!!profileMembro} onOpenChange={(open) => { if (!open) setProfileMembro(null); }}>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-brand-gold" />
                  Perfil do Membro
                </DialogTitle>
              </DialogHeader>
              {profileMembro && (
                <div className="space-y-4">
                  <div className="text-center pb-4 border-b">
                    <div className="w-16 h-16 rounded-full bg-brand-navy/10 flex items-center justify-center mx-auto mb-3">
                      <User className="w-8 h-8 text-brand-navy" />
                    </div>
                    <h3 className="text-lg font-bold text-brand-navy">{profileMembro.Nome_de_usuario || profileMembro.nome}</h3>
                    {profileMembro.Nome_de_usuario && profileMembro.nome && (
                      <p className="text-sm text-muted-foreground">{profileMembro.nome}</p>
                    )}
                    {(profileMembro.cargo || profileMembro.empresa) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {[profileMembro.cargo, profileMembro.empresa].filter(Boolean).join(" • ")}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {profileMembro.tipo_de_cadastro && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Tipo de Cadastro</p>
                        <p className="font-medium">{profileMembro.tipo_de_cadastro}</p>
                      </div>
                    )}
                    {profileMembro.tipo_pessoa && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Tipo de Pessoa</p>
                        <p className="font-medium">{profileMembro.tipo_pessoa}</p>
                      </div>
                    )}
                    {profileMembro.email && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground uppercase">E-mail</p>
                        <a href={`mailto:${profileMembro.email}`} className="font-medium text-brand-navy hover:text-brand-gold transition-colors">{profileMembro.email}</a>
                      </div>
                    )}
                    {profileMembro.whatsapp && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">WhatsApp</p>
                        <a href={`https://wa.me/${profileMembro.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-navy hover:text-brand-gold transition-colors">{profileMembro.whatsapp}</a>
                      </div>
                    )}
                    {profileMembro.telefone && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Telefone</p>
                        <p className="font-medium">{profileMembro.telefone}</p>
                      </div>
                    )}
                    {(profileMembro.cidade || profileMembro.estado) && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground uppercase">Localização</p>
                        <p className="font-medium">{[profileMembro.cidade, profileMembro.estado].filter(Boolean).join(" - ")}</p>
                      </div>
                    )}
                    {profileMembro.nucleo_alianca && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground uppercase">Núcleo da Aliança</p>
                        <p className="font-medium">{profileMembro.nucleo_alianca}</p>
                      </div>
                    )}
                    {profileMembro.perfil_aliado && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground uppercase">Perfil do Aliado</p>
                        <p className="font-medium">{profileMembro.perfil_aliado}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Modal de Anexos */}
          <Dialog open={!!anexosModal} onOpenChange={(open) => { if (!open) setAnexosModal(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-brand-gold" />
                  Anexos ({anexosModal?.anexos.length ?? 0})
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto py-1">
                {anexosModal?.anexos.map((anexo: any, ai: number) => {
                  const name = typeof anexo === "string" ? anexo : (anexo.filename || anexo.title || anexo.id);
                  const href = typeof anexo === "string" ? anexo : anexo.url;
                  const IconComp = getFileIcon(name);
                  return (
                    <a
                      key={ai}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 hover:border-brand-gold/30 transition-colors group"
                      data-testid={`modal-anexo-${anexosModal?.id}-${ai}`}
                    >
                      <IconComp className="w-5 h-5 text-muted-foreground shrink-0 group-hover:text-brand-gold transition-colors" />
                      <span className="text-sm truncate flex-1">{name}</span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-brand-gold transition-colors" />
                    </a>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
