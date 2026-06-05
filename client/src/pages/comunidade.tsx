import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { capitalizeWords } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import {
  MessageCircle, Plus, Pencil, Trash2, Search, Users,
  Briefcase, MapPin, Shield, ChevronRight, Loader2, X,
  Navigation, Globe, UserCheck, UserX, Bell, Clock,
  Eye, FileText, Phone, Mail, Building, Calendar, Hash,
  Ticket, Link2, CheckCircle, XCircle, Copy, Sparkles, Target,
  Bot, Tags, Paperclip, Mic, Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapWheelGuard } from "@/components/map-wheel-guard";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from "react-simple-maps";

const WORLD_GEO = "/world-countries-50m.json";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

function abbrevTerritory(nome: string): string {
  const words = nome.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map(w => w[0]).join("").slice(0, 4).toUpperCase();
  }
  return nome.replace(/[aeiouAEIOU\s]/g, "").slice(0, 3).toUpperCase() ||
    nome.slice(0, 3).toUpperCase();
}

const COUNTRY_CODES: Record<string, string> = {
  "brasil": "BR", "brazil": "BR",
  "portugal": "PT",
  "estados unidos": "US", "eua": "US", "usa": "US",
  "argentina": "AR",
  "chile": "CL",
  "colombia": "CO",
  "mexico": "MX", "méxico": "MX",
  "peru": "PE",
  "uruguai": "UY",
  "paraguai": "PY",
  "bolívia": "BO", "bolivia": "BO",
  "espanha": "ES",
  "alemanha": "DE",
  "frança": "FR", "franca": "FR",
  "itália": "IT", "italia": "IT",
  "reino unido": "GB",
  "canada": "CA", "canadá": "CA",
  "austrália": "AU", "australia": "AU",
  "japão": "JP", "japao": "JP",
  "china": "CN",
  "angola": "AO",
  "moçambique": "MZ", "mocambique": "MZ",
  "cabo verde": "CV",
};

function abbrevCountry(nome: string): string {
  const key = nome.toLowerCase().trim();
  if (COUNTRY_CODES[key]) return COUNTRY_CODES[key];
  const words = nome.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return nome.replace(/[aeiouAEIOU\s]/g, "").slice(0, 2).toUpperCase() ||
    nome.slice(0, 2).toUpperCase();
}

function ComunidadeLocationPickerModal({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (pais: string, siglaPais: string, territorio: string, siglaTerritorio: string) => void;
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
    const addr = selected.address || {};
    const pais = (addr.country || "").trim();
    const siglaPais = (addr.country_code || "").toUpperCase().slice(0, 2).trim();
    const territorio = (addr.city || addr.town || addr.village || addr.municipality ||
      addr.county || addr.state || selected.display_name.split(",")[0]).trim();
    const siglaTerritorio = abbrevTerritory(territorio);
    onSelect(pais, siglaPais, territorio, siglaTerritorio);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg" style={{ background: "#001428", border: "1px solid rgba(215,187,125,0.2)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-brand-gold">
            <Navigation className="w-5 h-5 text-brand-gold" />
            Selecionar Território
          </DialogTitle>
          <DialogDescription className="text-white/40 text-xs">
            Pesquise uma cidade ou região — os campos País e Território serão preenchidos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Ex: Belo Horizonte, São Paulo, Lisboa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/20"
            data-testid="input-comunidade-location-search"
            autoFocus
          />
          <Button
            onClick={handleSearch}
            disabled={loading || !search.trim()}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90 shrink-0"
            data-testid="btn-comunidade-search-location"
          >
            {loading ?<Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {results.length > 0 && (
          <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
            {results.map((r) => {
              const addr = r.address || {};
              const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || r.display_name.split(",")[0];
              return (
                <button
                  key={r.place_id}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${selected?.place_id === r.place_id ?"bg-brand-gold/20 border border-brand-gold/40" : "hover:bg-white/5 border border-transparent"}`}
                  data-testid={`comunidade-location-result-${r.place_id}`}
                >
                  <p className="font-medium text-white leading-tight">{city}</p>
                  <p className="text-xs text-white/40 mt-0.5 truncate">{r.display_name}</p>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="rounded-xl border border-brand-gold/30 p-3" style={{ background: "rgba(215,187,125,0.07)" }}>
            <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest mb-1.5">Localização selecionada</p>
            <p className="text-sm text-white font-medium">{selected.display_name}</p>
            <div className="flex gap-4 mt-2 text-xs text-white/50 font-mono">
              {selected.address?.country && <span>ðŸŒŽ {selected.address.country}</span>}
              {(selected.address?.city || selected.address?.town) && (
                <span>ðŸ“ {selected.address.city || selected.address.town}</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/50 hover:text-white">Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90"
            data-testid="btn-comunidade-confirm-location"
          >
            <Globe className="w-4 h-4 mr-1.5" />
            Usar esta localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Membro { id: string; nome?: string; cargo?: string; empresa?: string; foto_perfil?: string | null; }
interface Bia { id: string; nome_bia?: string; }

// M2M junction shapes returned by Directus
interface MembroJunction { cadastro_geral_id: Membro | string | null; }
interface BiaJunction { bias_projetos_id: Bia | string | null; }

interface Comunidade {
  id: string;
  nome?: string;
  sigla?: string;
  pais?: string;
  sigla_pais?: string;
  territorio?: string;
  sigla_territorio?: string;
  codigo_sequencial?: string;
  // M2O
  aliado?: Membro | string | null;
  // M2M
  membros?: MembroJunction[];
  bias?: BiaJunction[];
  status?: string;
  date_created?: string;
  latitude?: number | null;
  longitude?: number | null;
}

// Helpers to extract objects from M2O/M2M fields
function resolveAliado(c: Comunidade): Membro | null {
  if (!c.aliado) return null;
  if (typeof c.aliado === "string") return null;
  return c.aliado as Membro;
}
function resolveMembros(c: Comunidade): Membro[] {
  return (c.membros || []).map(j => {
    const m = j.cadastro_geral_id;
    if (!m || typeof m === "string") return null;
    return m as Membro;
  }).filter(Boolean) as Membro[];
}
function resolveBias(c: Comunidade): Bia[] {
  return (c.bias || []).map(j => {
    const b = j.bias_projetos_id;
    if (!b || typeof b === "string") return null;
    return b as Bia;
  }).filter(Boolean) as Bia[];
}
function resolveAliadoId(c: Comunidade): string {
  if (!c.aliado) return "";
  if (typeof c.aliado === "string") return c.aliado;
  return (c.aliado as Membro).id || "";
}
function resolveMembrosIds(c: Comunidade): string[] {
  return (c.membros || []).map(j => {
    const m = j.cadastro_geral_id;
    if (!m) return null;
    if (typeof m === "string") return m;
    return (m as Membro).id || null;
  }).filter(Boolean) as string[];
}
function resolveBiasIds(c: Comunidade): string[] {
  return (c.bias || []).map(j => {
    const b = j.bias_projetos_id;
    if (!b) return null;
    if (typeof b === "string") return b;
    return (b as Bia).id || null;
  }).filter(Boolean) as string[];
}

interface ComunidadeForm {
  pais: string;
  sigla_pais: string;
  territorio: string;
  sigla_territorio: string;
  codigo_sequencial: string;
  nome: string;
  sigla: string;
  aliado_id: string;
  membros_ids: string[];
  bias_ids: string[];
  status: string;
}

const emptyForm = (): ComunidadeForm => ({
  pais: "",
  sigla_pais: "",
  territorio: "",
  sigla_territorio: "",
  codigo_sequencial: "",
  nome: "",
  sigla: "",
  aliado_id: "",
  membros_ids: [],
  bias_ids: [],
  status: "ativa",
});

function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=64&height=64&fit=cover`;
}
function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function normalizeLocationKey(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMMUNITY_COORDS: Record<string, [number, number]> = {
  "belo horizonte": [-43.9378, -19.9208],
  "cachoeiro de itapemirim": [-41.1129, -20.8489],
  "descoberto": [-42.9672, -21.4594],
  "espinho": [-8.6414, 41.0076],
  "gramado": [-50.8764, -29.3788],
  "juiz de fora": [-43.3503, -21.7622],
  "porto": [-8.6291, 41.1579],
  "porto velho": [-63.9039, -8.7619],
  "rio meao": [-8.5826, 40.9582],
  "salvador": [-38.5014, -12.9777],
  "sao paulo": [-46.6333, -23.5505],
  "serra": [-40.3078, -20.1286],
  "toquio": [139.6917, 35.6895],
  "tokyo": [139.6917, 35.6895],
  "vila velha": [-40.2925, -20.3297],
  "vitoria": [-40.2958, -20.2976],
};

function comunidadeCoordinates(c: Comunidade): [number, number] | null {
  const lat = c.latitude != null ? Number(c.latitude) : NaN;
  const lng = c.longitude != null ? Number(c.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lng, lat];
  const territoryKey = normalizeLocationKey(c.territorio);
  if (COMMUNITY_COORDS[territoryKey]) return COMMUNITY_COORDS[territoryKey];
  const nameKey = normalizeLocationKey(c.nome);
  const matched = Object.keys(COMMUNITY_COORDS).find((key) => nameKey.includes(key));
  return matched ? COMMUNITY_COORDS[matched] : null;
}

function ComunidadesMapHeader({ comunidades }: { comunidades: Comunidade[] }) {
  const [, navigate] = useLocation();
  const [hovered, setHovered] = useState<Comunidade | null>(null);
  const [zoom, setZoom] = useState(1.4);
  const [center, setCenter] = useState<[number, number]>([-45, -12]);

  const mapped = useMemo(
    () => comunidades
      .map((comunidade) => ({ comunidade, coordinates: comunidadeCoordinates(comunidade) }))
      .filter((item): item is { comunidade: Comunidade; coordinates: [number, number] } => !!item.coordinates),
    [comunidades]
  );

  const clusters = useMemo(() => {
    const threshold = 1.2;
    const result: { center: [number, number]; items: Comunidade[] }[] = [];
    for (const item of mapped) {
      const [lng, lat] = item.coordinates;
      const existing = result.find(
        (cluster) => Math.abs(cluster.center[0] - lng) < threshold && Math.abs(cluster.center[1] - lat) < threshold
      );
      if (existing) existing.items.push(item.comunidade);
      else result.push({ center: [lng, lat], items: [item.comunidade] });
    }
    return result;
  }, [mapped]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-brand-gold/25"
      style={{ height: 360, background: "radial-gradient(ellipse at 50% 110%, #001428 0%, #000c1f 55%, #000408 100%)" }}
      data-testid="mapa-comunidades"
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(215,187,125,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.05) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />

      <div className="absolute top-5 left-6 z-20">
        <p className="text-[10px] text-cyan-300/60 tracking-[0.35em] uppercase font-mono">// BUILT Alliances</p>
        <h2 className="text-xl font-bold tracking-[0.12em] font-mono mt-0.5 text-cyan-300">
          MAPA DE COMUNIDADES
        </h2>
      </div>

      <div className="absolute top-5 right-6 z-20 text-right font-mono">
        <p className="text-[9px] text-cyan-300/50 tracking-widest uppercase">Comunidades</p>
        <p className="text-4xl font-bold leading-none text-cyan-300">{comunidades.length}</p>
        <p className="text-[9px] text-cyan-300/35 mt-2">{mapped.length} geolocalizadas</p>
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.5, 16))}
          className="w-7 h-7 flex items-center justify-center rounded border font-mono text-sm font-bold transition-colors"
          style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(215,187,125,0.3)", color: "#D7BB7D" }}
          title="Ampliar"
        >+</button>
        <button
          onClick={() => { setZoom(1.4); setCenter([-45, -12]); }}
          className="w-7 h-7 flex items-center justify-center rounded border font-mono text-[9px] font-bold transition-colors"
          style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(215,187,125,0.2)", color: "#D7BB7D80" }}
          title="Resetar"
        >⊙</button>
        <button
          onClick={() => setZoom((z) => Math.max(z / 1.5, 1))}
          className="w-7 h-7 flex items-center justify-center rounded border font-mono text-sm font-bold transition-colors"
          style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(215,187,125,0.3)", color: "#D7BB7D" }}
          title="Reduzir"
        >−</button>
      </div>

      <MapWheelGuard>
        <ComposableMap projection="geoMercator" projectionConfig={{ center: [0, 10], scale: 160 }} style={{ width: "100%", height: "100%" }}>
        <ZoomableGroup
          zoom={zoom}
          center={center}
          minZoom={1}
          maxZoom={16}
          onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates); setZoom(z); }}
        >
          <Geographies geography={WORLD_GEO}>
            {({ geographies }) => geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: { fill: "#011630", stroke: "#D7BB7D28", strokeWidth: 0.3, outline: "none" },
                  hover: { fill: "#011630", stroke: "#D7BB7D28", strokeWidth: 0.3, outline: "none" },
                  pressed: { fill: "#011630", outline: "none" },
                }}
              />
            ))}
          </Geographies>

          {clusters.map((cluster, index) => {
            const isMulti = cluster.items.length > 1;
            const r = Math.max(2, 5 / zoom);
            return (
              <Marker
                key={`${cluster.center.join(",")}-${index}`}
                coordinates={cluster.center}
                onMouseEnter={() => setHovered(cluster.items[0])}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (isMulti) return;
                  navigate(`/comunidade/${cluster.items[0].id}`);
                }}
              >
                <g style={{ cursor: isMulti ? "default" : "pointer" }}>
                  <circle r={r * 4} fill="#D7BB7D" fillOpacity={0.08}>
                    <animate attributeName="r" from={r * 2.8} to={r * 5} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.35" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle r={r * 2.25} fill="#001D34" stroke="#D7BB7D" strokeWidth={r * 0.35} strokeOpacity={0.75} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.25} fontWeight="bold" fontFamily="monospace" fill="#D7BB7D">
                    {isMulti ? cluster.items.length : "C"}
                  </text>
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
        </ComposableMap>
      </MapWheelGuard>

      {hovered && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,8,18,0.92) 0%, transparent 100%)", padding: "28px 24px 14px" }}
        >
          <div className="font-mono">
            <p className="text-[9px] text-brand-gold/40 tracking-[0.3em] uppercase">Comunidade</p>
            <p className="text-sm font-bold text-brand-gold mt-0.5">{hovered.nome || hovered.sigla || "Comunidade BUILT"}</p>
            <p className="text-[11px] text-brand-gold/55 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {[hovered.territorio, hovered.pais].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
      )}

      {comunidades.length > 0 && mapped.length === 0 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <p className="text-[10px] text-brand-gold/30 font-mono tracking-wider">
            Adicione território às comunidades para visualizar no mapa
          </p>
        </div>
      )}
    </div>
  );
}

