import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowRight,
  ClipboardList,
  Clock3,
  GripVertical,
  Handshake,
  MessageSquare,
  Plus,
  Search,
  Target,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { OpaFormDialog } from "@/pages/oportunidades";

interface Opa {
  id: string;
  nome_oportunidade?: string | null;
  tipo?: string | null;
  bia?: string | null;
  bia_id?: string | null;
  valor_origem_opa?: string | number | null;
  Minimo_esforco_multiplicador?: string | number | null;
  nucleo_alianca?: string | null;
  perfil_aliado?: string | null;
  status?: string | null;
}

interface Bia {
  id: string;
  nome_bia?: string | null;
}

interface OpaInteresse {
  id: string;
  opa_id: string;
  user_id: string;
  membro_id?: string | null;
  membro_nome?: string | null;
  mensagem?: string | null;
  multiplicador?: string | null;
  status_crm?: CrmStatus | null;
  observacao_crm?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}

type CrmStatus =
  | "interesse_recebido"
  | "em_analise"
  | "em_tratativa"
  | "alianca_firmada"
  | "nao_selecionado"
  | "em_espera";

const CRM_STATUSES: Array<{
  value: CrmStatus;
  crm: string;
  membro: string;
  sentido: string;
  icon: ComponentType<{ className?: string }>;
  className: string;
}> = [
  {
    value: "interesse_recebido",
    crm: "Interesse Recebido",
    membro: "Interesse registrado",
    sentido: "Sua manifestação foi recebida.",
    icon: MessageSquare,
    className: "border-[#D7BB7D]/40 bg-[#D7BB7D]/10 text-[#9B7E36]",
  },
  {
    value: "em_analise",
    crm: "Em Análise",
    membro: "Em avaliação pela BIA",
    sentido: "A BIA está avaliando sua aderência.",
    icon: Search,
    className: "border-blue-500/30 bg-blue-500/10 text-blue-600",
  },
  {
    value: "em_tratativa",
    crm: "Em Tratativa",
    membro: "Em tratativa com a BIA",
    sentido: "Há conversa ativa ou negociação em andamento.",
    icon: Handshake,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  },
  {
    value: "alianca_firmada",
    crm: "Aliança Firmada",
    membro: "Aliança firmada",
    sentido: "O membro foi integrado formalmente à aliança.",
    icon: UserCheck,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  },
  {
    value: "nao_selecionado",
    crm: "Não Selecionado",
    membro: "Não selecionado nesta OPA",
    sentido: "A BIA não seguirá com ele nesta oportunidade específica.",
    icon: UserX,
    className: "border-red-500/30 bg-red-500/10 text-red-600",
  },
  {
    value: "em_espera",
    crm: "Em Espera",
    membro: "No radar da BIA",
    sentido: "O perfil pode ser considerado depois.",
    icon: Clock3,
    className: "border-slate-500/30 bg-slate-500/10 text-slate-600",
  },
];

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function money(value: unknown) {
  const numberValue = parseFloat(String(value ?? "0")) || 0;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numberValue);
}

