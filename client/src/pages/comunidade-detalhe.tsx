import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, MapPin, Users, Briefcase, Shield,
  MessageCircle, Pencil, Globe, Calendar, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Membro {
  id: string;
  nome?: string;
  cargo?: string;
  empresa?: string;
  foto_perfil?: string | null;
  tipo_de_cadastro?: string | null;
  tipo_alianca?: string | null;
  tipos_alianca?: string[] | null;
  nucleo_alianca?: string | null;
  nucleos_alianca?: string[] | null;
  Outras_redes_as_quais_pertenco?: string[] | null;
  em_built_capital?: boolean | null;
  na_vitrine?: boolean | null;
}
interface Bia {
  id: string;
  nome_bia?: string;
  localizacao?: string;
}
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
  status?: string;
  date_created?: string;
  aliado?: Membro | string | null;
  membros?: MembroJunction[];
  bias?: BiaJunction[];
  analytics?: {
    opas_total: number;
    opas_por_abrangencia: Array<{ name: string; value: number }>;
    composicao: {
      parceiros_mercado: number;
      area_aliancas: number;
      parceiros_capital: number;
    };
  };
}

const CHART_COLORS = ["#D7BB7D", "#0EA5E9", "#10B981", "#8B5CF6"];

function resolveAliado(c: Comunidade): Membro | null {
  if (!c.aliado) return null;
  if (typeof c.aliado === "object") return c.aliado as Membro;
  return null;
}
function resolveMembros(c: Comunidade): Membro[] {
  if (!Array.isArray(c.membros)) return [];
  return c.membros.flatMap((m) => {
    const v = m.cadastro_geral_id;
    if (!v || typeof v === "string") return [];
    return [v as Membro];
  });
}
function resolveBias(c: Comunidade): Bia[] {
  if (!Array.isArray(c.bias)) return [];
  return c.bias.flatMap((b) => {
    const v = b.bias_projetos_id;
    if (!v || typeof v === "string") return [];
    return [v as Bia];
  });
}
function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=80&height=80&fit=cover`;
}
function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}
function formatDate(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function DarkPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 space-y-4 ${className}`}
      style={{
        background: "linear-gradient(145deg, #071626, #040e1c)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-brand-gold/60" />
      <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">{children}</h2>
    </div>
  );
}

