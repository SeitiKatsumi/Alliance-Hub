import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  BadgePercent
} from "lucide-react";

interface BiasProjeto {
  id: string;
  nome_bia: string;
  objetivo_alianca?: string;
  valor_origem?: string | number | null;
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
}

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
}

const STATUS_OPTIONS: { value: StatusPagamento; label: string }[] = [
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
  if (typeof cat === "object" && cat !== null) return cat.Nome_da_categoria || "Categoria";
  return catMap[cat] || "Categoria";
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
}: {
  membros: Membro[];
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  testId: string;
  allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
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
            ) : filtered.length === 0 ? (
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
  prefix,
}: {
  categorias: CategoriaItem[];
  value: number | null;
  onValueChange: (v: number | null) => void;
  formTipo: string;
  prefix: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const base = categorias.filter((cat) => {
      if (!cat.Tipo_de_categoria) return true;
      const norm = cat.Tipo_de_categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return norm === formTipo;
    });
    const sorted = [...base].sort((a, b) => a.Nome_da_categoria.localeCompare(b.Nome_da_categoria, "pt-BR"));
    if (!search.trim()) return sorted;
    const s = search.toLowerCase();
    return sorted.filter((c) => c.Nome_da_categoria.toLowerCase().includes(s));
  }, [categorias, formTipo, search]);

  const selected = categorias.find((c) => c.id === value);
  const exactMatch = filtered.some((c) => c.Nome_da_categoria.toLowerCase() === search.toLowerCase());

  async function handleCreate() {
    if (!search.trim()) return;
    setCreating(true);
    try {
      const res = await apiRequest("POST", "/api/categorias", { Nome_da_categoria: search.trim() });
      const created: CategoriaItem = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/categorias"] });
      onValueChange(created.id);
      setSearch("");
      setOpen(false);
      toast({ title: `Categoria "${created.Nome_da_categoria}" criada!` });
    } catch {
      toast({ title: "Erro ao criar categoria", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`${prefix}-select-categoria`}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? selected.Nome_da_categoria : "Nenhuma"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start">
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
            <CommandGroup heading="Categorias">
              {filtered.length === 0 && !search && (
                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
              )}
              {filtered.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={String(cat.id)}
                  onSelect={() => { onValueChange(cat.id); setSearch(""); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === cat.id ? "opacity-100" : "opacity-0"}`} />
                  {cat.Nome_da_categoria}
                </CommandItem>
              ))}
            </CommandGroup>
            {search.trim() && !exactMatch && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__create__"
                    onSelect={handleCreate}
                    disabled={creating}
                    className="text-brand-gold cursor-pointer"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {creating ? "Criando..." : `Criar "${search.trim()}"`}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
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

function LancamentoFormFields({
  formTipo, setFormTipo,
  formValor, setFormValor,
  formData, setFormData,
  formDescricao, setFormDescricao,
  formCategorias, setFormCategorias,
  formMembro, setFormMembro,
  formFavorecido, setFormFavorecido,
  rateioTipo, setRateioTipo,
  rateioItems, setRateioItems,
  formTiposCpp, setFormTiposCpp,
  formStatus, setFormStatus,
  formDataVencimento, setFormDataVencimento,
  formDataPagamento, setFormDataPagamento,
  membros, tiposCpp, categorias,
  prefix,
  pendingFiles, setPendingFiles,
  existingAnexos, setExistingAnexos,
  uploading,
  isCreate,
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
  tiposCpp: TipoCPP[];
  categorias: CategoriaItem[];
  prefix: string;
  pendingFiles: globalThis.File[];
  setPendingFiles: (files: globalThis.File[]) => void;
  existingAnexos: AnexoFile[];
  setExistingAnexos: (files: AnexoFile[]) => void;
  uploading: boolean;
  isCreate?: boolean;
}) {
  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const formatted = formatInputBRL(raw);
    setFormValor(formatted);
  }

  function addRateioItem() {
    setRateioItems([...rateioItems, { id: String(Date.now() + Math.random()), membroId: "__none__", valor: "" }]);
  }

  function removeRateioItem(id: string) {
    setRateioItems(rateioItems.filter((item) => item.id !== id));
  }

  function updateRateioItem(id: string, field: "membroId" | "valor", value: string) {
    setRateioItems(rateioItems.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  const totalRateado = rateioItems.reduce((acc, item) => acc + parseBRLToNumber(item.valor), 0);
  const valorTotal = parseBRLToNumber(formValor);

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
            membros={membros}
            value={formFavorecido}
            onValueChange={setFormFavorecido}
            placeholder="Selecione o favorecido..."
            testId={`${prefix}-select-favorecido`}
            allowNone
          />
        ) : (
          <div className="space-y-3">
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
                <div key={item.id} className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <SearchableMembroSelect
                      membros={membros}
                      value={item.membroId}
                      onValueChange={(v) => updateRateioItem(item.id, "membroId", v)}
                      placeholder={`Favorecido ${idx + 1}...`}
                      testId={`${prefix}-rateio-membro-${idx}`}
                      allowNone
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={item.valor}
                      onChange={(e) => updateRateioItem(item.id, "valor", formatInputBRL(e.target.value))}
                      placeholder="0,00"
                      className="text-sm h-9"
                      data-testid={`${prefix}-rateio-valor-${idx}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRateioItem(item.id)}
                    className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                    data-testid={`${prefix}-rateio-remove-${idx}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
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

  const [formTipo, setFormTipo] = useState<"entrada" | "saida">("entrada");
  const [formValor, setFormValor] = useState<string>("");
  const [formData, setFormData] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formDescricao, setFormDescricao] = useState<string>("");
  const [formCategorias, setFormCategorias] = useState<number | null>(null);
  const [formMembro, setFormMembro] = useState<string>("");
  const [formFavorecido, setFormFavorecido] = useState<string>("__none__");
  const [rateioTipo, setRateioTipo] = useState<"individual" | "grupo">("individual");
  const [rateioItems, setRateioItems] = useState<RateioItem[]>([]);
  const [formTiposCpp, setFormTiposCpp] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState<StatusPagamento | "">("");
  const [formDataVencimento, setFormDataVencimento] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formDataPagamento, setFormDataPagamento] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<globalThis.File[]>([]);
  const [existingAnexos, setExistingAnexos] = useState<AnexoFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterCategoria, setFilterCategoria] = useState<string>("todos");
  const [filterMembro, setFilterMembro] = useState<string>("todos");
  const [filterFavorecido, setFilterFavorecido] = useState<string>("todos");
  const [filterTipoCpp, setFilterTipoCpp] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterDescricao, setFilterDescricao] = useState<string>("");
  const [filterDataDe, setFilterDataDe] = useState<string>("");
  const [filterDataAte, setFilterDataAte] = useState<string>("");

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
    queryKey: ["/api/categorias"],
  });

  const { data: allFluxo = [], isLoading: loadingFluxo } = useQuery<FluxoCaixaItem[]>({
    queryKey: ["/api/fluxo-caixa"],
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
      if (da && db) return da < db ? -1 : da > db ? 1 : 0;
      if (da) return -1;
      if (db) return 1;
      return 0;
    });
  }, [fluxoItemsAll, filterTipo, filterCategoria, filterMembro, filterFavorecido, filterTipoCpp, filterDescricao, filterDataDe, filterDataAte, filterStatus]);

  const totals = useMemo(() => {
    const contabeis = fluxoItems.filter((i) => !isValorOrigemAuto(i));
    const entradas = contabeis
      .filter((i) => i.tipo === "entrada" && i.status === "pago")
      .reduce((sum, i) => sum + (parseFloat(String(i.valor)) || 0), 0);
    const saidas = contabeis
      .filter((i) => i.tipo === "saida" && i.status === "pago")
      .reduce((sum, i) => sum + (parseFloat(String(i.valor)) || 0), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [fluxoItems]);

  const today = new Date().toISOString().split("T")[0];
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const financialDashboard = useMemo(() => {
    const allBia = fluxoItemsContabeis;
    const contasPagar = allBia.filter(
      (i) => i.tipo === "saida" && (i.status === "pendente" || i.status === "agendado" || !i.status)
        && !isVencido(i)
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
    const pagas = allBia.filter((i) => i.status === "pago");
    const cancelados = allBia.filter((i) => i.status === "cancelado");
    const sum = (arr: FluxoCaixaItem[]) => arr.reduce((s, i) => s + (parseFloat(String(i.valor)) || 0), 0);
    return {
      contasPagar: { count: contasPagar.length, valor: sum(contasPagar) },
      vencidas:    { count: vencidas.length,    valor: sum(vencidas) },
      aVencer7:    { count: aVencer7.length,    valor: sum(aVencer7) },
      aReceber:    { count: aReceber.length,    valor: sum(aReceber) },
      pagas:       { count: pagas.length,       valor: sum(pagas) },
      cancelados:  { count: cancelados.length,  valor: sum(cancelados) },
    };
  }, [fluxoItemsAll, today, in7days]);

  const aportesPorMembro = useMemo(() => {
    const entradas = fluxoItems.filter((i) => i.tipo === "entrada" && i.Favorecido && i.Favorecido.length > 0);
    const map: Record<string, number> = {};
    entradas.forEach((i) => {
      const mid = getRelId((i.Favorecido || [])[0] as any);
      if (mid) {
        map[mid] = (map[mid] || 0) + (parseFloat(String(i.valor)) || 0);
      }
    });
    const totalAportesComMembro = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([membroId, valor]) => ({
        membroId,
        valor,
        percentual: totalAportesComMembro > 0 ? (valor / totalAportesComMembro) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [fluxoItems]);

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

  const createMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      try {
        const newFileIds = await uploadFiles(pendingFiles);
        if (rateioTipo === "grupo" && rateioItems.length > 0) {
          const base = buildPayload(newFileIds);
          for (const item of rateioItems) {
            const payload = {
              ...base,
              valor: parseBRLToNumber(item.valor),
              Favorecido: item.membroId && item.membroId !== "__none__" ? [item.membroId] : [],
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

  function resetForm() {
    setFormTipo("entrada");
    setFormValor("");
    setFormData(new Date().toISOString().split("T")[0]);
    setFormDescricao("");
    setFormCategorias(null);
    setFormMembro(currentUser?.membro_directus_id || "");
    setFormFavorecido("__none__");
    setRateioTipo("individual");
    setRateioItems([]);
    setFormTiposCpp(null);
    setFormStatus("");
    setFormDataVencimento(new Date().toISOString().split("T")[0]);
    setFormDataPagamento("");
    setPendingFiles([]);
    setExistingAnexos([]);
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

  const selectedBia = bias.find((b) => b.id === selectedBiaId);

  if (loadingBias) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
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
                  rateioItems={rateioItems} setRateioItems={setRateioItems}
                  formTiposCpp={formTiposCpp} setFormTiposCpp={setFormTiposCpp}
                  formStatus={formStatus} setFormStatus={setFormStatus}
                  formDataVencimento={formDataVencimento} setFormDataVencimento={setFormDataVencimento}
                  formDataPagamento={formDataPagamento} setFormDataPagamento={setFormDataPagamento}
                  membros={membros} tiposCpp={tiposCpp}
                  categorias={categorias}
                  prefix="create"
                  pendingFiles={pendingFiles} setPendingFiles={setPendingFiles}
                  existingAnexos={existingAnexos} setExistingAnexos={setExistingAnexos}
                  uploading={uploading}
                  isCreate
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
              const catValorOrigem = categorias.find((c) => c.Nome_da_categoria === "Valor de Origem");
              const valorOrigemPago = fluxoItemsContabeis
                .filter((i) => i.tipo === "saida" && i.status === "pago" && i.Categoria.some((c) => {
                  const id = typeof c === "object" && c !== null ? (c as CategoriaItem).id : c;
                  return catValorOrigem && id === catValorOrigem.id;
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
                  {fluxoItems.filter((i) => i.tipo === "entrada" && i.status === "pago").length} entrada(s) pagas
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
                  {fluxoItems.filter((i) => i.tipo === "saida" && i.status === "pago").length} saída(s) pagas
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

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="panel-financeiro">
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

            <Card className="border-green-500/40 bg-green-500/5" data-testid="panel-pagas">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Pagas/Recebidas</CardTitle>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm font-bold text-green-600 leading-tight break-all" data-testid="text-pagas-valor">{formatBRL(financialDashboard.pagas.valor)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{financialDashboard.pagas.count} lançamento(s)</p>
              </CardContent>
            </Card>

            <Card className="border-gray-400/40 bg-gray-500/5" data-testid="panel-cancelados">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Cancelados</CardTitle>
                <XCircle className="w-3.5 h-3.5 text-gray-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm font-bold text-gray-500 leading-tight break-all" data-testid="text-cancelados-valor">{formatBRL(financialDashboard.cancelados.valor)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{financialDashboard.cancelados.count} lançamento(s)</p>
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
                <div className="space-y-3">
                  {aportesPorMembro.map((item) => (
                    <div key={item.membroId} className="space-y-1" data-testid={`aporte-membro-${item.membroId}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {membroMap[item.membroId] || "Membro desconhecido"}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-muted-foreground">{formatBRL(item.valor)}</span>
                          <Badge variant="outline" className="border-brand-gold/50 text-brand-gold bg-brand-gold/10 min-w-[60px] justify-center" data-testid={`text-perc-membro-${item.membroId}`}>
                            {item.percentual.toFixed(1)}%
                          </Badge>
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
                {(filterTipo !== "todos" || filterCategoria !== "todos" || filterMembro !== "todos" || filterFavorecido !== "todos" || filterTipoCpp !== "todos" || filterStatus !== "todos" || filterDescricao || filterDataDe || filterDataAte) && (
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
                      setFilterDataDe("");
                      setFilterDataAte("");
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
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.Nome_da_categoria}</SelectItem>
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
                      {membros.map((m) => (
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
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Vencimento</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Valor</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descrição</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Categoria</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Favorecido</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tipo CPP</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Anexos</th>
                        <th className="py-3 px-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fluxoItems.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-lancamento-${item.id}`}>
                          {/* Vencimento */}
                          <td className="py-3 px-2 text-sm" data-testid={`text-vencimento-${item.id}`}>
                            {item.data_vencimento ? (
                              <span className={`flex items-center gap-1 ${isVencido(item) && item.status !== "pago" && item.status !== "cancelado" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                <CalendarClock className="w-3 h-3" />
                                {formatDate(item.data_vencimento)}
                              </span>
                            ) : "-"}
                          </td>
                          {/* Status */}
                          <td className="py-3 px-2" data-testid={`text-status-${item.id}`}>
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
                          <td className={`py-3 px-2 text-right font-semibold ${item.tipo === "entrada" ? "text-green-600" : "text-red-600"}`}>
                            {item.tipo === "entrada" ? "+" : "-"}{formatBRL(parseFloat(String(item.valor)) || 0)}
                          </td>
                          {/* Descrição */}
                          <td className="py-3 px-2" data-testid={`text-descricao-${item.id}`}>{item.descricao || "-"}</td>
                          {/* Categoria */}
                          <td className="py-3 px-2">
                            {item.Categoria && item.Categoria.length > 0 ? (
                              <Badge variant="secondary" className="gap-1">
                                <Tag className="w-3 h-3" />
                                {item.Categoria.map((c) => getCatName(c, catMap)).join(", ")}
                              </Badge>
                            ) : "-"}
                          </td>
                          {/* Favorecido */}
                          <td className="py-3 px-2" data-testid={`text-favorecido-${item.id}`}>
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
                                      className="flex items-center gap-1 text-brand-navy hover:text-brand-gold underline decoration-dotted underline-offset-2 transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
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
                          <td className="py-3 px-2" data-testid={`text-tipo-cpp-${item.id}`}>
                            {item.tipo_de_cpp && item.tipo_de_cpp.length > 0 ? (
                              <Badge variant="secondary" className="gap-1">
                                <Layers className="w-3 h-3" />
                                {item.tipo_de_cpp.map((c) => getCppName(c, cppMap)).join(", ")}
                              </Badge>
                            ) : "-"}
                          </td>
                          {/* Anexos */}
                          <td className="py-3 px-2" data-testid={`text-anexos-${item.id}`}>
                            {item.anexos && item.anexos.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1">
                                {item.anexos.map((anexo: any, ai: number) => {
                                  const name = typeof anexo === "string" ? anexo : (anexo.filename || anexo.title || anexo.id);
                                  const href = typeof anexo === "string" ? anexo : anexo.url;
                                  const IconComp = getFileIcon(name);
                                  return (
                                    <a key={ai} href={href} target="_blank" rel="noopener noreferrer" title={name} data-testid={`link-anexo-${item.id}-${ai}`}>
                                      <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs hover:bg-brand-gold/10 hover:border-brand-gold/40">
                                        <IconComp className="w-3 h-3" />
                                        <span className="max-w-[80px] truncate">{name}</span>
                                      </Button>
                                    </a>
                                  );
                                })}
                              </div>
                            ) : "-"}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1">
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
                rateioItems={rateioItems} setRateioItems={setRateioItems}
                formTiposCpp={formTiposCpp} setFormTiposCpp={setFormTiposCpp}
                formStatus={formStatus} setFormStatus={setFormStatus}
                formDataVencimento={formDataVencimento} setFormDataVencimento={setFormDataVencimento}
                formDataPagamento={formDataPagamento} setFormDataPagamento={setFormDataPagamento}
                membros={membros} tiposCpp={tiposCpp}
                categorias={categorias}
                prefix="edit"
                pendingFiles={pendingFiles} setPendingFiles={setPendingFiles}
                existingAnexos={existingAnexos} setExistingAnexos={setExistingAnexos}
                uploading={uploading}
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
        </>
      )}
    </div>
  );
}
