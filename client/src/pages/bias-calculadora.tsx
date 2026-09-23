import { useState, useEffect, useMemo } from "react";
import { BiaNumberInput, BiaRoleComposition } from "@/components/bia-role-composition";
import { BiaEconomicStructureFields, EconomicMapPreview } from "@/components/bia-economic-structure";
import { formatBiaPercent } from "@shared/bia-numbers";
import { useLocation } from "wouter";
import { confirmDiscardChanges, useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { getBiaPublicRef } from "@/lib/bia-url";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isBiaPendingBypassed } from "@/lib/bia-pending-bypass";
import {
  formatDmRangeLabel,
  loadDmRanges,
  saveDmRanges,
  type InstitutionalPercentageRange,
} from "@/lib/dm-ranges";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { calculateInitialMap, initialMapContributionValue, withInitialCapitalParticipation, type InitialMapParticipantInput } from "@shared/member-portfolio";
import { biaTeamFromMapParticipants, isBiaAllyCandidate, BIA_PARTICIPANT_ROLE_FIELDS, BIA_PARTICIPANT_ROLE_LABELS } from "@shared/bia-access";
import { validateInitialClassifications } from "@shared/initial-contributions";
import {
  Calculator,
  Target,
  Save,
  RefreshCw,
  DollarSign,
  Percent,
  TrendingUp,
  Building2,
  Users,
  Crown,
  Shield,
  Hammer,
  Briefcase,
  Wallet,
  ArrowRight,
  BarChart3,
  Receipt,
  CalendarDays,
  Wrench,
  HandCoins,
  ChevronsUpDown,
  Check,
  UserCircle,
  CreditCard,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Plus,
  Trash2,
  Lock,
} from "lucide-react";
import { PagamentoModal } from "@/components/PagamentoModal";

interface Membro {
  id: string;
  Outras_redes_as_quais_pertenco?: string[] | null;
  nome?: string;
  Nome_de_usuario?: string | null;
  foto?: string | null;
}

interface CppSummary {
  cppCount: number;
  contributorLabels: string[];
  parcelas: number;
}

interface SaveBiaResponse {
  _cppSummary?: CppSummary | null;
  _cppError?: string;
  [key: string]: unknown;
}

const DIRECTUS_URL = "https://databases.builtalliances.com";

function membroNome(m: Membro): string {
  return m.nome || m.Nome_de_usuario || m.id;
}

function membroFoto(m: Membro): string | null {
  return m.foto ?`/api/assets/${m.foto}?width=40&height=40&fit=cover` : null;
}

