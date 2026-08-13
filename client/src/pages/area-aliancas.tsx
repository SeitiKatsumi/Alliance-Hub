import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuraBadge } from "@/components/aura-score";
import { RedeBadgeButton } from "@/components/rede-badge-viewer";
import { MapWheelGuard } from "@/components/map-wheel-guard";
import { BiaStructuringQueue } from "@/components/bia-structuring-queue";
import ComunidadePage from "@/pages/comunidade";
import AreMembroPage from "@/pages/area-membros";
import BiasPage from "@/pages/bias";
import NetworkOpportunitiesHub from "@/pages/network-opportunities";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import {
  Briefcase,
  Building2,
  FileText,
  Globe2,
  Handshake,
  Home,
  Loader2,
  MapPin,
  Network,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Ruler,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  Wallet,
  X,
  Info,
} from "lucide-react";
import { getMembroUrl } from "@/lib/public-refs";
import { landBankPhotoUrl } from "@/lib/land-bank-assets";
import type { MarketM2Analysis } from "@/lib/market-analysis";
import { useToast } from "@/hooks/use-toast";

const WORLD_GEO = "/world-countries-50m.json";

interface AliadoRede {
  id: string;
  nome?: string;
  cargo?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  estado?: string | null;
  email?: string | null;
  foto?: string | null;
  foto_perfil?: string | null;
  perfil_aliado?: string | null;
  tipo_alianca?: string | null;
  nucleo_alianca?: string | null;
  Outras_redes_as_quais_pertenco?: string[] | null;
}

function fotoUrl(m: AliadoRede): string | null {
  const f = m.foto || m.foto_perfil;
  if (!f) return null;
  return `/api/assets/${f}?width=160&height=160&fit=cover`;
}

