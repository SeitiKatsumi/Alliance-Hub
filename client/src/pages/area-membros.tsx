import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Search, Building2, MapPin, Globe, Phone, FileText,
  MessageSquare, Lock, Shield, Users
} from "lucide-react";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from "react-simple-maps";
import { apiRequest } from "@/lib/queryClient";

const WORLD_GEO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface MembroBuilt {
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

function fotoUrl(m: MembroBuilt): string | null {
  const f = m.foto || m.foto_perfil;
  if (!f) return null;
  return `/api/assets/${f}?width=200&height=200&fit=cover`;
}

function fotoUrlMap(m: MembroBuilt): string | null {
  const f = m.foto || m.foto_perfil;
  if (!f) return null;
  return `/api/assets/${f}?width=80&height=80&fit=cover`;
}

function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ===== MAPA DE MEMBROS =====
function MapaMembros({ membros }: { membros: MembroBuilt[] }) {
  const [, navigate] = useLocation();
  const [hoveredMembro, setHoveredMembro] = useState<MembroBuilt | null>(null);
  const [selectedMembro, setSelectedMembro] = useState<MembroBuilt | null>(null);
  const [clusterItems, setClusterItems] = useState<MembroBuilt[] | null>(null);
  const [zoom, setZoom] = useState(1.2);
  const [center, setCenter] = useState<[number, number]>([10, 20]);

  const withCoords = useMemo(
    () => membros.filter(m => m.latitude != null && m.longitude != null),
    [membros]
  );

  const clusters = useMemo(() => {
    const THRESHOLD = 1.5;
    const result: { center: [number, number]; items: MembroBuilt[] }[] = [];
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
          MAPA DE MEMBROS
        </h2>
      </div>

      {/* Top-right stats */}
      <div className="absolute top-5 right-6 z-20 text-right font-mono">
        <div className="mb-2">
          <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">Membros</p>
          <p className="text-4xl font-bold leading-none" style={{ color: "#D7BB7D" }}>{membros.length}</p>
        </div>
        <p className="text-[9px] text-brand-gold/30">{withCoords.length} geolocalizados</p>
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
            const isSelected = !isMulti && selectedMembro?.id === cluster.items[0]?.id;
            const isClusterSelected = isMulti && clusterItems === cluster.items;
            const r = Math.max(2, 5 / zoom);
            const foto = !isMulti ? fotoUrlMap(cluster.items[0]) : null;
            const photoR = r * 2.2;
            const clipId = `clip-mb-${idx}`;

            return (
              <Marker
                key={idx}
                coordinates={[lng, lat]}
                onMouseEnter={() => { if (!isMulti) setHoveredMembro(cluster.items[0]); }}
                onMouseLeave={() => setHoveredMembro(null)}
                onClick={() => {
                  setHoveredMembro(null);
                  if (isMulti) { setSelectedMembro(null); setClusterItems(cluster.items); }
                  else { setClusterItems(null); setSelectedMembro(cluster.items[0]); }
                }}
              >
                <g style={{ cursor: "pointer" }}>
                  {/* Glow ring */}
                  <circle
                    r={r * (isSelected || isClusterSelected ? 5 : 4)}
                    fill="#D7BB7D"
                    fillOpacity={isSelected || isClusterSelected ? 0.15 : 0.06}
                  >
                    <animate attributeName="r" from={r * 2.8} to={r * 5} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.35" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  {/* Gold border */}
                  <circle
                    r={photoR + r * 0.35}
                    fill="none"
                    stroke="#D7BB7D"
                    strokeWidth={r * (isSelected ? 0.55 : 0.28)}
                    strokeOpacity={isSelected || isClusterSelected ? 0.9 : 0.6}
                  />
                  {/* Photo or initials */}
                  <defs>
                    <clipPath id={clipId}>
                      <circle r={photoR} />
                    </clipPath>
                  </defs>
                  {isMulti ? (
                    <>
                      <circle r={photoR} fill="#001D34" clipPath={`url(#${clipId})`} />
                      <text textAnchor="middle" dominantBaseline="central"
                        fontSize={r * 1.4} fontWeight="bold" fontFamily="monospace" fill="#D7BB7D">
                        {cluster.items.length}
                      </text>
                    </>
                  ) : foto ? (
                    <image
                      href={foto}
                      x={-photoR} y={-photoR}
                      width={photoR * 2} height={photoR * 2}
                      clipPath={`url(#${clipId})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  ) : (
                    <>
                      <circle r={photoR} fill="#001D34" clipPath={`url(#${clipId})`} />
                      <text textAnchor="middle" dominantBaseline="central"
                        fontSize={r * 1.1} fontWeight="bold" fontFamily="monospace" fill="#D7BB7D" opacity={0.8}>
                        {getInitials(cluster.items[0].nome)}
                      </text>
                    </>
                  )}
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Decorative scan line */}
      <div className="absolute left-0 right-0 h-px pointer-events-none z-10"
        style={{ background: "linear-gradient(to right, transparent, #D7BB7D40 20%, #D7BB7D60 50%, #D7BB7D40 80%, transparent)", animation: "scanLineMembros 6s linear infinite", top: 0 }}
      />
      <style dangerouslySetInnerHTML={{ __html: `@keyframes scanLineMembros { 0% { top: 0%; opacity: 0; } 5% { opacity: 1; } 95% { opacity: 1; } 100% { top: 100%; opacity: 0; } }` }} />

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

      {/* Selected member panel */}
      {selectedMembro && (
        <div className="absolute bottom-0 left-0 right-0 z-30 transition-all duration-300"
          style={{ background: "linear-gradient(to top, rgba(0,8,20,0.98) 0%, rgba(0,12,28,0.96) 70%, transparent 100%)", padding: "32px 24px 18px" }}>
          <div className="absolute top-3 right-4 flex items-center gap-3">
            <button onClick={() => navigate(`/membro/${selectedMembro.id}`)}
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
                <span className="text-sm font-bold text-brand-gold/70">{getInitials(selectedMembro.nome)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] text-brand-gold/40 tracking-[0.3em] uppercase">BUILT Proud Member</p>
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

// ===== MEMBER CARD =====
function MembroCard({ membro: m, isOwn }: { membro: MembroBuilt; isOwn: boolean }) {
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
        onClick={() => navigate(`/membro/${m.id}`)}
        data-testid={`card-membro-${m.id}`}
      >
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: isOwn
            ? "linear-gradient(90deg, transparent, rgba(215,187,125,0.6), transparent)"
            : "linear-gradient(90deg, transparent, rgba(215,187,125,0.3), transparent)"
          }} />
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-brand-gold/20" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-brand-gold/20" />

        {/* BUILT Proud Member badge */}
        <img
          src="/built-proud-member.png"
          alt="BUILT Proud Member"
          title="BUILT Proud Member"
          className="absolute top-2 right-2 w-auto object-contain z-10"
          style={{ height: 48 }}
          data-testid="badge-proud-member-card"
        />

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
                data-testid={`link-site-membro-${m.id}`}
              >
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">
                  {m.link_site.replace(/^https?:\/\/(www\.)?/, "")}
                </span>
              </a>
            )}
          </div>

          {/* Quote button */}
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
                data-testid={`btn-orcamento-membro-${m.id}`}
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
            <div className="flex items-center gap-3 p-3 rounded-lg border border-white/8"
              style={{ background: "rgba(255,255,255,0.03)" }}>
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
              <Label className="text-xs font-mono text-white/50">Descreva sua necessidade</Label>
              <Textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 resize-none min-h-[100px]"
                placeholder="Ex: Preciso de orçamento para instalação elétrica em imóvel comercial de 200m²..."
                autoFocus
                data-testid={`textarea-orcamento-membro-${m.id}`}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setOrcamentoOpen(false)} className="text-white/40 hover:text-white/70 text-sm">
              Cancelar
            </Button>
            {m.email && (
              <Button onClick={handleEnviarEmail} variant="outline"
                className="border-white/15 text-white/60 hover:text-white hover:border-white/30 font-mono text-xs gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Enviar por E-mail
              </Button>
            )}
            {waLink() && (
              <Button onClick={handleEnviarWa} className="font-mono text-xs gap-1.5"
                style={{ background: "#25D366", color: "#fff" }}
                data-testid={`btn-enviar-orcamento-wa-membro-${m.id}`}>
                <Phone className="w-3.5 h-3.5" />
                Enviar via WhatsApp
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const ESTADOS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

// ===== MAIN PAGE =====
export default function AreMembroPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");

  const membroId = user?.membro_directus_id;

  // Fetch current user's membro data to check BUILT_PROUD_MEMBER access
  const { data: myMembro, isLoading: loadingMe } = useQuery<any>({
    queryKey: ["/api/membros", membroId],
    queryFn: () => fetch(`/api/membros/${membroId}`).then(r => r.json()),
    enabled: !!membroId,
  });

  const isProudMember = useMemo(() => {
    if (!myMembro) return false;
    const redes = myMembro.Outras_redes_as_quais_pertenco || [];
    return Array.isArray(redes) && redes.includes("BUILT_PROUD_MEMBER");
  }, [myMembro]);

  // Only fetch membros if user is a Proud Member
  const { data: membros = [], isLoading } = useQuery<MembroBuilt[]>({
    queryKey: ["/api/membros-built"],
    queryFn: async () => {
      const r = await fetch("/api/membros-built");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isProudMember,
  });

  const filtered = useMemo(() => {
    return membros.filter(m => {
      const nome = (m.nome || "").toLowerCase();
      const empresa = (m.empresa || "").toLowerCase();
      const esp = (m.especialidade || "").toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || nome.includes(q) || empresa.includes(q) || esp.includes(q);
      const matchEstado = filterEstado === "all" || (m.estado || "").toUpperCase() === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [membros, search, filterEstado]);

  // Loading state
  if (loadingMe || (membroId && loadingMe)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#020b16" }}>
        <div className="w-8 h-8 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin" />
      </div>
    );
  }

  // Access denied
  if (!isProudMember) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 p-8"
        style={{ background: "radial-gradient(ellipse at 50% 40%, #001428 0%, #000c1f 60%, #000408 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,187,125,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.04) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
        <div className="relative z-10 text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl border border-brand-gold/20 flex items-center justify-center"
              style={{ background: "rgba(215,187,125,0.06)" }}>
              <Lock className="w-10 h-10 text-brand-gold/60" />
            </div>
          </div>
          <p className="text-[11px] text-brand-gold/40 tracking-[0.4em] uppercase font-mono mb-2">// Acesso Restrito</p>
          <h1 className="text-3xl font-bold font-mono tracking-wide mb-3" style={{ color: "#D7BB7D" }}>MEMBROS BUILT</h1>
          <div className="w-16 h-px mx-auto mb-5" style={{ background: "linear-gradient(to right, transparent, #D7BB7D60, transparent)" }} />
          <div className="p-4 rounded-xl border border-brand-gold/15 mb-4" style={{ background: "rgba(215,187,125,0.05)" }}>
            <img src="/built-proud-member.png" alt="BUILT Proud Member" className="h-16 w-auto mx-auto mb-3 object-contain" />
            <p className="text-sm text-white/50 font-mono leading-relaxed">
              Esta área é exclusiva para <span style={{ color: "#D7BB7D" }}>BUILT Proud Members</span>.<br />
              Entre em contato com a equipe BUILT para obter o selo e ter acesso.
            </p>
          </div>
          <p className="text-xs text-white/20 font-mono">Seu perfil não possui o selo BUILT Proud Member.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-membros-title">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
              <Shield className="w-6 h-6" />
            </div>
            Membros BUILT
          </h1>
          <p className="text-sm text-white/40 font-mono mt-1">Área exclusiva BUILT Proud Members</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-gold/20"
          style={{ background: "rgba(215,187,125,0.06)" }}>
          <Users className="w-4 h-4 text-brand-gold/60" />
          <span className="text-sm font-mono text-brand-gold/80">{membros.length} membros</span>
        </div>
      </div>

      {/* Map */}
      <MapaMembros membros={membros} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Buscar membro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-brand-gold/40"
            data-testid="input-busca-membros"
          />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white focus:border-brand-gold/40" data-testid="select-estado-membros">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="bg-[#001428] border-white/10 text-white max-h-64">
            <SelectItem value="all" className="text-white/80 focus:bg-brand-gold/10 focus:text-white">Todos os estados</SelectItem>
            {ESTADOS_BR.map(e => (
              <SelectItem key={e} value={e} className="text-white/80 focus:bg-brand-gold/10 focus:text-white">{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || filterEstado !== "all") && (
          <Button variant="ghost" size="sm"
            onClick={() => { setSearch(""); setFilterEstado("all"); }}
            className="text-white/40 hover:text-white/70 font-mono text-xs"
            data-testid="btn-limpar-filtros-membros">
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/3 h-52 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 font-mono text-sm">Nenhum membro encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(m => (
            <MembroCard key={m.id} membro={m} isOwn={m.id === membroId} />
          ))}
        </div>
      )}
    </div>
  );
}
