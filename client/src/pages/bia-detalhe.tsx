import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, MapPin, Crosshair, Briefcase, Crown, Shield, Hammer,
  Wallet, TrendingUp, TrendingDown, Target, Building2, Globe,
  Pencil, Layers, FileText, Users, Paperclip, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useMemo } from "react";

// ---- Types ----
interface AnexoFile {
  id: string;
  title?: string;
  filename?: string;
  url: string;
  size?: number;
}

interface BiasProjeto {
  id: string;
  nome_bia: string;
  objetivo_alianca?: string;
  observacoes?: string;
  localizacao?: string;
  latitude?: number | null;
  longitude?: number | null;
  autor_bia?: string | null;
  aliado_built?: string | null;
  diretor_alianca?: string | null;
  diretor_nucleo_tecnico?: string | null;
  diretor_execucao?: string | null;
  diretor_comercial?: string | null;
  diretor_capital?: string | null;
  valor_origem?: string | number;
  divisor_multiplicador?: string | number;
  perc_autor_opa?: string | number;
  perc_aliado_built?: string | number;
  perc_built?: string | number;
  perc_dir_tecnico?: string | number;
  perc_dir_alianca?: string | number;
  perc_dir_obras?: string | number;
  perc_dir_comercial?: string | number;
  perc_dir_capital?: string | number;
  cpp_autor_opa?: string | number;
  cpp_aliado_built?: string | number;
  cpp_built?: string | number;
  cpp_dir_tecnico?: string | number;
  cpp_dir_alianca?: string | number;
  cpp_dir_obras?: string | number;
  cpp_dir_comercial?: string | number;
  cpp_dir_capital?: string | number;
  custo_origem_bia?: string | number;
  custo_final_previsto?: string | number;
  valor_geral_venda_vgv?: string | number;
  valor_realizado_venda?: string | number;
  total_receita?: string | number;
  comissao_prevista_corretor?: string | number;
  ir_previsto?: string | number;
  inss_previsto?: string | number;
  manutencao_pos_obra_prevista?: string | number;
  resultado_liquido?: string | number;
  lucro_previsto?: string | number;
  inicio_aportes?: string | null;
  total_aportes?: string | number;
  Anexos?: AnexoFile[];
}

interface Membro {
  id: string;
  nome?: string;
  Nome_de_usuario?: string;
  nome_completo?: string;
  primeiro_nome?: string;
  sobrenome?: string;
  empresa?: string;
}

interface Oportunidade {
  id: string;
  nome_oportunidade?: string;
  tipo?: string;
  bia_id?: string;
  valor_origem_opa?: string | number;
  objetivo_alianca?: string;
  nucleo_alianca?: string;
  pais?: string;
  descricao?: string;
  perfil_aliado?: string;
}

// ---- Helpers ----
function n(v?: string | number | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function pct(v?: string | number | null): string {
  const val = n(v);
  return val > 0 ? `${val.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—";
}

function getMembroNome(m: Membro): string {
  return m.Nome_de_usuario || m.nome_completo ||
    [m.primeiro_nome, m.sobrenome].filter(Boolean).join(" ") ||
    m.nome || "";
}

// ---- Sub-components ----
function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-brand-gold/70" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}

function MembroChip({ nome, role, icon: Icon }: { nome?: string; role: string; icon: any }) {
  const unassigned = !nome;
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${unassigned ? "border-border/30 bg-muted/10 opacity-60" : "border-border/60 bg-muted/20"}`}>
      <div className="w-7 h-7 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-brand-gold/70" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none">{role}</p>
        <p className={`text-xs font-medium truncate mt-0.5 ${unassigned ? "text-muted-foreground/50 italic" : ""}`}>{nome || "Não atribuído"}</p>
      </div>
    </div>
  );
}