function CandidatoAuraBadge({ membroId }: { membroId?: string | null }) {
  const { data } = useQuery<{ score: number | null; count: number }>({
    queryKey: ["/api/aura/score", membroId],
    queryFn: () => fetch(`/api/aura/score/${membroId}`).then(r => r.json()),
    enabled: !!membroId,
  });
  if (!membroId || !data || data.count < 1) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold border border-violet-400/30 bg-violet-400/10 text-violet-300">
      <Sparkles className="w-2 h-2" />
      {data.score !== null ?Number(data.score).toFixed(1) : "—"}
    </span>
  );
}

function candidateValue(value: any) {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

function CandidateInfoPanel({
  convite,
  compact = false,
}: {
  convite: any;
  compact?: boolean;
}) {
  const dados = (convite?.dados_contratuais || {}) as any;
  const rows = [
    ["Nome completo", dados.nome_completo || convite?.candidato_nome],
    ["CPF", dados.cpf || dados.cpf_cnpj],
    ["Nome da empresa", dados.nome_empresa || dados.empresa],
    ["CNPJ", dados.cnpj],
    ["Telefone", dados.telefone],
    ["E-mail", dados.email || convite?.candidato_email],
    ["Endereço", dados.endereco],
    ["Cidade", dados.cidade],
    ["Estado", dados.estado],
    ["País", dados.pais],
  ];
  const visibleRows = rows.filter(([, value]) => candidateValue(value) !== "—");

  if (visibleRows.length === 0 && !dados.mensagem) return null;

  return (
    <div
      className={`rounded-xl border border-brand-gold/15 ${compact ?"mt-3 p-3" : "p-4"} space-y-3`}
      style={{ background: "rgba(215,187,125,0.045)" }}
    >
      <div className="flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-brand-gold/60" />
        <p className="text-[10px] font-mono text-brand-gold/60 uppercase tracking-widest">Dados da candidatura</p>
      </div>
      {visibleRows.length > 0 && (
        <div className={`grid grid-cols-1 ${compact ?"sm:grid-cols-2" : "sm:grid-cols-2"} gap-2`}>
          {visibleRows.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2">
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30">{label}</p>
              <p className="mt-0.5 text-xs font-mono text-white/75 break-words">{candidateValue(value)}</p>
            </div>
          ))}
        </div>
      )}
      {dados.mensagem && (
        <div className="rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2">
          <p className="text-[9px] font-mono uppercase tracking-widest text-white/30">Mensagem</p>
          <p className="mt-1 text-xs font-mono text-white/65 italic leading-relaxed break-words">"{dados.mensagem}"</p>
        </div>
      )}
    </div>
  );
}

interface ComunidadePageProps {
  convitesOnly?: boolean;
}