function initials(nome?: string): string {
  if (!nome) return "?";
  return nome
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isAliado(m: AliadoRede): boolean {
  const redes = Array.isArray(m.Outras_redes_as_quais_pertenco) ? m.Outras_redes_as_quais_pertenco : [];
  return redes.includes("BUILT_ALLIANCE_PARTNER");
}

function AliadosTab() {
  const [search, setSearch] = useState("");
  const { data: membros = [], isLoading } = useQuery<AliadoRede[]>({
    queryKey: ["/api/membros", "aliados-rede"],
    queryFn: async () => {
      const r = await fetch("/api/membros");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const aliados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return membros
      .filter(isAliado)
      .filter((m) => {
        if (!q) return true;
        return [m.nome, m.empresa, m.cargo, m.cidade, m.estado]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }));
  }, [membros, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Aliados Licenciados</h2>
        </div>
        <Badge variant="outline" className="w-fit border-brand-gold/30 text-brand-gold">
          {aliados.length} aliado{aliados.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar aliado..."
          className="pl-9"
          data-testid="input-buscar-aliados"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : aliados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum aliado encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {aliados.map((aliado) => {
            const foto = fotoUrl(aliado);
            const redes = Array.isArray(aliado.Outras_redes_as_quais_pertenco)
              ? aliado.Outras_redes_as_quais_pertenco
              : [];
            return (
              <Link key={aliado.id} href={getMembroUrl(aliado)}>
                <Card className="h-full cursor-pointer border-border/70 transition-colors hover:border-brand-gold/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {foto ? (
                        <img src={foto} alt={aliado.nome || "Aliado"} className="h-14 w-14 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-gold/15 text-sm font-bold text-brand-gold">
                          {initials(aliado.nome)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">{aliado.nome || "Aliado BUILT"}</p>
                        <p className="truncate text-sm text-muted-foreground">{aliado.empresa || aliado.cargo || "Rede BUILT"}</p>
                        {(aliado.cidade || aliado.estado) && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {[aliado.cidade, aliado.estado].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {redes.includes("BUILT_ALLIANCE_PARTNER") && (
                        <RedeBadgeButton rede="BUILT_ALLIANCE_PARTNER" height={24} maxWidth={74} />
                      )}
                      {redes.includes("BUILT_FOUNDING_MEMBER") && (
                        <RedeBadgeButton rede="BUILT_FOUNDING_MEMBER" height={24} maxWidth={74} />
                      )}
                      <AuraBadge membroId={aliado.id} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const landBankCategories = [
  {
    value: "land-bank",
    title: "Land Bank",
    shortDescription: "Para ativos cuja oportunidade está essencialmente no solo, na área disponível ou no potencial construtivo.",
    description: "Inclui terrenos, lotes, glebas e áreas urbanas ou rurais que podem ser desenvolvidas, loteadas, incorporadas, vendidas de forma estruturada ou transformadas em novos empreendimentos.",
    examples: [
      "Tenho um lote onde podemos construir.",
      "Tenho uma área que podemos lotear.",
      "Tenho uma gleba com potencial para desenvolvimento.",
      "Tenho um terreno parado e quero descobrir a melhor vocação.",
    ],
    accent: "text-emerald-500",
    bg: "bg-emerald-50",
    icon: MapPin,
  },
  {
    value: "built-asset-bank",
    title: "Ativos Edificados",
    shortDescription: "Para ativos que já possuem construção existente, mas estão sem uso, subutilizados, inacabados, abandonados ou aguardando reposicionamento.",
    description: "Inclui galpões, prédios, casas, salas, lojas, apartamentos, estruturas inacabadas e imóveis construídos que podem ser reformados, convertidos, regularizados, vendidos, alugados ou transformados em novos produtos imobiliários.",
    examples: [
      "Tenho um galpão abandonado.",
      "Tenho um prédio inacabado.",
      "Tenho uma casa antiga que pode ser reformada.",
      "Tenho um imóvel construído, mas sem uso ou sem estratégia.",
    ],
    accent: "text-blue-500",
    bg: "bg-blue-50",
    icon: Briefcase,
  },
] as const;

type LandBankCategory = (typeof landBankCategories)[number];

interface LandBankBasicInfoAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface LandBankAsset {
  id: string;
  category: LandBankCategory["value"];
  bia_id?: string;
  bia_nome?: string;
  basicInfoAttachment?: LandBankBasicInfoAttachment;
  qualificacao: string;
  area: string;
  valor: string;
  moeda: string;
  descricao: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  pais: string;
  numero: string;
  complemento: string;
  numero_matricula: string;
  livro: string;
  folha: string;
  cartorio: string;
  comarca: string;
  foto?: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  can_edit?: boolean;
  can_delete?: boolean;
  origem_tipo: "ativo_proprio" | "terceiro_autorizado" | "oportunidade_externa" | "origem_nao_informada";
  visibilidade: "privada" | "publicada" | "pausada";
  autorizacao_compartilhamento: boolean;
}

type LandBankForm = Omit<LandBankAsset, "id" | "category" | "createdAt" | "can_edit" | "can_delete">;

const landBankStorageKey = "built-land-bank-assets-v2";

const ufApproxCoords: Record<string, [number, number]> = {
  AC: [-70.55, -9.98],
  AL: [-35.74, -9.66],
  AP: [-51.05, 0.03],
  AM: [-60.02, -3.1],
  BA: [-38.5, -12.97],
  CE: [-38.54, -3.73],
  DF: [-47.88, -15.79],
  ES: [-40.34, -20.32],
  GO: [-49.25, -16.68],
  MA: [-44.3, -2.53],
  MT: [-56.1, -15.6],
  MS: [-54.62, -20.45],
  MG: [-43.94, -19.92],
  PA: [-48.5, -1.45],
  PB: [-34.86, -7.12],
  PR: [-49.27, -25.43],
  PE: [-34.88, -8.05],
  PI: [-42.8, -5.09],
  RJ: [-43.17, -22.91],
  RN: [-35.21, -5.79],
  RS: [-51.23, -30.03],
  RO: [-63.9, -8.76],
  RR: [-60.67, 2.82],
  SC: [-48.55, -27.59],
  SP: [-46.63, -23.55],
  SE: [-37.07, -10.91],
  TO: [-48.33, -10.18],
};

const emptyLandBankForm: LandBankForm = {
  bia_id: "",
  bia_nome: "",
  qualificacao: "",
  area: "",
  valor: "",
  moeda: "BRL",
  descricao: "",
  cep: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  pais: "Brasil",
  numero: "",
  complemento: "",
  numero_matricula: "",
  livro: "",
  folha: "",
  cartorio: "",
  comarca: "",
  foto: "",
  origem_tipo: "terceiro_autorizado",
  visibilidade: "publicada",
  autorizacao_compartilhamento: false,
};

function estimateLandBankCoords(form: LandBankForm): { latitude: number | null; longitude: number | null } {
  const uf = form.estado.trim().toUpperCase();
  const coords = ufApproxCoords[uf];
  if (!coords) return { latitude: null, longitude: null };
  return { longitude: coords[0], latitude: coords[1] };
}

function formatLandBankCurrency(value?: string | null, currency = "BRL"): string | null {
  if (!value) return null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return `${currency} ${value}`;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(numericValue);
  } catch {
    return `${currency} ${value}`;
  }
}

function formatLandBankFileSize(size?: number): string {
  if (!size || size <= 0) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function LandBankMapHeader({ category, assets }: { category: LandBankCategory; assets: LandBankAsset[] }) {
  const Icon = category.icon;
  const [zoom, setZoom] = useState(1.25);
  const [center, setCenter] = useState<[number, number]>([-20, 10]);

  const withCoords = useMemo(
    () => assets.filter((asset) => asset.latitude != null && asset.longitude != null),
    [assets]
  );

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-cyan-400/20"
      style={{ height: 320, background: "radial-gradient(ellipse at 50% 110%, #001428 0%, #000c1f 55%, #000408 100%)" }}
      data-testid={`mapa-${category.value}`}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(34,211,238,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.05) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />
      <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-cyan-400/40 rounded-tl-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-cyan-400/40 rounded-tr-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-cyan-400/40 rounded-bl-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-cyan-400/40 rounded-br-2xl pointer-events-none" />

      <div className="absolute top-5 left-6 z-20">
        <p className="text-[10px] text-cyan-300/60 tracking-[0.35em] uppercase font-mono">// BUILT Banco de Ativos</p>
        <h2 className="text-xl font-bold tracking-[0.12em] font-mono mt-0.5 text-cyan-300">
          MAPA DE {category.title.toUpperCase()}
        </h2>
        <div className="mt-2 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
          </span>
          <span className="text-[10px] text-cyan-300/65 font-mono tracking-[0.2em] uppercase">
            {withCoords.length} geolocalizados
          </span>
        </div>
      </div>

      <div className="absolute top-5 right-6 z-20 text-right font-mono">
        <p className="text-[9px] text-cyan-300/50 tracking-widest uppercase">Ativos</p>
        <p className="text-4xl font-bold leading-none text-cyan-300">{assets.length}</p>
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1">
        {[
          { label: "+", action: () => setZoom((z) => Math.min(z * 1.5, 16)), title: "Ampliar" },
          { label: "⊙", action: () => { setZoom(1.25); setCenter([-20, 10]); }, title: "Resetar" },
          { label: "−", action: () => setZoom((z) => Math.max(z / 1.5, 0.8)), title: "Reduzir" },
        ].map(({ label, action, title }) => (
          <button
            key={label}
            onClick={action}
            title={title}
            className="w-7 h-7 flex items-center justify-center rounded border font-mono text-sm font-bold transition-colors"
            style={{ background: "rgba(0,20,40,0.85)", border: "1px solid rgba(34,211,238,0.35)", color: "#67E8F9" }}
          >
            {label}
          </button>
        ))}
      </div>

      {withCoords.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-end justify-center pb-14 pointer-events-none">
          <div className="text-center">
            <p className="text-[10px] text-cyan-300/35 font-mono tracking-widest uppercase">Nenhum ativo geolocalizado</p>
            <p className="mt-0.5 text-[9px] text-cyan-300/25 font-mono">Cadastre um ativo com UF para aparecer no mapa</p>
          </div>
        </div>
      )}

      <MapWheelGuard>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [0, 10], scale: 160 }}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup
            zoom={zoom}
            center={center}
            minZoom={0.8}
            maxZoom={16}
            onMoveEnd={({ coordinates, zoom: nextZoom }) => {
              setCenter(coordinates);
              setZoom(nextZoom);
            }}
          >
            <Geographies geography={WORLD_GEO}>
              {({ geographies }) => geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: { fill: "#011630", stroke: "#22D3EE28", strokeWidth: 0.3, outline: "none" },
                    hover: { fill: "#011a3c", stroke: "#22D3EE40", strokeWidth: 0.3, outline: "none" },
                    pressed: { fill: "#011630", outline: "none" },
                  }}
                />
              ))}
            </Geographies>

            {withCoords.map((asset) => {
              const r = Math.max(2, 5 / zoom);
              return (
                <Marker key={asset.id} coordinates={[asset.longitude!, asset.latitude!]}>
                  <g style={{ cursor: "pointer" }}>
                    <circle r={r * 4} fill="#22D3EE" fillOpacity={0.08}>
                      <animate attributeName="r" from={r * 2.5} to={r * 5} dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="fill-opacity" from="0.35" to="0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                    <circle r={r * 2} fill="#22D3EE" fillOpacity={0.22} />
                    <circle r={r} fill="#67E8F9" fillOpacity={0.95} />
                  </g>
                  <title>{asset.qualificacao}</title>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
      </MapWheelGuard>

      <div className="absolute bottom-5 left-6 z-20 flex items-center gap-2 text-[10px] font-mono text-cyan-300/45">
        <Icon className="h-3.5 w-3.5" />
        {category.shortDescription}
      </div>
    </div>
  );
}

function LandBankPanel({
  category,
  assets,
  onCreate,
  onDelete,
}: {
  category: LandBankCategory;
  assets: LandBankAsset[];
  onCreate: (category: LandBankCategory["value"]) => void;
  onDelete: (asset: LandBankAsset) => void;
}) {
  const [, navigate] = useLocation();
  const Icon = category.icon;
  const [search, setSearch] = useState("");
  const [examplesOpen, setExamplesOpen] = useState(false);
  const q = search.trim().toLowerCase();
  const filteredAssets = assets.filter((asset) => {
    if (!q) return true;
    return [
      asset.qualificacao,
      asset.descricao,
      asset.endereco,
      asset.bairro,
      asset.cidade,
      asset.estado,
      asset.pais,
      asset.cep,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold leading-tight text-foreground">{category.title}</h2>
          <div className="mt-1 flex max-w-3xl items-start gap-2">
            <p className="text-sm leading-relaxed text-muted-foreground">{category.description}</p>
            <div
              className="relative shrink-0"
              onMouseEnter={() => setExamplesOpen(true)}
              onMouseLeave={() => setExamplesOpen(false)}
              onFocus={() => setExamplesOpen(true)}
            >
              <button
                type="button"
                className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={`Ver exemplos de ${category.title}`}
                onClick={() => setExamplesOpen((open) => !open)}
                data-testid={`btn-info-${category.value}`}
              >
                <Info className="h-4 w-4" />
              </button>
              {examplesOpen && (
                <div className="absolute left-0 top-7 z-50 w-80 rounded-md border bg-popover p-4 text-popover-foreground shadow-md" data-testid={`examples-${category.value}`}>
                  <p className="text-sm font-semibold text-foreground">Exemplos</p>
                  <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {category.examples.map((example) => (
                      <p key={example}>{example}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <Button
            onClick={() => onCreate(category.value)}
            className="gap-2 whitespace-nowrap bg-blue-500 text-white hover:bg-blue-600"
            data-testid={`btn-criar-${category.value}`}
          >
            <Plus className="h-4 w-4" />
            Criar novo
          </Button>
        </div>
      </div>

      <LandBankMapHeader category={category} assets={assets} />

      <div className="grid gap-3">
        <div className="relative flex min-h-10 items-center">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar em ${category.title}...`}
            className="h-10 pl-9"
            data-testid={`input-buscar-${category.value}`}
          />
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 py-14 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full ${category.bg}`}>
              <Icon className={`h-7 w-7 ${category.accent}`} />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Nenhum ativo cadastrado em {category.title}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset) => (
            <Card
              key={asset.id}
              className="relative cursor-pointer overflow-hidden border-border/80 transition-colors hover:border-brand-gold/50"
              onClick={() => navigate(`/land-bank/${asset.id}`)}
              data-testid={`card-landbank-${asset.id}`}
            >
              {asset.can_delete && (
                <div className="absolute right-3 top-3 z-10">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50 hover:text-red-700"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(asset);
                    }}
                    aria-label={`Excluir ${asset.qualificacao}`}
                    title="Excluir ativo"
                    data-testid={`btn-excluir-landbank-${asset.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className={`flex h-32 items-center justify-center overflow-hidden ${category.bg}`}>
                {asset.foto ? (
                  <img src={landBankPhotoUrl(asset.foto) || ""} alt={asset.qualificacao} className="h-full w-full object-cover" />
                ) : (
                  <Icon className={`h-10 w-10 ${category.accent}`} />
                )}
              </div>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-500 text-white hover:bg-blue-500">
                    {category.title}
                  </Badge>
                  {asset.bia_nome && (
                    <Badge variant="outline" className="max-w-full border-orange-200 bg-orange-50 text-orange-700">
                      <span className="truncate">BIA: {asset.bia_nome}</span>
                    </Badge>
                  )}
                  {asset.category === "land-bank" && asset.basicInfoAttachment && (
                    <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                      <Paperclip className="h-3 w-3" />
                      Informações básicas
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    ativo
                  </Badge>
                </div>
                <div>
                  <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground">
                    {asset.qualificacao}
                  </h3>
                  {asset.descricao && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{asset.descricao}</p>
                  )}
                </div>
                <div className="border-t border-border pt-3">
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {[asset.cidade, asset.estado, asset.pais].filter(Boolean).join(", ")}
                  </p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Área</p>
                      <p className="flex items-center gap-1 text-base font-bold text-foreground">
                        <Ruler className="h-4 w-4 text-muted-foreground" />
                        {asset.area} m²
                      </p>
                    </div>
                    <div className="max-w-[48%] text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor</p>
                      <p className="truncate text-sm font-bold text-foreground">{formatLandBankCurrency(asset.valor, asset.moeda) || "-"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface InventarioImovel {
  id: string;
  nome: string;
  tipo: string;
  area_m2: string | number;
  valor_pago: string | number;
  valor_atual: string | number;
  moeda: string;
  descricao?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  matricula?: string;
  cartorio?: string;
  foto?: string;
  status?: string;
  createdAt?: string;
}

interface InventarioLancamento {
  id: string;
  imovel_id: string;
  tipo: "receita" | "despesa";
  categoria: string;
  valor: number;
  data: string;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  status?: string;
  descricao: string;
  origem?: string;
  observacao?: string | null;
}

function parseInventoryNumber(value?: string | number | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInventoryMoney(value: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  }
}

const emptyInventarioImovel: Omit<InventarioImovel, "id"> = {
  nome: "",
  tipo: "",
  area_m2: "",
  valor_pago: "",
  valor_atual: "",
  moeda: "BRL",
  descricao: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  pais: "Brasil",
  matricula: "",
  cartorio: "",
  foto: "",
  status: "ativo",
};

const emptyInventarioLancamento = (imovelId = ""): Omit<InventarioLancamento, "id"> => ({
  imovel_id: imovelId,
  tipo: "despesa",
  categoria: "Manutenção",
  valor: 0,
  data: new Date().toISOString().slice(0, 10),
  data_vencimento: null,
  data_pagamento: null,
  status: "pago",
  descricao: "",
  origem: "manual",
  observacao: "",
});

function InventoryMetric({ label, value, sub, icon: Icon, tone = "text-slate-700" }: { label: string; value: string; sub?: string; icon: any; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <Icon className={`h-5 w-5 ${tone}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export function InventarioPanel({ onPublishToLandBank }: { onPublishToLandBank?: (imovel: InventarioImovel) => void }) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState("");
  const [imovelDialogOpen, setImovelDialogOpen] = useState(false);
  const [editingImovelId, setEditingImovelId] = useState<string | null>(null);
  const [deletingImovel, setDeletingImovel] = useState<InventarioImovel | null>(null);
  const [lancamentoDialogOpen, setLancamentoDialogOpen] = useState(false);
  const [imovelForm, setImovelForm] = useState<Omit<InventarioImovel, "id">>(emptyInventarioImovel);
  const [inventarioCepLoading, setInventarioCepLoading] = useState(false);
  const [inventarioCepError, setInventarioCepError] = useState("");
  const [lancamentoForm, setLancamentoForm] = useState<Omit<InventarioLancamento, "id">>(emptyInventarioLancamento());
  const [previewLancamentos, setPreviewLancamentos] = useState<Array<Omit<InventarioLancamento, "id" | "imovel_id">>>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: imoveis = [], isLoading: loadingImoveis } = useQuery<InventarioImovel[]>({
    queryKey: ["/api/inventario/imoveis"],
  });

  const { data: lancamentos = [], isLoading: loadingLancamentos } = useQuery<InventarioLancamento[]>({
    queryKey: ["/api/inventario/lancamentos"],
  });

  const selectedImovel = imoveis.find((item) => item.id === selectedId) || imoveis[0] || null;

  useEffect(() => {
    if (!selectedId && imoveis[0]?.id) setSelectedId(imoveis[0].id);
  }, [imoveis, selectedId]);

  const selectedLancamentos = lancamentos.filter((item) => item.imovel_id === selectedImovel?.id);
  const patrimonioPago = imoveis.reduce((sum, item) => sum + parseInventoryNumber(item.valor_pago), 0);
  const patrimonioAtual = imoveis.reduce((sum, item) => sum + parseInventoryNumber(item.valor_atual), 0);
  const receitas = lancamentos.filter((item) => item.tipo === "receita").reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const despesas = lancamentos.filter((item) => item.tipo === "despesa").reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const valorizacao = patrimonioAtual - patrimonioPago;
  const moeda = selectedImovel?.moeda || "BRL";
  const selectedAreaM2 = parseInventoryNumber(selectedImovel?.area_m2);
  const selectedValorAtual = parseInventoryNumber(selectedImovel?.valor_atual);

  const { data: precoM2Analysis, isLoading: loadingPrecoM2 } = useQuery<MarketM2Analysis>({
    queryKey: [
      "/api/ai/preco-m2",
      "inventario",
      selectedImovel?.id,
      selectedImovel?.area_m2,
      selectedImovel?.valor_atual,
      selectedImovel?.tipo,
      selectedImovel?.endereco,
      selectedImovel?.bairro,
      selectedImovel?.cidade,
      selectedImovel?.estado,
      selectedImovel?.pais,
    ],
    enabled: Boolean(selectedImovel?.id && selectedAreaM2 > 0 && selectedValorAtual > 0),
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/ai/preco-m2", {
        origem: "inventario",
        nome: selectedImovel?.nome,
        tipo: selectedImovel?.tipo,
        valor: selectedValorAtual,
        area_m2: selectedAreaM2,
        moeda,
        cep: selectedImovel?.cep,
        endereco: selectedImovel?.endereco,
        bairro: selectedImovel?.bairro,
        cidade: selectedImovel?.cidade,
        estado: selectedImovel?.estado,
        pais: selectedImovel?.pais,
      });
      return response.json();
    },
  });

  const saveImovelMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string | null; payload: Omit<InventarioImovel, "id"> }) => {
      const response = await apiRequest(id ? "PATCH" : "POST", id ? `/api/inventario/imoveis/${id}` : "/api/inventario/imoveis", payload);
      return response.json() as Promise<InventarioImovel>;
    },
    onSuccess: (saved, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventario/imoveis"] });
      setSelectedId(saved.id);
      setImovelDialogOpen(false);
      setEditingImovelId(null);
      setImovelForm(emptyInventarioImovel);
      setInventarioCepError("");
      toast({ title: variables.id ? "Imóvel atualizado" : "Imóvel cadastrado" });
    },
    onError: (error: any) => {
      toast({ title: "Não foi possível salvar o imóvel", description: error?.message, variant: "destructive" });
    },
  });

  const deleteImovelMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/inventario/imoveis/${id}`),
    onSuccess: (_response, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventario/imoveis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventario/lancamentos"] });
      setSelectedId(imoveis.find((item) => item.id !== deletedId)?.id || "");
      setDeletingImovel(null);
      toast({ title: "Imóvel removido do inventário" });
    },
    onError: (error: any) => {
      toast({ title: "Não foi possível remover o imóvel", description: error?.message, variant: "destructive" });
    },
  });

  const createLancamentoMutation = useMutation({
    mutationFn: async (payload: Omit<InventarioLancamento, "id">) => {
      const response = await apiRequest("POST", "/api/inventario/lancamentos", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventario/lancamentos"] });
      setLancamentoDialogOpen(false);
      setLancamentoForm(emptyInventarioLancamento(selectedImovel?.id));
    },
  });

  const deleteLancamentoMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/inventario/lancamentos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/inventario/lancamentos"] }),
  });

  const importMutation = useMutation({
    mutationFn: async ({ file, audio }: { file: File; audio?: boolean }) => {
      const fd = new FormData();
      fd.append(audio ? "audio" : "file", file);
      const response = await fetch(audio ? "/api/inventario/transcrever-audio" : "/api/inventario/importar-anexos", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Falha na análise por IA");
      return data;
    },
    onSuccess: (data) => {
      setPreviewLancamentos(Array.isArray(data.lancamentos) ? data.lancamentos : []);
      setPreviewOpen(true);
    },
  });

  const savePreviewLancamentos = async () => {
    if (!selectedImovel || previewLancamentos.length === 0) return;
    await Promise.all(previewLancamentos.map((item) =>
      apiRequest("POST", "/api/inventario/lancamentos", { ...item, imovel_id: selectedImovel.id })
    ));
    queryClient.invalidateQueries({ queryKey: ["/api/inventario/lancamentos"] });
    setPreviewLancamentos([]);
    setPreviewOpen(false);
  };

  const handleImovelPhoto = async (file?: File) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("files", file);
    const response = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.fileIds?.[0]) {
      setImovelForm((current) => ({ ...current, foto: data.fileIds[0] }));
    }
  };

  const handleInventarioCepChange = async (rawCep: string) => {
    const digits = rawCep.replace(/\D/g, "").slice(0, 8);
    const formattedCep = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setImovelForm((current) => ({ ...current, cep: formattedCep }));
    setInventarioCepError("");
    if (digits.length !== 8) return;

    setInventarioCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.erro) {
        setInventarioCepError("CEP não encontrado.");
        return;
      }
      setImovelForm((current) => {
        if (String(current.cep || "").replace(/\D/g, "") !== digits) return current;
        return {
          ...current,
          cep: formattedCep,
          endereco: data.logradouro || current.endereco,
          complemento: data.complemento || current.complemento,
          bairro: data.bairro || current.bairro,
          cidade: data.localidade || current.cidade,
          estado: data.uf || current.estado,
          pais: "Brasil",
        };
      });
    } catch (error) {
      console.warn("[inventario] Nao foi possivel buscar o CEP", error);
      setInventarioCepError("Não foi possível consultar o CEP.");
    } finally {
      setInventarioCepLoading(false);
    }
  };

  const openCreateImovel = () => {
    setEditingImovelId(null);
    setImovelForm(emptyInventarioImovel);
    setInventarioCepError("");
    setImovelDialogOpen(true);
  };

  const openEditImovel = (imovel: InventarioImovel) => {
    const { id: _id, createdAt: _createdAt, ...editableFields } = imovel;
    setEditingImovelId(imovel.id);
    setImovelForm({ ...emptyInventarioImovel, ...editableFields });
    setInventarioCepError("");
    setImovelDialogOpen(true);
  };

  const closeImovelDialog = () => {
    setImovelDialogOpen(false);
    setEditingImovelId(null);
    setImovelForm(emptyInventarioImovel);
    setInventarioCepError("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Inventário</h2>
          <p className="text-sm text-muted-foreground">Gerencie imóveis próprios, receitas, despesas e leitura patrimonial por IA.</p>
        </div>
        <Button className="gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={openCreateImovel} data-testid="btn-novo-imovel-inventario">
          <Plus className="h-4 w-4" />
          Novo imóvel
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <InventoryMetric label="Patrimônio pago" value={formatInventoryMoney(patrimonioPago, moeda)} icon={Wallet} tone="text-blue-700" />
        <InventoryMetric label="Valor atual" value={formatInventoryMoney(patrimonioAtual, moeda)} icon={Home} tone="text-emerald-700" />
        <InventoryMetric label="Valorização" value={formatInventoryMoney(valorizacao, moeda)} icon={Sparkles} tone={valorizacao >= 0 ? "text-emerald-700" : "text-red-700"} />
        <InventoryMetric label="Receitas" value={formatInventoryMoney(receitas, moeda)} icon={Receipt} tone="text-green-700" />
        <InventoryMetric label="Despesas" value={formatInventoryMoney(despesas, moeda)} icon={Receipt} tone="text-red-700" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Imóveis</h3>
              <Badge variant="outline">{imoveis.length}</Badge>
            </div>
            {loadingImoveis ? (
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
            ) : imoveis.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Cadastre seu primeiro imóvel para iniciar o inventário.
              </div>
            ) : (
              <div className="space-y-2">
                {imoveis.map((imovel) => {
                  const active = selectedImovel?.id === imovel.id;
                  const foto = landBankPhotoUrl(imovel.foto || "");
                  return (
                    <button
                      key={imovel.id}
                      type="button"
                      onClick={() => setSelectedId(imovel.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${active ? "border-blue-300 bg-blue-50" : "border-border hover:border-blue-200"}`}
                    >
                      {foto ? (
                        <img src={foto} alt={imovel.nome} className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <Building2 className="h-5 w-5" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{imovel.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[imovel.cidade, imovel.estado].filter(Boolean).join(", ") || imovel.tipo}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">{formatInventoryMoney(parseInventoryNumber(imovel.valor_atual), imovel.moeda)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 p-5">
            {!selectedImovel ? (
              <div className="py-20 text-center text-muted-foreground">Selecione ou cadastre um imóvel.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedImovel.nome}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[selectedImovel.endereco, selectedImovel.numero, selectedImovel.bairro, selectedImovel.cidade, selectedImovel.estado].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => openEditImovel(selectedImovel)}
                      aria-label="Editar imóvel"
                      title="Editar imóvel"
                      data-testid="btn-editar-imovel-inventario"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setDeletingImovel(selectedImovel)}
                      aria-label="Remover imóvel"
                      title="Remover imóvel"
                      data-testid="btn-remover-imovel-inventario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {onPublishToLandBank && (
                      <Button variant="outline" className="gap-2" onClick={() => onPublishToLandBank(selectedImovel)}>
                        <Upload className="h-4 w-4" />
                        Publicar no Banco de Ativos
                      </Button>
                    )}
                    <Button className="gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={() => { setLancamentoForm(emptyInventarioLancamento(selectedImovel.id)); setLancamentoDialogOpen(true); }}>
                      <Plus className="h-4 w-4" />
                      Lançamento
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Valor pago</p>
                    <p className="font-bold">{formatInventoryMoney(parseInventoryNumber(selectedImovel.valor_pago), selectedImovel.moeda)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Valor atual</p>
                    <p className="font-bold text-emerald-700">{formatInventoryMoney(parseInventoryNumber(selectedImovel.valor_atual), selectedImovel.moeda)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">R$/m²</p>
                    <p className="font-bold text-blue-700">
                      {parseInventoryNumber(selectedImovel.area_m2) > 0
                        ? formatInventoryMoney(parseInventoryNumber(selectedImovel.valor_atual) / parseInventoryNumber(selectedImovel.area_m2), selectedImovel.moeda)
                      : "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-slate-900">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        IA de preço por m²
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Compara o valor atual com imóveis à venda do mesmo tipo, região e faixa de área.
                      </p>
                    </div>
                    {(loadingPrecoM2 || precoM2Analysis?.amostra_suficiente) && (
                      <Badge
                        variant="outline"
                        className={
                          precoM2Analysis?.classificacao === "abaixo"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : precoM2Analysis?.classificacao === "acima"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                        }
                      >
                        {loadingPrecoM2
                          ? "Analisando..."
                          : precoM2Analysis?.classificacao === "abaixo"
                            ? "Abaixo da média"
                            : precoM2Analysis?.classificacao === "acima"
                              ? "Acima da média"
                              : "Na média"}
                      </Badge>
                    )}
                  </div>
                  {selectedAreaM2 <= 0 || selectedValorAtual <= 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Informe área e valor atual estimado para a IA comparar o preço por m².
                    </p>
                  ) : loadingPrecoM2 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Pesquisando imóveis comparáveis...</p>
                  ) : precoM2Analysis?.amostra_suficiente === false ? (
                    <div className="mt-3 rounded-lg border border-dashed border-blue-200 bg-background p-3">
                      <p className="text-sm font-medium text-foreground">Ainda não há imóveis comparáveis suficientes.</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {precoM2Analysis.resumo || "A média será exibida quando forem encontrados pelo menos 3 anúncios válidos."}
                      </p>
                    </div>
                  ) : precoM2Analysis?.amostra_suficiente ? (
                    <>
                      <p className="mt-3 text-sm font-medium text-blue-800">
                        Baseado em {precoM2Analysis.quantidade_comparaveis} imóveis comparáveis entre {precoM2Analysis.area_min.toLocaleString("pt-BR")} e {precoM2Analysis.area_max.toLocaleString("pt-BR")} m².
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs text-muted-foreground">Informado</p>
                          <p className="font-bold text-blue-700">
                            {formatInventoryMoney(precoM2Analysis.preco_m2_informado || selectedValorAtual / selectedAreaM2, moeda)}/m²
                          </p>
                        </div>
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs text-muted-foreground">Referência média</p>
                          <p className="font-bold">
                            {precoM2Analysis.referencia_m2_media ? `${formatInventoryMoney(Number(precoM2Analysis.referencia_m2_media), moeda)}/m²` : "-"}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs text-muted-foreground">Faixa dos comparáveis</p>
                          <p className="font-bold">
                            {precoM2Analysis.referencia_m2_min && precoM2Analysis.referencia_m2_max
                              ? `${formatInventoryMoney(Number(precoM2Analysis.referencia_m2_min), moeda)} - ${formatInventoryMoney(Number(precoM2Analysis.referencia_m2_max), moeda)}`
                              : "-"}
                          </p>
                        </div>
                      </div>
                      {precoM2Analysis.resumo && (
                        <p className="mt-3 text-sm text-slate-700">{precoM2Analysis.resumo}</p>
                      )}
                      {!!precoM2Analysis.fontes?.length && (
                        <div className="mt-3 space-y-2 rounded-lg border bg-background p-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Imóveis comparáveis</p>
                          {precoM2Analysis.fontes.slice(0, 4).map((fonte, index) => (
                            <a
                              key={`${fonte.url}-${index}`}
                              href={fonte.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-md border p-2 text-xs hover:border-blue-200 hover:bg-blue-50"
                            >
                              <span className="block font-medium text-blue-700">{fonte.titulo || fonte.url}</span>
                              {fonte.trecho && <span className="mt-1 block text-muted-foreground">{fonte.trecho}</span>}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      A análise começa automaticamente quando há tipo, localização, área e valor.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-blue-900">IA para documentos, imagem ou voz</p>
                      <p className="text-sm text-blue-700/80">Envie IPTU, recibo, boleto, nota ou áudio; a IA gera uma prévia editável.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" disabled={importMutation.isPending} asChild>
                        <label className="cursor-pointer">
                          {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                          Arquivo/imagem
                          <input type="file" className="hidden" accept=".pdf,.csv,.txt,.xlsx,.xls,.png,.jpg,.jpeg,.webp" onChange={(e) => e.target.files?.[0] && importMutation.mutate({ file: e.target.files[0] })} />
                        </label>
                      </Button>
                      <Button variant="outline" disabled={importMutation.isPending} asChild>
                        <label className="cursor-pointer">
                          <Upload className="mr-2 h-4 w-4" />
                          Áudio
                          <input type="file" className="hidden" accept="audio/*" onChange={(e) => e.target.files?.[0] && importMutation.mutate({ file: e.target.files[0], audio: true })} />
                        </label>
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold">Lançamentos</h4>
                  {loadingLancamentos ? (
                    <div className="h-32 animate-pulse rounded-lg bg-muted" />
                  ) : selectedLancamentos.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhum lançamento para este imóvel.
                    </div>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {selectedLancamentos.map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                          <Badge className={item.tipo === "receita" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                            {item.tipo}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{item.descricao}</p>
                            <p className="text-xs text-muted-foreground">{item.categoria} · {item.data}</p>
                          </div>
                          <p className={`font-bold ${item.tipo === "receita" ? "text-green-700" : "text-red-700"}`}>
                            {item.tipo === "receita" ? "+" : "-"}{formatInventoryMoney(Number(item.valor || 0), moeda)}
                          </p>
                          <Button variant="ghost" size="icon" onClick={() => deleteLancamentoMutation.mutate(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={imovelDialogOpen} onOpenChange={(open) => open ? setImovelDialogOpen(true) : closeImovelDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingImovelId ? "Editar imóvel" : "Novo imóvel no inventário"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Foto</Label>
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Escolher foto
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImovelPhoto(e.target.files?.[0])} />
                </label>
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={imovelForm.nome} onChange={(e) => setImovelForm({ ...imovelForm, nome: e.target.value })} placeholder="Apartamento Jardim..." />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input value={imovelForm.tipo} onChange={(e) => setImovelForm({ ...imovelForm, tipo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Área m²</Label>
              <Input value={String(imovelForm.area_m2)} onChange={(e) => setImovelForm({ ...imovelForm, area_m2: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select value={imovelForm.moeda} onValueChange={(value) => setImovelForm({ ...imovelForm, moeda: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BRL">BRL</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor pago</Label>
              <Input value={String(imovelForm.valor_pago)} onChange={(e) => setImovelForm({ ...imovelForm, valor_pago: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Valor atual estimado</Label>
              <Input value={String(imovelForm.valor_atual)} onChange={(e) => setImovelForm({ ...imovelForm, valor_atual: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <div className="relative">
                <Input
                  value={imovelForm.cep}
                  onChange={(e) => void handleInventarioCepChange(e.target.value)}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                  aria-invalid={Boolean(inventarioCepError)}
                  className="pr-10"
                  data-testid="input-inventario-cep"
                />
                {inventarioCepLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {inventarioCepError && <p className="text-xs text-destructive">{inventarioCepError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={imovelForm.endereco} onChange={(e) => setImovelForm({ ...imovelForm, endereco: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={imovelForm.numero} onChange={(e) => setImovelForm({ ...imovelForm, numero: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input value={imovelForm.complemento} onChange={(e) => setImovelForm({ ...imovelForm, complemento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={imovelForm.bairro} onChange={(e) => setImovelForm({ ...imovelForm, bairro: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={imovelForm.cidade} onChange={(e) => setImovelForm({ ...imovelForm, cidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={imovelForm.estado} onChange={(e) => setImovelForm({ ...imovelForm, estado: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={imovelForm.pais} onChange={(e) => setImovelForm({ ...imovelForm, pais: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input value={imovelForm.matricula} onChange={(e) => setImovelForm({ ...imovelForm, matricula: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cartório</Label>
              <Input value={imovelForm.cartorio} onChange={(e) => setImovelForm({ ...imovelForm, cartorio: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={imovelForm.descricao} onChange={(e) => setImovelForm({ ...imovelForm, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeImovelDialog}>Cancelar</Button>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={!imovelForm.nome || saveImovelMutation.isPending}
              onClick={() => saveImovelMutation.mutate({ id: editingImovelId, payload: imovelForm })}
            >
              {saveImovelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingImovelId ? "Salvar alterações" : "Salvar imóvel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingImovel)} onOpenChange={(open) => !open && setDeletingImovel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover imóvel do inventário?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingImovel?.nome || "Este imóvel"}” e todos os seus lançamentos serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteImovelMutation.isPending}
              onClick={() => deletingImovel && deleteImovelMutation.mutate(deletingImovel.id)}
            >
              {deleteImovelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={lancamentoDialogOpen} onOpenChange={setLancamentoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={lancamentoForm.tipo} onValueChange={(value: "receita" | "despesa") => setLancamentoForm({ ...lancamentoForm, tipo: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="despesa">Despesa</SelectItem><SelectItem value="receita">Receita</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={lancamentoForm.categoria} onChange={(e) => setLancamentoForm({ ...lancamentoForm, categoria: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input type="number" value={lancamentoForm.valor || ""} onChange={(e) => setLancamentoForm({ ...lancamentoForm, valor: Number(e.target.value || 0) })} />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={lancamentoForm.data} onChange={(e) => setLancamentoForm({ ...lancamentoForm, data: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={lancamentoForm.descricao} onChange={(e) => setLancamentoForm({ ...lancamentoForm, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLancamentoDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => createLancamentoMutation.mutate({ ...lancamentoForm, imovel_id: selectedImovel?.id || "" })}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Prévia da IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {previewLancamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">A IA não encontrou lançamentos claros.</p>
            ) : previewLancamentos.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[120px_1fr_130px_130px]">
                <Select value={item.tipo} onValueChange={(value: "receita" | "despesa") => {
                  const next = [...previewLancamentos]; next[index] = { ...item, tipo: value }; setPreviewLancamentos(next);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="despesa">Despesa</SelectItem><SelectItem value="receita">Receita</SelectItem></SelectContent>
                </Select>
                <Input value={item.descricao} onChange={(e) => { const next = [...previewLancamentos]; next[index] = { ...item, descricao: e.target.value }; setPreviewLancamentos(next); }} />
                <Input type="number" value={item.valor || ""} onChange={(e) => { const next = [...previewLancamentos]; next[index] = { ...item, valor: Number(e.target.value || 0) }; setPreviewLancamentos(next); }} />
                <Input type="date" value={item.data} onChange={(e) => { const next = [...previewLancamentos]; next[index] = { ...item, data: e.target.value }; setPreviewLancamentos(next); }} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={!selectedImovel || previewLancamentos.length === 0} onClick={savePreviewLancamentos}>
              Confirmar lançamentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AreaAliancasPage() {
  const { toast } = useToast();
  const searchParams = useSearch();
  const getTabsFromSearch = () => {
    const tab = new URLSearchParams(searchParams).get("tab");
    if (["membros", "comunidades", "aliados"].includes(tab || "")) {
      return { main: "rede", rede: tab!, landBank: "land-bank" };
    }
    if (tab === "rede") {
      return { main: "rede", rede: "membros", landBank: "land-bank" };
    }
    if (["landbank", "land-bank", "built-asset-bank", "transformation-bank"].includes(tab || "")) {
      return {
        main: "landbank",
        rede: "membros",
        landBank: tab === "landbank" ? "land-bank" : tab === "transformation-bank" ? "built-asset-bank" : tab!,
      };
    }
    if (tab === "opas" || tab === "oportunidades") {
      return { main: "oportunidades", rede: "membros", landBank: "land-bank" };
    }
    if (tab === "bias") {
      return { main: "bias", rede: "membros", landBank: "land-bank" };
    }
    return { main: "oportunidades", rede: "membros", landBank: "land-bank" };
  };
  const initialTabs = getTabsFromSearch();
  const [activeTab, setActiveTab] = useState(initialTabs.main);
  const [activeRedeTab, setActiveRedeTab] = useState(initialTabs.rede);
  const [activeLandBankTab, setActiveLandBankTab] = useState(initialTabs.landBank);
  const [landBankAssets, setLandBankAssets] = useState<LandBankAsset[]>([]);
  const [landBankDialogOpen, setLandBankDialogOpen] = useState(false);
  const [deleteLandBankTarget, setDeleteLandBankTarget] = useState<LandBankAsset | null>(null);
  const [landBankDialogCategory, setLandBankDialogCategory] = useState<LandBankCategory["value"]>(initialTabs.landBank as LandBankCategory["value"]);
  const [landBankForm, setLandBankForm] = useState<LandBankForm>(emptyLandBankForm);

  const { data: landBankAssetsFromApi = [] } = useQuery<LandBankAsset[]>({
    queryKey: ["/api/land-bank-assets"],
    queryFn: async () => {
      const r = await fetch("/api/land-bank-assets", { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const createLandBankMutation = useMutation({
    mutationFn: async (asset: LandBankAsset) => {
      const response = await apiRequest("POST", "/api/land-bank-assets", asset);
      return response.json() as Promise<LandBankAsset>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
    },
  });

  const deleteLandBankMutation = useMutation({
    mutationFn: (assetId: string) => apiRequest("DELETE", `/api/land-bank-assets/${encodeURIComponent(assetId)}`),
    onSuccess: (_response, assetId) => {
      const nextAssets = landBankAssets.filter((asset) => asset.id !== assetId);
      setLandBankAssets(nextAssets);
      window.localStorage.setItem(landBankStorageKey, JSON.stringify(nextAssets));
      queryClient.setQueryData<LandBankAsset[]>(["/api/land-bank-assets"], (current = []) =>
        current.filter((asset) => asset.id !== assetId)
      );
      queryClient.removeQueries({ queryKey: ["/api/land-bank-assets", assetId] });
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
      setDeleteLandBankTarget(null);
      toast({ title: "Ativo excluído do Banco de Ativos" });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível excluir o ativo",
        description: error?.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const tabs = getTabsFromSearch();
    setActiveTab(tabs.main);
    setActiveRedeTab(tabs.rede);
    setActiveLandBankTab(tabs.landBank);
    const params = new URLSearchParams(searchParams);
    if (params.get("tab") === "opas") {
      params.set("tab", "oportunidades");
      if (!params.get("tipo")) params.set("tipo", "obas");
      window.history.replaceState(null, "", `/area-aliancas?${params.toString()}`);
    }
  }, [searchParams]);

  useEffect(() => {
    setLandBankAssets(landBankAssetsFromApi);
    window.localStorage.setItem(landBankStorageKey, JSON.stringify(landBankAssetsFromApi));
  }, [landBankAssetsFromApi]);

  useEffect(() => {
    if (landBankAssetsFromApi.length > 0) return;
    try {
      const stored = window.localStorage.getItem(landBankStorageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      parsed.forEach((asset) => {
        if (asset?.id && asset?.category) createLandBankMutation.mutate(asset);
      });
    } catch {
      // Ignore legacy local storage migration failures.
    }
  }, [landBankAssetsFromApi.length]);

  const selectedLandBankCategory = landBankCategories.find((category) => category.value === landBankDialogCategory) || landBankCategories[0];
  const SelectedLandBankIcon = selectedLandBankCategory.icon;
  const setLandBankField = (field: keyof LandBankForm, value: any) => {
    setLandBankForm((current) => ({ ...current, [field]: value }));
  };
  const handleLandBankPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.fileIds?.[0]) throw new Error(data.error || "Upload falhou");
      setLandBankField("foto", data.fileIds[0]);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setLandBankField("foto", typeof reader.result === "string" ? reader.result : "");
      };
      reader.readAsDataURL(file);
    }
  };
  const handleLandBankBasicInfoAttachment = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      setLandBankForm((current) => ({
        ...current,
        basicInfoAttachment: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
        },
      }));
    };
    reader.readAsDataURL(file);
  };
  const openLandBankDialog = (category: LandBankCategory["value"]) => {
    setLandBankDialogCategory(category);
    setLandBankForm(emptyLandBankForm);
    setLandBankDialogOpen(true);
  };
  const updateAreaTab = (value: string) => {
    setActiveTab(value);
    const urlTab = value === "landbank" ? activeLandBankTab : value;
    window.history.replaceState(null, "", `/area-aliancas?tab=${encodeURIComponent(urlTab)}`);
  };
  const updateLandBankTab = (value: string) => {
    setActiveLandBankTab(value);
    window.history.replaceState(null, "", `/area-aliancas?tab=${encodeURIComponent(value)}`);
  };
  const createLandBankAsset = () => {
    if (!landBankForm.autorizacao_compartilhamento || landBankForm.origem_tipo === "origem_nao_informada") {
      toast({ title: "Confirme a origem e a autorização", description: "A publicação exige origem classificada e autorização de compartilhamento.", variant: "destructive" });
      return;
    }
    const requiredFields: Array<keyof LandBankForm> = [
      "qualificacao",
      "area",
      "valor",
      "moeda",
      "cep",
      "endereco",
      "bairro",
      "cidade",
      "estado",
      "pais",
      "numero",
      "complemento",
      "numero_matricula",
      "livro",
      "folha",
      "cartorio",
      "comarca",
    ];
    const missing = requiredFields.some((field) => !String(landBankForm[field] || "").trim());
    if (missing) return;

    const estimatedCoords = estimateLandBankCoords(landBankForm);
    const asset: LandBankAsset = {
      ...landBankForm,
      bia_id: "",
      bia_nome: "",
      ...estimatedCoords,
      id: `land-${Date.now()}`,
      category: landBankDialogCategory,
      createdAt: new Date().toISOString(),
    };
    setLandBankAssets((current) => [asset, ...current]);
    createLandBankMutation.mutate(asset);
    setActiveTab("landbank");
    setActiveLandBankTab(landBankDialogCategory);
    setLandBankDialogOpen(false);
    setLandBankForm(emptyLandBankForm);
  };
  const publishInventarioToLandBank = (imovel: InventarioImovel) => {
    const tipo = `${imovel.tipo || ""} ${imovel.descricao || ""}`.toLowerCase();
    const category: LandBankCategory["value"] =
      tipo.includes("terreno") || tipo.includes("lote") || tipo.includes("gleba")
        ? "land-bank"
        : "built-asset-bank";
    const estimatedCoords = estimateLandBankCoords({
      ...emptyLandBankForm,
      estado: imovel.estado || "",
    });
    const asset: LandBankAsset = {
      ...emptyLandBankForm,
      bia_id: "",
      bia_nome: "",
      qualificacao: imovel.nome || imovel.tipo || "Imóvel do inventário",
      origem_tipo: "ativo_proprio",
      visibilidade: "publicada",
      autorizacao_compartilhamento: true,
      area: String(imovel.area_m2 || ""),
      valor: String(imovel.valor_atual || imovel.valor_pago || ""),
      moeda: imovel.moeda || "BRL",
      descricao: imovel.descricao || "",
      cep: imovel.cep || "",
      endereco: imovel.endereco || "",
      bairro: imovel.bairro || "",
      cidade: imovel.cidade || "",
      estado: imovel.estado || "",
      pais: imovel.pais || "Brasil",
      numero: imovel.numero || "",
      complemento: imovel.complemento || "",
      numero_matricula: imovel.matricula || "",
      cartorio: imovel.cartorio || "",
      foto: imovel.foto || "",
      ...estimatedCoords,
      id: `land-${Date.now()}-${imovel.id.slice(-4)}`,
      category,
      createdAt: new Date().toISOString(),
    };
    setLandBankAssets((current) => [asset, ...current]);
    createLandBankMutation.mutate(asset);
    setActiveTab("landbank");
    setActiveLandBankTab(category);
    window.history.replaceState(null, "", `/area-aliancas?tab=${encodeURIComponent(category)}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-area-aliancas-title">
          <Users className="h-7 w-7 text-cyan-500" />
          BUILT Alliances
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={updateAreaTab} className="space-y-5">
        <TabsList className="flex h-auto w-full flex-nowrap gap-1 overflow-x-auto bg-muted/60 p-1">
          <TabsTrigger
            value="oportunidades"
            className="min-w-max flex-1 gap-2 whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground"
            data-testid="tab-area-oportunidades"
          >
            <Target className="h-4 w-4 shrink-0 text-cyan-500" />
            Oportunidades
          </TabsTrigger>
          <TabsTrigger
            value="bias"
            className="min-w-max flex-1 gap-2 whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground"
            data-testid="tab-area-bias"
          >
            <Briefcase className="h-4 w-4 shrink-0 text-orange-500" />
            BIAs
          </TabsTrigger>
          <TabsTrigger
            value="rede"
            className="min-w-max flex-1 gap-2 whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground"
            data-testid="tab-area-rede"
          >
            <Network className="h-4 w-4 shrink-0 text-blue-500" />
            Rede
          </TabsTrigger>
          <TabsTrigger
            value="landbank"
            className="min-w-max flex-1 gap-2 whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground"
            data-testid="tab-area-landbank"
          >
            <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
            Banco de Ativos
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="oportunidades"
          className="[&>div]:p-0 [&>div]:max-w-none"
        >
          {activeTab === "oportunidades" && <NetworkOpportunitiesHub />}
        </TabsContent>
        <TabsContent
          value="bias"
          className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-bias-title']>div]:hidden"
        >
          {activeTab === "bias" && <BiasPage />}
        </TabsContent>
        <TabsContent value="rede" className="space-y-5">
          {activeTab === "rede" && (
            <Tabs value={activeRedeTab} onValueChange={setActiveRedeTab} className="space-y-5">
              <TabsList className="flex h-auto w-full flex-nowrap gap-1 overflow-x-auto bg-muted/50 p-1">
                <TabsTrigger
                  value="membros"
                  className="min-w-max flex-1 gap-2 whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground"
                  data-testid="tab-area-membros"
                >
                  <Handshake className="h-4 w-4 shrink-0 text-blue-500" />
                  Membros Aliados
                </TabsTrigger>
                <TabsTrigger
                  value="comunidades"
                  className="min-w-max flex-1 gap-2 whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground"
                  data-testid="tab-area-comunidades"
                >
                  <Globe2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  Comunidades
                </TabsTrigger>
                <TabsTrigger
                  value="aliados"
                  className="min-w-max flex-1 gap-2 whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground"
                  data-testid="tab-area-aliados"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-500" />
                  Aliados Licenciados
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="membros"
                className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-membros-title']>div]:hidden"
              >
                {activeRedeTab === "membros" && <AreMembroPage />}
              </TabsContent>
              <TabsContent
                value="comunidades"
                className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='icon-comunidade-title']]:hidden"
              >
                {activeRedeTab === "comunidades" && <ComunidadePage />}
              </TabsContent>
              <TabsContent value="aliados">
                {activeRedeTab === "aliados" && <AliadosTab />}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
        <TabsContent value="landbank" className="space-y-5">
          {activeTab === "landbank" && (
            <Tabs value={activeLandBankTab} onValueChange={updateLandBankTab} className="space-y-5">
              <BiaStructuringQueue compact />
              <TabsList className="flex h-auto w-full flex-nowrap gap-1 overflow-x-auto bg-muted/50 p-1">
                {landBankCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <TabsTrigger
                      key={category.value}
                      value={category.value}
                      className="min-w-max flex-1 gap-2 whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground"
                      data-testid={`tab-area-${category.value}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${category.accent}`} />
                      {category.title}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {landBankCategories.map((category) => (
                <TabsContent key={category.value} value={category.value}>
                  {activeLandBankTab === category.value && (
                    <LandBankPanel
                      category={category}
                      assets={landBankAssets.filter((asset) => asset.category === category.value)}
                      onCreate={openLandBankDialog}
                      onDelete={setDeleteLandBankTarget}
                    />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={landBankDialogOpen} onOpenChange={setLandBankDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SelectedLandBankIcon className={`h-5 w-5 ${selectedLandBankCategory.accent}`} />
              Novo ativo em {selectedLandBankCategory.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informações do ativo</p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedLandBankCategory.shortDescription}</p>
            </div>

            <div className="space-y-4 border-y py-4">
              <div className="space-y-2">
                <Label>Origem do ativo</Label>
                <Select value={landBankForm.origem_tipo} onValueChange={(value) => setLandBankField("origem_tipo", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ativo_proprio">Ativo próprio</SelectItem><SelectItem value="terceiro_autorizado">Ativo de terceiro autorizado</SelectItem><SelectItem value="oportunidade_externa">Oportunidade externa</SelectItem></SelectContent>
                </Select>
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={landBankForm.autorizacao_compartilhamento} onCheckedChange={(checked) => setLandBankField("autorizacao_compartilhamento", checked === true)} />
                <span className="text-sm leading-relaxed"><strong>Autorizo a análise e publicação desta oportunidade.</strong><br /><span className="text-muted-foreground">Endereço exato, documentos e contato permanecerão privados até a seleção de interessados.</span></span>
              </label>
            </div>

            <div className="space-y-2">
              <Label>Foto do ativo</Label>
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center">
                <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:w-32">
                  {landBankForm.foto ? (
                    <img src={landBankPhotoUrl(landBankForm.foto) || ""} alt="Prévia do ativo" className="h-full w-full object-cover" />
                  ) : (
                    <SelectedLandBankIcon className={`h-8 w-8 ${selectedLandBankCategory.accent}`} />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-foreground">Imagem de capa do card</p>
                  <p className="text-xs text-muted-foreground">
                    Adicione uma foto do terreno, imóvel ou ativo para aparecer no card do Banco de Ativos.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" asChild>
                      <label className="cursor-pointer">
                        Escolher foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLandBankPhoto(e.target.files?.[0])}
                          data-testid="input-landbank-foto"
                        />
                      </label>
                    </Button>
                    {landBankForm.foto && (
                      <Button type="button" variant="ghost" onClick={() => setLandBankField("foto", "")}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {landBankDialogCategory === "land-bank" && (
              <div className="space-y-2">
                <Label>Anexo de informações básicas</Label>
                <div className="rounded-xl border border-border bg-background p-3">
                  {landBankForm.basicInfoAttachment ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {landBankForm.basicInfoAttachment.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatLandBankFileSize(landBankForm.basicInfoAttachment.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-fit text-muted-foreground hover:text-destructive"
                        onClick={() => setLandBankForm((current) => ({ ...current, basicInfoAttachment: undefined }))}
                      >
                        <X className="mr-1.5 h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" asChild>
                      <label className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        Enviar arquivo
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
                          className="hidden"
                          onChange={(e) => handleLandBankBasicInfoAttachment(e.target.files?.[0])}
                          data-testid="input-landbank-info-basicas"
                        />
                      </label>
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Qualificação <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.qualificacao}
                  onChange={(e) => setLandBankField("qualificacao", e.target.value)}
                  placeholder="Casa, galpão, apartamento..."
                  data-testid="input-landbank-qualificacao"
                />
              </div>
              <div className="space-y-2">
                <Label>Área (m²) <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.area}
                  onChange={(e) => setLandBankField("area", e.target.value)}
                  placeholder="Ex: 120,50"
                  data-testid="input-landbank-area"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <div className="space-y-2">
                <Label>Valor <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.valor}
                  onChange={(e) => setLandBankField("valor", e.target.value)}
                  placeholder="Ex: 1.250.000,00"
                  data-testid="input-landbank-valor"
                />
              </div>
              <div className="space-y-2">
                <Label>Moeda <span className="text-destructive">*</span></Label>
                <Select value={landBankForm.moeda} onValueChange={(value) => setLandBankField("moeda", value)}>
                  <SelectTrigger data-testid="select-landbank-moeda">
                    <SelectValue placeholder="Moeda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL - R$</SelectItem>
                    <SelectItem value="USD">USD - US$</SelectItem>
                    <SelectItem value="EUR">EUR - €</SelectItem>
                    <SelectItem value="GBP">GBP - £</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição adicional</Label>
              <Textarea
                value={landBankForm.descricao}
                onChange={(e) => setLandBankField("descricao", e.target.value)}
                placeholder="Informação complementar do ativo, se houver"
                className="min-h-20"
                data-testid="textarea-landbank-descricao"
              />
            </div>

            <div className="space-y-2">
              <Label>CEP <span className="text-destructive">*</span></Label>
              <Input
                value={landBankForm.cep}
                onChange={(e) => setLandBankField("cep", e.target.value)}
                placeholder="00000-000"
                data-testid="input-landbank-cep"
              />
            </div>

            <div className="space-y-2">
              <Label>Endereço <span className="text-destructive">*</span></Label>
              <Input
                value={landBankForm.endereco}
                onChange={(e) => setLandBankField("endereco", e.target.value)}
                placeholder="Rua, avenida, estrada..."
                data-testid="input-landbank-endereco"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nº <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.numero}
                  onChange={(e) => setLandBankField("numero", e.target.value)}
                  placeholder="Número"
                  data-testid="input-landbank-numero"
                />
              </div>
              <div className="space-y-2">
                <Label>Complemento <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.complemento}
                  onChange={(e) => setLandBankField("complemento", e.target.value)}
                  placeholder="Bloco, unidade, sala..."
                  data-testid="input-landbank-complemento"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bairro <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.bairro}
                  onChange={(e) => setLandBankField("bairro", e.target.value)}
                  placeholder="Bairro"
                  data-testid="input-landbank-bairro"
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.cidade}
                  onChange={(e) => setLandBankField("cidade", e.target.value)}
                  placeholder="Cidade"
                  data-testid="input-landbank-cidade"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Estado <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.estado}
                  onChange={(e) => setLandBankField("estado", e.target.value)}
                  placeholder="UF"
                  data-testid="input-landbank-estado"
                />
              </div>
              <div className="space-y-2">
                <Label>País <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.pais}
                  onChange={(e) => setLandBankField("pais", e.target.value)}
                  placeholder="País"
                  data-testid="input-landbank-pais"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Número da matrícula <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.numero_matricula}
                  onChange={(e) => setLandBankField("numero_matricula", e.target.value)}
                  placeholder="Número da matrícula"
                  data-testid="input-landbank-numero-matricula"
                />
              </div>
              <div className="space-y-2">
                <Label>Livro <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.livro}
                  onChange={(e) => setLandBankField("livro", e.target.value)}
                  placeholder="Livro"
                  data-testid="input-landbank-livro"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Folha <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.folha}
                  onChange={(e) => setLandBankField("folha", e.target.value)}
                  placeholder="Folha"
                  data-testid="input-landbank-folha"
                />
              </div>
              <div className="space-y-2">
                <Label>Cartório <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.cartorio}
                  onChange={(e) => setLandBankField("cartorio", e.target.value)}
                  placeholder="Cartório de registro"
                  data-testid="input-landbank-cartorio"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Comarca <span className="text-destructive">*</span></Label>
                <Input
                  value={landBankForm.comarca}
                  onChange={(e) => setLandBankField("comarca", e.target.value)}
                  placeholder="Comarca do registro"
                  data-testid="input-landbank-comarca"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLandBankDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={createLandBankAsset}
              disabled={!landBankForm.autorizacao_compartilhamento}
              className="bg-blue-600 text-white hover:bg-blue-700"
              data-testid="btn-salvar-landbank"
            >
              Criar ativo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteLandBankTarget)}
        onOpenChange={(open) => !open && setDeleteLandBankTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteLandBankTarget?.qualificacao}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e removerá o ativo do Banco de Ativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLandBankMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteLandBankMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteLandBankTarget) deleteLandBankMutation.mutate(deleteLandBankTarget.id);
              }}
            >
              {deleteLandBankMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir ativo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
