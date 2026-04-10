import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Plus, Pencil, Trash2, FileText, Star, Upload, X, Paperclip, ExternalLink, ChevronDown } from "lucide-react";

const ACCENT = "#5B9BD5";

const TIPOS_POR_ALIANCA: Record<string, { label: string; verde?: boolean }[]> = {
  projetos: [
    { label: "Proposta técnica / SOW (escopo, entregáveis, prazos, critérios de aceite)" },
    { label: "Anteprojeto, estudo preliminar, projeto legal, projeto executivo (disciplinas)" },
    { label: "Memorial descritivo + especificações técnicas" },
    { label: "Compatibilização (BIM/clash report) + controle de revisões (RFI, revision log)" },
    { label: "ART/RRT + documentos de responsabilidade técnica" },
    { label: "Checklists normativos (acessibilidade, incêndio, código de obras, NBRs)" },
    { label: "Termos de aceite por etapa (milestones)" },
    { label: "Orçamento / EAP / plano de execução + cronograma físico-financeiro" },
    { label: "Outro" },
  ],
  juridica: [
    { label: "Termo de adesão à célula (automático para cada associação)", verde: true },
    { label: "Pacote de due diligence do imóvel/ativo (matrícula, ônus, certidões, riscos)", verde: true },
    { label: "Instrumento jurídico da aliança: SPE/SCP/JV/Teaming + acordo de sócios/cotistas" },
    { label: "NDA / confidencialidade / exclusividade", verde: true },
    { label: "Contrato de prestação de serviços (técnicos e operacionais)" },
    { label: "Contrato de empreitada / subempreitada" },
    { label: "Contrato de fornecimento (materiais/equipamentos)" },
    { label: "Contrato de comercialização (parcerias, corretagem, marketing)" },
    { label: "Aditivos" },
    { label: "Notificações" },
    { label: "Termos de aceite/entrega" },
    { label: "Termos de quitação" },
    { label: "Termos de Garantia" },
    { label: "MOU Padrão BUILT", verde: true },
    { label: "Matriz de riscos jurídicos + plano de mitigação (evidências)" },
    { label: "Outro" },
  ],
  inteligencia: [
    { label: "MasterPlan" },
    { label: "Estudo de viabilidade (técnica, legal, comercial e financeira – premissas)" },
    { label: "Tese do empreendimento (venda / renda / operação)" },
    { label: "Estudo de produto (mix, padrão, metragem, preço-alvo)" },
    { label: "Análise de mercado (concorrência, demanda, velocidade, absorção)", verde: true },
    { label: "Valuation e cenários (sensibilidade: custo, preço, prazo, taxa)" },
    { label: "Roadmap do projeto (fases, gates, marcos, KPIs)", verde: true },
    { label: "Outro" },
  ],
  governanca: [
    { label: "Manual de governança da BIA (alçadas, ritos, gates, quórum)", verde: true },
    { label: "Atas e deliberações (assembleias/comitês) + registro de decisões" },
    { label: "Trilhas de evidência (contratos, notas, medições, aprovações)" },
    { label: "Registro de riscos (risk register) + incidentes + planos de ação" },
    { label: "Relatórios periódicos (KPIs, compliance, auditoria interna)", verde: true },
    { label: "Checklist de 'closeout' (encerramento) e prestação final de conta" },
    { label: "Segurança do trabalho (PGR/PCMSO/ASO, NRs, fichas EPI, treinamentos)" },
    { label: "Laudo" },
    { label: "Dossiê" },
    { label: "Outro" },
  ],
};

const ABA_LABELS: Record<string, string> = {
  projetos: "Alianças de Projetos",
  juridica: "Alianças Jurídicas",
  inteligencia: "Alianças de Inteligência",
  governanca: "Alianças de Governança",
};

type Bia = { id: string; nome_bia: string; moeda?: string };
type AnexoFile = { id: string; title?: string; filename?: string; url?: string; size?: string };
type Doc = {
  id: string;
  bia_id?: string;
  alianca_tipo?: string;
  tipo_documento?: string;
  descricao?: string;
  arquivo_ids?: string[];
  arquivos?: AnexoFile[];
  date_created?: string;
};

function isVerde(tipo: string | undefined, alianca: string): boolean {
  if (!tipo) return false;
  return (TIPOS_POR_ALIANCA[alianca] || []).some(t => t.label === tipo && t.verde);
}

