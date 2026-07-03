import { useMemo, useState } from "react";
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
  Ruler,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { landBankPhotoUrl } from "@/lib/land-bank-assets";

const landBankStorageKey = "built-land-bank-assets-v2";
const landBankInterestStorageKey = "built-land-bank-interesses-v1";

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
}

interface LandBankInterest {
  assetId: string;
  mensagem: string;
  createdAt: string;
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

function readInterests(): LandBankInterest[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(landBankInterestStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeInterests(interests: LandBankInterest[]) {
  window.localStorage.setItem(landBankInterestStorageKey, JSON.stringify(interests));
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

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export default function LandBankDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [assets, setAssets] = useState<LandBankAsset[]>(readAssets);
  const [interestDialogOpen, setInterestDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<LandBankAsset | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [interests, setInterests] = useState<LandBankInterest[]>(readInterests);

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
  const myInterest = interests.find((interest) => interest.assetId === id) || null;
  const categoryKey = asset?.category === "transformation-bank" ? "built-asset-bank" : asset?.category;
  const meta = categoryKey ? categoryMeta[categoryKey as LandBankCategoryValue] || categoryMeta["land-bank"] : categoryMeta["land-bank"];
  const Icon = meta.icon;

  const registerInterest = () => {
    if (!asset) return;
    const next = [
      { assetId: asset.id, mensagem: mensagem.trim(), createdAt: new Date().toISOString() },
      ...interests.filter((interest) => interest.assetId !== asset.id),
    ];
    writeInterests(next);
    setInterests(next);
    setMensagem("");
    setInterestDialogOpen(false);
  };

  const removeInterest = () => {
    if (!asset) return;
    const next = interests.filter((interest) => interest.assetId !== asset.id);
    writeInterests(next);
    setInterests(next);
  };

  const openEditDialog = () => {
    if (!asset) return;
    setEditForm({ ...asset, category: asset.category === "transformation-bank" ? "built-asset-bank" : asset.category });
    setEditDialogOpen(true);
  };

  const setEditField = (field: keyof LandBankAsset, value: string) => {
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
        <Button variant="ghost" onClick={() => navigate("/area-aliancas?tab=landbank")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar para Land bank
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
        <Button variant="ghost" onClick={() => navigate(`/area-aliancas?tab=${asset.category}`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar para {meta.title}
        </Button>
        <Button variant="outline" onClick={openEditDialog} className="gap-2" data-testid="btn-editar-landbank">
          <Pencil className="h-4 w-4" />
          Editar ativo
        </Button>
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
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">ativo</Badge>
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
                <InfoRow label="Endereço" value={`${asset.endereco}, ${asset.numero}`} />
                <InfoRow label="Complemento" value={asset.complemento} />
                <InfoRow label="Bairro" value={asset.bairro} />
                <InfoRow label="Cidade" value={[asset.cidade, asset.estado].filter(Boolean).join(", ")} />
                <InfoRow label="País" value={asset.pais} />
                <InfoRow label="CEP" value={asset.cep} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <Ruler className={`h-4 w-4 ${meta.accent}`} />
                <h2 className="font-semibold text-foreground">Informações do ativo</h2>
              </div>
              <InfoRow label="Área" value={`${asset.area} m²`} />
              <InfoRow label="Valor" value={formatCurrency(asset.valor, asset.moeda || "BRL")} />
              <InfoRow label="Moeda" value={asset.moeda || "BRL"} />
              <InfoRow label="Categoria" value={meta.title} />
              <InfoRow label="BIA vinculada" value={asset.bia_nome} />
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

          <Card>
            <CardContent className="space-y-4 p-5">
              {myInterest ? (
                <>
                  <Button variant="outline" className="w-full gap-2 border-emerald-200 text-emerald-700" disabled>
                    <CheckCircle2 className="h-4 w-4" />
                    Interesse manifestado
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={removeInterest}>
                    Remover interesse
                  </Button>
                </>
              ) : (
                <Button className="w-full gap-2 bg-blue-500 text-white hover:bg-blue-600" onClick={() => setInterestDialogOpen(true)}>
                  <HandHeart className="h-4 w-4" />
                  Manifestar interesse
                </Button>
              )}
            </CardContent>
          </Card>
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
            <Button onClick={registerInterest}>Enviar interesse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
