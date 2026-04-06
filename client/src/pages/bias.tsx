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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Briefcase, Plus, Pencil, Trash2, MapPin, TrendingUp, TrendingDown,
  Search, Building2, Crown, Shield, Hammer, Wallet, AlertCircle,
  Navigation, Crosshair, Loader2
} from "lucide-react";
import {
  ComposableMap, Geographies, Geography, Marker
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
  objetivo_alianca?: string;
  observacoes?: string;
  localizacao?: string;
  latitude?: number | null;
  longitude?: number | null;
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
  localizacao: "",
  latitude: "",
  longitude: "",
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
    latitude: b.latitude != null ? String(b.latitude) : "",
    longitude: b.longitude != null ? String(b.longitude) : "",
    objetivo_alianca: b.objetivo_alianca || "",
    observacoes: b.observacoes || "",
    autor_bia: b.autor_bia || "",
    aliado_built: b.aliado_built || "",
    diretor_alianca: b.diretor_alianca || "",
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
      <Label className="text-xs text-muted-foreground">Localização</Label>
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
function BrazilMapHeader({ biasAll }: { biasAll: BiasProjeto[] }) {
  const [hoveredBia, setHoveredBia] = useState<BiasProjeto | null>(null);
  const biasWithCoords = useMemo(
    () => biasAll.filter(b => b.latitude != null && b.longitude != null),
    [biasAll]
  );
  const totalVgv = biasAll.reduce((s, b) => s + n(b.valor_geral_venda_vgv), 0);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-brand-gold/20"
      style={{ height: 400, background: "radial-gradient(ellipse at 50% 120%, #001830 0%, #000b14 60%, #000508 100%)" }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(215,187,125,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.06) 1px, transparent 1px)",
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

      {/* Map */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [-52, -15], scale: 670 }}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={BRAZIL_GEO}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: { fill: "#011e38", stroke: "#D7BB7D50", strokeWidth: 0.6, outline: "none" },
                  hover: { fill: "#013060", stroke: "#D7BB7D80", strokeWidth: 0.8, outline: "none" },
                  pressed: { fill: "#011e38", outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {biasWithCoords.map((b) => {
          const lng = parseFloat(String(b.longitude));
          const lat = parseFloat(String(b.latitude));
          const isHovered = hoveredBia?.id === b.id;
          return (
            <Marker
              key={b.id}
              coordinates={[lng, lat]}
              onMouseEnter={() => setHoveredBia(b)}
              onMouseLeave={() => setHoveredBia(null)}
            >
              <g style={{ cursor: "pointer" }}>
                {/* Outer ping ring */}
                <circle r={isHovered ? 20 : 16} fill="#D7BB7D" fillOpacity={0.06}>
                  <animate attributeName="r" from={isHovered ? 16 : 12} to={isHovered ? 28 : 22} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" from="0.3" to="0" dur="1.6s" repeatCount="indefinite" />
                </circle>
                {/* Mid ring */}
                <circle r={isHovered ? 10 : 8} fill="#D7BB7D" fillOpacity={isHovered ? 0.25 : 0.15} />
                {/* Core dot */}
                <circle r={isHovered ? 5 : 4} fill="#D7BB7D" fillOpacity={0.95} />
                <circle r={isHovered ? 2.5 : 2} fill="white" fillOpacity={0.9} />
              </g>
            </Marker>
          );
        })}
      </ComposableMap>

      {/* Hover info bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-200 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(0,11,20,0.95) 0%, transparent 100%)",
          padding: "24px 24px 16px",
          opacity: hoveredBia ? 1 : 0,
          transform: hoveredBia ? "translateY(0)" : "translateY(4px)",
        }}
      >
        {hoveredBia && (
          <div className="flex items-end justify-between font-mono">
            <div>
              <p className="text-[9px] text-brand-gold/50 tracking-widest uppercase">Aliança Selecionada</p>
              <p className="text-sm font-bold text-brand-gold mt-0.5">{hoveredBia.nome_bia}</p>
              {hoveredBia.localizacao && (
                <p className="text-[11px] text-brand-gold/60 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />{hoveredBia.localizacao}
                </p>
              )}
            </div>
            <div className="text-right">
              {hoveredBia.valor_geral_venda_vgv && n(hoveredBia.valor_geral_venda_vgv) > 0 && (
                <div>
                  <p className="text-[9px] text-brand-gold/40 uppercase tracking-wider">VGV</p>
                  <p className="text-sm text-brand-gold tabular-nums">{brl(n(hoveredBia.valor_geral_venda_vgv))}</p>
                </div>
              )}
              <p className="text-[9px] text-brand-gold/30 mt-1 font-mono">
                {parseFloat(String(hoveredBia.latitude)).toFixed(4)}, {parseFloat(String(hoveredBia.longitude)).toFixed(4)}
              </p>
            </div>
          </div>
        )}
      </div>

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
                {bia.latitude && bia.longitude && (
                  <span className="ml-1 text-brand-gold/50" title="Geolocalizado">
                    <Crosshair className="w-2.5 h-2.5 inline" />
                  </span>
                )}
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

      <CardContent className="pt-0 pb-4 space-y-3">
        {bia.objetivo_alianca && (
          <p className="text-xs text-muted-foreground line-clamp-2">{bia.objetivo_alianca}</p>
        )}

        {(autorBia || dirAlianca) && (
          <div className="flex flex-wrap gap-1.5">
            {autorBia && (
              <Badge variant="outline" className="text-xs font-normal gap-1">
                <Briefcase className="w-2.5 h-2.5" /> {autorBia}
              </Badge>
            )}
            {dirAlianca && dirAlianca !== autorBia && (
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
          {resultado !== 0 && (
            <div className={`rounded-md p-2 col-span-2 ${resultado >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                {resultado >= 0 ? <TrendingUp className="w-2.5 h-2.5 text-green-500" /> : <TrendingDown className="w-2.5 h-2.5 text-red-500" />}
                Resultado Líquido
              </p>
              <p className={`text-sm font-bold tabular-nums ${resultado >= 0 ? "text-green-600" : "text-red-600"}`} data-testid={`text-resultado-${bia.id}`}>
                {brl(resultado)}
              </p>
            </div>
          )}
        </div>
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
        localizacao: form.localizacao.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        objetivo_alianca: form.objetivo_alianca.trim() || null,
        observacoes: form.observacoes.trim() || null,
        autor_bia: form.autor_bia || null,
        aliado_built: form.aliado_built || null,
        diretor_alianca: form.diretor_alianca || null,
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

  const canSave = form.nome_bia.trim().length > 0;

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
              <LocationField form={form} setForm={setForm} onPickerOpen={() => setLocationPickerOpen(true)} />
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
              <BRLInput label="Valor de Origem (R$)" field="valor_origem" form={form} setForm={setForm} />
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
              <BRLInput label="VGV — Valor Geral de Venda (R$)" field="valor_geral_venda_vgv" form={form} setForm={setForm} />
              <BRLInput label="Valor Realizado de Venda (R$)" field="valor_realizado_venda" form={form} setForm={setForm} />
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Deduções (% sobre Valor Realizado)</p>
              <PercField label="Comissão Prevista Corretor" field="comissao_prevista_corretor" form={form} setForm={setForm} baseValue={valorRealizado} />
              <PercField label="IR Previsto" field="ir_previsto" form={form} setForm={setForm} baseValue={valorRealizado} />
              <PercField label="INSS Previsto" field="inss_previsto" form={form} setForm={setForm} baseValue={valorRealizado} />
              <PercField label="Manutenção Pós Obra Prevista" field="manutencao_pos_obra_prevista" form={form} setForm={setForm} baseValue={valorRealizado} />
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Aportes</p>
              <FieldInput label="Início dos Aportes" field="inicio_aportes" form={form} setForm={setForm} type="date" />
              <BRLInput label="Total de Aportes (R$)" field="total_aportes" form={form} setForm={setForm} />
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

      {/* Futuristic Brazil Map */}
      {!loading && (
        <BrazilMapHeader biasAll={biasRaw as BiasProjeto[]} />
      )}
      {loading && <Skeleton className="h-[400px] rounded-2xl" />}

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
