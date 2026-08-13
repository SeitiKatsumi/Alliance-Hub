import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  Handshake,
  Landmark,
  MapPin,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FeedKind = "todos" | "demanda" | "oba" | "ro" | "bia";

interface BusinessFeedItem {
  id: string;
  tipo: Exclude<FeedKind, "todos">;
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
  url: string;
}

interface BusinessFeedResponse {
  feed: BusinessFeedItem[];
  indicadores: {
    negocios_recebidos: number;
    propostas_apresentadas: number;
    negocios_fechados: number;
    valores_contratados: Array<{ moeda: string; valor: number | string }>;
    bias_participadas: number;
    obas_conquistadas: number;
  };
}

const kindStyle: Record<Exclude<FeedKind, "todos">, { icon: typeof Target; badge: string; iconClass: string }> = {
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

function formatDate(value?: string | null, hour?: string | null) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return hour ? `${formatted}, ${hour.slice(0, 5)}` : formatted;
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

export default function MemberBusinessFeed() {
  const [, navigate] = useLocation();
  const [kind, setKind] = useState<FeedKind>("todos");
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
  const feed = useMemo(
    () => (query.data?.feed || []).filter((item) => kind === "todos" || item.tipo === kind),
    [kind, query.data?.feed],
  );
  const metrics = query.data?.indicadores;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" /><h2 className="text-xl font-bold text-foreground">Negócios para você</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Prioridades recomendadas para o seu perfil.</p>
      </div>

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Negócios recebidos" value={metrics?.negocios_recebidos || 0} icon={BriefcaseBusiness} tone="bg-blue-50 text-blue-600" />
          <Metric label="Propostas apresentadas" value={metrics?.propostas_apresentadas || 0} icon={FileCheck2} tone="bg-amber-50 text-amber-700" />
          <Metric label="Negócios fechados" value={metrics?.negocios_fechados || 0} icon={Handshake} tone="bg-emerald-50 text-emerald-600" />
          <Metric label="Valor contratado" value={formatCurrency(metrics?.valores_contratados || [])} icon={CircleDollarSign} tone="bg-emerald-50 text-emerald-600" />
          <Metric label="BIAs participadas" value={metrics?.bias_participadas || 0} icon={Landmark} tone="bg-violet-50 text-violet-600" />
          <Metric label="OBAs conquistadas" value={metrics?.obas_conquistadas || 0} icon={Target} tone="bg-cyan-50 text-cyan-600" />
        </div>
      )}

      <section className="space-y-3">
        <Tabs value={kind} onValueChange={(value) => setKind(value as FeedKind)}>
          <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-muted/40 p-1">
            <TabsTrigger value="todos" className="shrink-0">Todos</TabsTrigger>
            <TabsTrigger value="demanda" className="shrink-0">Demandas</TabsTrigger>
            <TabsTrigger value="oba" className="shrink-0">OBAs</TabsTrigger>
            <TabsTrigger value="ro" className="shrink-0">ROs</TabsTrigger>
            <TabsTrigger value="bia" className="shrink-0">BIAs</TabsTrigger>
          </TabsList>
        </Tabs>

        {query.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)}</div>
        ) : query.isError ? (
          <div className="border-y py-8 text-center text-sm text-red-600">{(query.error as Error).message}</div>
        ) : feed.length === 0 ? (
          <div className="border-y py-10 text-center text-sm text-muted-foreground">Nenhum negócio encontrado neste filtro.</div>
        ) : (
          <div className="divide-y border-y">
            {feed.map((item) => {
              const visual = kindStyle[item.tipo];
              const Icon = visual.icon;
              const date = formatDate(item.data, item.hora);
              return (
                <button key={item.id} type="button" onClick={() => navigate(item.url)} className="grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-1 py-4 text-left transition-colors hover:bg-muted/30 sm:px-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-lg ${visual.iconClass}`}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={visual.badge}>{item.selo}</Badge>{item.codigo && <span className="font-mono text-[10px] text-muted-foreground">{item.codigo}</span>}<span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{item.aderencia}% aderente</span></div>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{item.titulo}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.motivos?.join(" · ") || item.resumo}</p>
                    {(item.localizacao || date) && <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">{item.localizacao && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.localizacao}</span>}{date && <span>{date}</span>}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
