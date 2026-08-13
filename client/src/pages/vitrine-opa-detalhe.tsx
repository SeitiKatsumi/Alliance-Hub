import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Building2, CheckCircle2, FileText, HandHeart, Loader2,
  MapPin, Sparkles, Target, UserCheck, Users, XCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EnvironmentAccessDialog, environmentAccessFor } from "@/components/environment-access";
import { useAuth } from "@/hooks/use-auth";
import { getTipoDisplayName } from "@/lib/ramos-segmentos";
import { getOpaPublicRef, resolveOpaByRef } from "@/lib/public-refs";

interface OportunidadePublica {
  id: string;
  nome_oportunidade?: string | null;
  tipo?: string | null;
  bia_id?: string | null;
  valor_origem_opa?: string | number | null;
  Minimo_esforco_multiplicador?: string | number | null;
  objetivo_alianca?: string | null;
  nucleo_alianca?: string | null;
  pais?: string | null;
  localizacao?: string | null;
  descricao?: string | null;
  perfil_aliado?: string | null;
  status?: string | null;
  date_created?: string | null;
  imagem_directus_id?: string | null;
  imagem_url?: string | null;
}

interface BiasPublica {
  id: string;
  codigo_publico?: string | null;
  nome_bia?: string | null;
  localizacao?: string | null;
  moeda?: string | null;
}

interface OpaInteresse {
  id: string;
  membro_nome?: string | null;
  mensagem?: string | null;
}

interface InteresseResponse {
  interesses: OpaInteresse[];
  meuInteresse: OpaInteresse | null;
  total: number;
}

const ASSET_CACHE_VERSION = "directus-db-20260616";

function directusAssetId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.id || value.uuid || value.directus_files_id || value.file || null;
  return String(value);
}

function versionAssetUrl(value?: any): string | null {
  if (!value) return null;
  if (typeof value === "string" && value.includes("/api/assets/")) {
    return `${value}${value.includes("?") ? "&" : "?"}v=${ASSET_CACHE_VERSION}`;
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  const assetId = directusAssetId(value);
  return assetId ? `/api/assets/${assetId}?v=${ASSET_CACHE_VERSION}` : null;
}

function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(",", ".")) || 0;
}

function brl(value: string | number | null | undefined, currency = "BRL"): string {
  const amount = num(value);
  if (!amount) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-blue-600" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function getOpaImage(opa?: OportunidadePublica | null) {
  if (!opa) return null;
  return versionAssetUrl(opa.imagem_url) || versionAssetUrl(opa.imagem_directus_id);
}

type OpaDetalheMode = "vitrine" | "capital";

