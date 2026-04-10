import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, MapPin, Target, Building2, Globe, Pencil,
  Layers, FileText, Paperclip, ExternalLink, CheckCircle2,
  XCircle, DollarSign, TrendingUp, ClipboardList, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useMemo } from "react";

interface AnexoFile {
  id: string;
  title?: string;
  filename?: string;
  url?: string;
  size?: string;
}

interface Oportunidade {
  id: string;
  nome_oportunidade?: string;
  tipo?: string;
  bia_id?: string;
  valor_origem_opa?: string | number;
  Minimo_esforco_multiplicador?: string | number;
  objetivo_alianca?: string;
  nucleo_alianca?: string;
  pais?: string;
  descricao?: string;
  perfil_aliado?: string;
  status?: "ativa" | "concluida" | "desistencia" | null;
  motivo_encerramento?: string | null;
  Anexos?: AnexoFile[];
  date_created?: string | null;
}

interface BiasProjeto {
  id: string;
  nome_bia: string;
  localizacao?: string;
  moeda?: string;
}

function n(v?: string | number | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function brl(value: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-brand-gold/70" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default function OpaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: opasRaw = [], isLoading } = useQuery<Oportunidade[]>({
    queryKey: ["/api/oportunidades"],
  });

  const { data: biasRaw = [] } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const opa = useMemo(
    () => (opasRaw as Oportunidade[]).find(o => o.id === id) || null,
    [opasRaw, id]
  );

  const bia = useMemo(
    () => opa?.bia_id ? (biasRaw as BiasProjeto[]).find(b => b.id === opa.bia_id) : undefined,
    [biasRaw, opa]
  );

  const valor = n(opa?.valor_origem_opa);
  const mult = n(opa?.Minimo_esforco_multiplicador);
  const isClosed = opa?.status === "concluida" || opa?.status === "desistencia";

  const dias = opa?.date_created
    ? Math.floor((Date.now() - new Date(opa.date_created).getTime()) / 86400000)
    : null;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (!opa) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">OPA não encontrada.</p>
        <Button variant="link" onClick={() => navigate("/opas")}>Voltar para OPAs</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back + Edit */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/opas")}
          className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
          data-testid="btn-back-opas"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para OPAs
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-brand-gold/30 text-brand-gold hover:border-brand-gold hover:bg-brand-gold/5"
          onClick={() => navigate(`/opas?edit=${id}`)}
          data-testid="btn-edit-opa-detail"
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
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-sm border"
              style={{ borderColor: "rgba(215,187,125,0.3)", color: "#D7BB7D99", background: "rgba(215,187,125,0.06)" }}>
              <span style={{ color: "#D7BB7D60" }}>◆</span> OPA
            </span>
            {opa.tipo && <Badge variant="secondary" className="text-[10px]">{opa.tipo}</Badge>}
            {isClosed && opa.status === "concluida" && (
              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Concluída
              </Badge>
            )}
            {isClosed && opa.status === "desistencia" && (
              <Badge className="text-[10px] bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/15">
                <XCircle className="w-3 h-3 mr-1" /> Desistência
              </Badge>
            )}
          </div>

          <h1 className="text-2xl font-bold text-brand-gold">
            {opa.nome_oportunidade || "Sem nome"}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            {opa.nucleo_alianca && (
              <p className="text-sm text-brand-gold/60 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />{opa.nucleo_alianca}
              </p>
            )}
            {opa.pais && (
              <p className="text-sm text-brand-gold/60 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />{opa.pais}
              </p>
            )}
            {dias !== null && (
              <p className="text-xs text-brand-gold/35 font-mono">
                {dias === 0 ? "Publicada hoje" : dias === 1 ? "Publicada há 1 dia" : `Publicada há ${dias} dias`}
              </p>
            )}
          </div>

          {opa.objetivo_alianca && (
            <p className="text-sm text-brand-gold/50 mt-3 leading-relaxed max-w-3xl">{opa.objetivo_alianca}</p>
          )}
        </div>
      </div>

      {/* Key metrics */}
      {(valor > 0 || mult > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
          {valor > 0 && (
            <div className="rounded-lg bg-muted/40 border border-border/50 p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Valor da OPA</p>
              <p className="text-xl font-bold text-brand-gold tabular-nums">{brl(valor, bia?.moeda || "BRL")}</p>
            </div>
          )}
          {mult > 0 && (
            <div className="rounded-lg bg-muted/40 border border-border/50 p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Mín. Esforço Multiplicador</p>
              <p className="text-xl font-bold tabular-nums">{mult}%</p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-6">

          {/* BIA vinculada */}
          {bia && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={Layers}>BIA Vinculada</SectionTitle>
                <div
                  className="flex items-center gap-3 rounded-xl px-4 py-3 border border-brand-gold/20 cursor-pointer hover:border-brand-gold/40 transition-colors"
                  style={{ background: "rgba(215,187,125,0.04)" }}
                  onClick={() => navigate(`/bias/${bia.id}`)}
                  data-testid="link-bia-vinculada"
                >
                  <Layers className="w-4 h-4 text-brand-gold/50 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-gold/80">{bia.nome_bia}</p>
                    {bia.localizacao && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />{bia.localizacao}
                      </p>
                    )}
                  </div>
                  <ArrowLeft className="w-4 h-4 text-brand-gold/30 rotate-180 shrink-0" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Descrição */}
          {opa.descricao && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={ClipboardList}>Descrição / Escopo</SectionTitle>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{opa.descricao}</p>
              </CardContent>
            </Card>
          )}

          {/* Perfil do aliado */}
          {opa.perfil_aliado && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={Users}>Perfil do Aliado</SectionTitle>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{opa.perfil_aliado}</p>
              </CardContent>
            </Card>
          )}

          {/* Motivo encerramento */}
          {isClosed && opa.motivo_encerramento && (
            <Card className="border-muted/50">
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={XCircle}>Motivo do Encerramento</SectionTitle>
                <p className="text-sm text-muted-foreground leading-relaxed">{opa.motivo_encerramento}</p>
              </CardContent>
            </Card>
          )}

          {/* Anexos */}
          {opa.Anexos && opa.Anexos.length > 0 && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={Paperclip}>
                  Anexos
                  <Badge variant="secondary" className="ml-2 text-xs">{opa.Anexos.length}</Badge>
                </SectionTitle>
                <div className="space-y-2">
                  {opa.Anexos.map((anexo, i) => (
                    <a
                      key={anexo.id || i}
                      href={anexo.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 px-3 py-2.5 transition-colors group"
                      data-testid={`link-opa-anexo-${i}`}
                    >
                      <FileText className="w-4 h-4 text-brand-gold/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{anexo.title || anexo.filename || anexo.id}</p>
                        {anexo.size && <p className="text-[11px] text-muted-foreground">{anexo.size}</p>}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right col — metadata */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-5 pb-4 space-y-4">
              <SectionTitle icon={Target}>Informações</SectionTitle>
              <InfoRow label="Tipo" value={opa.tipo} />
              <InfoRow label="Núcleo de Aliança" value={opa.nucleo_alianca} />
              <InfoRow label="País" value={opa.pais} />
              {opa.date_created && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Data de publicação</span>
                  <span className="text-sm">
                    {new Date(opa.date_created).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "long", year: "numeric"
                    })}
                  </span>
                </div>
              )}
              {valor > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valor da OPA</span>
                      <span className="text-sm font-bold text-brand-gold tabular-nums">{brl(valor, bia?.moeda || "BRL")}</span>
                    </div>
                    {mult > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Mín. Multiplicador</span>
                        <span className="text-sm font-bold tabular-nums">{mult}%</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
