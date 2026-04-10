import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Target, MapPin, Building2, Globe, Search, Plus, Pencil, Trash2,
  TrendingUp, ChevronRight, Layers, Filter, X, ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ---- Types ----
interface Oportunidade {
  id: string;
  nome_oportunidade?: string;
  tipo?: string;
  bia_id?: string;
  valor_origem_opa?: string | number;
  Minimo_esforco_multiplicador?: string | number;
  objetivo_alianca?: string;
  nucleo_alianca?: string;
  pais?: string;
  descricao?: string;
  perfil_aliado?: string;
}

interface BiasProjeto {
  id: string;
  nome_bia: string;
  localizacao?: string;
}

// ---- Helpers ----
function n(v?: string | number | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatInputBRL(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRLToNumber(formatted: string): number {
  if (!formatted) return 0;
  return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
}

// ---- Futuristic header ----
function OpasHeader({ opas, bias }: { opas: Oportunidade[]; bias: BiasProjeto[] }) {
  const totalValor = opas.reduce((s, o) => s + n(o.valor_origem_opa), 0);
  const biasComOpas = new Set(opas.map(o => o.bia_id).filter(Boolean)).size;
  const paises = new Set(opas.map(o => o.pais).filter(Boolean)).size;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-brand-gold/20"
      style={{ height: 200, background: "radial-gradient(ellipse at 30% 50%, #001d34 0%, #000c1f 55%, #000408 100%)" }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(215,187,125,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-brand-gold/40 rounded-tl-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-brand-gold/40 rounded-tr-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-brand-gold/40 rounded-bl-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-brand-gold/40 rounded-br-2xl pointer-events-none" />

      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(to right, transparent, #D7BB7D40 20%, #D7BB7D60 50%, #D7BB7D40 80%, transparent)",
          animation: "scanLine 8s linear infinite",
          top: 0,
        }}
      />
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes scanLine { 0%{top:0%;opacity:0} 5%{opacity:1} 95%{opacity:1} 100%{top:100%;opacity:0} }`
      }} />

      <div className="relative z-10 h-full flex items-center px-8 gap-12">
        {/* Left: title */}
        <div className="flex-1">
          <p className="text-[10px] text-brand-gold/50 tracking-[0.35em] uppercase font-mono mb-1">// Built Alliances</p>
          <h2 className="text-2xl font-bold tracking-[0.1em] font-mono" style={{ color: "#D7BB7D" }}>
            MAPA DE OPORTUNIDADES
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-gold" />
            </span>
            <span className="text-[10px] text-brand-gold/60 font-mono tracking-[0.2em] uppercase">
              {opas.length} oportunidade{opas.length !== 1 ? "s" : ""} ativas
            </span>
          </div>
        </div>

        {/* Right: stats */}
        <div className="flex gap-8 font-mono text-right">
          <div>
            <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">OPAs</p>
            <p className="text-4xl font-bold leading-none" style={{ color: "#D7BB7D" }}>{opas.length}</p>
          </div>
          <div className="border-l border-brand-gold/15 pl-8">
            <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">Valor Total</p>
            <p className="text-lg font-semibold tabular-nums" style={{ color: "#D7BB7D99" }}>
              {totalValor > 0 ? brl(totalValor) : "—"}
            </p>
          </div>
          <div className="border-l border-brand-gold/15 pl-8">
            <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">BIAs Vinculadas</p>
            <p className="text-4xl font-bold leading-none" style={{ color: "#D7BB7D" }}>{biasComOpas}</p>
          </div>
          {paises > 0 && (
            <div className="border-l border-brand-gold/15 pl-8">
              <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">Países</p>
              <p className="text-4xl font-bold leading-none" style={{ color: "#D7BB7D" }}>{paises}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- OPA Card ----
function OpaCard({
  opa, bia, onEdit, onDelete
}: {
  opa: Oportunidade;
  bia?: BiasProjeto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const valor = n(opa.valor_origem_opa);
  return (
    <Card
      className="hover:border-brand-gold/40 transition-colors group flex flex-col"
      data-testid={`card-opa-${opa.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-sm border"
                style={{ background: "rgba(215,187,125,0.08)", borderColor: "rgba(215,187,125,0.25)", color: "#D7BB7D99" }}
              >
                <span style={{ color: "#D7BB7D60" }}>◆</span> OPA
              </span>
              {opa.tipo && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-normal">{opa.tipo}</Badge>
              )}
            </div>
            <CardTitle className="text-sm font-semibold leading-tight" data-testid={`text-opa-nome-${opa.id}`}>
              {opa.nome_oportunidade || "Sem nome"}
            </CardTitle>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit} data-testid={`btn-edit-opa-${opa.id}`}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete} data-testid={`btn-delete-opa-${opa.id}`}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4 flex flex-col gap-2.5 flex-1">
        {/* BIA vinculada */}
        {bia && (
          <div className="flex items-center gap-1.5 rounded-md bg-brand-gold/5 border border-brand-gold/15 px-2.5 py-1.5 min-w-0">
            <Layers className="w-3 h-3 text-brand-gold/60 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-brand-gold/50 uppercase tracking-wider leading-none mb-0.5">BIA Vinculada</p>
              <p className="text-xs font-medium text-brand-gold/80 truncate">{bia.nome_bia}</p>
              {bia.localizacao && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate mt-0.5">
                  <MapPin className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{bia.localizacao}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Objetivo */}
        {opa.objetivo_alianca && (
          <p className="text-xs text-muted-foreground line-clamp-2">{opa.objetivo_alianca}</p>
        )}

        {/* Tags: nucleo + pais */}
        {(opa.nucleo_alianca || opa.pais) && (
          <div className="flex flex-wrap gap-1.5">
            {opa.nucleo_alianca && (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 font-normal">
                <Building2 className="w-2.5 h-2.5" /> {opa.nucleo_alianca}
              </Badge>
            )}
            {opa.pais && (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 font-normal">
                <Globe className="w-2.5 h-2.5" /> {opa.pais}
              </Badge>
            )}
          </div>
        )}

        {/* Valor + perfil */}
        <div className="flex items-end justify-between gap-2 mt-auto pt-1">
          {valor > 0 ? (
            <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
              <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5" /> Valor OPA
              </p>
              <p className="text-sm font-bold tabular-nums text-foreground" data-testid={`text-valor-opa-${opa.id}`}>
                {brl(valor)}
              </p>
            </div>
          ) : <div />}
          {opa.perfil_aliado && (
            <p className="text-[10px] text-muted-foreground/70 text-right line-clamp-1 max-w-[120px]">{opa.perfil_aliado}</p>
          )}
        </div>

        {/* Descrição */}
        {opa.descricao && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-2 border-t border-border/40 pt-2">{opa.descricao}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- OPA Form ----
const EMPTY_OPA = {
  nome_oportunidade: "",
  tipo: "",
  bia_id: "",
  valor_origem_opa: "",
  Minimo_esforco_multiplicador: "",
  objetivo_alianca: "",
  nucleo_alianca: "",
  pais: "",
  descricao: "",
  perfil_aliado: "",
};

interface TipoOpa { text: string; value: string; }

function OpaFormDialog({
  open, onClose, opa, bias
}: {
  open: boolean;
  onClose: () => void;
  opa: Oportunidade | null;
  bias: BiasProjeto[];
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ ...EMPTY_OPA });

  const { data: tiposOpa = [] } = useQuery<TipoOpa[]>({
    queryKey: ["/api/oportunidades/tipos"],
    staleTime: 1000 * 60 * 10,
  });

  useMemo(() => {
    if (opa) {
      setForm({
        nome_oportunidade: opa.nome_oportunidade || "",
        tipo: opa.tipo || "",
        bia_id: opa.bia_id || "",
        valor_origem_opa: n(opa.valor_origem_opa) > 0
          ? (n(opa.valor_origem_opa)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          : "",
        Minimo_esforco_multiplicador: n(opa.Minimo_esforco_multiplicador) > 0
          ? String(n(opa.Minimo_esforco_multiplicador))
          : "",
        objetivo_alianca: opa.objetivo_alianca || "",
        nucleo_alianca: opa.nucleo_alianca || "",
        pais: opa.pais || "",
        descricao: opa.descricao || "",
        perfil_aliado: opa.perfil_aliado || "",
      });
    } else {
      setForm({ ...EMPTY_OPA });
    }
  }, [opa, open]);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      opa
        ? apiRequest("PATCH", `/api/oportunidades/${opa.id}`, data)
        : apiRequest("POST", "/api/oportunidades", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades"] });
      toast({ title: opa ? "OPA atualizada" : "OPA criada" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  function handleSave() {
    if (!form.nome_oportunidade.trim()) {
      toast({ title: "Nome da OPA é obrigatório", variant: "destructive" });
      return;
    }
    if (!form.bia_id) {
      toast({ title: "BIA Vinculada é obrigatória", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      nome_oportunidade: form.nome_oportunidade,
      tipo: form.tipo || null,
      bia: form.bia_id || null,
      valor_origem_opa: parseBRLToNumber(form.valor_origem_opa) || null,
      Minimo_esforco_multiplicador: form.Minimo_esforco_multiplicador ? parseFloat(form.Minimo_esforco_multiplicador) : null,
      objetivo_alianca: form.objetivo_alianca || null,
      nucleo_alianca: form.nucleo_alianca || null,
      pais: form.pais || null,
      descricao: form.descricao || null,
      perfil_aliado: form.perfil_aliado || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{opa ? "Editar OPA" : "Nova OPA"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Título da OPA *</Label>
            <Input
              value={form.nome_oportunidade}
              onChange={e => setForm(f => ({ ...f, nome_oportunidade: e.target.value }))}
              placeholder="Nome da OPA"
              className="h-8 text-sm"
              data-testid="input-opa-nome"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select
                value={form.tipo || "__none__"}
                onValueChange={v => setForm(f => ({ ...f, tipo: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="select-opa-tipo">
                  <SelectValue placeholder="Selecionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem tipo —</SelectItem>
                  {tiposOpa.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.text}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">País</Label>
              <Input
                value={form.pais}
                onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
                placeholder="Brasil"
                className="h-8 text-sm"
                data-testid="input-opa-pais"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">BIA Vinculada *</Label>
            <Select
              value={form.bia_id || undefined}
              onValueChange={v => setForm(f => ({ ...f, bia_id: v }))}
            >
              <SelectTrigger
                className={`h-8 text-sm ${!form.bia_id ? "text-muted-foreground border-destructive/40" : ""}`}
                data-testid="select-opa-bia"
              >
                <SelectValue placeholder="Selecione a BIA..." />
              </SelectTrigger>
              <SelectContent>
                {bias.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => { onClose(); navigate("/bias?criar=true"); }}
              className="mt-1 flex items-center gap-1 text-[11px] text-brand-gold/60 hover:text-brand-gold transition-colors"
              data-testid="btn-criar-bia-from-opa"
            >
              <ExternalLink className="w-3 h-3" />
              Criar nova BIA
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor da OPA (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.valor_origem_opa}
                  onChange={e => setForm(f => ({ ...f, valor_origem_opa: formatInputBRL(e.target.value) }))}
                  placeholder="0,00"
                  className="pl-9 h-8 text-sm tabular-nums"
                  data-testid="input-opa-valor"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mín. Esforço Multiplicador</Label>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.Minimo_esforco_multiplicador}
                  onChange={e => setForm(f => ({ ...f, Minimo_esforco_multiplicador: e.target.value }))}
                  placeholder="0,00"
                  className="pr-8 h-8 text-sm tabular-nums"
                  data-testid="input-opa-minimo-esforco"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Núcleo de Aliança</Label>
            <Input
              value={form.nucleo_alianca}
              onChange={e => setForm(f => ({ ...f, nucleo_alianca: e.target.value }))}
              placeholder="Ex: Construção Civil"
              className="h-8 text-sm"
              data-testid="input-opa-nucleo"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Objetivo da Aliança</Label>
            <Textarea
              value={form.objetivo_alianca}
              onChange={e => setForm(f => ({ ...f, objetivo_alianca: e.target.value }))}
              placeholder="Descreva o objetivo..."
              className="text-sm min-h-[70px] resize-none"
              data-testid="textarea-opa-objetivo"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Perfil do Aliado</Label>
            <Textarea
              value={form.perfil_aliado}
              onChange={e => setForm(f => ({ ...f, perfil_aliado: e.target.value }))}
              placeholder="Perfil desejado do aliado..."
              className="text-sm min-h-[60px] resize-none"
              data-testid="textarea-opa-perfil"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descrição detalhada..."
              className="text-sm min-h-[70px] resize-none"
              data-testid="textarea-opa-descricao"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
            data-testid="btn-save-opa"
          >
            {saveMutation.isPending ? "Salvando..." : opa ? "Salvar" : "Criar OPA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Page ----
export default function OportunidadesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterBia, setFilterBia] = useState<string>("__all__");
  const [editingOpa, setEditingOpa] = useState<Oportunidade | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Oportunidade | null>(null);

  const { data: opasRaw = [], isLoading: loadingOpas } = useQuery<Oportunidade[]>({
    queryKey: ["/api/oportunidades"],
  });

  const { data: biasRaw = [], isLoading: loadingBias } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const bias = biasRaw as BiasProjeto[];
  const opas = opasRaw as Oportunidade[];

  const biasMap = useMemo(() => {
    const m: Record<string, BiasProjeto> = {};
    bias.forEach(b => { m[b.id] = b; });
    return m;
  }, [bias]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return opas.filter(o => {
      const haystack = `${o.nome_oportunidade || ""} ${o.objetivo_alianca || ""} ${o.nucleo_alianca || ""} ${o.pais || ""} ${o.tipo || ""}`
        .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const matchSearch = !q || haystack.includes(q);
      const matchBia = filterBia === "__all__" || o.bia_id === filterBia;
      return matchSearch && matchBia;
    });
  }, [opas, search, filterBia]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/oportunidades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades"] });
      toast({ title: "OPA removida" });
      setDeleteTarget(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    },
  });

  const loading = loadingOpas || loadingBias;

  function openCreate() { setEditingOpa(null); setFormOpen(true); }
  function openEdit(o: Oportunidade) { setEditingOpa(o); setFormOpen(true); }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-brand-gold" />
            Minhas OPAs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestão de Oportunidades — {loading ? "..." : `${opas.length} OPA${opas.length !== 1 ? "s" : ""} cadastrada${opas.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90 font-semibold"
          data-testid="btn-nova-opa"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova OPA
        </Button>
      </div>

      {/* Futuristic header */}
      {!loading && <OpasHeader opas={opas} bias={bias} />}
      {loading && <Skeleton className="h-[200px] rounded-2xl" />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar OPA..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-opas"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={filterBia} onValueChange={setFilterBia}>
            <SelectTrigger className="w-[220px]" data-testid="select-filter-bia">
              <SelectValue placeholder="Filtrar por BIA..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as BIAs</SelectItem>
              {bias.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterBia !== "__all__" || search) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => { setFilterBia("__all__"); setSearch(""); }}
              data-testid="btn-clear-filters"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* BIA relationship summary — if filtering by BIA */}
      {filterBia !== "__all__" && biasMap[filterBia] && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 border"
          style={{ background: "rgba(215,187,125,0.05)", borderColor: "rgba(215,187,125,0.2)" }}
        >
          <Layers className="w-5 h-5 text-brand-gold/60 shrink-0" />
          <div>
            <p className="text-[10px] text-brand-gold/50 uppercase tracking-widest font-mono">BIA Selecionada</p>
            <p className="text-sm font-semibold text-brand-gold/80">{biasMap[filterBia].nome_bia}</p>
            {biasMap[filterBia].localizacao && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />{biasMap[filterBia].localizacao}
              </p>
            )}
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-muted-foreground">OPAs nesta BIA</p>
            <p className="text-2xl font-bold text-brand-gold">
              {opas.filter(o => o.bia_id === filterBia).length}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-brand-gold/30" />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-60" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            {search || filterBia !== "__all__" ? (
              <>
                <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma OPA encontrada com esses filtros</p>
                <Button variant="link" onClick={() => { setSearch(""); setFilterBia("__all__"); }} className="mt-2">
                  Limpar filtros
                </Button>
              </>
            ) : (
              <>
                <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhuma OPA cadastrada</h3>
                <p className="text-sm text-muted-foreground/70 mb-4">Crie a primeira oportunidade de aliança</p>
                <Button className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-2" /> Criar primeira OPA
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(opa => (
            <OpaCard
              key={opa.id}
              opa={opa}
              bia={opa.bia_id ? biasMap[opa.bia_id] : undefined}
              onEdit={() => openEdit(opa)}
              onDelete={() => setDeleteTarget(opa)}
            />
          ))}
        </div>
      )}

      {/* Form dialog */}
      <OpaFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        opa={editingOpa}
        bias={bias}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover OPA</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a OPA "{deleteTarget?.nome_oportunidade}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="btn-confirm-delete-opa"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