export function VitrineOpaDetalhePage(props: any = {}) {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [interesseOpen, setInteresseOpen] = useState(false);
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const mode = props.mode || "vitrine";
  const isCapital = mode === "capital";
  const listPath = isCapital ? "/built-capital/chamadas" : "/vitrine/oportunidades/obas";
  const listLabel = isCapital ? "chamadas de capital" : "OBAs";
  const badgeLabel = isCapital ? "Chamada de capital" : "OBA pública";
  const endpoint = isCapital ? "/api/chamadas-capital" : "/api/oportunidades";

  const { data: opasRaw = [], isLoading } = useQuery<OportunidadePublica[]>({
    queryKey: [endpoint],
  });
  const { data: biasRaw = [] } = useQuery<BiasPublica[]>({
    queryKey: ["/api/bias"],
  });

  const opa = useMemo(
    () => resolveOpaByRef(opasRaw as OportunidadePublica[], biasRaw as BiasPublica[], id),
    [opasRaw, biasRaw, id]
  );
  const bia = useMemo(
    () => opa?.bia_id ? (biasRaw as BiasPublica[]).find((item) => item.id === opa.bia_id) : undefined,
    [biasRaw, opa]
  );

  useEffect(() => {
    if (!opa || !id) return;
    if (opa.bia_id && !bia) return;
    const publicRef = getOpaPublicRef(opa, bia, opasRaw as OportunidadePublica[]);
    const targetPath = isCapital ? `/built-capital/chamadas/${publicRef}` : `/vitrine/oportunidades/obas/${publicRef}`;
    if (publicRef && id !== publicRef) navigate(targetPath, { replace: true });
  }, [opa, bia, opasRaw, id, navigate, isCapital]);

  const alliancesAccess = environmentAccessFor(user, "alliances");
  const interesseQueryKey = ["/api/oportunidades", opa?.id, "interesse"] as const;
  const { data: interesseData } = useQuery<InteresseResponse>({
    queryKey: interesseQueryKey,
    queryFn: async () => {
      if (!opa?.id) throw new Error("OBA não encontrada");
      const response = await apiRequest("GET", `/api/oportunidades/${opa.id}/interesse`);
      return response.json();
    },
    enabled: !!opa?.id && alliancesAccess.canAccess,
  });

  const interesseMutation = useMutation({
    mutationFn: async () => {
      if (!opa?.id) throw new Error("OBA não encontrada");
      return apiRequest("POST", `/api/oportunidades/${opa.id}/interesse`, { mensagem: mensagem || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interesseQueryKey });
      setInteresseOpen(false);
      setMensagem("");
      toast({ title: "Interesse registrado!" });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível registrar interesse",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const removerInteresseMutation = useMutation({
    mutationFn: async () => {
      if (!opa?.id) throw new Error("OBA não encontrada");
      return apiRequest("DELETE", `/api/oportunidades/${opa.id}/interesse`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interesseQueryKey });
      toast({ title: "Interesse removido" });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!opa) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <p className="text-muted-foreground">{isCapital ? "Chamada de capital nao encontrada." : "Oportunidade nao encontrada."}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(listPath)}>
          Voltar para {listLabel}
        </Button>
      </div>
    );
  }

  const image = getOpaImage(opa);
  const valor = num(opa.valor_origem_opa);
  const mem = num(opa.Minimo_esforco_multiplicador);
  const jaInteressado = !!interesseData?.meuInteresse;
  const totalInteresses = interesseData?.total || 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-2 text-muted-foreground" onClick={() => navigate(listPath)}>
        <ArrowLeft className="h-4 w-4" />
        Voltar para {listLabel}
      </Button>

      <div className="overflow-hidden rounded-2xl border border-blue-200 bg-card shadow-sm">
        {image && <img src={image} alt={opa.nome_oportunidade || "OBA"} className="h-56 w-full object-cover" />}
        <div
          className="relative p-6"
          style={{ background: "radial-gradient(ellipse at 0% 50%, #001d34 0%, #000c1f 60%, #000408 100%)" }}
        >
          <div className="relative z-10">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-sm border border-blue-300/30 bg-blue-300/10 px-2 py-0.5 font-mono text-[9px] text-blue-100">
                {badgeLabel}
              </span>
              {opa.tipo && <Badge variant="secondary">{getTipoDisplayName(opa.tipo)}</Badge>}
              {opa.status && (
                <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">
                  {String(opa.status).replace(/_/g, " ")}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-blue-300">{opa.nome_oportunidade || (isCapital ? "Chamada sem nome" : "OBA sem nome")}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-blue-100/65">
              {opa.nucleo_alianca && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {opa.nucleo_alianca}
                </span>
              )}
              {(opa.localizacao || opa.pais) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {opa.localizacao || opa.pais}
                </span>
              )}
            </div>
            {opa.objetivo_alianca && (
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-blue-100/55">{opa.objetivo_alianca}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {valor > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{isCapital ? "Valor da chamada" : "Valor da OBA"}</p>
              <p className="mt-1 text-xl font-bold text-blue-600">{brl(valor, bia?.moeda || "BRL")}</p>
            </CardContent>
          </Card>
        )}
        {mem > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mínimo Esforço Multiplicador</p>
              <p className="mt-1 text-xl font-bold">{mem.toLocaleString("pt-BR")}%</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {bia && (
            <Card>
              <CardContent className="pt-5">
                <SectionTitle icon={Building2}>BIA vinculada</SectionTitle>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3">
                  <p className="text-sm font-semibold text-blue-700">{bia.nome_bia}</p>
                  {bia.localizacao && <p className="mt-1 text-xs text-muted-foreground">{bia.localizacao}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {opa.descricao && (
            <Card>
              <CardContent className="pt-5">
                <SectionTitle icon={FileText}>Descrição / Escopo</SectionTitle>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{opa.descricao}</p>
              </CardContent>
            </Card>
          )}

          {opa.perfil_aliado && (
            <Card>
              <CardContent className="pt-5">
                <SectionTitle icon={Users}>Perfil do parceiro esperado</SectionTitle>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{opa.perfil_aliado}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <SectionTitle icon={Target}>Informações</SectionTitle>
              <InfoRow label="Tipo" value={getTipoDisplayName(opa.tipo || "")} />
              <InfoRow label="Núcleo de aliança" value={opa.nucleo_alianca} />
              <InfoRow label="Localização" value={opa.localizacao || opa.pais} />
              {opa.date_created && (
                <InfoRow
                  label="Publicada em"
                  value={new Date(opa.date_created).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                />
              )}
            </CardContent>
          </Card>

          {!isCapital && <Card className={jaInteressado ? "border-blue-300" : ""}>
            <CardContent className="space-y-3 pt-5">
              <SectionTitle icon={HandHeart}>Interesse</SectionTitle>
              {jaInteressado ? (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium text-blue-700">Interesse registrado</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => removerInteresseMutation.mutate()}
                    disabled={removerInteresseMutation.isPending}
                  >
                    {removerInteresseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                    Cancelar interesse
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Para manifestar interesse, conclua sua adesão ao BUILT Alliances.
                  </p>
                  <Button
                    className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => {
                      if (!alliancesAccess.canAccess) {
                        setMembershipDialogOpen(true);
                        return;
                      }
                      setInteresseOpen(true);
                    }}
                  >
                    <HandHeart className="h-4 w-4" />
                    Manifestar interesse
                  </Button>
                </>
              )}
              {totalInteresses > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    {totalInteresses === 1 ? "1 membro interessado" : `${totalInteresses} membros interessados`}
                  </div>
                </>
              )}
            </CardContent>
          </Card>}
        </div>
      </div>

      <Dialog open={interesseOpen} onOpenChange={setInteresseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandHeart className="h-5 w-5 text-blue-600" />
              Manifestar interesse
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-700">{opa.nome_oportunidade}</p>
              {opa.nucleo_alianca && <p className="mt-1 text-xs text-muted-foreground">{opa.nucleo_alianca}</p>}
            </div>
            <Textarea
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              placeholder="Mensagem opcional para o responsável..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInteresseOpen(false)}>Cancelar</Button>
            <Button onClick={() => interesseMutation.mutate()} disabled={interesseMutation.isPending} className="bg-blue-600 text-white hover:bg-blue-700">
              {interesseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Enviar interesse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EnvironmentAccessDialog
        access={alliancesAccess}
        open={membershipDialogOpen}
        onOpenChange={setMembershipDialogOpen}
      />
    </div>
  );
}

export function BuiltCapitalChamadaDetalhePage() {
  return <VitrineOpaDetalhePage mode="capital" />;
}

export default VitrineOpaDetalhePage;
