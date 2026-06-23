import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import {
  Target, MapPin, Building2, Globe, Search, Plus, Pencil, Trash2,
  TrendingUp, ChevronRight, Layers, Filter, X, ExternalLink,
  CheckCircle2, XCircle, RotateCcw, Ban, Paperclip, Upload, FileText,
  Navigation, ZoomIn, ZoomOut, ImageIcon
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { capitalizeWords } from "@/lib/utils";
import { getAllTipos, getTipoDisplayName, RAMOS_SEGMENTOS } from "@/lib/ramos-segmentos";
import { MapWheelGuard } from "@/components/map-wheel-guard";
import { ComposableMap, ZoomableGroup, Geographies, Geography, Marker } from "react-simple-maps";

const WORLD_GEO = "/world-countries-50m.json";
const ASSET_CACHE_VERSION = "directus-db-20260616";

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

function relationId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "object") return value.id ? String(value.id) : null;
  return String(value);
}

// ---- Types ----
type AnexoFile = { id: string; title?: string; filename?: string; url?: string; size?: string };

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

type OpaStatus = "ativa" | "pausada" | "cancelado" | "encerrada" | "concluida" | "desistencia";

interface Oportunidade {
  id: string;
  nome_oportunidade?: string;
  tipo?: string;
  ramo_atuacao?: string | null;
  cidade?: string | null;
  estado?: string | null;
  bia_id?: string;
  valor_origem_opa?: string | number;
  Minimo_esforco_multiplicador?: string | number;
  objetivo_alianca?: string;
  nucleo_alianca?: string;
  pais?: string;
  descricao?: string;
  perfil_aliado?: string;
  status?: OpaStatus | null;
  motivo_encerramento?: string | null;
  Anexos?: AnexoFile[];
  imagem_directus_id?: string | null;
  imagem_url?: string | null;
  date_created?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  localizacao?: string | null;
}

interface BiasProjeto {
  id: string;
  nome_bia: string;
  localizacao?: string;
  latitude?: number | null;
  longitude?: number | null;
  autor_bia?: string | { id?: string } | null;
  aliado_built?: string | { id?: string } | null;
  diretor_alianca?: string | { id?: string } | null;
  diretor_nucleo_tecnico?: string | { id?: string } | null;
  diretor_execucao?: string | { id?: string } | null;
  diretor_comercial?: string | { id?: string } | null;
  diretor_capital?: string | { id?: string } | null;
  socios_guardioes?: Array<string | { id?: string; cadastro_geral_id?: string | { id?: string } }> | string | null;
  socios_multiplicadores?: Array<string | { id?: string; cadastro_geral_id?: string | { id?: string } }> | string | null;
  terceiros?: Array<string | { id?: string; cadastro_geral_id?: string | { id?: string } }> | string | null;
}

function parseMemberIds(value: BiasProjeto["socios_guardioes"]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return relationId(item.cadastro_geral_id) || relationId(item);
      })
      .filter((id): id is string => !!id);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseMemberIds(parsed as any);
  } catch {}
  return value.split(",").map((id) => id.trim()).filter(Boolean);
}

function isMembroAssociatedToBia(bia: BiasProjeto, membroId?: string | null): boolean {
  if (!membroId) return false;
  const directRoles = [
    bia.autor_bia,
    bia.aliado_built,
    bia.diretor_alianca,
    bia.diretor_nucleo_tecnico,
    bia.diretor_execucao,
    bia.diretor_comercial,
    bia.diretor_capital,
  ].map(relationId);
  const listRoles = [
    ...parseMemberIds(bia.socios_guardioes),
    ...parseMemberIds(bia.socios_multiplicadores),
    ...parseMemberIds(bia.terceiros),
  ];
  return [...directRoles, ...listRoles].some((id) => String(id) === String(membroId));
}

const OPA_STATUS_BADGES: Record<OpaStatus, { label: string; className: string }> = {
  ativa: {
    label: "Ativa",
    className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 hover:bg-emerald-500/15",
  },
  pausada: {
    label: "Pausada",
    className: "bg-amber-500/15 text-amber-700 border-amber-500/25 hover:bg-amber-500/15",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-rose-500/15 text-rose-600 border-rose-500/25 hover:bg-rose-500/15",
  },
  encerrada: {
    label: "Encerrada",
    className: "bg-slate-500/15 text-slate-600 border-slate-500/25 hover:bg-slate-500/15",
  },
  concluida: {
    label: "Concluída",
    className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/15",
  },
  desistencia: {
    label: "Desistência",
    className: "bg-rose-500/15 text-rose-500 border-rose-500/30 hover:bg-rose-500/15",
  },
};

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