function OpaCard({ opa }: { opa: Oportunidade }) {
  const valor = n(opa.valor_origem_opa);
  return (
    <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/[0.03] p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-brand-gold/50 text-[10px]">◆</span>
            {opa.tipo && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{opa.tipo}</Badge>}
          </div>
          <p className="text-sm font-semibold">{opa.nome_oportunidade || "OPA sem nome"}</p>
        </div>
        {valor > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[9px] text-muted-foreground uppercase">Valor</p>
            <p className="text-sm font-bold text-brand-gold tabular-nums">{brl(valor)}</p>
          </div>
        )}
      </div>

      {opa.objetivo_alianca && (
        <p className="text-xs text-muted-foreground line-clamp-2">{opa.objetivo_alianca}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {opa.nucleo_alianca && (
          <Badge variant="outline" className="text-[10px] h-5 gap-1 font-normal">
            <Building2 className="w-2.5 h-2.5" />{opa.nucleo_alianca}
          </Badge>
        )}
        {opa.pais && (
          <Badge variant="outline" className="text-[10px] h-5 gap-1 font-normal">
            <Globe className="w-2.5 h-2.5" />{opa.pais}
          </Badge>
        )}
      </div>

      {opa.perfil_aliado && (
        <p className="text-[11px] text-muted-foreground/70 border-t border-border/40 pt-2">{opa.perfil_aliado}</p>
      )}
      {opa.descricao && (
        <p className="text-[11px] text-muted-foreground/60 line-clamp-2">{opa.descricao}</p>
      )}
    </div>
  );
}

// ---- Main page ----
export default function BiaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: bia, isLoading: loadingBia } = useQuery<BiasProjeto>({
    queryKey: ["/api/bias", id],
    queryFn: () => fetch(`/api/bias/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: membrosRaw = [] } = useQuery<Membro[]>({ queryKey: ["/api/membros"] });
  const { data: opasRaw = [] } = useQuery<Oportunidade[]>({ queryKey: ["/api/oportunidades"] });

  const membros = useMemo(() => {
    const m: Record<string, string> = {};
    (membrosRaw as Membro[]).forEach(mb => { m[mb.id] = getMembroNome(mb); });
    return m;
  }, [membrosRaw]);

  const opas = useMemo(
    () => (opasRaw as Oportunidade[]).filter(o => o.bia_id === id),
    [opasRaw, id]
  );

  const equipe = useMemo(() => {
    if (!bia) return [];
    return [
      { id: bia.autor_bia, role: "Autor da BIA (OPA)", icon: Briefcase },
      { id: bia.aliado_built, role: "Aliado BUILT", icon: Shield },
      { id: bia.diretor_alianca, role: "Diretor de Aliança", icon: Crown },
      { id: bia.diretor_nucleo_tecnico, role: "Diretor de Núcleo Técnico", icon: Shield },
      { id: bia.diretor_execucao, role: "Diretor de Núcleo de Obra", icon: Hammer },
      { id: bia.diretor_comercial, role: "Diretor Comercial", icon: Briefcase },
      { id: bia.diretor_capital, role: "Diretor de Capital", icon: Wallet },
    ];
  }, [bia]);

  const cpp = useMemo(() => {
    if (!bia) return [];
    return [
      { label: "Autor OPA", perc: bia.perc_autor_opa, cpp: bia.cpp_autor_opa },
      { label: "Aliado BUILT", perc: bia.perc_aliado_built, cpp: bia.cpp_aliado_built },
      { label: "BUILT", perc: bia.perc_built, cpp: bia.cpp_built },
      { label: "Dir. Núcleo Técnico", perc: bia.perc_dir_tecnico, cpp: bia.cpp_dir_tecnico },
      { label: "Dir. Aliança", perc: bia.perc_dir_alianca, cpp: bia.cpp_dir_alianca },
      { label: "Dir. Obras", perc: bia.perc_dir_obras, cpp: bia.cpp_dir_obras },
      { label: "Dir. Comercial", perc: bia.perc_dir_comercial, cpp: bia.cpp_dir_comercial },
      { label: "Dir. Capital", perc: bia.perc_dir_capital, cpp: bia.cpp_dir_capital },
    ].filter(row => n(row.perc) > 0 || n(row.cpp) > 0);
  }, [bia]);

  if (loadingBia) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  if (!bia) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">BIA não encontrada.</p>
        <Button variant="link" onClick={() => navigate("/bias")}>Voltar</Button>
      </div>
    );
  }

  const vgv = n(bia.valor_geral_venda_vgv);
  const realizado = n(bia.valor_realizado_venda);
  const resultado = n(bia.resultado_liquido);
  const lucro = n(bia.lucro_previsto);
  const custoFinal = n(bia.custo_final_previsto);
  const totalAportes = n(bia.total_aportes);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/bias")}
          className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
          data-testid="btn-back-bias"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para BIAs
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-brand-gold/30 text-brand-gold hover:border-brand-gold hover:bg-brand-gold/5"
          onClick={() => navigate(`/bias?edit=${id}`)}
          data-testid="btn-edit-bia-detail"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Button>
      </div>

      {/* Hero header */}
      <div
        className="relative rounded-2xl border border-brand-gold/20 p-6 overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 0% 50%, #001d34 0%, #000c1f 60%, #000408 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: "linear-gradient(rgba(215,187,125,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-gold/40 rounded-tl-2xl" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-gold/40 rounded-tr-2xl" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-gold/40 rounded-bl-2xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-gold/40 rounded-br-2xl" />

        <div className="relative z-10">
          <p className="text-[10px] text-brand-gold/50 tracking-[0.35em] uppercase font-mono mb-1">// Built Alliances · BIA</p>
          <h1 className="text-2xl font-bold text-brand-gold font-mono tracking-wide">{bia.nome_bia}</h1>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            {bia.localizacao && (
              <p className="text-sm text-brand-gold/60 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{bia.localizacao}
              </p>
            )}
            {bia.latitude && bia.longitude && (
              <p className="text-xs text-brand-gold/35 font-mono flex items-center gap-1">
                <Crosshair className="w-3 h-3" />
                {n(bia.latitude).toFixed(5)}, {n(bia.longitude).toFixed(5)}
              </p>
            )}
            {opas.length > 0 && (
              <Badge className="gap-1 bg-brand-gold/15 text-brand-gold/80 border-brand-gold/25 hover:bg-brand-gold/20">
                <Target className="w-3 h-3" />
                {opas.length} OPA{opas.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {bia.objetivo_alianca && (
            <p className="text-sm text-brand-gold/50 mt-3 leading-relaxed max-w-3xl">{bia.objetivo_alianca}</p>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {vgv > 0 && <StatBox label="VGV" value={brl(vgv)} />}
        {realizado > 0 && <StatBox label="Realizado" value={brl(realizado)} />}
        {resultado !== 0 && (
          <StatBox
            label="Resultado Líquido"
            value={brl(resultado)}
            color={resultado >= 0 ? "text-green-600" : "text-red-600"}
          />
        )}
        {lucro !== 0 && <StatBox label="Lucro Previsto" value={brl(lucro)} />}
        {custoFinal > 0 && <StatBox label="Custo Final Previsto" value={brl(custoFinal)} />}
        {totalAportes > 0 && <StatBox label="Total de Aportes" value={brl(totalAportes)} />}
      </div>

      <div className="space-y-6">
        <div className="space-y-6">

          {/* Equipe */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <SectionTitle icon={Users}>Diretoria</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {equipe.map((e, i) => (
                  <MembroChip
                    key={i}
                    nome={e.id ? membros[e.id] : undefined}
                    role={e.role}
                    icon={e.icon}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* OPAs relacionadas */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <SectionTitle icon={Target}>
                OPAs Relacionadas
                {opas.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{opas.length}</Badge>
                )}
              </SectionTitle>
              {opas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground/50">
                  <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma OPA vinculada a esta BIA</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => navigate("/opas")}
                    className="mt-1 text-brand-gold/60"
                  >
                    Criar OPA →
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {opas.map(opa => <OpaCard key={opa.id} opa={opa} />)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Descrição */}
          {bia.observacoes && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={FileText}>Descrição</SectionTitle>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{bia.observacoes}</p>
              </CardContent>
            </Card>
          )}

          {/* Anexos */}
          {bia.Anexos && bia.Anexos.length > 0 && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={Paperclip}>
                  Anexos
                  <Badge variant="secondary" className="ml-2 text-xs">{bia.Anexos.length}</Badge>
                </SectionTitle>
                <div className="space-y-2">
                  {bia.Anexos.map(anexo => (
                    <a
                      key={anexo.id}
                      href={anexo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 px-3 py-2.5 transition-colors group"
                      data-testid={`link-anexo-${anexo.id}`}
                    >
                      <FileText className="w-4 h-4 text-brand-gold/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{anexo.title || anexo.filename || anexo.id}</p>
                        {anexo.size && (
                          <p className="text-[11px] text-muted-foreground">{(anexo.size / 1024).toFixed(0)} KB</p>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
