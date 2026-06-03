import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type AgendaStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";
type AgendaPrioridade = "baixa" | "media" | "alta";

interface AgendaTarefa {
  id: string;
  titulo: string;
  descricao?: string | null;
  data: string;
  hora?: string | null;
  status: AgendaStatus;
  prioridade: AgendaPrioridade;
  contexto_tipo?: string | null;
  contexto_id?: string | null;
  atribuido_por_user_id?: string | null;
  atribuido_por_nome?: string | null;
  compartilhada_com?: number;
}

interface MembroOption {
  id: string;
  nome?: string | null;
  Nome_de_usuario?: string | null;
  email?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  tipo_de_cadastro?: string | null;
  tipo_alianca?: string | null;
  tipos_alianca?: string[] | null;
  nucleo_alianca?: string | null;
  nucleos_alianca?: string[] | null;
}

interface BiaOption {
  id: string;
  nome_bia?: string | null;
  socios_guardioes?: string[] | string | null;
  socios_multiplicadores?: string[] | string | null;
}

const STATUS_LABEL: Record<AgendaStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const PRIORIDADE_LABEL: Record<AgendaPrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const STATUS_CLASS: Record<AgendaStatus, string> = {
  pendente: "border-blue-200 bg-blue-50 text-blue-700",
  em_andamento: "border-amber-200 bg-amber-50 text-amber-700",
  concluida: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelada: "border-slate-200 bg-slate-50 text-slate-600",
};

const PRIORIDADE_CLASS: Record<AgendaPrioridade, string> = {
  baixa: "border-slate-200 bg-slate-50 text-slate-600",
  media: "border-blue-200 bg-blue-50 text-blue-700",
  alta: "border-red-200 bg-red-50 text-red-700",
};

const hoje = new Date().toISOString().slice(0, 10);

