import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from "react-simple-maps";
import {
  Search, MapPin, Phone, Mail, Building2, Coins, Globe, LayoutGrid, List
} from "lucide-react";

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
    .replace(/(^|\s|[-'/])\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
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
      className="relative overflow-hidden rounded-2xl border border-brand-gold/20"
      style={{ height: 420, background: "radial-gradient(ellipse at 50% 110%, #001428 0%, #000c1f 55%, #000408 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(215,187,125,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.05) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />
      {[["top-0 left-0","border-t-2 border-l-2 rounded-tl-2xl"],["top-0 right-0","border-t-2 border-r-2 rounded-tr-2xl"],["bottom-0 left-0","border-b-2 border-l-2 rounded-bl-2xl"],["bottom-0 right-0","border-b-2 border-r-2 rounded-br-2xl"]].map(([pos, cls]) => (
        <div key={pos} className={`absolute ${pos} w-12 h-12 border-brand-gold/40 pointer-events-none ${cls}`} />
      ))}

      <div className="absolute top-5 left-6 z-20">
        <p className="text-[10px] text-brand-gold/50 tracking-[0.35em] uppercase font-mono">// BUILT Capital</p>
        <h2 className="text-xl font-bold tracking-[0.12em] font-mono mt-0.5" style={{ color: "#D7BB7D" }}>
          MAPA DE PARCEIROS DE CAPITAL
        </h2>
      </div>

      <div className="absolute top-5 right-6 z-20 text-right font-mono">
        <div className="mb-2">
          <p className="text-[9px] text-brand-gold/40 tracking-widest uppercase">Parceiros</p>
          <p className="text-4xl font-bold leading-none" style={{ color: "#D7BB7D" }}>{parceiros.length}</p>
        </div>
        <p className="text-[9px] text-brand-gold/30">{withCoords.length} geolocalizados</p>
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
            style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(215,187,125,0.3)", color: "#D7BB7D" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(215,187,125,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,20,40,0.85)")}
          >{label}</button>
        ))}
      </div>

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
                  <circle r={r * (isSelected || isClusterSelected ?5 : 4)} fill="#D7BB7D" fillOpacity={isSelected || isClusterSelected ?0.15 : 0.06}>
                    <animate attributeName="r" from={r * 2.8} to={r * 5} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.35" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle r={photoR + r * 0.35} fill="none" stroke="#D7BB7D" strokeWidth={r * (isSelected ?0.55 : 0.28)} strokeOpacity={isSelected || isClusterSelected ?0.9 : 0.6} />
                  <defs><clipPath id={clipId}><circle r={photoR} /></clipPath></defs>
                  {isMulti ?(
                    <>
                      <circle r={photoR} fill="#001D34" clipPath={`url(#${clipId})`} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.4} fontWeight="bold" fontFamily="monospace" fill="#D7BB7D">{cluster.items.length}</text>
                    </>
                  ) : foto ?(
                    <image href={foto} x={-photoR} y={-photoR} width={photoR * 2} height={photoR * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
                  ) : (
                    <>
                      <circle r={photoR} fill="#001D34" clipPath={`url(#${clipId})`} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.1} fontWeight="bold" fontFamily="monospace" fill="#D7BB7D" opacity={0.8}>{getInitials(cluster.items[0].nome)}</text>
                    </>
                  )}
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      <div className="absolute left-0 right-0 h-px pointer-events-none z-10"
        style={{ background: "linear-gradient(to right, transparent, #D7BB7D40 20%, #D7BB7D60 50%, #D7BB7D40 80%, transparent)", animation: "scanLineCapital 6s linear infinite", top: 0 }}
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
                style={{ background: "linear-gradient(135deg,#D7BB7D,#b89a50)", color: "#001D34" }}
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
          style={{ maxHeight: "55%", background: "rgba(0,8,18,0.97)", borderTop: "1px solid rgba(215,187,125,0.15)", padding: "12px 16px" }}>
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
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(215,187,125,0.06) 0%, transparent 70%)" }} />

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
              style={{ background: "rgba(215,187,125,0.06)" }}>
              {parceiro.segmento || parceiro.ramo_atuacao}
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
      className="relative rounded-xl border overflow-hidden group transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-[1.01]"
      style={{
        background: "linear-gradient(145deg, #071626, #040e1c)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
      onClick={() => navigate(`/vitrine/${parceiro.id}`)}
      data-testid={`card-capital-${parceiro.id}`}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent" />
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-brand-gold/20" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-brand-gold/20" />

      <div className="p-4 space-y-3">
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2 border-brand-gold/20"
            style={{
              background: foto ?"transparent" : "radial-gradient(circle at 30% 30%, rgba(215,187,125,0.15), rgba(3,8,18,0.9))",
              boxShadow: "0 0 16px rgba(215,187,125,0.1)",
            }}
          >
            {foto ?(
              <img src={foto} alt={nome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold font-mono text-brand-gold/80">{getInitials(nome)}</span>
            )}
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-white font-mono leading-tight line-clamp-2">{nome}</p>
          {parceiro.segmento && <p className="text-xs text-brand-gold/60 font-mono truncate">{parceiro.segmento}</p>}

          {parceiro.empresa && (
            <div className="flex items-center justify-center gap-2 min-w-0">
              {logo ?(
                <span className="flex h-7 w-12 shrink-0 items-center justify-center">
                  <img src={logo} alt={`Marca ${parceiro.empresa}`} className="max-h-full max-w-full object-contain drop-shadow-sm" />
                </span>
              ) : (
                <Building2 className="w-3 h-3 text-white/25 shrink-0" />
              )}
              <span className="text-xs text-white/40 truncate">{parceiro.empresa}</span>
            </div>
          )}

          {(parceiro.cidade || parceiro.estado) && (
            <div className="flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 text-white/20 shrink-0" />
              <span className="text-xs text-white/35 truncate">{[parceiro.cidade, parceiro.estado].filter(Boolean).join(", ")}</span>
            </div>
          )}

          {parceiro.link_site && (
            <a
              href={parceiro.link_site.startsWith("http") ?parceiro.link_site : `https://${parceiro.link_site}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1 text-xs text-brand-gold/50 hover:text-brand-gold transition-colors font-mono"
            >
              <Globe className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[120px]">{parceiro.link_site.replace(/^https?:\/\/(www\.)?/, "")}</span>
            </a>
          )}
        </div>

        {(parceiro.whatsapp || parceiro.email) && (
          <div className="flex gap-2 border-t border-white/5 pt-3">
            {parceiro.whatsapp && (
              <a
                href={`https://wa.me/${parceiro.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex-1 flex items-center justify-center py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                title="WhatsApp"
              >
                <Phone className="w-3.5 h-3.5 text-[#25D366]" />
              </a>
            )}
            {parceiro.email && (
              <a
                href={`mailto:${parceiro.email}`}
                onClick={e => e.stopPropagation()}
                className="flex-1 flex items-center justify-center py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                title="E-mail"
              >
                <Mail className="w-3.5 h-3.5 text-brand-gold/60" />
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
      className="group flex items-center gap-4 rounded-xl border p-3 transition-all cursor-pointer hover:shadow-lg hover:border-brand-gold/35"
      style={{
        background: "linear-gradient(145deg, #071626, #040e1c)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
      onClick={() => navigate(`/vitrine/${parceiro.id}`)}
      data-testid={`list-capital-${parceiro.id}`}
    >
      <div
        className="w-14 h-14 rounded-full overflow-hidden border border-brand-gold/25 flex items-center justify-center shrink-0"
        style={{ background: foto ?"transparent" : "radial-gradient(circle at 30% 30%, rgba(215,187,125,0.15), rgba(3,8,18,0.9))" }}
      >
        {foto ?<img src={foto} alt={nome} className="w-full h-full object-cover" /> : <span className="text-sm font-bold font-mono text-brand-gold/80">{getInitials(nome)}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white font-mono truncate">{nome}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
          {parceiro.empresa && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              {logo ?<img src={logo} alt={`Marca ${parceiro.empresa}`} className="h-5 w-10 object-contain" /> : <Building2 className="w-3 h-3" />}
              <span className="truncate max-w-[220px]">{parceiro.empresa}</span>
            </span>
          )}
          {(parceiro.segmento || parceiro.ramo_atuacao || parceiro.cargo) && (
            <span className="truncate max-w-[260px]">{parceiro.segmento || parceiro.ramo_atuacao || parceiro.cargo}</span>
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-[#25D366] hover:bg-white/5"
            title="WhatsApp"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
        {parceiro.email && (
          <a
            href={`mailto:${parceiro.email}`}
            onClick={e => e.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-brand-gold/70 hover:bg-white/5"
            title="E-mail"
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ===== MAIN PAGE =====
export default function BuiltCapitalPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterTerritorio, setFilterTerritorio] = useState("all");
  const [filterRamo, setFilterRamo] = useState("all");
  const [sortOrder, setSortOrder] = useState<"default" | "az" | "za">("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: parceiros = [], isLoading } = useQuery<Parceiro[]>({
    queryKey: ["/api/parceiros-capital"],
    queryFn: async () => {
      const r = await fetch("/api/parceiros-capital");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ?data : [];
    },
  });

  const ramos = useMemo(() => {
    const map = new Map<string, string>();
    parceiros.forEach(p => {
      const key = normalizeFilterText(p.ramo_atuacao);
      if (!key) return;
      const label = formatFilterLabel(p.ramo_atuacao || "");
      const current = map.get(key);
      if (!current || label.length < current.length || current === current.toLocaleUpperCase("pt-BR")) {
        map.set(key, label);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [parceiros]);

  const territorios = useMemo(() => {
    const map = new Map<string, string>();
    parceiros.forEach(p => {
      const key = normalizeTerritorioKey(p.cidade || p.estado || p.pais);
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
  }, [parceiros]);

  const filtered = useMemo(() => {
    const list = parceiros.filter(p => {
      const nome = normalizeFilterText(p.nome);
      const empresa = normalizeFilterText(p.empresa);
      const segmento = normalizeFilterText(p.segmento);
      const ramo = normalizeFilterText(p.ramo_atuacao);
      const q = normalizeFilterText(search);
      const matchSearch = !q || nome.includes(q) || empresa.includes(q) || segmento.includes(q);
      const matchTerritorio = filterTerritorio === "all" || normalizeTerritorioKey(p.cidade || p.estado || p.pais) === filterTerritorio;
      const matchRamo = filterRamo === "all" || ramo === filterRamo;
      return matchSearch && matchTerritorio && matchRamo;
    });
    if (sortOrder === "default") return list;
    return [...list].sort((a, b) => {
      const compare = (a.nome || a.empresa || "").localeCompare(b.nome || b.empresa || "", "pt-BR", { sensitivity: "base" });
      return sortOrder === "az" ? compare : -compare;
    });
  }, [parceiros, search, filterTerritorio, filterRamo, sortOrder]);

  const hasFilters = search || filterTerritorio !== "all" || filterRamo !== "all" || sortOrder !== "default";

  function clearFilters() {
    setSearch("");
    setFilterTerritorio("all");
    setFilterRamo("all");
    setSortOrder("default");
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] text-brand-gold/40 tracking-[0.35em] uppercase font-mono mb-1">// Rede BUILT</p>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-capital-title">
            <div className="p-2 rounded-lg text-brand-navy" style={{ background: "linear-gradient(135deg,#D7BB7D,#b89a50)" }}>
              <Coins className="w-6 h-6" />
            </div>
            BUILT Capital
          </h1>
        </div>
      </div>

      {/* Map */}
      {!isLoading && <MapaParceiros parceiros={parceiros} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar parceiro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground"
            data-testid="input-busca-capital"
          />
        </div>
        <Select value={filterTerritorio} onValueChange={setFilterTerritorio}>
          <SelectTrigger className="w-44 bg-background border-border text-foreground" data-testid="select-territorio-capital">
            <SelectValue placeholder="Território" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="all">Todos os territórios</SelectItem>
            {territorios.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {ramos.length > 0 && (
          <Select value={filterRamo} onValueChange={setFilterRamo}>
            <SelectTrigger className="w-44 bg-background border-border text-foreground" data-testid="select-ramo-capital">
              <SelectValue placeholder="Ramo" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">Todos os ramos</SelectItem>
              {ramos.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "default" | "az" | "za")}>
          <SelectTrigger className="w-36 bg-background border-border text-foreground" data-testid="select-ordem-capital">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Ordenar</SelectItem>
            <SelectItem value="az">A-Z</SelectItem>
            <SelectItem value="za">Z-A</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex h-9 overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            title="Ver em grade"
            onClick={() => setViewMode("grid")}
            className={`w-9 flex items-center justify-center transition-colors ${viewMode === "grid" ?"bg-brand-gold text-brand-navy" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            data-testid="btn-capital-view-grid"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Ver em lista"
            onClick={() => setViewMode("list")}
            className={`w-9 flex items-center justify-center transition-colors ${viewMode === "list" ?"bg-brand-gold text-brand-navy" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            data-testid="btn-capital-view-list"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground font-mono text-xs"
            data-testid="btn-limpar-filtros-capital">
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ?(
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 h-64 animate-pulse" style={{ background: "rgba(255,255,255,0.025)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ?(
        <div className="text-center py-20">
          <Coins className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 font-mono text-sm">
            {parceiros.length === 0 ?"Nenhum parceiro de capital cadastrado ainda" : "Nenhum parceiro encontrado com os filtros aplicados"}
          </p>
        </div>
      ) : (
        <div className={viewMode === "list" ?"space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}>
          {filtered.map(p => (
            viewMode === "list"
              ? <CapitalListItem key={p.id} parceiro={p} />
              : <CapitalCard key={p.id} parceiro={p} />
          ))}
        </div>
      )}
    </div>
  );
}
