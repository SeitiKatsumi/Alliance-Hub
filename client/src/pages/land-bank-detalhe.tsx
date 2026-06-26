import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  HandHeart,
  MapPin,
  Ruler,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const landBankStorageKey = "built-land-bank-assets-v2";
const landBankInterestStorageKey = "built-land-bank-interesses-v1";

const categoryMeta = {
  "land-bank": {
    title: "Land Bank",
    description: "Terrenos, lotes, glebas e áreas com potencial de desenvolvimento.",
    icon: MapPin,
    accent: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  "built-asset-bank": {
    title: "Built Asset Bank",
    description: "Apartamentos, casas, salas, lojas, galpões, prédios e unidades já construídas.",
    icon: Briefcase,
    accent: "text-blue-500",
    bg: "bg-blue-50",
  },
  "transformation-bank": {
    title: "Transformation Bank",
    description: "Ativos que precisam de reforma, retrofit, conversão de uso, regularização ou reposicionamento.",
    icon: Target,
    accent: "text-violet-500",
    bg: "bg-violet-50",
  },
} as const;

type LandBankCategoryValue = keyof typeof categoryMeta;

interface LandBankAsset {
  id: string;
  category: LandBankCategoryValue;
  qualificacao: string;
  area: string;
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

export default function LandBankDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [interestDialogOpen, setInterestDialogOpen] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [interests, setInterests] = useState<LandBankInterest[]>(readInterests);

  const asset = useMemo(() => readAssets().find((item) => item.id === id) || null, [id]);
  const myInterest = interests.find((interest) => interest.assetId === id) || null;
  const meta = asset ? categoryMeta[asset.category] || categoryMeta["land-bank"] : categoryMeta["land-bank"];
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
      <Button variant="ghost" onClick={() => navigate(`/area-aliancas?tab=${asset.category}`)} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar para {meta.title}
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className={`flex h-72 items-center justify-center overflow-hidden ${meta.bg}`}>
              {asset.foto ? (
                <img src={asset.foto} alt={asset.qualificacao} className="h-full w-full object-cover" />
              ) : (
                <Icon className={`h-16 w-16 ${meta.accent}`} />
              )}
            </div>
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-blue-700">{meta.title}</Badge>
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
              <InfoRow label="Categoria" value={meta.title} />
            </CardContent>
          </Card>

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
                <Button className="w-full gap-2" onClick={() => setInterestDialogOpen(true)}>
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
    </div>
  );
}
