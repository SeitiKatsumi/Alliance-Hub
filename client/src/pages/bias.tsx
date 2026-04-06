import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Briefcase, Plus, Pencil, Trash2, MapPin, Target, TrendingUp, TrendingDown,
  Users, DollarSign, Percent, Search, BarChart3, Building2, Crown,
  Shield, Hammer, Wallet, CalendarDays, AlertCircle
} from "lucide-react";

// ---- Types ----
interface Membro {
  id: string;
  nome?: string;
  Nome_de_usuario?: string;
  nome_completo?: string;
  primeiro_nome?: string;
  sobrenome?: string;
  empresa?: string;
}

interface BiasProjeto {
  id: string;
  nome_bia: string;
  objetivo_alianca?: string;
  observacoes?: string;
  localizacao?: string;
  // Equipe
  autor_bia?: string | null;
  aliado_built?: string | null;
  diretor_alianca?: string | null;
  diretor_execucao?: string | null;
  diretor_comercial?: string | null;
  diretor_capital?: string | null;
  // CPP
  valor_origem?: string | number;
  divisor_multiplicador?: string | number;
  perc_autor_opa?: string | number;
  perc_aliado_built?: string | number;
  perc_built?: string | number;
  perc_dir_tecnico?: string | number;
  perc_dir_obras?: string | number;
  perc_dir_comercial?: string | number;
  perc_dir_capital?: string | number;
  cpp_autor_opa?: string | number;
  cpp_aliado_built?: string | number;
  cpp_built?: string | number;
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
}

// ---- Helpers ----
function getMembroNome(m: Membro): string {
  return m.Nome_de_usuario || m.nome_completo ||
    [m.primeiro_nome, m.sobrenome].filter(Boolean).join(" ") ||
    m.nome || "";
}

