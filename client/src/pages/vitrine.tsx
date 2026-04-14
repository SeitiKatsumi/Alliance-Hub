import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Store, Search, MapPin, Phone, Mail, Building2,
  Briefcase, Users, X
} from "lucide-react";

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

function whatsappLink(w?: string): string | null {
  if (!w) return null;
  const digits = w.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : "55" + digits}`;
}

export default function VitrinePage() {
  const [search, setSearch] = useState("");
  const [filterEspecialidade, setFilterEspecialidade] = useState("all");
  const [filterEstado, setFilterEstado] = useState("all");

  const { data: membros = [], isLoading } = useQuery<MembroVitrine[]>({
    queryKey: ["/api/vitrine"],
    queryFn: async () => {
      const r = await fetch("/api/vitrine");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

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
    <div className="min-h-screen" style={{ background: "#020b16" }}>
      {/* Header */}
      <div
        className="relative overflow-hidden border-b border-brand-gold/10 px-6 py-8"
        style={{ background: "radial-gradient(ellipse at 30% 50%, #001428 0%, #000c1f 50%, #020b16 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,187,125,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.04) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
        <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-brand-gold/40" />
        <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-brand-gold/40" />
        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-brand-gold/40" />
        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-brand-gold/40" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl border border-brand-gold/20 flex items-center justify-center"
              style={{ background: "rgba(215,187,125,0.08)" }}>
              <Store className="w-5 h-5 text-brand-gold/70" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.35em] uppercase">// Rede BUILT</p>
              <h1 className="text-xl font-bold font-mono text-brand-gold">VITRINE BUILT</h1>
            </div>
          </div>

          <p className="text-sm text-white/40 max-w-2xl leading-relaxed">
            Área de acesso livre — encontre fornecedores, prestadores de serviços e empresas da rede BUILT. 
            Presença, divulgação de ofertas e conexões estratégicas.
          </p>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5"
              style={{ background: "rgba(215,187,125,0.06)" }}>
              <Users className="w-3.5 h-3.5 text-brand-gold/50" />
              <span className="text-xs font-mono text-white/50">
                {isLoading ? "..." : `${membros.length} cadastro${membros.length !== 1 ? "s" : ""}`}
              </span>
            </div>
            {hasFilters && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5"
                style={{ background: "rgba(215,187,125,0.04)" }}>
                <span className="text-xs font-mono text-white/40">{filtered.length} exibindo</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-white/5 flex flex-wrap items-center gap-3"
        style={{ background: "#030d1a" }}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input
            placeholder="Buscar por nome, empresa ou especialidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40 h-9 text-sm"
            data-testid="input-vitrine-search"
          />
        </div>

        <Select value={filterEspecialidade} onValueChange={setFilterEspecialidade}>
          <SelectTrigger className="w-44 h-9 bg-white/5 border-white/10 text-sm text-white" data-testid="select-vitrine-especialidade">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent className="bg-[#030d1a] border-white/10">
            <SelectItem value="all" className="text-white/60">Todas especialidades</SelectItem>
            {especialidades.map(e => (
              <SelectItem key={e} value={e} className="text-white">{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-32 h-9 bg-white/5 border-white/10 text-sm text-white" data-testid="select-vitrine-estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="bg-[#030d1a] border-white/10">
            <SelectItem value="all" className="text-white/60">Todos estados</SelectItem>
            {estados.map(e => (
              <SelectItem key={e} value={e} className="text-white">{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 transition-colors"
            data-testid="btn-vitrine-clear-filters"
          >
            <X className="w-3 h-3" />
            Limpar
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Store className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/30 font-mono text-sm">
              {hasFilters ? "Nenhum resultado para os filtros aplicados" : "Nenhum membro na Vitrine ainda"}
            </p>
            <p className="text-white/15 text-xs mt-1 font-mono">
              {hasFilters ? "Tente ajustar os filtros" : "Os membros podem ativar sua presença em Meu Perfil"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(m => (
              <MembroCard key={m.id} membro={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MembroCard({ membro: m }: { membro: MembroVitrine }) {
  const foto = fotoUrl(m);
  const nome = m.nome || "—";
  const wa = whatsappLink(m.whatsapp);

  return (
    <div
      className="relative rounded-xl border border-white/8 overflow-hidden group transition-all duration-300 hover:border-brand-gold/25 hover:shadow-lg"
      style={{
        background: "linear-gradient(145deg, #071626, #040e1c)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      }}
      data-testid={`card-vitrine-${m.id}`}
    >
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.3), transparent)" }} />

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-brand-gold/20" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-brand-gold/20" />

      <div className="p-4 space-y-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center overflow-hidden border border-brand-gold/20"
            style={{
              background: foto ? "transparent" : "radial-gradient(circle at 30% 30%, rgba(215,187,125,0.15), rgba(3,8,18,0.9))",
              boxShadow: "0 0 12px rgba(215,187,125,0.1)",
            }}
          >
            {foto ? (
              <img src={foto} alt={nome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-base font-bold font-mono text-brand-gold/80">{getInitials(nome)}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate font-mono">{nome}</p>
            {(m.cargo || m.especialidade) && (
              <p className="text-xs text-white/40 truncate">{m.cargo || m.especialidade}</p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1.5">
          {m.empresa && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-brand-gold/30 shrink-0" />
              <span className="text-xs text-white/50 truncate">{m.empresa}</span>
            </div>
          )}
          {m.especialidade && m.cargo && (
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-3 h-3 text-brand-gold/30 shrink-0" />
              <span className="text-xs text-white/50 truncate">{m.especialidade}</span>
            </div>
          )}
          {(m.cidade || m.estado) && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-brand-gold/30 shrink-0" />
              <span className="text-xs text-white/50 truncate">
                {[m.cidade, m.estado?.toUpperCase()].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5" />

        {/* Contact */}
        <div className="flex gap-2">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono text-white/50 hover:text-white/80 border border-white/8 hover:border-white/20 transition-colors"
              style={{ background: "rgba(255,255,255,0.03)" }}
              data-testid={`btn-vitrine-whatsapp-${m.id}`}
            >
              <Phone className="w-3 h-3" />
              WhatsApp
            </a>
          )}
          {m.email && (
            <a
              href={`mailto:${m.email}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono text-white/50 hover:text-white/80 border border-white/8 hover:border-white/20 transition-colors"
              style={{ background: "rgba(255,255,255,0.03)" }}
              data-testid={`btn-vitrine-email-${m.id}`}
            >
              <Mail className="w-3 h-3" />
              E-mail
            </a>
          )}
          {!wa && !m.email && (
            <span className="flex-1 flex items-center justify-center py-1.5 text-xs font-mono text-white/20">
              Sem contato público
            </span>
          )}
        </div>

        {/* Nucleo badge */}
        {m.nucleo_alianca && (
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-brand-gold/15 text-brand-gold/40 bg-transparent w-full justify-center truncate"
          >
            {m.nucleo_alianca}
          </Badge>
        )}
      </div>
    </div>
  );
}
