import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, MapPin, Navigation, Search, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface OportunidadeVitrine {
  id: string;
  nome_oportunidade?: string | null;
  tipo?: string | null;
  valor_origem_opa?: string | number | null;
  Minimo_esforco_multiplicador?: string | number | null;
  nucleo_alianca?: string | null;
  localizacao?: string | null;
  status?: string | null;
  perfil_aliado?: string | null;
  imagem_directus_id?: any;
  imagem_url?: any;
}

function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(",", ".")) || 0;
}

function brl(value: string | number | null | undefined): string {
  const amount = num(value);
  if (!amount) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function isActiveOpa(opa: OportunidadeVitrine) {
  const status = String(opa.status || "ativa").toLowerCase();
  return ["ativa", "em_formacao", "em formação"].includes(status);
}

function directusAssetId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.id || value.uuid || value.directus_files_id || value.file || null;
  return String(value);
}

function getOpaImage(opa: OportunidadeVitrine) {
  const existingUrl = typeof opa.imagem_url === "string" ? opa.imagem_url : null;
  const assetId = directusAssetId(opa.imagem_url) || directusAssetId(opa.imagem_directus_id);
  const url = existingUrl || (assetId ? `/api/assets/${assetId}` : null);
  if (!url) return null;
  return `${url}${url.includes("?") ? "&" : "?"}v=directus-db-20260616`;
}

function OpaPublicCard({ opa, onOpen }: { opa: OportunidadeVitrine; onOpen: () => void }) {
  const image = getOpaImage(opa);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
      data-testid={`card-vitrine-oportunidade-${opa.id}`}
    >
      <div className="relative h-36 bg-gradient-to-br from-blue-50 to-slate-100">
        {image ? (
          <img src={image} alt={opa.nome_oportunidade || "OPA"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-blue-500/25">
            <Target className="h-10 w-10" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm">
          Pública
        </span>
      </div>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
            {opa.tipo || "OPA"}
          </Badge>
          {opa.status && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {String(opa.status).replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        <h2 className="line-clamp-2 min-h-[42px] text-base font-semibold text-foreground">
          {opa.nome_oportunidade || "OPA sem nome"}
        </h2>
        <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
          {opa.nucleo_alianca || opa.localizacao || "Oportunidade BUILT"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div>
            <p className="text-[10px] text-muted-foreground">Valor</p>
            <p className="text-sm font-semibold text-foreground">{brl(opa.valor_origem_opa)}</p>
          </div>
          <div className="text-right" title="Mínimo Esforço Multiplicador">
            <p className="text-[10px] text-muted-foreground">MEM</p>
            <p className="text-sm font-semibold text-foreground">
              {num(opa.Minimo_esforco_multiplicador) ? `${num(opa.Minimo_esforco_multiplicador).toLocaleString("pt-BR")}%` : "-"}
            </p>
          </div>
        </div>
      </CardContent>
    </button>
  );
}

export default function VitrineOportunidadesPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const { data: opasRaw = [], isLoading } = useQuery<OportunidadeVitrine[]>({
    queryKey: ["/api/oportunidades"],
  });

  const opas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (opasRaw as OportunidadeVitrine[])
      .filter(isActiveOpa)
      .filter((opa) => {
        if (!q) return true;
        return [
          opa.nome_oportunidade,
          opa.tipo,
          opa.nucleo_alianca,
          opa.localizacao,
          opa.perfil_aliado,
        ].filter(Boolean).join(" ").toLowerCase().includes(q);
      });
  }, [opasRaw, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-3 gap-2 text-muted-foreground" onClick={() => navigate("/vitrine")}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para Vitrine
          </Button>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <Navigation className="h-7 w-7 text-blue-600" />
            Oportunidades da Vitrine
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore OPAs públicas sem acessar o módulo BUILT Alliances.
          </p>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
          placeholder="Buscar oportunidade..."
          data-testid="input-vitrine-oportunidades-search"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : opas.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {opas.map((opa) => (
            <OpaPublicCard key={opa.id} opa={opa} onOpen={() => navigate(`/vitrine/opas/${opa.id}`)} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">Nenhuma oportunidade encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">Tente outra busca ou volte para a Vitrine.</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/vitrine")}>
              Voltar
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