function MemberSelect({
  value, onChange, membros, label, pending
}: { value: string; onChange: (v: string) => void; membros: Membro[]; label: string; pending?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = membros.find(m => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 text-left rounded-md border border-input bg-background px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors min-h-[30px]"
          data-testid={`member-select-${label.replace(/\s+/g, "-").toLowerCase()}`}
        >
          {selected ?(
            <>
              {membroFoto(selected) ?(
                <img src={membroFoto(selected)!} className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-brand-gold">{membroNome(selected).charAt(0).toUpperCase()}</span>
                </div>
              )}
              <span className="truncate text-foreground">{membroNome(selected)}</span>
              {pending && (
                <Badge variant="outline" className="h-4 shrink-0 border-amber-300 bg-amber-50 px-1.5 text-[9px] font-medium text-amber-700">
                  Pendente
                </Badge>
              )}
            </>
          ) : (
            <>
              <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Selecionar...</span>
            </>
          )}
          <ChevronsUpDown className="w-3 h-3 ml-auto text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar membro..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>
              <div className="text-xs p-3 text-muted-foreground text-center">Nenhum membro encontrado.</div>
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onChange(""); setOpen(false); }}
                  className="text-xs text-muted-foreground"
                >
                  <Check className="w-3 h-3 mr-2 opacity-0" />
                  — Remover seleção
                </CommandItem>
              )}
              {membros.map(m => (
                <CommandItem
                  key={m.id}
                  value={membroNome(m)}
                  onSelect={() => { onChange(m.id); setOpen(false); }}
                  className="text-xs"
                >
                  <Check className={`w-3 h-3 mr-2 ${m.id === value ?"opacity-100" : "opacity-0"}`} />
                  {membroFoto(m) ?(
                    <img src={membroFoto(m)!} className="w-5 h-5 rounded-full object-cover mr-2 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-brand-gold/20 flex items-center justify-center mr-2 shrink-0">
                      <span className="text-[8px] font-bold text-brand-gold">{membroNome(m).charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="truncate">{membroNome(m)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface BiasProjeto {
  codigo_publico?: string | null;
  id: string;
  nome_bia: string;
  objetivo_alianca: string;
  autor_bia?: string | null;
  aliado_built?: string | null;
  diretor_alianca?: string | null;
  diretor_nucleo_tecnico?: string | null;
  diretor_execucao?: string | null;
  diretor_comercial?: string | null;
  diretor_capital?: string | null;
  valor_origem?: string | number;
  divisor_multiplicador?: string | number;
  perc_autor_opa?: string | number;
  perc_aliado_built?: string | number;
  perc_built?: string | number;
  perc_dir_tecnico?: string | number;
  perc_dir_alianca?: string | number;
  perc_dir_obras?: string | number;
  perc_dir_comercial?: string | number;
  perc_dir_capital?: string | number;
  cpp_autor_opa?: string | number;
  cpp_aliado_built?: string | number;
  cpp_built?: string | number;
  cpp_dir_tecnico?: string | number;
  cpp_dir_alianca?: string | number;
  cpp_dir_obras?: string | number;
  cpp_dir_comercial?: string | number;
  cpp_dir_capital?: string | number;
  custo_origem_bia?: string | number;
  custo_final_previsto?: string | number;
  valor_realizado_venda?: string | number;
  comissao_prevista_corretor?: string | number;
  ir_previsto?: string | number;
  resultado_liquido?: string | number;
  lucro_previsto?: string | number;
  inss_previsto?: string | number;
  manutencao_pos_obra_prevista?: string | number;
  valor_geral_venda_vgv?: string | number;
  total_receita?: string | number;
  inicio_aportes?: string | null;
  total_aportes?: string | number;
}

interface BiaDiretorSolicitacao {
  id: string;
  bia_id: string;
  diretor_membro_id: string;
  campo_diretor: string;
  status: string;
}

function toNum(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPerc(value: number): string {
  return `${value.toFixed(2)}%`;
}

const DEFAULT_INSTITUTIONAL_PERCENTAGE_RANGES: InstitutionalPercentageRange[] = [
  { label: "Até R$ 1,5 milhões", maxValue: 1_500_000, percentual: 1.25 },
  { label: "Até R$ 3 milhões", maxValue: 3_000_000, percentual: 1 },
  { label: "Até R$ 7 milhões", maxValue: 7_000_000, percentual: 0.85 },
  { label: "Até R$ 15 milhões", maxValue: 15_000_000, percentual: 0.7 },
  { label: "Até R$ 30 milhões", maxValue: 30_000_000, percentual: 0.6 },
  { label: "Até R$ 75 milhões", maxValue: 75_000_000, percentual: 0.5 },
];

function getInstitutionalPercentageRange(valorOrigem: number, ranges: InstitutionalPercentageRange[]) {
  if (!valorOrigem || valorOrigem <= 0) return null;
  return ranges.find((range) => valorOrigem <= range.maxValue) || null;
}

function formatRangeLabel(maxValue: number): string {
  if (maxValue >= 1_000_000) {
    const millions = maxValue / 1_000_000;
    return `Até R$ ${millions.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} milhões`;
  }
  return `Até ${formatBRL(maxValue)}`;
}

function formatInputBRL(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numToBRLStr(v: number): string {
  if (!v) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRLCalc(formatted: string): number {
  if (!formatted) return 0;
  return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
}

function NumInput({
  label, value, onChange, testId, hint
}: { label: string; value: number; onChange: (v: number) => void; testId?: string; hint?: string }) {
  const [display, setDisplay] = useState(() => numToBRLStr(value));

  // Sync display when parent value changes (e.g. when BIA is selected)
  useEffect(() => { setDisplay(numToBRLStr(value)); }, [value]);

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
        <Input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={(e) => {
            const formatted = formatInputBRL(e.target.value);
            setDisplay(formatted);
            onChange(parseBRLCalc(formatted));
          }}
          className="pl-9 h-8 text-sm tabular-nums"
          placeholder="0,00"
          data-testid={testId}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function PercInput({
  label, value, onChange, testId, hint, baseValue
}: { label: string; value: number; onChange: (v: number) => void; testId?: string; hint?: string; baseValue?: number }) {
  const brlEquiv = baseValue && baseValue > 0 ?(value / 100) * baseValue : null;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={value || ""}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="pr-8 h-8 text-sm"
            placeholder="0,00"
            data-testid={testId}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
        </div>
        {brlEquiv !== null && (
          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums min-w-[90px] text-right">
            = {formatBRL(brlEquiv)}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export interface InitialMapSnapshotApi {
  estrutura?: import("@shared/member-portfolio").InitialEconomicStructure;
  historicoLegado?: boolean;
  registradoEm?: string | null;
  modeloCalculo?: number;
  revisao: number;
  canEdit: boolean;
  ativa: boolean;
  id: string;
  biaId: string;
  origemId?: string | null;
  status: "rascunho" | "bloqueado";
  valorOrigem: number;
  moeda: string;
  divisorMultiplicador: number;
  baseEconomicaInicial: number;
  participantes: Array<InitialMapParticipantInput & {
    cppOrigem?: number;
    cppCapital?: number;
    cppTotal?: number;
    mapPercentual?: number;
    cppCapitalPercentual?: number;
  }>;
  snapshotHash?: string | null;
  bloqueadoEm?: string | null;
  directusSync?: "ok" | "pending";
}

interface CurrentMapResponse {
  inicial: InitialMapSnapshotApi | null;
  atual: Array<{ group: string; memberId: string; name: string; value: number; percent: number }>;
}

export function useInitialMapSnapshot(biaId?: string | null) {
  return useQuery<InitialMapSnapshotApi | null>({
    queryKey: ["/api/bias", biaId, "map-inicial"], enabled: !!biaId, retry: false,
    refetchOnMount: "always", refetchOnWindowFocus: "always",
    queryFn: async () => {
      const response = await fetch(`/api/bias/${biaId}/map-inicial`, { credentials: "include" });
      const data = await response.json();
      if (response.status === 404 && data.code === "LEGACY_BIA_MAP") return null;
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o MAP Zero.");
      return data;
    },
  });
}

export function BiaMapZero({ biaId }: { biaId: string }) {
  const query = useInitialMapSnapshot(biaId);
  const { data: membros = [] } = useQuery<Membro[]>({ queryKey: ["/api/membros"] });
  if (query.isPending) return <p>Carregando MAP Zero…</p>;
  if (query.isError && !query.data) return <p role="alert">{query.error.message} <Button onClick={() => query.refetch()}>Tentar novamente</Button></p>;
  if (!query.data) return <LegacyMapZero biaId={biaId} membros={membros} />;
  return <MapInicialCalculator key={biaId} snapshot={query.data} bia={{ id: biaId }} bias={[]} membros={membros} embedded readOnly={false} onSelectBia={() => {}} mode="zero" queryFailed={query.isError} retryQuery={() => query.refetch()} />;
}

function LegacyMapZero({ biaId, membros }: { biaId: string; membros: Membro[] }) {
  const query = useQuery<InitialMapSnapshotApi>({
    queryKey: ["/api/bias", biaId, "map-zero-legado"],
    queryFn: async () => (await apiRequest("GET", `/api/bias/${biaId}/map-zero-legado`)).json(),
    refetchOnMount: "always", refetchOnWindowFocus: "always",
  });
  if (query.isPending) return <p>Preparando composição para revisão…</p>;
  if (!query.data) return <p role="alert">Não foi possível carregar a composição. <Button onClick={() => query.refetch()}>Tentar novamente</Button></p>;
  return <MapInicialCalculator key={biaId} snapshot={query.data} bia={{ id: biaId }} bias={[]} membros={membros}
    embedded readOnly={false} onSelectBia={() => {}} mode="zero" queryFailed={query.isError} retryQuery={() => query.refetch()} />;
}

export function MapZeroFields({
  valorOrigem, setValorOrigem, participantes, setParticipantes, membros, byValue = true, readOnly = false, creationTeam,
}: {
  valorOrigem: number;
  setValorOrigem: (value: number) => void;
  participantes: InitialMapParticipantInput[];
  setParticipantes: React.Dispatch<React.SetStateAction<InitialMapParticipantInput[]>>;
  membros: Membro[];
  byValue?: boolean;
  readOnly?: boolean;
  creationTeam?: {canEditAlly: boolean; communityAllyId?: string};
}) {
  const [confirmation, setConfirmation] = useState<{message:string; apply:()=>void} | null>(null);
  const cppTypes = useQuery<Array<{id:string;Nome:string}>>({queryKey:["/api/tipos-cpp"],enabled:byValue});
  const preview = useMemo(() => {
    try {
      if (creationTeam) {
        const team = biaTeamFromMapParticipants(participantes);
        if (!team.autor_bia) throw new Error("Defina o Autor da Oportunidade na Equipe.");
        if (!team.aliado_built || !team.diretor_alianca) throw new Error("Defina o Aliado BUILT e o Diretor de Aliança.");
      }
      const calculation = calculateInitialMap(valorOrigem, participantes);
      if (creationTeam) validateInitialClassifications(calculation.participantes);
      return { calculation, error: null as string | null };
    } catch (error: any) {
      return { calculation: null, error: error.message as string };
    }
  }, [participantes, valorOrigem, !!creationTeam]);
  const calculatedById = new Map((preview.calculation?.participantes || []).map(item => [item.participantId, item]));
  const usedMembers = new Set(participantes.map(item => item.memberId).filter(Boolean));
  const roles = Object.keys(BIA_PARTICIPANT_ROLE_FIELDS) as Array<keyof typeof BIA_PARTICIPANT_ROLE_FIELDS>;
  const dmPartial = participantes.reduce((sum,p) => sum + (Number.isFinite(p.indiceContribuicao) ? p.indiceContribuicao : 0), 0);
  const capitalPartial = Number(participantes.reduce((sum,p) => sum + (Number.isFinite(p.capitalComprometido) ? p.capitalComprometido! : 0), 0).toFixed(5));
  const updateParticipant = (index: number, patch: Partial<InitialMapParticipantInput>) => {
    setParticipantes(current => current.map((item,i) => i === index ? {...item,...patch} : item));
  };
  const confirmEconomicChange = (item:InitialMapParticipantInput, message:string, apply:()=>void) => {
    const hasEconomicInput = Number.isFinite(item.indiceContribuicao) || Number(item.capitalComprometido) > 0
      || (item.tipo === "guardiao" && Number.isFinite(item.capitalComprometido));
    if (creationTeam && hasEconomicInput) setConfirmation({message,apply});
    else apply();
  };
  const addMember = () => setParticipantes(current => [...current, {
    participantId: `draft:${crypto.randomUUID()}`, memberId:null, nome:"", cargos:[], tipo:creationTeam ? "multiplicador" : "guardiao",
    indiceContribuicao:NaN, pesoCapital:creationTeam ? 0 : NaN,
    ...(byValue ? {capitalComprometido:creationTeam ? 0 : NaN,naturezaCapital:"caixa" as const} : {}),
  }]);
  const mapCard = (item:InitialMapParticipantInput, index:number) => {
    const calculated = calculatedById.get(String(item.participantId));
    return <div key={item.participantId || index} className="min-w-0 rounded-md bg-muted/60 p-3 text-sm break-words">
      {creationTeam && <p className="mb-2 font-semibold">{item.nome}</p>}
      <p>{item.tipoCppContribuicao?.nome || "CPP Origem"}: <strong>{formatBRL(calculated?.cppOrigem || 0)}</strong></p>
      <p>{item.tipoCppCapital?.nome || "CPP Capital"}: <strong>{formatBRL(calculated?.cppCapital || 0)}</strong></p>
      <p>CPP Total: <strong>{formatBRL(calculated?.cppTotal || 0)}</strong></p>
      <p>Participação inicial: <strong>{(calculated?.mapPercentual || 0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:5})}%</strong></p>
    </div>;
  };

  return <div className="min-w-0 space-y-4">
    <fieldset disabled={readOnly} className="min-w-0 space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">{creationTeam ? "Equipe e composição do DM" : "Estruturação · Base do cálculo"}</CardTitle></CardHeader>
        <CardContent className={creationTeam ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"}>
          {creationTeam ? <label className="space-y-1 text-sm">Valor de Origem (R$)<Input aria-label="Valor de Origem" type="number" min="0" step="0.00001" value={Number.isFinite(valorOrigem) ? valorOrigem : ""} onChange={e=>setValorOrigem(e.target.value === "" ? NaN : Number(e.target.value))} /></label>
            : <NumInput label="Valor de Origem" value={valorOrigem} onChange={setValorOrigem} />}
          <div><p className="text-xs text-muted-foreground">{creationTeam ? "DM total (soma dos índices preenchidos)" : "Divisor Multiplicador"}</p><p className="mt-2 text-xl font-bold">{(creationTeam ? dmPartial : preview.calculation?.divisorMultiplicador || 0).toLocaleString("pt-BR",{maximumFractionDigits:5})}%</p></div>
          {creationTeam ? <>
            <div><p className="text-xs text-muted-foreground">Total informado em dinheiro e bens</p><p className="mt-2 font-bold">{formatBRL(capitalPartial)}</p></div>
            <div><p className="text-xs text-muted-foreground">Restante para fechar o Valor de Origem</p><p className="mt-2 font-bold">{Number.isFinite(valorOrigem) ? formatBRL(Number((valorOrigem-capitalPartial).toFixed(5))) : "Preencha o Valor de Origem"}</p></div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Informe um DM por pessoa, mesmo com vários cargos. Essa % não é a participação final na BIA.</p>
            <p role="status" className="text-sm sm:col-span-2">{preview.error ? "Composição pendente — confira os campos abaixo." : "Composição válida — confira a prévia do MAP Zero."}</p>
          </> : <>
            <div><p className="text-xs text-muted-foreground">Peso dos Guardiões</p><p className="mt-2 text-xl font-bold">{(preview.calculation?.pesoCapitalTotal || 0).toLocaleString("pt-BR",{maximumFractionDigits:5})}%</p></div>
            <div><p className="text-xs text-muted-foreground">Base Econômica Inicial</p><p className="mt-2 text-xl font-bold text-brand-gold">{formatBRL(preview.calculation?.baseEconomicaInicial || 0)}</p></div>
          </>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-3">
          <div><CardTitle className="text-lg">Participantes</CardTitle><p className="mt-1 text-sm text-muted-foreground">{creationTeam ? "Uma ficha por pessoa. Cada cargo tem um único responsável." : "Cargos são informativos e não duplicam o índice da pessoa."}</p></div>
          {!readOnly && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={addMember}><Plus className="mr-2 h-4 w-4" />Pessoa</Button></div>}
        </CardHeader>
        <CardContent className="space-y-3">
          {!participantes.length && <p className="text-sm text-muted-foreground">Adicione os participantes.</p>}
          {participantes.map((item,index) => {
            const calculated = calculatedById.get(String(item.participantId));
            const isAlly = item.cargos?.includes(BIA_PARTICIPANT_ROLE_LABELS.aliado);
            const lockedAlly = !!creationTeam && !creationTeam.canEditAlly && isAlly;
            const dmValue = Number.isFinite(valorOrigem) && valorOrigem > 0 && Number.isFinite(item.indiceContribuicao) && item.indiceContribuicao >= 0
              ? initialMapContributionValue(valorOrigem, item.indiceContribuicao) : null;
            const needsDetails = Number(item.capitalComprometido)>0 || item.indiceContribuicao>0;
            const missingDetails = (Number(item.capitalComprometido)>0 && !item.tipoCppCapital?.id) || (item.indiceContribuicao>0 && !item.tipoCppContribuicao?.id);
            const dmField = <label className="min-w-0 space-y-1 text-sm">{creationTeam ? "DM (%)" : "Índice %"}<Input aria-label={`Índice de ${item.nome || "participante"}`} type="number" min="0" step="0.00001" placeholder="Preencher" value={Number.isFinite(item.indiceContribuicao)?item.indiceContribuicao:""} onChange={e=>updateParticipant(index,{indiceContribuicao:e.target.value===""?NaN:Number(e.target.value)})} />{creationTeam && <span className="block text-sm font-medium tabular-nums">{dmValue === null ? "Informe o Valor de Origem e a %" : `= ${formatBRL(dmValue)}`}</span>}</label>;
            const cppFields = <>
              {(!creationTeam || Number(item.capitalComprometido)>0) && <label className="min-w-0 space-y-1 text-sm">Natureza do capital<select className="block w-full min-w-0 rounded border bg-background p-2" value={item.naturezaCapital || ""} onChange={e=>updateParticipant(index,{naturezaCapital:e.target.value as "caixa"|"nao_caixa"})}><option value="" disabled>Selecione a natureza</option><option value="caixa">Dinheiro</option><option value="nao_caixa">Propriedade, bens ou direitos — sem caixa</option></select></label>}
              {(["tipoCppCapital","tipoCppContribuicao"] as const).filter(field=>!creationTeam || Number(field==="tipoCppCapital"?item.capitalComprometido:item.indiceContribuicao)>0).map(field=><label key={field} className="min-w-0 space-y-1 text-sm">{field==="tipoCppCapital"?"CPP do capital comprometido":"CPP da contribuição econômica"}<select className="block w-full min-w-0 rounded border bg-background p-2" value={item[field]?.id || ""} onChange={e=>{const type=cppTypes.data?.find(t=>String(t.id)===e.target.value);updateParticipant(index,{[field]:type?{id:String(type.id),nome:type.Nome}:undefined});}}><option value="">Selecione o tipo</option>{cppTypes.data?.map(t=><option key={t.id} value={String(t.id)}>{t.Nome}</option>)}</select></label>)}
            </>;
            return <div key={item.participantId || index} className={`grid min-w-0 gap-3 rounded-lg border p-3 ${creationTeam ? "sm:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`} data-testid={`map-participant-${index}`}>
              <fieldset disabled={lockedAlly} className="min-w-0 space-y-1">
                <Label>Participante</Label>
                {item.institutionCode === "BUILT" ? <Input value="BUILT" disabled /> : <MemberSelect value={item.memberId || ""} onChange={memberId => {
                  if (memberId === item.memberId) return;
                  const member = membros.find(candidate => candidate.id === memberId);
                  confirmEconomicChange(item,"Trocar a pessoa limpará o índice e os valores desta ficha. Os cargos serão mantidos. Deseja continuar?",()=>updateParticipant(index,{
                    participantId:memberId ? `member:${memberId}` : `draft:${crypto.randomUUID()}`,
                    memberId:memberId || null,nome:member ? membroNome(member) : "",
                    ...(creationTeam ? {indiceContribuicao:NaN,capitalComprometido:item.tipo === "multiplicador" ? 0 : NaN,pesoCapital:0,tipoCppCapital:undefined,tipoCppContribuicao:undefined,naturezaCapital:"caixa" as const} : {}),
                  }));
                }} membros={membros.filter(member => (!usedMembers.has(member.id) || member.id === item.memberId) && (!creationTeam || !isAlly || member.id === item.memberId || isBiaAllyCandidate(member, creationTeam.communityAllyId)))} label={`map-${index}`} />}
                {lockedAlly && <p className="text-xs text-muted-foreground">Aliado definido pela sua comunidade.</p>}
              </fieldset>
              {creationTeam && dmField}
              {creationTeam ? <details className="min-w-0 rounded border bg-muted/20 p-2 sm:col-span-2">
                <summary className="cursor-pointer text-sm">Cargos: {item.cargos?.length ? item.cargos.join(" · ") : "Definir cargos"}</summary>
                <fieldset className="mt-3 space-y-2 text-sm"><legend className="sr-only">Cargos acumulados</legend>
                {item.institutionCode === "BUILT" ? <p>Instituição</p> : roles.map(role => {
                  const label = BIA_PARTICIPANT_ROLE_LABELS[role];
                  const checked = !!item.cargos?.includes(label);
                  const occupied = participantes.some((p,i) => i !== index && p.cargos?.includes(label));
                  const canBeAlly = isBiaAllyCandidate(membros.find(m=>m.id === item.memberId), creationTeam.communityAllyId);
                  return <label key={role} className="flex items-start gap-2"><input type="checkbox" className="mt-1 shrink-0" checked={checked}
                    disabled={occupied || (role === "aliado" && (!creationTeam.canEditAlly || (!checked && !canBeAlly)))}
                    onChange={e=>updateParticipant(index,{cargos:e.target.checked ? [...(item.cargos || []),label] : (item.cargos || []).filter(c=>c!==label)})} />
                    <span>{label}{occupied && <span className="text-xs text-muted-foreground"> · já atribuído</span>}</span>
                  </label>;
                })}
              </fieldset></details> : <label className="space-y-1 text-sm">Cargos<Input value={(item.cargos || []).join(", ")} onChange={event=>updateParticipant(index,{cargos:event.target.value.split(",").map(role=>role.trim()).filter(Boolean)})} /></label>}
              {creationTeam ? <label className="min-w-0 space-y-1 text-sm">Tipo de participante
                <select aria-label={`Tipo de ${item.nome || "participante"}`} className="block w-full min-w-0 rounded border bg-background p-2" value={item.tipo} onChange={e=>{
                  const suppliesCapital=e.target.value==="guardiao";
                  const apply=()=>updateParticipant(index,withInitialCapitalParticipation(item,suppliesCapital));
                  if(!suppliesCapital && Number(item.capitalComprometido)>0) confirmEconomicChange(item,"Ao mudar para Multiplicador, o valor fornecido será zerado e a classificação desse capital será removida. O DM será mantido. Continuar?",apply);
                  else apply();
                }}><option value="guardiao">Guardião</option><option value="multiplicador">Multiplicador</option></select>
                <span className="block text-xs text-muted-foreground">{item.tipo === "guardiao" ? "Compõe o Valor de Origem com dinheiro, imóvel ou bens. Também pode ter DM, inclusive zero." : "Participa pelo DM, sem aportar dinheiro ou bens no Valor de Origem."}</span>
              </label> : <div className="min-w-0 space-y-1"><Label>Tipo</Label><Select value={item.tipo} onValueChange={(tipo:"guardiao"|"multiplicador") => {
                const apply=()=>updateParticipant(index,{tipo,pesoCapital:tipo==="multiplicador"?0:item.pesoCapital,...(byValue && tipo==="multiplicador"?{capitalComprometido:0,tipoCppCapital:undefined}:{})});
                if (creationTeam && tipo==="multiplicador" && Number(item.capitalComprometido)>0) confirmEconomicChange(item,"Multiplicadores não têm capital comprometido. Zerar o capital desta ficha?",apply); else apply();
              }}><SelectTrigger aria-label={`Tipo de ${item.nome || "participante"}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="guardiao">Guardião</SelectItem><SelectItem value="multiplicador">Multiplicador</SelectItem></SelectContent></Select></div>}

              {!creationTeam && dmField}
              {(!creationTeam || item.tipo==="guardiao") && <label className="min-w-0 space-y-1 text-sm">{creationTeam ? "Valor que fornecerá (R$)" : byValue ? "Valor comprometido no Valor de Origem (R$)" : "Peso %"}<Input aria-label={`Capital de ${item.nome || "participante"}`} type="number" min="0" step="0.00001" placeholder="Preencher" disabled={item.tipo==="multiplicador"} value={byValue?(Number.isFinite(item.capitalComprometido)?item.capitalComprometido:""):(Number.isFinite(item.pesoCapital)?item.pesoCapital:"")} onChange={e=>updateParticipant(index,byValue?{capitalComprometido:e.target.value===""?NaN:Number(e.target.value),pesoCapital:0}:{pesoCapital:e.target.value===""?NaN:Number(e.target.value)})} />{byValue && !creationTeam && <span className="text-xs text-muted-foreground">Peso derivado: {Number(calculated?.pesoCapital || 0).toLocaleString("pt-BR",{maximumFractionDigits:5})}%</span>}</label>}
              {byValue && (creationTeam ? needsDetails && <details className="min-w-0 rounded border p-2 sm:col-span-2">
                <summary className={`cursor-pointer text-sm ${missingDetails ? "font-medium text-amber-800" : ""}`}>Detalhes da participação · {missingDetails ? "Preencher" : "Conferido"}</summary>
                <p className="mt-2 text-xs text-muted-foreground">Classifique os valores para o MAP Zero. O tipo de CPP não é escolhido automaticamente pelo cargo.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">{cppFields}</div>
              </details> : cppFields)}
              {creationTeam && item.tipo==="multiplicador" && <p className="text-xs text-muted-foreground">Sem aporte de dinheiro ou bens. Valor fornecido: R$ 0,00.</p>}
              {!creationTeam && mapCard(item,index)}
              <Button type="button" variant="ghost" size="icon" disabled={lockedAlly} onClick={()=>confirmEconomicChange(item,"Remover esta pessoa e os valores preenchidos da composição?",()=>setParticipantes(current=>current.filter((_,i)=>i!==index)))} aria-label={`Remover ${item.nome || "participante"}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>;
          })}
          {preview.error && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{creationTeam && "Composição pendente: "}{preview.error}</p>}
        </CardContent>
      </Card>
    </fieldset>
    {creationTeam && <details className="rounded-lg border p-4">
      <summary className="cursor-pointer font-semibold">Ver composição inicial (MAP Zero)</summary>
      {preview.calculation ? <div className="mt-4 space-y-3">
        <p className="text-sm">Prévia somente de leitura. Base Econômica Inicial (BEI): <strong>{formatBRL(preview.calculation.baseEconomicaInicial)}</strong></p>
        <div className="grid gap-3 sm:grid-cols-2">{participantes.map(mapCard)}</div>
      </div> : <p className="mt-3 text-sm text-muted-foreground">Composição pendente. Preencha e valide a Equipe para calcular o MAP Zero.</p>}
    </details>}
    <AlertDialog open={!!confirmation} onOpenChange={open=>{if(!open)setConfirmation(null);}}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar alteração da Equipe</AlertDialogTitle><AlertDialogDescription>{confirmation?.message}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={()=>{confirmation?.apply();setConfirmation(null);}}>Confirmar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
function MapInicialCalculator({
  snapshot,
  bia,
  bias,
  membros,
  embedded,
  readOnly,
  onSelectBia,
  mode = "dm",
  queryFailed = false,
  retryQuery,
}: {
  snapshot: InitialMapSnapshotApi;
  bia: Pick<BiasProjeto, "id" | "codigo_publico">;
  bias: BiasProjeto[];
  membros: Membro[];
  embedded: boolean;
  readOnly: boolean;
  onSelectBia: (id: string) => void;
  mode?: "dm" | "zero";
  queryFailed?: boolean;
  retryQuery?: () => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const historical = !!snapshot.historicoLegado;
  const [editing, setEditing] = useState(historical && snapshot.revisao === 0);
  const [reviewed, setReviewed] = useState(false);
  const [base, setBase] = useState(snapshot);
  const [estrutura, setEstrutura] = useState(snapshot.estrutura);
  const [valorOrigem, setValorOrigem] = useState(Number(snapshot.valorOrigem || 0));
  const [participantes, setParticipantes] = useState<InitialMapParticipantInput[]>(snapshot.participantes || []);
  const locked = !snapshot.canEdit;
  const [motivo, setMotivo] = useState("");
  const byValue = Number(snapshot.modeloCalculo) >= 3;
  readOnly = readOnly || !snapshot.canEdit || queryFailed;
  const dirty = valorOrigem !== Number(base.valorOrigem) || JSON.stringify(participantes) !== JSON.stringify(base.participantes) || JSON.stringify(estrutura) !== JSON.stringify(base.estrutura) || !!motivo;

  useEffect(() => {
    if (!dirty) {
      setBase(snapshot);
      setEstrutura(snapshot.estrutura);
      setValorOrigem(Number(snapshot.valorOrigem || 0));
      setParticipantes(snapshot.participantes || []);
    }
  }, [snapshot, dirty]);

  const preview = useMemo(() => {
    try {
      const calculation = calculateInitialMap(valorOrigem, participantes, estrutura);
      if (byValue) validateInitialClassifications(calculation.participantes);
      return { calculation, error: null as string | null };
    } catch (error: any) {
      return { calculation: null, error: error.message as string };
    }
  }, [participantes, valorOrigem, byValue, estrutura]);
  const mapQuery = useQuery<CurrentMapResponse>({
    queryKey: ["/api/bias", bia.id, "map"],
    queryFn: async () => (await apiRequest("GET", `/api/bias/${bia.id}/map`)).json(),
    enabled: mode === "zero",
  });
  const comparisonParticipants = [...(snapshot.participantes || [])];
  for (const row of mapQuery.data?.atual || []) {
    if (!comparisonParticipants.some((p) => (p.memberId || p.participantId) === row.memberId)) {
      comparisonParticipants.push({ participantId: row.memberId, memberId: row.memberId, nome: row.name,
        cargos: [], tipo: "multiplicador", indiceContribuicao: 0, pesoCapital: 0, cppOrigem: 0, cppCapital: 0, cppTotal: 0, mapPercentual: 0 });
    }
  }
  const saveMutation = useMutation({
    mutationFn: async () => (await apiRequest("PUT", `/api/bias/${bia.id}/${snapshot.historicoLegado ? "map-zero-legado" : "map-inicial"}`, {
      valorOrigem,
      moeda: base.moeda || "BRL",
      estrutura,
      participantes,
      revisaoEsperada: base.revisao,
      motivo,
      ...(snapshot.historicoLegado ? { confirmarRevisao: reviewed } : {}),
    })).json(),
    onSuccess: (data: InitialMapSnapshotApi) => {
      setBase(data);
      setEstrutura(data.estrutura);
      setValorOrigem(Number(data.valorOrigem));
      setParticipantes(data.participantes);
      setEditing(false);
      queryClient.setQueryData(["/api/bias", bia.id, data.historicoLegado ? "map-zero-legado" : "map-inicial"], data);
      setReviewed(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bias", bia.id, "map"] });
      queryClient.invalidateQueries({ queryKey: [`/api/bias/${bia.id}/aportes-iniciais`] });
      queryClient.invalidateQueries({ queryKey: [`/api/bias/${bia.id}/map/versoes`] });
      queryClient.invalidateQueries({ queryKey: ["/api/bia-mou/minhas-pendencias"] });
      setMotivo("");
      queryClient.invalidateQueries({ queryKey: ["/api/bias"] });
      toast({
        title: mode === "dm" ? "DM salvo" : "MAP Zero salvo",
        description: data.directusSync === "pending"
          ? "O MAP Zero foi salvo, mas o espelho da BIA está pendente. Salve novamente para repetir a sincronização."
          : "Nenhum lançamento financeiro foi criado.",
      });
    },
    onError: (error: any) => {
      if (String(error.message).startsWith("409:")) queryClient.invalidateQueries({ queryKey: ["/api/bias", bia.id, "map-inicial"] });
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    },
  });
  useUnsavedChanges(dirty || saveMutation.isPending);


  return (
    <div className={`${embedded ? "p-0 max-w-none" : "p-6 max-w-7xl mx-auto"} min-w-0 space-y-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <div className="rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 p-2 text-brand-navy"><Calculator className="h-6 w-6" /></div>
            {mode === "dm" ? "DM" : "MAP Zero"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Composição inicial da BIA · revisão {base.revisao}. {Number(snapshot.modeloCalculo) >= 4 ? "DM por cargo, capital por pessoa." : "Um índice por pessoa."}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!embedded && (
            <Select value={bia.id} onValueChange={id => { if (confirmDiscardChanges()) onSelectBia(id); }}>
              <SelectTrigger className="w-full sm:w-[280px]"><SelectValue /></SelectTrigger>
              <SelectContent>{bias.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome_bia}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Badge variant={locked ? "secondary" : "outline"} className="justify-center gap-1.5 py-1.5">
            {locked && <Lock className="h-3.5 w-3.5" />}{snapshot.ativa ? "BIA ativa" : "Em estruturação"}
          </Badge>
        </div>
      </div>

      {readOnly && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Acesso somente para visualização.</div>}
      {historical && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>{base.revisao ? "Composição original revisada" : "Composição original pendente de revisão"}</strong>
        <p>A equipe e o Valor de Origem atuais são apenas sugestões: confira com os documentos originais. Preencha os índices, valores e classificações ausentes. Nenhum valor foi deduzido de pagamentos.</p>
        <p>Confirmar registra o MAP Zero no histórico com a data de hoje, sem alterar o MAP Atual, aportes, transferências ou MOUs assinados. Não converte o cálculo legado.</p>
        {snapshot.registradoEm && <p>Registrado em: {new Date(snapshot.registradoEm).toLocaleString("pt-BR")}</p>}
      </div>}
      {queryFailed && <p role="alert" className="rounded border border-amber-300 p-3 text-sm">Não foi possível atualizar a composição. Seus campos foram preservados; o salvamento aguarda uma consulta bem-sucedida. <Button variant="outline" onClick={retryQuery}>Tentar novamente</Button></p>}
      {snapshot.status === "bloqueado" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Os aceites anteriores estão preservados. {snapshot.ativa ? "Correções exigem motivo e geram uma nova versão do MAP." : "Alterar esta composição solicitará novos aceites antes da ativação."}
        </div>
      )}

      {snapshot.revisao !== base.revisao && <p role="alert" className="rounded border border-amber-300 p-3 text-sm">Há uma revisão mais recente. Seus campos foram preservados. <Button variant="outline" onClick={() => { if (confirmDiscardChanges()) { setBase(snapshot); setValorOrigem(Number(snapshot.valorOrigem)); setParticipantes(snapshot.participantes); setMotivo(""); } }}>Descartar e carregar revisão atual</Button></p>}
      {mode === "dm" && Number(snapshot.modeloCalculo) >= 4 && <>
        <p>Valor de Origem: {formatBRL(valorOrigem)} · DM total: {preview.calculation ? formatBiaPercent(preview.calculation.divisorMultiplicador) : "Pendente"}</p>
        <BiaRoleComposition valorOrigem={valorOrigem} moeda={base.moeda} participants={participantes} onChange={setParticipantes} members={membros} readOnly={readOnly || saveMutation.isPending} dmOnly />
        {preview.error && <p role="alert">{preview.error} Complete a composição em MAP → MAP Zero.</p>}
      </>}
      {mode === "dm" && Number(snapshot.modeloCalculo) < 4 && <>
<Card><CardContent className="grid gap-4 pt-6 sm:grid-cols-3"><div><p className="text-sm text-muted-foreground">Valor de Origem</p><strong>{formatBRL(valorOrigem)}</strong></div><div><p className="text-sm text-muted-foreground">DM total</p><strong>{preview.calculation ? `${preview.calculation.divisorMultiplicador.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%` : "Composição pendente"}</strong></div><div><p className="text-sm text-muted-foreground">Equivalente total</p><strong>{preview.calculation ? formatBRL(preview.calculation.baseEconomicaInicial - valorOrigem) : "—"}</strong></div></CardContent></Card>
        <div className="space-y-3">{participantes.map((person, index) => <div key={String(person.participantId)} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_150px_170px] sm:items-center"><div className="min-w-0"><p className="font-medium break-words">{person.nome}</p><p className="text-xs text-muted-foreground break-words">{person.cargos?.join(", ") || "Sem cargos"}</p></div><label className="text-sm">DM (%)<Input aria-label={`DM (%) — ${person.nome}`} type="number" min="0" step="0.00001" disabled={readOnly || saveMutation.isPending} value={Number.isFinite(person.indiceContribuicao) ? person.indiceContribuicao : ""} onChange={e => setParticipantes(rows => rows.map((p, i) => i === index ? {...p, indiceContribuicao: e.target.value === "" ? NaN : Number(e.target.value)} : p))} /></label><div><p className="text-xs text-muted-foreground">Equivalente em reais</p><strong>{Number.isFinite(person.indiceContribuicao) && person.indiceContribuicao >= 0 ? formatBRL(initialMapContributionValue(valorOrigem, person.indiceContribuicao)) : "—"}</strong></div></div>)}</div>
        <p className="text-sm text-muted-foreground">DM não é a participação final. Pessoas, cargos e capital são alterados em MAP → MAP Zero → Editar composição.</p>
        {preview.error && <p role="alert" className="text-sm text-amber-700">{preview.error} Complete a composição em <a className="underline" href={`/movimentacao-cotas/${getBiaPublicRef(bia) || bia.id}?view=zero`}>MAP → MAP Zero → Editar composição</a>.</p>}
      </>}
      {historical && !base.revisao && !editing && !readOnly && <Button onClick={() => setEditing(true)}>Revisar composição original</Button>}
      {mode === "zero" && !editing && !(historical && !base.revisao) && <>
        {snapshot.modeloCalculo===5 ? <EconomicMapPreview map={snapshot} moeda={base.moeda}/> : <Card><CardHeader><CardTitle>Composição inicial · revisão {snapshot.revisao}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div>Valor de Origem<strong className="block">{formatBRL(snapshot.valorOrigem)}</strong></div><div>DM<strong className="block">{formatBiaPercent(snapshot.divisorMultiplicador)}</strong></div><div>{snapshot.modeloCalculo===5 ? "Referência patrimonial (VO)" : "BEI"}<strong className="block">{formatBRL(snapshot.baseEconomicaInicial)}</strong></div></div>{snapshot.participantes.map(p => <div key={String(p.participantId)} className="rounded border p-3 text-sm"><strong>{p.nome}</strong><p className="text-muted-foreground">{p.cargos?.join(", ")} · {p.tipo === "guardiao" ? "Guardião" : "Multiplicador"}</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><span>DM: {formatBiaPercent(p.indiceContribuicao)}</span><span>{p.tipoCppCapital?.nome || "CPP Capital"}: {formatBRL(Number(p.cppCapital || 0))}</span><span>{Number(p.modeloCalculo)>=4 ? "Contribuições por cargo" : p.tipoCppContribuicao?.nome || "CPP Origem"}: {formatBRL(Number(p.cppOrigem || 0))}</span><span>CPP Total: {formatBRL(Number(p.cppTotal || 0))}</span><span>Participação: {formatBiaPercent(Number(p.mapPercentual || 0))}</span></div>{p.contribuicoes?.map(c=><p key={c.cargo} className="mt-2 text-muted-foreground">{c.cargo} · {formatBiaPercent(c.indice)} · {c.tipoCpp?.nome || "Sem contribuição"} · {formatBRL(Number(c.valor || 0))}</p>)}</div>)}</CardContent></Card>}
        {!readOnly && <Button onClick={() => setEditing(true)}>Editar composição</Button>}
      </>}
      {mode === "zero" && editing && <fieldset disabled={readOnly || locked || saveMutation.isPending} className="min-w-0 space-y-6 border-0 disabled:opacity-90">
        {snapshot.modeloCalculo === 5 ? <BiaEconomicStructureFields value={{valorOrigem,participantes,estrutura}} onChange={v=>{setValorOrigem(v.valorOrigem);setParticipantes(v.participantes);setEstrutura(v.estrutura);}} members={membros} moeda={base.moeda} readOnly={readOnly || locked}/> : Number(snapshot.modeloCalculo) >= 4 ? <><label>Valor de Origem<BiaNumberInput label="Valor de Origem" value={valorOrigem} onChange={setValorOrigem}/></label><BiaRoleComposition valorOrigem={valorOrigem} moeda={base.moeda} participants={participantes} onChange={setParticipantes} members={membros} readOnly={readOnly || locked}/></> : <MapZeroFields valorOrigem={valorOrigem} setValorOrigem={setValorOrigem} participantes={participantes} setParticipantes={setParticipantes} membros={membros} byValue={byValue} readOnly={readOnly || locked} />}
      </fieldset>}
      {(mode === "dm" || editing) && <div className="space-y-3">
        {(snapshot.ativa || historical) && !readOnly && <label className="block space-y-2 text-sm">{historical ? "Fonte dos dados originais e motivo da revisão" : "Motivo da correção"}<Input disabled={saveMutation.isPending} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={historical ? "Ex.: composição conferida no MOU original" : "Explique o que precisa ser corrigido"} /></label>}
        {historical && !readOnly && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={saveMutation.isPending} onChange={e => setReviewed(e.target.checked)} />Revisei a composição original e entendo que este registro não altera o MAP Atual.</label>}
        <div className="flex flex-wrap gap-2">{!readOnly && <Button onClick={() => saveMutation.mutate()} disabled={!preview.calculation || saveMutation.isPending || ((snapshot.ativa || historical) && !motivo.trim()) || (historical && !reviewed)}>{saveMutation.isPending ? "Salvando…" : historical ? "Confirmar composição original" : mode === "dm" ? "Salvar DM" : "Salvar MAP Zero"}</Button>}
        {mode === "dm" ? <Button variant="outline" onClick={() => navigate(`/movimentacao-cotas/${getBiaPublicRef(bia) || bia.id}`)}>Abrir MAP</Button> : <Button variant="outline" disabled={saveMutation.isPending} onClick={() => { if (confirmDiscardChanges()) { setValorOrigem(Number(snapshot.valorOrigem)); setParticipantes(snapshot.participantes); setBase(snapshot); setMotivo(""); setEditing(false); } }}>Cancelar edição</Button>}</div>
      </div>}

      {mode === "zero" && (!historical || base.revisao > 0) && <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">Comparar MAP Zero × MAP Atual</summary>
      <Card>
        <CardHeader><CardTitle className="text-lg">MAP Zero × MAP Atual</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">O MAP Atual considera a base vigente, os aportes {byValue ? "adicionais pagos" : "pagos"} e as transferências aceitas.</p>
          {mapQuery.isError && <p role="alert" className="text-sm text-red-600">Não foi possível consultar o MAP Atual.</p>}
          <div className="space-y-2 sm:hidden">{(mapQuery.data && !mapQuery.isError ? comparisonParticipants : []).map((item) => { const current = mapQuery.data?.atual.find((row) => row.memberId === (item.memberId || item.participantId)); return <div key={String(item.participantId)} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{item.nome}</p><div className="mt-2 grid grid-cols-2 gap-2 text-xs"><div><p className="text-muted-foreground">CPP Inicial</p><p>{formatBRL(Number(item.cppTotal || 0))}</p></div><div><p className="text-muted-foreground">MAP Zero</p><p>{Number(item.mapPercentual || 0).toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%</p></div><div><p className="text-muted-foreground">Valor atual</p><p>{formatBRL(Number(current?.value || 0))}</p></div><div><p className="text-muted-foreground">MAP Atual</p><p>{Number(current?.percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%</p></div></div></div>; })}</div>
          <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Participante</th><th className="py-2 pr-3 text-right">CPP Inicial</th><th className="py-2 pr-3 text-right">MAP Zero</th><th className="py-2 pr-3 text-right">Valor atual</th><th className="py-2 text-right">MAP Atual</th></tr></thead><tbody>{(mapQuery.data && !mapQuery.isError ? comparisonParticipants : []).map((item) => { const current = mapQuery.data?.atual.find((row) => row.memberId === (item.memberId || item.participantId)); return <tr key={String(item.participantId)} className="border-b last:border-0"><td className="py-2 pr-3 font-medium">{item.nome}</td><td className="py-2 pr-3 text-right">{formatBRL(Number(item.cppTotal || 0))}</td><td className="py-2 pr-3 text-right">{Number(item.mapPercentual || 0).toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%</td><td className="py-2 pr-3 text-right">{formatBRL(Number(current?.value || 0))}</td><td className="py-2 text-right">{Number(current?.percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%</td></tr>; })}</tbody></table></div>
        </CardContent>
      </Card>
      </details>}
    </div>
  );
}

export default function BiasCalculadoraPage({
  initialBiaId = null,
  embedded = false,
  readOnly = false,
}: {
  initialBiaId?: string | null;
  embedded?: boolean;
  readOnly?: boolean;
} = {}) {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const userRole = user?.role || "";
  const userEmail = String(user?.email || "").trim().toLowerCase();
  const isSuperAdmin =
    userRole === "admin" ||
    userRole === "manager" ||
    userRole === "superadmin" ||
    userRole === "master" ||
    userEmail === "seitikatsumi@gmail.com";
  const [selectedBiaId, setSelectedBiaId] = useState<string>(initialBiaId || "");
  const [cppSummary, setCppSummary] = useState<CppSummary | null>(null);
  const [cppError, setCppError] = useState<string | null>(null);
  const [showCppDetails, setShowCppDetails] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showRangeTable, setShowRangeTable] = useState(false);
  const [editingRangeIndex, setEditingRangeIndex] = useState<number | null>(null);
  const [institutionalRanges, setInstitutionalRanges] = useState<InstitutionalPercentageRange[]>(() => loadDmRanges());

  const { data: biasRaw = [], isLoading: loadingBias } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const bias = useMemo(() => biasRaw || [], [biasRaw]);
  const selectedBia = useMemo(() => bias.find(b => b.id === selectedBiaId), [bias, selectedBiaId]);
  const pendingFlowBypassed = isBiaPendingBypassed(selectedBia);
  const initialMapQuery = useInitialMapSnapshot(selectedBiaId);

  const { data: diretorSolicitacoesPendentes = [] } = useQuery<BiaDiretorSolicitacao[]>({
    queryKey: ["/api/bia-diretor-solicitacoes/bia", selectedBiaId],
    queryFn: async () => {
      if (!selectedBiaId) return [];
      const res = await fetch(`/api/bia-diretor-solicitacoes/bia/${selectedBiaId}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedBiaId && !pendingFlowBypassed,
  });

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
  });

  // Member selections per role
  const [membroAutorOpa, setMembroAutorOpa] = useState<string>("");
  const [membroAliadoBuilt, setMembroAliadoBuilt] = useState<string>("");
  const [membroDirTecnico, setMembroDirTecnico] = useState<string>("");
  const [membroDirNucleoTecnico, setMembroDirNucleoTecnico] = useState<string>("");
  const [membroDirObras, setMembroDirObras] = useState<string>("");
  const [membroDirComercial, setMembroDirComercial] = useState<string>("");
  const [membroDirCapital, setMembroDirCapital] = useState<string>("");

  useEffect(() => {
    if (initialBiaId && selectedBiaId !== initialBiaId) {
      setSelectedBiaId(initialBiaId);
      setCppSummary(null);
      setCppError(null);
      setShowCppDetails(false);
    }
  }, [initialBiaId, selectedBiaId]);

  // Forma de pagamento
  const [biaValorOrigem, setBiaValorOrigem] = useState(0); // valor salvo no Directus (fallback)
  const [valorAVista, setValorAVista] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [numeroParcelas, setNumeroParcelas] = useState<string>("");
  const [vencimento, setVencimento] = useState<string>("");
  const [vencimentosParcelas, setVencimentosParcelas] = useState<string[]>([]);
  const [valoresParcelas, setValoresParcelas] = useState<number[]>([]);
  const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);

  const numParcelasInt = parseInt(numeroParcelas) || 0;

  // valorOrigem é derivado da forma de pagamento
  const valorOrigem = useMemo(() => {
    if (formaPagamento === "parcelado") return valoresParcelas.reduce((s, v) => s + (v || 0), 0);
    if (formaPagamento === "a_vista") return valorAVista;
    return biaValorOrigem;
  }, [formaPagamento, valoresParcelas, valorAVista, biaValorOrigem]);
  const institutionalRange = useMemo(
    () => getInstitutionalPercentageRange(valorOrigem, institutionalRanges),
    [valorOrigem, institutionalRanges]
  );
  const institutionalPercent = institutionalRange?.percentual ?? null;

  const [percAutor, setPercAutor] = useState(0);
  const [percAliado, setPercAliado] = useState(0);
  const [percBuilt, setPercBuilt] = useState(0);
  const [percTecnico, setPercTecnico] = useState(0);
  const [percAlianca, setPercAlianca] = useState(0);
  const [percObras, setPercObras] = useState(0);
  const [percComercial, setPercComercial] = useState(0);
  const [percCapital, setPercCapital] = useState(0);
  const applyPercentualMin = (value: number, min = 0) => {
    if (isSuperAdmin) return Math.max(value, 0);
    return Math.max(value, min);
  };

  // Receita & impostos
  const [vgv, setVgv] = useState(0);
  const [valorRealizadoVenda, setValorRealizadoVenda] = useState(0);
  const [comissaoCorretor, setComissaoCorretor] = useState(0);
  const [irPrevisto, setIrPrevisto] = useState(0);
  const [inssPrevisto, setInssPrevisto] = useState(0);
  const [manutencao, setManutencao] = useState(0);

  // Estimate how many Directus entries will be created/deleted during sync
  const activeContributors = 1 // BUILT always
    + (membroAutorOpa && percAutor > 0 ?1 : 0)
    + (membroAliadoBuilt && percAliado > 0 ?1 : 0)
    + (membroDirTecnico && percAlianca > 0 ?1 : 0)
    + (membroDirNucleoTecnico && percTecnico > 0 ?1 : 0)
    + (membroDirObras && percObras > 0 ?1 : 0)
    + (membroDirComercial && percComercial > 0 ?1 : 0)
    + (membroDirCapital && percCapital > 0 ?1 : 0);
  const estimatedEntries = (formaPagamento === "parcelado" ?numParcelasInt : 1) * (1 + activeContributors);
  // ~0.5s per entry (create + amortised cleanup): conservative estimate
  const estimatedSeconds = Math.round(estimatedEntries * 0.5);
  const needsWarning = formaPagamento === "parcelado" && numParcelasInt > 10;
  const estimatedLabel = estimatedSeconds >= 60
    ?`~${Math.ceil(estimatedSeconds / 60)} min`
    : `~${estimatedSeconds}s`;

  useEffect(() => {
    if (authLoading) return;
    if (selectedBia) {
      setBiaValorOrigem(toNum(selectedBia.valor_origem));
      // Reset payment form when BIA changes — each BIA has its own forma de pagamento
      setFormaPagamento("");
      setNumeroParcelas("");
      setVencimento("");
      setVencimentosParcelas([]);
      setValoresParcelas([]);
      setValorAVista(0);
      setPercAutor(toNum(selectedBia.perc_autor_opa));
      setPercAliado(applyPercentualMin(toNum(selectedBia.perc_aliado_built), 1));
      setPercBuilt(applyPercentualMin(toNum(selectedBia.perc_built), 1));
      setPercTecnico(toNum(selectedBia.perc_dir_tecnico));
      setPercAlianca(applyPercentualMin(toNum(selectedBia.perc_dir_alianca), 1));
      setPercObras(toNum(selectedBia.perc_dir_obras));
      setPercComercial(toNum(selectedBia.perc_dir_comercial));
      setPercCapital(toNum(selectedBia.perc_dir_capital));
      setVgv(toNum(selectedBia.valor_geral_venda_vgv));
      setValorRealizadoVenda(toNum(selectedBia.valor_realizado_venda));
      setComissaoCorretor(toNum(selectedBia.comissao_prevista_corretor));
      setIrPrevisto(toNum(selectedBia.ir_previsto));
      setInssPrevisto(toNum(selectedBia.inss_previsto));
      setManutencao(toNum(selectedBia.manutencao_pos_obra_prevista));
      // Load member selections
      setMembroAutorOpa(selectedBia.autor_bia || "");
      setMembroAliadoBuilt(selectedBia.aliado_built || "");
      setMembroDirTecnico(selectedBia.diretor_alianca || "");
      setMembroDirNucleoTecnico(selectedBia.diretor_nucleo_tecnico || "");
      setMembroDirObras(selectedBia.diretor_execucao || "");
      setMembroDirComercial(selectedBia.diretor_comercial || "");
      setMembroDirCapital(selectedBia.diretor_capital || "");
    }
  }, [selectedBia, isSuperAdmin, authLoading]);

  // Auto-zero percentage when member is cleared for member-dependent roles
  useEffect(() => {
    if (authLoading) return;
    if (!membroAutorOpa) {
      setPercAutor(0);
    }
  }, [membroAutorOpa, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!membroAliadoBuilt) {
      setPercAliado(0);
    } else if (!isSuperAdmin && percAliado === 0) {
      setPercAliado(1);
    }
  }, [membroAliadoBuilt, isSuperAdmin, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!membroDirNucleoTecnico) {
      setPercTecnico(0);
    } else if (!isSuperAdmin && percTecnico === 0) {
      setPercTecnico(2);
    }
  }, [membroDirNucleoTecnico, isSuperAdmin, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!membroDirObras) {
      setPercObras(0);
    } else if (!isSuperAdmin && percObras === 0) {
      setPercObras(2);
    }
  }, [membroDirObras, isSuperAdmin, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!membroDirComercial) {
      setPercComercial(0);
    } else if (!isSuperAdmin && percComercial === 0) {
      setPercComercial(2);
    }
  }, [membroDirComercial, isSuperAdmin, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!membroDirCapital) {
      setPercCapital(0);
    } else if (!isSuperAdmin && percCapital === 0) {
      setPercCapital(2);
    }
  }, [membroDirCapital, isSuperAdmin, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (isSuperAdmin) return;
    if (institutionalPercent === null) return;
    setPercAliado(applyPercentualMin(institutionalPercent, 1));
    setPercBuilt(applyPercentualMin(institutionalPercent, 1));
    setPercAlianca(applyPercentualMin(institutionalPercent, 1));
  }, [institutionalPercent, valorOrigem, selectedBiaId, isSuperAdmin, authLoading]);

  // Calculations
  const divisorMultiplicador = percAutor + percAliado + percBuilt + percTecnico + percAlianca + percObras + percComercial + percCapital;
  const custoOrigemBia = valorOrigem + (valorOrigem * divisorMultiplicador / 100);
  const cppAutor = valorOrigem * percAutor / 100;
  const cppAliado = valorOrigem * percAliado / 100;
  const cppBuilt = valorOrigem * percBuilt / 100;
  const cppTecnico = valorOrigem * percTecnico / 100;
  const cppAlianca = valorOrigem * percAlianca / 100;
  const cppObras = valorOrigem * percObras / 100;
  const cppComercial = valorOrigem * percComercial / 100;
  const cppCapital = valorOrigem * percCapital / 100;
  const custoFinalPrevisto = cppAutor + cppAliado + cppBuilt + cppTecnico + cppAlianca + cppObras + cppComercial + cppCapital;

  // Total Aporte do Fator de Multiplicação — entrada entries generated per director with a member assigned
  // Deduções são percentuais sobre o valor realizado de venda
  const comissaoValor    = (comissaoCorretor / 100) * valorRealizadoVenda;
  const irValor          = (irPrevisto       / 100) * valorRealizadoVenda;
  const inssValor        = (inssPrevisto     / 100) * valorRealizadoVenda;
  const manutencaoValor  = (manutencao       / 100) * valorRealizadoVenda;
  const totalDeducoes = comissaoValor + irValor + inssValor + manutencaoValor;
  const totalReceita = valorRealizadoVenda - totalDeducoes;
  const resultadoLiquido = totalReceita - custoFinalPrevisto;
  const lucroPrevisto = valorRealizadoVenda > 0 ?((resultadoLiquido / valorRealizadoVenda) * 100) : 0;

  const rolePendingByLabel = useMemo(() => {
    if (pendingFlowBypassed) return {};
    if (!selectedBia) return {};
    const fields: Array<{ label: string; field: keyof BiasProjeto; selectedId: string }> = [
      { label: "Aliado BUILT", field: "aliado_built", selectedId: membroAliadoBuilt },
      { label: "Dir. de Aliança", field: "diretor_alianca", selectedId: membroDirTecnico },
      { label: "Autor da Oportunidade", field: "autor_bia", selectedId: membroAutorOpa },
      { label: "Dir. Núcleo Técnico", field: "diretor_nucleo_tecnico", selectedId: membroDirNucleoTecnico },
      { label: "Dir. Núcleo de Obra", field: "diretor_execucao", selectedId: membroDirObras },
      { label: "Dir. Núcleo Comercial", field: "diretor_comercial", selectedId: membroDirComercial },
      { label: "Dir. Núcleo de Capital", field: "diretor_capital", selectedId: membroDirCapital },
    ];
    return fields.reduce<Record<string, boolean>>((acc, item) => {
      if (!item.selectedId) return acc;
      const savedId = String(selectedBia[item.field] || "");
      const hasPendingSolicitacao = diretorSolicitacoesPendentes.some((solicitacao) =>
        solicitacao.status === "pendente" &&
        solicitacao.campo_diretor === item.field &&
        solicitacao.diretor_membro_id === item.selectedId
      );
      acc[item.label] = hasPendingSolicitacao || item.selectedId !== savedId;
      return acc;
    }, {});
  }, [
    diretorSolicitacoesPendentes,
    membroAliadoBuilt,
    membroAutorOpa,
    membroDirCapital,
    membroDirComercial,
    membroDirNucleoTecnico,
    membroDirObras,
    membroDirTecnico,
    pendingFlowBypassed,
    selectedBia,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBiaId) throw new Error("Selecione uma BIA");
      if (!selectedBia) throw new Error("Aguarde os dados da BIA terminarem de carregar.");
      if (formaPagamento === "a_vista" && valorAVista <= 0) {
        throw new Error("Informe um valor de origem maior que zero.");
      }
      if (
        formaPagamento === "parcelado" &&
        (numParcelasInt <= 1 || valoresParcelas.length !== numParcelasInt || valoresParcelas.some((value) => value <= 0))
      ) {
        throw new Error("Preencha o valor de todas as parcelas antes de salvar.");
      }
      const r = (v: number) => parseFloat(v.toFixed(2));
      const percAutorSave = membroAutorOpa ? percAutor : 0;
      const percAliadoSave = membroAliadoBuilt ? percAliado : 0;
      const percBuiltSave = percBuilt;
      const percTecnicoSave = membroDirNucleoTecnico ? percTecnico : 0;
      const percAliancaSave = membroDirTecnico ? percAlianca : 0;
      const percObrasSave = membroDirObras ? percObras : 0;
      const percComercialSave = membroDirComercial ? percComercial : 0;
      const percCapitalSave = membroDirCapital ? percCapital : 0;
      const divisorMultiplicadorSave =
        percAutorSave +
        percAliadoSave +
        percBuiltSave +
        percTecnicoSave +
        percAliancaSave +
        percObrasSave +
        percComercialSave +
        percCapitalSave;
      const payload = {
        divisor_multiplicador: r(divisorMultiplicadorSave),
        perc_autor_opa: r(percAutorSave),
        perc_aliado_built: r(percAliadoSave),
        perc_built: r(percBuiltSave),
        perc_dir_tecnico: r(percTecnicoSave),
        perc_dir_alianca: r(percAliancaSave),
        perc_dir_obras: r(percObrasSave),
        perc_dir_comercial: r(percComercialSave),
        perc_dir_capital: r(percCapitalSave),
        cpp_autor_opa: r(valorOrigem * percAutorSave / 100),
        cpp_aliado_built: r(valorOrigem * percAliadoSave / 100),
        cpp_built: r(valorOrigem * percBuiltSave / 100),
        cpp_dir_tecnico: r(valorOrigem * percTecnicoSave / 100),
        cpp_dir_alianca: r(valorOrigem * percAliancaSave / 100),
        cpp_dir_obras: r(valorOrigem * percObrasSave / 100),
        cpp_dir_comercial: r(valorOrigem * percComercialSave / 100),
        cpp_dir_capital: r(valorOrigem * percCapitalSave / 100),
        custo_origem_bia: r(valorOrigem + (valorOrigem * divisorMultiplicadorSave / 100)),
        custo_final_previsto: r(valorOrigem * divisorMultiplicadorSave / 100),
        valor_geral_venda_vgv: r(vgv),
        valor_realizado_venda: r(valorRealizadoVenda),
        comissao_prevista_corretor: r(comissaoCorretor),
        ir_previsto: r(irPrevisto),
        inss_previsto: r(inssPrevisto),
        manutencao_pos_obra_prevista: r(manutencao),
      };
      const res = await apiRequest("PATCH", `/api/bias/${selectedBiaId}`, {
        ...payload,
        valor_origem: r(valorOrigem),
        _vencimento_origem: formaPagamento === "parcelado" ?null : (vencimento || null),
        _forma_pagamento: formaPagamento || null,
        _numero_parcelas: formaPagamento === "parcelado" ?numParcelasInt : null,
        _vencimentos_parcelas: formaPagamento === "parcelado" ?vencimentosParcelas : [],
        _valores_parcelas: formaPagamento === "parcelado" ?valoresParcelas : [],
        // Member selections needed for CPP lançamentos generation
        autor_bia: membroAutorOpa || null,
        aliado_built: membroAliadoBuilt || null,
        diretor_alianca: membroDirTecnico || null,
        diretor_nucleo_tecnico: membroDirNucleoTecnico || null,
        diretor_execucao: membroDirObras || null,
        diretor_comercial: membroDirComercial || null,
        diretor_capital: membroDirCapital || null,
      });
      return res.json();
    },
    onSuccess: (data: SaveBiaResponse) => {
      setBiaValorOrigem(toNum((data?.valor_origem as string | number | null | undefined) ?? valorOrigem));
      queryClient.setQueryData<BiasProjeto[]>(["/api/bias"], (current = []) =>
        current.map((bia) => bia.id === selectedBiaId ? { ...bia, ...data } : bia)
      );
      queryClient.invalidateQueries({ queryKey: ["/api/bias"] });
      setCppError(null);
      setShowCppDetails(false);
      if (data?._cppError) {
        setCppSummary(null);
        const safeErr = typeof data._cppError === "string" ?data._cppError.slice(0, 200) : "Erro desconhecido";
        setCppError(safeErr);
        toast({ title: "Salvo com sucesso", description: "Os cálculos foram salvos, mas houve um erro ao gerar os lançamentos CPP.", variant: "destructive" });
      } else if (data?._cppSummary) {
        const s = data._cppSummary;
        setCppSummary(s);
        const parcelasText = s.parcelas > 1 ?`${s.parcelas} parcelas` : "1 parcela";
        const countText = s.cppCount > 0
          ?`${s.cppCount} lançamento${s.cppCount !== 1 ?"s" : ""} CPP gerado${s.cppCount !== 1 ?"s" : ""} para ${parcelasText}`
          : "Nenhum lançamento CPP gerado";
        toast({ title: "Salvo com sucesso", description: countText });
      } else {
        setCppSummary(null);
        toast({ title: "Salvo com sucesso", description: "Os cálculos foram salvos no Directus." });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const percFields = [
    { label: "Aliado BUILT", icon: Users, value: percAliado, setter: setPercAliado, cpp: cppAliado, color: "text-blue-500", memberId: membroAliadoBuilt, memberSetter: setMembroAliadoBuilt, min: 1 },
    { label: "BUILT", icon: Building2, value: percBuilt, setter: setPercBuilt, cpp: cppBuilt, color: "text-brand-gold", memberId: null, memberSetter: null, min: 1 },
    { label: "Dir. de Aliança", icon: Crown, value: percAlianca, setter: setPercAlianca, cpp: cppAlianca, color: "text-indigo-500", memberId: membroDirTecnico, memberSetter: setMembroDirTecnico, min: 1 },
    { label: "Autor da Oportunidade", icon: Target, value: percAutor, setter: setPercAutor, cpp: cppAutor, color: "text-cyan-500", memberId: membroAutorOpa, memberSetter: setMembroAutorOpa },
    { label: "Dir. Núcleo Técnico", icon: Shield, value: percTecnico, setter: setPercTecnico, cpp: cppTecnico, color: "text-purple-500", memberId: membroDirNucleoTecnico, memberSetter: setMembroDirNucleoTecnico },
    { label: "Dir. Núcleo de Obra", icon: Hammer, value: percObras, setter: setPercObras, cpp: cppObras, color: "text-orange-500", memberId: membroDirObras, memberSetter: setMembroDirObras },
    { label: "Dir. Núcleo Comercial", icon: Briefcase, value: percComercial, setter: setPercComercial, cpp: cppComercial, color: "text-green-500", memberId: membroDirComercial, memberSetter: setMembroDirComercial },
    { label: "Dir. Núcleo de Capital", icon: Wallet, value: percCapital, setter: setPercCapital, cpp: cppCapital, color: "text-red-500", memberId: membroDirCapital, memberSetter: setMembroDirCapital },
  ];

  function updateInstitutionalRange(index: number, patch: Partial<InstitutionalPercentageRange>) {
    setInstitutionalRanges((current) => {
      const next = current.map((range, rangeIndex) => {
        if (rangeIndex !== index) return range;
        const maxValue = Math.max(0, patch.maxValue ?? range.maxValue);
        const percentual = Math.max(0, patch.percentual ?? range.percentual);
        return {
          ...range,
          ...patch,
          maxValue,
          percentual,
          label: patch.maxValue !== undefined ?formatDmRangeLabel(maxValue) : range.label,
        };
      });
      saveDmRanges(next);
      return next;
    });
  }

  if (loadingBias || (!!selectedBiaId && initialMapQuery.isLoading)) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (selectedBia && initialMapQuery.data) {
    return (
      <MapInicialCalculator
        key={selectedBia.id}
        snapshot={initialMapQuery.data}
        queryFailed={initialMapQuery.isError}
        retryQuery={() => initialMapQuery.refetch()}
        bia={selectedBia}
        bias={bias}
        membros={membros}
        embedded={embedded}
        readOnly={readOnly}
        onSelectBia={(id) => {
          setSelectedBiaId(id);
          setCppSummary(null);
          setCppError(null);
          setShowCppDetails(false);
        }}
      />
    );
  }

  if (selectedBia && initialMapQuery.isError) {
    return <div className="p-6"><div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{(initialMapQuery.error as Error).message}</div></div>;
  }

  return (
    <fieldset disabled={readOnly} className={`${embedded ? "p-0 max-w-none" : "p-6 max-w-7xl mx-auto"} min-w-0 space-y-6 border-0`}>
      {readOnly && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Acesso somente para visualização.</div>}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
              <Calculator className="w-6 h-6" />
            </div>
            Calculadora DM
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {!embedded && (
            <Select value={selectedBiaId} onValueChange={(id) => { setSelectedBiaId(id); setCppSummary(null); setCppError(null); setShowCppDetails(false); }}>
              <SelectTrigger className="w-[280px]" data-testid="select-bia">
                <SelectValue placeholder="Selecione uma BIA..." />
              </SelectTrigger>
              <SelectContent>
                {bias.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={() => needsWarning ?setShowSaveConfirm(true) : saveMutation.mutate()}
            disabled={!selectedBiaId || !selectedBia || loadingBias || saveMutation.isPending}
            className="bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-200 disabled:text-white"
            data-testid="button-save"
          >
            {saveMutation.isPending ?(
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Atualizar valores na BIA
          </Button>
        </div>
      </div>

      {/* Loading banner — shown while sync is running */}
      {saveMutation.isPending && needsWarning && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-3" data-testid="banner-saving">
          <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          <div>
            <span className="font-medium">Gerando {estimatedEntries} lançamentos…</span>
            <span className="ml-2 text-amber-700 dark:text-amber-400">Tempo estimado: <strong>{estimatedLabel}</strong>. Não feche ou recarregue esta página.</span>
          </div>
        </div>
      )}

      {/* Confirmation dialog for large syncs */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar geração de lançamentos</AlertDialogTitle>
            <AlertDialogDescription>
              Esta operação vai gerar <strong>{estimatedEntries} lançamentos</strong> no Directus
              ({numParcelasInt} parcelas × {1 + activeContributors} entradas por parcela).
              <br /><br />
              Tempo estimado: <strong>{estimatedLabel}</strong>. A página ficará em carregamento durante este tempo — não a feche nem recarregue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => saveMutation.mutate()}>
              Confirmar e gerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CPP Lançamentos status panel */}
      {(cppSummary || cppError) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${cppError ?"border-destructive/50 bg-destructive/10 text-destructive" : "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"}`}
          data-testid="panel-cpp-status"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {cppError ?(
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              {cppError ?(
                <span>Erro ao gerar lançamentos CPP: {cppError}</span>
              ) : cppSummary && cppSummary.cppCount > 0 ?(
                <span>
                  <strong>{cppSummary.cppCount}</strong> lançamento{cppSummary.cppCount !== 1 ?"s" : ""} CPP gerado{cppSummary.cppCount !== 1 ?"s" : ""} para{" "}
                  <strong>{cppSummary.parcelas}</strong> parcela{cppSummary.parcelas !== 1 ?"s" : ""}
                </span>
              ) : (
                <span>Nenhum lançamento CPP gerado (sem contribuidores configurados ou percentuais zerados)</span>
              )}
            </div>
            {!cppError && cppSummary && cppSummary.contributorLabels.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCppDetails(!showCppDetails)}
                className="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity shrink-0"
                data-testid="button-toggle-cpp-details"
              >
                {showCppDetails ?<ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showCppDetails ?"Ocultar" : "Ver"} detalhes
              </button>
            )}
          </div>
          {showCppDetails && cppSummary && cppSummary.contributorLabels.length > 0 && (
            <ul className="mt-2 ml-6 space-y-0.5 list-disc" data-testid="list-cpp-contributors">
              {cppSummary.contributorLabels.map((label) => (
                <li key={label} className="text-xs opacity-80">{label}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!selectedBiaId ?(
        <Card>
          <CardContent className="p-12 text-center">
            <Calculator className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">Selecione uma BIA para iniciar</h3>
            <p className="text-sm text-muted-foreground/70 mt-2">Escolha um projeto de aliança no seletor acima para calcular a gestão financeira</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-brand-gold/30" data-testid="panel-valor-origem">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Forma de Pagamento do Ativo de Origem</CardTitle>
                <CreditCard className="w-4 h-4 text-brand-gold" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Pagamento button — sempre no topo */}
                  <button
                    type="button"
                    onClick={() => setPagamentoModalOpen(true)}
                    className="w-full rounded-lg border border-dashed border-brand-gold/40 bg-brand-gold/5 hover:bg-brand-gold/10 transition-colors p-3 text-left space-y-1"
                    data-testid="button-open-pagamento"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium flex items-center gap-1.5 text-brand-gold">
                        <CreditCard className="w-3.5 h-3.5" />
                        Lançar Forma de Pagamento do Ativo de Origem
                      </span>
                      {formaPagamento && <span className="text-[10px] text-muted-foreground">✎ editar</span>}
                    </div>
                    {formaPagamento ?(
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>{formaPagamento === "a_vista" ?"À Vista" : `Parcelado em ${numeroParcelas}x`}</div>
                        {formaPagamento === "parcelado" && numParcelasInt > 0 && (
                          <div>{vencimentosParcelas.filter(v => v).length}/{numParcelasInt} datas · {valoresParcelas.filter(v => v > 0).length}/{numParcelasInt} valores</div>
                        )}
                        {formaPagamento === "a_vista" && vencimento && (
                          <div>Vence: {new Date(vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60">Clique para definir forma de pagamento e valores</p>
                    )}
                  </button>

                  {/* Valor de Origem — calculado pela forma de pagamento */}
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[11px] text-muted-foreground mb-1">Valor de Origem</p>
                    <p className="text-2xl font-bold text-brand-gold tabular-nums" data-testid="text-valor-origem">
                      {valorOrigem.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {formaPagamento === "parcelado" ?"Soma das parcelas" : formaPagamento === "a_vista" ?"Valor à vista" : "Valor salvo no projeto"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30" data-testid="panel-divisor">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Divisor Multiplicador</CardTitle>
                <Percent className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{formatPerc(divisorMultiplicador)}</p>
                <p className="text-xs text-muted-foreground mt-1">Soma de todos os percentuais</p>
              </CardContent>
            </Card>

            <Card className="border-green-500/30" data-testid="panel-custo-origem">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Custo de Origem da BIA</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{formatBRL(custoOrigemBia)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatBRL(valorOrigem)} + ({formatPerc(divisorMultiplicador)})
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Percentuais e CPPs */}
          <Card data-testid="panel-percentuais">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Percent className="w-5 h-5 text-brand-gold" />
                Fatores de Multiplicação
              </CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Range aplicado a Aliado BUILT, BUILT e Dir. de Aliança:{" "}
                  <span className="font-semibold text-foreground">
                    {institutionalPercent !== null ?formatPerc(institutionalPercent) : "sob proposta"}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRangeTable((current) => !current)}
                  className="h-8 justify-center gap-2"
                  data-testid="button-range-percentuais"
                >
                  <Percent className="h-3.5 w-3.5" />
                  Ranges
                  {showRangeTable ?<ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showRangeTable && (
                <div className="overflow-hidden rounded-lg border border-border" data-testid="table-range-percentuais">
                  <table className="w-full text-xs">
                    <thead className="bg-[#001D34] text-white">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Valor de Origem da BIA</th>
                        <th className="px-3 py-2 text-left font-semibold">Direito Econômico Institucional</th>
                      </tr>
                    </thead>
                    <tbody>
                      {institutionalRanges.map((range, index) => {
                        const active = institutionalRange?.maxValue === range.maxValue;
                        const editing = isSuperAdmin && editingRangeIndex === index;
                        return (
                          <tr key={index} className={active ?"bg-brand-gold/10" : "bg-background"}>
                            <td className="border-t border-border px-3 py-2">
                              {editing ?(
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Até R$</span>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={numToBRLStr(range.maxValue)}
                                    onChange={(event) => {
                                      const formatted = formatInputBRL(event.target.value);
                                      updateInstitutionalRange(index, { maxValue: parseBRLCalc(formatted) });
                                    }}
                                    className="h-7 max-w-36 text-xs tabular-nums"
                                    data-testid={`input-range-valor-${index}`}
                                  />
                                </div>
                              ) : (
                                range.label
                              )}
                            </td>
                            <td className="border-t border-border px-3 py-2 font-semibold">
                              <div className="flex items-center justify-between gap-2">
                                {editing ?(
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={range.percentual}
                                      onChange={(event) => updateInstitutionalRange(index, { percentual: parseFloat(event.target.value) || 0 })}
                                      className="h-7 max-w-24 text-xs tabular-nums"
                                      data-testid={`input-range-percentual-${index}`}
                                    />
                                    <span>sobre o Valor de Origem</span>
                                  </div>
                                ) : (
                                  <span>{formatPerc(range.percentual)} sobre o Valor de Origem</span>
                                )}
                                {isSuperAdmin && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => setEditingRangeIndex(editing ?null : index)}
                                    data-testid={`button-edit-range-${index}`}
                                    aria-label={editing ? "Concluir edição do range" : "Editar range"}
                                  >
                                    {editing ?(
                                      <Check className="h-3.5 w-3.5" />
                                    ) : (
                                      <Pencil className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className={!institutionalRange && valorOrigem > 75_000_000 ?"bg-brand-gold/10" : "bg-background"}>
                        <td className="border-t border-border px-3 py-2">Acima de R$ 75 milhões</td>
                        <td className="border-t border-border px-3 py-2 font-semibold">Sob proposta</td>
                      </tr>
                      <tr className="bg-background">
                        <td className="border-t border-border px-3 py-2">Enterprise / institucional</td>
                        <td className="border-t border-border px-3 py-2 font-semibold">Sob proposta</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {percFields.map((field, idx) => {
                  const Icon = field.icon;
                  return (
                    <Card key={idx} className="border-border/50" data-testid={`perc-card-${idx}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${field.color}`} />
                          <span className="text-sm font-medium truncate">{field.label}</span>
                        </div>

                        {/* Member selector */}
                        {field.memberSetter !== null && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Membro</Label>
                            <MemberSelect
                              value={field.memberId || ""}
                              onChange={field.memberSetter}
                              membros={membros}
                              label={field.label}
                              pending={!!rolePendingByLabel[field.label]}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Percentual (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={isSuperAdmin ?0 : ((field as any).min ?? 0)}
                              value={Number.isFinite(field.value) ? field.value : ""}
                              disabled={field.memberSetter !== null && !(field as any).min && !field.memberId}
                              onChange={(e) => {
                                const raw = parseFloat(e.target.value) || 0;
                                const minVal = (field as any).min ?? 0;
                                field.setter(applyPercentualMin(raw, minVal));
                              }}
                              className="h-8 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              placeholder="0,00"
                              data-testid={`input-perc-${idx}`}
                            />
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ArrowRight className="w-3 h-3" />
                            <span>CPP:</span>
                          </div>
                          <p className="text-sm font-semibold" data-testid={`text-cpp-${idx}`}>
                            {formatBRL(field.cpp)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Card className="border-brand-gold/30 bg-brand-gold/5" data-testid="panel-total-perc">
                  <CardContent className="p-4 flex flex-col justify-center h-full space-y-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-brand-gold" />
                      <span className="text-sm font-medium">Totais</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Divisor Multiplicador:</span>
                        <Badge variant="outline">{formatPerc(divisorMultiplicador)}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">CPP Total:</span>
                        <Badge variant="outline">{formatBRL(custoFinalPrevisto)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Receita, Impostos e Resultado */}
          {false && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Receita */}
            <Card data-testid="panel-receita">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="w-5 h-5 text-green-500" />
                  Receita
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NumInput
                  label="VGV — Valor Geral de Venda"
                  value={vgv}
                  onChange={setVgv}
                  testId="input-vgv"
                  hint="Valor total previsto de venda"
                />
                <NumInput
                  label="Valor Realizado de Venda"
                  value={valorRealizadoVenda}
                  onChange={setValorRealizadoVenda}
                  testId="input-valor-realizado"
                  hint="Valor efetivamente realizado"
                />
                <Separator />
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-muted-foreground">Total de Receita</span>
                  <span className={`text-lg font-bold ${totalReceita >= 0 ?"text-green-600" : "text-red-600"}`} data-testid="text-total-receita">
                    {formatBRL(totalReceita)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Valor realizado − deduções</p>
              </CardContent>
            </Card>

            {/* Deduções */}
            <Card data-testid="panel-deducoes">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="w-5 h-5 text-red-500" />
                  Deduções e Impostos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <PercInput
                  label="Comissão Prevista Corretor"
                  value={comissaoCorretor}
                  onChange={setComissaoCorretor}
                  testId="input-comissao"
                  baseValue={valorRealizadoVenda}
                  hint="% sobre o valor realizado de venda"
                />
                <PercInput
                  label="IR Previsto"
                  value={irPrevisto}
                  onChange={setIrPrevisto}
                  testId="input-ir"
                  baseValue={valorRealizadoVenda}
                  hint="% sobre o valor realizado de venda"
                />
                <PercInput
                  label="INSS Previsto"
                  value={inssPrevisto}
                  onChange={setInssPrevisto}
                  testId="input-inss"
                  baseValue={valorRealizadoVenda}
                  hint="% sobre o valor realizado de venda"
                />
                <PercInput
                  label="Manutenção Pós Obra Prevista"
                  value={manutencao}
                  onChange={setManutencao}
                  testId="input-manutencao"
                  baseValue={valorRealizadoVenda}
                  hint="% sobre o valor realizado de venda"
                />
                <Separator />
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-muted-foreground">Total de Deduções</span>
                  <span className="text-lg font-bold text-red-600" data-testid="text-total-deducoes">
                    {formatBRL(totalDeducoes)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>}

          {/* Aportes */}
          {false && <Card data-testid="panel-aportes">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HandCoins className="w-5 h-5 text-blue-500" />
                Aportes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> Início dos Aportes
                  </Label>
                  <Input
                    type="date"
                    value={inicioAportes}
                    onChange={(e) => setInicioAportes(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-inicio-aportes"
                  />
                </div>
                <NumInput
                  label="Total de Aportes"
                  value={totalAportes}
                  onChange={setTotalAportes}
                  testId="input-total-aportes"
                  hint="Total aportado pelos membros"
                />
              </div>
            </CardContent>
          </Card>}

          {/* Resultado Final */}
          <Card className="border-brand-gold/30 bg-gradient-to-br from-brand-gold/5 to-transparent" data-testid="panel-resultado">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-brand-gold" />
                Resultado Final
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Custo Final Previsto</p>
                  <p className="text-lg font-bold text-orange-600" data-testid="text-custo-final">{formatBRL(custoFinalPrevisto)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Receita</p>
                  <p className={`text-lg font-bold ${totalReceita >= 0 ?"text-green-600" : "text-red-600"}`} data-testid="text-receita-final">{formatBRL(totalReceita)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Resultado Líquido</p>
                  <p className={`text-lg font-bold ${resultadoLiquido >= 0 ?"text-green-600" : "text-red-600"}`} data-testid="text-resultado">{formatBRL(resultadoLiquido)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Lucro Previsto</p>
                  <p className={`text-lg font-bold ${lucroPrevisto >= 0 ?"text-brand-gold" : "text-red-600"}`} data-testid="text-lucro">{formatPerc(lucroPrevisto)}</p>
                </div>
              </div>

              {false && (
                <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 px-4 py-3 flex items-center justify-between gap-4" data-testid="panel-aporte-fm">
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Aporte do Fator de Multiplicação</p>
                      <p className="text-xs text-muted-foreground">Total de entradas geradas para diretores com membro atribuído</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-blue-600 tabular-nums shrink-0" data-testid="text-aporte-fm">
                    {null}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <PagamentoModal
        open={pagamentoModalOpen}
        onClose={() => setPagamentoModalOpen(false)}
        initialFormaPagamento={formaPagamento || "a_vista"}
        initialNumeroParcelas={numeroParcelas}
        initialVencimento={vencimento}
        initialVencimentosParcelas={vencimentosParcelas}
        initialValoresParcelas={valoresParcelas}
        initialValorAVista={valorAVista || biaValorOrigem}
        onConfirm={(d) => {
          setFormaPagamento(d.formaPagamento);
          setNumeroParcelas(d.numeroParcelas);
          setVencimento(d.vencimento);
          setVencimentosParcelas(d.vencimentosParcelas);
          setValoresParcelas(d.valoresParcelas);
          setValorAVista(d.valorAVista);
          if (d.formaPagamento === "a_vista") setBiaValorOrigem(d.valorAVista);
        }}
      />
    </fieldset>
  );
}
