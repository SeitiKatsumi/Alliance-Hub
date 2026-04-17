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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Store, Search, MapPin, Building2,
  Users, X, Plus, Pencil, Trash2, Loader2,
  FileText, Mail, MessageSquare, Globe, Phone
} from "lucide-react";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from "react-simple-maps";
import { getAllTipos, getNucleoForTipo, getTipoDisplayName } from "@/lib/ramos-segmentos";

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

  const estados = useMemo(() => {
    const s = new Set(membros.map(m => m.estado).filter(Boolean));
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
        <p className="text-[9px] text-brand-gold/30">{estados} estados · {withCoords.length} geolocalizados</p>
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
                    {m.especialidade && <p className="text-[10px] text-brand-gold/40 truncate">{m.especialidade}</p>}
                  </div>
                  {m.empresa && <p className="text-[10px] text-brand-gold/70 shrink-0 truncate max-w-[120px]">{m.empresa}</p>}
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
  especialidade_id: string;
  cidade: string;
  estado: string;
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

export default function VitrinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterEspecialidade, setFilterEspecialidade] = useState("all");
  const [filterEstado, setFilterEstado] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEspOpen, setNewEspOpen] = useState(false);
  const [newEspNome, setNewEspNome] = useState("");
  const [form, setForm] = useState<CardForm>({
    nome: "", cargo: "", empresa: "", especialidade_id: "",
    cidade: "", estado: "", whatsapp: "", email: "",
    perfil_aliado: "", nucleo_alianca: "", tipo_alianca: "", link_site: ""
  });

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

  // Fetch especialidades options from Directus
  const { data: especialidadesOptions = [] } = useQuery<EspecialidadeOption[]>({
    queryKey: ["/api/especialidades"],
    queryFn: () => fetch("/api/especialidades").then(r => r.json()),
  });


  const myCardExists = !!myMembro?.na_vitrine;

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
      // Match specialty by name from the vitrine card (fields=* returns junction IDs, not nested UUIDs)
      const myCard = membros.find(m => m.id === membroId);
      const matchedEsp = especialidadesOptions.find(
        e => e.nome_especialidade === myCard?.especialidade
      );
      setForm({
        nome: myMembro.nome || "",
        cargo: myMembro.cargo || myMembro.responsavel_cargo || "",
        empresa: myMembro.empresa || myMembro.nome_fantasia || "",
        especialidade_id: matchedEsp?.id ?? "",
        cidade: myMembro.cidade || "",
        estado: myMembro.estado || "",
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
    onError: () => toast({ title: "Erro ao salvar card", variant: "destructive" }),
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

  // Create new especialidade in Directus and auto-select it
  const createEspMutation = useMutation({
    mutationFn: (nome: string) =>
      apiRequest("POST", "/api/especialidades", { nome_especialidade: nome }),
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/especialidades"] });
      setForm(f => ({ ...f, especialidade_id: data.id }));
      setNewEspNome("");
      setNewEspOpen(false);
      toast({ title: "Especialidade criada e selecionada!" });
    },
    onError: () => toast({ title: "Erro ao criar especialidade", variant: "destructive" }),
  });

  function handleSubmit() {
    const { especialidade_id, ...rest } = form;
    const payload: Record<string, any> = { ...rest, na_vitrine: true };
    // Send Especialidades as Directus M2M array (replaces existing)
    payload.Especialidades = especialidade_id
      ? [{ especialidades_id: especialidade_id }]
      : [];
    saveMutation.mutate(payload as any);
  }

  const especialidades = useMemo(() => {
    const set = new Set<string>();
    membros.forEach(m => { if (m.especialidade) set.add(m.especialidade); });
    return Array.from(set).sort();
  }, [membros]);

  const estados = useMemo(() => {
    const set = new Set<string>();
    membros.forEach(m => { if (m.estado) set.add(m.estado.toUpperCase()); });
    return Array.from(set).sort();
  }, [membros]);

  const filtered = useMemo(() => {
    return membros.filter(m => {
      const nome = (m.nome || "").toLowerCase();
      const empresa = (m.empresa || "").toLowerCase();
      const esp = (m.especialidade || "").toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || nome.includes(q) || empresa.includes(q) || esp.includes(q);
      const matchEsp = filterEspecialidade === "all" || m.especialidade === filterEspecialidade;
      const matchEstado = filterEstado === "all" || (m.estado || "").toUpperCase() === filterEstado;
      return matchSearch && matchEsp && matchEstado;
    });
  }, [membros, search, filterEspecialidade, filterEstado]);

  const hasFilters = search || filterEspecialidade !== "all" || filterEstado !== "all";

  function clearFilters() {
    setSearch("");
    setFilterEspecialidade("all");
    setFilterEstado("all");
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
            Vitrine BUILT
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Encontre fornecedores, prestadores e empresas da rede BUILT
            {hasFilters && ` · ${filtered.length} exibindo`}
          </p>
        </div>

        {membroId && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* World Map */}
      {isLoading ? (
        <Skeleton className="h-[440px] rounded-2xl" />
      ) : (
        <WorldMapHeader membros={membros} />
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

        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-32 h-9 text-sm" data-testid="select-vitrine-estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            {estados.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
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
              <Field label="Nome / Razão Social">
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
              <Field label="Ramo de atuação">
                <Select
                  value={form.especialidade_id}
                  onValueChange={v => setForm(f => ({ ...f, especialidade_id: v }))}
                >
                  <SelectTrigger
                    className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40"
                    data-testid="select-card-especialidade"
                  >
                    <SelectValue placeholder="Selecione uma especialidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#001428] border-white/10 text-white max-h-64">
                    {especialidadesOptions.map(e => (
                      <SelectItem
                        key={e.id}
                        value={e.id}
                        className="text-white/80 focus:bg-brand-gold/10 focus:text-white"
                      >
                        {e.nome_especialidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!form.especialidade_id && (
                  <button
                    type="button"
                    onClick={() => { setNewEspNome(""); setNewEspOpen(true); }}
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-mono text-brand-gold/60 hover:text-brand-gold transition-colors"
                    data-testid="btn-criar-especialidade"
                  >
                    <Plus className="w-3 h-3" />
                    Não encontrou? Criar nova especialidade
                  </button>
                )}
              </Field>

              {/* Sub-dialog: criar nova especialidade */}
              <Dialog open={newEspOpen} onOpenChange={setNewEspOpen}>
                <DialogContent
                  className="border-brand-gold/20 text-white max-w-sm"
                  style={{ background: "#001428" }}
                >
                  <DialogHeader>
                    <DialogTitle className="font-mono text-brand-gold">Novo Ramo de Atuação</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <Label className="text-xs font-mono text-white/50 mb-1.5 block">Nome *</Label>
                      <Input
                        value={newEspNome}
                        onChange={e => setNewEspNome(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && newEspNome.trim()) {
                            createEspMutation.mutate(newEspNome.trim());
                          }
                        }}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                        placeholder="Ex: Gestão de contratos"
                        autoFocus
                        data-testid="input-nova-especialidade"
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setNewEspOpen(false)}
                      className="text-white/50 hover:text-white"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => createEspMutation.mutate(newEspNome.trim())}
                      disabled={!newEspNome.trim() || createEspMutation.isPending}
                      className="font-mono"
                      style={{ background: "#D7BB7D", color: "#001D34" }}
                      data-testid="btn-confirmar-nova-especialidade"
                    >
                      {createEspMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1" />
                          Criar e selecionar
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Field label="Cidade">
                  <Input
                    value={form.cidade}
                    onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                    placeholder="Sua cidade"
                    data-testid="input-card-cidade"
                  />
                </Field>
              </div>
              <Field label="Estado">
                <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-card-estado">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050f1c] border-white/10">
                    {ESTADOS_BR.map(uf => (
                      <SelectItem key={uf} value={uf} className="text-white">{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

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
