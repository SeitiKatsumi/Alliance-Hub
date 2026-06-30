import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuraBadge } from "@/components/aura-score";
import { RedeBadgeButton } from "@/components/rede-badge-viewer";
import { MapWheelGuard } from "@/components/map-wheel-guard";
import { useAuth } from "@/hooks/use-auth";
import ComunidadePage from "@/pages/comunidade";
import AreMembroPage from "@/pages/area-membros";
import BiasPage from "@/pages/bias";
import OportunidadesPage from "@/pages/oportunidades";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import {
  Briefcase,
  FileText,
  Globe2,
  Handshake,
  MapPin,
  Network,
  Paperclip,
  Plus,
  Ruler,
  Search,
  ShieldCheck,
  Target,
  Upload,
  Users,
  X,
  Info,
} from "lucide-react";
import { getMembroUrl } from "@/lib/public-refs";

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
  foto?: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
}

type LandBankForm = Omit<LandBankAsset, "id" | "category" | "createdAt">;

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
  foto: "",
};

interface BiasProjetoLandBank {
  id: string;
  nome_bia: string;
  autor_bia?: string | { id?: string } | null;
  aliado_built?: string | { id?: string } | null;
  diretor_alianca?: string | { id?: string } | null;
  diretor_nucleo_tecnico?: string | { id?: string } | null;
  diretor_execucao?: string | { id?: string } | null;
  diretor_comercial?: string | { id?: string } | null;
  diretor_capital?: string | { id?: string } | null;
  socios_guardioes?: Array<string | { id?: string; cadastro_geral_id?: string | { id?: string } }> | string | null;
  socios_multiplicadores?: Array<string | { id?: string; cadastro_geral_id?: string | { id?: string } }> | string | null;
  terceiros?: Array<string | { id?: string; cadastro_geral_id?: string | { id?: string } }> | string | null;
}

function relationId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "object") {
    if (value.id) return String(value.id);
    if (value.cadastro_geral_id) return relationId(value.cadastro_geral_id);
    return null;
  }
  return String(value);
}

function parseBiaMemberIds(value: BiasProjetoLandBank["socios_guardioes"]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return relationId(item.cadastro_geral_id) || relationId(item);
      })
      .filter((id): id is string => Boolean(id));
  }
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseBiaMemberIds(parsed as any);
  } catch {
    // Legacy records can still arrive as comma-separated ids.
  }
  return value.split(",").map((id) => id.trim()).filter(Boolean);
}

