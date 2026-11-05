import { useEffect, useMemo, useState } from "react";
import {useSearch, useLocation} from 'wouter';
import { agendaSourceAction, agendaTaskTitle } from "@shared/agenda-action";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  BarChart3,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AGENDA_HOURS,
  DEFAULT_AGENDA_VIEW_MODE,
  agendaHourFromTime,
  buildAgendaWeek,
  buildAgendaMonth,
  formatAgendaWeekTitle,
  toAgendaDateKey,
  type AgendaCalendarDisplay,
  type AgendaViewMode,
} from "@/lib/agenda-calendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateAgendaAlertQueries } from "@/lib/agenda-alerts";
import { GoogleCalendarConnection, type GoogleCalendarEntry } from '@/components/google-calendar-connection';

type AgendaStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";
type AgendaPrioridade = "baixa" | "media" | "alta";

interface AgendaTarefa {
  google_event?: boolean;
  google_url?: string;
  origem_tarefa_id?: string | null;
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
  pendente: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  em_andamento: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  concluida: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  cancelada: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300",
};

const PRIORIDADE_CLASS: Record<AgendaPrioridade, string> = {
  baixa: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300",
  media: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  alta: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200",
};

const hoje = toAgendaDateKey(new Date());

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

export default function AgendaPage({ embedded = false }: { embedded?: boolean }) {
  const [, navigate] = useLocation();
  const taskId=new URLSearchParams(useSearch()).get('task');
  const [openedTask,setOpenedTask]=useState<string|null>(null);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaTarefa | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgendaStatus | "todas">("todas");
  const [viewMode, setViewMode] = useState<AgendaViewMode>(DEFAULT_AGENDA_VIEW_MODE);
  const [calendarDisplay, setCalendarDisplay] = useState<AgendaCalendarDisplay>("mes");
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  });
  const [form, setForm] = useState(emptyForm);
  const [selectedMembroIds, setSelectedMembroIds] = useState<string[]>([]);
  const [membroSearch, setMembroSearch] = useState("");
  const [selectedBiaId, setSelectedBiaId] = useState<string>("");
  const [googleEntries, setGoogleEntries] = useState<GoogleCalendarEntry[]>([]);
  const monthDays = useMemo(() => buildAgendaMonth(calendarCursor), [calendarCursor]);
  const googleFrom = monthDays[0].key;
  const googleEnd = monthDays[monthDays.length - 1].date;
  const googleTo = toAgendaDateKey(new Date(googleEnd.getFullYear(), googleEnd.getMonth(), googleEnd.getDate() + 1));

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
    const own = tarefas.filter(tarefa => statusFilter === "todas" || tarefa.status === statusFilter);
    return [...own, ...(statusFilter === 'todas' ? googleEntries : [])].sort((a, b) => a.data.localeCompare(b.data) || String(a.hora || '').localeCompare(String(b.hora || '')));
  }, [tarefas, statusFilter, googleEntries]);

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
    const month = calendarCursor.getMonth();
    const days = monthDays.map(({date, key}) => {
      return {
        key,
        date,
        currentMonth: date.getMonth() === month,
        today: key === hoje,
        tarefas: filtered.filter(tarefa => tarefa.data === key),
      };
    });
    return days;
  }, [calendarCursor, monthDays, filtered]);

  const weekDays = useMemo(() => buildAgendaWeek(calendarCursor).map((day) => ({
    ...day,
    today: day.key === hoje,
    tarefas: filtered.filter((tarefa) => tarefa.data === day.key),
  })), [calendarCursor, filtered]);

  const calendarTitle = calendarDisplay === "mes"
    ? calendarCursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : formatAgendaWeekTitle(calendarCursor);

  function changeCalendarPeriod(offset: number) {
    setCalendarCursor((current) => calendarDisplay === "mes"
      ? new Date(current.getFullYear(), current.getMonth() + offset, 1)
      : new Date(current.getFullYear(), current.getMonth(), current.getDate() + offset * 7));
  }

  function goToToday() {
    const current = new Date();
    setCalendarCursor(new Date(current.getFullYear(), current.getMonth(), current.getDate()));
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
      invalidateAgendaAlertQueries(queryClient);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agenda"] });
      invalidateAgendaAlertQueries(queryClient);
    },
    onError: (error: any) => toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agenda/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agenda"] });
      invalidateAgendaAlertQueries(queryClient);
      toast({ title: "Ação removida" });
    },
    onError: (error: any) => toast({ title: "Erro ao remover ação", description: error.message, variant: "destructive" }),
  });

  function openCreateAt(data = hoje, hora = "") {
    setEditing(null);
    setForm({ ...emptyForm, data, hora });
    setSelectedMembroIds([]);
    setMembroSearch("");
    setSelectedBiaId("");
    setDialogOpen(true);
  }

  function openCreate() {
    openCreateAt();
  }

  function openEdit(tarefa: AgendaTarefa) {
    if (tarefa.google_event) { openAction(tarefa); return; }
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

  function openAction(tarefa: AgendaTarefa) {
    if (tarefa.google_event) {
      if (tarefa.google_url) window.open(tarefa.google_url, '_blank', 'noopener,noreferrer');
      else toast({ title: tarefa.titulo, description: 'Este evento pode ser consultado na sua conta Google Agenda.' });
      return;
    }
    const action = agendaSourceAction(tarefa);
    if (action) navigate(action.href);
    else openEdit(tarefa);
  }

  useEffect(()=>{
    const task=tarefas.find(t=>t.id===taskId);
    if(!task||openedTask===taskId)return;
    const date=new Date(task.data+'T12:00:00');
    if(!Number.isNaN(date.getTime()))setCalendarCursor(date);
    setViewMode(DEFAULT_AGENDA_VIEW_MODE);openAction(task);setOpenedTask(taskId);
  },[taskId,tarefas,openedTask]);

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
    <div className={embedded ? "space-y-0" : "mx-auto max-w-7xl space-y-5 p-4 sm:p-6"}>
      {!embedded && <header className="mb-5">
        <p className="text-xs text-muted-foreground">Início / Agenda</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Agenda</h1>
      </header>}

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card" data-testid="agenda-workspace">
        <header className="space-y-3 border-b border-border/60 p-3 sm:p-4" data-testid="agenda-calendar-toolbar">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" onClick={() => changeCalendarPeriod(-1)} aria-label="Anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-0 text-sm font-bold text-foreground first-letter:uppercase sm:text-xl">{calendarTitle}</h2>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" onClick={() => changeCalendarPeriod(1)} aria-label="Próximo">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs sm:h-9 sm:px-3" onClick={goToToday}>Hoje</Button>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <Button variant="outline" className="gap-1 px-2 text-xs sm:gap-2 sm:px-4 sm:text-sm" onClick={() => setDashboardOpen(true)} data-testid="btn-agenda-dashboard">
                <BarChart3 className="hidden h-4 w-4 sm:block" />Dashboard
              </Button>
              <GoogleCalendarConnection compact from={googleFrom} to={googleTo} onEventsChange={setGoogleEntries} />
              <Button onClick={openCreate} className="gap-1 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700 sm:gap-2 sm:px-4 sm:text-sm" data-testid="btn-nova-acao-agenda">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />Nova ação
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
            <div className="flex rounded-md border border-border/60 bg-muted/20 p-1" data-testid="agenda-view-mode">
              <div className="flex" data-testid="agenda-calendar-display">
                {(["mes", "semana"] as const).map(display => (
                  <button key={display} type="button" onClick={() => { setCalendarDisplay(display); setViewMode("calendario"); }}
                    aria-pressed={viewMode === "calendario" && calendarDisplay === display}
                    className={`rounded px-2 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${viewMode === "calendario" && calendarDisplay === display ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid={`btn-agenda-${display}`}>
                    {display === "mes" ? "Mês" : "Semana"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setViewMode("lista")} aria-pressed={viewMode === "lista"}
                className={`rounded px-2 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${viewMode === "lista" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="btn-agenda-lista">Lista</button>
            </div>
            <div className="min-w-0 border-l border-border/60 pl-2 sm:pl-3">
              <Label htmlFor="agenda-status-filter" className="sr-only">Filtrar status</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AgendaStatus | "todas")}>
                <SelectTrigger id="agenda-status-filter" className="h-9 w-24 sm:w-36" data-testid="select-agenda-status-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluídas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground" role="status">Carregando agenda...</div>
      ) : viewMode === "calendario" ? (
        <>
            {calendarDisplay === "mes" ? (
              <div className="overflow-x-auto" data-testid="agenda-month-calendar">
                <div className="min-w-0">
                  <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
                      <div key={day} className="px-1 py-2">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7" style={{ minHeight: "calc(100dvh - 475px)" }}>
                    {calendarDays.map(day => (
                      <div
                        key={day.key}
                        onClick={() => openCreateAt(day.key)}
                        className={`group min-h-24 min-w-0 cursor-pointer border-b border-r border-border/60 p-1 sm:min-h-20 sm:p-2 transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20 ${
                          day.today ? "bg-blue-50/60 dark:bg-blue-950/20" : day.currentMonth ? "bg-background" : "bg-muted/20 text-muted-foreground"
                        }`}
                        data-testid={`agenda-month-day-${day.key}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-0.5">
                          <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                            day.today ? "bg-blue-600 text-white" : day.currentMonth ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {day.date.getDate()}
                          </span>
                          <span className="flex items-center gap-1">
                            {day.tarefas.length > 0 && (
                              <span className="hidden rounded-full bg-blue-50 px-2 py-0.5 sm:inline-block text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
                                {day.tarefas.length}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); openCreateAt(day.key); }}
                              className="hidden h-6 w-6 place-items-center rounded text-muted-foreground opacity-0 sm:grid transition-opacity hover:bg-blue-100 hover:text-blue-700 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-blue-950 dark:hover:text-blue-200"
                              aria-label={`Criar ação em ${formatDate(day.key)}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </div>
                        <div className="space-y-1">
                          {day.tarefas.slice(0, 3).map(tarefa => (
                            <button
                              key={tarefa.id}
                              type="button"
                              onClick={(event) => { event.stopPropagation(); openAction(tarefa); }}
                              className={`w-full rounded border px-2 py-1 text-left text-[11px] leading-tight transition-colors hover:border-blue-300 ${STATUS_CLASS[tarefa.status]}`}
                              title={agendaTaskTitle(tarefa)}
                            >
                              <span className="block truncate font-semibold"><span className="hidden sm:inline">{tarefa.hora ? `${String(tarefa.hora).slice(0, 5)} · ` : ""}</span>{agendaTaskTitle(tarefa)}</span>
                            </button>
                          ))}
                          {day.tarefas.length > 3 && (
                            <p className="px-1 text-[10px] font-semibold text-muted-foreground">+{day.tarefas.length - 3} ações</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-auto" data-testid="agenda-week-calendar">
                <div className="min-w-[920px]">
                  <div className="sticky top-0 z-30 grid grid-cols-[4.5rem_repeat(7,minmax(7.5rem,1fr))] border-b border-border/60 bg-card">
                    <div className="sticky left-0 z-40 border-r border-border/60 bg-card" />
                    {weekDays.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => openCreateAt(day.key)}
                        className="border-r border-border/60 px-2 py-3 text-center hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                      >
                        <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                          {day.date.toLocaleDateString("pt-BR", { weekday: "short" })}
                        </span>
                        <span className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${day.today ? "bg-blue-600 text-white" : "text-foreground"}`}>
                          {day.date.getDate()}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-[4.5rem_repeat(7,minmax(7.5rem,1fr))] border-b border-border/60 bg-muted/10">
                    <div className="sticky left-0 z-20 border-r border-border/60 bg-card px-2 py-2 text-right text-[10px] font-semibold uppercase text-muted-foreground">Dia todo</div>
                    {weekDays.map((day) => {
                      const allDayTasks = day.tarefas.filter((tarefa) => agendaHourFromTime(tarefa.hora) === null);
                      return (
                        <div key={day.key} className="min-h-12 space-y-1 border-r border-border/60 p-1">
                          <button type="button" onClick={() => openCreateAt(day.key)} className="w-full rounded py-1 text-[10px] text-muted-foreground hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-200">
                            + Nova ação
                          </button>
                          {allDayTasks.map((tarefa) => (
                            <button key={tarefa.id} type="button" onClick={() => openAction(tarefa)} className={`w-full rounded border px-1.5 py-1 text-left text-[10px] font-semibold ${STATUS_CLASS[tarefa.status]}`} title={agendaTaskTitle(tarefa)}>
                              <span className="block truncate">{agendaTaskTitle(tarefa)}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  {AGENDA_HOURS.map((hourLabel, hour) => (
                    <div key={hourLabel} className="grid grid-cols-[4.5rem_repeat(7,minmax(7.5rem,1fr))] border-b border-border/60">
                      <div className="sticky left-0 z-20 min-h-16 border-r border-border/60 bg-card px-2 pt-1 text-right text-[10px] font-medium text-muted-foreground">
                        {hourLabel}
                      </div>
                      {weekDays.map((day) => {
                        const slotTasks = day.tarefas.filter((tarefa) => agendaHourFromTime(tarefa.hora) === hour);
                        return (
                          <div key={`${day.key}-${hourLabel}`} className="group relative min-h-16 border-r border-border/60">
                            <button
                              type="button"
                              onClick={() => openCreateAt(day.key, hourLabel)}
                              className="absolute inset-0 z-0 flex items-start justify-end p-1 text-muted-foreground/0 hover:bg-blue-50/50 hover:text-blue-600 focus:text-blue-600 dark:hover:bg-blue-950/20 dark:hover:text-blue-300"
                              aria-label={`Criar ação em ${formatDate(day.key)} às ${hourLabel}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <div className="pointer-events-none relative z-10 space-y-1 p-1">
                              {slotTasks.map((tarefa) => (
                                <button
                                  key={tarefa.id}
                                  type="button"
                                  onClick={() => openAction(tarefa)}
                                  className={`pointer-events-auto w-full rounded border px-1.5 py-1 text-left text-[10px] leading-tight shadow-sm ${STATUS_CLASS[tarefa.status]}`}
                                  title={`${String(tarefa.hora || "").slice(0, 5)} · ${agendaTaskTitle(tarefa)}`}
                                >
                                  <span className="block truncate font-bold">{String(tarefa.hora || "").slice(0, 5)}</span>
                                  <span className="block truncate font-semibold">{agendaTaskTitle(tarefa)}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-semibold text-foreground">Nenhuma ação encontrada</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie sua primeira tarefa para começar a organizar a agenda.</p>
        </div>
      ) : (
        <div className="space-y-4 p-3 sm:p-4">
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
                            {tarefa.google_event ? <Badge variant="outline">Google Agenda</Badge> : <>
                              <Badge variant="outline" className={STATUS_CLASS[tarefa.status]}>{STATUS_LABEL[tarefa.status]}</Badge>
                              <Badge variant="outline" className={PRIORIDADE_CLASS[tarefa.prioridade]}>{PRIORIDADE_LABEL[tarefa.prioridade]}</Badge>
                            </>}
                            {tarefa.hora && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock3 className="h-3.5 w-3.5" />
                                {tarefa.hora}
                              </span>
                            )}
                          </div>
                          <p className="mt-3 break-words text-sm font-bold text-foreground">{agendaTaskTitle(tarefa)}</p>
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
                          {agendaSourceAction(tarefa) && <a className="mt-2 inline-block text-xs text-primary underline" href={agendaSourceAction(tarefa)!.href}>{agendaSourceAction(tarefa)!.label}</a>}
                        </div>
                        {!tarefa.google_event && <button
                          type="button"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => updateStatusMutation.mutate({ id: tarefa.id, status: tarefa.status === "concluida" ? "pendente" : "concluida" })}
                          title={tarefa.status === "concluida" ? "Reabrir" : "Concluir"}
                        >
                          {tarefa.status === "concluida" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5" />}
                        </button>}
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        {tarefa.google_event ? <Button variant="outline" size="sm" onClick={() => openAction(tarefa)}>Abrir no Google Agenda</Button> : <>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(tarefa)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:text-red-700" onClick={() => deleteMutation.mutate(tarefa.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </Button>
                        </>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      </div>

      <Dialog open={dashboardOpen} onOpenChange={setDashboardOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Dashboard da Agenda</DialogTitle>
            <DialogDescription>Suas ações na BUILT por status. Os eventos pessoais do Google ficam separados.</DialogDescription>
          </DialogHeader>
          {isLoading ? <p role="status" className="text-sm text-muted-foreground">Carregando dashboard...</p> : <div className="grid grid-cols-2 gap-3" data-testid="agenda-status-dashboard">
            {(["pendente", "em_andamento", "concluida", "cancelada"] as AgendaStatus[]).map(status => (
              <button key={status} type="button" onClick={() => { setStatusFilter(status); setDashboardOpen(false); }} className="rounded-lg border border-border/60 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</span>
                <span className="mt-2 block text-2xl font-bold text-foreground">{counts[status] || 0}</span>
              </button>
            ))}
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12">
            <DialogTitle>{editing ? "Editar ação" : "Nova ação"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {editing && agendaSourceAction(editing) && <Button asChild className="w-full"><a href={agendaSourceAction(editing)!.href}>{agendaSourceAction(editing)!.label}</a></Button>}
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
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 bg-[#0f62fe] text-white hover:bg-[#004fd6]" data-testid="btn-salvar-agenda" loading={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar alterações" : "Criar ação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
