import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Users, Search, Mail, Phone, MapPin, Building2,
  Briefcase, Globe, Activity, Cpu, Wifi, X
} from "lucide-react";

const DIRECTUS_URL = "https://app.builtalliances.com";

interface Membro {
  id: string;
  nome: string;
  Nome_de_usuario?: string;
  nome_completo?: string;
  primeiro_nome?: string;
  sobrenome?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  empresa?: string;
  cargo?: string;
  especialidade?: string;
  especialidades?: string[];
  foto?: string | null;
  tipo_de_cadastro?: string;
}

function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `${DIRECTUS_URL}/assets/${foto}?width=160&height=160&fit=cover`;
}

function getDisplayNome(m: Membro): string {
  return m.nome_completo ||
    [m.primeiro_nome, m.sobrenome].filter(Boolean).join(" ") ||
    m.Nome_de_usuario ||
    m.nome ||
    "—";
}

function getInitials(nome: string): string {
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function hashColor(str: string): string {
  const colors = [
    ["#0d2a43", "#D7BB7D"],
    ["#0d2a43", "#6fa8dc"],
    ["#1a0d33", "#b39ddb"],
    ["#0d2a1a", "#81c784"],
    ["#2a1a0d", "#ffb74d"],
    ["#2a0d1a", "#f48fb1"],
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length][1];
}

function MembroCard({ membro, index }: { membro: Membro & { _nome?: string }; index: number }) {
  const nome = getDisplayNome(membro);
  const initials = getInitials(nome);
  const accentColor = hashColor(membro.id);
  const location = [membro.cidade, membro.estado].filter(Boolean).join(", ");
  const contacto = membro.whatsapp || membro.telefone;
  const foto = fotoUrl(membro.foto);

  return (
    <div
      className="relative group rounded-xl border border-white/5 overflow-hidden transition-all duration-300 hover:border-brand-gold/30 hover:shadow-lg"
      style={{ background: "linear-gradient(135deg, #050f1c 0%, #030812 100%)" }}
      data-testid={`card-membro-${membro.id}`}
    >
      {/* Scan line animation */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${accentColor}08 50%, transparent 100%)`,
          animation: "scanline 2s linear infinite",
        }}
      />

      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: accentColor }} />
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: accentColor }} />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: accentColor }} />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: accentColor }} />

      {/* Node index */}
      <div className="absolute top-3 right-3 font-mono text-[9px] opacity-20" style={{ color: accentColor }}>
        NODE_{String(index + 1).padStart(3, "0")}
      </div>

      <div className="p-5">
        {/* Avatar + name */}
        <div className="flex items-start gap-4 mb-4">
          <div className="relative shrink-0">
            {/* Outer pulse ring */}
            <div
              className="absolute inset-0 rounded-full opacity-20 group-hover:opacity-40 transition-opacity"
              style={{
                background: `radial-gradient(circle, ${accentColor}40 0%, transparent 70%)`,
                transform: "scale(1.8)",
              }}
            />
            {/* Avatar circle */}
            <div
              className="relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center font-bold text-lg font-mono border"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${accentColor}20, #030812)`,
                borderColor: `${accentColor}40`,
                color: accentColor,
                boxShadow: `0 0 12px ${accentColor}20`,
              }}
            >
              {foto ? (
                <img src={foto} alt={nome} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            {/* Online indicator */}
            <div
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#030812]"
              style={{ background: accentColor }}
            />
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h3 className="font-bold text-sm leading-tight truncate" style={{ color: accentColor }}>
              {nome}
            </h3>
            {(membro.especialidades?.length || membro.especialidade) && (
              <p className="text-xs text-white/50 truncate mt-0.5 flex items-center gap-1">
                <Briefcase className="w-2.5 h-2.5 shrink-0" />
                {(membro.especialidades?.length ? membro.especialidades[0] : membro.especialidade)}
              </p>
            )}
            {membro.empresa && (
              <p className="text-xs text-white/40 truncate mt-0.5 flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5 shrink-0" />
                {membro.empresa}
              </p>
            )}
          </div>
        </div>

        {/* Divider line */}
        <div className="w-full h-px mb-4" style={{ background: `linear-gradient(90deg, ${accentColor}30, transparent)` }} />

        {/* Contact info */}
        <div className="space-y-1.5">
          {membro.email && (
            <div className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors group/item">
              <Mail className="w-3 h-3 shrink-0 text-white/20" />
              <a href={`mailto:${membro.email}`} className="text-[11px] truncate hover:underline" onClick={e => e.stopPropagation()}>
                {membro.email}
              </a>
            </div>
          )}
          {contacto && (
            <div className="flex items-center gap-2 text-white/40">
              <Phone className="w-3 h-3 shrink-0 text-white/20" />
              <span className="text-[11px]">{contacto}</span>
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2 text-white/40">
              <MapPin className="w-3 h-3 shrink-0 text-white/20" />
              <span className="text-[11px]">{location}</span>
            </div>
          )}
        </div>

        {/* Tags bottom */}
        {(() => {
          const esps = (membro.especialidades?.length ? membro.especialidades : membro.especialidade ? [membro.especialidade] : []);
          return (esps.length > 0 || membro.estado) ? (
            <div className="flex flex-wrap gap-1 mt-3">
              {esps.map((e) => (
                <span
                  key={e}
                  className="text-[9px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wide border"
                  style={{ color: `${accentColor}99`, borderColor: `${accentColor}20`, background: `${accentColor}08` }}
                >
                  {e}
                </span>
              ))}
              {membro.estado && (
                <span className="text-[9px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wide border border-white/10 text-white/30">
                  {membro.estado}
                </span>
              )}
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}

// ---- Stats bar ----
function StatItem({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 border-r border-brand-gold/10 last:border-0">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-brand-gold/50" />
        <span className="text-xl font-bold font-mono text-brand-gold tabular-nums">{value}</span>
      </div>
      <span className="text-[10px] text-white/30 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default function MembrosPage() {
  const [search, setSearch] = useState("");
  const [filterEspecialidade, setFilterEspecialidade] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterTipoCadastro, setFilterTipoCadastro] = useState("");

  const { data: membrosRaw = [], isLoading } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
  });

  const membros = useMemo(
    () => membrosRaw.map(m => ({ ...m, _nome: getDisplayNome(m) })),
    [membrosRaw]
  );

  const especialidades = useMemo(() => {
    const all = new Set<string>();
    membros.forEach(m => {
      if (Array.isArray(m.especialidades)) m.especialidades.forEach(e => e && all.add(e));
      else if (m.especialidade) all.add(m.especialidade);
    });
    return [...all].sort();
  }, [membros]);

  const estados = useMemo(
    () => [...new Set(membros.map(m => m.estado).filter(Boolean))].sort() as string[],
    [membros]
  );

  const empresas = useMemo(
    () => [...new Set(membros.map(m => m.empresa).filter(Boolean))].sort() as string[],
    [membros]
  );

  const tiposCadastro = useMemo(
    () => [...new Set(membros.map(m => m.tipo_de_cadastro).filter(Boolean))].sort() as string[],
    [membros]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return membros.filter(m => {
      const allEsps = Array.isArray(m.especialidades) && m.especialidades.length > 0
        ? m.especialidades
        : m.especialidade ? [m.especialidade] : [];
      const matchSearch = !q || [
        m._nome, ...allEsps, m.empresa, m.cidade, m.estado, m.email
      ].some(f => f?.toLowerCase().includes(q));
      const matchEsp = !filterEspecialidade || allEsps.includes(filterEspecialidade);
      const matchEstado = !filterEstado || m.estado === filterEstado;
      const matchTipo = !filterTipoCadastro || m.tipo_de_cadastro === filterTipoCadastro;
      return matchSearch && matchEsp && matchEstado && matchTipo;
    });
  }, [membros, search, filterEspecialidade, filterEstado, filterTipoCadastro]);

  const stats = useMemo(() => ({
    total: membros.length,
    empresas: empresas.length,
    estados: estados.length,
    especialidades: especialidades.length,
  }), [membros, empresas, estados, especialidades]);

  const hasFilters = search || filterEspecialidade || filterEstado || filterTipoCadastro;

  return (
    <div className="min-h-screen" style={{ background: "#020b16" }}>
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.4; }
          94% { opacity: 1; }
          97% { opacity: 0.8; }
          98% { opacity: 1; }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.3; }
        }
        @keyframes drift {
          0% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-8px) translateX(4px); }
          66% { transform: translateY(4px) translateX(-4px); }
          100% { transform: translateY(0px) translateX(0px); }
        }
      `}</style>

      {/* ── Hero Header ── */}
      <div
        className="relative overflow-hidden border-b border-brand-gold/10"
        style={{
          background: "radial-gradient(ellipse at 20% 50%, #001225 0%, #000c1f 40%, #020b16 100%)",
          minHeight: 220,
        }}
      >
        {/* Tech grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(215,187,125,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Floating orbs */}
        <div className="absolute top-8 right-20 w-48 h-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(215,187,125,0.06) 0%, transparent 70%)", animation: "drift 8s ease-in-out infinite" }} />
        <div className="absolute bottom-0 left-32 w-32 h-32 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(109,168,220,0.06) 0%, transparent 70%)", animation: "drift 11s ease-in-out infinite reverse" }} />

        {/* Scan line */}
        <div className="absolute left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.3), transparent)", animation: "scanline 4s linear infinite", top: "50%" }} />

        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-brand-gold/40" />
        <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-brand-gold/40" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-brand-gold/40" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-brand-gold/40" />

        {/* Side node decorations */}
        {[0.2, 0.5, 0.8].map((pos, i) => (
          <div key={i} className="absolute left-0 w-1 h-6 rounded-r" style={{ top: `${pos * 100}%`, background: "rgba(215,187,125,0.4)" }} />
        ))}
        {[0.3, 0.6].map((pos, i) => (
          <div key={i} className="absolute right-0 w-1 h-6 rounded-l" style={{ top: `${pos * 100}%`, background: "rgba(109,168,220,0.4)" }} />
        ))}

        <div className="relative z-10 px-6 py-8">
          {/* Tag line */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-1 rounded-full bg-brand-gold" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span className="text-[10px] font-mono text-brand-gold/50 tracking-[0.4em] uppercase">
              BUILT ALLIANCES // REDE DE PROFISSIONAIS
            </span>
          </div>

          <h1
            className="text-3xl font-bold font-mono text-brand-gold tracking-wide mb-1"
            style={{ animation: "flicker 6s ease-in-out infinite", textShadow: "0 0 20px rgba(215,187,125,0.3)" }}
          >
            MEMBROS
          </h1>
          <p className="text-sm text-white/30 font-mono mb-6">
            &gt; {isLoading ? "carregando perfis..." : `${membros.length} nós ativos na rede`}
          </p>

          {/* Stats */}
          <div className="inline-flex items-center rounded-lg border border-brand-gold/10 py-3" style={{ background: "rgba(0,10,20,0.6)", backdropFilter: "blur(8px)" }}>
            <StatItem label="Membros" value={stats.total} icon={Users} />
            <StatItem label="Empresas" value={stats.empresas} icon={Building2} />
            <StatItem label="Estados" value={stats.estados} icon={Globe} />
            <StatItem label="Especialidades" value={stats.especialidades} icon={Activity} />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="sticky top-0 z-20 border-b border-white/5 px-6 py-3 flex flex-wrap gap-3 items-center" style={{ background: "rgba(2,11,22,0.95)", backdropFilter: "blur(12px)" }}>
        {/* Search */}
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gold/40" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, especialidade, empresa, cidade..."
            className="pl-9 pr-8 h-8 text-sm bg-white/5 border-white/10 focus:border-brand-gold/40 placeholder:text-white/20 text-white font-mono"
            data-testid="input-busca-membros"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Cargo filter */}
        {especialidades.length > 0 && (
          <Select value={filterEspecialidade || "__all__"} onValueChange={v => setFilterEspecialidade(v === "__all__" ? "" : v)}>
            <SelectTrigger
              className="h-8 w-52 text-xs border-white/10 bg-white/5 text-white/60 font-mono focus:border-brand-gold/40"
              data-testid="select-filter-especialidade"
            >
              <SelectValue placeholder="Todas as especialidades" />
            </SelectTrigger>
            <SelectContent className="bg-[#050f1c] border-white/10 text-white/80 font-mono text-xs">
              <SelectItem value="__all__" className="text-white/50">Todas as especialidades</SelectItem>
              {especialidades.map(e => (
                <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Estado filter */}
        {estados.length > 0 && (
          <Select value={filterEstado || "__all__"} onValueChange={v => setFilterEstado(v === "__all__" ? "" : v)}>
            <SelectTrigger
              className="h-8 w-36 text-xs border-white/10 bg-white/5 text-white/60 font-mono focus:border-brand-gold/40"
              data-testid="select-filter-estado"
            >
              <SelectValue placeholder="Todos os estados" />
            </SelectTrigger>
            <SelectContent className="bg-[#050f1c] border-white/10 text-white/80 font-mono text-xs">
              <SelectItem value="__all__" className="text-white/50">Todos os estados</SelectItem>
              {estados.map(e => (
                <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Tipo de Cadastro filter */}
        {tiposCadastro.length > 0 && (
          <Select value={filterTipoCadastro || "__all__"} onValueChange={v => setFilterTipoCadastro(v === "__all__" ? "" : v)}>
            <SelectTrigger
              className="h-8 w-40 text-xs border-white/10 bg-white/5 text-white/60 font-mono focus:border-brand-gold/40"
              data-testid="select-filter-tipo-cadastro"
            >
              <SelectValue placeholder="Tipo de cadastro" />
            </SelectTrigger>
            <SelectContent className="bg-[#050f1c] border-white/10 text-white/80 font-mono text-xs">
              <SelectItem value="__all__" className="text-white/50">Todos os tipos</SelectItem>
              {tiposCadastro.map(t => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setFilterEspecialidade(""); setFilterEstado(""); setFilterTipoCadastro(""); }}
            className="h-8 px-3 text-xs rounded-md border border-red-500/20 text-red-400/60 hover:border-red-500/40 hover:text-red-400 transition-colors font-mono flex items-center gap-1.5"
          >
            <X className="w-3 h-3" />
            Limpar
          </button>
        )}

        {/* Result count */}
        <div className="ml-auto text-xs font-mono text-white/25 hidden sm:block">
          {filtered.length} / {membros.length} nós
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/5 p-5 space-y-4" style={{ background: "#050f1c" }}>
                <div className="flex items-start gap-3">
                  <Skeleton className="w-14 h-14 rounded-full bg-white/5" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-4 w-3/4 bg-white/5" />
                    <Skeleton className="h-3 w-1/2 bg-white/5" />
                  </div>
                </div>
                <Skeleton className="h-px w-full bg-white/5" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full bg-white/5" />
                  <Skeleton className="h-3 w-2/3 bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <Cpu className="w-16 h-16 text-white/10" />
              <Wifi className="w-6 h-6 text-brand-gold/20 absolute -top-1 -right-1" />
            </div>
            <p className="text-white/30 font-mono text-sm">
              {hasFilters ? "// nenhum nó encontrado para os filtros aplicados" : "// rede vazia"}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setFilterEspecialidade(""); setFilterEstado(""); setFilterTipoCadastro(""); }}
                className="mt-3 text-xs text-brand-gold/40 hover:text-brand-gold/70 font-mono underline"
              >
                limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((membro, i) => (
              <MembroCard key={membro.id} membro={membro} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
