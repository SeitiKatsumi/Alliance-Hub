import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Edit3, Loader2, Plus, RefreshCw, Send, Target } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import OpportunityCloseDialog from "@/components/opportunity-close-dialog";
import OpportunityDistributionControls from "@/components/opportunity-distribution-controls";

interface BiaDemand {
  id: string;
  codigo?: string | null;
  titulo: string;
  escopo?: string | null;
  resumo_publico?: string | null;
  urgencia: string;
  especialidades?: string[];
  status: string;
  visibilidade?: string;
  expira_em?: string | null;
  fluxo_disparo?: "imediato" | "gradual";
  responsavel_membro_id?: string | null;
  opa_id?: string | null;
  criado_em: string;
}

interface MemberOption {
  id: string;
  nome?: string;
  Nome_de_usuario?: string;
  nome_completo?: string;
}

interface DemandForm {
  titulo: string;
  descricao: string;
  resumo_publico: string;
  urgencia: string;
  especialidades: string;
  responsavel_membro_id: string;
  expira_em: string;
  fluxo_disparo: "imediato" | "gradual";
  publicar: boolean;
}

const emptyForm = (): DemandForm => ({
  titulo: "",
  descricao: "",
  resumo_publico: "",
  urgencia: "normal",
  especialidades: "",
  responsavel_membro_id: "",
  expira_em: "",
  fluxo_disparo: "imediato",
  publicar: false,
});

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  aberta: "Aberta",
  em_negociacao: "Em negociação",
  contratada: "Contratada",
  em_execucao: "Em execução",
  concluida: "Concluída",
  convertida: "Convertida",
  encerrada_sem_acordo: "Encerrada sem acordo",
  expirada: "Expirada",
  cancelada: "Cancelada",
  arquivada: "Arquivada",
};

const terminalStatuses = new Set(["concluida", "convertida", "encerrada_sem_acordo", "expirada", "cancelada", "arquivada"]);

function memberName(member: MemberOption) {
  return member.Nome_de_usuario || member.nome_completo || member.nome || "Membro BUILT";
}

function toForm(demand: BiaDemand): DemandForm {
  return {
    titulo: demand.titulo || "",
    descricao: demand.escopo || "",
    resumo_publico: demand.resumo_publico || "",
    urgencia: demand.urgencia || "normal",
    especialidades: (demand.especialidades || []).join(", "),
    responsavel_membro_id: demand.responsavel_membro_id || "",
    expira_em: demand.expira_em ? new Date(demand.expira_em).toISOString().slice(0, 10) : "",
    fluxo_disparo: demand.fluxo_disparo === "gradual" ? "gradual" : "imediato",
    publicar: demand.visibilidade === "publicada" || demand.visibilidade === "restrita",
  };
}