function n(v?: string | number | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ---- Form state type ----
const EMPTY_FORM = {
  nome_bia: "",
  localizacao: "",
  objetivo_alianca: "",
  observacoes: "",
  autor_bia: "",
  aliado_built: "",
  diretor_alianca: "",
  diretor_execucao: "",
  diretor_comercial: "",
  diretor_capital: "",
  valor_origem: "",
  perc_autor_opa: "",
  perc_aliado_built: "",
  perc_built: "",
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
};

type FormState = typeof EMPTY_FORM;

function biaToForm(b: BiasProjeto): FormState {
  return {
    nome_bia: b.nome_bia || "",
    localizacao: b.localizacao || "",
    objetivo_alianca: b.objetivo_alianca || "",
    observacoes: b.observacoes || "",
    autor_bia: b.autor_bia || "",
    aliado_built: b.aliado_built || "",
    diretor_alianca: b.diretor_alianca || "",
    diretor_execucao: b.diretor_execucao || "",
    diretor_comercial: b.diretor_comercial || "",
    diretor_capital: b.diretor_capital || "",
    valor_origem: b.valor_origem != null ? String(b.valor_origem) : "",
    perc_autor_opa: b.perc_autor_opa != null ? String(b.perc_autor_opa) : "",
    perc_aliado_built: b.perc_aliado_built != null ? String(b.perc_aliado_built) : "",
    perc_built: b.perc_built != null ? String(b.perc_built) : "",
    perc_dir_tecnico: b.perc_dir_tecnico != null ? String(b.perc_dir_tecnico) : "",
    perc_dir_obras: b.perc_dir_obras != null ? String(b.perc_dir_obras) : "",
    perc_dir_comercial: b.perc_dir_comercial != null ? String(b.perc_dir_comercial) : "",
    perc_dir_capital: b.perc_dir_capital != null ? String(b.perc_dir_capital) : "",
    valor_geral_venda_vgv: b.valor_geral_venda_vgv != null ? String(b.valor_geral_venda_vgv) : "",
    valor_realizado_venda: b.valor_realizado_venda != null ? String(b.valor_realizado_venda) : "",
    comissao_prevista_corretor: b.comissao_prevista_corretor != null ? String(b.comissao_prevista_corretor) : "",
    ir_previsto: b.ir_previsto != null ? String(b.ir_previsto) : "",
    inss_previsto: b.inss_previsto != null ? String(b.inss_previsto) : "",
    manutencao_pos_obra_prevista: b.manutencao_pos_obra_prevista != null ? String(b.manutencao_pos_obra_prevista) : "",
    inicio_aportes: b.inicio_aportes || "",
    total_aportes: b.total_aportes != null ? String(b.total_aportes) : "",
  };
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
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        placeholder={placeholder}
        value={form[field]}
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
  const equiv = baseValue && baseValue > 0 ? (pct / 100) * baseValue : null;
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
            value={form[field]}
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

function MembroSelect({ label, field, form, setForm, membros, icon: Icon }: {
  label: string; field: keyof FormState; form: FormState;
  setForm: (f: FormState) => void; membros: Membro[]; icon?: any;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </Label>
      <Select
        value={(form[field] as string) || "none"}
        onValueChange={(v) => setForm({ ...form, [field]: v === "none" ? "" : v })}
      >
        <SelectTrigger className="h-8 text-sm" data-testid={`select-${field}`}>
          <SelectValue placeholder="Selecionar..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Nenhum —</SelectItem>
          {membros.map((m) => (
            <SelectItem key={m.id} value={m.id}>{getMembroNome(m)}{m.empresa ? ` · ${m.empresa}` : ""}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---- BIA Card ----
function BiaCard({ bia, membros, onEdit, onDelete }: {
  bia: BiasProjeto; membros: Membro[];
  onEdit: () => void; onDelete: () => void;
}) {
  const membroMap = useMemo(() => {
    const map: Record<string, string> = {};
    membros.forEach((m) => { map[m.id] = getMembroNome(m); });
    return map;
  }, [membros]);

  const resultado = n(bia.resultado_liquido);
  const lucro = n(bia.lucro_previsto);
  const custoFinal = n(bia.custo_final_previsto);
  const valorRealizado = n(bia.valor_realizado_venda);
  const vgv = n(bia.valor_geral_venda_vgv);

  const dirAlianca = bia.diretor_alianca ? membroMap[bia.diretor_alianca] : null;
  const autorBia = bia.autor_bia ? membroMap[bia.autor_bia] : null;

  return (
    <Card className="hover:border-brand-gold/40 transition-colors group" data-testid={`card-bia-${bia.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-tight truncate" data-testid={`text-bia-nome-${bia.id}`}>
              {bia.nome_bia}
            </CardTitle>
            {bia.localizacao && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" /> {bia.localizacao}
              </p>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} data-testid={`btn-edit-bia-${bia.id}`}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} data-testid={`btn-delete-bia-${bia.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {bia.objetivo_alianca && (
          <p className="text-xs text-muted-foreground line-clamp-2">{bia.objetivo_alianca}</p>
        )}

        {/* Equipe */}
        {(dirAlianca || autorBia) && (
          <div className="flex flex-wrap gap-1">
            {dirAlianca && (
              <Badge variant="outline" className="text-xs gap-1">
                <Crown className="w-2.5 h-2.5" /> {dirAlianca}
              </Badge>
            )}
            {autorBia && dirAlianca !== autorBia && (
              <Badge variant="outline" className="text-xs gap-1">
                <Briefcase className="w-2.5 h-2.5" /> {autorBia}
              </Badge>
            )}
          </div>
        )}

        <Separator />

        {/* Financeiro */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {vgv > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">VGV</p>
              <p className="text-sm font-medium tabular-nums">{brl(vgv)}</p>
            </div>
          )}
          {valorRealizado > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Realizado</p>
              <p className="text-sm font-medium tabular-nums">{brl(valorRealizado)}</p>
            </div>
          )}
          {custoFinal > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Custo CPP</p>
              <p className="text-sm font-medium tabular-nums text-red-600">{brl(custoFinal)}</p>
            </div>
          )}
          {(resultado !== 0 || lucro !== 0) && (
            <div>
              <p className="text-xs text-muted-foreground">Resultado</p>
              <div className="flex items-center gap-1">
                {resultado >= 0
                  ? <TrendingUp className="w-3 h-3 text-green-600" />
                  : <TrendingDown className="w-3 h-3 text-red-600" />}
                <p className={`text-sm font-semibold tabular-nums ${resultado >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {brl(resultado)}
                </p>
              </div>
            </div>
          )}
        </div>

        {lucro !== 0 && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${lucro >= 0 ? "text-green-600 border-green-500/40" : "text-red-600 border-red-500/40"}`}
            >
              <Percent className="w-3 h-3 mr-1" /> {lucro.toFixed(2)}% lucro
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- BIA Form Sheet ----
function BiaFormSheet({
  open, onClose, bia, membros, isLoading
}: {
  open: boolean; onClose: () => void;
  bia: BiasProjeto | null; membros: Membro[]; isLoading: boolean;
}) {
  const { toast } = useToast();
  const isEdit = !!bia;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState("geral");

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setForm(bia ? biaToForm(bia) : EMPTY_FORM);
      setActiveTab("geral");
    }
  }, [open, bia]);

  const valorRealizado = parseFloat(form.valor_realizado_venda) || 0;
  const valorOrigem = parseFloat(form.valor_origem) || 0;

  // CPP calc preview
  const percTotal = ["perc_autor_opa","perc_aliado_built","perc_built","perc_dir_tecnico",
    "perc_dir_obras","perc_dir_comercial","perc_dir_capital"].reduce(
    (s, k) => s + (parseFloat(form[k as keyof FormState] as string) || 0), 0
  );
  const custoOrigemPreview = valorOrigem + (valorOrigem * percTotal / 100);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        nome_bia: form.nome_bia.trim(),
        localizacao: form.localizacao.trim() || null,
        objetivo_alianca: form.objetivo_alianca.trim() || null,
        observacoes: form.observacoes.trim() || null,
        autor_bia: form.autor_bia || null,
        aliado_built: form.aliado_built || null,
        diretor_alianca: form.diretor_alianca || null,
        diretor_execucao: form.diretor_execucao || null,
        diretor_comercial: form.diretor_comercial || null,
        diretor_capital: form.diretor_capital || null,
        valor_origem: form.valor_origem || null,
        perc_autor_opa: form.perc_autor_opa || null,
        perc_aliado_built: form.perc_aliado_built || null,
        perc_built: form.perc_built || null,
        perc_dir_tecnico: form.perc_dir_tecnico || null,
        perc_dir_obras: form.perc_dir_obras || null,
        perc_dir_comercial: form.perc_dir_comercial || null,
        perc_dir_capital: form.perc_dir_capital || null,
        valor_geral_venda_vgv: form.valor_geral_venda_vgv || null,
        valor_realizado_venda: form.valor_realizado_venda || null,
        comissao_prevista_corretor: form.comissao_prevista_corretor || null,
        ir_previsto: form.ir_previsto || null,
        inss_previsto: form.inss_previsto || null,
        manutencao_pos_obra_prevista: form.manutencao_pos_obra_prevista || null,
        inicio_aportes: form.inicio_aportes || null,
        total_aportes: form.total_aportes || null,
      };
      if (isEdit) {
        return apiRequest("PATCH", `/api/bias/${bia!.id}`, payload);
      } else {
        return apiRequest("POST", "/api/bias", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bias"] });
      toast({ title: isEdit ? "BIA atualizada!" : "BIA criada!", description: form.nome_bia });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  });

  const canSave = form.nome_bia.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="w-4 h-4 text-brand-gold" /> : <Plus className="w-4 h-4 text-brand-gold" />}
            {isEdit ? `Editar BIA` : "Nova BIA"}
          </SheetTitle>
          <SheetDescription>{isEdit ? bia?.nome_bia : "Preencha os dados da nova aliança"}</SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 mt-4 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-4 shrink-0">
            <TabsTrigger value="geral" data-testid="tab-geral">Geral</TabsTrigger>
            <TabsTrigger value="equipe" data-testid="tab-equipe">Equipe</TabsTrigger>
            <TabsTrigger value="cpp" data-testid="tab-cpp">CPP</TabsTrigger>
            <TabsTrigger value="receita" data-testid="tab-receita">Receita</TabsTrigger>
          </TabsList>

          {/* Tab Geral */}
          <TabsContent value="geral" className="space-y-4 mt-4 flex-1">
            <FieldInput label="Nome da BIA *" field="nome_bia" form={form} setForm={setForm} placeholder="Ex: BIA Residencial Norte" />
            <FieldInput label="Localização" field="localizacao" form={form} setForm={setForm} placeholder="Cidade, Estado ou País" />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Objetivo da Aliança</Label>
              <Textarea
                rows={3}
                placeholder="Descreva o objetivo desta BIA..."
                value={form.objetivo_alianca}
                onChange={(e) => setForm({ ...form, objetivo_alianca: e.target.value })}
                className="text-sm resize-none"
                data-testid="input-objetivo_alianca"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea
                rows={3}
                placeholder="Observações adicionais..."
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="text-sm resize-none"
                data-testid="input-observacoes"
              />
            </div>
          </TabsContent>

          {/* Tab Equipe */}
          <TabsContent value="equipe" className="space-y-4 mt-4 flex-1">
            <MembroSelect label="Autor da BIA (OPA)" field="autor_bia" form={form} setForm={setForm} membros={membros} icon={Briefcase} />
            <MembroSelect label="Aliado Built" field="aliado_built" form={form} setForm={setForm} membros={membros} icon={Shield} />
            <Separator />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Diretores</p>
            <MembroSelect label="Diretor de Aliança" field="diretor_alianca" form={form} setForm={setForm} membros={membros} icon={Crown} />
            <MembroSelect label="Diretor de Execução" field="diretor_execucao" form={form} setForm={setForm} membros={membros} icon={Hammer} />
            <MembroSelect label="Diretor Comercial" field="diretor_comercial" form={form} setForm={setForm} membros={membros} icon={Building2} />
            <MembroSelect label="Diretor de Capital" field="diretor_capital" form={form} setForm={setForm} membros={membros} icon={Wallet} />
          </TabsContent>

          {/* Tab CPP */}
          <TabsContent value="cpp" className="space-y-4 mt-4 flex-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor de Origem (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.valor_origem}
                  onChange={(e) => setForm({ ...form, valor_origem: e.target.value })}
                  className="pl-9 h-8 text-sm"
                  data-testid="input-valor_origem"
                />
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Percentuais CPP (% sobre Valor de Origem)</p>
            <div className="grid grid-cols-1 gap-3">
              <PercField label="Autor da OPA" field="perc_autor_opa" form={form} setForm={setForm} baseValue={valorOrigem} />
              <PercField label="Aliado Built" field="perc_aliado_built" form={form} setForm={setForm} baseValue={valorOrigem} />
              <PercField label="Built" field="perc_built" form={form} setForm={setForm} baseValue={valorOrigem} />
              <PercField label="Diretor Técnico" field="perc_dir_tecnico" form={form} setForm={setForm} baseValue={valorOrigem} />
              <PercField label="Diretor de Obras" field="perc_dir_obras" form={form} setForm={setForm} baseValue={valorOrigem} />
              <PercField label="Diretor Comercial" field="perc_dir_comercial" form={form} setForm={setForm} baseValue={valorOrigem} />
              <PercField label="Diretor de Capital" field="perc_dir_capital" form={form} setForm={setForm} baseValue={valorOrigem} />
            </div>
            {valorOrigem > 0 && (
              <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total CPP (Σ percentuais = {percTotal.toFixed(2)}%)</span>
                <span className="font-semibold text-orange-600 tabular-nums">{brl(custoOrigemPreview - valorOrigem)}</span>
              </div>
            )}
          </TabsContent>

          {/* Tab Receita */}
          <TabsContent value="receita" className="space-y-4 mt-4 flex-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receita</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">VGV — Valor Geral de Venda (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input
                  type="number" step="0.01" min="0" placeholder="0,00"
                  value={form.valor_geral_venda_vgv}
                  onChange={(e) => setForm({ ...form, valor_geral_venda_vgv: e.target.value })}
                  className="pl-9 h-8 text-sm" data-testid="input-valor_geral_venda_vgv"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor Realizado de Venda (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input
                  type="number" step="0.01" min="0" placeholder="0,00"
                  value={form.valor_realizado_venda}
                  onChange={(e) => setForm({ ...form, valor_realizado_venda: e.target.value })}
                  className="pl-9 h-8 text-sm" data-testid="input-valor_realizado_venda"
                />
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Deduções (% sobre Valor Realizado)</p>
            <PercField label="Comissão Prevista Corretor" field="comissao_prevista_corretor" form={form} setForm={setForm} baseValue={valorRealizado} />
            <PercField label="IR Previsto" field="ir_previsto" form={form} setForm={setForm} baseValue={valorRealizado} />
            <PercField label="INSS Previsto" field="inss_previsto" form={form} setForm={setForm} baseValue={valorRealizado} />
            <PercField label="Manutenção Pós Obra Prevista" field="manutencao_pos_obra_prevista" form={form} setForm={setForm} baseValue={valorRealizado} />
            <Separator />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Aportes</p>
            <FieldInput label="Início dos Aportes" field="inicio_aportes" form={form} setForm={setForm} type="date" />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Total de Aportes (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input
                  type="number" step="0.01" min="0" placeholder="0,00"
                  value={form.total_aportes}
                  onChange={(e) => setForm({ ...form, total_aportes: e.target.value })}
                  className="pl-9 h-8 text-sm" data-testid="input-total_aportes"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="shrink-0 pt-4 border-t flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending || isLoading}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
            data-testid="btn-save-bia"
          >
            {saveMutation.isPending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar BIA"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---- Main Page ----
export default function BiasPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBia, setEditingBia] = useState<BiasProjeto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BiasProjeto | null>(null);

  const { data: biasRaw = [], isLoading: loadingBias } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const { data: membrosRaw = [], isLoading: loadingMembros } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
  });

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
    },
    onError: (e: any) => {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    }
  });

  const openCreate = () => { setEditingBia(null); setSheetOpen(true); };
  const openEdit = (b: BiasProjeto) => { setEditingBia(b); setSheetOpen(true); };

  const loading = loadingBias || loadingMembros;

  // Summary stats
  const total = (biasRaw as BiasProjeto[]).length;
  const totalVgv = (biasRaw as BiasProjeto[]).reduce((s, b) => s + n(b.valor_geral_venda_vgv), 0);
  const totalRealizado = (biasRaw as BiasProjeto[]).reduce((s, b) => s + n(b.valor_realizado_venda), 0);
  const totalResultado = (biasRaw as BiasProjeto[]).reduce((s, b) => s + n(b.resultado_liquido), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
              <Briefcase className="w-6 h-6" />
            </div>
            BIAs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de Alianças Built — {total} BIA{total !== 1 ? "s" : ""} cadastrada{total !== 1 ? "s" : ""}</p>
        </div>
        <Button
          className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90 font-semibold"
          onClick={openCreate}
          data-testid="btn-create-bia"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova BIA
        </Button>
      </div>

      {/* Summary Cards */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total de BIAs</p>
              <p className="text-2xl font-bold text-brand-gold" data-testid="text-total-bias">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">VGV Total</p>
              <p className="text-lg font-bold tabular-nums" data-testid="text-total-vgv">{brl(totalVgv)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Realizado Total</p>
              <p className="text-lg font-bold tabular-nums">{brl(totalRealizado)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Resultado Líquido</p>
              <p className={`text-lg font-bold tabular-nums ${totalResultado >= 0 ? "text-green-600" : "text-red-600"}`}>
                {brl(totalResultado)}
              </p>
            </CardContent>
          </Card>
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
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : bias.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            {search ? (
              <>
                <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma BIA encontrada para "{search}"</p>
              </>
            ) : (
              <>
                <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhuma BIA cadastrada</h3>
                <p className="text-sm text-muted-foreground/70 mb-4">Comece criando a primeira aliança Built</p>
                <Button
                  className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
                  onClick={openCreate}
                >
                  <Plus className="w-4 h-4 mr-2" /> Criar primeira BIA
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bias.map((b) => (
            <BiaCard
              key={b.id}
              bia={b}
              membros={membros}
              onEdit={() => openEdit(b)}
              onDelete={() => setDeleteTarget(b)}
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
              {deleteMutation.isPending ? "Removendo..." : "Sim, remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
