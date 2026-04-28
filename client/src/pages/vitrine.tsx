import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Store, Search, MapPin, Building2,
  Users, X, Plus, Pencil, Trash2, Loader2,
  FileText, Mail, MessageSquare, Globe, Phone, Navigation,
  Megaphone, CalendarDays, ExternalLink, ImageIcon, Tag, CheckCircle2, XCircle, Upload,
  ShieldCheck, Check,
} from "lucide-react";
import { AuraBadge } from "@/components/aura-score";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from "react-simple-maps";
import { getAllTipos, getNucleoForTipo, getTipoDisplayName, RAMOS_SEGMENTOS, getSegmentosForRamo } from "@/lib/ramos-segmentos";

const WORLD_GEO = "/world-countries-50m.json";

const NUCLEOS = [
  "Diretoria da Aliança",
  "Núcleo Técnico",
  "Núcleo de Obra",
  "Núcleo Comercial",
  "Núcleo de Capital",
];

interface MembroVitrine {
  id: string;
  nome?: string;
  cargo?: string;
  especialidade?: string;
  empresa?: string;
  cidade?: string;
  estado?: string;
  whatsapp?: string;
  email?: string;
  foto?: string | null;
  foto_perfil?: string | null;
  perfil_aliado?: string;
  nucleo_alianca?: string;
  na_vitrine?: boolean;
  link_site?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  Outras_redes_as_quais_pertenco?: string[] | null;
}