export default function BiaDemandas({ biaId, canEdit }: { biaId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BiaDemand | null>(null);
  const [closing, setClosing] = useState<BiaDemand | null>(null);
  const [form, setForm] = useState<DemandForm>(emptyForm);

  const demandsQuery = useQuery<BiaDemand[]>({
    queryKey: ["/api/bias", biaId, "demandas"],
    queryFn: async () => {
      const response = await fetch(`/api/bias/${biaId}/demandas`, { credentials: "include" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Não foi possível carregar as Demandas.");
      return response.json();
    },
  });
  const membersQuery = useQuery<MemberOption[]>({ queryKey: ["/api/membros"] });
  const members = useMemo(() => membersQuery.data || [], [membersQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        bia_id: biaId,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        resumo_publico: form.resumo_publico.trim() || form.descricao.trim() || null,
        urgencia: form.urgencia,
        especialidades: form.especialidades.split(",").map((item) => item.trim()).filter(Boolean),
        responsavel_membro_id: form.responsavel_membro_id || null,
        expira_em: form.expira_em ? new Date(`${form.expira_em}T23:59:59`).toISOString() : null,
        fluxo_disparo: form.fluxo_disparo,
        publicar: form.publicar,
        consentimento_publicacao: form.publicar,
      };
      const response = await apiRequest(editing ? "PATCH" : "POST", editing ? `/api/demandas/${editing.id}` : "/api/demandas", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bias", biaId, "demandas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
      toast({ title: editing ? "Demanda atualizada" : "Demanda criada" });
    },
    onError: (error: Error) => toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ demand, action }: { demand: BiaDemand; action: "publicar" | "pausar" | "retirar" | "renovar" }) => {
      const key = demand.codigo || demand.id;
      const endpoint = action === "renovar" ? `/api/rede/oportunidades/${key}/renovar` : `/api/rede/oportunidades/${key}/publicacao`;
      const response = await apiRequest("POST", endpoint, action === "renovar" ? { dias: 60 } : { action, consentimento_publicacao: action === "publicar" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bias", biaId, "demandas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      toast({ title: "Publicação atualizada" });
    },
    onError: (error: Error) => toast({ title: "Não foi possível atualizar", description: error.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: async (demand: BiaDemand) => {
      const response = await apiRequest("POST", `/api/rede/oportunidades/${demand.codigo || demand.id}/converter-oba`, { bia_id: biaId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bias", biaId, "demandas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      toast({ title: "OBA criada", description: "A Demanda foi encerrada como convertida e permaneceu no histórico." });
    },
    onError: (error: Error) => toast({ title: "Não foi possível converter", description: error.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };
  const openEdit = (demand: BiaDemand) => {
    setEditing(demand);
    setForm(toForm(demand));
    setDialogOpen(true);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Demandas da BIA</h2>
          <p className="mt-1 text-sm text-muted-foreground">Contratações de serviços cuja autora é esta BIA.</p>
        </div>
        {canEdit && <Button onClick={openNew} className="bg-blue-600 text-white hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" />Nova demanda</Button>}
      </div>

      {demandsQuery.isLoading ? (
        <div className="flex items-center justify-center border-y py-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando Demandas...</div>
      ) : !demandsQuery.data?.length ? (
        <div className="border-y py-12 text-center text-sm text-muted-foreground">Nenhuma Demanda criada por esta BIA.</div>
      ) : (
        <div className="divide-y border-y">
          {demandsQuery.data.map((demand) => {
            const editable = canEdit && !terminalStatuses.has(demand.status);
            return (
              <article key={demand.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <Target className="mt-1 h-5 w-5 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{demand.titulo}</h3>
                      <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">Demanda</Badge>
                      {demand.codigo && <Badge variant="outline" className="font-mono text-[10px]">{demand.codigo}</Badge>}
                      <Badge variant="outline">{statusLabels[demand.status] || demand.status}</Badge>
                      {demand.visibilidade === "publicada" && <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Na Vitrine</Badge>}
                      {demand.visibilidade === "restrita" && <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Disparo gradual</Badge>}
                    </div>
                    {demand.escopo && <p className="mt-1 text-sm text-muted-foreground">{demand.escopo}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Urgência {demand.urgencia}</span>
                      {demand.expira_em && <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Válida até {new Date(demand.expira_em).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                  {editable && <Button variant="outline" size="sm" onClick={() => openEdit(demand)}><Edit3 className="mr-2 h-4 w-4" />Editar</Button>}
                </div>
                {canEdit && (
                  <div className="ml-8 flex flex-wrap gap-2">
                    {demand.visibilidade === "publicada" ? (
                      <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate({ demand, action: "pausar" })}>Pausar publicação</Button>
                    ) : demand.visibilidade !== "restrita" && editable && (
                      <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate({ demand, action: "publicar" })}><Send className="mr-2 h-4 w-4" />Publicar agora</Button>
                    )}
                    {demand.visibilidade === "pausada" && <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate({ demand, action: "retirar" })}>Retirar da Vitrine</Button>}
                    {(demand.status === "expirada" || demand.status === "arquivada") && <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate({ demand, action: "renovar" })}><RefreshCw className="mr-2 h-4 w-4" />Renovar por 60 dias</Button>}
                    {editable && !demand.opa_id && <Button variant="outline" size="sm" onClick={() => convertMutation.mutate(demand)}>Converter em OBA</Button>}
                    {editable && <Button variant="outline" size="sm" onClick={() => setClosing(demand)}>Encerrar</Button>}
                  </div>
                )}
                {canEdit && demand.visibilidade === "restrita" && demand.codigo && <div className="ml-8"><OpportunityDistributionControls code={demand.codigo} onUpdated={() => demandsQuery.refetch()} /></div>}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Demanda" : "Nova Demanda da BIA"}</DialogTitle>
            <DialogDescription>Defina o serviço necessário. A BIA será registrada como autora e a pessoa logada como criadora.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Título</Label><Input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} placeholder="Ex.: Due diligence jurídica do imóvel" /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} placeholder="Descreva o resultado esperado, prazo e contexto." /></div>
            <div className="space-y-2"><Label>Resumo público</Label><Textarea value={form.resumo_publico} onChange={(event) => setForm({ ...form, resumo_publico: event.target.value })} placeholder="Informações suficientes para avaliar o interesse, sem dados privados." /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Urgência</Label><Select value={form.urgencia} onValueChange={(value) => setForm({ ...form, urgencia: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Validade</Label><Input type="date" value={form.expira_em} onChange={(event) => setForm({ ...form, expira_em: event.target.value })} /></div>
              <div className="space-y-2"><Label>Responsável</Label><Select value={form.responsavel_membro_id || "automatico"} onValueChange={(value) => setForm({ ...form, responsavel_membro_id: value === "automatico" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="automatico">Pessoa criadora</SelectItem>{members.map((member) => <SelectItem key={member.id} value={member.id}>{memberName(member)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Distribuição</Label><Select value={form.fluxo_disparo} onValueChange={(value: "imediato" | "gradual") => setForm({ ...form, fluxo_disparo: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="imediato">Vitrine geral imediatamente</SelectItem><SelectItem value="gradual">Fluxo territorial a cada 12h</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Especialidades</Label><Input value={form.especialidades} onChange={(event) => setForm({ ...form, especialidades: event.target.value })} placeholder="Jurídico, Engenharia, Avaliação..." /><p className="text-xs text-muted-foreground">Separe por vírgulas.</p></div>
            {!editing && <label className="flex items-start gap-3 rounded-md border p-3 text-sm"><Checkbox checked={form.publicar} onCheckedChange={(checked) => setForm({ ...form, publicar: checked === true })} /><span>Autorizo a publicação do resumo na rede. Endereço exato, documentos e contatos permanecem privados.</span></label>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button disabled={!form.titulo.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="bg-blue-600 text-white hover:bg-blue-700">{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Salvar alterações" : "Criar Demanda"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {closing && <OpportunityCloseDialog open opportunityCode={closing.codigo || closing.id} onOpenChange={(open) => !open && setClosing(null)} onSuccess={() => { setClosing(null); demandsQuery.refetch(); queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] }); }} />}
    </section>
  );
}