function cleanFileName(value?: string | null): string {
  if (!value) return "";
  return value
    .normalize("NFC")
    .replace(/Veneto/gi, "Veneto")
    .replace(/El?trico/gi, "Elétrico")
    .replace(/Climatiza??o/gi, "Climatização")
    .replace(/\uFFFD+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function anexoDisplayName(anexo: AnexoFile): string {
  const title = cleanFileName(anexo.title);
  const filename = cleanFileName(anexo.filename);
  return title || filename || anexo.id;
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
    if (!open) { setSearch(""); setResults([]); setSelected(null); setError(""); }
  }, [open]);

  async function handleSearch() {
    if (!search.trim()) return;
    setLoading(true); setError(""); setResults([]); setSelected(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=8&accept-language=pt-BR,pt`;
      const res = await fetch(url, { headers: { "Accept-Language": "pt-BR,pt;q=0.9" } });
      if (!res.ok) throw new Error("Erro na busca");
      const data: NominatimResult[] = await res.json();
      if (data.length === 0) setError("Nenhum resultado encontrado.");
      setResults(data);
    } catch { setError("Falha ao buscar localização."); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-brand-gold" />
            Selecionar Localização
          </DialogTitle>
          <DialogDescription>Busque cidade, país ou endereço para geolocalizar esta OPA no mapa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Ex: São Paulo, Brazil..."
              className="h-9 text-sm"
            />
            <Button size="sm" onClick={handleSearch} disabled={loading} className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90 shrink-0">
              {loading ?"..." : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {results.map(r => (
              <button
                key={r.place_id}
                onClick={() => setSelected(r)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors border ${selected?.place_id === r.place_id ?"bg-brand-gold/15 border-brand-gold/40 text-brand-gold" : "border-transparent hover:bg-muted"}`}
              >
                <span className="font-medium">{r.display_name}</span>
                <span className="block text-muted-foreground mt-0.5">{parseFloat(r.lat).toFixed(4)}, {parseFloat(r.lon).toFixed(4)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            disabled={!selected}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
            onClick={() => { if (selected) { onSelect(selected.display_name, parseFloat(selected.lat), parseFloat(selected.lon)); onClose(); } }}
          >
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- OPA World Map ----
type OpaResolved = Oportunidade & { _lat: number; _lng: number; _localizacao: string | null };

function OpaWorldMap({ opas, bias }: { opas: Oportunidade[]; bias: BiasProjeto[] }) {
  const [, navigate] = useLocation();
  const [hoveredCluster, setHoveredCluster] = useState<{ center: [number, number]; items: OpaResolved[] } | null>(null);
  const [selectedOpa, setSelectedOpa] = useState<OpaResolved | null>(null);
  const [clusterOpas, setClusterOpas] = useState<OpaResolved[] | null>(null);
  const [zoom, setZoom] = useState(1.2);
  const [center, setCenter] = useState<[number, number]>([-20, 10]);

  const biasMap = useMemo(() => {
    const m: Record<string, BiasProjeto> = {};
    bias.forEach(b => { m[b.id] = b; });
    return m;
  }, [bias]);

  // Resolve effective coordinates: OPA's own coords first, then fall back to BIA's coords
  const opasWithCoords = useMemo(() => {
    return opas
      .map(o => {
        const lat = o.latitude ?? biasMap[o.bia_id ?? ""]?.latitude ?? null;
        const lng = o.longitude ?? biasMap[o.bia_id ?? ""]?.longitude ?? null;
        const localizacao = o.localizacao ?? biasMap[o.bia_id ?? ""]?.localizacao ?? null;
        if (lat == null || lng == null) return null;
        return { ...o, _lat: parseFloat(String(lat)), _lng: parseFloat(String(lng)), _localizacao: localizacao };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);
  }, [opas, biasMap]);

  const clusters = useMemo(() => {
    const THRESHOLD = 0.5;
    const result: { center: [number, number]; items: typeof opasWithCoords }[] = [];
    for (const o of opasWithCoords) {
      const existing = result.find(
        c => Math.abs(c.center[0] - o._lng) < THRESHOLD && Math.abs(c.center[1] - o._lat) < THRESHOLD
      );
      if (existing) existing.items.push(o);
      else result.push({ center: [o._lng, o._lat], items: [o] });
    }
    return result;
  }, [opasWithCoords]);

  const totalValor = opas.reduce((s, o) => s + n(o.valor_origem_opa), 0);
  const biasComOpas = new Set(opas.map(o => o.bia_id).filter(Boolean)).size;

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 16));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 0.8));
  const handleReset = () => { setZoom(1.2); setCenter([-20, 10]); };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-cyan-400/20"
      style={{ height: 360, background: "radial-gradient(ellipse at 50% 110%, #001428 0%, #000c1f 55%, #000408 100%)" }}
    >
      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(215,187,125,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.05) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-cyan-400/40 rounded-tl-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-cyan-400/40 rounded-tr-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-cyan-400/40 rounded-bl-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-cyan-400/40 rounded-br-2xl pointer-events-none" />

      {/* Top-left label */}
      <div className="absolute top-5 left-6 z-20">
        <p className="text-[10px] text-cyan-300/60 tracking-[0.35em] uppercase font-mono">// BUILT Alliances</p>
        <h2 className="text-xl font-bold tracking-[0.12em] font-mono mt-0.5 text-cyan-300">
          MAPA DE OPORTUNIDADES
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300" />
          </span>
          <span className="text-[10px] text-cyan-300/65 font-mono tracking-[0.2em] uppercase">
            {opasWithCoords.length} geolocalizadas
          </span>
        </div>
      </div>

      {/* Top-right stats */}
      <div className="absolute top-5 right-6 z-20 text-right font-mono">
        <div className="mb-3">
          <p className="text-[9px] text-cyan-300/50 tracking-widest uppercase">OPAs</p>
          <p className="text-4xl font-bold leading-none text-cyan-300">{opas.length}</p>
        </div>
        <div className="mb-2">
          <p className="text-[9px] text-cyan-300/50 tracking-widest uppercase">Valor Total</p>
          <p className="text-xs font-semibold tabular-nums text-cyan-300/70">
            {totalValor > 0 ?brl(totalValor) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-cyan-300/50 tracking-widest uppercase">BIAs</p>
          <p className="text-lg font-bold text-cyan-300">{biasComOpas}</p>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1">
        {[
          { label: "+", title: "Ampliar", onClick: handleZoomIn },
          { label: "⊙", title: "Resetar", onClick: handleReset },
          { label: "−", title: "Reduzir", onClick: handleZoomOut },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            title={btn.title}
            className="w-7 h-7 flex items-center justify-center rounded border font-mono text-sm font-bold transition-colors"
            style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(34,211,238,0.35)", color: "#67E8F9" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,211,238,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          >{btn.label}</button>
        ))}
      </div>

      {/* Empty state */}
      {opasWithCoords.length === 0 && (
        <div className="absolute inset-0 flex items-end justify-center pb-16 z-10 pointer-events-none">
          <div className="text-center">
            <p className="text-[10px] text-cyan-300/35 font-mono tracking-widest uppercase">Nenhuma OPA geolocal.</p>
            <p className="text-[9px] text-cyan-300/25 font-mono mt-0.5">Edite uma OPA e adicione localização</p>
          </div>
        </div>
      )}

      {/* Map */}
      <MapWheelGuard>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [0, 10], scale: 160 }}
          style={{ width: "100%", height: "100%" }}
        >
        <ZoomableGroup zoom={zoom} center={center} minZoom={0.8} maxZoom={16}
          onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates); setZoom(z); }}
        >
          <Geographies geography={WORLD_GEO}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography key={geo.rsmKey} geography={geo}
                  style={{
                    default: { fill: "#011630", stroke: "#22D3EE28", strokeWidth: 0.3, outline: "none" },
                    hover:   { fill: "#011a3c", stroke: "#22D3EE40", strokeWidth: 0.3, outline: "none" },
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
            const isSelected = !isMulti && selectedOpa?.id === cluster.items[0]?.id;
            const isClusterSel = isMulti && clusterOpas === cluster.items;
            const r = Math.max(2, 5 / zoom);
            return (
              <Marker key={idx} coordinates={[lng, lat]}
                onMouseEnter={() => setHoveredCluster(cluster)}
                onMouseLeave={() => setHoveredCluster(null)}
                onClick={() => {
                  setHoveredCluster(null);
                  if (isMulti) { setSelectedOpa(null); setClusterOpas(cluster.items); }
                  else { setClusterOpas(null); setSelectedOpa(cluster.items[0]); }
                }}
              >
                <g style={{ cursor: "pointer" }}>
                  <circle r={r * (isSelected || isClusterSel ?5.5 : isHovered ?4.5 : 3.5)} fill="#22D3EE" fillOpacity={0.06}>
                    <animate attributeName="r" from={r * 2.5} to={r * 5} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.4" to="0" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                  <circle r={r * (isSelected || isClusterSel ?3 : isHovered ?2.5 : 2)} fill="#22D3EE" fillOpacity={isSelected || isClusterSel ?0.4 : isHovered ?0.3 : 0.18} />
                  <circle r={r * (isSelected || isClusterSel ?1.6 : isHovered ?1.3 : 1)} fill="#67E8F9" fillOpacity={0.95} />
                  <circle r={r * 0.7} fill="white" fillOpacity={0.95} />
                  {isMulti && (
                    <>
                      <circle cx={r * 1.6} cy={r * -1.6} r={r * 1.2} fill={isClusterSel ?"#67E8F9" : "#001D34"} stroke="#67E8F9" strokeWidth={0.5} />
                      <text x={r * 1.6} y={r * -1.6} textAnchor="middle" dominantBaseline="central"
                        fontSize={r * 1.0} fontWeight="bold" fontFamily="monospace"
                        fill={isClusterSel ?"#001D34" : "#67E8F9"}>{cluster.items.length}</text>
                    </>
                  )}
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
        </ComposableMap>
      </MapWheelGuard>

      {/* Decorative scan line */}
      <div className="absolute left-0 right-0 h-px pointer-events-none z-10"
        style={{ background: "linear-gradient(to right, transparent, #22D3EE40 20%, #22D3EE60 50%, #22D3EE40 80%, transparent)", animation: "scanLineOpas 6s linear infinite", top: 0 }}
      />
      <style dangerouslySetInnerHTML={{ __html: `@keyframes scanLineOpas { 0% { top: 0%; opacity: 0; } 5% { opacity: 1; } 95% { opacity: 1; } 100% { top: 100%; opacity: 0; } }` }} />

      {/* Hover tooltip */}
      {!selectedOpa && !clusterOpas && (
        <div className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-200 pointer-events-none"
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
                    <p className="text-[9px] text-cyan-300/45 tracking-[0.3em] uppercase">Clique para selecionar</p>
                    <p className="text-sm font-bold text-cyan-300 mt-0.5">{hoveredCluster.items.length} OPAs neste local</p>
                  </>
                ) : (
                  <>
                    <p className="text-[9px] text-cyan-300/45 tracking-[0.3em] uppercase">Clique para ver detalhes</p>
                    <p className="text-sm font-bold text-cyan-300 mt-0.5">{hoveredCluster.items[0].nome_oportunidade}</p>
                    {hoveredCluster.items[0]._localizacao && (
                      <p className="text-[11px] text-cyan-300/60 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{hoveredCluster.items[0]._localizacao?.split(",")[0]}
                      </p>
                    )}
                  </>
                )}
              </div>
              {hoveredCluster.items.length === 1 && n(hoveredCluster.items[0].valor_origem_opa) > 0 && (
                <div className="text-right">
                  <p className="text-[9px] text-cyan-300/45 uppercase tracking-wider">Valor</p>
                  <p className="text-sm text-cyan-300 tabular-nums">{brl(n(hoveredCluster.items[0].valor_origem_opa))}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cluster picker */}
      {clusterOpas && !selectedOpa && (
        <div className="absolute bottom-0 left-0 right-0 z-30 transition-all duration-300"
          style={{ background: "linear-gradient(to top, rgba(0,8,20,0.98) 0%, rgba(0,12,28,0.96) 70%, transparent 100%)", padding: "32px 24px 18px" }}
        >
          <button onClick={() => setClusterOpas(null)} className="absolute top-3 right-4 text-cyan-300/45 hover:text-cyan-200 transition-colors font-mono text-xs tracking-widest">
            ✕ FECHAR
          </button>
          <p className="text-[9px] text-cyan-300/45 tracking-[0.3em] uppercase font-mono mb-2">{clusterOpas.length} OPAs neste local</p>
          <div className="flex flex-wrap gap-2">
            {clusterOpas.map(o => (
              <button key={o.id} onClick={() => { setClusterOpas(null); setSelectedOpa(o); }}
                className="text-left px-3 py-1.5 rounded border border-cyan-400/20 hover:border-cyan-300/50 hover:bg-cyan-300/10 transition-colors"
              >
                <p className="text-xs font-semibold text-cyan-300 font-mono">{o.nome_oportunidade}</p>
                <p className="text-[10px] text-cyan-300/55">{o.nucleo_alianca}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected OPA panel */}
      {selectedOpa && (
        <div className="absolute bottom-0 left-0 right-0 z-30 transition-all duration-300"
          style={{ background: "linear-gradient(to top, rgba(0,8,20,0.98) 0%, rgba(0,12,28,0.96) 80%, transparent 100%)", padding: "32px 24px 18px" }}
        >
          <button onClick={() => setSelectedOpa(null)} className="absolute top-3 right-4 text-cyan-300/45 hover:text-cyan-200 transition-colors font-mono text-xs tracking-widest">
            ✕ FECHAR
          </button>
          <div className="flex items-end justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-cyan-300/45 tracking-[0.3em] uppercase font-mono">OPA Selecionada</p>
              <p className="text-base font-bold text-cyan-300 font-mono truncate mt-0.5">{selectedOpa.nome_oportunidade}</p>
              {selectedOpa._localizacao && (
                <p className="text-[11px] text-cyan-300/60 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />{selectedOpa._localizacao?.split(",").slice(0, 2).join(",")}
                </p>
              )}
              {selectedOpa.bia_id && biasMap[selectedOpa.bia_id] && (
                <p className="text-[10px] text-cyan-300/45 mt-1 font-mono">
                  BIA: {biasMap[selectedOpa.bia_id].nome_bia}
                </p>
              )}
              {selectedOpa.nucleo_alianca && (
                <p className="text-[10px] text-cyan-300/45 font-mono">{selectedOpa.nucleo_alianca}</p>
              )}
            </div>
            <div className="flex gap-6 font-mono text-right ml-6 shrink-0">
              {n(selectedOpa.valor_origem_opa) > 0 && (
                <div>
                  <p className="text-[9px] text-cyan-300/45 uppercase tracking-wider">Valor</p>
                  <p className="text-sm font-bold text-cyan-300 tabular-nums">{brl(n(selectedOpa.valor_origem_opa))}</p>
                </div>
              )}
              {n(selectedOpa.Minimo_esforco_multiplicador) > 0 && (
                <div>
                  <p className="text-[9px] text-cyan-300/45 uppercase tracking-wider" title="Mínimo Esforço Multiplicador">MEM</p>
                  <p className="text-sm font-bold text-cyan-300">{n(selectedOpa.Minimo_esforco_multiplicador)}%</p>
                </div>
              )}
              <div>
                <button
                  onClick={() => navigate(`/opas/${selectedOpa.id}`)}
                  className="mt-1 px-3 py-1.5 rounded border border-cyan-400/45 hover:bg-cyan-300/15 transition-colors text-xs text-cyan-300 font-mono tracking-wider"
                >
                  VER OPA →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Encerramento Dialog ----
function EncerramentoDialog({ open, onClose, onConfirm }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (status: "concluida" | "desistencia", motivo: string) => void;
}) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<"concluida" | "desistencia">("concluida");
  const [motivo, setMotivo] = useState("");

  function handleConfirm() {
    if (!motivo.trim()) {
      toast({ title: "Informe o motivo do encerramento", variant: "destructive" });
      return;
    }
    onConfirm(tipo, motivo.trim());
    setMotivo("");
    setTipo("concluida");
  }

  function handleClose() {
    setMotivo("");
    setTipo("concluida");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive" /> Encerrar OPA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo de Encerramento *</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as "concluida" | "desistencia")}>
              <SelectTrigger className="h-9 text-sm" data-testid="select-encerramento-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concluida">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Conclusão
                  </span>
                </SelectItem>
                <SelectItem value="desistencia">
                  <span className="flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5 text-rose-500" /> Desistência
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Motivo / Justificativa *</Label>
            <Textarea
              placeholder="Descreva o motivo do encerramento desta OPA..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={4}
              className="text-sm resize-none"
              data-testid="textarea-encerramento-motivo"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="btn-encerramento-cancelar">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className={tipo === "concluida" ?"bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}
            data-testid="btn-encerramento-confirmar"
          >
            {tipo === "concluida" ?<CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
            Confirmar Encerramento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- OPA Card ----
function OpaCard({
  opa, bia, onViewDetail
}: {
  opa: Oportunidade;
  bia?: BiasProjeto;
  onViewDetail: () => void;
}) {
  const valor = n(opa.valor_origem_opa);
  const currentStatus = (opa.status || "ativa") as OpaStatus;
  const statusBadge = OPA_STATUS_BADGES[currentStatus] || OPA_STATUS_BADGES.ativa;
  const isClosed = ["cancelado", "encerrada", "concluida", "desistencia"].includes(currentStatus);
  const imageUrl = versionAssetUrl(opa.imagem_url) || versionAssetUrl(opa.imagem_directus_id);
  const locationLabel = [opa.cidade, opa.estado].filter(Boolean).join(", ") || opa.pais || bia?.localizacao || "";

  return (
    <Card
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md ${isClosed ? "opacity-60" : ""}`}
      data-testid={`card-opa-${opa.id}`}
      onClick={onViewDetail}
    >
      <div className="relative h-[112px] w-full bg-gradient-to-br from-blue-50 to-slate-100">
        {imageUrl ? (
          <img src={imageUrl} alt={opa.nome_oportunidade || "OPA"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-blue-500/25">
            <Target className="h-9 w-9" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm">
          Pública
        </span>
      </div>

      <CardContent className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              {opa.tipo || "OPA"}
            </span>
            {opa.ramo_atuacao && (
              <span className="max-w-[180px] truncate rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                {opa.ramo_atuacao}
              </span>
            )}
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>

        <CardTitle className="mt-3 line-clamp-2 min-h-[40px] text-base font-semibold leading-tight" data-testid={`text-opa-nome-${opa.id}`}>
          {opa.nome_oportunidade || "OPA sem nome"}
        </CardTitle>

        <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
          {opa.nucleo_alianca || locationLabel || "Oportunidade BUILT"}
        </p>

        {(bia?.nome_bia || locationLabel) && (
          <div className="mt-2 flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            {bia?.nome_bia && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{bia.nome_bia}</span>
              </span>
            )}
            {locationLabel && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{locationLabel}</span>
              </span>
            )}
          </div>
        )}

        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">Valor</p>
            <p className="whitespace-nowrap text-sm font-semibold leading-tight text-foreground" data-testid={`text-valor-opa-${opa.id}`}>
              {valor > 0 ? brl(valor) : "-"}
            </p>
          </div>
          <div className="min-w-0 text-right" title="Mínimo Esforço Multiplicador">
            <p className="text-[10px] text-muted-foreground">MEM</p>
            <p className="whitespace-nowrap text-sm font-semibold leading-tight text-foreground" data-testid={`text-min-esforco-opa-${opa.id}`}>
              {n(opa.Minimo_esforco_multiplicador) ? `${n(opa.Minimo_esforco_multiplicador).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "-"}
            </p>
          </div>
        </div>

        {(opa.date_created || (opa.Anexos && opa.Anexos.length > 0)) && (
          <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground/55">
            {opa.date_created ? (
              <span>
                {(() => {
                  const dias = Math.floor((Date.now() - new Date(opa.date_created).getTime()) / 86400000);
                  return dias === 0 ? "Publicada hoje" : dias === 1 ? "Publicada há 1 dia" : `Publicada há ${dias} dias`;
                })()}
              </span>
            ) : <span />}
            {opa.Anexos && opa.Anexos.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {opa.Anexos.length}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- OPA Form ----
const EMPTY_OPA = {
  nome_oportunidade: "",
  tipo: "",
  ramo_atuacao: "",
  status: "ativa" as OpaStatus,
  bia_id: "",
  valor_origem_opa: "",
  Minimo_esforco_multiplicador: "",
  nucleo_alianca: "",
  descricao: "",
  perfil_aliado: "",
  localizacao: "",
};

export function OpaFormDialog({
  open, onClose, opa, bias
}: {
  open: boolean;
  onClose: () => void;
  opa: Oportunidade | null;
  bias: BiasProjeto[];
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ ...EMPTY_OPA });
  const [formLat, setFormLat] = useState<number | null>(null);
  const [formLng, setFormLng] = useState<number | null>(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [existingAnexos, setExistingAnexos] = useState<AnexoFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [imagemOpaId, setImagemOpaId] = useState<string | null>(null);
  const [imagemOpaPreview, setImagemOpaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const areasContribuicao = useMemo(
    () => Array.from(new Set(getAllTipos().map((tipo) => getTipoDisplayName(tipo.nome)).filter(Boolean))),
    [],
  );

  const membroId = (user as any)?.membro_directus_id || null;
  const associatedBias = useMemo(
    () => bias.filter((bia) => isMembroAssociatedToBia(bia, membroId)),
    [bias, membroId],
  );
  const selectedBiaIsAllowed = useMemo(
    () => !!form.bia_id && associatedBias.some((bia) => bia.id === form.bia_id),
    [associatedBias, form.bia_id],
  );

  useMemo(() => {
    if (opa) {
      setForm({
        nome_oportunidade: opa.nome_oportunidade || "",
        tipo: opa.tipo || "",
        ramo_atuacao: opa.ramo_atuacao || "",
        status: opa.status || "ativa",
        bia_id: opa.bia_id || "",
        valor_origem_opa: n(opa.valor_origem_opa) > 0
          ?(n(opa.valor_origem_opa)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          : "",
        Minimo_esforco_multiplicador: n(opa.Minimo_esforco_multiplicador) > 0
          ?String(n(opa.Minimo_esforco_multiplicador))
          : "",
        nucleo_alianca: opa.nucleo_alianca || "",
        descricao: opa.descricao || "",
        perfil_aliado: opa.perfil_aliado || "",
        localizacao: opa.localizacao || "",
      });
      setFormLat(opa.latitude ?? null);
      setFormLng(opa.longitude ?? null);
      setExistingAnexos(opa.Anexos || []);
      setImagemOpaId(opa.imagem_directus_id || null);
      setImagemOpaPreview(versionAssetUrl(opa.imagem_url) || versionAssetUrl(opa.imagem_directus_id));
    } else {
      setForm({ ...EMPTY_OPA });
      setFormLat(null);
      setFormLng(null);
      setExistingAnexos([]);
      setImagemOpaId(null);
      setImagemOpaPreview(null);
    }
    setPendingFiles([]);
  }, [opa, open]);

  useEffect(() => {
    if (!open || !membroId || !form.bia_id || selectedBiaIsAllowed) return;
    setForm((current) => ({ ...current, bia_id: "" }));
  }, [form.bia_id, membroId, open, selectedBiaIsAllowed]);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      opa
        ?apiRequest("PATCH", `/api/oportunidades/${opa.id}`, data)
        : apiRequest("POST", "/api/oportunidades", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades"] });
      toast({ title: opa ?"OPA atualizada" : "OPA criada" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!opa?.id) throw new Error("OPA não encontrada");
      return apiRequest("DELETE", `/api/oportunidades/${opa.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades"] });
      toast({ title: "OPA excluída" });
      setDeleteConfirmOpen(false);
      onClose();
      if (window.location.pathname.startsWith("/opas/")) {
        navigate("/area-aliancas?tab=opas");
      }
    },
    onError: (e: any) => {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    },
  });

  async function uploadFiles(files: File[]): Promise<string[]> {
    if (!files.length) return [];
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Falha no upload dos arquivos");
    const data = await res.json();
    return data.fileIds as string[];
  }

  async function uploadOpaImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Falha no upload da imagem");
      const data = await res.json();
      const id = data.fileIds?.[0];
      if (!id) throw new Error("Upload sem arquivo retornado");
      setImagemOpaId(id);
      setImagemOpaPreview(URL.createObjectURL(file));
    } catch (e: any) {
      toast({ title: "Erro ao enviar imagem", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.nome_oportunidade.trim()) {
      toast({ title: "Nome da OPA é obrigatório", variant: "destructive" });
      return;
    }
    if (!form.nucleo_alianca.trim()) {
      toast({ title: "Núcleo de Aliança é obrigatório", variant: "destructive" });
      return;
    }
    if (!form.tipo) {
      toast({ title: "Área de contribuição é obrigatória", variant: "destructive" });
      return;
    }
    if (!form.bia_id) {
      toast({ title: "BIA Vinculada é obrigatória", variant: "destructive" });
      return;
    }
    if (!selectedBiaIsAllowed) {
      toast({
        title: "BIA não permitida",
        description: "Você só pode vincular OPAs a BIAs em que está associado.",
        variant: "destructive",
      });
      return;
    }
    if (!form.valor_origem_opa || parseBRLToNumber(form.valor_origem_opa) <= 0) {
      toast({ title: "Valor da OPA é obrigatório", variant: "destructive" });
      return;
    }
    if (!form.Minimo_esforco_multiplicador || parseFloat(form.Minimo_esforco_multiplicador) <= 0) {
      toast({ title: "Mín. Esforço Multiplicador é obrigatório", variant: "destructive" });
      return;
    }
    try {
      setUploading(pendingFiles.length > 0);
      let newFileIds: string[] = [];
      if (pendingFiles.length > 0) {
        newFileIds = await uploadFiles(pendingFiles);
        setUploading(false);
      }
      const allAnexoIds = [
        ...existingAnexos.map(a => a.id),
        ...newFileIds,
      ];
      saveMutation.mutate({
        nome_oportunidade: form.nome_oportunidade,
        tipo: form.tipo || null,
        ramo_atuacao: form.ramo_atuacao || null,
        status: form.status || "ativa",
        bia: form.bia_id || null,
        valor_origem_opa: parseBRLToNumber(form.valor_origem_opa) || null,
        Minimo_esforco_multiplicador: form.Minimo_esforco_multiplicador ?parseFloat(form.Minimo_esforco_multiplicador) : null,
        nucleo_alianca: form.nucleo_alianca || null,
        descricao: form.descricao || null,
        perfil_aliado: form.perfil_aliado || null,
        imagem_directus_id: imagemOpaId || null,
        localizacao: form.localizacao || null,
        latitude: formLat,
        longitude: formLng,
        Anexos: allAnexoIds,
      });
    } catch (e: any) {
      setUploading(false);
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{opa ?"Editar OPA" : "Nova OPA"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 1. Título */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Título da OPA *</Label>
            <Input
              value={form.nome_oportunidade}
              onChange={e => setForm(f => ({ ...f, nome_oportunidade: e.target.value }))}
              placeholder="Insira um título"
              className="h-8 text-sm"
              data-testid="input-opa-nome"
            />
          </div>

          {/* Imagem de capa */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Imagem de capa da OPA</Label>
            <div className="rounded-xl border border-border bg-muted/20 p-2">
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                  {imagemOpaPreview ? (
                    <img src={imagemOpaPreview} alt="Imagem da OPA" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-medium text-foreground">Card da OPA</p>
                  <p className="text-[11px] text-muted-foreground">Use uma imagem horizontal para aparecer nos destaques da Vitrine.</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploading}
                      data-testid="btn-upload-opa-imagem"
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {imagemOpaPreview ? "Trocar imagem" : "Escolher imagem"}
                    </Button>
                    {imagemOpaPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setImagemOpaId(null);
                          setImagemOpaPreview(null);
                        }}
                        disabled={uploading}
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
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadOpaImage(file);
                  e.target.value = "";
                }}
                data-testid="input-opa-imagem"
              />
            </div>
          </div>

          {/* 2. BIA */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">BIA Vinculada *</Label>
            <Select
              value={form.bia_id || undefined}
              onValueChange={v => setForm(f => ({ ...f, bia_id: v }))}
            >
              <SelectTrigger
                className={`h-8 text-sm ${!form.bia_id ?"text-muted-foreground border-destructive/40" : ""}`}
                data-testid="select-opa-bia"
              >
                <SelectValue placeholder="Selecione a BIA..." />
              </SelectTrigger>
              <SelectContent>
                {associatedBias.length > 0 ? (
                  associatedBias.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhuma BIA associada disponível.
                  </div>
                )}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => { onClose(); navigate("/area-aliancas?tab=bias&criar=true"); }}
              className="mt-1 flex items-center gap-1 text-[11px] text-blue-600/70 transition-colors hover:text-blue-700"
              data-testid="btn-criar-bia-from-opa"
            >
              <ExternalLink className="w-3 h-3" />
              Criar nova BIA
            </button>
          </div>

          {/* 3. Núcleo de Aliança */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Núcleo de Aliança *</Label>
            <Select
              value={form.nucleo_alianca || undefined}
              onValueChange={v => setForm(f => ({ ...f, nucleo_alianca: v }))}
            >
              <SelectTrigger
                className={`h-8 text-sm ${!form.nucleo_alianca ?"text-muted-foreground border-destructive/40" : ""}`}
                data-testid="select-opa-nucleo"
              >
                <SelectValue placeholder="Selecionar núcleo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Núcleo técnico">Núcleo técnico</SelectItem>
                <SelectItem value="Núcleo de Obra">Núcleo de Obra</SelectItem>
                <SelectItem value="Núcleo Comercial">Núcleo Comercial</SelectItem>
                <SelectItem value="Núcleo de Capital">Núcleo de Capital</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. Área de contribuição */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Área de contribuição *</Label>
            <Select
              value={form.tipo || undefined}
              onValueChange={v => setForm(f => ({ ...f, tipo: v }))}
            >
              <SelectTrigger
                className={`h-8 text-sm ${!form.tipo ?"text-muted-foreground border-destructive/40" : ""}`}
                data-testid="select-opa-tipo"
              >
                <SelectValue placeholder="Selecionar área de contribuição..." />
              </SelectTrigger>
              <SelectContent>
                {areasContribuicao.map(area => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 5. Ramo de Atuação */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ramo de Atuação</Label>
            <Select
              value={form.ramo_atuacao || "__none__"}
              onValueChange={v => setForm(f => ({ ...f, ramo_atuacao: v === "__none__" ? "" : v }))}
            >
              <SelectTrigger className="h-8 text-sm" data-testid="select-opa-ramo-atuacao">
                <SelectValue placeholder="Selecionar ramo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum —</SelectItem>
                {RAMOS_SEGMENTOS.map(ramo => (
                  <SelectItem key={ramo.codigo} value={ramo.nome}>{ramo.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 6. Status */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status da OPA *</Label>
            <Select
              value={form.status || "ativa"}
              onValueChange={v => setForm(f => ({ ...f, status: v as OpaStatus }))}
            >
              <SelectTrigger className="h-8 text-sm" data-testid="select-opa-status">
                <SelectValue placeholder="Selecionar status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="pausada">Pausada</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 7. Localização */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Localização (para mapa)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 border-blue-300 px-3 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => setLocationPickerOpen(true)}
                data-testid="btn-opa-location-picker"
              >
                <MapPin className="w-3.5 h-3.5 mr-1" />
                Localizar...
              </Button>
              {formLat !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => { setFormLat(null); setFormLng(null); setForm(f => ({ ...f, localizacao: "" })); }}
                  title="Remover localização"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            {formLat !== null && (
              <p className="text-[10px] text-muted-foreground">
                {form.localizacao || "Localização selecionada"} · <span className="font-mono text-blue-600/70">{formLat.toFixed(4)}, {formLng?.toFixed(4)}</span>
              </p>
            )}
          </div>

          {/* 7. Valor + Mín Esforço Multiplicador */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor da OPA (R$) *</Label>
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
              <Label className="text-xs text-muted-foreground">Mín. Esforço Multiplicador *</Label>
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

          {/* 8. Perfil do Aliado */}
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

          {/* 9. Descrição / Escopo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição / Escopo</Label>
            <Textarea
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descrição detalhada..."
              className="text-sm min-h-[70px] resize-none"
              data-testid="textarea-opa-descricao"
            />
          </div>

          {/* 10. Anexos */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Paperclip className="w-3 h-3" /> Anexos
              {(existingAnexos.length + pendingFiles.length) > 0 && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">
                  {existingAnexos.length + pendingFiles.length}
                </span>
              )}
            </Label>

            {/* Existing files */}
            {existingAnexos.length > 0 && (
              <div className="space-y-1">
                {existingAnexos.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border/40 group">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-xs truncate" title={anexoDisplayName(a)}>{anexoDisplayName(a)}</span>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[10px] text-blue-600/70 hover:text-blue-700">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setExistingAnexos(existingAnexos.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                      data-testid={`btn-remove-existing-anexo-${i}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending files */}
            {pendingFiles.length > 0 && (
              <div className="space-y-1">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50/60 px-2.5 py-1.5">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-blue-600/70" />
                    <span className="flex-1 truncate text-xs text-blue-800">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={() => setPendingFiles(pendingFiles.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                      data-testid={`btn-remove-pending-anexo-${i}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border/40 py-2 text-xs text-muted-foreground transition-colors hover:border-blue-300 hover:text-blue-600"
              disabled={uploading}
              data-testid="btn-upload-opa-anexo"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ?"Enviando..." : "Adicionar arquivos"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                setPendingFiles(prev => [...prev, ...files]);
                e.target.value = "";
              }}
              data-testid="input-opa-file"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {opa ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saveMutation.isPending || deleteMutation.isPending || uploading}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              data-testid="btn-delete-opa"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir OPA
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending || deleteMutation.isPending || uploading}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || deleteMutation.isPending || uploading}
              className="bg-blue-600 text-white hover:bg-blue-700"
              data-testid="btn-save-opa"
            >
              {uploading ?"Enviando arquivos..." : saveMutation.isPending ?"Salvando..." : opa ?"Salvar" : "Criar OPA"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <LocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={(localizacao, lat, lng) => {
          setForm(f => ({ ...f, localizacao }));
          setFormLat(lat);
          setFormLng(lng);
        }}
      />
    </Dialog>
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir OPA?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação remove a OPA {opa?.nome_oportunidade ? `"${opa.nome_oportunidade}"` : "selecionada"} da lista. Essa operação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="bg-red-600 text-white hover:bg-red-700"
            data-testid="btn-confirm-delete-opa"
          >
            {deleteMutation.isPending ? "Excluindo..." : "Excluir OPA"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ---- Main Page ----
export default function OportunidadesPage() {
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const [search, setSearch] = useState("");
  const [filterBia, setFilterBia] = useState<string>("__all__");
  const [filterNucleo, setFilterNucleo] = useState<string>("__all__");
  const [filterTipo, setFilterTipo] = useState<string>("__all__");
  const [createDialog, setCreateDialog] = useState(false);

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

  const nucleoOptions = useMemo(() =>
    Array.from(new Set(opas.map(o => o.nucleo_alianca).filter(Boolean))) as string[],
  [opas]);

  const tipoOptions = useMemo(() =>
    Array.from(new Set(opas.map(o => o.tipo).filter(Boolean).map((tipo) => getTipoDisplayName(String(tipo))))) as string[],
  [opas]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return opas.filter(o => {
      const haystack = `${o.nome_oportunidade || ""} ${o.objetivo_alianca || ""} ${o.nucleo_alianca || ""} ${o.pais || ""} ${o.tipo || ""} ${o.ramo_atuacao || ""}`
        .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const matchSearch = !q || haystack.includes(q);
      const matchBia = filterBia === "__all__" || o.bia_id === filterBia;
      const matchNucleo = filterNucleo === "__all__" || o.nucleo_alianca === filterNucleo;
      const matchTipo = filterTipo === "__all__" || getTipoDisplayName(String(o.tipo || "")) === filterTipo;
      return matchSearch && matchBia && matchNucleo && matchTipo;
    });
  }, [opas, search, filterBia, filterNucleo, filterTipo]);

  const loading = loadingOpas || loadingBias;

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get("criar") === "true") {
      setCreateDialog(true);
      params.delete("criar");
      const suffix = params.toString();
      navigate(`/area-aliancas${suffix ?`?${suffix}` : "?tab=opas"}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-cyan-500" />
            OPAs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ofertas Públicas de Aliança
          </p>
        </div>
        <Button
          onClick={() => setCreateDialog(true)}
          className="gap-2 bg-blue-500 text-white hover:bg-blue-600"
          data-testid="button-new-opa"
        >
          <Plus className="w-4 h-4" />
          Nova OPA
        </Button>
      </div>

      {/* Futuristic header */}
      {!loading && <OpaWorldMap opas={opas} bias={bias} />}
      {loading && <Skeleton className="h-[440px] rounded-2xl" />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar OPA..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-opas"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={filterBia} onValueChange={setFilterBia}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-bia">
              <SelectValue placeholder="Todas as BIAs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as BIAs</SelectItem>
              {bias.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterNucleo} onValueChange={setFilterNucleo}>
            <SelectTrigger className="w-full min-w-[210px] sm:w-[220px] [&>span]:overflow-visible [&>span]:text-clip [&>span]:whitespace-nowrap" data-testid="select-filter-nucleo">
              <SelectValue placeholder="Todos os Núcleos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os Núcleos</SelectItem>
              {nucleoOptions.map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[160px]" data-testid="select-filter-tipo">
              <SelectValue placeholder="Todas as áreas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as áreas</SelectItem>
              {tipoOptions.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterBia !== "__all__" || filterNucleo !== "__all__" || filterTipo !== "__all__" || search) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => { setFilterBia("__all__"); setFilterNucleo("__all__"); setFilterTipo("__all__"); setSearch(""); }}
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
      {loading ?(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-60" />)}
        </div>
      ) : filtered.length === 0 ?(
        <Card>
          <CardContent className="p-12 text-center">
            {search || filterBia !== "__all__" ?(
              <>
                <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma OPA encontrada com esses filtros</p>
                <Button variant="ghost" onClick={() => { setSearch(""); setFilterBia("__all__"); setFilterNucleo("__all__"); setFilterTipo("__all__"); }} className="mt-2 text-blue-600 hover:text-blue-700">
                  Limpar filtros
                </Button>
              </>
            ) : (
              <>
                <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhuma OPA cadastrada</h3>
                <p className="text-sm text-muted-foreground/70 mb-4">Crie oportunidades pela Gestão OPAs</p>
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
              bia={opa.bia_id ?biasMap[opa.bia_id] : undefined}
              onViewDetail={() => navigate(`/opas/${opa.id}`)}
            />
          ))}
        </div>
      )}

      <OpaFormDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        opa={null}
        bias={bias}
      />
    </div>
  );
}

