import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  Handshake,
  Landmark,
  Lightbulb,
  ListChecks,
  MapPin,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { OportunidadesImobiliariasPanel } from "@/pages/oportunidades-imobiliarias";
import type { BusinessSection } from "@/lib/dashboard-navigation";

type FeedKind = "demanda" | "oba" | "ro" | "bia";
type FeedContext = "recomendado" | "em_andamento" | "agenda" | "convite";

interface BusinessFeedItem {
  id: string;
  tipo: FeedKind;
  contexto?: FeedContext;
  selo: string;
  codigo?: string | null;
  titulo: string;
  resumo?: string | null;
  localizacao?: string | null;
  status?: string | null;
  data?: string | null;
  hora?: string | null;
  aderencia: number;
  motivos?: string[];
  categoria?: string | null;
  ramo_atuacao?: string | null;
  nucleo_alianca?: string | null;
  url: string;
}

interface BusinessFeedResponse {
  feed: BusinessFeedItem[];
  indicadores: {
    negocios_recebidos: number;
    recomendados?: number;
    em_andamento?: number;
    propostas_apresentadas: number;
    negocios_fechados: number;
    valores_contratados: Array<{ moeda: string; valor: number | string }>;
    bias_participadas: number;
    obas_conquistadas: number;
  };
}

interface ConvergenceStats {
  convergencias_total: number;
  interesses_manifestados: number;
  indice_convergencia: number;
  taxa_interesse: number;
}

interface MemberBusinessFeedProps {
  initialSection?: BusinessSection;
  onSectionChange?: (section: BusinessSection) => void;
  convergenceStats?: ConvergenceStats;
}

const sectionOptions: Array<{ value: BusinessSection; label: string; icon: typeof Target }> = [
  { value: "recomendados", label: "Recomendados para você", icon: Sparkles },
  { value: "indicadores", label: "Seus indicadores", icon: BarChart3 },
  { value: "andamento", label: "Em andamento", icon: ListChecks },
  { value: "minhas-oportunidades", label: "Minhas oportunidades", icon: Lightbulb },
];

const kindStyle: Record<FeedKind, { icon: typeof Target; badge: string; iconClass: string }> = {
  demanda: { icon: BriefcaseBusiness, badge: "border-blue-200 bg-blue-50 text-blue-700", iconClass: "bg-blue-50 text-blue-600" },
  oba: { icon: Target, badge: "border-cyan-200 bg-cyan-50 text-cyan-700", iconClass: "bg-cyan-50 text-cyan-600" },
  ro: { icon: CalendarDays, badge: "border-amber-200 bg-amber-50 text-amber-800", iconClass: "bg-amber-50 text-amber-700" },
  bia: { icon: Landmark, badge: "border-violet-200 bg-violet-50 text-violet-700", iconClass: "bg-violet-50 text-violet-600" },
};

function formatCurrency(values: BusinessFeedResponse["indicadores"]["valores_contratados"]) {
  if (!values?.length) return "R$ 0,00";
  return values.map(({ moeda, valor }) => {
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda || "BRL", maximumFractionDigits: 0 }).format(Number(valor || 0));
    } catch {
      return `${moeda || "BRL"} ${Number(valor || 0).toLocaleString("pt-BR")}`;
    }
  }).join(" + ");
}

function formatPercent(value?: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatDate(value?: string | null, hour?: string | null) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return hour ? `${formatted}, ${hour.slice(0, 5)}` : formatted;
}

