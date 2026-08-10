import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  HandHeart,
  MapPin,
  Paperclip,
  Pencil,
  Loader2,
  Ruler,
  Sparkles,
  Trash2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { landBankPhotoUrl } from "@/lib/land-bank-assets";
import type { MarketM2Analysis } from "@/lib/market-analysis";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { EnvironmentAccessDialog, environmentAccessFor } from "@/components/environment-access";

const landBankStorageKey = "built-land-bank-assets-v2";

const categoryMeta = {
  "land-bank": {
    title: "Land Bank",
    description: "Inclui terrenos, lotes, glebas e áreas urbanas ou rurais que podem ser desenvolvidas, loteadas, incorporadas, vendidas de forma estruturada ou transformadas em novos empreendimentos.",
    icon: MapPin,
    accent: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  "built-asset-bank": {
    title: "Ativos Edificados",
    description: "Inclui galpões, prédios, casas, salas, lojas, apartamentos, estruturas inacabadas e imóveis construídos que podem ser reformados, convertidos, regularizados, vendidos, alugados ou transformados em novos produtos imobiliários.",
    icon: Briefcase,
    accent: "text-blue-500",
    bg: "bg-blue-50",
  },
} as const;

type LandBankCategoryValue = keyof typeof categoryMeta;

const stageLabels: Record<string, string> = {
  identificada: "Identificada",
  em_analise: "Em análise",
  complementos_solicitados: "Complementos solicitados",
  pre_viabilidade_aprovada: "Pré-viabilidade aprovada",
  estruturacao_solicitada: "Estruturação solicitada",
  bia_em_formacao: "BIA em formação",
  convertida_bia: "Convertida em BIA",
  rejeitada: "Rejeitada",
  arquivada: "Arquivada",
};

interface LandBankAsset {
  id: string;
  category: LandBankCategoryValue | "transformation-bank";
  bia_id?: string;
  bia_nome?: string;
  basicInfoAttachment?: {
    name: string;
    type: string;
    size: number;
    dataUrl: string;
  };
  qualificacao: string;
  area: string;
  area_m2?: string;
  valor?: string;
  moeda?: string;
  descricao?: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  pais: string;
  numero: string;
  complemento: string;
  foto?: string;
  createdAt: string;
  can_edit?: boolean;
  can_delete?: boolean;
  can_review?: boolean;
  can_request_bia?: boolean;
  origem_tipo?: string;
  visibilidade?: string;
  estagio?: string;
  autorizacao_compartilhamento_at?: string | null;
  autorizacao_compartilhamento?: boolean;
  dados_privados_liberados?: boolean;
  meu_interesse?: { id: string; status: string; mensagem?: string | null } | null;
}

function readAssets(): LandBankAsset[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(landBankStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAssets(assets: LandBankAsset[]) {
  window.localStorage.setItem(landBankStorageKey, JSON.stringify(assets));
}


function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function formatCurrency(value?: string | null, currency = "BRL"): string | null {
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

function parseMarketNumber(value?: string | number | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyPerM2(value: number, currency = "BRL"): string {
  try {
    return `${new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value)}/m²`;
  } catch {
    return `${currency} ${value.toLocaleString("pt-BR")}/m²`;
  }
}

function classificationLabel(value?: string): string {
  if (value === "acima") return "Acima da média";
  if (value === "abaixo") return "Abaixo da média";
  if (value === "media") return "Na média";
  return "Indeterminado";
}

function classificationClass(value?: string): string {
  if (value === "acima") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "abaixo") return "border-blue-200 bg-blue-50 text-blue-700";
  if (value === "media") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

interface AssetInterest {
  id: string;
  membro_nome?: string | null;
  mensagem?: string | null;
  status: "interesse_recebido" | "em_analise" | "selecionado" | "nao_selecionado" | "retirado";
}

function AssetInterestsManager({ assetId }: { assetId: string }) {
  const { toast } = useToast();
  const queryKey = ["/api/land-bank-assets", assetId, "interesses"] as const;
  const interestsQuery = useQuery<AssetInterest[]>({ queryKey });
  const updateMutation = useMutation({
    mutationFn: ({ interestId, status }: { interestId: string; status: AssetInterest["status"] }) =>
      apiRequest("PATCH", `/api/land-bank-assets/${assetId}/interesses/${interestId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Interesse atualizado" });
    },
    onError: (error: any) => toast({ title: "Erro ao atualizar interesse", description: error?.message, variant: "destructive" }),
  });
  const interests = interestsQuery.data || [];
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold">Membros interessados</h2><p className="mt-1 text-xs text-muted-foreground">Selecione um ou vários membros para liberar os dados privados.</p></div><Badge variant="outline">{interests.length}</Badge></div>
        {interestsQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : interests.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há manifestações de interesse.</p> : <div className="divide-y">{interests.map((interest) => <div key={interest.id} className="space-y-2 py-3"><div><p className="text-sm font-medium">{interest.membro_nome || "Membro BUILT"}</p>{interest.mensagem && <p className="mt-1 text-xs text-muted-foreground">{interest.mensagem}</p>}</div><Select value={interest.status} onValueChange={(status) => updateMutation.mutate({ interestId: interest.id, status: status as AssetInterest["status"] })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="interesse_recebido">Interesse recebido</SelectItem><SelectItem value="em_analise">Em análise</SelectItem><SelectItem value="selecionado">Selecionado</SelectItem><SelectItem value="nao_selecionado">Não selecionado</SelectItem></SelectContent></Select></div>)}</div>}
      </CardContent>
    </Card>
  );
}

export default function LandBankDetalhePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const isPersonalRoute = window.location.pathname.startsWith("/oportunidades/");
  const [assets, setAssets] = useState<LandBankAsset[]>(readAssets);
  const [interestDialogOpen, setInterestDialogOpen] = useState(false);
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<LandBankAsset | null>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<MarketM2Analysis | null>(null);
  const marketAnalysisKeyRef = useRef("");
  const [mensagem, setMensagem] = useState("");

  const { data: assetFromApi = null } = useQuery<LandBankAsset | null>({
    queryKey: ["/api/land-bank-assets", id],
    queryFn: async () => {
      if (!id) return null;
      const r = await fetch(`/api/land-bank-assets/${encodeURIComponent(id)}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!id,
  });

  const updateAssetMutation = useMutation({
    mutationFn: async (asset: LandBankAsset) => {
      const response = await apiRequest("PATCH", `/api/land-bank-assets/${asset.id}`, asset);
      return response.json() as Promise<LandBankAsset>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
    },
  });

  const asset = useMemo(() => assetFromApi || assets.find((item) => item.id === id) || null, [assetFromApi, assets, id]);
  const myInterest = asset?.meu_interesse && asset.meu_interesse.status !== "retirado" ? asset.meu_interesse : null;
  const alliancesAccess = environmentAccessFor(user, "alliances");
  const categoryKey = asset?.category === "transformation-bank" ? "built-asset-bank" : asset?.category;
  const meta = categoryKey ? categoryMeta[categoryKey as LandBankCategoryValue] || categoryMeta["land-bank"] : categoryMeta["land-bank"];
  const Icon = meta.icon;
  const assetValue = parseMarketNumber(asset?.valor || "");
  const assetArea = parseMarketNumber(asset?.area || asset?.area_m2 || "");
  const assetPriceM2 = assetArea > 0 ? assetValue / assetArea : 0;

  const deleteAssetMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/land-bank-assets/${encodeURIComponent(id)}`),
    onSuccess: () => {
      const nextAssets = assets.filter((item) => item.id !== id);
      writeAssets(nextAssets);
      setAssets(nextAssets);
      queryClient.setQueryData<LandBankAsset[]>(["/api/land-bank-assets"], (current = []) =>
        current.filter((item) => item.id !== id)
      );
      queryClient.removeQueries({ queryKey: ["/api/land-bank-assets", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
      setDeleteDialogOpen(false);
      toast({ title: "Ativo excluído do Banco de Ativos" });
      navigate(isPersonalRoute ? "/oportunidades" : `/area-aliancas?tab=${categoryKey || "land-bank"}`);
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível excluir o ativo",
        description: error?.message,
        variant: "destructive",
      });
    },
  });

  const marketAnalysisMutation = useMutation({
    mutationFn: async () => {
      if (!asset) throw new Error("Ativo não encontrado");
      const response = await apiRequest("POST", "/api/ai/preco-m2", {
        origem: "Banco de Ativos",
        nome: asset.qualificacao,
        tipo: asset.qualificacao,
        valor: assetValue,
        area_m2: assetArea,
        moeda: asset.moeda || "BRL",
        endereco: asset.endereco,
        bairro: asset.bairro,
        cidade: asset.cidade,
        estado: asset.estado,
        pais: asset.pais,
        cep: asset.cep,
      });
      return response.json() as Promise<MarketM2Analysis>;
    },
    onSuccess: setMarketAnalysis,
  });

  useEffect(() => {
    if (!asset || assetValue <= 0 || assetArea <= 0) return;
    const locationKey = [asset.endereco, asset.bairro, asset.cidade, asset.estado, asset.pais, asset.cep].filter(Boolean).join("|");
    if (!locationKey.trim()) return;
    const key = `${asset.id}|${assetValue}|${assetArea}|${locationKey}|${asset.qualificacao}`;
    if (marketAnalysisKeyRef.current === key || marketAnalysisMutation.isPending) return;
    marketAnalysisKeyRef.current = key;
    marketAnalysisMutation.mutate();
  }, [
    asset?.id,
    asset?.endereco,
    asset?.bairro,
    asset?.cidade,
    asset?.estado,
    asset?.pais,
    asset?.cep,
    asset?.category,
    asset?.qualificacao,
    assetValue,
    assetArea,
    marketAnalysisMutation.isPending,
  ]);

  const interestMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/land-bank-assets/${id}/interesse`, { mensagem: mensagem.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
      setMensagem("");
      setInterestDialogOpen(false);
      toast({ title: "Interesse registrado" });
    },
    onError: (error: any) => toast({ title: "Não foi possível registrar interesse", description: error?.message, variant: "destructive" }),
  });

  const removeInterestMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/land-bank-assets/${id}/interesse`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
      toast({ title: "Interesse retirado" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (estagio: string) => {
      const response = await apiRequest("PATCH", `/api/land-bank-assets/${id}/analise`, {
        estagio,
        observacao: reviewNote.trim() || null,
      });
      return response.json() as Promise<LandBankAsset>;
    },
    onSuccess: async (updatedAsset, estagio) => {
      queryClient.setQueryData(["/api/land-bank-assets", id], updatedAsset);
      await queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
      setReviewNote("");
      toast({
        title: stageLabels[estagio] || "Análise atualizada",
        description: estagio === "complementos_solicitados"
          ? "A solicitação e o parecer foram registrados na oportunidade."
          : estagio === "pre_viabilidade_aprovada"
            ? "A oportunidade agora pode solicitar a estruturação de uma BIA."
            : "A oportunidade entrou formalmente em análise preliminar.",
      });
    },
    onError: (error: any) => toast({ title: "Erro ao atualizar análise", description: error?.message, variant: "destructive" }),
  });

  const submitReviewStage = (estagio: string) => {
    if (estagio === "complementos_solicitados" && !reviewNote.trim()) {
      toast({
        title: "Descreva os complementos necessários",
        description: "Informe no parecer quais dados ou documentos precisam ser enviados.",
        variant: "destructive",
      });
      return;
    }
    reviewMutation.mutate(estagio);
  };

  const requestBiaMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/land-bank-assets/${id}/estruturacao-bia`, { observacao: reviewNote || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/bia-estruturacao-solicitacoes"] });
      setReviewNote("");
      toast({ title: "Estruturação de BIA solicitada" });
    },
    onError: (error: any) => toast({ title: "Não foi possível solicitar a BIA", description: error?.message, variant: "destructive" }),
  });

  const openEditDialog = () => {
    if (!asset) return;
    setEditForm({
      ...asset,
      category: asset.category === "transformation-bank" ? "built-asset-bank" : asset.category,
      autorizacao_compartilhamento: Boolean(asset.autorizacao_compartilhamento_at || asset.autorizacao_compartilhamento),
    });
    setEditDialogOpen(true);
  };

  const setEditField = (field: keyof LandBankAsset, value: any) => {
    setEditForm((current) => current ? { ...current, [field]: value } : current);
  };

  const handleEditPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.fileIds?.[0]) throw new Error(data.error || "Upload falhou");
      setEditField("foto", data.fileIds[0]);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setEditField("foto", typeof reader.result === "string" ? reader.result : "");
      };
      reader.readAsDataURL(file);
    }
  };

  const saveEdit = () => {
    if (!editForm) return;
    const next = assets.map((item) => item.id === editForm.id ? editForm : item);
    writeAssets(next);
    setAssets(next);
    updateAssetMutation.mutate(editForm, {
      onSuccess: (updated) => {
        const synced = next.map((item) => item.id === updated.id ? updated : item);
        writeAssets(synced);
        setAssets(synced);
      },
    });
    setEditDialogOpen(false);
  };

  if (!asset) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Button variant="ghost" onClick={() => navigate(isPersonalRoute ? "/oportunidades" : "/area-aliancas?tab=landbank")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar para {isPersonalRoute ? "Oportunidades" : "Land Bank"}
        </Button>
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-lg font-semibold text-foreground">Ativo não encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Esse ativo pode ter sido removido deste navegador.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(isPersonalRoute ? "/oportunidades" : `/area-aliancas?tab=${asset.category}`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar para {isPersonalRoute ? "Oportunidades" : meta.title}
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          {asset.can_edit && (
            <Button variant="outline" onClick={openEditDialog} className="gap-2" data-testid="btn-editar-landbank">
              <Pencil className="h-4 w-4" />
              Editar ativo
            </Button>
          )}
          {asset.can_delete && (
            <Button
              variant="outline"
              className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="btn-excluir-landbank"
            >
              <Trash2 className="h-4 w-4" />
              Excluir ativo
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className={`flex h-72 items-center justify-center overflow-hidden ${meta.bg}`}>
              {asset.foto ? (
                <img src={landBankPhotoUrl(asset.foto) || ""} alt={asset.qualificacao} className="h-full w-full object-cover" />
              ) : (
                <Icon className={`h-16 w-16 ${meta.accent}`} />
              )}
            </div>
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-blue-500 text-white hover:bg-blue-500">{meta.title}</Badge>
                <Badge variant="outline">{asset.origem_tipo === "ativo_proprio" ? "Ativo próprio" : asset.origem_tipo === "terceiro_autorizado" ? "Terceiro autorizado" : asset.origem_tipo === "oportunidade_externa" ? "Oportunidade externa" : "Origem não informada"}</Badge>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{stageLabels[asset.estagio || "identificada"] || asset.estagio || "Identificada"}</Badge>
                {myInterest && (
                  <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700">
                    interesse manifestado
                  </Badge>
                )}
              </div>

              <div>
                <h1 className="text-3xl font-bold leading-tight text-foreground">{asset.qualificacao}</h1>
                <p className="mt-2 text-muted-foreground">{meta.description}</p>
              </div>

              {asset.descricao && (
                <>
                  <Separator />
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Descrição</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{asset.descricao}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <MapPin className={`h-4 w-4 ${meta.accent}`} />
                <h2 className="font-semibold text-foreground">Localização</h2>
              </div>
              <div className="grid gap-3">
                {asset.dados_privados_liberados && <InfoRow label="Endereço" value={[asset.endereco, asset.numero].filter(Boolean).join(", ")} />}
                <InfoRow label="Complemento" value={asset.complemento} />
                {asset.dados_privados_liberados && <InfoRow label="Bairro" value={asset.bairro} />}
                <InfoRow label="Cidade" value={[asset.cidade, asset.estado].filter(Boolean).join(", ")} />
                <InfoRow label="País" value={asset.pais} />
                {asset.dados_privados_liberados && <InfoRow label="CEP" value={asset.cep} />}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <Ruler className={`h-4 w-4 ${meta.accent}`} />
                <h2 className="font-semibold text-foreground">Informações do ativo</h2>
              </div>
              <InfoRow label="Área" value={(asset.area || asset.area_m2) ? `${asset.area || asset.area_m2} m²` : null} />
              <InfoRow label="Valor" value={formatCurrency(asset.valor, asset.moeda || "BRL")} />
              <InfoRow label="Moeda" value={asset.moeda || "BRL"} />
              <InfoRow label="Categoria" value={meta.title} />
              <InfoRow label="BIA vinculada" value={asset.bia_nome} />
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <h2 className="font-semibold text-foreground">IA de preço por m²</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Compara o valor do ativo com imóveis à venda do mesmo tipo, região e faixa de área.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                  disabled={marketAnalysisMutation.isPending || assetValue <= 0 || assetArea <= 0}
                  onClick={() => marketAnalysisMutation.mutate()}
                  data-testid="button-landbank-analise-preco-m2"
                >
                  {marketAnalysisMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {marketAnalysis ? "Reanalisar" : marketAnalysisMutation.isPending ? "Analisando" : "Analisar"}
                </Button>
              </div>

              {assetValue <= 0 || assetArea <= 0 ? (
                <p className="rounded-lg border border-dashed border-blue-200 bg-white/70 p-3 text-sm text-muted-foreground">
                  Informe valor e área do ativo para analisar.
                </p>
              ) : !marketAnalysis ? (
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Preço informado</p>
                  <p className="text-base font-bold text-blue-700">{formatMoneyPerM2(assetPriceM2, asset.moeda || "BRL")}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {marketAnalysisMutation.isPending
                      ? "Analisando automaticamente a média da região."
                      : "A análise roda automaticamente com valor, área e localização suficientes."}
                  </p>
                </div>
              ) : marketAnalysis.amostra_suficiente === false ? (
                <div className="rounded-lg border border-dashed border-blue-200 bg-white/70 p-3">
                  <p className="text-sm font-medium text-foreground">Ainda não há imóveis comparáveis suficientes.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {marketAnalysis.resumo || "A média será exibida quando forem encontrados pelo menos 3 anúncios válidos."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-blue-800">
                    Baseado em {marketAnalysis.quantidade_comparaveis} imóveis comparáveis entre {marketAnalysis.area_min.toLocaleString("pt-BR")} e {marketAnalysis.area_max.toLocaleString("pt-BR")} m².
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={classificationClass(marketAnalysis.classificacao)}>
                      {classificationLabel(marketAnalysis.classificacao)}
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                      Confiança {marketAnalysis.confianca || "baixa"}
                    </Badge>
                  </div>
                  <div className="grid gap-2">
                    <InfoRow label="Informado" value={formatMoneyPerM2(marketAnalysis.preco_m2_informado || assetPriceM2, asset.moeda || "BRL")} />
                    <InfoRow label="Referência média" value={marketAnalysis.referencia_m2_media ? formatMoneyPerM2(marketAnalysis.referencia_m2_media, asset.moeda || "BRL") : "-"} />
                    <InfoRow
                      label="Faixa dos comparáveis"
                      value={marketAnalysis.referencia_m2_min && marketAnalysis.referencia_m2_max
                        ? `${formatMoneyPerM2(marketAnalysis.referencia_m2_min, asset.moeda || "BRL")} - ${formatMoneyPerM2(marketAnalysis.referencia_m2_max, asset.moeda || "BRL")}`
                        : "-"}
                    />
                    {typeof marketAnalysis.diferenca_percentual === "number" && (
                      <InfoRow label="Diferença vs referência" value={`${marketAnalysis.diferenca_percentual > 0 ? "+" : ""}${marketAnalysis.diferenca_percentual.toFixed(1)}%`} />
                    )}
                  </div>
                  {marketAnalysis.resumo && <p className="text-sm leading-relaxed text-foreground">{marketAnalysis.resumo}</p>}
                  {!!marketAnalysis.fatores?.length && (
                    <div className="flex flex-wrap gap-2">
                      {marketAnalysis.fatores.slice(0, 4).map((fator, index) => (
                        <Badge key={`${fator}-${index}`} variant="secondary" className="bg-white text-slate-600">
                          {fator}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {!!marketAnalysis.fontes?.length && (
                    <div className="space-y-2 rounded-lg border border-blue-100 bg-white/70 p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Imóveis comparáveis</p>
                      {marketAnalysis.fontes.slice(0, 4).map((fonte, index) => (
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
                  <p className="text-xs text-muted-foreground">
                    {marketAnalysis.observacao || "Estimativa por IA para triagem interna; não substitui laudo de avaliação."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {categoryKey === "land-bank" && asset.basicInfoAttachment && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <Paperclip className={`h-4 w-4 ${meta.accent}`} />
                  <h2 className="font-semibold text-foreground">Informações básicas</h2>
                </div>
                <a
                  href={asset.basicInfoAttachment.dataUrl}
                  download={asset.basicInfoAttachment.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {asset.basicInfoAttachment.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatFileSize(asset.basicInfoAttachment.size)}
                      </span>
                    </span>
                  </span>
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              </CardContent>
            </Card>
          )}

          {asset.can_review && (
            <Card className="border-blue-200">
              <CardContent className="space-y-4 p-5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold">Análise preliminar</h2>
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      {stageLabels[asset.estagio || "identificada"] || asset.estagio || "Identificada"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Administração ou Aliado da comunidade pode conduzir a triagem.</p>
                </div>
                {asset.observacao_analise && (
                  <div className="rounded-md border border-blue-100 bg-blue-50/60 p-3">
                    <p className="text-xs font-semibold uppercase text-blue-700">Último parecer registrado</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{asset.observacao_analise}</p>
                  </div>
                )}
                <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Registre parecer ou complementos necessários..." />
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    disabled={reviewMutation.isPending || asset.estagio === "em_analise"}
                    onClick={() => submitReviewStage("em_analise")}
                  >
                    {reviewMutation.isPending && reviewMutation.variables === "em_analise" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : asset.estagio === "em_analise" ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : null}
                    {asset.estagio === "em_analise" ? "Análise em andamento" : "Iniciar análise"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={reviewMutation.isPending || asset.estagio === "complementos_solicitados"}
                    onClick={() => submitReviewStage("complementos_solicitados")}
                  >
                    {reviewMutation.isPending && reviewMutation.variables === "complementos_solicitados" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : asset.estagio === "complementos_solicitados" ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : null}
                    {asset.estagio === "complementos_solicitados" ? "Complementos solicitados" : "Solicitar complementos"}
                  </Button>
                  <Button
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    disabled={reviewMutation.isPending || asset.estagio === "pre_viabilidade_aprovada"}
                    onClick={() => submitReviewStage("pre_viabilidade_aprovada")}
                  >
                    {reviewMutation.isPending && reviewMutation.variables === "pre_viabilidade_aprovada" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {asset.estagio === "pre_viabilidade_aprovada" ? "Pré-viabilidade aprovada" : "Aprovar pré-viabilidade"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {asset.can_edit && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div><h2 className="font-semibold">Estruturação da oportunidade</h2><p className="mt-1 text-xs text-muted-foreground">A BIA só pode ser solicitada após aprovação da pré-viabilidade.</p></div>
                {asset.can_request_bia ? (
                  <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" disabled={requestBiaMutation.isPending} onClick={() => requestBiaMutation.mutate()}>{requestBiaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Solicitar estruturação de BIA</Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Etapa atual: {stageLabels[asset.estagio || "identificada"] || asset.estagio}. Aguarde a análise ou complete os dados solicitados.</p>
                )}
              </CardContent>
            </Card>
          )}

          {asset.can_edit && asset.visibilidade === "publicada" && <AssetInterestsManager assetId={asset.id} />}

          {!asset.can_edit && <Card>
            <CardContent className="space-y-4 p-5">
              {myInterest ? (
                <>
                  <Button variant="outline" className="w-full gap-2 border-emerald-200 text-emerald-700" disabled>
                    <CheckCircle2 className="h-4 w-4" />
                    Interesse manifestado
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => removeInterestMutation.mutate()} disabled={removeInterestMutation.isPending}>
                    Remover interesse
                  </Button>
                </>
              ) : (
                <Button className="w-full gap-2 bg-blue-500 text-white hover:bg-blue-600" onClick={() => alliancesAccess.canAccess ? setInterestDialogOpen(true) : setMembershipDialogOpen(true)}>
                  <HandHeart className="h-4 w-4" />
                  Manifestar interesse
                </Button>
              )}
            </CardContent>
          </Card>}
        </div>
      </div>

      <Dialog open={interestDialogOpen} onOpenChange={setInterestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandHeart className={`h-5 w-5 ${meta.accent}`} />
              Manifestar interesse
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Envie uma breve mensagem sobre seu interesse neste ativo.
            </p>
            <Textarea
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              placeholder="Descreva seu interesse, proposta ou possível caminho para transformar este ativo em oportunidade..."
              className="min-h-28"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterestDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => interestMutation.mutate()} disabled={interestMutation.isPending}>{interestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar interesse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EnvironmentAccessDialog access={alliancesAccess} open={membershipDialogOpen} onOpenChange={setMembershipDialogOpen} />

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className={`h-5 w-5 ${meta.accent}`} />
              Editar ativo
            </DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={editForm.category} onValueChange={(value) => setEditField("category", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="land-bank">Land Bank</SelectItem>
                    <SelectItem value="built-asset-bank">Ativos Edificados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select value={editForm.origem_tipo || "origem_nao_informada"} onValueChange={(value) => setEditField("origem_tipo", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo_proprio">Ativo próprio</SelectItem>
                      <SelectItem value="terceiro_autorizado">Terceiro autorizado</SelectItem>
                      <SelectItem value="oportunidade_externa">Oportunidade externa</SelectItem>
                      <SelectItem value="origem_nao_informada">Origem não informada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibilidade</Label>
                  <Select value={editForm.visibilidade || "privada"} onValueChange={(value) => setEditField("visibilidade", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="privada">Privada</SelectItem><SelectItem value="publicada">Publicada</SelectItem><SelectItem value="pausada">Pausada</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={editForm.autorizacao_compartilhamento === true} onCheckedChange={(checked) => setEditField("autorizacao_compartilhamento", checked === true)} />
                <span className="text-sm leading-relaxed">Autorizo a análise e o compartilhamento do resumo desta oportunidade, mantendo dados privados protegidos.</span>
              </label>

              <div className="space-y-2">
                <Label>Foto do ativo</Label>
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:w-32">
                    {editForm.foto ? (
                      <img src={landBankPhotoUrl(editForm.foto) || ""} alt="Prévia do ativo" className="h-full w-full object-cover" />
                    ) : (
                      <Icon className={`h-8 w-8 ${meta.accent}`} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" asChild>
                      <label className="cursor-pointer">
                        Trocar foto
                        <input type="file" accept="image/*" className="hidden" onChange={(event) => handleEditPhoto(event.target.files?.[0])} />
                      </label>
                    </Button>
                    {editForm.foto && (
                      <Button type="button" variant="ghost" onClick={() => setEditField("foto", "")}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Qualificação</Label>
                  <Input value={editForm.qualificacao} onChange={(event) => setEditField("qualificacao", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Área (m²)</Label>
                  <Input value={editForm.area} onChange={(event) => setEditField("area", event.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input value={editForm.valor || ""} onChange={(event) => setEditField("valor", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Select value={editForm.moeda || "BRL"} onValueChange={(value) => setEditField("moeda", value)}>
                    <SelectTrigger>
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
                <Label>Descrição</Label>
                <Textarea value={editForm.descricao || ""} onChange={(event) => setEditField("descricao", event.target.value)} className="min-h-24" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={editForm.cep} onChange={(event) => setEditField("cep", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input value={editForm.endereco} onChange={(event) => setEditField("endereco", event.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nº</Label>
                  <Input value={editForm.numero} onChange={(event) => setEditField("numero", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={editForm.complemento} onChange={(event) => setEditField("complemento", event.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={editForm.bairro} onChange={(event) => setEditField("bairro", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={editForm.cidade} onChange={(event) => setEditField("cidade", event.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={editForm.estado} onChange={(event) => setEditField("estado", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>País</Label>
                  <Input value={editForm.pais} onChange={(event) => setEditField("pais", event.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {asset.qualificacao}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e removerá o ativo do Banco de Ativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAssetMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteAssetMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteAssetMutation.mutate();
              }}
            >
              {deleteAssetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir ativo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
