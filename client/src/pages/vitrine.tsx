import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
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
  Store, Search, MapPin, Building2, Gem, Target,
  Users, X, Plus, Pencil, Trash2, Loader2,
  FileText, Mail, MessageSquare, Globe, Phone, Navigation,
  Megaphone, CalendarDays, ExternalLink, ImageIcon, Tag, CheckCircle2, XCircle, Upload,
  ShieldCheck, Check, LayoutGrid, List, ChevronRight, ChevronLeft, Sparkles,
} from "lucide-react";
import { RedeBadgeButton, getRedesBadges } from "@/components/rede-badge-viewer";
import { getPhotoObjectPosition } from "@/lib/photo-position";
import { MapWheelGuard } from "@/components/map-wheel-guard";
import { canRegisterAuraForMember, getAuraLinkedMemberIds, isBuiltMemberForAura } from "@/lib/aura-access";
import { EnvironmentAccessDialog, environmentAccessFor } from "@/components/environment-access";
import { PhoneInput } from "@/components/phone-input";
import { getVitrineOpaUrl } from "@/lib/public-refs";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from "react-simple-maps";
import { getAllTipos, getNucleoForTipo, getTipoDisplayName, RAMOS_SEGMENTOS, getSegmentosForRamo } from "@/lib/ramos-segmentos";

const WORLD_GEO = "/world-countries-50m.json";
const ASSET_CACHE_VERSION = "directus-db-20260616";
function directusAssetId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.id || value.uuid || value.directus_files_id || value.file || null;
  return String(value);
}
function assetUrl(id: any, params: string) {
  const assetId = directusAssetId(id);
  if (!assetId) return null;
  return `/api/assets/${assetId}?${params}&v=${ASSET_CACHE_VERSION}`;
}
function versionAssetUrl(url?: any) {
  if (typeof url !== "string") {
    const assetId = directusAssetId(url);
    return assetId ? `/api/assets/${assetId}?v=${ASSET_CACHE_VERSION}` : null;
  }
  if (!url) return null;
  if (!url.includes("/api/assets/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${ASSET_CACHE_VERSION}`;
}
const NUCLEOS = [
  "Diretoria da Aliança",
  "Núcleo Técnico",
  "Núcleo de Obra",
  "Núcleo Comercial",
  "Núcleo de Capital",
];

interface MembroVitrine {
  id: string;
  nome: string;
  cargo: string;
  especialidade: string;
  empresa: string;
  cidade: string;
  estado: string;
  whatsapp: string;
  email: string;
  foto: string | null;
  foto_perfil: string | null;
  foto_posicao_x: number | string | null;
  foto_posicao_y: number | string | null;
  logo_empresa: string | { id: string } | null;
  perfil_aliado: string;
  nucleo_alianca: string;
  na_vitrine: boolean;
  link_site: string | null;
  latitude: number | null;
  longitude: number | null;
  Outras_redes_as_quais_pertenco: string[] | null;
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
  return assetUrl(f, "width=80&height=80&fit=cover");
}

  function getInitialsMap(nome: string): string {
    if (!nome) return "";
    return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
  }

  return (
    <div
      className="relative aspect-[16/9] max-h-[360px] overflow-hidden rounded-2xl border border-brand-gold/20"
      style={{ background: "radial-gradient(ellipse at 50% 110%, #001428 0%, #000c1f 55%, #000408 100%)" }}
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
      <div className="absolute top-4 left-4 z-20 sm:top-5 sm:left-6">
        <p className="text-[10px] text-yellow-400/60 tracking-[0.35em] uppercase font-mono">// BUILT Vitrine</p>
        <h2 className="mt-0.5 max-w-[260px] font-mono text-base font-bold leading-tight tracking-[0.08em] text-yellow-400 sm:max-w-[360px] sm:text-lg sm:tracking-[0.1em] xl:max-w-none xl:text-xl xl:tracking-[0.12em]">
          MAPA DE PARCEIROS DE MERCADO
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
      <div className="absolute top-4 right-4 z-20 text-right font-mono sm:top-5 sm:right-6">
        <div className="mb-2">
          <p className="text-[9px] text-yellow-400/60 tracking-widest uppercase">Usuários</p>
          <p className="text-2xl font-bold leading-none text-yellow-400 sm:text-3xl xl:text-4xl">{membros.length}</p>
        </div>
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
            style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(250,204,21,0.35)", color: "#FACC15" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(250,204,21,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          >{label}</button>
        ))}
      </div>

      {/* Map */}
      <MapWheelGuard>
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
            const isSelected = !isMulti && selectedMembro?.id === cluster.items[0].id;
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
                  <circle r={r * (isSelected || isClusterSelected ?5.5 : isHovered ?4.5 : 3.5)} fill="#D7BB7D" fillOpacity={isSelected || isClusterSelected ?0.12 : 0.06}>
                    <animate attributeName="r" from={r * 2.5} to={r * 5} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.4" to="0" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                  <circle r={r * (isSelected || isClusterSelected ?3 : isHovered ?2.5 : 2)} fill="#D7BB7D" fillOpacity={isSelected || isClusterSelected ?0.4 : isHovered ?0.3 : 0.18} />
                  <circle r={r * (isSelected || isClusterSelected ?1.6 : isHovered ?1.3 : 1)} fill="#D7BB7D" fillOpacity={0.95} />
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
      </MapWheelGuard>

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
                <img src={fotoUrlMap(selectedMembro)!} alt="" className="w-full h-full object-cover" style={{ objectPosition: getPhotoObjectPosition(selectedMembro) }} />
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
  categoria: string;
}

function fotoUrl(m: MembroVitrine): string | null {
  const f = m.foto || m.foto_perfil;
  if (!f) return null;
  return assetUrl(f, "width=200&height=200&fit=cover");
}

function logoEmpresaUrl(m: MembroVitrine): string | null {
  const logo = m.logo_empresa;
  if (!logo) return null;
  const id = typeof logo === "string" ? logo : logo.id;
  if (!id) return null;
  return assetUrl(id, "width=160&height=80&fit=contain");
}

function getInitials(nome: string): string {
  if (!nome) return "";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function normalizeFilterText(value: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;/|()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fixMojibakeText(value: string): string {
  if (!/[ÃÂ]|[\u0080-\u009F]/.test(value)) return value.normalize("NFC");
  try {
    return decodeURIComponent(escape(value)).normalize("NFC");
  } catch {
    return value.normalize("NFC");
  }
}

function fixMojibakeDeep<T>(value: T): T {
  if (typeof value === "string") return fixMojibakeText(value) as T;
  if (Array.isArray(value)) return value.map(item => fixMojibakeDeep(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, fixMojibakeDeep(item)])
    ) as T;
  }
  return value;
}