function uniqueOptions(items: BusinessFeedItem[], field: "categoria" | "ramo_atuacao" | "nucleo_alianca") {
  return Array.from(new Set(items.map((item) => item[field]).filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Target; tone: string }) {
  return (
    <Card className="rounded-lg border-border/60 shadow-none">
      <CardContent className="flex min-h-[94px] items-center gap-3 p-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-bold tabular-nums text-foreground" title={String(value)}>{value}</p></div>
      </CardContent>
    </Card>
  );
}

function FeedRows({ items, emptyMessage, onOpen }: { items: BusinessFeedItem[]; emptyMessage: string; onOpen: (url: string) => void }) {
  if (items.length === 0) {
    return <div className="border-y py-10 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="divide-y border-y">
      {items.map((item) => {
        const visual = kindStyle[item.tipo];
        const Icon = visual.icon;
        const date = formatDate(item.data, item.hora);
        return (
          <button key={item.id} type="button" onClick={() => onOpen(item.url)} className="grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-1 py-4 text-left transition-colors hover:bg-muted/30 sm:px-3">
            <div className={`grid h-10 w-10 place-items-center rounded-lg ${visual.iconClass}`}><Icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={visual.badge}>{item.selo}</Badge>
                {item.codigo && <span className="font-mono text-[10px] text-muted-foreground">{item.codigo}</span>}
                {item.contexto === "recomendado" && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{item.aderencia}% aderente</span>}
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{item.titulo}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.motivos?.join(" · ") || item.resumo}</p>
              {(item.localizacao || date) && <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">{item.localizacao && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.localizacao}</span>}{date && <span>{date}</span>}</p>}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: typeof Target; title: string; description: string }) {
  return (
    <div>
      <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-blue-600" /><h2 className="text-lg font-bold text-foreground">{title}</h2></div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function MemberBusinessFeed({ initialSection = "recomendados", onSectionChange, convergenceStats }: MemberBusinessFeedProps) {
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<BusinessSection>(initialSection);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("__all__");
  const [category, setCategory] = useState("__all__");
  const [branch, setBranch] = useState("__all__");
  const [nucleus, setNucleus] = useState("__all__");
  const query = useQuery<BusinessFeedResponse>({
    queryKey: ["/api/me/negocios"],
    queryFn: async () => {
      const response = await fetch("/api/me/negocios", { credentials: "include", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar seus negócios.");
      return payload;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const networkRecommendations = useMemo(
    () => (query.data?.feed || []).filter((item) => item.contexto === "recomendado" && (item.tipo === "demanda" || item.tipo === "oba")),
    [query.data?.feed],
  );
  const ongoingItems = useMemo(
    () => (query.data?.feed || []).filter((item) => item.contexto === "em_andamento" || item.contexto === "agenda" || item.contexto === "convite"),
    [query.data?.feed],
  );
  const filteredRecommendations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return networkRecommendations.filter((item) => {
      const haystack = [item.titulo, item.resumo, item.localizacao, item.categoria, item.ramo_atuacao, item.nucleo_alianca].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return (!normalizedSearch || haystack.includes(normalizedSearch))
        && (kind === "__all__" || item.tipo === kind)
        && (category === "__all__" || item.categoria === category)
        && (branch === "__all__" || item.ramo_atuacao === branch)
        && (nucleus === "__all__" || item.nucleo_alianca === nucleus);
    });
  }, [branch, category, kind, networkRecommendations, nucleus, search]);

  const metrics = query.data?.indicadores;
  const categories = useMemo(() => uniqueOptions(networkRecommendations, "categoria"), [networkRecommendations]);
  const branches = useMemo(() => uniqueOptions(networkRecommendations, "ramo_atuacao"), [networkRecommendations]);
  const nuclei = useMemo(() => uniqueOptions(networkRecommendations, "nucleo_alianca"), [networkRecommendations]);

  function selectSection(section: BusinessSection) {
    setActiveSection(section);
    onSectionChange?.(section);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2"><BriefcaseBusiness className="h-6 w-6 text-cyan-600" /><h1 className="text-2xl font-bold text-foreground">Negócios para você</h1></div>
        <p className="mt-1 text-sm text-muted-foreground">Oportunidades recomendadas, indicadores e negociações em um único lugar.</p>
      </div>

      <nav aria-label="Seções de negócios" className="-mx-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-1 rounded-md bg-muted/40 p-1">
          {sectionOptions.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" role="tab" aria-selected={activeSection === value} onClick={() => selectSection(value)} className={`flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors ${activeSection === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
      </nav>

      {activeSection === "recomendados" && <section role="tabpanel" className="space-y-4">
        <SectionHeader icon={Sparkles} title="Recomendados para você" description="Demandas e OBAs da rede ordenadas pela aderência ao seu perfil." />
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." className="pl-9" />
          </div>
          <Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">Demandas e OBAs</SelectItem><SelectItem value="demanda">Demandas</SelectItem><SelectItem value="oba">OBAs</SelectItem></SelectContent></Select>
          <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="__all__">Todos os tipos</SelectItem>{categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={branch} onValueChange={setBranch}><SelectTrigger><SelectValue placeholder="Ramo" /></SelectTrigger><SelectContent><SelectItem value="__all__">Todos os ramos</SelectItem>{branches.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={nucleus} onValueChange={setNucleus}><SelectTrigger><SelectValue placeholder="Núcleo" /></SelectTrigger><SelectContent><SelectItem value="__all__">Todos os núcleos</SelectItem>{nuclei.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
        </div>
        {query.isLoading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)}</div> : query.isError ? <div className="border-y py-8 text-center text-sm text-red-600">{(query.error as Error).message}</div> : <FeedRows items={filteredRecommendations} emptyMessage="Nenhuma recomendação encontrada com esses filtros." onOpen={navigate} />}
      </section>}

      {activeSection === "indicadores" && <section role="tabpanel" className="space-y-4">
        <SectionHeader icon={BarChart3} title="Seus indicadores" description="Convergência, interesses e resultados das suas negociações." />
        {query.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)}</div>
        ) : query.isError ? (
          <div className="border-y py-8 text-center text-sm text-red-600">Não foi possível carregar seus indicadores.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Metric label="Índice de convergência" value={formatPercent(convergenceStats?.indice_convergencia)} icon={Target} tone="bg-blue-50 text-blue-600" />
            <Metric label="Interesses manifestados" value={convergenceStats?.interesses_manifestados || 0} icon={Lightbulb} tone="bg-cyan-50 text-cyan-600" />
            <Metric label="Propostas apresentadas" value={metrics?.propostas_apresentadas || 0} icon={FileCheck2} tone="bg-amber-50 text-amber-700" />
            <Metric label="Negócios fechados" value={metrics?.negocios_fechados || 0} icon={Handshake} tone="bg-emerald-50 text-emerald-600" />
            <Metric label="Valor contratado" value={formatCurrency(metrics?.valores_contratados || [])} icon={CircleDollarSign} tone="bg-emerald-50 text-emerald-600" />
            <Metric label="OBAs conquistadas" value={metrics?.obas_conquistadas || 0} icon={Target} tone="bg-violet-50 text-violet-600" />
          </div>
        )}
        <div className="grid gap-3 border-y py-4 sm:grid-cols-3">
          {[
            { label: "Recomendados", value: metrics?.recomendados ?? networkRecommendations.length, tone: "bg-blue-600" },
            { label: "Em andamento", value: metrics?.em_andamento ?? ongoingItems.filter((item) => item.contexto === "em_andamento").length, tone: "bg-amber-500" },
            { label: "Fechados", value: metrics?.negocios_fechados || 0, tone: "bg-emerald-600" },
          ].map((item) => {
            const maximum = Math.max(metrics?.recomendados || networkRecommendations.length, metrics?.em_andamento || ongoingItems.length, metrics?.negocios_fechados || 0, 1);
            return <div key={item.label} className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">{item.label}</span><strong>{item.value}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${item.tone}`} style={{ width: `${Math.max(item.value ? 8 : 0, (item.value / maximum) * 100)}%` }} /></div></div>;
          })}
        </div>
      </section>}

      {activeSection === "andamento" && <section role="tabpanel" className="space-y-4">
        <SectionHeader icon={ListChecks} title="Em andamento" description="Interesses, convites, reuniões, propostas e negócios que já exigem acompanhamento." />
        {query.isLoading ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)}</div> : query.isError ? <div className="border-y py-8 text-center text-sm text-red-600">{(query.error as Error).message}</div> : <FeedRows items={ongoingItems} emptyMessage="Nenhuma negociação em andamento no momento." onOpen={navigate} />}
      </section>}

      {activeSection === "minhas-oportunidades" && <section role="tabpanel" className="space-y-4">
        <SectionHeader icon={Lightbulb} title="Minhas oportunidades" description="Imóveis e negócios externos cadastrados por você, separados das recomendações da rede." />
        <OportunidadesImobiliariasPanel embedded hideHeader />
      </section>}
    </div>
  );
}