export default function ComunidadePage({ convitesOnly = false }: ComunidadePageProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"comunidades" | "convites">(convitesOnly ?"convites" : "comunidades");
  const [notificacoesTab, setNotificacoesTab] = useState<"aprovacoes" | "chamadas" | "opas">("aprovacoes");
  const [aprovacoesSearch, setAprovacoesSearch] = useState("");
  const [mostrarHistoricoAprovacoes, setMostrarHistoricoAprovacoes] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Comunidade | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Comunidade | null>(null);
  const [form, setForm] = useState<ComunidadeForm>(emptyForm());
  const [membrosSearch, setMembrosSearch] = useState("");
  const [biasSearch, setBiasSearch] = useState("");
  const [codigoLoading, setCodigoLoading] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [selectedConvite, setSelectedConvite] = useState<any | null>(null);

  useEffect(() => {
    setActiveTab(convitesOnly ?"convites" : "comunidades");
  }, [convitesOnly]);

  const { data: comunidades = [], isLoading } = useQuery<Comunidade[]>({
    queryKey: ["/api/comunidades"],
    queryFn: () => fetch("/api/comunidades").then(r => { if (!r.ok) throw new Error("Erro ao buscar comunidades"); return r.json(); }),
  });

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
    queryFn: () => fetch("/api/membros").then(r => { if (!r.ok) throw new Error("Erro ao buscar membros"); return r.json(); }),
  });

  const { data: bias = [] } = useQuery<Bia[]>({
    queryKey: ["/api/bias"],
    queryFn: () => fetch("/api/bias").then(r => { if (!r.ok) throw new Error("Erro ao buscar BIAs"); return r.json(); }),
  });

  const { data: opasNotificacoes = [] } = useQuery<any[]>({
    queryKey: ["/api/oportunidades"],
    enabled: convitesOnly || activeTab === "convites",
  });

  const membrosOrdenados = useMemo(() => {
    return [...membros].sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" })
    );
  }, [membros]);

  const biasOrdenadas = useMemo(() => {
    return [...bias].sort((a, b) =>
      (a.nome_bia || a.id || "").localeCompare(b.nome_bia || b.id || "", "pt-BR", { sensitivity: "base" })
    );
  }, [bias]);

  const membrosAssociadosFiltrados = useMemo(() => {
    const q = membrosSearch.trim().toLowerCase();
    if (!q) return membrosOrdenados;
    return membrosOrdenados.filter(m =>
      [m.nome, m.empresa, m.cargo].filter(Boolean).some(value => String(value).toLowerCase().includes(q))
    );
  }, [membrosOrdenados, membrosSearch]);

  const biasAssociadasFiltradas = useMemo(() => {
    const q = biasSearch.trim().toLowerCase();
    if (!q) return biasOrdenadas;
    return biasOrdenadas.filter(b =>
      [b.nome_bia, b.id].filter(Boolean).some(value => String(value).toLowerCase().includes(q))
    );
  }, [biasOrdenadas, biasSearch]);

  // Open edit dialog when ?edit=:id is in the URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const editId = params.get("edit");
    if (editId && comunidades.length > 0 && !dialogOpen) {
      const c = comunidades.find(x => String(x.id) === editId);
      if (c) { openEdit(c); navigate("/comunidade", { replace: true }); }
    }
  }, [searchParams, comunidades]);

  // Auto-generate nome and sigla
  useEffect(() => {
    const { pais, territorio, sigla_pais, sigla_territorio, codigo_sequencial } = form;
    if (pais && territorio) {
      const nome = `BUILT ${pais} | ${territorio} | Comunidade ${codigo_sequencial || ""}`.trim();
      const sigla = sigla_pais && sigla_territorio && codigo_sequencial
        ?`${sigla_pais.toUpperCase()}-${sigla_territorio.toUpperCase()}-COM-${codigo_sequencial}`
        : "";
      setForm(f => ({ ...f, nome, sigla }));
    }
  }, [form.pais, form.territorio, form.sigla_pais, form.sigla_territorio, form.codigo_sequencial]);

  // Auto-suggest next code when pais+territorio change
  useEffect(() => {
    const { pais, territorio } = form;
    if (!pais?.trim() || !territorio?.trim() || editing) return;
    setCodigoLoading(true);
    fetch(`/api/comunidades/proximo-codigo?pais=${encodeURIComponent(pais)}&territorio=${encodeURIComponent(territorio)}`)
      .then(r => r.json())
      .then(d => setForm(f => ({
        ...f,
        codigo_sequencial: d.codigo,
        ...(d.sigla_territorio ?{ sigla_territorio: d.sigla_territorio } : {}),
      })))
      .catch(() => {})
      .finally(() => setCodigoLoading(false));
  }, [form.pais, form.territorio]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/comunidades", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunidades"] });
      toast({ title: "Comunidade criada com sucesso!" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Erro ao criar comunidade", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/comunidades/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunidades"] });
      toast({ title: "Comunidade atualizada!" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/comunidades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunidades"] });
      toast({ title: "Comunidade removida." });
      setDeleteTarget(null);
    },
    onError: (error: any) => toast({
      title: "Erro ao remover",
      description: error?.message || "Não foi possível remover esta comunidade.",
      variant: "destructive",
    }),
  });

  function openCreate() {
    setEditing(null);
    setMembrosSearch("");
    setBiasSearch("");
    setForm({ ...emptyForm(), aliado_id: user?.membro_directus_id || "" });
    setDialogOpen(true);
  }

  function openEdit(c: Comunidade) {
    setEditing(c);
    setMembrosSearch("");
    setBiasSearch("");
    setForm({
      pais: c.pais || "",
      sigla_pais: c.sigla_pais || "",
      territorio: c.territorio || "",
      sigla_territorio: c.sigla_territorio || "",
      codigo_sequencial: c.codigo_sequencial || "",
      nome: c.nome || "",
      sigla: c.sigla || "",
      aliado_id: resolveAliadoId(c),
      membros_ids: resolveMembrosIds(c),
      bias_ids: resolveBiasIds(c),
      status: c.status || "ativa",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      nome: form.nome,
      sigla: form.sigla,
      pais: form.pais,
      sigla_pais: form.sigla_pais,
      territorio: form.territorio,
      sigla_territorio: form.sigla_territorio,
      codigo_sequencial: form.codigo_sequencial,
      aliado_id: form.aliado_id || null,
      membros_ids: form.membros_ids || [],
      bias_ids: form.bias_ids || [],
      status: form.status || "ativa",
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleMembro(id: string) {
    setForm(f => {
      const ids = f.membros_ids || [];
      return { ...f, membros_ids: ids.includes(id) ?ids.filter(x => x !== id) : [...ids, id] };
    });
  }

  function toggleBia(id: string) {
    setForm(f => {
      const ids = f.bias_ids || [];
      return { ...f, bias_ids: ids.includes(id) ?ids.filter(x => x !== id) : [...ids, id] };
    });
  }

  const filtered = comunidades.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.nome?.toLowerCase().includes(q) || c.sigla?.toLowerCase().includes(q) ||
      c.pais?.toLowerCase().includes(q) || c.territorio?.toLowerCase().includes(q) ||
      resolveAliado(c)?.nome?.toLowerCase().includes(q);
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Communities where the current user is the Aliado BUILT
  const minhasComunidadesComoAliado = comunidades.filter(c => {
    const aId = typeof c.aliado === "string" ?c.aliado : (c.aliado as any)?.id;
    return aId && aId === user?.membro_directus_id;
  });

  // Admins/managers see all communities; aliados see only their own
  const comunidadesParaConvites = (isAdmin || isManager) ?comunidades : minhasComunidadesComoAliado;

  // Fetch convites for relevant communities
  const { data: convitesPorComunidade } = useQuery<Record<string, any[]>>({
    queryKey: ["/api/convites/aliado", user?.membro_directus_id, isAdmin, isManager, comunidadesParaConvites.map(c => c.id).join(",")],
    queryFn: async () => {
      const result: Record<string, any[]> = {};
      for (const com of comunidadesParaConvites) {
        const r = await fetch(`/api/convites?comunidade_id=${com.id}`);
        if (r.ok) result[com.id] = await r.json();
      }
      return result;
    },
    enabled: comunidadesParaConvites.length > 0,
    refetchInterval: 30000,
  });

  const decisaoMutation = useMutation({
    mutationFn: ({ token, decisao }: { token: string; decisao: string }) =>
      apiRequest("PATCH", `/api/convites/${token}/decisao`, { decisao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/convites/aliado"] });
      toast({ title: "Decisão registrada com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao processar decisão", variant: "destructive" }),
  });

  const lembretesMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest("POST", `/api/convites/${token}/lembrete`, {}),
    onSuccess: () => toast({ title: "Lembrete enviado!" }),
    onError: () => toast({ title: "Erro ao enviar lembrete", variant: "destructive" }),
  });

  // Query for vitrine/capital candidates from convitesComunidade
  const { data: vitrineCandidatos = [] } = useQuery<any[]>({
    queryKey: ["/api/convites/vitrine", isAdmin, isManager, comunidadesParaConvites.map(c => c.id).join(",")],
    queryFn: async () => {
      const results: any[] = [];
      for (const com of comunidadesParaConvites) {
        const r = await fetch(`/api/convites?comunidade_id=${com.id}`);
        if (r.ok) {
          const data = await r.json();
          results.push(...(data || []).filter((convite: any) => ["vitrine", "capital"].includes(String(convite.tipo || ""))));
        }
      }
      return results;
    },
    enabled: comunidadesParaConvites.length > 0,
    refetchInterval: 30000,
  });

  const aprovarVitrineMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest("PATCH", `/api/convites/${token}/aprovar-vitrine`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/convites/vitrine"] });
      toast({ title: "Acesso à vitrine aprovado! Candidato receberá e-mail." });
    },
    onError: () => toast({ title: "Erro ao aprovar acesso", variant: "destructive" }),
  });

  const rejeitarVitrineMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest("PATCH", `/api/convites/${token}/rejeitar-vitrine`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/convites/vitrine"] });
      toast({ title: "Candidato rejeitado. E-mails enviados." });
    },
    onError: () => toast({ title: "Erro ao rejeitar", variant: "destructive" }),
  });

  // Aura evaluation state for Aliado evaluating a candidate directly from the panel
  const [auraDialogConvite, setAuraDialogConvite] = useState<{ avaliacaoToken: string; candidatoNome: string } | null>(null);
  const [auraSelectedWords, setAuraSelectedWords] = useState<string[]>([]);
  const [auraSearch, setAuraSearch] = useState("");
  const [auraEvalMode, setAuraEvalMode] = useState<"palavras" | "ia">("palavras");
  const [auraTextoIA, setAuraTextoIA] = useState("");
  const [auraArquivoNome, setAuraArquivoNome] = useState<string | null>(null);
  const [auraRecording, setAuraRecording] = useState(false);
  const [auraMicBlocked, setAuraMicBlocked] = useState(false);
  const [auraMicPromptOpen, setAuraMicPromptOpen] = useState(false);
  const auraFileInputRef = useRef<HTMLInputElement>(null);
  const auraAudioFileInputRef = useRef<HTMLInputElement>(null);
  const auraMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const auraAudioChunksRef = useRef<Blob[]>([]);

  const { data: auraLexico = [] } = useQuery<{ canonico: string; dimensao: string }[]>({
    queryKey: ["/api/aura/lexico"],
    queryFn: () => fetch("/api/aura/lexico").then(r => r.json()),
    enabled: auraDialogConvite !== null,
  });

  const avaliarAuraMutation = useMutation({
    mutationFn: ({ avaliacaoToken, palavras }: { avaliacaoToken: string; palavras: string[] }) =>
      apiRequest("POST", `/api/avaliacao-aura/${avaliacaoToken}`, { palavras }),
    onSuccess: () => {
      toast({ title: "Percepção de Aura registrada!" });
      resetAuraDialog();
    },
    onError: () => toast({ title: "Erro ao registrar Aura", variant: "destructive" }),
  });

  const extrairAuraArquivoMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("arquivo", file);
      const res = await fetch("/api/aura/extrair-arquivo", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao processar arquivo." }));
        throw new Error(err.error || "Erro ao processar arquivo.");
      }
      return res.json() as Promise<{ texto: string }>;
    },
    onSuccess: data => {
      setAuraTextoIA(prev => prev ?prev + "\n\n" + data.texto : data.texto);
      toast({ title: "Arquivo processado", description: "O texto foi adicionado para análise." });
    },
    onError: (err: Error) => toast({ title: "Erro no arquivo", description: err.message, variant: "destructive" }),
  });

  const transcreverAuraAudioMutation = useMutation({
    mutationFn: async ({ blob, filename = "percepcao-aura.webm" }: { blob: Blob; filename?: string }) => {
      const form = new FormData();
      form.append("audio", blob, filename);
      const res = await fetch("/api/aura/transcrever-audio", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao transcrever áudio." }));
        throw new Error(err.error || "Erro ao transcrever áudio.");
      }
      return res.json() as Promise<{ texto: string }>;
    },
    onSuccess: data => {
      setAuraTextoIA(prev => prev ?prev + "\n\n" + data.texto : data.texto);
      setAuraEvalMode("ia");
      toast({ title: "Áudio transcrito", description: "Revise o texto antes de analisar com IA." });
    },
    onError: (err: Error) => toast({ title: "Erro no áudio", description: err.message, variant: "destructive" }),
  });

  const analisarAuraTextoMutation = useMutation({
    mutationFn: async ({ texto, membro_nome }: { texto: string; membro_nome: string }) => {
      const res = await apiRequest("POST", "/api/aura/analisar-texto", { texto, membro_nome });
      return res.json() as Promise<{ palavras: string[] }>;
    },
    onSuccess: data => {
      if (!data.palavras?.length) {
        toast({
          title: "Nenhuma palavra identificada",
          description: "Descreva com mais detalhes a reputação, confiança e forma de relacionamento.",
          variant: "destructive",
        });
        return;
      }
      setAuraSelectedWords(data.palavras.slice(0, 3));
      setAuraEvalMode("palavras");
      toast({ title: "IA sugeriu palavras", description: `Sugestão: ${data.palavras.slice(0, 3).join(", ")}` });
    },
    onError: (err: Error) => toast({ title: "Erro na análise", description: err.message, variant: "destructive" }),
  });

  const resetAuraDialog = () => {
    const recorder = auraMediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stream.getTracks().forEach(track => track.stop());
        recorder.stop();
      } catch {
        // Recorder may already be stopping.
      }
    }
    auraMediaRecorderRef.current = null;
    auraAudioChunksRef.current = [];
    setAuraDialogConvite(null);
    setAuraSelectedWords([]);
    setAuraSearch("");
    setAuraEvalMode("palavras");
    setAuraTextoIA("");
    setAuraArquivoNome(null);
    setAuraRecording(false);
    setAuraMicBlocked(false);
    setAuraMicPromptOpen(false);
  };

  const requestAuraRecording = () => {
    if (auraRecording) {
      stopAuraRecording();
      return;
    }
    setAuraMicPromptOpen(true);
  };

  const startAuraRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        toast({ title: "Áudio indisponível", description: "Este navegador não permite gravação de áudio aqui.", variant: "destructive" });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      auraAudioChunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) auraAudioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(auraAudioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        auraAudioChunksRef.current = [];
        setAuraRecording(false);
        if (blob.size > 0 && auraDialogConvite) {
          transcreverAuraAudioMutation.mutate({ blob, filename: "percepcao-aura.webm" });
        }
      };
      auraMediaRecorderRef.current = recorder;
      recorder.start();
      setAuraRecording(true);
      setAuraMicBlocked(false);
      setAuraEvalMode("ia");
    } catch (err: any) {
      const permissionDenied = err?.name === "NotAllowedError" || /permission|denied|permiss/i.test(err?.message || "");
      if (permissionDenied) setAuraMicBlocked(true);
      toast({
        title: permissionDenied ? "Microfone bloqueado" : "Não foi possível gravar",
        description: permissionDenied
          ? "Permita o microfone nas configurações do navegador ou toque em Enviar áudio para selecionar uma gravação do celular."
          : err?.message || "Verifique a permissão do microfone ou envie um áudio já gravado.",
        variant: "destructive",
      });
    }
  };

  const stopAuraRecording = () => {
    const recorder = auraMediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const toggleAuraWord = (word: string) => {
    setAuraSelectedWords(prev =>
      prev.includes(word) ?prev.filter(w => w !== word) : prev.length < 3 ?[...prev, word] : prev
    );
  };

  const todosCandidatos = Object.values(convitesPorComunidade || {}).flat();
  const vitrineCandidatosFiltrados = vitrineCandidatos;
  const todosCandidatosFiltrados = todosCandidatos;
  const candidatosPendentes = todosCandidatosFiltrados.filter(c => c.status === "candidato");
  const vitrinePendentes = vitrineCandidatosFiltrados.filter(c => ["candidato", "aguardando_avaliacao_aura"].includes(c.status));
  const outrosConvites = todosCandidatosFiltrados.filter(c => c.status !== "candidato" && c.status !== "convidado");

  // ── Notificações de novos candidatos ──────────────────────────────
  const prevCandidatosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (minhasComunidadesComoAliado.length === 0) return;

    // Request browser notification permission once
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [minhasComunidadesComoAliado.length]);

  useEffect(() => {
    if (!convitesPorComunidade) return;
    const novosIds = candidatosPendentes.map((c: any) => c.id as string);
    const novos = novosIds.filter(id => !prevCandidatosRef.current.has(id));

    if (prevCandidatosRef.current.size > 0 && novos.length > 0) {
      // In-app toast
      const nomes = novos.map(id => candidatosPendentes.find((c: any) => c.id === id)?.candidato_nome || "Novo candidato").join(", ");
      toast({
        title: `ðŸ“‹ ${novos.length === 1 ?"Novo candidato" : `${novos.length} novos candidatos`}`,
        description: nomes,
      });

      // Browser notification (works even when tab is not focused)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("BUILT Alliances — Novo candidato", {
          body: `${nomes} aguarda sua decisão.`,
          icon: "/favicon.ico",
          tag: "built-candidato",
        });
      }
    }

    prevCandidatosRef.current = new Set(novosIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convitesPorComunidade]);

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    convidado: { label: "Convidado", color: "text-blue-400" },
    termos_pendentes: { label: "Lendo Termos", color: "text-orange-400" },
    termos_aceitos: { label: "Termos aceitos", color: "text-cyan-400" },
    aguardando_avaliacao_aura: { label: "Aguardando Aura", color: "text-violet-400" },
    candidato: { label: "Aguardando decisão", color: "text-amber-400" },
    aprovado: { label: "Aprovado", color: "text-green-400" },
    rejeitado: { label: "Rejeitado", color: "text-red-400" },
    termos_enviados: { label: "Termos enviados", color: "text-purple-400" },
    pagamento_pendente: { label: "Pagamento pendente", color: "text-amber-400" },
    membro: { label: "Membro ativo", color: "text-emerald-400" },
    vitrine_ativo: { label: "Vitrine ativa", color: "text-emerald-400" },
  };

  const showConvitesTab = false;
  const todosCandidatosCompleto = todosCandidatosFiltrados.filter(c => c.tipo !== "vitrine");
  const PENDING_DECISION_STATUSES = ["candidato", "aguardando_avaliacao_aura"];
  const ACTIONABLE_APPROVAL_STATUSES = [
    "candidato",
    "aguardando_avaliacao_aura",
    "aprovado",
    "termos_enviados",
    "termos_aceitos",
    "pagamento_pendente",
  ];
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const convitesUnificados = Array.from(
    new Map(
      [...vitrineCandidatosFiltrados, ...todosCandidatosCompleto].map((convite: any) => [
        String(convite.id),
        convite,
      ])
    ).values()
  ).sort((a: any, b: any) => {
    const priorityA = PENDING_DECISION_STATUSES.includes(a.status) ?0 : 1;
    const priorityB = PENDING_DECISION_STATUSES.includes(b.status) ?0 : 1;
    if (priorityA !== priorityB) return priorityA - priorityB;
    const dateA = new Date(a.criado_em || a.created_at || 0).getTime();
    const dateB = new Date(b.criado_em || b.created_at || 0).getTime();
    return dateB - dateA;
  });
  const aprovacoesQuery = normalize(aprovacoesSearch);
  const aprovacoesFiltradas = convitesUnificados.filter((convite: any) => {
    if (!aprovacoesQuery) return true;
    const dados = convite.dados_contratuais as any;
    const comNome = comunidades.find(c => String(c.id) === String(convite.comunidade_id))?.nome || "";
    return normalize([
      convite.candidato_nome,
      dados?.nome_completo,
      convite.candidato_email,
      comNome,
      convite.status,
    ].filter(Boolean).join(" ")).includes(aprovacoesQuery);
  });
  const convitesPendentes = aprovacoesFiltradas.filter((c: any) =>
    ["candidato", "aguardando_avaliacao_aura"].includes(c.status)
  );
  const aprovacoesImportantes = aprovacoesFiltradas.filter((c: any) =>
    ACTIONABLE_APPROVAL_STATUSES.includes(c.status)
  );
  const aprovacoesHistorico = aprovacoesFiltradas.filter((c: any) =>
    !ACTIONABLE_APPROVAL_STATUSES.includes(c.status)
  );
  const aprovacoesExibidas = mostrarHistoricoAprovacoes ?aprovacoesHistorico : aprovacoesImportantes;
  const opasPublicasFiltradas = (opasNotificacoes || [])
    .filter((opa: any) => {
      const status = String(opa.status || "").toLowerCase();
      return !["cancelado", "cancelada", "encerrada", "encerrado", "concluida", "concluída", "desistencia"].includes(status);
    })
    .filter((opa: any) => {
      if (!aprovacoesQuery) return true;
      return normalize([
        opa.nome_oportunidade,
        opa.tipo,
        opa.nucleo_alianca,
        opa.status,
        opa.localizacao,
      ].filter(Boolean).join(" ")).includes(aprovacoesQuery);
    })
    .sort((a: any, b: any) => {
      const dateA = new Date(a.date_created || a.criado_em || a.data_publicacao || 0).getTime();
      const dateB = new Date(b.date_created || b.criado_em || b.data_publicacao || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 12);
  // Badge count: include candidato (ready for aliado decision) + aguardando_avaliacao_aura (inviting member hasn't evaluated yet)
  const convitesBadgeCount =
    vitrineCandidatos.filter((c: any) => PENDING_DECISION_STATUSES.includes(c.status)).length +
    todosCandidatos.filter((c: any) => PENDING_DECISION_STATUSES.includes(c.status)).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy"
            data-testid="icon-comunidade-title"
          >
            {convitesOnly ?<Bell className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-comunidade-title">{convitesOnly ?"Notificações" : "Comunidades"}</h1>
            <p className="text-sm text-white/40 font-mono mt-0.5">
              {convitesOnly
                ?"Acompanhe aprovações, chamadas para aliança e novas ofertas públicas"
                : `${comunidades.length} comunidade${comunidades.length !== 1 ?"s" : ""} ativa${comunidades.length !== 1 ?"s" : ""}`}
            </p>
          </div>
        </div>
        {!convitesOnly && activeTab === "comunidades" && (
          <Button
            onClick={openCreate}
            className="font-mono"
            style={{ background: "linear-gradient(135deg, #0EA5E9, #2563EB)", color: "#FFFFFF" }}
            data-testid="btn-nova-comunidade"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Comunidade
          </Button>
        )}
      </div>

      {/* Tab switcher */}
      {showConvitesTab && (
        <div className="flex rounded-xl p-1 gap-1 w-fit" style={{ background: "#001D34", border: "1px solid rgba(215,187,125,0.2)" }}>
          <button
            onClick={() => setActiveTab("comunidades")}
            data-testid="tab-comunidades"
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: activeTab === "comunidades" ?"rgba(215,187,125,0.18)" : "transparent",
              color: activeTab === "comunidades" ?"#D7BB7D" : "rgba(255,255,255,0.7)",
              border: activeTab === "comunidades" ?"1px solid rgba(215,187,125,0.35)" : "1px solid transparent",
            }}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Comunidades
          </button>
          <button
            onClick={() => setActiveTab("convites")}
            data-testid="tab-convites"
            className="relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: activeTab === "convites" ?"rgba(215,187,125,0.18)" : "transparent",
              color: activeTab === "convites" ?"#D7BB7D" : "rgba(255,255,255,0.7)",
              border: activeTab === "convites" ?"1px solid rgba(215,187,125,0.35)" : "1px solid transparent",
            }}
          >
            <Ticket className="w-3.5 h-3.5" />
            Convites
            {convitesBadgeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {convitesBadgeCount}
              </span>
            )}
          </button>
        </div>
      )}

      {!convitesOnly && activeTab === "comunidades" && (
        <>
      <ComunidadesMapHeader comunidades={filtered} />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(215,187,125,0.5)" }} />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, sigla, país, território..."
          className="pl-9 focus:outline-none focus:ring-0"
          style={{
            background: "#001D34",
            border: "1px solid rgba(215,187,125,0.2)",
            color: "rgba(255,255,255,0.85)",
          }}
          data-testid="input-busca-comunidade"
        />
      </div>

      {/* List */}
      {isLoading ?(
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ?(
        <div
          className="rounded-2xl border border-white/8 p-12 flex flex-col items-center justify-center text-center"
          style={{ background: "linear-gradient(145deg, #071626, #040e1c)", minHeight: 280 }}
        >
          <MessageCircle className="w-10 h-10 text-brand-gold/20 mb-4" />
          <p className="text-brand-gold/40 font-mono text-xs tracking-[0.3em] uppercase mb-1">
            {search ?"// Nenhum resultado" : "// Sem comunidades"}
          </p>
          <p className="text-white/20 font-mono text-sm">
            {search ?"Tente outro termo de busca." : "Crie a primeira comunidade BUILT."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ComunidadeCard
              key={c.id}
              comunidade={c}
              canEdit={isAdmin || user?.membro_directus_id === resolveAliadoId(c)}
              onEdit={() => openEdit(c)}
              onDelete={() => setDeleteTarget(c)}
            />
          ))}
        </div>
      )}
        </>
      )}

      {/* Convites Tab */}
      {activeTab === "convites" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-brand-gold/20 bg-white p-1 shadow-sm sm:grid-cols-3">
            {[
              { key: "aprovacoes", label: "Aprovações pendentes", count: aprovacoesImportantes.length },
              { key: "chamadas", label: "Chamadas para aliança", count: 0 },
              { key: "opas", label: "Novas Ofertas públicas", count: opasPublicasFiltradas.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setNotificacoesTab(tab.key as "aprovacoes" | "chamadas" | "opas");
                  setMostrarHistoricoAprovacoes(false);
                }}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  notificacoesTab === tab.key
                    ?"bg-brand-gold/15 text-brand-navy shadow-sm"
                    :"text-slate-500 hover:bg-slate-50 hover:text-brand-navy"
                }`}
                data-testid={`tab-notificacoes-${tab.key}`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#9B7A32]">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-navy/50" />
              <Input
                value={aprovacoesSearch}
                onChange={(event) => setAprovacoesSearch(event.target.value)}
                placeholder={notificacoesTab === "opas" ?"Buscar por OPA, tipo, núcleo ou status..." : "Buscar por nome, e-mail, comunidade ou status..."}
                className="h-10 pl-9 bg-white border-brand-gold/40 text-brand-navy placeholder:text-brand-navy/45 focus-visible:ring-brand-gold/40"
                data-testid="input-busca-aprovacoes"
              />
            </div>
            {notificacoesTab === "aprovacoes" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setMostrarHistoricoAprovacoes((current) => !current)}
                className="w-full border-brand-gold/40 text-brand-navy hover:bg-brand-gold/10 lg:w-auto"
                data-testid="btn-toggle-historico-aprovacoes"
              >
                {mostrarHistoricoAprovacoes ?"Voltar" : "Ver histórico"}
              </Button>
            )}
          </div>
          {/* Aprovações e candidaturas */}
          {notificacoesTab === "aprovacoes" && (
          <div className="rounded-2xl border border-brand-gold/25 bg-white overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-brand-gold/20 bg-brand-gold/5">
              <Ticket className="w-4 h-4 text-brand-gold" />
              <span className="text-xs font-mono text-brand-navy/80 uppercase tracking-widest">
                {mostrarHistoricoAprovacoes ?"Histórico de Aprovações" : "Aprovações Pendentes"}
              </span>
              {!mostrarHistoricoAprovacoes && aprovacoesImportantes.length > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {aprovacoesImportantes.length} item{aprovacoesImportantes.length !== 1 ?"s" : ""}
                </span>
              )}
              {mostrarHistoricoAprovacoes && aprovacoesHistorico.length > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200">
                  {aprovacoesHistorico.length} registro{aprovacoesHistorico.length !== 1 ?"s" : ""}
                </span>
              )}
            </div>
            {aprovacoesExibidas.length === 0 ?(
              <div className="p-8 flex flex-col items-center text-center gap-2">
                <Ticket className="w-8 h-8 text-brand-gold/30" />
                <p className="text-slate-500 text-xs font-mono">
                  {mostrarHistoricoAprovacoes
                    ?"Nenhum registro no histórico encontrado"
                    : "Nenhuma aprovação pendente no momento"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {aprovacoesExibidas.map((convite: any) => {
                  const isVitrine = convite.tipo === "vitrine";
                  const isPendente = convite.status === "candidato";
                  const isAguardandoAura = convite.status === "aguardando_avaliacao_aura";
                  const comNome = comunidades.find(c => String(c.id) === String(convite.comunidade_id))?.nome || ("Comunidade #" + convite.comunidade_id);
                  const invitador = membros.find(m => String(m.id) === String(convite.invitador_membro_id));
                  const nomeConvidador = invitador?.nome || null;
                  const statusInfo = STATUS_LABELS[convite.status] || { label: convite.status, color: "text-white/40" };
                  const dados = convite.dados_contratuais as any;
                  return (
                    <div key={convite.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-mono font-bold text-brand-navy">
                            {convite.candidato_nome || dados?.nome_completo || "-"}
                          </p>
                          <span className={"text-[10px] font-mono " + statusInfo.color}>
                            - {statusInfo.label}
                          </span>
                          {isPendente && <CandidatoAuraBadge membroId={convite.candidato_membro_id} />}
                        </div>
                        {convite.candidato_email && (
                          <p className="text-xs font-mono text-slate-500">{convite.candidato_email}</p>
                        )}
                        {nomeConvidador && (
                          <p className="text-[10px] font-mono text-[#9B7A32]">
                            Convidado por {nomeConvidador}
                          </p>
                        )}
                        <p className="text-[10px] font-mono text-slate-400">{comNome}</p>
                        {!isVitrine && dados && (
                          <div className="flex flex-wrap gap-3 mt-1">
                            {(dados.cpf || dados.cpf_cnpj) && <span className="text-[10px] font-mono text-slate-500">CPF: {dados.cpf || dados.cpf_cnpj}</span>}
                            {dados.cnpj && <span className="text-[10px] font-mono text-slate-500">CNPJ: {dados.cnpj}</span>}
                            {dados.telefone && <span className="text-[10px] font-mono text-slate-500">Tel: {dados.telefone}</span>}
                            {dados.cidade && <span className="text-[10px] font-mono text-slate-500">Local: {dados.cidade}, {dados.estado}</span>}
                          </div>
                        )}
                        {!isVitrine && dados?.mensagem && (
                          <p className="text-[11px] font-mono text-slate-600 italic mt-1 leading-relaxed">"{dados.mensagem}"</p>
                        )}
                        {isAguardandoAura && (
                          <p className="text-[10px] font-mono text-violet-700 mt-0.5">
                            Aguardando avaliacao de Aura do convidador
                          </p>
                        )}
                        {!isVitrine && convite.status === "candidato" && (
                          <CandidateInfoPanel convite={convite} compact />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {!isVitrine && (
                          <button
                            onClick={() => setSelectedConvite({ ...convite, comNome })}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                            data-testid={"btn-ver-candidato-tab-" + convite.id}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver detalhes
                          </button>
                        )}
                        {isVitrine ?(
                          <>
                            {isPendente && (
                              <>
                                <button
                                  onClick={() => aprovarVitrineMutation.mutate(convite.token)}
                                  disabled={aprovarVitrineMutation.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors"
                                  data-testid={"btn-aprovar-vitrine-" + convite.id}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Aprovar acesso
                                </button>
                                <button
                                  onClick={() => rejeitarVitrineMutation.mutate(convite.token)}
                                  disabled={rejeitarVitrineMutation.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-red-700 border border-red-200 hover:bg-red-50 transition-colors"
                                  data-testid={"btn-rejeitar-vitrine-" + convite.id}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Rejeitar
                                </button>
                              </>
                            )}
                            {(isPendente || isAguardandoAura) && convite.avaliacao_token && (
                              <button
                                onClick={() => {
                                  setAuraDialogConvite({ avaliacaoToken: convite.avaliacao_token, candidatoNome: convite.candidato_nome || "Candidato" });
                                  setAuraSelectedWords([]);
                                  setAuraSearch("");
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-[#9B7A32] border border-brand-gold/30 hover:bg-brand-gold/10 transition-colors"
                                data-testid={"btn-avaliar-aura-" + convite.id}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                Registrar Aura
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {convite.status === "candidato" && (
                              <>
                                <button
                                  onClick={() => decisaoMutation.mutate({ token: convite.token, decisao: "aprovado" })}
                                  disabled={decisaoMutation.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors"
                                  data-testid={"btn-aprovar-tab-" + convite.id}
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => decisaoMutation.mutate({ token: convite.token, decisao: "rejeitado" })}
                                  disabled={decisaoMutation.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-red-700 border border-red-200 hover:bg-red-50 transition-colors"
                                  data-testid={"btn-rejeitar-tab-" + convite.id}
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  Rejeitar
                                </button>
                              </>
                            )}
                            {["aprovado", "termos_enviados"].includes(convite.status) && (
                              <button
                                onClick={() => lembretesMutation.mutate(convite.token)}
                                disabled={lembretesMutation.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-purple-700 border border-purple-200 hover:bg-purple-50 transition-colors"
                                data-testid={"btn-lembrete-tab-" + convite.id}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                Reenviar Termos
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {notificacoesTab === "chamadas" && (
            <div className="rounded-2xl border border-brand-gold/25 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-brand-gold/20 bg-brand-gold/5">
                <Bell className="w-4 h-4 text-brand-gold" />
                <span className="text-xs font-mono text-brand-navy/80 uppercase tracking-widest">
                  Chamadas para Aliança
                </span>
              </div>
              <div className="p-8 flex flex-col items-center text-center gap-2">
                <Bell className="w-8 h-8 text-brand-gold/30" />
                <p className="text-slate-500 text-xs font-mono">
                  Nenhuma chamada para aliança no momento.
                </p>
              </div>
            </div>
          )}

          {notificacoesTab === "opas" && (
            <div className="rounded-2xl border border-brand-gold/25 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-brand-gold/20 bg-brand-gold/5">
                <Target className="w-4 h-4 text-brand-gold" />
                <span className="text-xs font-mono text-brand-navy/80 uppercase tracking-widest">
                  Novas Ofertas Públicas
                </span>
                {opasPublicasFiltradas.length > 0 && (
                  <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-gold/10 text-[#9B7A32] border border-brand-gold/30">
                    {opasPublicasFiltradas.length} no radar
                  </span>
                )}
              </div>
              {opasPublicasFiltradas.length === 0 ?(
                <div className="p-8 flex flex-col items-center text-center gap-2">
                  <Target className="w-8 h-8 text-brand-gold/30" />
                  <p className="text-slate-500 text-xs font-mono">
                    Nenhuma nova oferta pública encontrada.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {opasPublicasFiltradas.map((opa: any) => (
                    <button
                      key={opa.id}
                      type="button"
                      onClick={() => navigate(`/opas/${opa.id}`)}
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50"
                      data-testid={`btn-notificacao-opa-${opa.id}`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                        <Target className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-brand-navy">
                          {opa.nome_oportunidade || "OPA sem título"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {[opa.tipo, opa.nucleo_alianca, opa.status].filter(Boolean).join(" · ") || "Oferta pública"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="border-brand-gold/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ background: "#001428" }}
        >
          <DialogHeader>
            <DialogTitle className="font-mono text-brand-gold text-lg">
              {editing ?"Editar Comunidade" : "Nova Comunidade"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Location Picker Button */}
            <Button
              type="button"
              onClick={() => setLocationPickerOpen(true)}
              variant="outline"
              className="w-full border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 hover:border-brand-gold/50 font-mono text-sm gap-2"
              data-testid="btn-comunidade-pick-location"
            >
              <Navigation className="w-4 h-4" />
              Selecionar Localização no Mapa
              {form.pais && form.territorio && (
                <span className="ml-auto text-xs text-white/40 font-mono">
                  {form.sigla_pais} · {form.sigla_territorio}
                </span>
              )}
            </Button>

            {/* País */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">País *</Label>
              <Input
                value={form.pais || ""}
                onChange={e => {
                  const pais = capitalizeWords(e.target.value);
                  const sigla_pais = pais.trim() ?abbrevCountry(pais) : "";
                  setForm(f => ({ ...f, pais, sigla_pais }));
                }}
                placeholder="Ex: Brasil"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                data-testid="input-comunidade-pais"
              />
            </div>

            {/* Território */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">Território *</Label>
              <Input
                value={form.territorio || ""}
                onChange={e => {
                  const territorio = capitalizeWords(e.target.value);
                  const sigla_territorio = territorio.trim() ?abbrevTerritory(territorio) : "";
                  setForm(f => ({ ...f, territorio, sigla_territorio }));
                }}
                placeholder="Ex: Belo Horizonte"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                data-testid="input-comunidade-territorio"
              />
            </div>

            {/* Código Sequencial — hidden, calculated automatically on backend */}

            {/* Auto-generated preview */}
            {(form.nome || form.sigla) && (
              <div className="rounded-xl border border-brand-gold/20 p-4" style={{ background: "rgba(215,187,125,0.05)" }}>
                <p className="text-[10px] font-mono text-brand-gold/40 uppercase tracking-widest mb-2">Prévia gerada automaticamente</p>
                {form.nome && <p className="text-sm text-white font-mono">{form.nome}</p>}
                {form.sigla && <p className="text-xs text-brand-gold/60 font-mono mt-1">{form.sigla}</p>}
              </div>
            )}

            {/* Aliado BUILT */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">Aliado BUILT</Label>
              <Select value={form.aliado_id || ""} onValueChange={v => setForm(f => ({ ...f, aliado_id: v === "_none" ?"" : v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40" data-testid="select-comunidade-aliado">
                  <SelectValue placeholder="Selecione o Aliado BUILT" />
                </SelectTrigger>
                <SelectContent className="bg-[#001428] border-white/10 text-white">
                  <SelectItem value="_none">— Nenhum —</SelectItem>
                  {membrosOrdenados.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Membros Associados */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">
                Membros Associados ({(form.membros_ids || []).length} selecionados)
              </Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-gold/60" />
                <Input
                  value={membrosSearch}
                  onChange={(e) => setMembrosSearch(e.target.value)}
                  placeholder="Buscar membro por nome, empresa ou cargo..."
                  className="h-9 bg-white/5 border-white/10 pl-9 text-sm text-white placeholder:text-white/25 focus:border-brand-gold/40"
                  data-testid="input-buscar-membros-associados"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                {membrosAssociadosFiltrados.map(m => {
                  const selected = (form.membros_ids || []).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMembro(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selected ?"bg-brand-gold/10" : "hover:bg-white/5"}`}
                      data-testid={`btn-membro-${m.id}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ?"bg-brand-gold border-brand-gold" : "border-white/20"}`}>
                        {selected && <span className="text-brand-navy text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-sm text-white/80 font-mono truncate">{m.nome}</span>
                      {m.empresa && <span className="text-xs text-white/30 font-mono ml-auto truncate">{m.empresa}</span>}
                    </button>
                  );
                })}
                {membrosAssociadosFiltrados.length === 0 && (
                  <p className="text-xs text-white/20 font-mono p-3">Nenhum membro encontrado</p>
                )}
              </div>
            </div>

            {/* BIAs Associadas */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">
                BIAs Associadas ({(form.bias_ids || []).length} selecionadas)
              </Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-gold/60" />
                <Input
                  value={biasSearch}
                  onChange={(e) => setBiasSearch(e.target.value)}
                  placeholder="Buscar BIA..."
                  className="h-9 bg-white/5 border-white/10 pl-9 text-sm text-white placeholder:text-white/25 focus:border-brand-gold/40"
                  data-testid="input-buscar-bias-associadas"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                {biasAssociadasFiltradas.map(b => {
                  const selected = (form.bias_ids || []).includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBia(b.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selected ?"bg-brand-gold/10" : "hover:bg-white/5"}`}
                      data-testid={`btn-bia-${b.id}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ?"bg-brand-gold border-brand-gold" : "border-white/20"}`}>
                        {selected && <span className="text-brand-navy text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-sm text-white/80 font-mono truncate">{b.nome_bia || b.id}</span>
                    </button>
                  );
                })}
                {biasAssociadasFiltradas.length === 0 && (
                  <p className="text-xs text-white/20 font-mono p-3">Nenhuma BIA encontrada</p>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">Status</Label>
              <Select value={form.status || "ativa"} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40" data-testid="select-comunidade-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#001428] border-white/10 text-white">
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-white/50 hover:text-white">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !form.pais?.trim() || !form.territorio?.trim() || !form.codigo_sequencial?.trim()}
              className="font-mono"
              style={{ background: "#D7BB7D", color: "#001D34" }}
              data-testid="btn-salvar-comunidade"
            >
              {isPending ?<Loader2 className="w-4 h-4 animate-spin" /> : (editing ?"Salvar alterações" : "Criar Comunidade")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ComunidadeLocationPickerModal
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={(pais, siglaPais, territorio, siglaTerritorio) => {
          setForm(f => ({ ...f, pais, sigla_pais: siglaPais, territorio, sigla_territorio: siglaTerritorio }));
        }}
      />

      {/* Candidate Details Dialog */}
      {selectedConvite && (() => {
        const sc = selectedConvite;
        const dados = sc.dados_contratuais as any;
        const statusInfo = STATUS_LABELS[sc.status] || { label: sc.status, color: "text-white/50" };
        return (
          <Dialog open={!!selectedConvite} onOpenChange={open => !open && setSelectedConvite(null)}>
            <DialogContent className="max-w-lg border-brand-gold/15 text-white p-0 overflow-hidden" style={{ background: "linear-gradient(145deg,#071626,#040e1c)" }}>
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/5" style={{ background: "rgba(215,187,125,0.04)" }}>
                <p className="text-[10px] font-mono text-brand-gold/60 uppercase tracking-widest mb-1">Candidato</p>
                <h2 className="text-lg font-bold text-white font-mono">{sc.candidato_nome || dados?.nome_completo || "—"}</h2>
                <span className={`text-xs font-mono ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>

              <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
                {/* Community */}
                <div className="rounded-lg border border-brand-gold/15 bg-brand-gold/5 px-4 py-3">
                  <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest mb-1">Comunidade pretendida</p>
                  <p className="text-sm font-mono font-bold text-brand-gold/90">{sc.comNome}</p>
                </div>

                {/* Convidado por */}
                {(() => {
                  const invitadorId = sc.invitador_membro_id;
                  if (!invitadorId) return null;
                  const comunidadeDoConvite = comunidades.find(c => String(c.id) === String(sc.comunidade_id));
                  const aliadoId = typeof comunidadeDoConvite?.aliado === "object"
                    ?comunidadeDoConvite?.aliado?.id
                    : comunidadeDoConvite?.aliado;
                  const ehOProprioAliado = aliadoId && String(aliadoId) === String(invitadorId);
                  const invitadorMembro = membros.find(m => String(m.id) === String(invitadorId));
                  const nomeInvitador = ehOProprioAliado
                    ?(invitadorMembro?.nome || "Aliado BUILT")
                    : (invitadorMembro?.nome || invitadorId);
                  const labelInvitador = ehOProprioAliado ?"Aliado BUILT (próprio)" : "Membro";
                  return (
                    <div className="rounded-lg border border-white/8 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <UserCheck className="w-4 h-4 text-brand-gold/50 shrink-0" />
                      <div>
                        <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-0.5">Convidado por</p>
                        <p className="text-sm font-mono font-semibold text-white">{nomeInvitador}</p>
                        <p className="text-[10px] font-mono text-white/30">{labelInvitador}</p>
                      </div>
                    </div>
                  );
                })()}

                <CandidateInfoPanel convite={sc} />

                {/* Contact */}
                <div className="space-y-2.5">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Contato</p>
                  <div className="grid grid-cols-1 gap-2">
                    {sc.candidato_email && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Mail className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="font-mono text-white/70">{sc.candidato_email}</span>
                      </div>
                    )}
                    {dados?.telefone && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Phone className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="font-mono text-white/70">{dados.telefone}</span>
                      </div>
                    )}
                    {(dados?.cidade || dados?.estado) && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="font-mono text-white/70">{[dados?.cidade, dados?.estado, dados?.pais].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {dados?.endereco && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Building className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="font-mono text-white/70">{dados.endereco}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Document */}
                {(dados?.cpf || dados?.cnpj || dados?.cpf_cnpj) && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Documentos</p>
                    {(dados.cpf || dados.cpf_cnpj) && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Hash className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="text-[10px] font-mono text-white/40 uppercase w-10">CPF</span>
                        <span className="font-mono text-white/70">{dados.cpf || dados.cpf_cnpj}</span>
                      </div>
                    )}
                    {dados.cnpj && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Hash className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="text-[10px] font-mono text-white/40 uppercase w-10">CNPJ</span>
                        <span className="font-mono text-white/70">{dados.cnpj}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Message */}
                {dados?.mensagem && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Mensagem do candidato</p>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                      <p className="text-sm font-mono text-white/60 italic leading-relaxed">"{dados.mensagem}"</p>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Datas</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-start gap-2 text-xs">
                      <Calendar className="w-3 h-3 text-white/20 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white/30 font-mono">Candidatura</p>
                        <p className="text-white/60 font-mono">{sc.criado_em ?new Date(sc.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                      </div>
                    </div>
                    {sc.expires_at && (
                      <div className="flex items-start gap-2 text-xs">
                        <Clock className="w-3 h-3 text-white/20 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white/30 font-mono">Expira em</p>
                          <p className="text-white/60 font-mono">{new Date(sc.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="px-6 py-4 border-t border-white/5 flex flex-wrap gap-2">
                {sc.status === "candidato" && (
                  <>
                    <button
                      onClick={() => { decisaoMutation.mutate({ token: sc.token, decisao: "aprovado" }); setSelectedConvite(null); }}
                      disabled={decisaoMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-bold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Aprovar candidatura
                    </button>
                    <button
                      onClick={() => { decisaoMutation.mutate({ token: sc.token, decisao: "rejeitado" }); setSelectedConvite(null); }}
                      disabled={decisaoMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Rejeitar
                    </button>
                  </>
                )}
                {["aprovado", "termos_enviados"].includes(sc.status) && (
                  <button
                    onClick={() => { lembretesMutation.mutate(sc.token); setSelectedConvite(null); }}
                    disabled={lembretesMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Reenviar Termos
                  </button>
                )}
                <button
                  onClick={() => setSelectedConvite(null)}
                  className="ml-auto px-4 py-2 rounded-lg text-xs font-mono text-white/40 hover:text-white/60 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-red-900/30 text-white" style={{ background: "#001428" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-white">Remover comunidade?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-white/50 font-mono">
            A comunidade <span className="text-white">{deleteTarget?.sigla || deleteTarget?.nome}</span> será removida permanentemente.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/50 hover:text-white bg-transparent">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aura Evaluation Dialog — Aliado registers their own Aura perception for a vitrine candidate */}
      <Dialog open={!!auraDialogConvite} onOpenChange={open => { if (!open) resetAuraDialog(); }}>
        <DialogContent className="max-w-2xl border-brand-gold/20 text-white" style={{ background: "#001428" }}>
          <DialogHeader>
            <DialogTitle className="font-mono text-brand-gold flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Percepção de Aura
            </DialogTitle>
            <DialogDescription className="text-white/40 font-mono text-xs">
              Como você percebe {auraDialogConvite?.candidatoNome} na rede BUILT? Escolha até 3 palavras ou use a análise com IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {auraSelectedWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {auraSelectedWords.map(w => (
                  <button key={w} onClick={() => toggleAuraWord(w)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border border-brand-gold/40 bg-brand-gold/10 text-brand-gold">
                    {w} <X className="w-2.5 h-2.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex rounded-lg border border-brand-gold/25 overflow-hidden text-xs font-semibold" style={{ background: "rgba(255,255,255,0.03)" }}>
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 transition-all"
                style={auraEvalMode === "palavras"
                  ?{ background: "rgba(215,187,125,0.18)", color: "#D7BB7D", borderRight: "1px solid rgba(215,187,125,0.18)" }
                  : { color: "rgba(255,255,255,0.58)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
                onClick={() => setAuraEvalMode("palavras")}
                data-testid="btn-aura-modo-palavras-notificacoes"
              >
                <Tags className="w-3.5 h-3.5" />
                Escolher palavras
              </button>
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 transition-all"
                style={auraEvalMode === "ia" ?{ background: "rgba(215,187,125,0.18)", color: "#D7BB7D" } : { color: "rgba(255,255,255,0.58)" }}
                onClick={() => setAuraEvalMode("ia")}
                data-testid="btn-aura-modo-ia-notificacoes"
              >
                <Bot className="w-3.5 h-3.5" />
                Analisar com IA
              </button>
            </div>

            {auraEvalMode === "ia" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-white/50">
                    Descreva a pessoa, anexe um arquivo, grave ou envie um áudio. A IA sugerirá até 3 palavras do léxico.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-white/10 bg-transparent text-xs text-white/65 hover:text-white"
                      onClick={() => auraFileInputRef.current?.click()}
                      disabled={extrairAuraArquivoMutation.isPending}
                      data-testid="btn-aura-anexar-notificacoes"
                    >
                      {extrairAuraArquivoMutation.isPending ?<Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Paperclip className="w-3.5 h-3.5 mr-1.5" />}
                      {extrairAuraArquivoMutation.isPending ?"Lendo..." : "Anexar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-white/10 bg-transparent text-xs text-white/65 hover:text-white"
                      onClick={requestAuraRecording}
                      disabled={transcreverAuraAudioMutation.isPending}
                      data-testid="btn-aura-audio-notificacoes"
                      title={auraMicBlocked ? "Microfone bloqueado. Use Enviar áudio para escolher uma gravação." : undefined}
                    >
                      {transcreverAuraAudioMutation.isPending ?(
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : auraRecording ?(
                        <Square className="w-3.5 h-3.5 mr-1.5 text-red-300" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {transcreverAuraAudioMutation.isPending ?"Transcrevendo..." : auraRecording ?"Parar áudio" : auraMicBlocked ?"Ativar microfone" : "Gravar áudio"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-white/10 bg-transparent text-xs text-white/65 hover:text-white"
                      onClick={() => auraAudioFileInputRef.current?.click()}
                      disabled={transcreverAuraAudioMutation.isPending || auraRecording}
                      data-testid="btn-aura-enviar-audio-notificacoes"
                    >
                      {transcreverAuraAudioMutation.isPending ?(
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Enviar áudio
                    </Button>
                    <input
                      ref={auraFileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md,.csv,text/plain,application/pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAuraArquivoNome(file.name);
                          extrairAuraArquivoMutation.mutate(file);
                        }
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={auraAudioFileInputRef}
                      type="file"
                      accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/webm,audio/ogg,audio/3gpp,audio/amr,.mp3,.m4a,.aac,.wav,.webm,.ogg,.3gp,.amr"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const isAudio = file.type.startsWith("audio/") || /\.(mp3|m4a|aac|wav|webm|ogg|3gp|amr)$/i.test(file.name);
                          if (!isAudio) {
                            toast({
                              title: "Arquivo inválido",
                              description: "Selecione uma gravação de áudio do celular.",
                              variant: "destructive",
                            });
                            e.target.value = "";
                            return;
                          }
                          setAuraArquivoNome(file.name);
                          setAuraEvalMode("ia");
                          transcreverAuraAudioMutation.mutate({ blob: file, filename: file.name });
                        }
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>

                {auraArquivoNome && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs text-white/60" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <FileText className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                    <span className="truncate flex-1">{auraArquivoNome}</span>
                    <button type="button" onClick={() => setAuraArquivoNome(null)} className="text-white/40 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <Textarea
                  value={auraTextoIA}
                  onChange={e => setAuraTextoIA(e.target.value)}
                  rows={5}
                  placeholder={`Ex: ${auraDialogConvite?.candidatoNome?.split(" ")[0] || "Esta pessoa"} demonstra confiança, entrega combinados, se relaciona bem e contribui para a comunidade...`}
                  className="resize-none text-sm"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.86)" }}
                  data-testid="textarea-aura-ia-notificacoes"
                />
                <Button
                  type="button"
                  className="w-full text-xs font-mono font-bold"
                  style={{ background: "linear-gradient(135deg,#D7BB7D,#b89a50)", color: "#001D34" }}
                  disabled={auraTextoIA.trim().length < 10 || analisarAuraTextoMutation.isPending}
                  onClick={() => auraDialogConvite && analisarAuraTextoMutation.mutate({ texto: auraTextoIA, membro_nome: auraDialogConvite.candidatoNome })}
                  data-testid="btn-aura-analisar-ia-notificacoes"
                >
                  {analisarAuraTextoMutation.isPending ?<Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  Analisar com IA
                </Button>
              </div>
            )}

            {auraEvalMode === "palavras" && (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <Input
                    value={auraSearch}
                    onChange={e => setAuraSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="pl-8 h-8 text-xs font-mono"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {auraLexico
                    .map((item: any) =>
                      typeof item === "string"
                        ?item.trim()
                        : String(item.canonico || item.palavra || item.nome || item.label || item.termo || "").trim()
                    )
                    .filter(word => word && (!auraSearch || word.toLowerCase().includes(auraSearch.toLowerCase())))
                    .map(word => {
                      const isSelected = auraSelectedWords.includes(word);
                      const isDisabled = auraSelectedWords.length >= 3 && !isSelected;
                      return (
                        <button
                          key={word}
                          onClick={() => !isDisabled && toggleAuraWord(word)}
                          disabled={isDisabled}
                          className={`min-h-8 text-left px-2.5 py-1.5 rounded-lg border text-xs font-mono leading-snug transition-all ${isSelected ?"border-brand-gold/60 bg-brand-gold/15 text-brand-gold" : isDisabled ?"border-white/10 text-white/35 cursor-not-allowed" : "border-white/15 bg-white/[0.03] text-white/75 hover:border-brand-gold/35 hover:text-white hover:bg-white/[0.07]"}`}
                        >
                          {word}
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetAuraDialog}
              className="border-white/10 text-white/50 hover:text-white bg-transparent text-xs font-mono"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => auraDialogConvite && avaliarAuraMutation.mutate({ avaliacaoToken: auraDialogConvite.avaliacaoToken, palavras: auraSelectedWords })}
              disabled={auraSelectedWords.length === 0 || avaliarAuraMutation.isPending}
              className="text-xs font-mono font-bold"
              style={{ background: "linear-gradient(135deg,#D7BB7D,#b89a50)", color: "#001D34" }}
              data-testid="btn-confirmar-aura-aliado"
            >
              {avaliarAuraMutation.isPending ?<Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Sparkles className="w-3 h-3 mr-1.5" />}
              Registrar Percepção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={auraMicPromptOpen} onOpenChange={setAuraMicPromptOpen}>
        <AlertDialogContent className="border-brand-gold/20 text-white" style={{ background: "#001428" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-brand-gold flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Ativar microfone?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm text-white/65">
            <p>
              Para gravar a percepção de Aura por áudio, o navegador precisa liberar o microfone deste aparelho.
            </p>
            {auraMicBlocked && (
              <p className="rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-red-100">
                O microfone parece bloqueado. Se o navegador não mostrar a permissão novamente, libere o microfone nas configurações do site ou use Enviar áudio.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/60 hover:text-white bg-transparent">
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-transparent text-white/70 hover:text-white"
              onClick={() => {
                setAuraMicPromptOpen(false);
                window.setTimeout(() => auraAudioFileInputRef.current?.click(), 50);
              }}
            >
              <Paperclip className="w-4 h-4 mr-2" />
              Enviar áudio
            </Button>
            <AlertDialogAction
              className="font-mono font-bold"
              style={{ background: "linear-gradient(135deg,#D7BB7D,#b89a50)", color: "#001D34" }}
              onClick={() => {
                setAuraMicPromptOpen(false);
                startAuraRecording();
              }}
            >
              <Mic className="w-4 h-4 mr-2" />
              Ativar microfone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ComunidadeCard({ comunidade: c, canEdit, onEdit, onDelete }: {
  comunidade: Comunidade;
  canEdit?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [, navigate] = useLocation();
  const aliado = resolveAliado(c);
  const membros = resolveMembros(c);
  const bias = resolveBias(c);
  const foto = fotoUrl(aliado?.foto_perfil);
  return (
    <div
      className="relative rounded-2xl overflow-hidden border transition-all duration-200 hover:border-brand-gold/25 cursor-pointer"
      style={{
        background: "linear-gradient(145deg, #071626, #040e1c)",
        borderColor: "rgba(255,255,255,0.06)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      }}
      onClick={() => navigate(`/comunidade/${c.id}`)}
      data-testid={`card-comunidade-${c.id}`}
    >
      {/* Top gold line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.4), transparent)" }} />

      <div className="p-5 space-y-4">
        {/* Sigla + Status */}
        <div className="flex items-start justify-between gap-2">
          <div>
            {c.sigla && (
              <p className="text-[10px] font-mono text-brand-gold/50 tracking-[0.2em] uppercase mb-1">{c.sigla}</p>
            )}
            <h3 className="text-sm font-bold text-white font-mono leading-snug" data-testid={`text-nome-${c.id}`}>
              {c.nome || "—"}
            </h3>
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono border ${c.status === "ativa" ?"border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-white/30"}`}>
            {c.status || "ativa"}
          </span>
        </div>

        {/* Localidade */}
        <div className="flex items-center gap-1.5 text-xs text-white/40 font-mono">
          <MapPin className="w-3 h-3 text-brand-gold/40" />
          {[c.territorio, c.pais].filter(Boolean).join(", ")}
        </div>

        {/* Aliado */}
        {aliado && (
          <div className="flex items-center gap-2.5 py-2 border-t border-white/5">
            <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-brand-gold/20"
              style={{ background: foto ?"transparent" : "rgba(215,187,125,0.08)" }}>
              {foto ?(
                <img src={foto} alt={aliado.nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[9px] font-bold text-brand-gold/60">{getInitials(aliado.nome)}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Aliado BUILT</p>
              <p className="text-xs text-white/70 font-mono truncate">{aliado.nome}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-white/30 font-mono">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 text-brand-gold/30" />
            {membros.length} membro{membros.length !== 1 ?"s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-brand-gold/30" />
            {bias.length} BIA{bias.length !== 1 ?"s" : ""}
          </span>
        </div>
      </div>

      {/* Actions — only visible to the Aliado Built or admin */}
      {canEdit && (
        <div className="flex border-t border-white/5">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono text-white/40 hover:text-brand-gold hover:bg-white/5 transition-colors"
            data-testid={`btn-edit-comunidade-${c.id}`}
          >
            <Pencil className="w-3 h-3" />
            Editar
          </button>
          <div className="w-px bg-white/5" />
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono text-white/40 hover:text-red-400 hover:bg-red-950/20 transition-colors"
            data-testid={`btn-delete-comunidade-${c.id}`}
          >
            <Trash2 className="w-3 h-3" />
            Remover
          </button>
        </div>
      )}
    </div>
  );
}