export default function ComunidadeDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const fromDashboard = new URLSearchParams(location.split("?")[1] || "").get("from") === "dashboard";
  const backHref = fromDashboard ? "/" : "/comunidade";
  const backLabel = fromDashboard ? "Voltar para Dashboard" : "Voltar para Comunidades";

  const { data: comunidade, isLoading, isError } = useQuery<Comunidade>({
    queryKey: ["/api/comunidades", id],
    queryFn: () =>
      fetch(`/api/comunidades/${id}`).then(r => {
        if (!r.ok) throw new Error("Não encontrado");
        return r.json();
      }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !comunidade) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-64 gap-4">
        <MessageCircle className="w-12 h-12 text-brand-gold/20" />
        <p className="text-white/40 font-mono">Comunidade não encontrada</p>
        <Button variant="ghost" onClick={() => navigate(backHref)} className="text-brand-gold">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const aliado = resolveAliado(comunidade);
  const membros = resolveMembros(comunidade);
  const bias = resolveBias(comunidade);
  const aliadoFoto = fotoUrl(aliado?.foto_perfil);
  const analytics = comunidade.analytics ?? {
    opas_total: 0,
    opas_por_abrangencia: [
      { name: "Regional", value: 0 },
      { name: "Nacional", value: 0 },
      { name: "Global", value: 0 },
    ],
    composicao: {
      parceiros_mercado: 0,
      area_aliancas: 0,
      parceiros_capital: 0,
    },
  };
  const opaChartData = [
    { name: "Total", value: analytics.opas_total },
    ...analytics.opas_por_abrangencia,
  ];
  const composicaoChartData = [
    { name: "Mercado", value: analytics.composicao.parceiros_mercado },
    { name: "Área de Alianças", value: analytics.composicao.area_aliancas },
    { name: "Capital", value: analytics.composicao.parceiros_capital },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(backHref)}
        className="inline-flex items-center gap-2 text-sm font-mono px-3 py-1.5 rounded-lg transition-colors text-brand-gold/70 hover:text-brand-gold hover:bg-brand-gold/10 border border-brand-gold/20 hover:border-brand-gold/40"
        data-testid="btn-back-comunidade"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </button>

      {/* Hero */}
      <div
        className="relative rounded-2xl overflow-hidden p-8"
        style={{
          background: "linear-gradient(135deg, #071626 0%, #040e1c 60%, #071420 100%)",
          border: "1px solid rgba(215,187,125,0.15)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Gold line top */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.6), transparent)" }} />

        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, #D7BB7D, transparent)" }} />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            {/* Sigla / code */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl"
                style={{ background: "rgba(215,187,125,0.1)", border: "1px solid rgba(215,187,125,0.2)" }}>
                <MessageCircle className="w-5 h-5 text-brand-gold" />
              </div>
              {comunidade.sigla && (
                <span className="text-xs font-mono text-brand-gold/60 tracking-[0.2em] uppercase">
                  {comunidade.sigla}
                </span>
              )}
            </div>

            {/* Nome */}
            <h1 className="text-2xl font-bold text-white font-mono leading-tight" data-testid="text-comunidade-nome">
              {comunidade.nome || "—"}
            </h1>

            {/* Localização */}
            {(comunidade.territorio || comunidade.pais) && (
              <div className="flex items-center gap-1.5 text-sm text-white/50 font-mono">
                <MapPin className="w-4 h-4 text-brand-gold/50" />
                {[comunidade.territorio, comunidade.pais].filter(Boolean).join(", ")}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-mono border ${
              comunidade.status === "ativa"
                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                : "border-white/10 text-white/30 bg-white/5"
            }`} data-testid="text-status">
              {comunidade.status || "ativa"}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/comunidade?edit=${id}`)}
              className="border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 font-mono text-xs"
              data-testid="btn-edit-from-detail"
            >
              <Pencil className="w-3 h-3 mr-1.5" />
              Editar
            </Button>
          </div>
        </div>

        {/* Meta info */}
        <div className="relative mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-6 text-xs font-mono text-white/30">
          {comunidade.date_created && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-gold/30" />
              Criada em {formatDate(comunidade.date_created)}
            </div>
          )}
          {comunidade.codigo_sequencial && (
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-brand-gold/30" />
              Código {comunidade.codigo_sequencial}
            </div>
          )}
          {(comunidade.sigla_pais || comunidade.sigla_territorio) && (
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-brand-gold/30" />
              {[comunidade.sigla_pais, comunidade.sigla_territorio].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Aliado BUILT */}
        <div
          className="rounded-2xl p-5 space-y-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #071626, #040e1c)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-brand-gold/60" />
            <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">Aliado BUILT</h2>
          </div>
          {/* Selo Alliance Partner */}
          <img
            src="/built-alliance-partner.png"
            alt="BUILT Alliance Partner"
            className="absolute top-3 right-3 opacity-20 select-none pointer-events-none"
            style={{ height: 56, width: "auto" }}
          />

          {aliado ? (
            <button
              onClick={() => navigate(`/membro/${aliado.id}`)}
              className="w-full flex items-center gap-4 p-3 rounded-xl transition-colors hover:bg-white/5 text-left"
              data-testid="btn-aliado-link"
            >
              <div
                className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-brand-gold/25"
                style={{ background: aliadoFoto ? "transparent" : "rgba(215,187,125,0.08)" }}
              >
                {aliadoFoto
                  ? <img src={aliadoFoto} alt={aliado.nome} className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-brand-gold/60">{getInitials(aliado.nome)}</span>
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white font-mono truncate">{aliado.nome}</p>
                {aliado.cargo && <p className="text-xs text-white/40 font-mono truncate">{aliado.cargo}</p>}
                {aliado.empresa && <p className="text-xs text-brand-gold/50 font-mono truncate">{aliado.empresa}</p>}
              </div>
            </button>
          ) : (
            <p className="text-xs text-white/25 font-mono italic">Nenhum Aliado BUILT definido</p>
          )}
        </div>

        {/* Stats quick view */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{
            background: "linear-gradient(145deg, #071626, #040e1c)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">Resumo</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(215,187,125,0.05)", border: "1px solid rgba(215,187,125,0.1)" }}>
              <p className="text-2xl font-bold text-brand-gold font-mono">{membros.length}</p>
              <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest mt-1">Membros</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(215,187,125,0.05)", border: "1px solid rgba(215,187,125,0.1)" }}>
              <p className="text-2xl font-bold text-brand-gold font-mono">{bias.length}</p>
              <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest mt-1">BIAs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores da comunidade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DarkPanel>
          <SectionTitle icon={Globe}>OPAs da Comunidade</SectionTitle>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opaChartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(215,187,125,0.08)" }}
                  contentStyle={{ background: "#071626", border: "1px solid rgba(215,187,125,0.25)", borderRadius: 8, color: "#fff" }}
                  formatter={(value: number) => [Number(value), "OPAs"]}
                />
                <Bar dataKey="value" name="OPAs" radius={[4, 4, 0, 0]}>
                  {opaChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-white/35 font-mono">
            Nº total de OPAs da comunidade vs OPAs Regional, Nacional e Global.
          </p>
        </DarkPanel>

        <DarkPanel>
          <SectionTitle icon={Users}>Composição da Comunidade</SectionTitle>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={composicaoChartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(215,187,125,0.08)" }}
                  contentStyle={{ background: "#071626", border: "1px solid rgba(215,187,125,0.25)", borderRadius: 8, color: "#fff" }}
                  formatter={(value: number) => [Number(value), "Membros"]}
                />
                <Bar dataKey="value" name="Membros" radius={[4, 4, 0, 0]}>
                  {composicaoChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[(index + 1) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {composicaoChartData.map((item) => (
              <div key={item.name} className="rounded-xl p-3 text-center" style={{ background: "rgba(215,187,125,0.05)", border: "1px solid rgba(215,187,125,0.1)" }}>
                <p className="text-xl font-bold text-brand-gold font-mono">{item.value}</p>
                <p className="text-[9px] text-white/40 font-mono uppercase tracking-widest mt-1">{item.name}</p>
              </div>
            ))}
          </div>
        </DarkPanel>
      </div>

      {/* Membros */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{
          background: "linear-gradient(145deg, #071626, #040e1c)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-gold/60" />
          <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">
            Membros Associados
          </h2>
          <Badge variant="outline" className="ml-auto border-white/10 text-white/30 text-[10px] font-mono">
            {membros.length}
          </Badge>
        </div>

        {membros.length === 0 ? (
          <p className="text-xs text-white/25 font-mono italic">Nenhum membro associado</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {membros.map(m => {
              const foto = fotoUrl(m.foto_perfil);
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/membro/${m.id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:bg-white/5"
                  style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                  data-testid={`btn-membro-${m.id}`}
                >
                  <div
                    className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-white/10"
                    style={{ background: foto ? "transparent" : "rgba(215,187,125,0.06)" }}
                  >
                    {foto
                      ? <img src={foto} alt={m.nome} className="w-full h-full object-cover" />
                      : <span className="text-[10px] font-bold text-brand-gold/50">{getInitials(m.nome)}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white font-mono truncate">{m.nome || "—"}</p>
                    {m.cargo && <p className="text-[10px] text-white/35 font-mono truncate">{m.cargo}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* BIAs */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{
          background: "linear-gradient(145deg, #071626, #040e1c)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-brand-gold/60" />
          <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">
            BIAs Associadas
          </h2>
          <Badge variant="outline" className="ml-auto border-white/10 text-white/30 text-[10px] font-mono">
            {bias.length}
          </Badge>
        </div>

        {bias.length === 0 ? (
          <p className="text-xs text-white/25 font-mono italic">Nenhuma BIA associada</p>
        ) : (
          <div className="space-y-2">
            {bias.map(b => (
              <button
                key={b.id}
                onClick={() => navigate(`/bias/${b.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:bg-white/5 group"
                style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                data-testid={`btn-bia-${b.id}`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(215,187,125,0.08)", border: "1px solid rgba(215,187,125,0.15)" }}
                >
                  <Briefcase className="w-3.5 h-3.5 text-brand-gold/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white font-mono truncate group-hover:text-brand-gold transition-colors">
                    {b.nome_bia || "—"}
                  </p>
                  {b.localizacao && (
                    <p className="text-[10px] text-white/35 font-mono truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {b.localizacao}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