function isMembroAssociatedToLandBankBia(bia: BiasProjetoLandBank, membroId?: string | null): boolean {
  if (!membroId) return false;
  const current = String(membroId);
  const directRoles = [
    bia.autor_bia,
    bia.aliado_built,
    bia.diretor_alianca,
    bia.diretor_nucleo_tecnico,
    bia.diretor_execucao,
    bia.diretor_comercial,
    bia.diretor_capital,
  ].map(relationId);
  const listRoles = [
    ...parseBiaMemberIds(bia.socios_guardioes),
    ...parseBiaMemberIds(bia.socios_multiplicadores),
    ...parseBiaMemberIds(bia.terceiros),
  ];
  return [...directRoles, ...listRoles].some((id) => String(id) === current);
}

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
}: {
  category: LandBankCategory;
  assets: LandBankAsset[];
  onCreate: (category: LandBankCategory["value"]) => void;
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
          <Button onClick={() => onCreate(category.value)} className="gap-2 whitespace-nowrap" data-testid={`btn-criar-${category.value}`}>
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
              className="cursor-pointer overflow-hidden border-border/80 transition-colors hover:border-brand-gold/50"
              onClick={() => navigate(`/land-bank/${asset.id}`)}
              data-testid={`card-landbank-${asset.id}`}
            >
              <div className={`flex h-32 items-center justify-center overflow-hidden ${category.bg}`}>
                {asset.foto ? (
                  <img src={asset.foto} alt={asset.qualificacao} className="h-full w-full object-cover" />
                ) : (
                  <Icon className={`h-10 w-10 ${category.accent}`} />
                )}
              </div>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-blue-700">
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

export default function AreaAliancasPage() {
  const { user } = useAuth();
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
    if (["opas", "bias"].includes(tab || "")) {
      return { main: tab!, rede: "membros", landBank: "land-bank" };
    }
    return { main: "opas", rede: "membros", landBank: "land-bank" };
  };
  const initialTabs = getTabsFromSearch();
  const [activeTab, setActiveTab] = useState(initialTabs.main);
  const [activeRedeTab, setActiveRedeTab] = useState(initialTabs.rede);
  const [activeLandBankTab, setActiveLandBankTab] = useState(initialTabs.landBank);
  const [landBankAssets, setLandBankAssets] = useState<LandBankAsset[]>([]);
  const [landBankDialogOpen, setLandBankDialogOpen] = useState(false);
  const [landBankDialogCategory, setLandBankDialogCategory] = useState<LandBankCategory["value"]>(initialTabs.landBank as LandBankCategory["value"]);
  const [landBankForm, setLandBankForm] = useState<LandBankForm>(emptyLandBankForm);
  const membroId = user?.membro_directus_id || null;

  const { data: bias = [] } = useQuery<BiasProjetoLandBank[]>({
    queryKey: ["/api/bias", "landbank-link"],
    queryFn: async () => {
      const r = await fetch("/api/bias", { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

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

  const associatedBias = useMemo(
    () => bias.filter((bia) => isMembroAssociatedToLandBankBia(bia, membroId)),
    [bias, membroId],
  );

  useEffect(() => {
    const tabs = getTabsFromSearch();
    setActiveTab(tabs.main);
    setActiveRedeTab(tabs.rede);
    setActiveLandBankTab(tabs.landBank);
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
  const setLandBankField = (field: keyof LandBankForm, value: string) => {
    setLandBankForm((current) => ({ ...current, [field]: value }));
  };
  const handleLandBankPhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLandBankField("foto", typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  };
  const handleLandBankBasicInfoAttachment = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setLandBankForm((current) => ({
        ...current,
        basicInfoAttachment: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: reader.result,
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
  const createLandBankAsset = () => {
    const requiredFields: Array<keyof LandBankForm> = [
      "bia_id",
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
    ];
    const missing = requiredFields.some((field) => !String(landBankForm[field] || "").trim());
    if (missing) return;
    const linkedBia = associatedBias.find((bia) => bia.id === landBankForm.bia_id);
    if (!linkedBia) return;

    const estimatedCoords = estimateLandBankCoords(landBankForm);
    const asset: LandBankAsset = {
      ...landBankForm,
      bia_nome: linkedBia.nome_bia,
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-area-aliancas-title">
          <Users className="h-7 w-7 text-cyan-500" />
          BUILT Alliances
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="flex h-auto w-full flex-nowrap gap-1 overflow-x-auto bg-muted/60 p-1">
          <TabsTrigger
            value="opas"
            className="min-w-max flex-1 gap-2 whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground"
            data-testid="tab-area-opas"
          >
            <Target className="h-4 w-4 shrink-0 text-cyan-500" />
            OPAs
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
          value="opas"
          className="[&>div]:p-0 [&>div]:max-w-none"
        >
          {activeTab === "opas" && <OportunidadesPage />}
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
            <Tabs value={activeLandBankTab} onValueChange={setActiveLandBankTab} className="space-y-5">
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

            <div className="space-y-2">
              <Label>BIA vinculada <span className="text-destructive">*</span></Label>
              <Select
                value={landBankForm.bia_id || undefined}
                onValueChange={(value) => {
                  const linkedBia = associatedBias.find((bia) => bia.id === value);
                  setLandBankForm((current) => ({
                    ...current,
                    bia_id: value,
                    bia_nome: linkedBia?.nome_bia || "",
                  }));
                }}
              >
                <SelectTrigger
                  className={!landBankForm.bia_id ? "border-destructive/40 text-muted-foreground" : ""}
                  data-testid="select-landbank-bia"
                >
                  <SelectValue placeholder="Selecione uma BIA associada..." />
                </SelectTrigger>
                <SelectContent>
                  {associatedBias.length > 0 ? (
                    associatedBias.map((bia) => (
                      <SelectItem key={bia.id} value={bia.id}>
                        {bia.nome_bia}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhuma BIA associada disponível.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Foto do ativo</Label>
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center">
                <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:w-32">
                  {landBankForm.foto ? (
                    <img src={landBankForm.foto} alt="Prévia do ativo" className="h-full w-full object-cover" />
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLandBankDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={createLandBankAsset}
              disabled={!landBankForm.bia_id || associatedBias.length === 0}
              data-testid="btn-salvar-landbank"
            >
              Criar ativo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