function normalizeTerritorioKey(cidade: string | null): string {
  return normalizeFilterText(cidade)
    .replace(/\b(brasil|brazil|japao|japan|portugal|usa|eua|estados unidos|united states)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatFilterLabel(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s|[-'/])([a-zà-ú])/g, (match) => match.toLocaleUpperCase("pt-BR"));
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
  address: {
    city: string; town: string; municipality: string; village: string;
    state: string; country: string; country_code: string;
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
      const url = `https://nominatim.openstreetmap.org/searchq=${encodeURIComponent(search)}&format=json&limit=8&addressdetails=1&accept-language=pt-BR,pt`;
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
                    ?
                    "bg-brand-gold/10 border-brand-gold/40 text-brand-gold"
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
  descricao: string | null;
  link: string | null;
  imagem_url: string | null;
  imagem_directus_id: string | null;
  slot_tipo: string | null;
  membro_nome: string | null;
  membro_empresa: string | null;
  membro_foto: string | null;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  pagamento_url: string | null;
  pagamento_status: string | null;
  pagamento_provider: string | null;
  pagamento_pais: string | null;
}

interface OportunidadeVitrine {
  id: string;
  bia_id?: string | null;
  nome_oportunidade: string | null;
  tipo: string | null;
  valor_origem_opa: string | number | null;
  Minimo_esforco_multiplicador: string | number | null;
  nucleo_alianca: string | null;
  localizacao: string | null;
  status: string | null;
  perfil_aliado: string | null;
  imagem_directus_id: string | null;
  imagem_url: string | null;
  date_created: string | null;
}

function safeAdText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeAdHref(link: unknown) {
  const value = safeAdText(link);
  if (!value) return undefined;
  return value.startsWith("http") ? value : `https://${value}`;
}

function visibleAdTitle(value: unknown) {
  const title = safeAdText(value);
  return title === "Destaque da Vitrine" ? "" : title;
}

function normalizeAnuncios(data: unknown): AnuncioVitrine[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: safeAdText(item.id),
      membro_id: safeAdText(item.membro_id),
      titulo: safeAdText(item.titulo),
      descricao: safeAdText(item.descricao) || null,
      link: safeAdText(item.link) || null,
      imagem_url: typeof item.imagem_url === "string"
        ? safeAdText(item.imagem_url) || null
        : (directusAssetId(item.imagem_url) ? `/api/assets/${directusAssetId(item.imagem_url)}` : null),
      imagem_directus_id: directusAssetId(item.imagem_directus_id) || null,
      slot_tipo: safeAdText(item.slot_tipo) || "padrao",
      membro_nome: safeAdText(item.membro_nome) || null,
      membro_empresa: safeAdText(item.membro_empresa) || null,
      membro_foto: safeAdText(item.membro_foto) || null,
      data_inicio: safeAdText(item.data_inicio),
      data_fim: safeAdText(item.data_fim),
      ativo: item.ativo !== false,
      pagamento_url: safeAdText(item.pagamento_url) || null,
      pagamento_status: safeAdText(item.pagamento_status) || null,
      pagamento_provider: safeAdText(item.pagamento_provider) || null,
      pagamento_pais: safeAdText(item.pagamento_pais) || null,
    }))
    .filter(item => item.id);
}

// ===== DESTAQUE CARD =====
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
  const href = safeAdHref(anuncio.link);
  const titulo = safeAdText(anuncio.titulo, "Destaque da Vitrine");

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
        aspectRatio: "1/1",
        cursor: href ? "pointer" : "default",
        background: "rgba(0,29,52,0.9)",
      }}
      data-testid={`card-anuncio-${anuncio.id}`}
    >
      {/* Full image */}
      {anuncio.imagem_url ? (
        <img
          src={versionAssetUrl(anuncio.imagem_url) || ""}
          alt={titulo}
          className="w-full h-full object-cover"
          style={{ display: "block" }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Megaphone className="w-10 h-10 text-brand-gold/20" />
        </div>
      )}

      {/* Destaque badge overlay — only on hover */}
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
        <span className="text-[9px] font-mono text-brand-gold/80 uppercase tracking-wider">Destaque</span>
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

// ===== DESTAQUE HERO =====
function AnuncioHeroCard({
  anuncio,
  isOwn,
  onCreate,
  onEdit,
  onCancel,
}: {
  anuncio?: AnuncioVitrine;
  isOwn: boolean;
  onCreate: () => void;
  onEdit: (a: AnuncioVitrine) => void;
  onCancel: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const href = safeAdHref(anuncio?.link);
  const titulo = visibleAdTitle(anuncio?.titulo);
  const altTitulo = titulo || "Destaque BUILT Vitrine";

  const handleClick = () => {
    if (href) window.open(href, "_blank", "noopener,noreferrer");
    else if (!anuncio) onCreate();
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative aspect-[16/9] max-h-[360px] overflow-hidden rounded-2xl border border-brand-gold/35"
      style={{
        background: "rgba(255,255,255,0.97)",
        border: "1.5px solid rgba(37,99,235,0.35)",
        boxShadow: "0 10px 28px rgba(37,99,235,0.1)",
        cursor: href || !anuncio ? "pointer" : "default",
      }}
      data-testid={anuncio ? `card-anuncio-hero-${anuncio.id}` : "slot-anuncio-hero-vazio"}
    >
      {anuncio?.imagem_url ? (
        <img
          src={versionAssetUrl(anuncio.imagem_url) || ""}
          alt={altTitulo}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "linear-gradient(rgba(37,99,235,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }} />
          <div className="relative flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-600/30 bg-blue-600/10">
              <Megaphone className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-navy">
              Espaço premium disponível
            </p>
            <span className="text-xs font-mono text-muted-foreground">Clique para destacar</span>
          </div>
        </div>
      )}

      <div
        className="absolute left-5 top-5 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white transition-opacity duration-200"
        style={{ opacity: hovered ? 1 : 0 }}
      >
        Destaque da Vitrine
      </div>

      {anuncio && (
        <div className="absolute bottom-5 left-5 right-5 max-w-[75%] text-white">
          {titulo && <h3 className="text-2xl font-bold leading-tight">{titulo}</h3>}
          {anuncio.descricao && (
            <p className="mt-2 line-clamp-2 text-sm text-white/75">{anuncio.descricao}</p>
          )}
          {href && (
            <span className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy">
              Saiba mais
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      )}

      {anuncio && isOwn && (
        <div
          className="absolute right-4 top-4 flex gap-1 transition-opacity duration-200"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          <button
            onClick={e => { e.stopPropagation(); onEdit(anuncio); }}
            className="flex h-8 w-8 items-center justify-center rounded bg-black/55 backdrop-blur"
            data-testid={`btn-edit-anuncio-hero-${anuncio.id}`}
          >
            <Pencil className="h-4 w-4 text-brand-gold" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onCancel(); }}
            className="flex h-8 w-8 items-center justify-center rounded bg-black/55 backdrop-blur hover:bg-red-500/40"
            data-testid={`btn-cancel-anuncio-hero-${anuncio.id}`}
          >
            <XCircle className="h-4 w-4 text-white/70" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function VitrinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const isParceirosPage = location === "/vitrine/parceiros";
  const [search, setSearch] = useState("");
  const [filterEspecialidade, setFilterEspecialidade] = useState("all");
  const [filterTerritorio, setFilterTerritorio] = useState("all");
  const [sortOrder, setSortOrder] = useState<"default" | "az" | "za">("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
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
  const [anuncioImagemId, setAnuncioImagemId] = useState<string | null>(null);
  const [anuncioImagemPreview, setAnuncioImagemPreview] = useState<string | null>(null);
  const [anuncioUploadLoading, setAnuncioUploadLoading] = useState(false);
  const [anuncioTerms, setAnuncioTerms] = useState({ t1: false, t2: false, t3: false });
  const [anuncioSlotTipo, setAnuncioSlotTipo] = useState<"padrao" | "hero">("padrao");
  const [anuncioPagamentoPais, setAnuncioPagamentoPais] = useState<"brasil" | "exterior">("brasil");
  const [anuncioPagamentoConfirmado, setAnuncioPagamentoConfirmado] = useState(false);
  const [ultimoPagamentoAnuncio, setUltimoPagamentoAnuncio] = useState<{
    url: string;
    pais: string | null;
    dataInicio: string | null;
    dataFim: string | null;
  } | null>(null);
  const anuncioTermsAllAccepted = anuncioTerms.t1 && anuncioTerms.t2 && anuncioTerms.t3;
  const [anuncioEditTarget, setAnuncioEditTarget] = useState<AnuncioVitrine | null>(null);
  const [blockedAuraAccess, setBlockedAuraAccess] = useState<ReturnType<typeof environmentAccessFor> | null>(null);

  const membroId = user?.membro_directus_id;
  const isSuperAdmin = user?.role === "admin";
  const canUseAuraRegistration = isBuiltMemberForAura(user);
  const showAuraCta = !!membroId;

  // Fetch all vitrine members
  const { data: membros = [], isLoading, isError: vitrineLoadError, error: vitrineLoadErrorInfo } = useQuery<MembroVitrine[]>({
    queryKey: ["/api/vitrine"],
    queryFn: async () => {
      const r = await fetch("/api/vitrine");
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error || "Falha ao carregar Vitrine");
      }
      const data = await r.json();
      return Array.isArray(data) ? fixMojibakeDeep(data) : [];
    },
  });

  // Fetch current user's membro data to pre-fill form and check card status
  const { data: myMembro } = useQuery<MembroVitrine & { [key: string]: any }>({
    queryKey: ["/api/membros", membroId],
    queryFn: async () => fixMojibakeDeep(await fetch(`/api/membros/${membroId}`).then(r => r.json())),
    enabled: !!membroId,
  });

  const { data: minhasComunidades = [] } = useQuery<any[]>({
    queryKey: ["/api/comunidades", { membro_id: membroId, scope: "aura-vinculos" }],
    queryFn: async () => {
      const r = await fetch(`/api/comunidades?membro_id=${membroId}`);
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!membroId && canUseAuraRegistration,
  });

  const { data: minhasBias = [] } = useQuery<any[]>({
    queryKey: ["/api/bias", "aura-vinculos"],
    queryFn: async () => {
      const r = await fetch("/api/bias");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const auraLinkedMemberIds = useMemo(
    () => getAuraLinkedMemberIds({
      comunidades: minhasComunidades,
      bias: minhasBias,
      currentMemberId: membroId,
    }),
    [minhasComunidades, minhasBias, membroId]
  );

  const myCardExists = !!myMembro?.na_vitrine;

  // Anúncios queries
  const { data: anunciosAtivos = [], refetch: refetchAnuncios } = useQuery<AnuncioVitrine[]>({
    queryKey: ["/api/anuncios", "vitrine"],
    queryFn: async () => {
      const r = await fetch("/api/anuncios?ambiente=vitrine");
      if (!r.ok) return [];
      return normalizeAnuncios(fixMojibakeDeep(await r.json()));
    },
  });

  const { data: meusAnuncios = [], refetch: refetchMeuAnuncio } = useQuery<AnuncioVitrine[]>({
    queryKey: ["/api/anuncios/mine", "vitrine"],
    queryFn: async () => {
      if (!user) return [];
      const r = await fetch("/api/anuncios/mine?ambiente=vitrine");
      if (!r.ok) return [];
      return normalizeAnuncios(fixMojibakeDeep(await r.json()));
    },
    enabled: !!user,
  });

  const { data: opas = [] } = useQuery<OportunidadeVitrine[]>({
    queryKey: ["/api/oportunidades"],
    queryFn: async () => {
      const r = await fetch("/api/oportunidades");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? fixMojibakeDeep(data) : [];
    },
  });
  // Anúncio mutations
  const criarAnuncioMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/anuncios", data);
      return response.json();
    },
    onSuccess: (anuncio: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios", "vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine", "vitrine"] });
      setAnuncioDialogOpen(false);
      if (anuncio.pagamento_url && !isSuperAdmin) {
        setUltimoPagamentoAnuncio({
          url: anuncio.pagamento_url,
          pais: anuncio.pagamento_pais,
          dataInicio: anuncio.data_inicio,
          dataFim: anuncio.data_fim,
        });
        window.open(anuncio.pagamento_url, "_blank", "noopener,noreferrer");
        toast({
          title: "Pagamento gerado",
          description: "O link abriu em uma nova aba. Se o navegador bloquear, use o botão Abrir pagamento em Meus agendamentos.",
        });
        return;
      }
      toast({ title: "Destaque criado com sucesso!" });
    },
    onError: (err: any) => toast({ title: err.message || "Erro ao criar destaque", variant: "destructive" }),
  });

  const editarAnuncioMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/anuncios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios", "vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine", "vitrine"] });
      setAnuncioDialogOpen(false);
      toast({ title: "Destaque atualizado!" });
    },
    onError: (err: any) => toast({ title: err.message || "Erro ao atualizar destaque", variant: "destructive" }),
  });

  const cancelarAnuncioMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/anuncios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios", "vitrine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine", "vitrine"] });
      toast({ title: "Destaque cancelado." });
    },
    onError: () => toast({ title: "Erro ao cancelar destaque", variant: "destructive" }),
  });

  function openAnuncioCreate() {
    setAnuncioEditMode(false);
    setAnuncioEditTarget(null);
    setAnuncioForm({ titulo: "", descricao: "", link: "" });
    setAnuncioImagemId(null);
    setAnuncioImagemPreview(null);
    setAnuncioSlotTipo("padrao");
    setAnuncioTerms({ t1: false, t2: false, t3: false });
    setAnuncioPagamentoPais("brasil");
    setAnuncioDialogOpen(true);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("criarAnuncio") === "true") {
      openAnuncioCreate();
      navigate("/vitrine", { replace: true });
    }
  }, [location, navigate]);

  function openAnuncioEdit(alvo: AnuncioVitrine) {
    setAnuncioEditMode(true);
    setAnuncioEditTarget(alvo);
    setAnuncioForm({
      titulo: visibleAdTitle(alvo.titulo),
      descricao: alvo.descricao || "",
      link: alvo.link || "",
    });
    setAnuncioImagemId(alvo.imagem_directus_id || null);
    setAnuncioImagemPreview(versionAssetUrl(alvo.imagem_url));
    setAnuncioSlotTipo(alvo.slot_tipo === "hero" ? "hero" : "padrao");
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
    const titulo = anuncioForm.titulo.trim();

    if (anuncioEditMode && anuncioEditTarget) {
      editarAnuncioMutation.mutate({
        id: anuncioEditTarget.id,
        data: {
          titulo,
          descricao: anuncioForm.descricao || null,
          link: anuncioForm.link || null,
          imagem_directus_id: anuncioImagemId || null,
          slot_tipo: anuncioSlotTipo,
        },
      });
    } else {
      criarAnuncioMutation.mutate({
        titulo,
        descricao: anuncioForm.descricao || null,
        link: anuncioForm.link || null,
        imagem_directus_id: anuncioImagemId || null,
        ambiente: "vitrine",
        slot_tipo: anuncioSlotTipo,
        pagamento_pais: anuncioPagamentoPais,
      });
    }
  }

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
        const raw = err.message || "";
        const jsonPart = raw.slice(raw.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        // Directus wraps the real message in errors[]
        const directusMsg = parsed.error || parsed.errors?.[0]?.message;
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
    const map = new Map<string, string>();
    membros.forEach(m => {
      const key = normalizeFilterText(m.especialidade);
      if (!key) return;
      const label = formatFilterLabel(m.especialidade || "");
      const current = map.get(key);
      if (!current || label.length < current.length || current === current.toLocaleUpperCase("pt-BR")) {
        map.set(key, label);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [membros]);

  const territorios = useMemo(() => {
    const map = new Map<string, string>();
    membros.forEach(m => {
      const key = normalizeTerritorioKey(m.cidade);
      if (!key) return;
      const label = formatFilterLabel(key);
      const current = map.get(key);
      if (!current || label.length < current.length) {
        map.set(key, label);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [membros]);

  const filtered = useMemo(() => {
    const list = membros.filter(m => {
      const nome = (m.nome || "").toLowerCase();
      const empresa = (m.empresa || "").toLowerCase();
      const esp = (m.especialidade || "").toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || nome.includes(q) || empresa.includes(q) || esp.includes(q);
      const matchEsp = filterEspecialidade === "all" || normalizeFilterText(m.especialidade) === filterEspecialidade;
      const matchTerritorio = filterTerritorio === "all" || normalizeTerritorioKey(m.cidade) === filterTerritorio;
      return matchSearch && matchEsp && matchTerritorio;
    });
    if (sortOrder === "default") return list;
    return [...list].sort((a, b) => {
      const compare = (a.nome || a.empresa || "").localeCompare(b.nome || b.empresa || "", "pt-BR", { sensitivity: "base" });
      return sortOrder === "az" ? compare : -compare;
    });
  }, [membros, search, filterEspecialidade, filterTerritorio, sortOrder]);

  const hasFilters = search || filterEspecialidade !== "all" || filterTerritorio !== "all" || sortOrder !== "default";
  const opasDestaque = useMemo(
    () => opas
      .filter(o => !o.status || ["ativa", "em_formacao", "em formação"].includes(String(o.status).toLowerCase()))
      .slice(0, 6),
    [opas]
  );
  const parceirosDestaque = useMemo(
    () => membros
      .filter(m => m.id !== membroId)
      .slice(0, 8),
    [membros, membroId]
  );
  const anuncioHero = anunciosAtivos.find(a => a.slot_tipo === "hero");
  const anunciosMenores = anunciosAtivos.filter(a => a.slot_tipo !== "hero").slice(0, 5);

  function clearFilters() {
    setSearch("");
    setFilterEspecialidade("all");
    setFilterTerritorio("all");
    setSortOrder("default");
  }

  function abrirTodosParceiros() {
    clearFilters();
    navigate("/vitrine/parceiros");
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <EnvironmentAccessDialog
        access={blockedAuraAccess}
        open={!!blockedAuraAccess}
        onOpenChange={(open) => !open && setBlockedAuraAccess(null)}
      />

      {/* Header — BIA style */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-vitrine-title">
            <Gem className="w-7 h-7 text-yellow-400" />
            {isParceirosPage ? "Parceiros de mercado" : "BUILT Vitrine"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isParceirosPage ? "Explore todos os parceiros publicados na BUILT Vitrine" : "Encontre fornecedores e profissionais do mercado imobiliário"}
            {hasFilters && ` · ${filtered.length} exibindo`}
          </p>
        </div>

        {isParceirosPage && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/vitrine")}>
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            Voltar para Vitrine
          </Button>
        )}

        {!isParceirosPage && membroId && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Destaque button */}
            <Button
              size="sm"
              onClick={openAnuncioCreate}
              className="gap-2 bg-blue-600 font-semibold text-white hover:bg-blue-700"
              data-testid="btn-anunciar"
            >
              <Megaphone className="w-3.5 h-3.5" />
              {meusAnuncios.length > 0 ? `+ Novo destaque` : "Criar destaque"}
            </Button>
          </div>
        )}
      </div>

      {!isParceirosPage && (
      <>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* World Map */}
        {isLoading ? (
          <Skeleton className="aspect-[16/9] max-h-[360px] rounded-2xl" />
        ) : vitrineLoadError ? (
          <div className="aspect-[16/9] max-h-[360px] rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 flex flex-col items-center justify-center">
            <p className="text-sm font-semibold">Falha ao carregar o banco de dados</p>
            <p className="mt-1 text-xs text-red-600">A conexão com o Directus está indisponível.</p>
          </div>
        ) : (
          <WorldMapHeader membros={membros} />
        )}

        <AnuncioHeroCard
          anuncio={anuncioHero}
          isOwn={Boolean(anuncioHero && (isSuperAdmin || anuncioHero.membro_id === membroId))}
          onCreate={openAnuncioCreate}
          onEdit={openAnuncioEdit}
          onCancel={() => anuncioHero && cancelarAnuncioMutation.mutate(anuncioHero.id)}
        />
      </div>

      {/* ===== DESTAQUES DA VITRINE ===== */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-foreground">Destaques da Vitrine</h2>
          </div>
          <div className="flex-1 h-px bg-blue-200" />
          <span className="text-[10px] font-mono text-muted-foreground">{Math.min(anunciosMenores.length, 5)}/5 em exibição</span>
        </div>
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
          data-testid="grid-anuncios-destaque"
        >
          {anunciosMenores.map(a => (
            <div key={a.id} className="min-w-0">
              <AnuncioCard
                anuncio={a}
                isOwn={isSuperAdmin || a.membro_id === membroId}
                onEdit={openAnuncioEdit}
                onCancel={() => cancelarAnuncioMutation.mutate(a.id)}
              />
            </div>
          ))}
          {Array.from({ length: Math.max(0, 5 - anunciosMenores.length) }).map((_, i) => (
            <div
              key={`slot-${i}`}
              onClick={membroId ? openAnuncioCreate : undefined}
              className="relative min-w-0 rounded-xl overflow-hidden flex flex-col items-center justify-center gap-3 group transition-all duration-200"
              style={{
                aspectRatio: "1/1",
                border: "1.5px solid rgba(37,99,235,0.35)",
                background: "rgba(255,255,255,0.97)",
                cursor: membroId ? "pointer" : "default",
                boxShadow: "0 2px 12px rgba(37,99,235,0.1)",
              }}
              data-testid={`slot-anuncio-vazio-${i}`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.28)" }}>
                  <Megaphone className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-center"
                  style={{ color: "#001D34", letterSpacing: "0.12em" }}>
                  Espaço disponível
                </p>
                {membroId && (
                  <span className="text-[10px] font-mono text-center transition-colors duration-200"
                    style={{ color: "rgba(0,29,52,0.5)" }}>
                    Clique para destacar
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meus agendamentos — só visível para o próprio membro */}
      {/* ===== OPAS EM DESTAQUE ===== */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-foreground">OPAs em destaque</h2>
          </div>
          <div className="flex-1 h-px bg-border" />
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => navigate("/vitrine/oportunidades")}>
            Ver todas as oportunidades
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <HorizontalCarousel testId="carousel-opas-destaque">
          {opasDestaque.length > 0 ? opasDestaque.map(opa => (
            <OpaDestaqueCard
              key={opa.id}
              opa={opa}
              onOpen={() => navigate(getVitrineOpaUrl(
                opa,
                opa.bia_id ? minhasBias.find((bia) => bia.id === opa.bia_id) : undefined,
                opas,
              ))}
            />
          )) : (
            <div className="w-full rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma OPA em destaque no momento.
            </div>
          )}
        </HorizontalCarousel>
      </section>

      {/* ===== PARCEIROS EM DESTAQUE ===== */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-foreground">Parceiros de mercado em destaque</h2>
          </div>
          <div className="flex-1 h-px bg-border" />
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={abrirTodosParceiros}>
            Ver todos os parceiros
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <HorizontalCarousel testId="carousel-parceiros-destaque">
          {parceirosDestaque.map(m => (
            <ParceiroDestaqueCard key={m.id} membro={m} onOpen={() => navigate(`/vitrine/${m.id}`)} />
          ))}
        </HorizontalCarousel>
      </section>

      {membroId && meusAnuncios.length > 0 && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ background: "rgba(215,187,125,0.03)", border: "1px solid rgba(215,187,125,0.12)" }}>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-brand-gold/50" />
            <span className="text-xs font-mono text-brand-gold/60 uppercase tracking-wider">
              Meus agendamentos ({meusAnuncios.length})
            </span>
          </div>
          {ultimoPagamentoAnuncio?.url && (
            <div
              className="flex flex-col gap-3 rounded-lg px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ background: "rgba(215,187,125,0.07)", border: "1px solid rgba(215,187,125,0.22)" }}
            >
              <div className="min-w-0">
                <p className="text-xs font-mono text-brand-gold/80">Pagamento do destaque gerado</p>
                <p className="text-[10px] font-mono text-white/35">
                  Após o pagamento, o sistema agenda 15 dias completos na próxima vaga disponível.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2 border-brand-gold/30 text-brand-gold/80 hover:bg-brand-gold/10 hover:text-brand-gold"
                onClick={() => ultimoPagamentoAnuncio?.url && window.open(ultimoPagamentoAnuncio.url, "_blank", "noopener,noreferrer")}
                data-testid="btn-abrir-ultimo-pagamento-anuncio"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir pagamento
              </Button>
            </div>
          )}
          <div className="space-y-2">
            {meusAnuncios.map(a => {
              const today = new Date().toISOString().slice(0, 10);
              const isAtivo = a.data_inicio <= today && a.data_fim >= today;
              const isFuturo = a.data_inicio > today;
              const isPagamentoPendente = a.pagamento_status === "pendente";
              return (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {a.imagem_url ? (
                    <img src={versionAssetUrl(a.imagem_url) || ""} alt="" className="w-10 h-7 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-7 rounded shrink-0 flex items-center justify-center"
                      style={{ background: "rgba(215,187,125,0.08)", border: "1px solid rgba(215,187,125,0.15)" }}>
                      <Megaphone className="w-3 h-3 text-brand-gold/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-white/60">
                      {isPagamentoPendente ? "Estimativa: " : ""}{a.data_inicio} → {a.data_fim}
                    </p>
                    {isPagamentoPendente && (
                      <p className="text-[10px] text-white/30 font-mono truncate">
                        O período final será definido após o pagamento.
                      </p>
                    )}
                    {a.link && (
                      <p className="text-[10px] text-white/30 font-mono truncate">{a.link}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: isAtivo ? "rgba(74,222,128,0.1)" : isPagamentoPendente ? "rgba(251,191,36,0.1)" : "rgba(215,187,125,0.08)",
                      border: `1px solid ${isAtivo ? "rgba(74,222,128,0.3)" : isPagamentoPendente ? "rgba(251,191,36,0.28)" : "rgba(215,187,125,0.2)"}`,
                      color: isAtivo ? "rgba(74,222,128,0.8)" : isPagamentoPendente ? "rgba(251,191,36,0.85)" : "rgba(215,187,125,0.6)",
                    }}>
                    {isPagamentoPendente ? "Pagamento pendente" : isAtivo ? "Ativo" : isFuturo ? "Agendado" : "Encerrado"}
                  </span>
                  {isPagamentoPendente && a.pagamento_url && (
                    <button
                      onClick={() => window.open(a.pagamento_url!, "_blank", "noopener,noreferrer")}
                      className="h-6 rounded px-2 text-[10px] font-mono text-brand-gold/70 transition-colors hover:bg-brand-gold/10"
                      style={{ border: "1px solid rgba(215,187,125,0.2)" }}
                      data-testid={`btn-abrir-pagamento-anuncio-${a.id}`}
                    >
                      Abrir pagamento
                    </button>
                  )}
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
      </>
      )}

      {/* Filters */}
      {isParceirosPage && (
      <>
      <div id="todos-parceiros" className="flex flex-wrap items-center gap-3 scroll-mt-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa ou especialidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-background border-border text-foreground placeholder:text-muted-foreground"
            data-testid="input-vitrine-search"
          />
        </div>

        <Select value={filterEspecialidade} onValueChange={setFilterEspecialidade}>
          <SelectTrigger className="w-44 h-9 text-sm bg-background border-border text-foreground" data-testid="select-vitrine-especialidade">
            <SelectValue placeholder="Ramo de atuação" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem value="all">Todos ramos</SelectItem>
            {especialidades.map(e => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTerritorio} onValueChange={setFilterTerritorio}>
          <SelectTrigger className="w-40 h-9 text-sm bg-background border-border text-foreground" data-testid="select-vitrine-territorio">
            <SelectValue placeholder="Território" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem value="all">Todos os territórios</SelectItem>
            {territorios.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "default" | "az" | "za")}>
          <SelectTrigger className="w-36 h-9 text-sm bg-background border-border text-foreground" data-testid="select-vitrine-ordenacao">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem value="default">Ordenar</SelectItem>
            <SelectItem value="az">A-Z</SelectItem>
            <SelectItem value="za">Z-A</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex h-9 rounded-md border border-border overflow-hidden bg-background" aria-label="Modo de visualização">
          <button
            type="button"
            title="Ver em cards"
            onClick={() => setViewMode("grid")}
            className={`w-9 flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-brand-gold text-brand-navy" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            data-testid="btn-vitrine-view-grid"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Ver em lista"
            onClick={() => setViewMode("list")}
            className={`w-9 flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-brand-gold text-brand-navy" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            data-testid="btn-vitrine-view-list"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

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

      {/* Cards / Lista */}
      {isLoading ? (
        <div className={viewMode === "list" ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}>
          {[...Array(8)].map((_, i) => <Skeleton key={i} className={viewMode === "list" ? "h-24 rounded-xl" : "h-52 rounded-xl"} />)}
        </div>
      ) : vitrineLoadError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
          <Store className="w-12 h-12 text-red-300 mb-4" />
          <p className="text-sm font-semibold text-red-700">Falha ao carregar parceiros da Vitrine</p>
          <p className="mt-1 max-w-lg text-xs text-red-600">
            Os dados não foram apagados. O servidor local não está conseguindo acessar o Directus.
          </p>
          {vitrineLoadErrorInfo instanceof Error && (
            <p className="mt-3 max-w-lg text-xs font-mono text-red-500">{vitrineLoadErrorInfo.message}</p>
          )}
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
        viewMode === "list" ? (
          <div className="space-y-3">
            {filtered.map(m => (
              <MembroListItem
                key={m.id}
                membro={m}
                isOwn={m.id === membroId}
                showAuraCta={showAuraCta}
                canOpenAura={canUseAuraRegistration}
                canRegisterAura={canRegisterAuraForMember({
                  user,
                  targetMemberId: m.id,
                  linkedMemberIds: auraLinkedMemberIds,
                })}
                onAuraBlocked={() => setBlockedAuraAccess(environmentAccessFor(user, "alliances"))}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(m => (
              <MembroCard
                key={m.id}
                membro={m}
                isOwn={m.id === membroId}
                showAuraCta={showAuraCta}
                canOpenAura={canUseAuraRegistration}
                canRegisterAura={canRegisterAuraForMember({
                  user,
                  targetMemberId: m.id,
                  linkedMemberIds: auraLinkedMemberIds,
                })}
                onAuraBlocked={() => setBlockedAuraAccess(environmentAccessFor(user, "alliances"))}
              />
            ))}
          </div>
        )
      )}
      </>
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
                <PhoneInput
                  value={form.whatsapp}
                  onChange={value => setForm(f => ({ ...f, whatsapp: value }))}
                  className="bg-white/5 border-white/10"
                  inputClassName="text-white placeholder:text-white/20"
                  selectClassName="bg-[#071a2d] text-white border-white/10"
                  placeholder="99999-9999"
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

      {/* ===== DESTAQUE DIALOG ===== */}
      <Dialog open={anuncioDialogOpen} onOpenChange={setAnuncioDialogOpen}>
        <DialogContent
          className="max-w-xl border-brand-gold/20 text-white"
          style={{ background: "#050f1c" }}
        >
          <DialogHeader>
            <DialogTitle className="font-mono text-brand-gold text-base flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              {anuncioEditMode ? "Editar destaque" : "Criar destaque"}
            </DialogTitle>
            <p className="text-xs text-white/40 font-mono mt-1">
              {anuncioEditMode
                ?
                "Atualize as informações do seu destaque. O período não pode ser alterado."
                : "Preencha os dados. O destaque terá 15 dias completos após o pagamento."}
            </p>
          </DialogHeader>

            <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            {/* Tipo de slot */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/40 font-mono">Tipo de destaque</label>
              <Select
                value={anuncioSlotTipo}
                onValueChange={(value) => {
                  setAnuncioSlotTipo(value === "hero" ? "hero" : "padrao");
                }}
                disabled={anuncioEditMode}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-blue-500/60" data-testid="select-anuncio-slot-tipo">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-[#001428] border-white/10 text-white">
                  <SelectItem value="padrao">Destaque padrão (5 vagas)</SelectItem>
                  <SelectItem value="hero">Destaque maior (1 vaga)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Título */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/40 font-mono">Título do destaque (opcional)</label>
              <Input
                value={anuncioForm.titulo}
                onChange={e => setAnuncioForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Destaque sua empresa na BUILT Vitrine"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-blue-500/60"
                data-testid="input-anuncio-titulo"
              />
            </div>

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
                Tamanho recomendado:{" "}
                <span className="text-brand-gold/40">
                  {anuncioSlotTipo === "hero" ? "1600 x 900 px (16:9)" : "1200 x 1200 px"}
                </span>{" "}
                &nbsp;·&nbsp; PNG, JPG ou WebP &nbsp;·&nbsp; máx. 5 MB
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
                  <span className="text-xs font-mono text-brand-gold/60">Período do destaque</span>
                </div>
                <p className="text-[11px] text-white/40 font-mono leading-relaxed">
                  {isSuperAdmin
                    ? "O destaque será publicado por 15 dias completos. Se o espaço imediato estiver cheio, ele será agendado para a próxima vaga disponível."
                    : "O destaque ficará ativo por 15 dias após a confirmação do pagamento. Se a Vitrine estiver cheia, ele será agendado para a próxima vaga disponível."}
                </p>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(215,187,125,0.08)", border: "1px solid rgba(215,187,125,0.2)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold/70" />
                  <span className="text-xs font-mono text-brand-gold/70">
                    Duração garantida: 15 dias corridos
                  </span>
                </div>
              </div>
            )}

            {!anuncioEditMode && !isSuperAdmin && (
              <div className="rounded-xl p-4 space-y-3"
                style={{ background: "rgba(215,187,125,0.04)", border: "1px solid rgba(215,187,125,0.16)" }}>
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-brand-gold/50" />
                  <span className="text-xs font-mono text-brand-gold/60">Pagamento do destaque</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                  <Select
                    value={anuncioPagamentoPais}
                    onValueChange={(value) => setAnuncioPagamentoPais(value as "brasil" | "exterior")}
                  >
                    <SelectTrigger
                      className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                      data-testid="select-anuncio-pagamento"
                    >
                      <SelectValue placeholder="Local do pagamento" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#001428] border-white/10 text-white">
                      <SelectItem value="brasil">Brasil</SelectItem>
                      <SelectItem value="exterior">Fora do Brasil</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-mono text-white/35">
                    <ExternalLink className="w-3.5 h-3.5 text-brand-gold/45" />
                    O link será gerado ao confirmar
                  </div>
                </div>

                <label className="hidden" data-testid="checkbox-pagamento-anuncio">
                  <div
                    onClick={() => setAnuncioPagamentoConfirmado(v => !v)}
                    className="mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-all cursor-pointer"
                    style={{
                      background: anuncioPagamentoConfirmado ? "rgba(215,187,125,0.9)" : "rgba(255,255,255,0.04)",
                      borderColor: anuncioPagamentoConfirmado ? "rgba(215,187,125,0.9)" : "rgba(255,255,255,0.15)",
                    }}
                  >
                    {anuncioPagamentoConfirmado && <Check className="w-2.5 h-2.5 text-[#001D34]" />}
                  </div>
                  <span
                    className="text-[11px] font-mono leading-relaxed select-none transition-colors"
                    style={{ color: anuncioPagamentoConfirmado ? "rgba(215,187,125,0.8)" : "rgba(255,255,255,0.35)" }}
                    onClick={() => setAnuncioPagamentoConfirmado(v => !v)}
                  >
                    Já realizei o pagamento do destaque e quero publicar.
                  </span>
                </label>
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
                    Declaro, sob minha exclusiva responsabilidade, que o destaque publicado no BUILT Vitrine está associado ao meu negócio, é lícito, verdadeiro, verificável e não viola direitos de terceiros, assumindo integral responsabilidade civil, comercial, regulatória e autoral pelo seu conteúdo, bem como por quaisquer reclamações, danos ou sanções dele decorrentes. Reconheço que a BUILT atua apenas como plataforma de veiculação e conexão, não sendo responsável pela oferta destacada nem pelas relações comerciais dela resultantes.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  {[
                    { key: "t1" as const, label: "Tenho autorização para usar todas as imagens, marcas e conteúdos do destaque." },
                    { key: "t2" as const, label: "As informações do destaque são verdadeiras e podem ser comprovadas." },
                    { key: "t3" as const, label: "Reconheço que a BUILT não garante nem responde pela oferta destacada." },
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
                  if (confirm("Cancelar este destaque")) {
                    cancelarAnuncioMutation.mutate(anuncioEditTarget.id);
                    setAnuncioDialogOpen(false);
                  }
                }}
                className="text-red-400/60 hover:text-red-400 hover:bg-red-400/10 font-mono text-xs mr-auto"
                data-testid="btn-cancelar-anuncio"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Cancelar destaque
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
              {anuncioEditMode ? "Salvar alterações" : isSuperAdmin ? "Publicar destaque" : "Gerar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const raw = String(value).trim();
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function brl(value: string | number | null | undefined): string {
  const parsed = num(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function HorizontalCarousel({ children, testId }: { children: React.ReactNode; testId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollButtons() {
    const element = ref.current;
    if (!element) return;
    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const hasOverflow = maxScrollLeft > 4;
    setCanScrollLeft(hasOverflow && element.scrollLeft > 4);
    setCanScrollRight(hasOverflow && element.scrollLeft < maxScrollLeft - 4);
  }

  useEffect(() => {
    updateScrollButtons();
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(element);
    window.addEventListener("resize", updateScrollButtons);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [children]);

  function scroll(direction: "left" | "right") {
    const element = ref.current;
    if (!element) return;
    const amount = Math.max(260, Math.round(element.clientWidth * 0.85));
    element.scrollBy({ left: direction === "right" ? amount : -amount, behavior: "smooth" });
    window.setTimeout(updateScrollButtons, 320);
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={updateScrollButtons}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        data-testid={testId}
      >
        {children}
      </div>
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-md transition hover:bg-muted md:flex"
          aria-label="Ver itens anteriores"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-md transition hover:bg-muted md:flex"
          aria-label="Ver próximos itens"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function OpaDestaqueCard({ opa, onOpen }: { opa: OportunidadeVitrine; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-w-[252px] sm:min-w-[270px] snap-start overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
      data-testid={`card-vitrine-opa-${opa.id}`}
    >
      <div className="relative h-[86px] w-full bg-gradient-to-br from-blue-50 to-slate-100">
        {opa.imagem_url ? (
          <img src={versionAssetUrl(opa.imagem_url) || ""} alt={opa.nome_oportunidade || "OPA"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-blue-500/25">
            <Target className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm">
          Pública
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 px-3.5 pt-3.5">
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
          {opa.tipo || "OPA"}
        </span>
        {opa.status && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            {String(opa.status).replace(/_/g, " ")}
          </span>
        )}
      </div>
      <h3 className="mx-3.5 mt-2.5 line-clamp-2 min-h-[36px] text-[13px] font-semibold text-foreground">
        {opa.nome_oportunidade || "OPA sem nome"}
      </h3>
      <p className="mx-3.5 mt-1.5 line-clamp-1 text-xs text-muted-foreground">{opa.nucleo_alianca || opa.localizacao || "Oportunidade BUILT"}</p>
      <div className="mx-3.5 mb-3.5 mt-3 grid grid-cols-2 gap-3 border-t border-border pt-2.5">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground">Valor</p>
          <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-foreground">{brl(opa.valor_origem_opa)}</p>
        </div>
        <div className="min-w-0 text-right" title="Mínimo Esforço Multiplicador">
          <p className="text-[10px] text-muted-foreground">MEM</p>
          <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-foreground">
            {num(opa.Minimo_esforco_multiplicador) ? `${num(opa.Minimo_esforco_multiplicador).toLocaleString("pt-BR")}%` : "-"}
          </p>
        </div>
      </div>
    </button>
  );
}

function ParceiroDestaqueCard({ membro: m, onOpen }: { membro: MembroVitrine; onOpen: () => void }) {
  const foto = fotoUrl(m);
  const logo = logoEmpresaUrl(m);
  const nome = m.nome || m.empresa || "Parceiro BUILT";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-w-[220px] sm:min-w-[250px] snap-start rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
      data-testid={`card-parceiro-destaque-${m.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-brand-gold/25 bg-muted flex items-center justify-center">
          {foto ? (
            <img src={foto} alt={nome} className="h-full w-full object-cover" style={{ objectPosition: getPhotoObjectPosition(m) }} />
          ) : (
            <span className="text-sm font-semibold text-brand-gold">{getInitials(nome)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{nome}</p>
          <p className="truncate text-xs text-muted-foreground">{m.especialidade || m.cargo || "Parceiro de mercado"}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        {logo ? <img src={logo} alt="" className="h-5 w-9 object-contain" /> : <Building2 className="h-3.5 w-3.5" />}
        <span className="truncate">{m.empresa || "Empresa não informada"}</span>
      </div>
      {m.cidade && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span className="truncate">{m.cidade}</span>
        </div>
      )}
    </button>
  );
}

function MembroListItem({
  membro: m,
  isOwn,
  showAuraCta,
  canOpenAura,
  canRegisterAura,
  onAuraBlocked,
}: {
  membro: MembroVitrine;
  isOwn: boolean;
  showAuraCta: boolean;
  canOpenAura: boolean;
  canRegisterAura: boolean;
  onAuraBlocked: () => void;
}) {
  const foto = fotoUrl(m);
  const logo = logoEmpresaUrl(m);
  const hasProudMember = (m.Outras_redes_as_quais_pertenco || []).includes("BUILT_PROUD_MEMBER");
  const nome = m.nome || "—";
  const [, navigate] = useLocation();
  const canShowAura = !isOwn && showAuraCta;

  function handleOrcamento(e: React.MouseEvent) {
    e.stopPropagation();
    if (m.whatsapp) {
      const digits = m.whatsapp.replace(/\D/g, "");
      const telefone = digits.startsWith("55") ? digits : `55${digits}`;
      window.open(`https://wa.me/${telefone}text=${encodeURIComponent(`Olá ${nome}! Gostaria de solicitar um orçamento.`)}`, "_blank");
      return;
    }
    if (m.email) {
      const assunto = encodeURIComponent("Solicitação de orçamento - BUILT Alliances");
      const corpo = encodeURIComponent(`Olá ${nome}!\n\nGostaria de solicitar um orçamento.`);
      window.open(`mailto:${m.email}subject=${assunto}&body=${corpo}`, "_blank");
    }
  }

  function handleAura(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canOpenAura) {
      onAuraBlocked();
      return;
    }
    navigate(`/aura/${m.id}`);
  }

  return (
    <div
      className="group flex items-center gap-4 rounded-xl border border-border bg-white p-3 shadow-sm transition-all cursor-pointer hover:shadow-md hover:border-primary/35"
      style={{
        borderColor: isOwn ? "rgba(37,99,235,0.35)" : undefined,
      }}
      onClick={() => navigate(`/vitrine/${m.id}`)}
      data-testid={`list-vitrine-${m.id}`}
    >
      <div className="w-14 h-14 rounded-full overflow-hidden border border-border bg-muted/40 flex items-center justify-center shrink-0">
        {foto ? <img src={foto} alt={nome} className="w-full h-full object-cover" style={{ objectPosition: getPhotoObjectPosition(m) }} /> : <span className="text-sm font-bold text-primary">{getInitials(nome)}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-foreground truncate">{nome}</p>
          {hasProudMember && (
            <RedeBadgeButton rede="BUILT_PROUD_MEMBER" height={24} maxWidth={58} testId="badge-list-built_proud_member" />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {m.empresa && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              {logo ? <img src={logo} alt={`Marca ${m.empresa}`} className="h-5 w-10 object-contain" /> : <Building2 className="w-3 h-3" />}
              <span className="truncate max-w-[220px]">{m.empresa}</span>
            </span>
          )}
          {(m.especialidade || m.cargo) && <span className="truncate max-w-[220px]">{m.especialidade || m.cargo}</span>}
          {m.cidade && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {m.cidade}
            </span>
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-3 shrink-0">
        {canShowAura && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAura}
            className="gap-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            data-testid={`btn-list-aura-${m.id}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {canRegisterAura ? "Ver e registrar Aura" : "Ver Aura"}
          </Button>
        )}
        {!isOwn && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOrcamento}
            className="gap-2 border-primary/25 bg-primary/5 text-primary hover:bg-primary/10"
            data-testid={`btn-list-orcamento-${m.id}`}
          >
            <FileText className="w-3.5 h-3.5" />
            Solicitar orçamento
          </Button>
        )}
      </div>
    </div>
  );
}

function MembroCard({
  membro: m,
  isOwn,
  showAuraCta,
  canOpenAura,
  canRegisterAura,
  onAuraBlocked,
}: {
  membro: MembroVitrine;
  isOwn: boolean;
  showAuraCta: boolean;
  canOpenAura: boolean;
  canRegisterAura: boolean;
  onAuraBlocked: () => void;
}) {
  const foto = fotoUrl(m);
  const logo = logoEmpresaUrl(m);
  const hasProudMember = (m.Outras_redes_as_quais_pertenco || []).includes("BUILT_PROUD_MEMBER");
  const nome = m.nome || "—";
  const [, navigate] = useLocation();
  const [orcamentoOpen, setOrcamentoOpen] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const canShowAura = !isOwn && showAuraCta;

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
    window.open(`${wa}text=${encodeURIComponent(texto)}`, "_blank");
    setOrcamentoOpen(false);
    setMensagem("");
  }

  function handleEnviarEmail(e: React.MouseEvent) {
    e.stopPropagation();
    const assunto = encodeURIComponent(`Solicitação de orçamento - BUILT Alliances`);
    const corpo = encodeURIComponent(`Olá ${nome}!\n\nGostaria de solicitar um orçamento.\n\n${mensagem}`);
    window.open(`mailto:${m.email}subject=${assunto}&body=${corpo}`, "_blank");
    setOrcamentoOpen(false);
    setMensagem("");
  }

  function handleAura(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canOpenAura) {
      onAuraBlocked();
      return;
    }
    navigate(`/aura/${m.id}`);
  }

  return (
    <>
      <div
        className="relative rounded-xl border border-border bg-white overflow-hidden group shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer hover:scale-[1.01]"
        style={{
          borderColor: isOwn ? "rgba(37,99,235,0.35)" : undefined,
        }}
        onClick={() => navigate(`/vitrine/${m.id}`)}
        data-testid={`card-vitrine-${m.id}`}
      >
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: isOwn
            ?
            "linear-gradient(90deg, transparent, rgba(37,99,235,0.45), transparent)"
            : "linear-gradient(90deg, transparent, rgba(37,99,235,0.18), transparent)"
          }} />

        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-primary/15" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary/15" />

        {/* Selo principal */}
        {hasProudMember && (
          <div className="absolute top-2 right-2 z-10 flex items-start gap-1">
            <RedeBadgeButton
              rede="BUILT_PROUD_MEMBER"
              height={42}
              maxWidth={86}
              testId="badge-card-built_proud_member"
            />
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Avatar */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/15"
              style={{
                background: foto ? "transparent" : "linear-gradient(135deg, hsl(var(--muted)), hsl(var(--background)))",
                boxShadow: "0 0 0 1px rgba(37,99,235,0.08)",
              }}
            >
              {foto ? (
                <img src={foto} alt={nome} className="w-full h-full object-cover" style={{ objectPosition: getPhotoObjectPosition(m) }} />
              ) : (
                <span className="text-xl font-bold text-primary">{getInitials(nome)}</span>
              )}
            </div>
          </div>

          {/* Name + info */}
          <div className="text-center space-y-1.5">
            <p className="text-sm font-semibold text-foreground leading-tight">{nome}</p>

            {m.especialidade && (
              <p className="text-xs text-muted-foreground truncate">{m.especialidade}</p>
            )}

            {m.empresa && (
              <div className="flex items-center justify-center gap-2 min-w-0">
                {logo ? (
                  <span className="flex h-7 w-12 shrink-0 items-center justify-center">
                    <img src={logo} alt={`Marca ${m.empresa}`} className="max-h-full max-w-full object-contain drop-shadow-sm" />
                  </span>
                ) : (
                  <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs text-muted-foreground truncate">{m.empresa}</span>
              </div>
            )}

            {m.cidade && (
              <div className="flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">{m.cidade}</span>
              </div>
            )}

            {m.link_site && (
              <a
                href={m.link_site.startsWith("http") ? m.link_site : `https://${m.link_site}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center justify-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                data-testid={`link-site-${m.id}`}
              >
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">
                  {m.link_site.replace(/^https:\/\/(www\.)/, "")}
                </span>
              </a>
            )}
          </div>

          {/* Actions — only for other members */}
          {!isOwn && (
            <>
              <div className="h-px bg-border" />
              {canShowAura && (
                <button
                  type="button"
                  onClick={handleAura}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                  data-testid={`btn-card-aura-${m.id}`}
                >
                  <Sparkles className="w-3 h-3" />
                  {canRegisterAura ? "Ver e registrar Aura" : "Ver Aura"}
                </button>
              )}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setMensagem(""); setOrcamentoOpen(true); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/35"
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
