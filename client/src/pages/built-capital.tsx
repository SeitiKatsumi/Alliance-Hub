import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from "react-simple-maps";
import { MapWheelGuard } from "@/components/map-wheel-guard";
import {
  MapPin, Phone, Mail, Building2, TrendingUp, Globe, Megaphone, Target, ChevronRight,
  ImageIcon, Loader2, Upload, CheckCircle2
} from "lucide-react";
import { formatSegmentosDisplay } from "@/lib/ramos-segmentos";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const WORLD_GEO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Parceiro {
  id: string;
  nome?: string;
  cargo?: string;
  empresa?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  whatsapp?: string;
  email?: string;
  foto?: string | null;
  foto_perfil?: string | null;
  logo_empresa?: string | { id?: string } | null;
  ramo_atuacao?: string | null;
  segmento?: string | null;
  especialidade?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  link_site?: string | null;
  Outras_redes_as_quais_pertenco?: string[] | null;
}

interface AnuncioCapital {
  id: string;
  titulo?: string | null;
  descricao?: string | null;
  link?: string | null;
  imagem_url?: string | null;
  imagem_directus_id?: string | null;
  slot_tipo?: string | null;
  ativo?: boolean | null;
  pagamento_status?: string | null;
  pagamento_url?: string | null;
  pagamento_pais?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}

interface ChamadaCapital {
  id: string;
  nome_oportunidade?: string | null;
  tipo?: string | null;
  valor_origem_opa?: string | number | null;
  Minimo_esforco_multiplicador?: string | number | null;
  nucleo_alianca?: string | null;
  localizacao?: string | null;
  status?: string | null;
  imagem_url?: string | null;
  imagem_directus_id?: string | null;
}

const ASSET_CACHE_VERSION = "directus-db-20260616";

function directusAssetId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.id || value.uuid || value.directus_files_id || value.file || null;
  return String(value);
}