function formatDate(d?: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatSize(s?: string) {
  const n = Number(s);
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocSheetProps {
  aliancaTipo: string;
  biaId: string | null;
  bias: Bia[];
  doc?: Doc;
  onClose: () => void;
}

function DocSheet({ aliancaTipo, biaId, bias, doc, onClose }: DocSheetProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    bia_id: doc?.bia_id || biaId || "",
    alianca_tipo: aliancaTipo,
    tipo_documento: doc?.tipo_documento || "",
    descricao: doc?.descricao || "",
    arquivo_ids: (doc?.arquivo_ids || []) as string[],
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingArquivos] = useState<AnexoFile[]>(doc?.arquivos || []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const tipos = TIPOS_POR_ALIANCA[aliancaTipo] || [];

  const mutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let newIds: string[] = [];
      try {
        if (pendingFiles.length > 0) {
          const fd = new FormData();
          pendingFiles.forEach(f => fd.append("files", f, f.name));
          const r = await fetch("/api/upload", { method: "POST", body: fd });
          if (!r.ok) throw new Error("Falha no upload");
          const d = await r.json();
          newIds = d.fileIds || [];
        }
      } finally { setUploading(false); }

      const allIds = [...form.arquivo_ids, ...newIds];
      const payload = { ...form, arquivo_ids: allIds };
      if (doc) return apiRequest("PATCH", `/api/nucleo-tecnico-docs/${doc.id}`, payload);
      return apiRequest("POST", "/api/nucleo-tecnico-docs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nucleo-tecnico-docs"] });
      toast({ title: doc ? "Documento atualizado" : "Documento registrado", description: "Salvo com sucesso." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeExistingId = (id: string) => {
    setForm(f => ({ ...f, arquivo_ids: f.arquivo_ids.filter(x => x !== id) }));
  };

  const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#5B9BD5]/50 text-sm h-9";
  const labelCls = "text-[11px] text-white/40 uppercase tracking-wider mb-1 block";

  return (
    <Sheet open onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0" style={{ background: "#020d1a", borderLeft: `1px solid ${ACCENT}20` }}>
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/5 shrink-0">
          <SheetTitle className="text-white flex items-center gap-2 text-base">
            <Wrench className="w-4 h-4" style={{ color: ACCENT }} />
            {doc ? "Editar Documento" : "Novo Documento"}
          </SheetTitle>
          <p className="text-xs text-white/40 mt-1">{ABA_LABELS[aliancaTipo]}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* BIA */}
          <div>
            <label className={labelCls}>BIA</label>
            <Select value={form.bia_id} onValueChange={v => setForm(f => ({ ...f, bia_id: v }))}>
              <SelectTrigger className={inputCls} data-testid="select-bia-doc">
                <SelectValue placeholder="Selecione a BIA" />
              </SelectTrigger>
              <SelectContent>
                {bias.map(b => <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Documento */}
          <div>
            <label className={labelCls}>Tipo de Documento</label>
            <Select value={form.tipo_documento} onValueChange={v => setForm(f => ({ ...f, tipo_documento: v }))}>
              <SelectTrigger className={inputCls} data-testid="select-tipo-doc">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {tipos.map(t => (
                  <SelectItem key={t.label} value={t.label}>
                    <span className="flex items-center gap-1.5">
                      {t.verde && <Star className="w-3 h-3 text-green-400 shrink-0" />}
                      <span className="truncate">{t.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div>
            <label className={labelCls}>Descrição</label>
            <Textarea
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Observações sobre este documento..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#5B9BD5]/50 text-sm resize-none"
              rows={3}
              data-testid="textarea-descricao"
            />
          </div>

          {/* Arquivos existentes */}
          {existingArquivos.filter(a => form.arquivo_ids.includes(a.id)).length > 0 && (
            <div>
              <label className={labelCls}>Arquivos anexados</label>
              <div className="space-y-1.5">
                {existingArquivos.filter(a => form.arquivo_ids.includes(a.id)).map(a => (
                  <div key={a.id} className="flex items-center gap-2 rounded-md px-3 py-2" style={{ background: "#ffffff08", border: "1px solid #ffffff10" }}>
                    <Paperclip className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                    <span className="text-xs text-white/70 flex-1 truncate">{a.filename || a.title}</span>
                    <span className="text-[10px] text-white/30">{formatSize(a.size)}</span>
                    <button onClick={() => removeExistingId(a.id)} className="text-white/30 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-white/30 hover:text-white/60 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Novos arquivos */}
          {pendingFiles.length > 0 && (
            <div className="space-y-1.5">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md px-3 py-2" style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20` }}>
                  <Paperclip className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                  <span className="text-xs text-white/70 flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] text-white/30">{formatSize(String(f.size))}</span>
                  <button onClick={() => setPendingFiles(p => p.filter((_, j) => j !== i))} className="text-white/30 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []); setPendingFiles(p => [...p, ...files]); e.target.value = ""; }} />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed text-sm transition-colors"
            style={{ borderColor: `${ACCENT}30`, color: `${ACCENT}80` }}
            data-testid="btn-upload-arquivo"
          >
            <Upload className="w-3.5 h-3.5" />
            Anexar arquivo(s)
          </button>
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose} className="flex-1 text-white/50 hover:text-white border border-white/10" data-testid="btn-cancelar-doc">Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || uploading || !form.tipo_documento || !form.bia_id}
            className="flex-1 font-semibold"
            style={{ background: ACCENT, color: "#001D34" }}
            data-testid="btn-salvar-doc"
          >
            {mutation.isPending || uploading ? "Salvando..." : doc ? "Atualizar" : "Registrar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface TabContentProps {
  aliancaTipo: string;
  biaId: string | null;
  bias: Bia[];
  docs: Doc[];
  isLoading: boolean;
  onNew: () => void;
  onEdit: (d: Doc) => void;
  onDelete: (d: Doc) => void;
}

function TabContent({ aliancaTipo, biaId, bias, docs, isLoading, onNew, onEdit, onDelete }: TabContentProps) {
  const filtered = biaId ? docs.filter(d => d.bia_id === biaId && d.alianca_tipo === aliancaTipo) : docs.filter(d => d.alianca_tipo === aliancaTipo);
  const biaName = (id?: string) => bias.find(b => b.id === id)?.nome_bia || id || "—";

  const verdeCount = filtered.filter(d => isVerde(d.tipo_documento, aliancaTipo)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/40">{filtered.length} documento{filtered.length !== 1 ? "s" : ""}</span>
          {verdeCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Star className="w-3 h-3" /> {verdeCount} integrado{verdeCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button
          onClick={onNew}
          size="sm"
          className="h-8 px-3 text-xs font-semibold gap-1.5"
          style={{ background: ACCENT, color: "#001D34" }}
          data-testid={`btn-novo-doc-${aliancaTipo}`}
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" style={{ background: "#0a1929" }} />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-14 rounded-xl" style={{ border: `1px dashed ${ACCENT}25` }}>
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: ACCENT }} />
          <p className="text-sm text-white/30">Nenhum documento registrado</p>
          <p className="text-xs text-white/20 mt-1">Clique em Adicionar para começar</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(doc => {
          const verde = isVerde(doc.tipo_documento, aliancaTipo);
          return (
            <div
              key={doc.id}
              className="rounded-xl p-4 transition-all duration-200 hover:border-[#5B9BD5]/20"
              style={{ background: "linear-gradient(135deg, #050f1c, #030812)", border: `1px solid ${verde ? "#22c55e20" : "#ffffff08"}` }}
              data-testid={`card-doc-${doc.id}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: verde ? "#22c55e15" : `${ACCENT}10`, border: `1px solid ${verde ? "#22c55e30" : `${ACCENT}20`}` }}
                >
                  {verde ? <Star className="w-3.5 h-3.5 text-green-400" /> : <FileText className="w-3.5 h-3.5" style={{ color: ACCENT }} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-white/90 leading-tight">{doc.tipo_documento}</span>
                    {verde && <Badge className="text-[9px] px-1.5 py-0 h-4 font-mono" style={{ background: "#22c55e15", color: "#22c55e", border: "1px solid #22c55e30" }}>INTEGRADO</Badge>}
                  </div>
                  {!biaId && (
                    <p className="text-[11px] text-white/30 mb-1">{biaName(doc.bia_id)}</p>
                  )}
                  {doc.descricao && <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{doc.descricao}</p>}
                  {(doc.arquivos || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(doc.arquivos || []).map(a => (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] rounded px-2 py-0.5 transition-colors hover:border-white/20"
                          style={{ background: "#ffffff08", border: "1px solid #ffffff10", color: "#ffffff60" }}
                        >
                          <Paperclip className="w-2.5 h-2.5" />
                          <span className="max-w-[120px] truncate">{a.filename || a.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-white/20 mt-2">{formatDate(doc.date_created)}</p>
                </div>

                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onEdit(doc)} className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors" data-testid={`btn-editar-doc-${doc.id}`} title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(doc)} className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors" data-testid={`btn-deletar-doc-${doc.id}`} title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NucleoTecnicoPage() {
  const { toast } = useToast();
  const [biaId, setBiaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("juridica");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Doc | undefined>();
  const [deletingDoc, setDeletingDoc] = useState<Doc | undefined>();

  const { data: bias = [] } = useQuery<Bia[]>({ queryKey: ["/api/bias"] });
  const { data: docs = [], isLoading } = useQuery<Doc[]>({ queryKey: ["/api/nucleo-tecnico-docs"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/nucleo-tecnico-docs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nucleo-tecnico-docs"] });
      toast({ title: "Documento excluído" });
      setDeletingDoc(undefined);
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const verdeTotal = docs.filter(d => isVerde(d.tipo_documento, d.alianca_tipo || "")).length;
  const docsFiltered = biaId ? docs.filter(d => d.bia_id === biaId) : docs;

  return (
    <div className="min-h-screen p-6" style={{ background: "linear-gradient(135deg, #001020 0%, #000c18 100%)" }}>
      {/* Header */}
      <div className="relative mb-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-24 h-px" style={{ background: `linear-gradient(90deg, ${ACCENT}, transparent)` }} />
          <div className="absolute top-0 left-0 w-px h-24" style={{ background: `linear-gradient(180deg, ${ACCENT}, transparent)` }} />
        </div>
        <div className="flex items-center justify-between pt-2 pl-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT}20, #001D34)`, border: `1px solid ${ACCENT}40` }}>
              <Wrench className="w-6 h-6" style={{ color: ACCENT }} />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: `${ACCENT}60` }}>BUILT ALLIANCES · 4.2</div>
              <h1 className="text-2xl font-bold text-white">Núcleo Técnico</h1>
              <p className="text-sm mt-0.5" style={{ color: `${ACCENT}70` }}>Documentos técnicos, jurídicos, de inteligência e governança</p>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex gap-3">
            <div className="rounded-xl px-4 py-3 text-center" style={{ background: "#050f1c", border: `1px solid ${ACCENT}15` }}>
              <div className="text-lg font-bold text-white">{docsFiltered.length}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">Documentos</div>
            </div>
            <div className="rounded-xl px-4 py-3 text-center" style={{ background: "#050f1c", border: "1px solid #22c55e20" }}>
              <div className="text-lg font-bold text-green-400">{docsFiltered.filter(d => isVerde(d.tipo_documento, d.alianca_tipo || "")).length}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">Integrados</div>
            </div>
          </div>
        </div>
      </div>

      {/* BIA Filter */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-xs text-white/40 uppercase tracking-wider shrink-0">Filtrar por BIA:</span>
        <Select value={biaId || "all"} onValueChange={v => setBiaId(v === "all" ? null : v)}>
          <SelectTrigger className="max-w-xs bg-white/5 border-white/10 text-white text-sm h-9" data-testid="select-filter-bia">
            <SelectValue placeholder="Todas as BIAs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as BIAs</SelectItem>
            {bias.map(b => <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 text-xs" style={{ color: "#22c55e80" }}>
          <Star className="w-3 h-3 text-green-400" />
          <span>= integrado à plataforma</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-6 p-1 rounded-xl gap-1 h-auto flex-wrap" style={{ background: "#050f1c", border: `1px solid ${ACCENT}15` }}>
          {Object.entries(ABA_LABELS).map(([key, label]) => {
            const count = (biaId ? docs.filter(d => d.bia_id === biaId) : docs).filter(d => d.alianca_tipo === key).length;
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="flex-1 text-xs font-medium py-2 px-3 rounded-lg data-[state=active]:text-[#001D34] transition-all"
                style={{ color: "#ffffff60" }}
                data-testid={`tab-${key}`}
              >
                {label.replace("Alianças de ", "").replace("Alianças ", "")}
                {count > 0 && <span className="ml-1.5 text-[10px] opacity-70">({count})</span>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.keys(ABA_LABELS).map(key => (
          <TabsContent key={key} value={key}>
            <TabContent
              aliancaTipo={key}
              biaId={biaId}
              bias={bias}
              docs={docs}
              isLoading={isLoading}
              onNew={() => { setEditingDoc(undefined); setSheetOpen(true); }}
              onEdit={d => { setEditingDoc(d); setSheetOpen(true); }}
              onDelete={d => setDeletingDoc(d)}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Sheet para criar/editar */}
      {sheetOpen && (
        <DocSheet
          aliancaTipo={activeTab}
          biaId={biaId}
          bias={bias}
          doc={editingDoc}
          onClose={() => { setSheetOpen(false); setEditingDoc(undefined); }}
        />
      )}

      {/* Alert delete */}
      <AlertDialog open={!!deletingDoc} onOpenChange={o => { if (!o) setDeletingDoc(undefined); }}>
        <AlertDialogContent style={{ background: "#020d1a", border: "1px solid #ffffff10" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              "{deletingDoc?.tipo_documento}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/70 hover:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDoc && deleteMutation.mutate(deletingDoc.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-confirmar-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