// ===== WORLD MAP COMPONENT =====
function WorldMapHeader({ membros }: { membros: MembroVitrine[] }) {
  const [, navigate] = useLocation();
  const [hoveredMembro, setHoveredMembro] = useState<MembroVitrine | null>(null);
  const [selectedMembro, setSelectedMembro] = useState<MembroVitrine | null>(null);
  const [clusterItems, setClusterItems] = useState<MembroVitrine[] | null>(null);
  const [zoom, setZoom] = useState(1.2);
  const [center, setCenter] = useState<[number, number]>([10, 20]);

  const withCoords = useMemo(
    () => membros.filter(m => m.latitude != null && m.longitude != null),
    [membros]
  );

  const clusters = useMemo(() => {
    const THRESHOLD = 1.5;
    const result: { center: [number, number]; items: MembroVitrine[] }[] = [];
    for (const m of withCoords) {
      const lng = m.longitude!;
      const lat = m.latitude!;
      const existing = result.find(
        c => Math.abs(c.center[0] - lng) < THRESHOLD && Math.abs(c.center[1] - lat) < THRESHOLD
      );
      if (existing) existing.items.push(m);
      else result.push({ center: [lng, lat], items: [m] });
    }
    return result;
  }, [withCoords]);

  function fotoUrlMap(m: MembroVitrine): string | null {
    const f = m.foto || m.foto_perfil;
    if (!f) return null;
    return `/api/assets/${f}?width=80&height=80&fit=cover`;
  }

  function getInitialsMap(nome?: string): string {
    if (!nome) return "?";
    return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
  }

  const especialidades = useMemo(() => {
    const s = new Set(membros.map(m => m.especialidade).filter(Boolean));
    return s.size;
  }, [membros]);

  const territoriosCount = useMemo(() => {
    const s = new Set(membros.map(m => m.cidade).filter(Boolean));
    return s.size;
  }, [membros]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-brand-gold/20"
      style={{ height: 440, background: "radial-gradient(ellipse at 50% 110%, #001428 0%, #000c1f 55%, #000408 100%)" }}
    >
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(215,187,125,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.05) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-brand-gold/40 rounded-tl-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-brand-gold/40 rounded-tr-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-brand-gold/40 rounded-bl-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-brand-gold/40 rounded-br-2xl pointer-events-none" />

      {/* Top-left header */}
      <div className="absolute top-5 left-6 z-20">
        <p className="text-[10px] text-brand-gold/50 tracking-[0.35em] uppercase font-mono">// BUILT Alliances</p>
        <h2 className="text-xl font-bold tracking-[0.12em] font-mono mt-0.5" style={{ color: "#D7BB7D" }}>
          MAPA DA REDE
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
        <div className="mb-2">
          <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">Usuários</p>
          <p className="text-4xl font-bold leading-none" style={{ color: "#D7BB7D" }}>{membros.length}</p>
        </div>
        <div className="mb-1">
          <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">Especialidades</p>
          <p className="text-xs font-semibold" style={{ color: "#D7BB7D99" }}>{especialidades}</p>
        </div>
        <p className="text-[9px] text-brand-gold/30">{territoriosCount} territórios · {withCoords.length} geolocalizados</p>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1">
        {[
          { label: "+", action: () => setZoom(z => Math.min(z * 1.5, 20)), title: "Ampliar" },
          { label: "⊙", action: () => { setZoom(1.2); setCenter([10, 20]); }, title: "Resetar" },
          { label: "−", action: () => setZoom(z => Math.max(z / 1.5, 1)), title: "Reduzir" },
        ].map(({ label, action, title }) => (
          <button
            key={label}
            onClick={action}
            title={title}
            className="w-7 h-7 flex items-center justify-center rounded border font-mono text-sm font-bold transition-colors"
            style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(215,187,125,0.3)", color: "#D7BB7D" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(215,187,125,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          >{label}</button>
        ))}
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
          maxZoom={20}
          onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates); setZoom(z); }}
        >
          <Geographies geography={WORLD_GEO}>
            {({ geographies }) => geographies.map(geo => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: { fill: "#011630", stroke: "#D7BB7D28", strokeWidth: 0.3, outline: "none" },
                  hover:   { fill: "#011630", stroke: "#D7BB7D28", strokeWidth: 0.3, outline: "none" },
                  pressed: { fill: "#011630", outline: "none" },
                }}
              />
            ))}
          </Geographies>

          {clusters.map((cluster, idx) => {
            const [lng, lat] = cluster.center;
            const isMulti = cluster.items.length > 1;
            const isHovered = hoveredMembro && cluster.items.includes(hoveredMembro);
            const isSelected = !isMulti && selectedMembro?.id === cluster.items[0]?.id;
            const isClusterSelected = isMulti && clusterItems === cluster.items;
            const r = Math.max(2, 5 / zoom);
            return (
              <Marker
                key={idx}
                coordinates={[lng, lat]}
                onMouseEnter={() => { if (!isMulti) setHoveredMembro(cluster.items[0]); }}
                onMouseLeave={() => setHoveredMembro(null)}
                onClick={() => {
                  setHoveredMembro(null);
                  if (isMulti) {
                    setSelectedMembro(null);
                    setClusterItems(cluster.items);
                  } else {
                    setClusterItems(null);
                    setSelectedMembro(cluster.items[0]);
                  }
                }}
              >
                <g style={{ cursor: "pointer" }}>
                  <circle r={r * (isSelected || isClusterSelected ? 5.5 : isHovered ? 4.5 : 3.5)} fill="#D7BB7D" fillOpacity={isSelected || isClusterSelected ? 0.12 : 0.06}>
                    <animate attributeName="r" from={r * 2.5} to={r * 5} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.4" to="0" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                  <circle r={r * (isSelected || isClusterSelected ? 3 : isHovered ? 2.5 : 2)} fill="#D7BB7D" fillOpacity={isSelected || isClusterSelected ? 0.4 : isHovered ? 0.3 : 0.18} />
                  <circle r={r * (isSelected || isClusterSelected ? 1.6 : isHovered ? 1.3 : 1)} fill="#D7BB7D" fillOpacity={0.95} />
                  <circle r={r * 0.7} fill="white" fillOpacity={0.95} />
                  {isMulti && (
                    <>
                      <circle cx={r * 1.6} cy={r * -1.6} r={r * 1.2}
                        fill={isClusterSelected ? "#D7BB7D" : "#001D34"}
                        stroke="#D7BB7D" strokeWidth={0.5} />
                      <text x={r * 1.6} y={r * -1.6} textAnchor="middle" dominantBaseline="central"
                        fontSize={r * 1.0} fontWeight="bold" fontFamily="monospace"
                        fill={isClusterSelected ? "#001D34" : "#D7BB7D"}>
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

      {/* Hover tooltip */}
      {!selectedMembro && !clusterItems && hoveredMembro && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,8,18,0.92) 0%, transparent 100%)", padding: "28px 24px 14px" }}>
          <div className="flex items-end justify-between font-mono">
            <div>
              <p className="text-[9px] text-brand-gold/40 tracking-[0.3em] uppercase">Clique para ver perfil</p>
              <p className="text-sm font-bold text-brand-gold mt-0.5">{hoveredMembro.nome || "—"}</p>
              {hoveredMembro.especialidade && (
                <p className="text-[11px] text-brand-gold/55 mt-0.5">{hoveredMembro.especialidade}</p>
              )}
            </div>
            {hoveredMembro.empresa && (
              <div className="text-right">
                <p className="text-[9px] text-brand-gold/40 uppercase tracking-wider">Empresa</p>
                <p className="text-xs text-brand-gold/70">{hoveredMembro.empresa}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cluster picker */}
      {clusterItems && !selectedMembro && (
        <div className="absolute bottom-0 left-0 right-0 z-30 transition-all duration-300"
          style={{ background: "linear-gradient(to top, rgba(0,8,20,0.98) 0%, rgba(0,12,28,0.96) 70%, transparent 100%)", padding: "32px 24px 18px" }}>
          <button onClick={() => setClusterItems(null)}
            className="absolute top-3 right-4 text-brand-gold/40 hover:text-brand-gold/80 transition-colors font-mono text-xs tracking-widest">
            ✕ FECHAR
          </button>
          <div className="font-mono">
            <p className="text-[9px] text-brand-gold/40 tracking-[0.35em] uppercase mb-1">// {clusterItems.length} Membros neste Local</p>
            <div className="h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent mb-3" />
            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {clusterItems.map(m => (
                <button key={m.id} onClick={() => { setSelectedMembro(m); setClusterItems(null); }}
                  className="flex items-center justify-between gap-3 text-left px-3 py-2 rounded transition-colors"
                  style={{ background: "rgba(215,187,125,0.06)", border: "1px solid rgba(215,187,125,0.15)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(215,187,125,0.14)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(215,187,125,0.06)")}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-brand-gold truncate">{m.nome || "—"}</p>
                    {m.empresa && <p className="text-[10px] text-brand-gold/40 truncate">{m.empresa}</p>}
                  </div>
                  {m.especialidade && (
                    <p className="text-[10px] text-brand-gold/80 shrink-0 truncate max-w-[140px] font-mono">
                      {m.especialidade}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Decorative scan line */}
      <div className="absolute left-0 right-0 h-px pointer-events-none z-10"
        style={{ background: "linear-gradient(to right, transparent, #D7BB7D40 20%, #D7BB7D60 50%, #D7BB7D40 80%, transparent)", animation: "scanLineVitrine 6s linear infinite", top: 0 }}
      />
      <style dangerouslySetInnerHTML={{ __html: `@keyframes scanLineVitrine { 0% { top: 0%; opacity: 0; } 5% { opacity: 1; } 95% { opacity: 1; } 100% { top: 100%; opacity: 0; } }` }} />

      {/* Selected member info panel */}
      {selectedMembro && (
        <div className="absolute bottom-0 left-0 right-0 z-30 transition-all duration-300"
          style={{ background: "linear-gradient(to top, rgba(0,8,20,0.98) 0%, rgba(0,12,28,0.96) 70%, transparent 100%)", padding: "32px 24px 18px" }}>
          <div className="absolute top-3 right-4 flex items-center gap-3">
            <button onClick={() => navigate(`/vitrine/${selectedMembro.id}`)}
              className="text-brand-gold/70 hover:text-brand-gold transition-colors font-mono text-xs tracking-widest border border-brand-gold/20 hover:border-brand-gold/50 px-2 py-0.5 rounded">
              VER PERFIL →
            </button>
            <button onClick={() => setSelectedMembro(null)}
              className="text-brand-gold/40 hover:text-brand-gold/80 transition-colors font-mono text-xs tracking-widest">
              ✕
            </button>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-brand-gold/30 shrink-0 flex items-center justify-center"
              style={{ background: "rgba(215,187,125,0.08)" }}>
              {fotoUrlMap(selectedMembro) ? (
                <img src={fotoUrlMap(selectedMembro)!} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-brand-gold/70">{getInitialsMap(selectedMembro.nome)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] text-brand-gold/40 tracking-[0.3em] uppercase">Membro BUILT</p>
              <p className="text-sm font-bold text-brand-gold mt-0.5 truncate">{selectedMembro.nome || "—"}</p>
              {selectedMembro.especialidade && (
                <p className="text-[11px] text-brand-gold/55 truncate">{selectedMembro.especialidade}</p>
              )}
              {(selectedMembro.cidade || selectedMembro.estado) && (
                <p className="text-[10px] text-brand-gold/35 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {[selectedMembro.cidade, selectedMembro.estado].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CardForm {
  nome: string;
  cargo: string;
  empresa: string;
  ramo_atuacao: string;
  segmento: string;
  cidade: string;
  estado: string;
  latitude: string;
  longitude: string;
  whatsapp: string;
  email: string;
  perfil_aliado: string;
  nucleo_alianca: string;
  tipo_alianca: string;
  link_site: string;
}

interface EspecialidadeOption {
  id: string;
  nome_especialidade: string;
  categoria?: string;
}

function fotoUrl(m: MembroVitrine): string | null {
  const f = m.foto || m.foto_perfil;
  if (!f) return null;
  return `/api/assets/${f}?width=200&height=200&fit=cover`;
}

function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const ESTADOS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string; town?: string; municipality?: string; village?: string;
    state?: string; country?: string; country_code?: string;
  };
}

function LocationPickerModal({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (cidade: string, estado: string, lat: number, lng: number) => void;
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
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=8&addressdetails=1&accept-language=pt-BR,pt`;
      const res = await fetch(url, { headers: { "Accept-Language": "pt-BR,pt;q=0.9" } });
      if (!res.ok) throw new Error();
      const data: NominatimResult[] = await res.json();
      if (data.length === 0) setError("Nenhum resultado encontrado. Tente um nome mais específico.");
      setResults(data);
    } catch { setError("Falha ao buscar localização. Verifique sua conexão."); }
    finally { setLoading(false); }
  }

  function handleConfirm() {
    if (!selected) return;
    const addr = selected.address || {};
    const cidade = addr.city || addr.town || addr.municipality || addr.village || selected.display_name.split(",")[0];
    const estado = addr.state || "";
    onSelect(cidade, estado, parseFloat(selected.lat), parseFloat(selected.lon));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-brand-gold" />
            Selecionar Localização
          </DialogTitle>
          <DialogDescription>
            Pesquise uma cidade ou endereço para obter a localização com coordenadas GPS.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <input
            autoFocus
            placeholder="Ex: São Paulo, SP — Copacabana, RJ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            data-testid="input-location-search"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !search.trim()}
            className="px-3 py-2 rounded-md bg-brand-gold text-brand-navy hover:bg-brand-gold/90 disabled:opacity-50 shrink-0"
            data-testid="btn-search-location"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-sm text-muted-foreground text-center py-2">{error}</p>}
        {results.length > 0 && (
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {results.map(r => (
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
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm border border-input hover:bg-muted">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="px-4 py-2 rounded-md text-sm bg-brand-gold text-brand-navy hover:bg-brand-gold/90 disabled:opacity-50 flex items-center gap-2"
            data-testid="btn-confirm-location"
          >
            <MapPin className="w-3.5 h-3.5" />
            Confirmar localização
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== ANÚNCIOS INTERFACES =====
interface AnuncioVitrine {
  id: string;
  membro_id: string;
  titulo: string;
  descricao?: string | null;
  link?: string | null;
  imagem_url?: string | null;
  imagem_directus_id?: string | null;
  membro_nome?: string | null;
  membro_empresa?: string | null;
  membro_foto?: string | null;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
}

interface PeriodoDisponivel {
  inicio: string;
  fim: string;
  count: number;
  vagas: number;
}

// ===== PERIODO PICKER GRID =====
function PeriodoPickerGrid({
  periodos,
  selected,
  onSelect,
  reservados = [],
}: {
  periodos: PeriodoDisponivel[];
  selected: { inicio: string; fim: string } | null;
  onSelect: (p: { inicio: string; fim: string }) => void;
  reservados?: string[];
}) {
  const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const today = new Date().toISOString().slice(0, 10);

  function mesLabel(inicio: string) {
    const [, m] = inicio.split("-");
    return MESES_PT[parseInt(m) - 1];
  }
  function quinzenaLabel(inicio: string, fim: string) {
    const d = parseInt(inicio.split("-")[2]);
    const df = parseInt(fim.split("-")[2]);
    return `${d}–${df}`;
  }

  const grouped: Record<string, PeriodoDisponivel[]> = {};
  for (const p of periodos) {
    const key = p.inicio.slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40 font-mono">Selecione um período disponível:</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(grouped).map(([mesKey, qs]) => (
          <div key={mesKey} className="space-y-1.5">
            <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-wider">
              {mesLabel(qs[0].inicio)} {mesKey.slice(0, 4)}
            </p>
            {qs.map(q => {
              const isPast = q.fim < today;
              const isFull = q.vagas === 0;
              const isReservado = reservados.includes(q.inicio);
              const isDisabled = isPast || isFull || isReservado;
              const isSelected = selected?.inicio === q.inicio;
              return (
                <button
                  key={q.inicio}
                  disabled={isDisabled}
                  onClick={() => onSelect({ inicio: q.inicio, fim: q.fim })}
                  data-testid={`btn-periodo-${q.inicio}`}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
                    isSelected
                      ? "border-brand-gold bg-brand-gold/10 text-brand-gold"
                      : isReservado
                      ? "border-brand-gold/30 bg-brand-gold/5 text-brand-gold/40 cursor-not-allowed"
                      : isFull
                      ? "border-red-500/20 bg-red-500/5 text-red-400/50 cursor-not-allowed"
                      : isPast
                      ? "border-white/5 bg-white/3 text-white/20 cursor-not-allowed"
                      : "border-white/10 hover:border-brand-gold/30 hover:bg-brand-gold/5 text-white/70 cursor-pointer"
                  }`}
                >
                  <span className="block">{quinzenaLabel(q.inicio, q.fim)}</span>
                  <span className={`text-[10px] ${isReservado ? "text-brand-gold/40" : isFull ? "text-red-400/50" : "text-white/30"}`}>
                    {isReservado ? "Já reservado" : isFull ? "Lotado" : `${q.vagas}/6 vagas`}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== ANUNCIO CARD =====
function AnuncioCard({
  anuncio,
  isOwn,
  onEdit,
  onCancel,
}: {
  anuncio: AnuncioVitrine;
  isOwn: boolean;
  onEdit: (a: AnuncioVitrine) => void;
  onCancel: () => void;
}) {
  const href = anuncio.link
    ? (anuncio.link.startsWith("http") ? anuncio.link : `https://${anuncio.link}`)
    : undefined;

  const handleClick = () => {
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-xl overflow-hidden"
      style={{
        border: isOwn ? "1px solid rgba(215,187,125,0.35)" : "1px solid rgba(215,187,125,0.15)",
        boxShadow: isOwn ? "0 0 16px rgba(215,187,125,0.08)" : "0 2px 8px rgba(0,0,0,0.4)",
        aspectRatio: "2/1",
        cursor: href ? "pointer" : "default",
        background: "rgba(0,29,52,0.9)",
      }}
      data-testid={`card-anuncio-${anuncio.id}`}
    >
      {/* Full image */}
      {anuncio.imagem_url ? (
        <img
          src={anuncio.imagem_url}
          alt={anuncio.titulo}
          className="w-full h-full object-cover"
          style={{ display: "block" }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Megaphone className="w-10 h-10 text-brand-gold/20" />
        </div>
      )}

      {/* ANÚNCIO badge overlay — only on hover */}
      <div
        className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full transition-opacity duration-200"
        style={{
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(215,187,125,0.3)",
          backdropFilter: "blur(4px)",
          opacity: hovered ? 1 : 0,
        }}
      >
        <Megaphone className="w-2.5 h-2.5 text-brand-gold/80" />
        <span className="text-[9px] font-mono text-brand-gold/80 uppercase tracking-wider">Anúncio</span>
      </div>

      {/* Owner action buttons overlay — only on hover */}
      {isOwn && (
        <div
          className="absolute top-2 right-2 flex gap-1 transition-opacity duration-200"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          <button
            onClick={e => { e.stopPropagation(); onEdit(anuncio); }}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors"
            style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(215,187,125,0.3)", backdropFilter: "blur(4px)" }}
            data-testid={`btn-edit-anuncio-${anuncio.id}`}
          >
            <Pencil className="w-3 h-3 text-brand-gold/80" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onCancel(); }}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-red-500/40"
            style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
            data-testid={`btn-cancel-anuncio-${anuncio.id}`}
          >
            <XCircle className="w-3 h-3 text-white/60" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function VitrinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterEspecialidade, setFilterEspecialidade] = useState("all");
  const [filterTerritorio, setFilterTerritorio] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [form, setForm] = useState<CardForm>({
    nome: "", cargo: "", empresa: "", ramo_atuacao: "", segmento: "",
    cidade: "", estado: "", latitude: "", longitude: "",
    whatsapp: "", email: "",
    perfil_aliado: "", nucleo_alianca: "", tipo_alianca: "", link_site: ""
  });

  // Anúncios state
  const [anuncioDialogOpen, setAnuncioDialogOpen] = useState(false);
  const [anuncioEditMode, setAnuncioEditMode] = useState(false);
  const [anuncioForm, setAnuncioForm] = useState({ titulo: "", descricao: "", link: "" });
  const [anuncioPeriodo, setAnuncioPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const [anuncioImagemId, setAnuncioImagemId] = useState<string | null>(null);
  const [anuncioImagemPreview, setAnuncioImagemPreview] = useState<string | null>(null);
  const [anuncioUploadLoading, setAnuncioUploadLoading] = useState(false);
  const [anuncioTerms, setAnuncioTerms] = useState({ t1: false, t2: false, t3: false });
  const anuncioTermsAllAccepted = anuncioTerms.t1 && anuncioTerms.t2 && anuncioTerms.t3;
  const [anuncioEditTarget, setAnuncioEditTarget] = useState<AnuncioVitrine | null>(null);

  const membroId = user?.membro_directus_id;

  // Fetch all vitrine members
  const { data: membros = [], isLoading } = useQuery<MembroVitrine[]>({
    queryKey: ["/api/vitrine"],
    queryFn: async () => {
      const r = await fetch("/api/vitrine");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch current user's membro data to pre-fill form and check card status
  const { data: myMembro } = useQuery<MembroVitrine & { [key: string]: any }>({
    queryKey: ["/api/membros", membroId],
    queryFn: () => fetch(`/api/membros/${membroId}`).then(r => r.json()),
    enabled: !!membroId,
  });

  const myCardExists = !!myMembro?.na_vitrine;

  // Anúncios queries
  const { data: anunciosAtivos = [], refetch: refetchAnuncios } = useQuery<AnuncioVitrine[]>({
    queryKey: ["/api/anuncios"],
    queryFn: async () => {
      const r = await fetch("/api/anuncios");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: meusAnuncios = [], refetch: refetchMeuAnuncio } = useQuery<AnuncioVitrine[]>({
    queryKey: ["/api/anuncios/mine"],
    queryFn: async () => {
      if (!user) return [];
      const r = await fetch("/api/anuncios/mine");
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });
  // períodos já reservados pelo membro (para bloquear no picker)
  const periodosReservados = meusAnuncios.map(a => a.data_inicio);

  const { data: disponibilidade = [] } = useQuery<PeriodoDisponivel[]>({
    queryKey: ["/api/anuncios/disponibilidade"],
    queryFn: async () => {
      const r = await fetch("/api/anuncios/disponibilidade?meses=3");
      if (!r.ok) return [];
      return r.json();
    },
    enabled: anuncioDialogOpen,
  });

  // Anúncio mutations
  const criarAnuncioMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/anuncios", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine"] });
      setAnuncioDialogOpen(false);
      toast({ title: "Anúncio criado com sucesso!" });
    },
    onError: (err: any) => toast({ title: err?.message || "Erro ao criar anúncio", variant: "destructive" }),
  });

  const editarAnuncioMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/anuncios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine"] });
      setAnuncioDialogOpen(false);
      toast({ title: "Anúncio atualizado!" });
    },
    onError: (err: any) => toast({ title: err?.message || "Erro ao atualizar anúncio", variant: "destructive" }),
  });

  const cancelarAnuncioMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/anuncios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine"] });
      toast({ title: "Anúncio cancelado." });
    },
    onError: () => toast({ title: "Erro ao cancelar anúncio", variant: "destructive" }),
  });

  function openAnuncioCreate() {
    setAnuncioEditMode(false);
    setAnuncioForm({ titulo: "", descricao: "", link: "" });
    setAnuncioPeriodo(null);
    setAnuncioImagemId(null);
    setAnuncioImagemPreview(null);
    setAnuncioTerms({ t1: false, t2: false, t3: false });
    setAnuncioDialogOpen(true);
  }

  function openAnuncioEdit(alvo: AnuncioVitrine) {
    setAnuncioEditMode(true);
    setAnuncioEditTarget(alvo);
    setAnuncioForm({
      titulo: alvo.titulo || "",
      descricao: alvo.descricao || "",
      link: alvo.link || "",
    });
    setAnuncioPeriodo({ inicio: alvo.data_inicio, fim: alvo.data_fim });
    setAnuncioImagemId(alvo.imagem_directus_id || null);
    setAnuncioImagemPreview(alvo.imagem_url || null);
    setAnuncioDialogOpen(true);
  }

  async function handleAnuncioImageUpload(file: File) {
    setAnuncioUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await r.json();
      if (json.fileIds?.[0]) {
        setAnuncioImagemId(json.fileIds[0]);
        setAnuncioImagemPreview(URL.createObjectURL(file));
      }
    } catch {
      toast({ title: "Erro ao fazer upload da imagem", variant: "destructive" });
    } finally {
      setAnuncioUploadLoading(false);
    }
  }

  function handleAnuncioSubmit() {
    if (anuncioEditMode && anuncioEditTarget) {
      editarAnuncioMutation.mutate({
        id: anuncioEditTarget.id,
        data: {
          titulo: anuncioForm.titulo,
          descricao: anuncioForm.descricao || null,
          link: anuncioForm.link || null,
          imagem_directus_id: anuncioImagemId || null,
        },
      });
    } else {
      if (!anuncioPeriodo) {
        toast({ title: "Selecione um período", variant: "destructive" });
        return;
      }
      criarAnuncioMutation.mutate({
        titulo: anuncioForm.titulo,
        descricao: anuncioForm.descricao || null,
        link: anuncioForm.link || null,
        imagem_directus_id: anuncioImagemId || null,
        data_inicio: anuncioPeriodo.inicio,
        data_fim: anuncioPeriodo.fim,
      });
    }
  }

  // Auto-open edit dialog when navigated from detail page with ?edit=true
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get("edit") === "true" && myMembro && !dialogOpen) {
      openDialog();
      navigate("/vitrine", { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, myMembro]);

  // Pre-fill form when dialog opens
  function openDialog() {
    if (myMembro) {
      setForm({
        nome: myMembro.nome || "",
        cargo: myMembro.cargo || myMembro.responsavel_cargo || "",
        empresa: myMembro.empresa || myMembro.nome_fantasia || "",
        ramo_atuacao: (myMembro as any).ramo_atuacao || "",
        segmento: (myMembro as any).segmento || "",
        cidade: myMembro.cidade || "",
        estado: myMembro.estado || "",
        latitude: myMembro.latitude != null ? String(myMembro.latitude) : "",
        longitude: myMembro.longitude != null ? String(myMembro.longitude) : "",
        whatsapp: myMembro.whatsapp || myMembro.whatsapp_e164 || "",
        email: myMembro.email || "",
        perfil_aliado: myMembro.perfil_aliado || "",
        nucleo_alianca: myMembro.nucleo_alianca || "",
        tipo_alianca: (myMembro as any).tipo_alianca || "",
        link_site: myMembro.link_site || "",
      });
    }
    setDialogOpen(true);
  }

  function handleLocationSelect(cidade: string, estado: string, lat: number, lng: number) {
    setForm(f => ({ ...f, cidade, estado, latitude: String(lat), longitude: String(lng) }));
  }

  // Save card mutation
  const saveMutation = useMutation({
    mutationFn: (data: Partial<CardForm> & { na_vitrine: boolean }) =>
      apiRequest("PATCH", `/api/membros/${membroId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      setDialogOpen(false);
      toast({ title: myCardExists ? "Card atualizado na Vitrine!" : "Card criado na Vitrine!" });
    },
    onError: (err: any) => {
      let msg = "Erro ao salvar card";
      try {
        const raw = err?.message || "";
        const jsonPart = raw.slice(raw.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        // Directus wraps the real message in errors[]
        const directusMsg = parsed?.error || parsed?.errors?.[0]?.message;
        if (directusMsg) {
          if (directusMsg.includes("invalid input syntax for type real")) {
            msg = "Erro: valor inválido no campo de localização. Selecione um local válido ou deixe em branco.";
          } else if (directusMsg.includes("NOT NULL")) {
            msg = "Erro: um campo obrigatório está vazio.";
          } else {
            msg = `Erro: ${directusMsg.slice(0, 120)}`;
          }
        }
      } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  // Remove card mutation
  const removeMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/membros/${membroId}`, { na_vitrine: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membros", membroId] });
      toast({ title: "Card removido da Vitrine." });
    },
    onError: () => toast({ title: "Erro ao remover card", variant: "destructive" }),
  });

  function handleSubmit() {
    const payload: Record<string, any> = { ...form, na_vitrine: true };
    saveMutation.mutate(payload as any);
  }

  const especialidades = useMemo(() => {
    const set = new Set<string>();
    membros.forEach(m => { if (m.especialidade) set.add(m.especialidade); });
    return Array.from(set).sort();
  }, [membros]);

  const territorios = useMemo(() => {
    const set = new Set<string>();
    membros.forEach(m => { if (m.cidade) set.add(m.cidade); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [membros]);

  const filtered = useMemo(() => {
    return membros.filter(m => {
      const nome = (m.nome || "").toLowerCase();
      const empresa = (m.empresa || "").toLowerCase();
      const esp = (m.especialidade || "").toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || nome.includes(q) || empresa.includes(q) || esp.includes(q);
      const matchEsp = filterEspecialidade === "all" || m.especialidade === filterEspecialidade;
      const matchTerritorio = filterTerritorio === "all" || (m.cidade || "") === filterTerritorio;
      return matchSearch && matchEsp && matchTerritorio;
    });
  }, [membros, search, filterEspecialidade, filterTerritorio]);

  const hasFilters = search || filterEspecialidade !== "all" || filterTerritorio !== "all";

  function clearFilters() {
    setSearch("");
    setFilterEspecialidade("all");
    setFilterTerritorio("all");
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header — BIA style */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-vitrine-title">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
              <Store className="w-6 h-6" />
            </div>
            BUILT Vitrine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Encontre fornecedores, prestadores e empresas da rede BUILT
            {hasFilters && ` · ${filtered.length} exibindo`}
          </p>
        </div>

        {membroId && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Card buttons */}
            {myCardExists ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openDialog}
                  className="gap-2 border-brand-gold/20 text-brand-gold/70 hover:bg-brand-gold/10 hover:text-brand-gold font-mono text-xs"
                  data-testid="btn-editar-meu-card"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar meu card
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeMutation.mutate()}
                  disabled={removeMutation.isPending}
                  className="gap-2 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 font-mono text-xs"
                  data-testid="btn-remover-meu-card"
                >
                  {removeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Remover
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={openDialog}
                className="gap-2 font-mono text-xs bg-brand-gold text-brand-navy hover:bg-brand-gold/90 font-semibold"
                data-testid="btn-criar-meu-card"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar meu card
              </Button>
            )}

            {/* Divider */}
            <div className="h-5 w-px bg-white/10" />

            {/* Anunciar button */}
            <Button
              size="sm"
              onClick={openAnuncioCreate}
              variant="outline"
              className="gap-2 font-mono text-xs border-brand-gold/30 text-brand-gold/80 hover:bg-brand-gold/10 hover:text-brand-gold"
              data-testid="btn-anunciar"
            >
              <Megaphone className="w-3.5 h-3.5" />
              {meusAnuncios.length > 0 ? `+ Novo anúncio` : "Anunciar"}
            </Button>
          </div>
        )}
      </div>

      {/* World Map */}
      {isLoading ? (
        <Skeleton className="h-[440px] rounded-2xl" />
      ) : (
        <WorldMapHeader membros={membros} />
      )}

      {/* ===== ANÚNCIOS EM DESTAQUE ===== */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-brand-gold/70" />
            <h2 className="text-sm font-semibold font-mono text-white/70 uppercase tracking-wider">Anúncios em Destaque</h2>
          </div>
          <div className="flex-1 h-px bg-brand-gold/10" />
          <span className="text-[10px] font-mono text-white/25">{anunciosAtivos.length}/6 ativos</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {anunciosAtivos.slice(0, 6).map(a => (
            <AnuncioCard
              key={a.id}
              anuncio={a}
              isOwn={a.membro_id === membroId}
              onEdit={openAnuncioEdit}
              onCancel={() => cancelarAnuncioMutation.mutate(a.id)}
            />
          ))}
          {Array.from({ length: Math.max(0, 6 - anunciosAtivos.length) }).map((_, i) => (
            <div
              key={`slot-${i}`}
              onClick={membroId ? openAnuncioCreate : undefined}
              className="relative rounded-xl overflow-hidden flex flex-col items-center justify-center gap-3 group transition-all duration-200"
              style={{
                aspectRatio: "2/1",
                border: "1.5px solid rgba(215,187,125,0.5)",
                background: "rgba(255,255,255,0.97)",
                cursor: membroId ? "pointer" : "default",
                boxShadow: "0 2px 12px rgba(215,187,125,0.12)",
              }}
              data-testid={`slot-anuncio-vazio-${i}`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(215,187,125,0.12)", border: "1px solid rgba(215,187,125,0.3)" }}>
                  <Megaphone className="w-4 h-4" style={{ color: "#D7BB7D" }} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-center"
                  style={{ color: "#D7BB7D", letterSpacing: "0.12em" }}>
                  Espaço disponível
                </p>
                {membroId && (
                  <span className="text-[10px] font-mono text-center transition-colors duration-200"
                    style={{ color: "rgba(0,29,52,0.5)" }}>
                    Clique para anunciar
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meus agendamentos — só visível para o próprio membro */}
      {membroId && meusAnuncios.length > 0 && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ background: "rgba(215,187,125,0.03)", border: "1px solid rgba(215,187,125,0.12)" }}>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-brand-gold/50" />
            <span className="text-xs font-mono text-brand-gold/60 uppercase tracking-wider">
              Meus agendamentos ({meusAnuncios.length})
            </span>
          </div>
          <div className="space-y-2">
            {meusAnuncios.map(a => {
              const today = new Date().toISOString().slice(0, 10);
              const isAtivo = a.data_inicio <= today && a.data_fim >= today;
              const isFuturo = a.data_inicio > today;
              return (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {a.imagem_url ? (
                    <img src={a.imagem_url} alt="" className="w-10 h-7 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-7 rounded shrink-0 flex items-center justify-center"
                      style={{ background: "rgba(215,187,125,0.08)", border: "1px solid rgba(215,187,125,0.15)" }}>
                      <Megaphone className="w-3 h-3 text-brand-gold/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-white/60">
                      {a.data_inicio} → {a.data_fim}
                    </p>
                    {a.link && (
                      <p className="text-[10px] text-white/30 font-mono truncate">{a.link}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: isAtivo ? "rgba(74,222,128,0.1)" : "rgba(215,187,125,0.08)",
                      border: `1px solid ${isAtivo ? "rgba(74,222,128,0.3)" : "rgba(215,187,125,0.2)"}`,
                      color: isAtivo ? "rgba(74,222,128,0.8)" : "rgba(215,187,125,0.6)",
                    }}>
                    {isAtivo ? "Ativo" : isFuturo ? "Agendado" : "Encerrado"}
                  </span>
                  <button
                    onClick={() => openAnuncioEdit(a)}
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors hover:bg-brand-gold/10"
                    style={{ border: "1px solid rgba(215,187,125,0.2)" }}
                    data-testid={`btn-edit-agenda-${a.id}`}
                  >
                    <Pencil className="w-3 h-3 text-brand-gold/50" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa ou especialidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="input-vitrine-search"
          />
        </div>

        <Select value={filterEspecialidade} onValueChange={setFilterEspecialidade}>
          <SelectTrigger className="w-44 h-9 text-sm" data-testid="select-vitrine-especialidade">
            <SelectValue placeholder="Ramo de atuação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ramos</SelectItem>
            {especialidades.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTerritorio} onValueChange={setFilterTerritorio}>
          <SelectTrigger className="w-40 h-9 text-sm" data-testid="select-vitrine-territorio">
            <SelectValue placeholder="Território" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os territórios</SelectItem>
            {territorios.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground border border-border hover:border-foreground/20 transition-colors"
            data-testid="btn-vitrine-clear-filters"
          >
            <X className="w-3 h-3" />
            Limpar
          </button>
        )}
      </div>

      {/* Card grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Store className="w-12 h-12 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground font-mono text-sm">
            {hasFilters ? "Nenhum resultado para os filtros aplicados" : "Nenhum membro na Vitrine ainda"}
          </p>
          <p className="text-muted-foreground/50 text-xs mt-1 font-mono">
            {hasFilters ? "Tente ajustar os filtros" : "Crie seu card usando o botão acima"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(m => (
            <MembroCard key={m.id} membro={m} isOwn={m.id === membroId} />
          ))}
        </div>
      )}

      {/* Create/Edit Card Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-lg border-white/10 text-white"
          style={{ background: "#050f1c" }}
        >
          <DialogHeader>
            <DialogTitle className="font-mono text-brand-gold text-base flex items-center gap-2">
              <Store className="w-4 h-4" />
              {myCardExists ? "Editar card na Vitrine" : "Criar card na Vitrine"}
            </DialogTitle>
            <p className="text-xs text-white/40 font-mono mt-1">
              Preencha as informações que aparecerão no seu card público. Os campos são pré-preenchidos com seu perfil.
            </p>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome">
                <Input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="Seu nome ou empresa"
                  data-testid="input-card-nome"
                />
              </Field>
              <Field label="Cargo / Função">
                <Input
                  value={form.cargo}
                  onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="Ex: Diretor, Engenheiro"
                  data-testid="input-card-cargo"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Empresa">
                <Input
                  value={form.empresa}
                  onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="Nome da empresa"
                  data-testid="input-card-empresa"
                />
              </Field>
              <Field label="Ramo de Atuação">
                <Select
                  value={form.ramo_atuacao || undefined}
                  onValueChange={v => setForm(f => ({ ...f, ramo_atuacao: v, segmento: "" }))}
                >
                  <SelectTrigger
                    className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                    data-testid="select-card-ramo"
                  >
                    <SelectValue placeholder="Selecione o ramo..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#001428] border-white/10 text-white max-h-64">
                    {RAMOS_SEGMENTOS.map(r => (
                      <SelectItem key={r.codigo} value={r.nome} className="text-white/80 focus:bg-brand-gold/10 focus:text-white">
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Segmento">
                  <Select
                    value={form.segmento || undefined}
                    onValueChange={v => setForm(f => ({ ...f, segmento: v }))}
                    disabled={!form.ramo_atuacao}
                  >
                    <SelectTrigger
                      className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40 disabled:opacity-40"
                      data-testid="select-card-segmento"
                    >
                      <SelectValue placeholder={form.ramo_atuacao ? "Selecione o segmento..." : "Selecione o ramo primeiro"} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#001428] border-white/10 text-white max-h-64">
                      {getSegmentosForRamo(form.ramo_atuacao || "").map(s => (
                        <SelectItem key={s.nome} value={s.nome} className="text-white/80 focus:bg-brand-gold/10 focus:text-white">
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <Field label="Localização">
              <button
                type="button"
                onClick={() => setLocationPickerOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-brand-gold/30 transition-colors"
                data-testid="btn-card-location-picker"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-brand-gold/50 shrink-0" />
                  {form.cidade || form.estado ? (
                    <span className="text-sm text-white truncate">
                      {[form.cidade, form.estado].filter(Boolean).join(", ")}
                    </span>
                  ) : (
                    <span className="text-sm text-white/25">Selecionar localização…</span>
                  )}
                </div>
                <Navigation className="w-3.5 h-3.5 text-brand-gold/40 shrink-0" />
              </button>
              {form.latitude && form.longitude && (
                <p className="text-[10px] text-white/20 font-mono px-1 mt-1">
                  GPS: {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
                </p>
              )}
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="WhatsApp">
                <Input
                  value={form.whatsapp}
                  onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="27 99999-9999"
                  data-testid="input-card-whatsapp"
                />
              </Field>
              <Field label="E-mail público">
                <Input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  type="email"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  placeholder="contato@empresa.com"
                  data-testid="input-card-email"
                />
              </Field>
            </div>

            <Field label="Área de Contribuição">
              <Select
                value={form.tipo_alianca || undefined}
                onValueChange={v => setForm(f => ({
                  ...f,
                  tipo_alianca: v,
                  nucleo_alianca: getNucleoForTipo(v) || f.nucleo_alianca,
                }))}
              >
                <SelectTrigger
                  className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                  data-testid="select-card-tipo-alianca"
                >
                  <SelectValue placeholder="Selecionar tipo..." />
                </SelectTrigger>
                <SelectContent className="bg-[#001428] border-white/10 text-white max-h-64">
                  {getAllTipos().map(t => (
                    <SelectItem key={t.nome} value={t.nome} className="text-white/80 focus:bg-brand-gold/10 focus:text-white">
                      {getTipoDisplayName(t.nome)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Site / Portfólio">
              <Input
                value={form.link_site}
                onChange={e => setForm(f => ({ ...f, link_site: e.target.value }))}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                placeholder="https://www.seusite.com.br"
                type="url"
                data-testid="input-card-link-site"
              />
            </Field>

            <Field label="Perfil / Descrição">
              <Textarea
                value={form.perfil_aliado}
                onChange={e => setForm(f => ({ ...f, perfil_aliado: e.target.value }))}
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 resize-none"
                placeholder="Descreva sua atuação, serviços ou diferenciais..."
                data-testid="input-card-perfil"
              />
            </Field>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-white/40 hover:text-white/70"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending || !form.nome.trim()}
              className="gap-2 font-mono"
              style={{
                background: "linear-gradient(135deg, #D7BB7D, #b89a50)",
                color: "#001D34",
              }}
              data-testid="btn-salvar-card"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
              {myCardExists ? "Salvar alterações" : "Publicar na Vitrine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={handleLocationSelect}
      />

      {/* ===== ANÚNCIO DIALOG ===== */}
      <Dialog open={anuncioDialogOpen} onOpenChange={setAnuncioDialogOpen}>
        <DialogContent
          className="max-w-xl border-brand-gold/20 text-white"
          style={{ background: "#050f1c" }}
        >
          <DialogHeader>
            <DialogTitle className="font-mono text-brand-gold text-base flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              {anuncioEditMode ? "Editar anúncio" : "Criar anúncio"}
            </DialogTitle>
            <p className="text-xs text-white/40 font-mono mt-1">
              {anuncioEditMode
                ? "Atualize as informações do seu anúncio. O período não pode ser alterado."
                : "Preencha os dados e escolha um período quinzenal disponível."}
            </p>
          </DialogHeader>

          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            {/* Imagem */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/40 font-mono">Imagem (opcional)</label>
              <div className="flex items-center gap-3">
                <div
                  className="w-20 h-14 rounded-lg flex items-center justify-center overflow-hidden border border-white/10"
                  style={{ background: anuncioImagemPreview ? "transparent" : "rgba(255,255,255,0.04)" }}
                >
                  {anuncioImagemPreview ? (
                    <img src={anuncioImagemPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-white/20" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpg,image/jpeg,image/webp"
                    className="sr-only"
                    data-testid="input-anuncio-imagem"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleAnuncioImageUpload(file);
                    }}
                  />
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-colors"
                    style={{ background: "rgba(215,187,125,0.08)", border: "1px solid rgba(215,187,125,0.2)", color: "rgba(215,187,125,0.8)" }}>
                    {anuncioUploadLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {anuncioUploadLoading ? "Enviando..." : "Escolher imagem"}
                  </div>
                </label>
                {anuncioImagemId && (
                  <button
                    onClick={() => { setAnuncioImagemId(null); setAnuncioImagemPreview(null); }}
                    className="text-xs text-white/25 hover:text-white/50 font-mono"
                  >
                    remover
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/25 font-mono px-0.5">
                Proporção recomendada: <span className="text-brand-gold/40">2:1</span> — ex: 1200 × 600 px &nbsp;·&nbsp; PNG, JPG ou WebP &nbsp;·&nbsp; máx. 5 MB
              </p>
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/40 font-mono">Link (opcional)</label>
              <Input
                value={anuncioForm.link}
                onChange={e => setAnuncioForm(f => ({ ...f, link: e.target.value }))}
                placeholder="https://www.seusite.com.br/servico"
                type="url"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                data-testid="input-anuncio-link"
              />
            </div>

            {/* Período — só em criação */}
            {!anuncioEditMode && (
              <div className="rounded-xl p-4 space-y-3"
                style={{ background: "rgba(215,187,125,0.04)", border: "1px solid rgba(215,187,125,0.1)" }}>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-brand-gold/50" />
                  <span className="text-xs font-mono text-brand-gold/60">Período do anúncio</span>
                </div>
                {disponibilidade.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-white/30 font-mono py-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Carregando disponibilidade...
                  </div>
                ) : (
                  <PeriodoPickerGrid
                    periodos={disponibilidade}
                    selected={anuncioPeriodo}
                    onSelect={setAnuncioPeriodo}
                    reservados={periodosReservados}
                  />
                )}
                {anuncioPeriodo && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: "rgba(215,187,125,0.08)", border: "1px solid rgba(215,187,125,0.2)" }}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold/70" />
                    <span className="text-xs font-mono text-brand-gold/70">
                      {anuncioPeriodo.inicio} → {anuncioPeriodo.fim}
                    </span>
                  </div>
                )}
              </div>
            )}

            {anuncioEditMode && anuncioEditTarget && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <CalendarDays className="w-3.5 h-3.5 text-white/30" />
                <span className="text-xs font-mono text-white/30">
                  Período: {anuncioEditTarget.data_inicio} → {anuncioEditTarget.data_fim}
                </span>
              </div>
            )}

            {/* Termos — somente em criação */}
            {!anuncioEditMode && (
              <div className="rounded-xl p-4 space-y-4"
                style={{ background: "rgba(215,187,125,0.03)", border: "1px solid rgba(215,187,125,0.15)" }}>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-gold/50 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-white/40 font-mono leading-relaxed">
                    Declaro, sob minha exclusiva responsabilidade, que o anúncio publicado no BUILT Vitrine Ads está associado ao meu negócio, é lícito, verdadeiro, verificável e não viola direitos de terceiros, assumindo integral responsabilidade civil, comercial, regulatória e autoral pelo seu conteúdo, bem como por quaisquer reclamações, danos ou sanções dele decorrentes. Reconheço que a BUILT atua apenas como plataforma de veiculação e conexão, não sendo responsável pela oferta anunciada nem pelas relações comerciais dela resultantes.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  {[
                    { key: "t1" as const, label: "Tenho autorização para usar todas as imagens, marcas e conteúdos do anúncio." },
                    { key: "t2" as const, label: "As informações do anúncio são verdadeiras e podem ser comprovadas." },
                    { key: "t3" as const, label: "Reconheço que a BUILT não garante nem responde pela oferta anunciada." },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer group" data-testid={`checkbox-termo-${key}`}>
                      <div
                        onClick={() => setAnuncioTerms(t => ({ ...t, [key]: !t[key] }))}
                        className="mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-all cursor-pointer"
                        style={{
                          background: anuncioTerms[key] ? "rgba(215,187,125,0.9)" : "rgba(255,255,255,0.04)",
                          borderColor: anuncioTerms[key] ? "rgba(215,187,125,0.9)" : "rgba(255,255,255,0.15)",
                        }}
                      >
                        {anuncioTerms[key] && <Check className="w-2.5 h-2.5 text-[#001D34]" />}
                      </div>
                      <span
                        className="text-[11px] font-mono leading-relaxed select-none transition-colors"
                        style={{ color: anuncioTerms[key] ? "rgba(215,187,125,0.8)" : "rgba(255,255,255,0.35)" }}
                        onClick={() => setAnuncioTerms(t => ({ ...t, [key]: !t[key] }))}
                      >
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            {anuncioEditMode && anuncioEditTarget && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("Cancelar este anúncio?")) {
                    cancelarAnuncioMutation.mutate(anuncioEditTarget.id);
                    setAnuncioDialogOpen(false);
                  }
                }}
                className="text-red-400/60 hover:text-red-400 hover:bg-red-400/10 font-mono text-xs mr-auto"
                data-testid="btn-cancelar-anuncio"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Cancelar anúncio
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setAnuncioDialogOpen(false)}
              className="text-white/40 hover:text-white/70 font-mono text-xs"
            >
              Fechar
            </Button>
            <Button
              onClick={handleAnuncioSubmit}
              disabled={
                (!anuncioEditMode && !anuncioTermsAllAccepted) ||
                criarAnuncioMutation.isPending ||
                editarAnuncioMutation.isPending ||
                anuncioUploadLoading
              }
              className="gap-2 font-mono text-xs"
              style={{ background: "linear-gradient(135deg, #D7BB7D, #b89a50)", color: "#001D34" }}
              data-testid="btn-salvar-anuncio"
            >
              {(criarAnuncioMutation.isPending || editarAnuncioMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Megaphone className="w-4 h-4" />
              )}
              {anuncioEditMode ? "Salvar alterações" : "Publicar anúncio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembroCard({ membro: m, isOwn }: { membro: MembroVitrine; isOwn: boolean }) {
  const foto = fotoUrl(m);
  const nome = m.nome || "—";
  const [, navigate] = useLocation();
  const [orcamentoOpen, setOrcamentoOpen] = useState(false);
  const [mensagem, setMensagem] = useState("");

  function waLink() {
    if (!m.whatsapp) return null;
    const digits = m.whatsapp.replace(/\D/g, "");
    return `https://wa.me/${digits.startsWith("55") ? digits : "55" + digits}`;
  }

  function handleEnviarWa(e: React.MouseEvent) {
    e.stopPropagation();
    const wa = waLink();
    if (!wa) return;
    const texto = `Olá ${nome}! Gostaria de solicitar um orçamento.\n\n${mensagem}`.trim();
    window.open(`${wa}?text=${encodeURIComponent(texto)}`, "_blank");
    setOrcamentoOpen(false);
    setMensagem("");
  }

  function handleEnviarEmail(e: React.MouseEvent) {
    e.stopPropagation();
    const assunto = encodeURIComponent(`Solicitação de orçamento - BUILT Alliances`);
    const corpo = encodeURIComponent(`Olá ${nome}!\n\nGostaria de solicitar um orçamento.\n\n${mensagem}`);
    window.open(`mailto:${m.email}?subject=${assunto}&body=${corpo}`, "_blank");
    setOrcamentoOpen(false);
    setMensagem("");
  }

  return (
    <>
      <div
        className="relative rounded-xl border overflow-hidden group transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-[1.01]"
        style={{
          background: "linear-gradient(145deg, #071626, #040e1c)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          borderColor: isOwn ? "rgba(215,187,125,0.3)" : "rgba(255,255,255,0.06)",
        }}
        onClick={() => navigate(`/vitrine/${m.id}`)}
        data-testid={`card-vitrine-${m.id}`}
      >
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: isOwn
            ? "linear-gradient(90deg, transparent, rgba(215,187,125,0.6), transparent)"
            : "linear-gradient(90deg, transparent, rgba(215,187,125,0.3), transparent)"
          }} />

        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-brand-gold/20" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-brand-gold/20" />

        {/* BUILT Proud Member badge — canto superior direito */}
        {(m.Outras_redes_as_quais_pertenco || []).includes("BUILT_PROUD_MEMBER") && (
          <img
            src="/built-proud-member.png"
            alt="BUILT Proud Member"
            title="BUILT Proud Member"
            className="absolute top-2 right-2 w-auto object-contain z-10"
            style={{ height: 48 }}
            data-testid="badge-proud-member"
          />
        )}

        <div className="p-4 space-y-3">
          {/* Avatar */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2 border-brand-gold/20"
              style={{
                background: foto ? "transparent" : "radial-gradient(circle at 30% 30%, rgba(215,187,125,0.15), rgba(3,8,18,0.9))",
                boxShadow: "0 0 16px rgba(215,187,125,0.1)",
              }}
            >
              {foto ? (
                <img src={foto} alt={nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold font-mono text-brand-gold/80">{getInitials(nome)}</span>
              )}
            </div>
          </div>

          {/* Name + info */}
          <div className="text-center space-y-1.5">
            <p className="text-sm font-semibold text-white font-mono leading-tight">{nome}</p>

            {m.especialidade && (
              <p className="text-xs text-brand-gold/60 font-mono truncate">{m.especialidade}</p>
            )}

            {m.empresa && (
              <div className="flex items-center justify-center gap-1">
                <Building2 className="w-3 h-3 text-white/25 shrink-0" />
                <span className="text-xs text-white/40 truncate">{m.empresa}</span>
              </div>
            )}

            {m.cidade && (
              <div className="flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3 text-white/20 shrink-0" />
                <span className="text-xs text-white/35 truncate">{m.cidade}</span>
              </div>
            )}

            <div className="flex justify-center">
              <AuraBadge membroId={m.id} />
            </div>

            {m.link_site && (
              <a
                href={m.link_site.startsWith("http") ? m.link_site : `https://${m.link_site}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center justify-center gap-1 text-xs text-brand-gold/50 hover:text-brand-gold transition-colors font-mono"
                data-testid={`link-site-${m.id}`}
              >
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">
                  {m.link_site.replace(/^https?:\/\/(www\.)?/, "")}
                </span>
              </a>
            )}
          </div>

          {/* Quote button — only for other members */}
          {!isOwn && (
            <>
              <div className="h-px bg-white/5" />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setMensagem(""); setOrcamentoOpen(true); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all duration-200 border"
                style={{
                  background: "rgba(215,187,125,0.06)",
                  borderColor: "rgba(215,187,125,0.18)",
                  color: "rgba(215,187,125,0.75)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(215,187,125,0.12)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(215,187,125,0.35)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#D7BB7D";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(215,187,125,0.06)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(215,187,125,0.18)";
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(215,187,125,0.75)";
                }}
                data-testid={`btn-orcamento-${m.id}`}
              >
                <FileText className="w-3 h-3" />
                Solicitar orçamento
              </button>
            </>
          )}
        </div>
      </div>

      {/* Orçamento dialog */}
      <Dialog open={orcamentoOpen} onOpenChange={setOrcamentoOpen}>
        <DialogContent
          className="border-brand-gold/20 text-white max-w-md"
          style={{ background: "#001428" }}
        >
          <DialogHeader>
            <DialogTitle className="font-mono text-brand-gold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Solicitar Orçamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="flex items-center gap-3 p-3 rounded-lg"
              style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-brand-gold/20"
                style={{ background: "rgba(215,187,125,0.08)" }}>
                <span className="text-[10px] font-mono font-bold text-brand-gold/70">{getInitials(nome)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/40 font-mono">Para</p>
                <p className="text-sm font-semibold text-white font-mono truncate">{nome}</p>
                {m.especialidade && (
                  <p className="text-xs text-brand-gold/50 truncate">{m.especialidade}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-white/50">Descreva sua necessidade</label>
              <textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                placeholder="Ex: Preciso de orçamento para instalação elétrica em imóvel comercial de 200m²..."
                autoFocus
                rows={4}
                data-testid={`textarea-orcamento-${m.id}`}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "white",
                  padding: "10px 12px",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
                onFocus={e => { e.target.style.borderColor = "rgba(215,187,125,0.4)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            {waLink() && (
              <Button
                onClick={handleEnviarWa}
                className="w-full font-mono text-xs gap-1.5"
                style={{ background: "#25D366", color: "#fff" }}
                data-testid={`btn-enviar-orcamento-wa-${m.id}`}
              >
                <Phone className="w-3.5 h-3.5" />
                Enviar via WhatsApp
              </Button>
            )}
            {m.email && (
              <Button
                onClick={handleEnviarEmail}
                variant="outline"
                className="w-full border-white/15 text-white/60 hover:text-white hover:border-white/30 font-mono text-xs gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Enviar por E-mail
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setOrcamentoOpen(false)}
              className="w-full text-white/40 hover:text-white/70 text-sm"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-white/40 font-mono">{label}</Label>
      {children}
    </div>
  );
}
