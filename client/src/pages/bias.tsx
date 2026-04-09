import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import {
  Briefcase, Plus, Pencil, Trash2, MapPin, TrendingUp, TrendingDown,
  Search, Building2, Crown, Shield, Hammer, Wallet, AlertCircle,
  Navigation, Crosshair, Loader2, Award, FileText
} from "lucide-react";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from "react-simple-maps";

const BRAZIL_GEO = "/brazil-states.json";

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
  situacao?: "ativa" | "em_formacao" | null;
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
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRLToNumber(formatted: string): number {
  if (!formatted) return 0;
  const cleaned = formatted.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function numToBRLStr(v?: string | number | null): string {
  const num = parseFloat(String(v ?? "")) || 0;
  if (!num) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- BRLInput component ----
function BRLInput({ label, field, form, setForm, testId }: {
  label: string; field: keyof FormState; form: FormState;
  setForm: (f: FormState) => void; testId?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="0,00"
          value={form[field] as string}
          onChange={(e) => setForm({ ...form, [field]: formatInputBRL(e.target.value) })}
          className="pl-9 h-8 text-sm tabular-nums"
          data-testid={testId ?? `input-${field}`}
        />
      </div>
    </div>
  );
}

// ---- Form state type ----
const EMPTY_FORM = {
  nome_bia: "",
  situacao: "ativa" as "ativa" | "em_formacao",
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
    situacao: (b.situacao === "em_formacao" ? "em_formacao" : "ativa") as "ativa" | "em_formacao",
    destinacao: b.destinacao || "",
    selo_certified_alliance: !!b.selo_certified_alliance,
    localizacao: b.localizacao || "",
    latitude: b.latitude != null ? String(b.latitude) : "",
    longitude: b.longitude != null ? String(b.longitude) : "",
    objetivo_alianca: b.objetivo_alianca || "",
    observacoes: b.observacoes || "",
    autor_bia: b.autor_bia || "",
    aliado_built: b.aliado_built || "",
    diretor_alianca: b.diretor_alianca || "",
    diretor_nucleo_tecnico: b.diretor_nucleo_tecnico || "",
    diretor_execucao: b.diretor_execucao || "",
    diretor_comercial: b.diretor_comercial || "",
    diretor_capital: b.diretor_capital || "",
    valor_origem: numToBRLStr(b.valor_origem),
    perc_autor_opa: b.perc_autor_opa != null ? String(b.perc_autor_opa) : "",
    perc_aliado_built: b.perc_aliado_built != null ? String(b.perc_aliado_built) : "",
    perc_built: b.perc_built != null ? String(b.perc_built) : "",
    perc_dir_tecnico: b.perc_dir_tecnico != null ? String(b.perc_dir_tecnico) : "",
    perc_dir_obras: b.perc_dir_obras != null ? String(b.perc_dir_obras) : "",
    perc_dir_comercial: b.perc_dir_comercial != null ? String(b.perc_dir_comercial) : "",
    perc_dir_capital: b.perc_dir_capital != null ? String(b.perc_dir_capital) : "",
    valor_geral_venda_vgv: numToBRLStr(b.valor_geral_venda_vgv),
    valor_realizado_venda: numToBRLStr(b.valor_realizado_venda),
    comissao_prevista_corretor: b.comissao_prevista_corretor != null ? String(b.comissao_prevista_corretor) : "",
    ir_previsto: b.ir_previsto != null ? String(b.ir_previsto) : "",
    inss_previsto: b.inss_previsto != null ? String(b.inss_previsto) : "",
    manutencao_pos_obra_prevista: b.manutencao_pos_obra_prevista != null ? String(b.manutencao_pos_obra_prevista) : "",
    inicio_aportes: b.inicio_aportes || "",
    total_aportes: numToBRLStr(b.total_aportes),
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
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
                    ? "bg-brand-gold/10 border-brand-gold/40 text-brand-gold"
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
      <div className="flex gap-2">
        <Input
          placeholder="Cidade, Estado ou País"
          value={form.localizacao}
          onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
          className="h-8 text-sm flex-1"
          data-testid="input-localizacao"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 border-brand-gold/30 hover:border-brand-gold hover:text-brand-gold gap-1.5"
          onClick={onPickerOpen}
          data-testid="btn-pick-location"
        >
          <Navigation className="w-3.5 h-3.5" />
          Mapa
        </Button>
      </div>
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
      className="relative overflow-hidden rounded-2xl border border-brand-gold/20"
      style={{ height: 440, background: "radial-gradient(ellipse at 50% 110%, #001428 0%, #000c1f 55%, #000408 100%)" }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(215,187,125,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.05) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-brand-gold/40 rounded-tl-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-brand-gold/40 rounded-tr-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-brand-gold/40 rounded-bl-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-brand-gold/40 rounded-br-2xl pointer-events-none" />

      {/* Top-left header */}
      <div className="absolute top-5 left-6 z-20">
        <p className="text-[10px] text-brand-gold/50 tracking-[0.35em] uppercase font-mono">// Built Alliances</p>
        <h2 className="text-xl font-bold tracking-[0.12em] font-mono mt-0.5" style={{ color: "#D7BB7D" }}>
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
          <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">Alianças</p>
          <p className="text-4xl font-bold leading-none" style={{ color: "#D7BB7D" }}>{biasAll.length}</p>
        </div>
        <div>
          <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">VGV Total</p>
          <p className="text-xs font-semibold" style={{ color: "#D7BB7D99" }}>
            {totalVgv > 0 ? brl(totalVgv) : "—"}
          </p>
        </div>
        <p className="text-[9px] text-brand-gold/30 mt-2">{biasWithCoords.length} geolocalizadas</p>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 flex items-center justify-center rounded border font-mono text-sm font-bold transition-colors"
          style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(215,187,125,0.3)", color: "#D7BB7D" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(215,187,125,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          data-testid="btn-map-zoom-in"
          title="Ampliar"
        >+</button>
        <button
          onClick={handleReset}
          className="w-7 h-7 flex items-center justify-center rounded border font-mono text-[9px] font-bold transition-colors"
          style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(215,187,125,0.2)", color: "#D7BB7D80" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(215,187,125,0.1)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          data-testid="btn-map-reset"
          title="Resetar zoom"
        >⊙</button>
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 flex items-center justify-center rounded border font-mono text-sm font-bold transition-colors"
          style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(215,187,125,0.3)", color: "#D7BB7D" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(215,187,125,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          data-testid="btn-map-zoom-out"
          title="Reduzir"
        >−</button>
      </div>

      {/* Map */}
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
                  <circle r={r * (isSelected || isClusterSelected ? 5.5 : isHovered ? 4.5 : 3.5)} fill="#D7BB7D" fillOpacity={isSelected || isClusterSelected ? 0.12 : 0.06}>
                    <animate attributeName="r" from={r * (isSelected || isClusterSelected ? 4 : 2.5)} to={r * (isSelected || isClusterSelected ? 7 : 5)} dur={isSelected || isClusterSelected ? "1.2s" : "1.6s"} repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.4" to="0" dur={isSelected || isClusterSelected ? "1.2s" : "1.6s"} repeatCount="indefinite" />
                  </circle>
                  <circle r={r * (isSelected || isClusterSelected ? 3 : isHovered ? 2.5 : 2)} fill="#D7BB7D" fillOpacity={isSelected || isClusterSelected ? 0.4 : isHovered ? 0.3 : 0.18} />
                  <circle r={r * (isSelected || isClusterSelected ? 1.6 : isHovered ? 1.3 : 1)} fill="#D7BB7D" fillOpacity={0.95} />
                  <circle r={r * 0.7} fill="white" fillOpacity={0.95} />
                  {/* Count badge for clusters */}
                  {isMulti && (
                    <>
                      <circle
                        cx={r * 1.6}
                        cy={r * -1.6}
                        r={r * 1.2}
                        fill={isClusterSelected ? "#D7BB7D" : "#001D34"}
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
                        fill={isClusterSelected ? "#001D34" : "#D7BB7D"}
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

      {/* Hover tooltip bar — only when nothing selected/clustered */}
      {!selectedBia && !clusterBias && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-200 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(0,8,18,0.92) 0%, transparent 100%)",
            padding: "28px 24px 14px",
            opacity: hoveredCluster ? 1 : 0,
            transform: hoveredCluster ? "translateY(0)" : "translateY(6px)",
          }}
        >
          {hoveredCluster && (
            <div className="flex items-end justify-between font-mono">
              <div>
                {hoveredCluster.items.length > 1 ? (
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
                  <p className="text-sm text-brand-gold tabular-nums">{brl(n(hoveredCluster.items[0].valor_geral_venda_vgv))}</p>
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
                    <p className="text-[10px] text-brand-gold/70 tabular-nums shrink-0">{brl(n(b.valor_geral_venda_vgv))}</p>
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
              onClick={() => navigate(`/bias/${selectedBia.id}`)}
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
                    <p className="text-xs font-semibold text-brand-gold tabular-nums">{brl(n(selectedBia.valor_geral_venda_vgv))}</p>
                  </div>
                )}
                {n(selectedBia.resultado_liquido) !== 0 && (
                  <div>
                    <p className="text-[8px] text-brand-gold/35 tracking-widest uppercase">Resultado</p>
                    <p className={`text-xs font-semibold tabular-nums ${n(selectedBia.resultado_liquido) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {brl(n(selectedBia.resultado_liquido))}
                    </p>
                  </div>
                )}
                {n(selectedBia.lucro_previsto) !== 0 && (
                  <div>
                    <p className="text-[8px] text-brand-gold/35 tracking-widest uppercase">Lucro Prev.</p>
                    <p className="text-xs font-semibold text-brand-gold/80 tabular-nums">{brl(n(selectedBia.lucro_previsto))}</p>
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
                              <span style={{ color: "#D7BB7D50" }}> · {brl(n(opa.valor_origem_opa))}</span>
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
                  return autor ? (
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
function BiaCard({ bia, membros, opas, onEdit, onDelete }: {
  bia: BiasProjeto; membros: Membro[]; opas: Oportunidade[];
  onEdit: () => void; onDelete: () => void;
}) {
  const [, navigate] = useLocation();
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
  const aliadoBuilt = bia.aliado_built ? membroMap[bia.aliado_built] : null;

  return (
    <Card
      className="hover:border-brand-gold/40 transition-colors group cursor-pointer"
      data-testid={`card-bia-${bia.id}`}
      onClick={() => navigate(`/bias/${bia.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold leading-tight truncate" data-testid={`text-bia-nome-${bia.id}`}>
                {bia.nome_bia}
              </CardTitle>
              {bia.situacao === "em_formacao" ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 bg-amber-500/10 shrink-0">
                  Em Formação
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-500/40 text-green-600 bg-green-500/10 shrink-0">
                  Ativa
                </Badge>
              )}
            </div>
            {bia.localizacao && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" /> {bia.localizacao}
                {bia.latitude && bia.longitude && (
                  <span className="ml-1 text-brand-gold/50" title="Geolocalizado">
                    <Crosshair className="w-2.5 h-2.5 inline" />
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(); }} data-testid={`btn-edit-bia-${bia.id}`}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }} data-testid={`btn-delete-bia-${bia.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4 space-y-3">
        {/* Destinação + Objetivo */}
        <div className="flex flex-wrap gap-1.5">
          {bia.destinacao && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1" data-testid={`text-destinacao-${bia.id}`}>
              <MapPin className="w-2.5 h-2.5" />{bia.destinacao}
            </Badge>
          )}
          {bia.objetivo_alianca && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4" data-testid={`text-objetivo-${bia.id}`}>
              {bia.objetivo_alianca}
            </Badge>
          )}
          {bia.selo_certified_alliance && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 gap-1 bg-brand-gold/20 text-brand-gold border-brand-gold/40 hover:bg-brand-gold/30" data-testid={`badge-selo-${bia.id}`}>
              <Award className="w-2.5 h-2.5" />Certified Alliance
            </Badge>
          )}
        </div>

        {/* Descrição */}
        {bia.observacoes && (
          <p className="text-xs text-muted-foreground line-clamp-2 flex items-start gap-1">
            <FileText className="w-3 h-3 shrink-0 mt-0.5" />{bia.observacoes}
          </p>
        )}

        {(aliadoBuilt || dirAlianca) && (
          <div className="flex flex-wrap gap-1.5">
            {aliadoBuilt && (
              <Badge variant="outline" className="text-xs font-normal gap-1">
                <Building2 className="w-2.5 h-2.5" /> {aliadoBuilt}
              </Badge>
            )}
            {dirAlianca && dirAlianca !== aliadoBuilt && (
              <Badge variant="outline" className="text-xs font-normal gap-1">
                <Crown className="w-2.5 h-2.5" /> {dirAlianca}
              </Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          {vgv > 0 && (
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-[10px] text-muted-foreground">VGV</p>
              <p className="text-xs font-semibold tabular-nums truncate" data-testid={`text-vgv-${bia.id}`}>{brl(vgv)}</p>
            </div>
          )}
          {valorRealizado > 0 && (
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-[10px] text-muted-foreground">Realizado</p>
              <p className="text-xs font-semibold tabular-nums truncate">{brl(valorRealizado)}</p>
            </div>
          )}
        </div>

        {/* OPAs relacionadas */}
        {(() => {
          const biasOpas = opas.filter(o => o.bia_id === bia.id);
          if (!biasOpas.length) return null;
          return (
            <div className="border-t border-border/50 pt-2.5">
              <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <span className="text-brand-gold/60">◆</span>
                OPAs Relacionadas
                <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1.5 font-normal">
                  {biasOpas.length}
                </Badge>
              </p>
              <div className="flex flex-col gap-1">
                {biasOpas.slice(0, 3).map(opa => (
                  <div key={opa.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground/80 truncate">{opa.nome_oportunidade || "—"}</span>
                    {n(opa.valor_origem_opa) > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{brl(n(opa.valor_origem_opa))}</span>
                    )}
                  </div>
                ))}
                {biasOpas.length > 3 && (
                  <p className="text-[10px] text-muted-foreground/60">+{biasOpas.length - 3} outras</p>
                )}
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

// ---- BIA Form Sheet ----
function BiaFormSheet({ open, onClose, bia, membros, isLoading }: {
  open: boolean;
  onClose: () => void;
  bia: BiasProjeto | null;
  membros: Membro[];
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const isEdit = !!bia;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState("geral");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(bia ? biaToForm(bia) : EMPTY_FORM);
      setActiveTab("geral");
    }
  }, [open, bia]);

  const valorRealizado = parseBRLToNumber(form.valor_realizado_venda);
  const valorOrigem = parseBRLToNumber(form.valor_origem);

  const percTotal = ["perc_autor_opa","perc_aliado_built","perc_built","perc_dir_tecnico",
    "perc_dir_obras","perc_dir_comercial","perc_dir_capital"].reduce(
    (s, k) => s + (parseFloat(form[k as keyof FormState] as string) || 0), 0
  );
  const custoOrigemPreview = valorOrigem + (valorOrigem * percTotal / 100);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        nome_bia: form.nome_bia.trim(),
        situacao: form.situacao,
        destinacao: form.destinacao.trim() || null,
        selo_certified_alliance: form.selo_certified_alliance,
        localizacao: form.localizacao.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        objetivo_alianca: form.objetivo_alianca.trim() || null,
        observacoes: form.observacoes.trim() || null,
        autor_bia: form.autor_bia || null,
        aliado_built: form.aliado_built || null,
        diretor_alianca: form.diretor_alianca || null,
        diretor_nucleo_tecnico: form.diretor_nucleo_tecnico || null,
        diretor_execucao: form.diretor_execucao || null,
        diretor_comercial: form.diretor_comercial || null,
        diretor_capital: form.diretor_capital || null,
        valor_origem: form.valor_origem ? parseBRLToNumber(form.valor_origem) : null,
        perc_autor_opa: form.perc_autor_opa || null,
        perc_aliado_built: form.perc_aliado_built || null,
        perc_built: form.perc_built || null,
        perc_dir_tecnico: form.perc_dir_tecnico || null,
        perc_dir_obras: form.perc_dir_obras || null,
        perc_dir_comercial: form.perc_dir_comercial || null,
        perc_dir_capital: form.perc_dir_capital || null,
        valor_geral_venda_vgv: form.valor_geral_venda_vgv ? parseBRLToNumber(form.valor_geral_venda_vgv) : null,
        valor_realizado_venda: form.valor_realizado_venda ? parseBRLToNumber(form.valor_realizado_venda) : null,
        comissao_prevista_corretor: form.comissao_prevista_corretor || null,
        ir_previsto: form.ir_previsto || null,
        inss_previsto: form.inss_previsto || null,
        manutencao_pos_obra_prevista: form.manutencao_pos_obra_prevista || null,
        inicio_aportes: form.inicio_aportes || null,
        total_aportes: form.total_aportes ? parseBRLToNumber(form.total_aportes) : null,
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

  const canSave =
    form.nome_bia.trim().length > 0 &&
    form.destinacao.trim().length > 0 &&
    form.localizacao.trim().length > 0 &&
    form.objetivo_alianca.trim().length > 0 &&
    form.observacoes.trim().length > 0;

  function handleLocationSelect(localizacao: string, lat: number, lng: number) {
    setForm({ ...form, localizacao, latitude: String(lat), longitude: String(lng) });
  }

  return (
    <>
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
                  {["Residencial", "Comercial", "Industrial", "Misto", "Hospedagem"].map((opt) => (
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
            </TabsContent>

            {/* Tab Equipe */}
            <TabsContent value="equipe" className="space-y-4 mt-4 flex-1">
              <MembroSelect label="Autor da BIA (OPA)" field="autor_bia" form={form} setForm={setForm} membros={membros} icon={Briefcase} />
              <MembroSelect label="Aliado BUILT" field="aliado_built" form={form} setForm={setForm} membros={membros} icon={Shield} />
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Diretores</p>
              <MembroSelect label="Diretor de Aliança" field="diretor_alianca" form={form} setForm={setForm} membros={membros} icon={Crown} />
              <MembroSelect label="Diretor de Núcleo Técnico" field="diretor_nucleo_tecnico" form={form} setForm={setForm} membros={membros} icon={Shield} />
              <MembroSelect label="Diretor de Núcleo de Obra" field="diretor_execucao" form={form} setForm={setForm} membros={membros} icon={Hammer} />
              <MembroSelect label="Diretor Comercial" field="diretor_comercial" form={form} setForm={setForm} membros={membros} icon={Building2} />
              <MembroSelect label="Diretor de Capital" field="diretor_capital" form={form} setForm={setForm} membros={membros} icon={Wallet} />
            </TabsContent>

            {/* Tab CPP */}
            <TabsContent value="cpp" className="space-y-4 mt-4 flex-1">
              <BRLInput label="Valor de Origem (R$)" field="valor_origem" form={form} setForm={setForm} />
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Percentuais CPP (% sobre Valor de Origem)</p>
              <div className="grid grid-cols-1 gap-3">
                <PercField label="Autor da OPA" field="perc_autor_opa" form={form} setForm={setForm} baseValue={valorOrigem} />
                <PercField label="Aliado BUILT" field="perc_aliado_built" form={form} setForm={setForm} baseValue={valorOrigem} />
                <PercField label="BUILT" field="perc_built" form={form} setForm={setForm} baseValue={valorOrigem} />
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
              <BRLInput label="VGV — Valor Geral de Venda (R$)" field="valor_geral_venda_vgv" form={form} setForm={setForm} />
              <BRLInput label="Valor Realizado de Venda (R$)" field="valor_realizado_venda" form={form} setForm={setForm} />
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Deduções (% sobre Valor Realizado)</p>
              <PercField label="Comissão Prevista Corretor" field="comissao_prevista_corretor" form={form} setForm={setForm} baseValue={valorRealizado} />
              <PercField label="IR Previsto" field="ir_previsto" form={form} setForm={setForm} baseValue={valorRealizado} />
              <PercField label="INSS Previsto" field="inss_previsto" form={form} setForm={setForm} baseValue={valorRealizado} />
              <PercField label="Manutenção Pós Obra Prevista" field="manutencao_pos_obra_prevista" form={form} setForm={setForm} baseValue={valorRealizado} />
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

      <LocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={handleLocationSelect}
      />
    </>
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

  const { data: opasRaw = [] } = useQuery<Oportunidade[]>({
    queryKey: ["/api/oportunidades"],
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

  // Auto-open edit sheet when navigated here with ?edit=<id>
  const [, navigate] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (editId && (biasRaw as BiasProjeto[]).length > 0) {
      const target = (biasRaw as BiasProjeto[]).find(b => b.id === editId);
      if (target) {
        setEditingBia(target);
        setSheetOpen(true);
        navigate("/bias", { replace: true });
      }
    }
  }, [biasRaw]);

  const openCreate = () => { setEditingBia(null); setSheetOpen(true); };
  const openEdit = (b: BiasProjeto) => { setEditingBia(b); setSheetOpen(true); };

  const loading = loadingBias || loadingMembros;

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
          <p className="text-sm text-muted-foreground mt-1">Alianças Integradas BUILT — {total} BIA{total !== 1 ? "s" : ""} cadastrada{total !== 1 ? "s" : ""}</p>
        </div>
        <Button
          className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90 font-semibold"
          onClick={openCreate}
          data-testid="btn-create-bia"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova BIA
        </Button>
      </div>

      {/* Futuristic Brazil Map */}
      {!loading && (
        <BrazilMapHeader biasAll={biasRaw as BiasProjeto[]} membros={membros} opas={opasRaw as Oportunidade[]} />
      )}
      {loading && <Skeleton className="h-[440px] rounded-2xl" />}

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
                <p className="text-sm text-muted-foreground/70 mb-4">Comece criando a primeira aliança BUILT</p>
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
              opas={opasRaw as Oportunidade[]}
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