const emptyForm = {
  titulo: "",
  descricao: "",
  data: hoje,
  hora: "",
  status: "pendente" as AgendaStatus,
  prioridade: "media" as AgendaPrioridade,
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupKey(tarefa: AgendaTarefa) {
  if (!tarefa.data) return "Sem data";
  return formatDate(tarefa.data);
}

function getMembroName(membro: MembroOption) {
  return membro.nome || membro.Nome_de_usuario || membro.email || "Membro BUILT";
}

function normalizeSearch(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseIdList(value?: string[] | string | null): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {}
  return String(value).split(",").map(id => id.trim()).filter(Boolean);
}

function membroSearchText(membro: MembroOption) {
  return [
    getMembroName(membro),
    membro.email,
    membro.empresa,
    membro.cargo,
    membro.tipo_de_cadastro,
    membro.tipo_alianca,
    ...(Array.isArray(membro.tipos_alianca) ? membro.tipos_alianca : []),
    membro.nucleo_alianca,
    ...(Array.isArray(membro.nucleos_alianca) ? membro.nucleos_alianca : []),
  ].filter(Boolean).join(" ");
}

export default function AgendaPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaTarefa | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgendaStatus | "todas">("todas");
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [form, setForm] = useState(emptyForm);
  const [selectedMembroIds, setSelectedMembroIds] = useState<string[]>([]);
  const [membroSearch, setMembroSearch] = useState("");
  const [selectedBiaId, setSelectedBiaId] = useState<string>("");

  const { data: tarefas = [], isLoading } = useQuery<AgendaTarefa[]>({
    queryKey: ["/api/agenda"],
  });

  const { data: membros = [] } = useQuery<MembroOption[]>({
    queryKey: ["/api/agenda/membros-disponiveis"],
  });

  const { data: bias = [] } = useQuery<BiaOption[]>({
    queryKey: ["/api/bias"],
  });

  const filtered = useMemo(() => {
    return tarefas.filter(tarefa => statusFilter === "todas" || tarefa.status === statusFilter);
  }, [tarefas, statusFilter]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, AgendaTarefa[]>>((acc, tarefa) => {
      const key = groupKey(tarefa);
      acc[key] ||= [];
      acc[key].push(tarefa);
      return acc;
    }, {});
  }, [filtered]);

  const counts = useMemo(() => {
    return tarefas.reduce<Record<AgendaStatus, number>>((acc, tarefa) => {
      acc[tarefa.status] = (acc[tarefa.status] || 0) + 1;
      return acc;
    }, { pendente: 0, em_andamento: 0, concluida: 0, cancelada: 0 });
  }, [tarefas]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());
    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = toDateKey(date);
      return {
        key,
        date,
        currentMonth: date.getMonth() === month,
        today: key === hoje,
        tarefas: filtered.filter(tarefa => tarefa.data === key),
      };
    });
    return days;
  }, [calendarMonth, filtered]);

  const calendarTitle = calendarMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  function changeCalendarMonth(offset: number) {
    setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  const selectedMembros = useMemo(() => {
    const map = new Map(membros.map(membro => [String(membro.id), membro]));
    return selectedMembroIds.map(id => map.get(id)).filter(Boolean) as MembroOption[];
  }, [membros, selectedMembroIds]);

  const membrosDisponiveis = useMemo(() => {
    return membros
      .filter(membro => membro.id && !selectedMembroIds.includes(String(membro.id)))
      .sort((a, b) => getMembroName(a).localeCompare(getMembroName(b), "pt-BR"));
  }, [membros, selectedMembroIds]);

  const membrosDisponiveisIds = useMemo(() => new Set(membrosDisponiveis.map(membro => String(membro.id))), [membrosDisponiveis]);

  const filteredMembrosDisponiveis = useMemo(() => {
    const q = normalizeSearch(membroSearch);
    const list = !q
      ? membrosDisponiveis
      : membrosDisponiveis.filter(membro => normalizeSearch(membroSearchText(membro)).includes(q));
    return list.slice(0, 8);
  }, [membrosDisponiveis, membroSearch]);

  const functionGroups = useMemo(() => {
    const groups = new Map<string, { label: string; ids: string[] }>();
    membrosDisponiveis.forEach(membro => {
      const labels = [
        membro.cargo,
        membro.tipo_de_cadastro,
        membro.tipo_alianca,
        ...(Array.isArray(membro.tipos_alianca) ? membro.tipos_alianca : []),
        membro.nucleo_alianca,
        ...(Array.isArray(membro.nucleos_alianca) ? membro.nucleos_alianca : []),
      ].filter(Boolean) as string[];
      labels.forEach(label => {
        const key = normalizeSearch(label);
        if (!key) return;
        const group = groups.get(key) || { label, ids: [] };
        group.ids.push(String(membro.id));
        groups.set(key, group);
      });
    });
    return Array.from(groups.values())
      .filter(group => group.ids.length > 0)
      .sort((a, b) => b.ids.length - a.ids.length || a.label.localeCompare(b.label, "pt-BR"))
      .slice(0, 8);
  }, [membrosDisponiveis]);

  const selectedBia = useMemo(() => bias.find(bia => String(bia.id) === selectedBiaId), [bias, selectedBiaId]);

  const biaGuardioesIds = useMemo(
    () => parseIdList(selectedBia?.socios_guardioes).filter(id => membrosDisponiveisIds.has(id)),
    [selectedBia, membrosDisponiveisIds]
  );

  const biaMultiplicadoresIds = useMemo(
    () => parseIdList(selectedBia?.socios_multiplicadores).filter(id => membrosDisponiveisIds.has(id)),
    [selectedBia, membrosDisponiveisIds]
  );

  function addMembroIds(ids: string[]) {
    const allowedIds = ids.map(String).filter(id => membros.some(membro => String(membro.id) === id));
    if (allowedIds.length === 0) return;
    setSelectedMembroIds(current => Array.from(new Set([...current, ...allowedIds])));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        hora: form.hora || null,
        descricao: form.descricao || null,
        membros_ids: editing ? [] : selectedMembroIds,
      };
      const response = editing
        ? await apiRequest("PATCH", `/api/agenda/${editing.id}`, payload)
        : await apiRequest("POST", "/api/agenda", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agenda"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setSelectedMembroIds([]);
      setMembroSearch("");
      setSelectedBiaId("");
      toast({ title: editing ? "Ação atualizada" : "Ação criada" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar ação", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AgendaStatus }) =>
      apiRequest("PATCH", `/api/agenda/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agenda"] }),
    onError: (error: any) => toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agenda/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agenda"] });
      toast({ title: "Ação removida" });
    },
    onError: (error: any) => toast({ title: "Erro ao remover ação", description: error.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setSelectedMembroIds([]);
    setMembroSearch("");
    setSelectedBiaId("");
    setDialogOpen(true);
  }

  function openEdit(tarefa: AgendaTarefa) {
    setEditing(tarefa);
    setForm({
      titulo: tarefa.titulo || "",
      descricao: tarefa.descricao || "",
      data: tarefa.data || hoje,
      hora: tarefa.hora || "",
      status: tarefa.status || "pendente",
      prioridade: tarefa.prioridade || "media",
    });
    setSelectedMembroIds([]);
    setMembroSearch("");
    setSelectedBiaId("");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.titulo.trim()) {
      toast({ title: "Título obrigatório", description: "Dê um nome para a ação.", variant: "destructive" });
      return;
    }
    if (!form.data) {
      toast({ title: "Data obrigatória", description: "Escolha uma data para a agenda.", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Início / Agenda</p>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-foreground">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <CalendarDays className="h-5 w-5" />
            </span>
            Agenda
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize ações, tarefas e acompanhamentos da sua rotina BUILT.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-blue-600 text-white hover:bg-blue-700" data-testid="btn-nova-acao-agenda">
          <Plus className="h-4 w-4" />
          Nova ação
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["pendente", "em_andamento", "concluida", "cancelada"] as AgendaStatus[]).map(status => (
          <Card key={status} className="border border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{counts[status] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Label className="text-xs font-semibold text-muted-foreground">Filtrar status</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AgendaStatus | "todas")}>
            <SelectTrigger className="w-full sm:w-56" data-testid="select-agenda-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 rounded-md border border-border/60 bg-muted/20 p-1 sm:w-fit" data-testid="agenda-view-mode">
          <button
            type="button"
            onClick={() => setViewMode("lista")}
            className={`inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition-colors ${
              viewMode === "lista" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="btn-agenda-lista"
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendario")}
            className={`inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition-colors ${
              viewMode === "calendario" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="btn-agenda-calendario"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendário
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          Carregando agenda...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-semibold text-foreground">Nenhuma ação encontrada</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie sua primeira tarefa para começar a organizar a agenda.</p>
        </div>
      ) : viewMode === "calendario" ? (
        <Card className="overflow-hidden border border-border/60">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Calendário</p>
                <h2 className="mt-1 text-lg font-bold capitalize text-foreground">{calendarTitle}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => changeCalendarMonth(-1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
                  Hoje
                </Button>
                <Button variant="outline" size="sm" onClick={() => changeCalendarMonth(1)} className="gap-1">
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30 text-center text-[11px] font-semibold uppercase text-muted-foreground">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
                <div key={day} className="px-1 py-2">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-7">
              {calendarDays.map(day => (
                <div
                  key={day.key}
                  className={`min-h-32 border-b border-border/60 p-2 sm:border-r ${
                    day.currentMonth ? "bg-background" : "bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                      day.today ? "bg-blue-600 text-white" : day.currentMonth ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {day.date.getDate()}
                    </span>
                    {day.tarefas.length > 0 && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        {day.tarefas.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {day.tarefas.slice(0, 3).map(tarefa => (
                      <button
                        key={tarefa.id}
                        type="button"
                        onClick={() => openEdit(tarefa)}
                        className={`w-full rounded border px-2 py-1 text-left text-[11px] leading-tight transition-colors hover:border-blue-300 ${STATUS_CLASS[tarefa.status]}`}
                        title={tarefa.titulo}
                      >
                        <span className="block truncate font-semibold">{tarefa.hora ? `${tarefa.hora} · ` : ""}{tarefa.titulo}</span>
                      </button>
                    ))}
                    {day.tarefas.length > 3 && (
                      <p className="px-1 text-[10px] font-semibold text-muted-foreground">+{day.tarefas.length - 3} ações</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <section key={dateLabel} className="space-y-2">
              <h2 className="text-sm font-bold text-foreground">{dateLabel}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map(tarefa => (
                  <Card key={tarefa.id} className="border border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={STATUS_CLASS[tarefa.status]}>{STATUS_LABEL[tarefa.status]}</Badge>
                            <Badge variant="outline" className={PRIORIDADE_CLASS[tarefa.prioridade]}>{PRIORIDADE_LABEL[tarefa.prioridade]}</Badge>
                            {tarefa.hora && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock3 className="h-3.5 w-3.5" />
                                {tarefa.hora}
                              </span>
                            )}
                          </div>
                          <p className="mt-3 break-words text-sm font-bold text-foreground">{tarefa.titulo}</p>
                          {(tarefa.atribuido_por_nome || (tarefa.compartilhada_com ?? 0) > 0) && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                              <Users className="h-3 w-3" />
                              Criada por {tarefa.atribuido_por_nome || "membro BUILT"}
                              {(tarefa.compartilhada_com ?? 0) > 0
                                ? ` · compartilhada com ${tarefa.compartilhada_com} ${tarefa.compartilhada_com === 1 ? "membro" : "membros"}`
                                : ""}
                            </p>
                          )}
                          {tarefa.descricao && (
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{tarefa.descricao}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => updateStatusMutation.mutate({ id: tarefa.id, status: tarefa.status === "concluida" ? "pendente" : "concluida" })}
                          title={tarefa.status === "concluida" ? "Reabrir" : "Concluir"}
                        >
                          {tarefa.status === "concluida" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5" />}
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(tarefa)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:text-red-700" onClick={() => deleteMutation.mutate(tarefa.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12">
            <DialogTitle>{editing ? "Editar ação" : "Nova ação"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: ligar para cliente, revisar proposta..." data-testid="input-agenda-titulo" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} data-testid="input-agenda-data" />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} data-testid="input-agenda-hora" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm(f => ({ ...f, status: value as AgendaStatus }))}>
                  <SelectTrigger data-testid="select-agenda-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(value) => setForm(f => ({ ...f, prioridade: value as AgendaPrioridade }))}>
                  <SelectTrigger data-testid="select-agenda-prioridade"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adicionar membros à ação</Label>
              {editing ? (
                <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Para preservar a agenda de cada pessoa, a inclusão de membros é feita ao criar uma nova ação.
                </p>
              ) : (
                <>
                  <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={membroSearch}
                        onChange={e => setMembroSearch(e.target.value)}
                        placeholder="Buscar por nome, empresa, cargo, função ou núcleo..."
                        className="pl-9"
                        data-testid="input-agenda-buscar-membro"
                      />
                    </div>

                    <div className="max-h-32 overflow-auto rounded-md border border-border/60 bg-background sm:max-h-40">
                      {filteredMembrosDisponiveis.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-muted-foreground">
                          {membroSearch ? "Nenhum membro encontrado." : "Nenhum membro disponível para adicionar."}
                        </p>
                      ) : (
                        filteredMembrosDisponiveis.map(membro => {
                          const memberId = String(membro.id);
                          const selected = selectedMembroIds.includes(memberId);
                          const subtitle = [membro.empresa, membro.cargo || membro.tipo_de_cadastro || membro.nucleo_alianca]
                            .filter(Boolean)
                            .join(" · ");
                          return (
                            <button
                              key={memberId}
                              type="button"
                              onClick={() => addMembroIds([memberId])}
                              disabled={selected}
                              className={`flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2 text-left transition-colors last:border-b-0 ${
                                selected ? "bg-blue-50 text-blue-700" : "hover:bg-muted/50"
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{getMembroName(membro)}</span>
                                {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
                              </span>
                              {selected && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {functionGroups.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">Adicionar por função</p>
                        <div className="flex flex-wrap gap-2">
                          {functionGroups.map(group => (
                            <Button
                              key={normalizeSearch(group.label)}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-full px-3 text-xs"
                              onClick={() => addMembroIds(group.ids)}
                            >
                              {group.label} ({group.ids.length})
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 rounded-md border border-border/60 bg-background p-3">
                      <Label className="text-xs">Adicionar membros de uma BIA</Label>
                      <Select
                        value={selectedBiaId || "__none__"}
                        onValueChange={(value) => setSelectedBiaId(value === "__none__" ? "" : value)}
                      >
                        <SelectTrigger data-testid="select-agenda-bia-grupos">
                          <SelectValue placeholder="Selecionar BIA..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Selecionar BIA...</SelectItem>
                          {bias.map(bia => (
                            <SelectItem key={bia.id} value={String(bia.id)}>
                              {bia.nome_bia || "BIA sem nome"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-start text-xs"
                          disabled={!selectedBia || biaGuardioesIds.length === 0}
                          onClick={() => addMembroIds(biaGuardioesIds)}
                        >
                          Sócios guardiões ({biaGuardioesIds.length})
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-start text-xs"
                          disabled={!selectedBia || biaMultiplicadoresIds.length === 0}
                          onClick={() => addMembroIds(biaMultiplicadoresIds)}
                        >
                          Sócios multiplicadores ({biaMultiplicadoresIds.length})
                        </Button>
                      </div>
                    </div>
                  </div>
                  {selectedMembros.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                          Selecionados ({selectedMembros.length})
                        </p>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedMembroIds([])}>
                          Limpar todos
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedMembros.map(membro => (
                          <span key={membro.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            <span className="truncate">{getMembroName(membro)}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedMembroIds(ids => ids.filter(id => id !== String(membro.id)))}
                              className="rounded-full p-0.5 hover:bg-blue-100"
                              aria-label={`Remover ${getMembroName(membro)}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Apenas membros da sua comunidade aparecem aqui. Superadmins podem escolher qualquer membro.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Cada membro selecionado receberá uma cópia independente na própria agenda.
                  </p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={4} placeholder="Detalhes, próximos passos ou contexto da ação..." data-testid="input-agenda-descricao" />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/60 bg-background px-5 py-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 bg-[#0f62fe] text-white hover:bg-[#004fd6]" data-testid="btn-salvar-agenda">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar alterações" : "Criar ação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