function assetUrl(value: any, params = ""): string | null {
  if (!value) return null;
  if (typeof value === "string" && value.startsWith("/api/assets/")) {
    return `${value}${value.includes("?") ? "&" : "?"}v=${ASSET_CACHE_VERSION}`;
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  const id = directusAssetId(value);
  if (!id) return null;
  const query = params ? `${params}&v=${ASSET_CACHE_VERSION}` : `v=${ASSET_CACHE_VERSION}`;
  return `/api/assets/${id}?${query}`;
}

function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const raw = String(value).trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function brl(value: string | number | null | undefined): string {
  const parsed = num(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function safeHref(link?: string | null) {
  const value = typeof link === "string" ? link.trim() : "";
  if (!value) return undefined;
  return value.startsWith("http") ? value : `https://${value}`;
}

function visibleTitle(title?: string | null) {
  const value = typeof title === "string" ? title.trim() : "";
  return value === "Destaque da Vitrine" || value === "Destaque BUILT Capital" ? "" : value;
}

function fotoUrl(p: Parceiro, size = 200): string | null {
  const f = p.foto || p.foto_perfil;
  if (!f) return null;
  return `/api/assets/${f}?width=${size}&height=${size}&fit=cover`;
}

function logoEmpresaUrl(p: Parceiro): string | null {
  const logo = p.logo_empresa;
  if (!logo) return null;
  const id = typeof logo === "string" ?logo : logo.id;
  return id ?`/api/assets/${id}?width=160&height=80&fit=contain` : null;
}

function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function avatarColor(id: string): string {
  const colors = ["#1a3a5c", "#1e3a2f", "#3a1a2f", "#2a2a1a", "#1a2a3a", "#2f1a3a"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function normalizeFilterText(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;/|()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTerritorioKey(value?: string | null): string {
  return normalizeFilterText(value)
    .replace(/\b(brasil|brazil|japao|japan|portugal|usa|eua|estados unidos|united states)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatFilterLabel(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((part) => part ? part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1) : part)
    .join(" ");
}

// ===== MAPA =====
function MapaParceiros({ parceiros }: { parceiros: Parceiro[] }) {
  const [, navigate] = useLocation();
  const [hovered, setHovered] = useState<Parceiro | null>(null);
  const [selected, setSelected] = useState<Parceiro | null>(null);
  const [clusterItems, setClusterItems] = useState<Parceiro[] | null>(null);
  const [zoom, setZoom] = useState(1.2);
  const [center, setCenter] = useState<[number, number]>([10, 20]);

  const withCoords = useMemo(
    () => parceiros.filter(p => p.latitude != null && p.longitude != null),
    [parceiros]
  );

  const clusters = useMemo(() => {
    const THRESHOLD = 1.5;
    const result: { center: [number, number]; items: Parceiro[] }[] = [];
    for (const p of withCoords) {
      const lng = p.longitude!;
      const lat = p.latitude!;
      const existing = result.find(
        c => Math.abs(c.center[0] - lng) < THRESHOLD && Math.abs(c.center[1] - lat) < THRESHOLD
      );
      if (existing) existing.items.push(p);
      else result.push({ center: [lng, lat], items: [p] });
    }
    return result;
  }, [withCoords]);

  return (
    <div
      className="relative aspect-[16/9] max-h-[360px] overflow-hidden rounded-2xl border border-brand-gold/20"
      style={{ background: "radial-gradient(ellipse at 50% 110%, #001428 0%, #000c1f 55%, #000408 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(37,99,235,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.08) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />
      {[["top-0 left-0","border-t-2 border-l-2 rounded-tl-2xl"],["top-0 right-0","border-t-2 border-r-2 rounded-tr-2xl"],["bottom-0 left-0","border-b-2 border-l-2 rounded-bl-2xl"],["bottom-0 right-0","border-b-2 border-r-2 rounded-br-2xl"]].map(([pos, cls]) => (
        <div key={pos} className={`absolute ${pos} w-12 h-12 border-brand-gold/40 pointer-events-none ${cls}`} />
      ))}

      <div className="absolute top-4 left-4 z-20 sm:top-5 sm:left-6">
        <p className="text-[10px] text-white/60 tracking-[0.35em] uppercase font-mono">// BUILT Capital</p>
        <h2 className="mt-0.5 max-w-[260px] font-mono text-base font-bold leading-tight tracking-[0.08em] text-white sm:max-w-[360px] sm:text-lg sm:tracking-[0.1em] xl:max-w-none xl:text-xl xl:tracking-[0.12em]">
          MAPA DE PARCEIROS DE CAPITAL
        </h2>
      </div>

      <div className="absolute top-4 right-4 z-20 text-right font-mono sm:top-5 sm:right-6">
        <div className="mb-2">
          <p className="text-[9px] text-white/55 tracking-widest uppercase">Parceiros</p>
          <p className="text-2xl font-bold leading-none text-white sm:text-3xl xl:text-4xl">{parceiros.length}</p>
        </div>
        <p className="text-[9px] text-white/45">{withCoords.length} geolocalizados</p>
      </div>

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
            style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(37,99,235,0.4)", color: "#3B82F6" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(37,99,235,0.16)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          >{label}</button>
        ))}
      </div>

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
                  default: { fill: "#011630", stroke: "#2563EB36", strokeWidth: 0.3, outline: "none" },
                  hover:   { fill: "#011630", stroke: "#2563EB36", strokeWidth: 0.3, outline: "none" },
                  pressed: { fill: "#011630", outline: "none" },
                }}
              />
            ))}
          </Geographies>

          {clusters.map((cluster, idx) => {
            const [lng, lat] = cluster.center;
            const isMulti = cluster.items.length > 1;
            const isSelected = !isMulti && selected?.id === cluster.items[0]?.id;
            const isClusterSelected = isMulti && clusterItems === cluster.items;
            const r = Math.max(2, 5 / zoom);
            const foto = !isMulti ?fotoUrl(cluster.items[0], 80) : null;
            const photoR = r * 2.2;
            const clipId = `clip-cap-${idx}`;

            return (
              <Marker
                key={idx}
                coordinates={[lng, lat]}
                onMouseEnter={() => { if (!isMulti) setHovered(cluster.items[0]); }}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  setHovered(null);
                  if (isMulti) { setSelected(null); setClusterItems(cluster.items); }
                  else { setClusterItems(null); setSelected(cluster.items[0]); }
                }}
              >
                <g style={{ cursor: "pointer" }}>
                  <circle r={r * (isSelected || isClusterSelected ?5 : 4)} fill="#3B82F6" fillOpacity={isSelected || isClusterSelected ?0.16 : 0.07}>
                    <animate attributeName="r" from={r * 2.8} to={r * 5} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.35" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle r={photoR + r * 0.35} fill="none" stroke="#3B82F6" strokeWidth={r * (isSelected ?0.55 : 0.28)} strokeOpacity={isSelected || isClusterSelected ?0.9 : 0.65} />
                  <defs><clipPath id={clipId}><circle r={photoR} /></clipPath></defs>
                  {isMulti ?(
                    <>
                      <circle r={photoR} fill="#001D34" clipPath={`url(#${clipId})`} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.4} fontWeight="bold" fontFamily="monospace" fill="#3B82F6">{cluster.items.length}</text>
                    </>
                  ) : foto ?(
                    <image href={foto} x={-photoR} y={-photoR} width={photoR * 2} height={photoR * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
                  ) : (
                    <>
                      <circle r={photoR} fill="#001D34" clipPath={`url(#${clipId})`} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.1} fontWeight="bold" fontFamily="monospace" fill="#3B82F6" opacity={0.85}>{getInitials(cluster.items[0].nome)}</text>
                    </>
                  )}
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
        </ComposableMap>
      </MapWheelGuard>

      <div className="absolute left-0 right-0 h-px pointer-events-none z-10"
        style={{ background: "linear-gradient(to right, transparent, #2563EB40 20%, #3B82F660 50%, #2563EB40 80%, transparent)", animation: "scanLineCapital 6s linear infinite", top: 0 }}
      />
      <style dangerouslySetInnerHTML={{ __html: `@keyframes scanLineCapital { 0% { top: 0%; opacity: 0; } 5% { opacity: 1; } 95% { opacity: 1; } 100% { top: 100%; opacity: 0; } }` }} />

      {!selected && !clusterItems && hovered && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,8,18,0.92) 0%, transparent 100%)", padding: "28px 24px 14px" }}>
          <div className="flex items-end justify-between font-mono">
            <div>
              <p className="text-[9px] text-brand-gold/40 tracking-[0.3em] uppercase">Clique para ver perfil</p>
              <p className="text-sm font-bold text-brand-gold mt-0.5">{hovered.nome || "—"}</p>
              {hovered.empresa && <p className="text-[11px] text-brand-gold/55 mt-0.5">{hovered.empresa}</p>}
            </div>
            {hovered.cidade && (
              <div className="text-right">
                <p className="text-[9px] text-brand-gold/40 uppercase tracking-wider">Localização</p>
                <p className="text-xs text-brand-gold/70">{hovered.cidade}, {hovered.estado}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="absolute bottom-0 left-0 right-0 z-20"
          style={{ background: "linear-gradient(to top, rgba(0,8,18,0.97) 0%, rgba(0,8,18,0.85) 70%, transparent 100%)", padding: "28px 24px 16px" }}>
          <div className="flex items-end justify-between">
            <div className="font-mono">
              <p className="text-[9px] text-brand-gold/40 tracking-[0.3em] uppercase mb-1">Parceiro selecionado</p>
              <p className="text-base font-bold text-white">{selected.nome}</p>
              {selected.empresa && <p className="text-xs text-brand-gold/70 mt-0.5">{selected.empresa}</p>}
              {selected.cidade && <p className="text-[11px] text-white/40 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{selected.cidade}, {selected.estado}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/vitrine/${selected.id}`)}
                className="px-4 py-2 rounded-lg text-xs font-mono font-bold transition-colors"
                style={{ background: "linear-gradient(135deg,#3B82F6,#1D4ED8)", color: "#FFFFFF" }}
              >Ver Perfil</button>
              <button
                onClick={() => setSelected(null)}
                className="px-3 py-2 rounded-lg text-xs font-mono text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 transition-colors"
              >✕</button>
            </div>
          </div>
        </div>
      )}

      {clusterItems && (
        <div className="absolute bottom-0 left-0 right-0 z-20 overflow-auto"
          style={{ maxHeight: "55%", background: "rgba(0,8,18,0.97)", borderTop: "1px solid rgba(37,99,235,0.24)", padding: "12px 16px" }}>
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] text-brand-gold/50 tracking-widest uppercase font-mono">{clusterItems.length} parceiros nesta área</p>
            <button onClick={() => setClusterItems(null)} className="text-white/30 hover:text-white/70 text-xs font-mono">✕ fechar</button>
          </div>
          <div className="flex flex-col gap-2">
            {clusterItems.map(p => (
              <button
                key={p.id}
                onClick={() => { setClusterItems(null); setSelected(p); }}
                className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono text-brand-gold flex-shrink-0" style={{ background: avatarColor(p.id) }}>
                  {getInitials(p.nome)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white font-mono truncate">{p.nome}</p>
                  {p.empresa && <p className="text-[11px] text-white/40 truncate">{p.empresa}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== CARD =====
function ParceiroCard({ parceiro }: { parceiro: Parceiro }) {
  const [, navigate] = useLocation();
  const foto = fotoUrl(parceiro);
  const initials = getInitials(parceiro.nome);
  const bgColor = avatarColor(parceiro.id);

  return (
    <div
      className="group relative rounded-2xl border border-white/8 overflow-hidden cursor-pointer transition-all duration-300 hover:border-brand-gold/30 hover:shadow-lg"
      style={{ background: "rgba(255,255,255,0.025)" }}
      onClick={() => navigate(`/vitrine/${parceiro.id}`)}
      data-testid={`card-parceiro-${parceiro.id}`}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.08) 0%, transparent 70%)" }} />

      {/* Avatar */}
      <div className="flex justify-center pt-6 pb-3">
        {foto ?(
          <img
            src={foto}
            alt={parceiro.nome}
            className="w-20 h-20 rounded-full object-cover border-2 border-brand-gold/30 group-hover:border-brand-gold/60 transition-colors"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold font-mono text-brand-gold border-2 border-brand-gold/20 group-hover:border-brand-gold/50 transition-colors"
            style={{ background: bgColor }}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 pb-5 text-center space-y-1">
        <p className="text-sm font-bold text-white font-mono leading-tight line-clamp-2" data-testid={`text-parceiro-nome-${parceiro.id}`}>
          {parceiro.nome || "—"}
        </p>
        {parceiro.empresa && (
          <p className="text-[11px] text-brand-gold/70 font-mono truncate flex items-center justify-center gap-1">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            {parceiro.empresa}
          </p>
        )}
        {parceiro.cargo && (
          <p className="text-[10px] text-white/40 font-mono truncate">{parceiro.cargo}</p>
        )}
        {(parceiro.cidade || parceiro.estado) && (
          <p className="text-[10px] text-white/30 font-mono flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {[parceiro.cidade, parceiro.estado].filter(Boolean).join(", ")}
          </p>
        )}
        {(parceiro.ramo_atuacao || parceiro.segmento) && (
          <div className="pt-1">
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono border border-brand-gold/20 text-brand-gold/60"
              style={{ background: "rgba(37,99,235,0.08)" }}>
              {formatSegmentosDisplay(parceiro.segmento) || parceiro.ramo_atuacao}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex border-t border-white/5">
        {parceiro.whatsapp && (
          <a
            href={`https://wa.me/${parceiro.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex-1 flex items-center justify-center py-2.5 hover:bg-white/5 transition-colors"
            title="WhatsApp"
            data-testid={`btn-whatsapp-parceiro-${parceiro.id}`}
          >
            <Phone className="w-3.5 h-3.5 text-[#25D366]" />
          </a>
        )}
        {parceiro.email && (
          <a
            href={`mailto:${parceiro.email}`}
            onClick={e => e.stopPropagation()}
            className="flex-1 flex items-center justify-center py-2.5 hover:bg-white/5 transition-colors border-l border-white/5"
            title="E-mail"
            data-testid={`btn-email-parceiro-${parceiro.id}`}
          >
            <Mail className="w-3.5 h-3.5 text-brand-gold/60" />
          </a>
        )}
        {parceiro.link_site && (
          <a
            href={parceiro.link_site.startsWith("http") ?parceiro.link_site : `https://${parceiro.link_site}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex-1 flex items-center justify-center py-2.5 hover:bg-white/5 transition-colors border-l border-white/5"
            title="Site"
            data-testid={`btn-site-parceiro-${parceiro.id}`}
          >
            <Globe className="w-3.5 h-3.5 text-white/30" />
          </a>
        )}
      </div>
    </div>
  );
}

function CapitalCard({ parceiro }: { parceiro: Parceiro }) {
  const [, navigate] = useLocation();
  const foto = fotoUrl(parceiro);
  const logo = logoEmpresaUrl(parceiro);
  const nome = parceiro.nome || "—";

  return (
    <div
      className="relative rounded-xl border border-border/70 bg-white overflow-hidden group transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-[1.01] hover:border-blue-200"
      style={{ boxShadow: "0 2px 10px rgba(15,23,42,0.06)" }}
      onClick={() => navigate(`/vitrine/${parceiro.id}`)}
      data-testid={`card-capital-${parceiro.id}`}
    >
      <div className="p-4 space-y-3">
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border border-blue-100 bg-blue-50"
            style={{
              background: foto ?"transparent" : "linear-gradient(135deg, #eff6ff, #f8fafc)",
            }}
          >
            {foto ?(
              <img src={foto} alt={nome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold font-mono text-blue-600">{getInitials(nome)}</span>
            )}
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-foreground font-mono leading-tight line-clamp-2">{nome}</p>
          {parceiro.segmento && <p className="text-xs text-blue-600 font-mono truncate">{formatSegmentosDisplay(parceiro.segmento)}</p>}

          {parceiro.empresa && (
            <div className="flex items-center justify-center gap-2 min-w-0">
              {logo ?(
                <span className="flex h-7 w-12 shrink-0 items-center justify-center">
                  <img src={logo} alt={`Marca ${parceiro.empresa}`} className="max-h-full max-w-full object-contain drop-shadow-sm" />
                </span>
              ) : (
                <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs text-muted-foreground truncate">{parceiro.empresa}</span>
            </div>
          )}

          {(parceiro.cidade || parceiro.estado) && (
            <div className="flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{[parceiro.cidade, parceiro.estado].filter(Boolean).join(", ")}</span>
            </div>
          )}

          {parceiro.link_site && (
            <a
              href={parceiro.link_site.startsWith("http") ?parceiro.link_site : `https://${parceiro.link_site}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors font-mono"
            >
              <Globe className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[120px]">{parceiro.link_site.replace(/^https?:\/\/(www\.)?/, "")}</span>
            </a>
          )}
        </div>

        {(parceiro.whatsapp || parceiro.email) && (
          <div className="flex gap-2 border-t border-border/60 pt-3">
            {parceiro.whatsapp && (
              <a
                href={`https://wa.me/${parceiro.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex-1 flex items-center justify-center py-2 rounded-lg border border-border/70 hover:bg-muted/50 transition-colors"
                title="WhatsApp"
              >
                <Phone className="w-3.5 h-3.5 text-[#25D366]" />
              </a>
            )}
            {parceiro.email && (
              <a
                href={`mailto:${parceiro.email}`}
                onClick={e => e.stopPropagation()}
                className="flex-1 flex items-center justify-center py-2 rounded-lg border border-border/70 hover:bg-muted/50 transition-colors"
                title="E-mail"
              >
                <Mail className="w-3.5 h-3.5 text-blue-600" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CapitalListItem({ parceiro }: { parceiro: Parceiro }) {
  const [, navigate] = useLocation();
  const foto = fotoUrl(parceiro);
  const logo = logoEmpresaUrl(parceiro);
  const nome = parceiro.nome || "—";

  return (
    <div
      className="group flex items-center gap-4 rounded-xl border border-border/70 bg-white p-3 transition-all cursor-pointer hover:shadow-lg hover:border-blue-200"
      style={{ boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}
      onClick={() => navigate(`/vitrine/${parceiro.id}`)}
      data-testid={`list-capital-${parceiro.id}`}
    >
      <div
        className="w-14 h-14 rounded-full overflow-hidden border border-blue-100 bg-blue-50 flex items-center justify-center shrink-0"
        style={{ background: foto ?"transparent" : "linear-gradient(135deg, #eff6ff, #f8fafc)" }}
      >
        {foto ?<img src={foto} alt={nome} className="w-full h-full object-cover" /> : <span className="text-sm font-bold font-mono text-blue-600">{getInitials(nome)}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground font-mono truncate">{nome}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {parceiro.empresa && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              {logo ?<img src={logo} alt={`Marca ${parceiro.empresa}`} className="h-5 w-10 object-contain" /> : <Building2 className="w-3 h-3" />}
              <span className="truncate max-w-[220px]">{parceiro.empresa}</span>
            </span>
          )}
          {(parceiro.segmento || parceiro.ramo_atuacao || parceiro.cargo) && (
            <span className="truncate max-w-[260px]">{formatSegmentosDisplay(parceiro.segmento) || parceiro.ramo_atuacao || parceiro.cargo}</span>
          )}
          {(parceiro.cidade || parceiro.estado) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {[parceiro.cidade, parceiro.estado].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {parceiro.whatsapp && (
          <a
            href={`https://wa.me/${parceiro.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-[#25D366] hover:bg-muted/50"
            title="WhatsApp"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
        {parceiro.email && (
          <a
            href={`mailto:${parceiro.email}`}
            onClick={e => e.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-blue-600 hover:bg-muted/50"
            title="E-mail"
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function DestaqueHeroCapital({ anuncio, onCreate }: { anuncio?: AnuncioCapital; onCreate: () => void }) {
  const href = safeHref(anuncio?.link);
  const image = assetUrl(anuncio?.imagem_url || anuncio?.imagem_directus_id, "width=1000&height=520&fit=cover");
  const title = visibleTitle(anuncio?.titulo);

  const content = (
    <div className="group relative aspect-[16/9] max-h-[360px] overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md">
      {image ? (
        <img src={image} alt={title || "Destaque BUILT Capital"} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(37,99,235,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(37,99,235,0.05)_1px,transparent_1px)] bg-[size:38px_38px]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/82 to-white/35 opacity-0 transition group-hover:opacity-100" />
      <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        {!image && (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
            <Megaphone className="h-7 w-7" />
          </div>
        )}
        <div className={image ? "opacity-0 transition group-hover:opacity-100" : ""}>
          <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-brand-navy">
            {title || "Espaço Premium Disponível"}
          </p>
          <p className="mt-3 font-mono text-xs text-slate-500">{anuncio ? "Clique para abrir" : "Clique para destacar"}</p>
        </div>
      </div>
    </div>
  );

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{content}</a>;
  }

  return (
    <button type="button" onClick={onCreate} className="block w-full text-left" data-testid="btn-capital-destaque-hero">
      {content}
    </button>
  );
}

function DestaqueSlotCapital({ anuncio, onCreate }: { anuncio?: AnuncioCapital; onCreate: () => void }) {
  const href = safeHref(anuncio?.link);
  const image = assetUrl(anuncio?.imagem_url || anuncio?.imagem_directus_id, "width=360&height=360&fit=cover");
  const title = visibleTitle(anuncio?.titulo);
  const content = (
    <div
      className="group relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl bg-white px-4 text-center transition hover:border-blue-300 hover:shadow-md"
      style={{
        aspectRatio: "1/1",
        border: "1.5px solid rgba(37,99,235,0.35)",
        boxShadow: "0 2px 12px rgba(37,99,235,0.1)",
      }}
    >
      {image && <img src={image} alt={title || "Destaque"} className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-white/0 transition group-hover:bg-white/82" />
      <div className={`relative ${image ? "opacity-0 transition group-hover:opacity-100" : ""}`}>
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
          <Megaphone className="h-4 w-4" />
        </div>
        <p className="mt-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-brand-navy">
          {title || "Espaço disponível"}
        </p>
        <p className="mt-2 font-mono text-[10px] text-slate-500">{anuncio ? "Abrir destaque" : "Clique para destacar"}</p>
      </div>
    </div>
  );

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{content}</a>;
  }

  return (
    <button type="button" onClick={onCreate} className="block w-full text-left" data-testid="btn-capital-destaque-slot">
      {content}
    </button>
  );
}

function ChamadaCapitalCard({ chamada, onOpen }: { chamada: ChamadaCapital; onOpen: () => void }) {
  const image = assetUrl(chamada.imagem_url || chamada.imagem_directus_id, "width=520&height=220&fit=cover");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-w-[268px] snap-start overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
      data-testid={`card-capital-chamada-${chamada.id}`}
    >
      <div className="relative h-[92px] w-full bg-gradient-to-br from-emerald-50 to-slate-100">
        {image ? (
          <img src={image} alt={chamada.nome_oportunidade || "Chamada de Capital"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-emerald-500/25">
            <Target className="h-9 w-9" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm">
          Pública
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 px-3.5 pt-3.5">
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
          {chamada.tipo || "Chamada"}
        </span>
        {chamada.status && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            {String(chamada.status).replace(/_/g, " ")}
          </span>
        )}
      </div>
      <h3 className="mx-3.5 mt-2.5 line-clamp-2 min-h-[40px] text-sm font-semibold text-foreground">
        {chamada.nome_oportunidade || "Chamada de Capital sem nome"}
      </h3>
      <p className="mx-3.5 mt-1.5 line-clamp-1 text-sm text-muted-foreground">
        {chamada.nucleo_alianca || chamada.localizacao || "Chamada BUILT Capital"}
      </p>
      <div className="mx-3.5 mb-3.5 mt-3 grid grid-cols-2 gap-3 border-t border-border pt-2.5">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground">Valor</p>
          <p className="whitespace-nowrap text-sm font-semibold leading-tight text-foreground">{brl(chamada.valor_origem_opa)}</p>
        </div>
        <div className="min-w-0 text-right" title="Mínimo Esforço Multiplicador">
          <p className="text-[10px] text-muted-foreground">MEM</p>
          <p className="text-sm font-semibold leading-tight text-foreground">{num(chamada.Minimo_esforco_multiplicador).toLocaleString("pt-BR")}%</p>
        </div>
      </div>
    </button>
  );
}

// ===== MAIN PAGE =====
export default function BuiltCapitalPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [destaqueDialogOpen, setDestaqueDialogOpen] = useState(false);
  const [destaqueSlotTipo, setDestaqueSlotTipo] = useState<"padrao" | "hero">("padrao");
  const [destaquePagamentoPais, setDestaquePagamentoPais] = useState<"brasil" | "exterior">("brasil");
  const [destaqueForm, setDestaqueForm] = useState({ titulo: "", descricao: "", link: "" });
  const [destaqueImagemId, setDestaqueImagemId] = useState<string | null>(null);
  const [destaqueImagemPreview, setDestaqueImagemPreview] = useState<string | null>(null);
  const [destaqueUploadLoading, setDestaqueUploadLoading] = useState(false);
  const [destaqueTermsAccepted, setDestaqueTermsAccepted] = useState(false);

  const { data: parceiros = [], isLoading } = useQuery<Parceiro[]>({
    queryKey: ["/api/parceiros-capital"],
    queryFn: async () => {
      const r = await fetch("/api/parceiros-capital");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: anuncios = [] } = useQuery<AnuncioCapital[]>({
    queryKey: ["/api/anuncios", "capital"],
    queryFn: async () => {
      const r = await fetch("/api/anuncios?ambiente=capital");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: chamadas = [] } = useQuery<ChamadaCapital[]>({
    queryKey: ["/api/chamadas-capital"],
    queryFn: async () => {
      const r = await fetch("/api/chamadas-capital");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const anunciosAtivos = useMemo(() => {
    return anuncios.filter(anuncio =>
      anuncio.ativo !== false && normalizeFilterText(anuncio.pagamento_status) !== "cancelado"
    );
  }, [anuncios]);

  const destaqueHero = anunciosAtivos.find(anuncio => normalizeFilterText(anuncio.slot_tipo) === "hero");
  const destaquesMenores = anunciosAtivos
    .filter(anuncio => normalizeFilterText(anuncio.slot_tipo) !== "hero")
    .slice(0, 5);

  const chamadasCapital = useMemo(() => {
    return chamadas
      .filter(chamada => {
        const status = normalizeFilterText(chamada.status);
        return !status || ["ativa", "ativo", "publicada", "em formacao", "em formação"].includes(status);
      })
      .slice(0, 8);
  }, [chamadas]);

  const criarDestaqueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/anuncios", {
        titulo: destaqueForm.titulo.trim(),
        descricao: destaqueForm.descricao.trim() || null,
        link: destaqueForm.link.trim() || null,
        imagem_directus_id: destaqueImagemId || null,
        slot_tipo: destaqueSlotTipo,
        pagamento_pais: destaquePagamentoPais,
        ambiente: "capital",
      });
      return response.json();
    },
    onSuccess: (anuncio: AnuncioCapital) => {
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios", "capital"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anuncios/mine", "capital"] });
      setDestaqueDialogOpen(false);
      if (anuncio.pagamento_url) {
        window.open(anuncio.pagamento_url, "_blank", "noopener,noreferrer");
        toast({
          title: "Pagamento gerado",
          description: "O destaque do BUILT Capital foi criado e o link de pagamento abriu em nova aba.",
        });
        return;
      }
      toast({ title: "Destaque do BUILT Capital criado" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar destaque",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  function abrirCriacaoDestaque(slotTipo: "padrao" | "hero" = "padrao") {
    setDestaqueSlotTipo(slotTipo);
    setDestaquePagamentoPais("brasil");
    setDestaqueForm({ titulo: "", descricao: "", link: "" });
    setDestaqueImagemId(null);
    setDestaqueImagemPreview(null);
    setDestaqueTermsAccepted(false);
    setDestaqueDialogOpen(true);
  }

  async function handleDestaqueImageUpload(file: File) {
    setDestaqueUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.fileIds?.[0]) {
        throw new Error(data?.error || "Falha no upload");
      }
      setDestaqueImagemId(data.fileIds[0]);
      setDestaqueImagemPreview(URL.createObjectURL(file));
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDestaqueUploadLoading(false);
    }
  }

  function handleDestaqueSubmit() {
    if (!destaqueTermsAccepted) {
      toast({ title: "Aceite os termos para publicar o destaque", variant: "destructive" });
      return;
    }
    criarDestaqueMutation.mutate();
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-capital-title">
            <TrendingUp className="w-7 h-7 text-emerald-400" />
            BUILT Capital
          </h1>
          <p className="mt-1 text-muted-foreground">
            Invista, acompanhe chamadas e destaque oportunidades de capital.
          </p>
        </div>
        <Button
          onClick={() => abrirCriacaoDestaque("hero")}
          className="bg-blue-600 text-white hover:bg-blue-700"
          data-testid="btn-capital-criar-destaque"
        >
          <Megaphone className="mr-2 h-4 w-4" />
          Criar destaque
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {!isLoading ? (
          <MapaParceiros parceiros={parceiros} />
        ) : (
          <div className="aspect-[16/9] max-h-[360px] rounded-2xl border border-border bg-muted/40" />
        )}
        <DestaqueHeroCapital anuncio={destaqueHero} onCreate={() => abrirCriacaoDestaque("hero")} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Megaphone className="h-4 w-4 text-blue-600" />
            Destaques BUILT Capital
          </h2>
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] text-muted-foreground">
            {destaquesMenores.length}/5 em exibição
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={destaquesMenores[index]?.id || index} className="min-w-0">
              <DestaqueSlotCapital
                anuncio={destaquesMenores[index]}
                onCreate={() => abrirCriacaoDestaque("padrao")}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Chamadas de Capital
          </h2>
          <div className="h-px flex-1 bg-border" />
          <Button variant="ghost" className="gap-2" onClick={() => navigate("/built-capital/chamadas")}>
            Ver todas as chamadas
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {chamadasCapital.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {chamadasCapital.map(chamada => (
              <ChamadaCapitalCard
                key={chamada.id}
                chamada={chamada}
                onOpen={() => navigate(`/built-capital/chamadas/${chamada.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
            Nenhuma chamada de capital em destaque no momento.
          </div>
        )}
      </section>

      <Dialog open={destaqueDialogOpen} onOpenChange={setDestaqueDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-blue-600" />
              Criar destaque BUILT Capital
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Este destaque aparece somente no BUILT Capital e usa vagas independentes da Vitrine.
            </p>
          </DialogHeader>

          <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tipo de destaque</label>
              <Select value={destaqueSlotTipo} onValueChange={value => setDestaqueSlotTipo(value === "hero" ? "hero" : "padrao")}>
                <SelectTrigger data-testid="select-capital-destaque-tipo">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hero">Espaço premium maior (1 vaga)</SelectItem>
                  <SelectItem value="padrao">Destaque padrão (5 vagas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Título do destaque</label>
              <Input
                value={destaqueForm.titulo}
                onChange={event => setDestaqueForm(current => ({ ...current, titulo: event.target.value }))}
                placeholder="Ex: Captação para oportunidade de investimento"
                data-testid="input-capital-destaque-titulo"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Descrição</label>
              <Textarea
                value={destaqueForm.descricao}
                onChange={event => setDestaqueForm(current => ({ ...current, descricao: event.target.value }))}
                placeholder="Resumo curto para o destaque no BUILT Capital"
                rows={3}
                data-testid="textarea-capital-destaque-descricao"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Imagem</label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg border border-blue-100 bg-blue-50">
                  {destaqueImagemPreview ? (
                    <img src={destaqueImagemPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-blue-300" />
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-50">
                  <input
                    type="file"
                    accept="image/png,image/jpg,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file) handleDestaqueImageUpload(file);
                    }}
                    data-testid="input-capital-destaque-imagem"
                  />
                  {destaqueUploadLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {destaqueUploadLoading ? "Enviando..." : "Escolher imagem"}
                </label>
                {destaqueImagemId && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestaqueImagemId(null);
                      setDestaqueImagemPreview(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    remover
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Recomendado: {destaqueSlotTipo === "hero" ? "1600 x 900 px" : "1200 x 1200 px"}.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Link</label>
              <Input
                value={destaqueForm.link}
                onChange={event => setDestaqueForm(current => ({ ...current, link: event.target.value }))}
                placeholder="https://..."
                type="url"
                data-testid="input-capital-destaque-link"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Pagamento</label>
              <Select value={destaquePagamentoPais} onValueChange={value => setDestaquePagamentoPais(value === "exterior" ? "exterior" : "brasil")}>
                <SelectTrigger data-testid="select-capital-destaque-pagamento">
                  <SelectValue placeholder="Local do pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brasil">Brasil</SelectItem>
                  <SelectItem value="exterior">Fora do Brasil</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={destaqueTermsAccepted}
                onChange={event => setDestaqueTermsAccepted(event.target.checked)}
                className="mt-1"
                data-testid="checkbox-capital-destaque-termos"
              />
              <span>
                Confirmo que tenho autorização para publicar este destaque no BUILT Capital e que as informações são verdadeiras.
              </span>
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDestaqueDialogOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={handleDestaqueSubmit}
              disabled={!destaqueTermsAccepted || destaqueUploadLoading || criarDestaqueMutation.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
              data-testid="btn-capital-destaque-salvar"
            >
              {criarDestaqueMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Gerar destaque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