function percent(value: unknown) {
  const numberValue = parseFloat(String(value ?? "0")) || 0;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(numberValue)}%`;
}

function getStatus(status?: string | null) {
  return CRM_STATUSES.find(item => item.value === status) || CRM_STATUSES[0];
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card className="border border-border/60">
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </CardContent>
    </Card>
  );
}

function KanbanClientCard({
  interesse,
  onDragStart,
}: {
  interesse: OpaInteresse;
  onDragStart: (interesseId: string) => void;
}) {
  const [, navigate] = useLocation();
  const status = getStatus(interesse.status_crm);

  return (
    <Card
      className="cursor-grab border border-border/60 bg-background shadow-sm active:cursor-grabbing"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", interesse.id);
        onDragStart(interesse.id);
      }}
      data-testid={`card-kanban-interesse-${interesse.id}`}
    >
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-foreground">{interesse.membro_nome || "Membro sem nome"}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatDate(interesse.criado_em)}
              {interesse.multiplicador ? ` · ${percent(interesse.multiplicador)}` : ""}
            </p>
          </div>
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        </div>

        {interesse.mensagem && (
          <div className="rounded-md border border-border/60 bg-muted/20 p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mensagem</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-foreground">{interesse.mensagem}</p>
          </div>
        )}

        <div className="space-y-2">
          <Badge variant="outline" className={`w-fit text-[10px] ${status.className}`}>
            {status.membro}
          </Badge>
          {interesse.observacao_crm && (
            <p className="line-clamp-2 rounded-md bg-muted/25 px-2 py-1.5 text-[11px] text-muted-foreground">
              {interesse.observacao_crm}
            </p>
          )}
        </div>

        {interesse.membro_id && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full"
            onClick={() => navigate(`/membro/${interesse.membro_id}`)}
            data-testid={`btn-abrir-membro-${interesse.id}`}
          >
            Abrir perfil
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function GestaoOpasPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedOpaId, setSelectedOpaId] = useState("");
  const [busca, setBusca] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<CrmStatus | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpa, setEditingOpa] = useState<Opa | null>(null);

  const { data: opas = [], isLoading: loadingOpas } = useQuery<Opa[]>({
    queryKey: ["/api/oportunidades"],
  });

  const { data: bias = [] } = useQuery<Bia[]>({
    queryKey: ["/api/bias"],
  });

  const selectedOpa = useMemo(
    () => opas.find(opa => opa.id === selectedOpaId) || null,
    [opas, selectedOpaId],
  );

  const { data: interesseData, isLoading: loadingInteresses } = useQuery<{
    interesses: OpaInteresse[];
    total: number;
  }>({
    queryKey: ["/api/oportunidades", selectedOpaId, "interesse"],
    queryFn: async () => {
      const res = await fetch(`/api/oportunidades/${selectedOpaId}/interesse`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!selectedOpaId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ interesse, status, observacao }: { interesse: OpaInteresse; status: CrmStatus; observacao: string }) => {
      const response = await apiRequest("PATCH", `/api/oportunidades/${selectedOpaId}/interesse/${interesse.id}`, {
        status_crm: status,
        observacao_crm: observacao,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades", selectedOpaId, "interesse"] });
      toast({ title: "Manifestação atualizada" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar manifestação", description: error.message, variant: "destructive" });
    },
  });

  const biaMap = useMemo(() => {
    const map = new Map<string, string>();
    bias.forEach(item => map.set(item.id, item.nome_bia || "BIA sem nome"));
    return map;
  }, [bias]);

  const interesses = interesseData?.interesses || [];

  const interessesFiltrados = useMemo(() => {
    const termo = normalize(busca);
    return interesses.filter(interesse => {
      if (!termo) return true;
      return normalize([
        interesse.membro_nome,
        interesse.mensagem,
        interesse.multiplicador,
        interesse.observacao_crm,
      ].join(" ")).includes(termo);
    });
  }, [interesses, busca]);

  const grouped = useMemo(() => {
    const groups = CRM_STATUSES.reduce<Record<CrmStatus, OpaInteresse[]>>((acc, item) => {
      acc[item.value] = [];
      return acc;
    }, {} as Record<CrmStatus, OpaInteresse[]>);

    interessesFiltrados.forEach(interesse => {
      const status = (interesse.status_crm || "interesse_recebido") as CrmStatus;
      groups[status]?.push(interesse);
    });

    return groups;
  }, [interessesFiltrados]);

  const counts = CRM_STATUSES.reduce<Record<CrmStatus, number>>((acc, item) => {
    acc[item.value] = interesses.filter(interesse => (interesse.status_crm || "interesse_recebido") === item.value).length;
    return acc;
  }, {} as Record<CrmStatus, number>);

  const biaId = selectedOpa ? String(selectedOpa.bia || selectedOpa.bia_id || "") : "";

  function handleDrop(status: CrmStatus, droppedId?: string) {
    const interesseId = droppedId || draggedId;
    setDragOverStatus(null);
    setDraggedId(null);
    if (!interesseId) return;

    const interesse = interesses.find(item => item.id === interesseId);
    if (!interesse) return;
    const currentStatus = (interesse.status_crm || "interesse_recebido") as CrmStatus;
    if (currentStatus === status) return;

    updateMutation.mutate({
      interesse,
      status,
      observacao: interesse.observacao_crm || "",
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-[1500px] mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D7BB7D]/20 text-[#D7BB7D]">
              <ClipboardList className="w-5 h-5" />
            </span>
            Gestão OPAs
          </h1>
          <p className="text-sm text-muted-foreground">
            CRM em colunas para gerir as manifestações de interesse recebidas em cada OPA.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingOpa(null);
            setFormOpen(true);
          }}
          className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90 font-semibold"
          data-testid="btn-nova-opa-gestao"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova OPA
        </Button>
      </div>

      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-[#D7BB7D]" />
            Selecionar OPA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedOpaId || undefined} onValueChange={setSelectedOpaId}>
            <SelectTrigger data-testid="select-opa-gestao-opas">
              <SelectValue placeholder={loadingOpas ? "Carregando OPAs..." : "Selecione uma OPA para gerenciar as manifestações"} />
            </SelectTrigger>
            <SelectContent>
              {opas.map(opa => (
                <SelectItem key={opa.id} value={opa.id}>
                  {opa.nome_oportunidade || "OPA sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedOpa && (
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedOpa.nome_oportunidade || "OPA sem nome"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{biaMap.get(biaId) || "BIA não vinculada"}</p>
                </div>
                <div className="flex items-center gap-2 md:ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingOpa(selectedOpa);
                      setFormOpen(true);
                    }}
                    data-testid={`btn-editar-opa-gestao-${selectedOpa.id}`}
                  >
                    Editar OPA
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/opas/${selectedOpa.id}`)}>
                    Abrir OPA
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedOpa.tipo && <Badge variant="outline" className="text-[10px] border-[#D7BB7D]/40 text-[#9B7E36]">{selectedOpa.tipo}</Badge>}
                {selectedOpa.nucleo_alianca && <Badge variant="outline" className="text-[10px]">{selectedOpa.nucleo_alianca}</Badge>}
                <Badge variant="outline" className="text-[10px]">{money(selectedOpa.valor_origem_opa)}</Badge>
                <Badge variant="outline" className="text-[10px]">Min. {percent(selectedOpa.Minimo_esforco_multiplicador)}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedOpaId ? (
        <Card className="border border-dashed border-border/60">
          <CardContent className="p-10 text-center">
            <Target className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Selecione uma OPA para iniciar a gestão.</p>
            <p className="text-xs text-muted-foreground mt-1">Depois da seleção, as manifestações dos usuários aparecem em colunas.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Manifestações" value={interesses.length} hint="interesses registrados nesta OPA" />
            <StatCard label="Em Tratativa" value={counts.em_tratativa} hint="conversas em andamento" />
            <StatCard label="Alianças Firmadas" value={counts.alianca_firmada} hint="membros integrados" />
            <StatCard label="Em Espera" value={counts.em_espera} hint="perfis mantidos no radar" />
          </div>

          <Card className="border border-border/60">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-base">Manifestações de interesse</CardTitle>
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={event => setBusca(event.target.value)}
                    placeholder="Buscar cliente, mensagem ou observacao..."
                    className="pl-9"
                    data-testid="input-buscar-manifestacoes-opa"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingInteresses ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-80 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex gap-4 overflow-x-auto pb-3">
                    {CRM_STATUSES.map(status => {
                      const Icon = status.icon;
                      const items = grouped[status.value] || [];
                      const isDragOver = dragOverStatus === status.value;

                      return (
                        <section
                          key={status.value}
                          className={`min-h-[520px] w-[290px] shrink-0 rounded-lg border bg-muted/15 p-3 transition-colors ${
                            isDragOver ? "border-[#D7BB7D] bg-[#D7BB7D]/10" : "border-border/60"
                          }`}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setDragOverStatus(status.value);
                          }}
                          onDragLeave={() => setDragOverStatus(null)}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleDrop(status.value, event.dataTransfer.getData("text/plain"));
                          }}
                          data-testid={`kanban-coluna-${status.value}`}
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-[#D7BB7D]" />
                              <div>
                                <p className="text-xs font-semibold text-foreground">{status.crm}</p>
                                <p className="text-[10px] text-muted-foreground">{status.membro}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                          </div>

                          <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
                            {items.length === 0 ? (
                              <div className="rounded-md border border-dashed border-border/60 p-5 text-center">
                                <p className="text-[11px] text-muted-foreground">Arraste cards para cá</p>
                              </div>
                            ) : (
                              items.map(interesse => (
                                <KanbanClientCard
                                  key={interesse.id}
                                  interesse={interesse}
                                  onDragStart={setDraggedId}
                                />
                              ))
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <OpaFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingOpa(null);
        }}
        opa={editingOpa as any}
        bias={bias as any}
      />
    </div>
  );
}
