import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText, Plus, Send, Eye, Code2, Trash2, Mail, Sparkles,
  Search, X, CheckCircle, Clock, AlertCircle, Copy, Download,
  ChevronRight, Layers, RefreshCw, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Proposal {
  id: string;
  opa_id?: string | null;
  bia_id?: string | null;
  nome_proposta: string;
  assunto_email?: string | null;
  html_content?: string | null;
  email_destinatario?: string | null;
  nome_destinatario?: string | null;
  status: string;
  sent_at?: string | null;
  created_at?: string | null;
}

interface Oportunidade {
  id: string;
  nome_oportunidade?: string;
  tipo?: string;
  bia_id?: string;
  email_contato?: string;
  nome_contato?: string;
  descricao?: string;
  objetivo_alianca?: string;
  pais?: string;
  valor_origem_opa?: string | number;
}

interface BiasProjeto {
  id: string;
  nome_bia: string;
}

// Status config
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  rascunho: { label: "Rascunho", color: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: Clock },
  enviada: { label: "Enviada", color: "text-green-400 border-green-400/30 bg-green-400/10", icon: CheckCircle },
  erro: { label: "Erro", color: "text-red-400 border-red-400/30 bg-red-400/10", icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.rascunho;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function StatItem({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-6 border-r border-brand-gold/10 last:border-r-0">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-brand-gold/50" />
        <span className="text-lg font-bold font-mono text-brand-gold tabular-nums">{value}</span>
      </div>
      <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono">{label}</span>
    </div>
  );
}

// Proposal Card
function ProposalCard({
  proposal, opas, bias, onView, onSend, onDelete
}: {
  proposal: Proposal;
  opas: Oportunidade[];
  bias: BiasProjeto[];
  onView: (p: Proposal) => void;
  onSend: (p: Proposal) => void;
  onDelete: (p: Proposal) => void;
}) {
  const opa = opas.find(o => o.id === proposal.opa_id);
  const bia = bias.find(b => b.id === proposal.bia_id);
  const date = proposal.created_at
    ? new Date(proposal.created_at).toLocaleDateString("pt-BR")
    : "";
  const sentDate = proposal.sent_at
    ? new Date(proposal.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;

  return (
    <div
      className="group relative rounded-xl border border-brand-gold/10 overflow-hidden transition-all duration-300 hover:border-brand-gold/30 cursor-pointer"
      style={{ background: "linear-gradient(135deg, rgba(0,29,52,0.9) 0%, rgba(0,12,24,0.95) 100%)" }}
      data-testid={`card-proposal-${proposal.id}`}
    >
      {/* Shimmer top line */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.4), transparent)" }} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3.5 h-3.5 text-brand-gold/60 shrink-0" />
              <h3 className="text-sm font-bold text-brand-gold/90 truncate">{proposal.nome_proposta}</h3>
            </div>
            <StatusBadge status={proposal.status} />
          </div>
          <span className="text-[10px] text-white/25 font-mono shrink-0">{date}</span>
        </div>

        {/* OPA link */}
        {opa && (
          <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-2.5 py-1.5 border border-white/[0.06]">
            <Layers className="w-3 h-3 text-brand-gold/40 shrink-0" />
            <span className="text-[11px] text-white/50 truncate">{opa.nome_oportunidade}</span>
            {bia && (
              <>
                <ChevronRight className="w-2.5 h-2.5 text-white/20 shrink-0" />
                <span className="text-[10px] text-white/30 truncate">{bia.nome_bia}</span>
              </>
            )}
          </div>
        )}

        {/* Email info */}
        {proposal.email_destinatario && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/40">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{proposal.nome_destinatario || proposal.email_destinatario}</span>
            {sentDate && <span className="text-white/25 ml-auto shrink-0">Enviada {sentDate}</span>}
          </div>
        )}

        {proposal.assunto_email && (
          <p className="text-[10px] text-white/25 font-mono truncate border-t border-white/5 pt-2">
            Assunto: {proposal.assunto_email}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={e => { e.stopPropagation(); onView(proposal); }}
            className="h-7 text-xs flex-1 border border-white/10 text-white/50 hover:text-white hover:border-brand-gold/40 font-mono"
            data-testid={`button-view-proposal-${proposal.id}`}
          >
            <Eye className="w-3 h-3 mr-1" />
            Ver
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={e => { e.stopPropagation(); onSend(proposal); }}
            className="h-7 text-xs flex-1 border border-brand-gold/20 text-brand-gold/60 hover:text-brand-gold hover:border-brand-gold/50 font-mono"
            data-testid={`button-send-proposal-${proposal.id}`}
          >
            <Send className="w-3 h-3 mr-1" />
            Enviar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={e => { e.stopPropagation(); onDelete(proposal); }}
            className="h-7 w-7 p-0 border border-red-500/10 text-red-400/40 hover:text-red-400 hover:border-red-500/30"
            data-testid={`button-delete-proposal-${proposal.id}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Generate Modal ----
function GenerateModal({
  open, onClose, opas, bias
}: {
  open: boolean;
  onClose: () => void;
  opas: Oportunidade[];
  bias: BiasProjeto[];
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "preview">("form");
  const [opaId, setOpaId] = useState("");
  const [nomeProposta, setNomeProposta] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [nomeTo, setNomeTo] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [assunto, setAssunto] = useState("");
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const selectedOpa = opas.find(o => o.id === opaId);

  const generateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/proposals/generate", data),
    onSuccess: (data: any) => {
      setGeneratedHtml(data.html_content || "");
      setAssunto(data.assunto_email || "");
      if (!nomeProposta && selectedOpa) {
        setNomeProposta(`Proposta - ${selectedOpa.nome_oportunidade || "OPA"}`);
      }
      setStep("preview");
    },
    onError: (e: any) => {
      toast({ title: "Erro ao gerar proposta", description: e.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/proposals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposta salva!", description: "Proposta salva como rascunho." });
      handleClose();
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  function handleClose() {
    setStep("form");
    setOpaId("");
    setNomeProposta("");
    setEmailTo("");
    setNomeTo("");
    setInstrucoes("");
    setGeneratedHtml("");
    setAssunto("");
    onClose();
  }

  function handleGenerate() {
    if (!opaId) {
      toast({ title: "Selecione uma OPA", variant: "destructive" });
      return;
    }
    generateMutation.mutate({
      opa_id: opaId,
      bia_id: selectedOpa?.bia_id || null,
      instrucoes,
    });
  }

  function handleSave() {
    if (!generatedHtml) return;
    saveMutation.mutate({
      opa_id: opaId || null,
      bia_id: selectedOpa?.bia_id || null,
      nome_proposta: nomeProposta || `Proposta ${new Date().toLocaleDateString("pt-BR")}`,
      assunto_email: assunto || null,
      html_content: generatedHtml,
      email_destinatario: emailTo || null,
      nome_destinatario: nomeTo || null,
      status: "rascunho",
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(generatedHtml);
    toast({ title: "HTML copiado!" });
  }

  function handleDownload() {
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeProposta || "proposta"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent
        className="max-w-5xl w-full border-brand-gold/20"
        style={{ background: "#020b16", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        <DialogHeader className="shrink-0 border-b border-white/10 pb-4">
          <DialogTitle className="font-mono text-brand-gold flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {step === "form" ? "Gerar Nova Proposta" : "Proposta Gerada"}
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <div className="overflow-y-auto flex-1 py-4 space-y-4 pr-1">
            {/* OPA Select */}
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50 font-mono">OPA Vinculada *</Label>
              <Select value={opaId || "__none__"} onValueChange={v => setOpaId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm bg-white/5 border-white/10 text-white" data-testid="select-gen-opa">
                  <SelectValue placeholder="Selecione a OPA..." />
                </SelectTrigger>
                <SelectContent className="bg-[#050f1c] border-white/10 text-white/80">
                  <SelectItem value="__none__">Selecione uma OPA...</SelectItem>
                  {opas.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome_oportunidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOpa && (
                <div className="text-[11px] text-white/30 pl-1 space-y-0.5">
                  {selectedOpa.objetivo_alianca && <p>Objetivo: {selectedOpa.objetivo_alianca}</p>}
                  {selectedOpa.pais && <p>País: {selectedOpa.pais}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50 font-mono">Nome da Proposta</Label>
                <Input
                  value={nomeProposta}
                  onChange={e => setNomeProposta(e.target.value)}
                  placeholder="Ex: Proposta Aliança XYZ"
                  className="h-8 text-sm bg-white/5 border-white/10 text-white"
                  data-testid="input-gen-nome"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50 font-mono">Email do Destinatário</Label>
                <Input
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder="contato@empresa.com"
                  type="email"
                  className="h-8 text-sm bg-white/5 border-white/10 text-white"
                  data-testid="input-gen-email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/50 font-mono">Nome do Destinatário</Label>
              <Input
                value={nomeTo}
                onChange={e => setNomeTo(e.target.value)}
                placeholder="Nome completo do contato"
                className="h-8 text-sm bg-white/5 border-white/10 text-white"
                data-testid="input-gen-nome-contato"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/50 font-mono">Instruções Adicionais para IA</Label>
              <Textarea
                value={instrucoes}
                onChange={e => setInstrucoes(e.target.value)}
                placeholder="Ex: Destaque o retorno sobre investimento, mencione parceria de longo prazo, inclua cláusula de exclusividade..."
                className="text-sm bg-white/5 border-white/10 text-white resize-none"
                rows={4}
                data-testid="input-gen-instrucoes"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="flex items-center gap-2 py-3 shrink-0">
              <div className="flex gap-1 rounded-lg border border-white/10 p-0.5 bg-white/5">
                <button
                  onClick={() => setViewMode("preview")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${viewMode === "preview" ? "bg-brand-gold/20 text-brand-gold" : "text-white/40 hover:text-white/70"}`}
                  data-testid="button-view-preview"
                >
                  <Eye className="w-3 h-3 inline mr-1" />Preview
                </button>
                <button
                  onClick={() => setViewMode("code")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${viewMode === "code" ? "bg-brand-gold/20 text-brand-gold" : "text-white/40 hover:text-white/70"}`}
                  data-testid="button-view-code"
                >
                  <Code2 className="w-3 h-3 inline mr-1" />HTML
                </button>
              </div>
              <div className="flex-1" />
              <button
                onClick={handleCopy}
                className="text-[10px] font-mono text-white/40 hover:text-white/70 flex items-center gap-1 px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
                data-testid="button-copy-html"
              >
                <Copy className="w-3 h-3" />Copiar HTML
              </button>
              <button
                onClick={handleDownload}
                className="text-[10px] font-mono text-white/40 hover:text-white/70 flex items-center gap-1 px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
                data-testid="button-download-html"
              >
                <Download className="w-3 h-3" />Download
              </button>
              <button
                onClick={() => setStep("form")}
                className="text-[10px] font-mono text-white/40 hover:text-white/70 flex items-center gap-1 px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
                data-testid="button-back-form"
              >
                <RefreshCw className="w-3 h-3" />Regenerar
              </button>
            </div>

            {/* Assunto */}
            {assunto && (
              <div className="shrink-0 mb-3">
                <Label className="text-[10px] text-white/30 font-mono block mb-1">Assunto do Email</Label>
                <Input
                  value={assunto}
                  onChange={e => setAssunto(e.target.value)}
                  className="h-8 text-xs bg-white/5 border-white/10 text-white/70 font-mono"
                  data-testid="input-assunto"
                />
              </div>
            )}

            {/* Preview/Code */}
            <div className="flex-1 min-h-0 rounded-xl border border-white/10 overflow-hidden">
              {viewMode === "preview" ? (
                <iframe
                  srcDoc={generatedHtml}
                  className="w-full h-full border-0"
                  title="Proposta Preview"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="h-full overflow-auto bg-black/40">
                  <pre className="text-[11px] text-green-400/80 font-mono p-4 whitespace-pre-wrap break-all">
                    {generatedHtml}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t border-white/10 pt-4 gap-2">
          <Button variant="ghost" onClick={handleClose} className="text-white/50 font-mono text-xs">
            Cancelar
          </Button>
          {step === "form" ? (
            <Button
              onClick={handleGenerate}
              disabled={!opaId || generateMutation.isPending}
              className="font-mono text-xs bg-brand-gold text-[#001D34] hover:bg-brand-gold/90"
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />Gerando com IA...</>
              ) : (
                <><Sparkles className="w-3 h-3 mr-1.5" />Gerar Proposta</>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="font-mono text-xs bg-brand-gold text-[#001D34] hover:bg-brand-gold/90"
              data-testid="button-save-proposal"
            >
              {saveMutation.isPending ? (
                <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />Salvando...</>
              ) : (
                <><CheckCircle className="w-3 h-3 mr-1.5" />Salvar Proposta</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- View Proposal Modal ----
function ViewProposalModal({
  proposal, open, onClose, onSend
}: {
  proposal: Proposal | null;
  open: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  function handleCopy() {
    if (proposal?.html_content) {
      navigator.clipboard.writeText(proposal.html_content);
    }
  }

  function handleDownload() {
    if (!proposal?.html_content) return;
    const blob = new Blob([proposal.html_content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proposal.nome_proposta || "proposta"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-5xl w-full border-brand-gold/20"
        style={{ background: "#020b16", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        <DialogHeader className="shrink-0 border-b border-white/10 pb-4">
          <DialogTitle className="font-mono text-brand-gold flex items-center gap-2 truncate">
            <FileText className="w-4 h-4 shrink-0" />
            {proposal?.nome_proposta}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 py-3 shrink-0">
          <div className="flex gap-1 rounded-lg border border-white/10 p-0.5 bg-white/5">
            <button
              onClick={() => setViewMode("preview")}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${viewMode === "preview" ? "bg-brand-gold/20 text-brand-gold" : "text-white/40 hover:text-white/70"}`}
            >
              <Eye className="w-3 h-3 inline mr-1" />Preview
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${viewMode === "code" ? "bg-brand-gold/20 text-brand-gold" : "text-white/40 hover:text-white/70"}`}
            >
              <Code2 className="w-3 h-3 inline mr-1" />HTML
            </button>
          </div>
          <div className="flex-1" />
          {proposal?.status === "enviada" && (
            <StatusBadge status="enviada" />
          )}
          <button
            onClick={handleCopy}
            className="text-[10px] font-mono text-white/40 hover:text-white/70 flex items-center gap-1 px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
          >
            <Copy className="w-3 h-3" />Copiar
          </button>
          <button
            onClick={handleDownload}
            className="text-[10px] font-mono text-white/40 hover:text-white/70 flex items-center gap-1 px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
          >
            <Download className="w-3 h-3" />Download
          </button>
        </div>

        <div className="flex-1 min-h-0 rounded-xl border border-white/10 overflow-hidden">
          {!proposal?.html_content ? (
            <div className="h-full flex items-center justify-center text-white/30 text-sm font-mono">
              Sem conteúdo gerado
            </div>
          ) : viewMode === "preview" ? (
            <iframe
              srcDoc={proposal.html_content}
              className="w-full h-full border-0"
              title="Proposta"
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="h-full overflow-auto bg-black/40">
              <pre className="text-[11px] text-green-400/80 font-mono p-4 whitespace-pre-wrap break-all">
                {proposal.html_content}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-white/10 pt-4 gap-2">
          <Button variant="ghost" onClick={onClose} className="text-white/50 font-mono text-xs">Fechar</Button>
          <Button
            onClick={onSend}
            className="font-mono text-xs bg-brand-gold text-[#001D34] hover:bg-brand-gold/90"
            data-testid="button-view-send"
          >
            <Send className="w-3 h-3 mr-1.5" />Enviar por Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Send Email Modal ----
function SendEmailModal({
  proposal, open, onClose, smtpOk
}: {
  proposal: Proposal | null;
  open: boolean;
  onClose: () => void;
  smtpOk: boolean;
}) {
  const { toast } = useToast();
  const [emailTo, setEmailTo] = useState("");
  const [nomeTo, setNomeTo] = useState("");
  const [assunto, setAssunto] = useState("");

  useMemo(() => {
    if (proposal && open) {
      setEmailTo(proposal.email_destinatario || "");
      setNomeTo(proposal.nome_destinatario || "");
      setAssunto(proposal.assunto_email || `Proposta Built Alliances: ${proposal.nome_proposta}`);
    }
  }, [proposal, open]);

  const sendMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/proposals/${proposal?.id}/send-email`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Email enviado!", description: `Enviado para ${emailTo}` });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Erro ao enviar email", description: e.message, variant: "destructive" });
    },
  });

  function handleSend() {
    if (!emailTo.trim()) {
      toast({ title: "Email destinatário é obrigatório", variant: "destructive" });
      return;
    }
    sendMutation.mutate({ email_to: emailTo, nome_to: nomeTo, assunto });
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md border-brand-gold/20" style={{ background: "#020b16" }}>
        <DialogHeader className="border-b border-white/10 pb-4">
          <DialogTitle className="font-mono text-brand-gold flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Enviar por Email
          </DialogTitle>
        </DialogHeader>

        {!smtpOk && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold">
              <Settings className="w-3.5 h-3.5" />
              SMTP não configurado
            </div>
            <p className="text-xs text-amber-300/70">
              Configure as seguintes variáveis de ambiente para habilitar o envio de emails:
            </p>
            <div className="font-mono text-[10px] text-white/50 space-y-0.5">
              <p>SMTP_HOST=smtp.gmail.com</p>
              <p>SMTP_PORT=587</p>
              <p>SMTP_USER=seu@email.com</p>
              <p>SMTP_PASS=sua_senha_de_app</p>
              <p>SMTP_FROM=seu@email.com</p>
            </div>
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50 font-mono">Para (Email) *</Label>
            <Input
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              type="email"
              placeholder="destinatario@empresa.com"
              className="h-8 text-sm bg-white/5 border-white/10 text-white"
              data-testid="input-email-to"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50 font-mono">Nome do Destinatário</Label>
            <Input
              value={nomeTo}
              onChange={e => setNomeTo(e.target.value)}
              placeholder="Nome do contato"
              className="h-8 text-sm bg-white/5 border-white/10 text-white"
              data-testid="input-email-nome"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50 font-mono">Assunto</Label>
            <Input
              value={assunto}
              onChange={e => setAssunto(e.target.value)}
              placeholder="Assunto do email"
              className="h-8 text-sm bg-white/5 border-white/10 text-white"
              data-testid="input-email-assunto"
            />
          </div>

          {proposal?.html_content && (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] text-white/30 font-mono mb-1">Conteúdo</p>
              <p className="text-xs text-white/50 truncate">{proposal.nome_proposta}</p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-white/10 pt-4 gap-2">
          <Button variant="ghost" onClick={onClose} className="text-white/50 font-mono text-xs">Cancelar</Button>
          <Button
            onClick={handleSend}
            disabled={!smtpOk || sendMutation.isPending}
            className="font-mono text-xs bg-brand-gold text-[#001D34] hover:bg-brand-gold/90"
            data-testid="button-confirm-send"
          >
            {sendMutation.isPending ? (
              <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />Enviando...</>
            ) : (
              <><Send className="w-3 h-3 mr-1.5" />Enviar Email</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Page ----
export default function PropostasPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null);
  const [sendingProposal, setSendingProposal] = useState<Proposal | null>(null);
  const [deletingProposal, setDeletingProposal] = useState<Proposal | null>(null);

  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({ queryKey: ["/api/proposals"] });
  const { data: opas = [] } = useQuery<Oportunidade[]>({ queryKey: ["/api/oportunidades"] });
  const { data: bias = [] } = useQuery<BiasProjeto[]>({ queryKey: ["/api/bias"] });
  const { data: smtpStatus } = useQuery<{ configured: boolean; host: string | null; user: string | null }>({
    queryKey: ["/api/smtp/status"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/proposals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposta excluída" });
      setDeletingProposal(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return proposals.filter(p => {
      const matchSearch = !q || [p.nome_proposta, p.email_destinatario, p.nome_destinatario, p.assunto_email]
        .some(f => f?.toLowerCase().includes(q));
      const matchStatus = !filterStatus || p.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [proposals, search, filterStatus]);

  const stats = useMemo(() => ({
    total: proposals.length,
    enviadas: proposals.filter(p => p.status === "enviada").length,
    rascunhos: proposals.filter(p => p.status === "rascunho").length,
  }), [proposals]);

  function handleSendFromView() {
    setSendingProposal(viewingProposal);
    setViewingProposal(null);
  }

  return (
    <div className="min-h-screen" style={{ background: "#020b16" }}>
      <style>{`
        @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }
      `}</style>

      {/* ---- HEADER ---- */}
      <div
        className="relative overflow-hidden"
        style={{ height: 180, background: "radial-gradient(ellipse at 25% 50%, #001d34 0%, #000c1f 55%, #000408 100%)" }}
      >
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,187,125,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px"
        }} />
        {/* Scan */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <div className="absolute left-0 right-0 h-px bg-brand-gold/40"
            style={{ animation: "scan 5s linear infinite", top: 0 }} />
        </div>
        {/* Orbs */}
        <div className="absolute top-8 left-16 w-24 h-24 rounded-full blur-2xl opacity-10" style={{ background: "#D7BB7D" }} />
        <div className="absolute bottom-4 right-32 w-16 h-16 rounded-full blur-xl opacity-8" style={{ background: "#001D34" }} />

        <div className="relative z-10 h-full flex flex-col justify-between p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] font-mono text-brand-gold/40 tracking-[0.4em] uppercase mb-1">// BUILT ALLIANCES</p>
              <h1 className="text-2xl font-bold font-mono tracking-wide text-white">PROPOSTAS</h1>
              <p className="text-xs text-white/30 mt-0.5">Geração e envio de propostas comerciais</p>
            </div>
            <Button
              onClick={() => setShowGenerate(true)}
              className="bg-brand-gold text-[#001D34] hover:bg-brand-gold/90 font-mono text-xs h-8"
              data-testid="button-nova-proposta"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nova Proposta
            </Button>
          </div>

          <div className="inline-flex items-center rounded-lg border border-brand-gold/10 py-2" style={{ background: "rgba(0,10,20,0.5)", backdropFilter: "blur(8px)" }}>
            <StatItem label="Total" value={stats.total} icon={FileText} />
            <StatItem label="Enviadas" value={stats.enviadas} icon={Send} />
            <StatItem label="Rascunhos" value={stats.rascunhos} icon={Clock} />
            {smtpStatus?.configured && (
              <StatItem label="SMTP" value="OK" icon={CheckCircle} />
            )}
          </div>
        </div>

        {/* Border bottom */}
        <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.3), transparent)" }} />
      </div>

      {/* ---- FILTERS ---- */}
      <div className="sticky top-0 z-20 px-6 py-3 flex flex-wrap items-center gap-2 border-b border-white/5"
        style={{ background: "rgba(2,11,22,0.9)", backdropFilter: "blur(8px)" }}>
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gold/40" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, destinatário..."
            className="pl-9 h-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono"
            data-testid="input-busca-propostas"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Select value={filterStatus || "__all__"} onValueChange={v => setFilterStatus(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-8 w-36 text-xs border-white/10 bg-white/5 text-white/60 font-mono" data-testid="select-filter-status">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="bg-[#050f1c] border-white/10 text-white/80 font-mono text-xs">
            <SelectItem value="__all__">Todos os status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
          </SelectContent>
        </Select>

        {(search || filterStatus) && (
          <button
            onClick={() => { setSearch(""); setFilterStatus(""); }}
            className="h-8 px-3 text-xs rounded-md border border-red-500/20 text-red-400/60 hover:border-red-500/40 hover:text-red-400 transition-colors font-mono flex items-center gap-1.5"
          >
            <X className="w-3 h-3" />Limpar
          </button>
        )}

        <span className="text-[10px] font-mono text-white/25 ml-auto">
          {filtered.length}/{proposals.length} propostas
        </span>
      </div>

      {/* ---- CONTENT ---- */}
      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl border border-brand-gold/10 flex items-center justify-center"
              style={{ background: "rgba(215,187,125,0.05)" }}>
              <FileText className="w-7 h-7 text-brand-gold/30" />
            </div>
            <div>
              <p className="text-white/30 font-mono text-sm">
                {search || filterStatus ? "Nenhuma proposta encontrada" : "Nenhuma proposta ainda"}
              </p>
              <p className="text-white/15 text-xs mt-1">
                {!search && !filterStatus && "Clique em 'Nova Proposta' para gerar sua primeira proposta com IA"}
              </p>
            </div>
            {!search && !filterStatus && (
              <Button
                onClick={() => setShowGenerate(true)}
                variant="outline"
                className="border-brand-gold/20 text-brand-gold/60 hover:text-brand-gold hover:border-brand-gold/40 font-mono text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Gerar Primeira Proposta
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => (
              <ProposalCard
                key={p.id}
                proposal={p}
                opas={opas}
                bias={bias}
                onView={setViewingProposal}
                onSend={setSendingProposal}
                onDelete={setDeletingProposal}
              />
            ))}
          </div>
        )}
      </div>

      {/* SMTP Warning banner */}
      {smtpStatus && !smtpStatus.configured && proposals.length > 0 && (
        <div className="mx-6 mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
          <Settings className="w-4 h-4 text-amber-400/60 shrink-0" />
          <p className="text-xs text-amber-300/60 font-mono">
            Email não configurado. Configure SMTP_HOST, SMTP_USER e SMTP_PASS para habilitar o envio.
          </p>
        </div>
      )}

      {/* Modals */}
      <GenerateModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        opas={opas}
        bias={bias}
      />

      <ViewProposalModal
        proposal={viewingProposal}
        open={!!viewingProposal}
        onClose={() => setViewingProposal(null)}
        onSend={handleSendFromView}
      />

      <SendEmailModal
        proposal={sendingProposal}
        open={!!sendingProposal}
        onClose={() => setSendingProposal(null)}
        smtpOk={smtpStatus?.configured ?? false}
      />

      <AlertDialog open={!!deletingProposal} onOpenChange={v => { if (!v) setDeletingProposal(null); }}>
        <AlertDialogContent style={{ background: "#020b16" }} className="border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-mono">Excluir Proposta</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              Tem certeza que deseja excluir "{deletingProposal?.nome_proposta}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/50 font-mono text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingProposal && deleteMutation.mutate(deletingProposal.id)}
              className="bg-red-500/80 hover:bg-red-500 text-white font-mono text-xs"
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
