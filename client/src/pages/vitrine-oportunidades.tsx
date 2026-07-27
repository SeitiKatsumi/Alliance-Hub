import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, MapPin, Navigation, Plus, Search, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getTipoDisplayName } from "@/lib/ramos-segmentos";
import { getOpaPublicRef } from "@/lib/public-refs";

interface OportunidadeVitrine {
  id: string;
  bia_id?: string | null;
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

interface BiasVitrine {
  id: string;
  codigo_publico?: string | null;
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
          <img src={image} alt={opa.nome_oportunidade || "OBA"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-blue-500/25">
            <Target className="h-10 w-10" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm">
          OBA
        </span>
      </div>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
            {getTipoDisplayName(opa.tipo || "") || "OBA"}
          </Badge>
          {opa.status && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {String(opa.status).replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        <h2 className="line-clamp-2 min-h-[42px] text-base font-semibold text-foreground">
          {opa.nome_oportunidade || "OBA sem nome"}
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

const emptyChamadaForm = {
  nome_oportunidade: "",
  tipo: "",
  nucleo_alianca: "",
  valor_origem_opa: "",
  Minimo_esforco_multiplicador: "",
  localizacao: "",
  descricao: "",
  perfil_aliado: "",
};

type OportunidadesMode = "vitrine" | "capital";

export function VitrineOportunidadesPage(props: any = {}) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [chamadaForm, setChamadaForm] = useState(emptyChamadaForm);
  const mode = props.mode || "vitrine";
  const isCapital = mode === "capital";
  const backPath = isCapital ? "/built-capital" : "/vitrine";
  const detailPath = (opa: OportunidadeVitrine, bias: BiasVitrine[], opas: OportunidadeVitrine[]) => {
    const bia = bias.find((item) => item.id === opa.bia_id);
    const ref = getOpaPublicRef(opa, bia, opas);
    return isCapital ? `/built-capital/chamadas/${ref}` : `/vitrine/opas/${ref}`;
  };
  const endpoint = isCapital ? "/api/chamadas-capital" : "/api/oportunidades";
  const title = isCapital ? "Chamadas de Capital" : "Oportunidades da Vitrine";
  const backLabel = isCapital ? "Voltar para BUILT Capital" : "Voltar para Vitrine";
  const description = isCapital
    ? "Explore chamadas de capital e oportunidades de investimento BUILT."
    : "Explore OBAs publicas sem acessar o modulo BUILT Alliances.";
  const { data: opasRaw = [], isLoading } = useQuery<OportunidadeVitrine[]>({
    queryKey: [endpoint],
  });
  const { data: biasRaw = [] } = useQuery<BiasVitrine[]>({
    queryKey: ["/api/bias"],
  });

  const criarChamadaMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/chamadas-capital", chamadaForm);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chamadas-capital"] });
      setCreateOpen(false);
      setChamadaForm(emptyChamadaForm);
      toast({ title: "Chamada de capital criada" });
    },
    onError: (error: any) => {
      toast({
        title: "Nao foi possivel criar a chamada",
        description: error?.message || "Revise os dados e tente novamente.",
        variant: "destructive",
      });
    },
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
          <Button variant="ghost" size="sm" className="-ml-2 mb-3 gap-2 text-muted-foreground" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            {isCapital ? <Target className="h-7 w-7 text-emerald-500" /> : <Navigation className="h-7 w-7 text-blue-600" />}
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {isCapital && (
          <Button className="gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={() => setCreateOpen(true)} data-testid="btn-criar-chamada-capital">
            <Plus className="h-4 w-4" />
            Criar nova chamada
          </Button>
        )}
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
            <OpaPublicCard key={opa.id} opa={opa} onOpen={() => navigate(detailPath(opa, biasRaw as BiasVitrine[], opas))} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">{isCapital ? "Nenhuma chamada de capital cadastrada" : "Nenhuma oportunidade encontrada"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isCapital ? "Crie a primeira chamada de capital para exibir aqui." : "Tente outra busca ou volte para a Vitrine."}
            </p>
            {isCapital ? (
              <Button className="mt-4 gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Criar nova chamada
              </Button>
            ) : (
              <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate(backPath)}>
                Voltar
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isCapital && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-500" />
                Criar nova chamada de capital
              </DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[68vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Nome da chamada *</label>
                <Input
                  value={chamadaForm.nome_oportunidade}
                  onChange={(event) => setChamadaForm((current) => ({ ...current, nome_oportunidade: event.target.value }))}
                  placeholder="Ex: Captacao para empreendimento..."
                  data-testid="input-chamada-capital-nome"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tipo</label>
                <Input
                  value={chamadaForm.tipo}
                  onChange={(event) => setChamadaForm((current) => ({ ...current, tipo: event.target.value }))}
                  placeholder="Aporte Financeiro, Projeto, Lideranca..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nucleo</label>
                <Input
                  value={chamadaForm.nucleo_alianca}
                  onChange={(event) => setChamadaForm((current) => ({ ...current, nucleo_alianca: event.target.value }))}
                  placeholder="Nucleo de Capital"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Valor</label>
                <Input
                  value={chamadaForm.valor_origem_opa}
                  onChange={(event) => setChamadaForm((current) => ({ ...current, valor_origem_opa: event.target.value }))}
                  placeholder="24000"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">MEM (%)</label>
                <Input
                  value={chamadaForm.Minimo_esforco_multiplicador}
                  onChange={(event) => setChamadaForm((current) => ({ ...current, Minimo_esforco_multiplicador: event.target.value }))}
                  placeholder="50"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Localizacao</label>
                <Input
                  value={chamadaForm.localizacao}
                  onChange={(event) => setChamadaForm((current) => ({ ...current, localizacao: event.target.value }))}
                  placeholder="Cidade, Estado, Pais"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Descricao / escopo</label>
                <Textarea
                  value={chamadaForm.descricao}
                  onChange={(event) => setChamadaForm((current) => ({ ...current, descricao: event.target.value }))}
                  rows={4}
                  placeholder="Descreva a chamada de capital..."
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Perfil esperado</label>
                <Textarea
                  value={chamadaForm.perfil_aliado}
                  onChange={(event) => setChamadaForm((current) => ({ ...current, perfil_aliado: event.target.value }))}
                  rows={3}
                  placeholder="Perfil de investidor, parceiro ou participante esperado..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => criarChamadaMutation.mutate()}
                disabled={!chamadaForm.nome_oportunidade.trim() || criarChamadaMutation.isPending}
                data-testid="btn-salvar-chamada-capital"
              >
                {criarChamadaMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Criar chamada
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function BuiltCapitalChamadasPage() {
  return <VitrineOportunidadesPage mode="capital" />;
}

export default VitrineOportunidadesPage;
