import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Upload, Loader2, CalendarClock, Sparkles, X } from "lucide-react";

export interface PagamentoConfirmData {
  formaPagamento: string;
  numeroParcelas: string;
  vencimento: string;
  vencimentosParcelas: string[];
  valoresParcelas: number[];
  valorAVista: number;
}

interface PagamentoModalProps {
  open: boolean;
  onClose: () => void;
  initialFormaPagamento: string;
  initialNumeroParcelas: string;
  initialVencimento: string;
  initialVencimentosParcelas: string[];
  initialValoresParcelas: number[];
  initialValorAVista: number;
  onConfirm: (d: PagamentoConfirmData) => void;
}

export function PagamentoModal({
  open, onClose,
  initialFormaPagamento, initialNumeroParcelas,
  initialVencimento, initialVencimentosParcelas,
  initialValoresParcelas, initialValorAVista,
  onConfirm,
}: PagamentoModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [forma, setForma] = useState(initialFormaPagamento);
  const [nParcelas, setNParcelas] = useState(initialNumeroParcelas);
  const [venc, setVenc] = useState(initialVencimento);
  const [vencs, setVencs] = useState<string[]>(initialVencimentosParcelas);
  const [vals, setVals] = useState<number[]>(initialValoresParcelas);
  const [valorAVista, setValorAVista] = useState(initialValorAVista);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiObs, setAiObs] = useState("");

  const n = parseInt(nParcelas) || 0;

  useEffect(() => {
    if (open) {
      setForma(initialFormaPagamento);
      setNParcelas(initialNumeroParcelas);
      setVenc(initialVencimento);
      setVencs(initialVencimentosParcelas);
      setVals(initialValoresParcelas);
      setValorAVista(initialValorAVista);
      setAiObs("");
    }
  }, [open]);

  function handleNParcelasChange(val: string) {
    setNParcelas(val);
    const nn = parseInt(val) || 0;
    setVencs(prev => {
      const next = [...prev];
      while (next.length < nn) next.push("");
      return next.slice(0, nn);
    });
    setVals(prev => {
      const next = [...prev];
      while (next.length < nn) next.push(0);
      return next.slice(0, nn);
    });
  }

  function setVencParcela(idx: number, date: string) {
    setVencs(prev => { const next = [...prev]; next[idx] = date; return next; });
  }

  function setValParcela(idx: number, val: number) {
    setVals(prev => { const next = [...prev]; next[idx] = val; return next; });
  }

  async function handleAiParse(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiLoading(true);
    setAiObs("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-pagamento-file", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar arquivo");
      const parsedN: number = data.numeroParcelas || 0;
      const parsedDates: string[] = Array.isArray(data.vencimentos) ? data.vencimentos : [];
      const parsedValues: number[] = Array.isArray(data.valores) ? data.valores : [];
      if (parsedN > 0) {
        setForma("parcelado");
        setNParcelas(String(parsedN));
        setVencs(Array.from({ length: parsedN }, (_, i) => parsedDates[i] || ""));
        setVals(Array.from({ length: parsedN }, (_, i) => parsedValues[i] || 0));
      }
      if (data.observacao) setAiObs(data.observacao);
      toast({ title: `IA extraiu ${parsedN} parcela(s) com ${parsedDates.length} data(s)` });
    } catch (err: any) {
      toast({ title: "Erro na leitura IA", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleConfirm() {
    onConfirm({ formaPagamento: forma, numeroParcelas: nParcelas, vencimento: venc, vencimentosParcelas: vencs, valoresParcelas: vals, valorAVista });
    onClose();
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg w-full flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-gold" />
            Forma de Pagamento do Ativo de Origem
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
          {/* Forma */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Modalidade</Label>
            <Select value={forma} onValueChange={(v) => { setForma(v); if (v !== "parcelado") setNParcelas(""); }}>
              <SelectTrigger data-testid="modal-select-forma">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a_vista">À Vista</SelectItem>
                <SelectItem value="parcelado">Parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nº parcelas */}
          {forma === "parcelado" && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Número de Parcelas</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={2} placeholder="Ex: 12"
                  value={nParcelas}
                  onChange={e => handleNParcelasChange(e.target.value)}
                  className="w-32" data-testid="modal-input-parcelas"
                />
                <span className="text-sm text-muted-foreground">vezes</span>
              </div>
            </div>
          )}

          {/* IA file reader */}
          <div className="rounded-lg border border-dashed border-brand-gold/40 bg-brand-gold/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-gold" />
              <span className="text-sm font-medium">Leitura Automática com IA</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Envie um PDF, Excel ou CSV com o cronograma de parcelas e a IA preencherá as datas automaticamente.
            </p>
            <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" className="hidden" onChange={handleAiParse} />
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={aiLoading}
              className="w-full border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10"
              data-testid="button-ai-parse"
            >
              {aiLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lendo arquivo...</> : <><Upload className="w-4 h-4 mr-2" /> Enviar arquivo</>}
            </Button>
            {aiObs && <p className="text-xs text-brand-gold/80 italic">IA: {aiObs}</p>}
          </div>

          {/* Valor total à vista */}
          {forma === "a_vista" && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Valor Total</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">R$</span>
                <Input
                  type="number" min={0} step={0.01} placeholder="0,00"
                  value={valorAVista || ""}
                  onChange={e => setValorAVista(parseFloat(e.target.value) || 0)}
                  className="flex-1" data-testid="modal-input-valor-avista"
                />
              </div>
            </div>
          )}

          {/* Vencimento à vista */}
          {forma === "a_vista" && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1">
                <CalendarClock className="w-4 h-4" /> Vencimento <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              {venc ? (
                <div className="flex items-center gap-2">
                  <Input type="date" value={venc} onChange={e => setVenc(e.target.value)} className="flex-1" />
                  <button type="button" onClick={() => setVenc("")} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button" onClick={() => setVenc(today)}
                  className="w-full h-9 text-left px-3 text-sm text-muted-foreground border border-dashed rounded hover:border-muted-foreground/60 transition-colors"
                >
                  + Adicionar vencimento
                </button>
              )}
            </div>
          )}

          {/* Parcelas */}
          {forma === "parcelado" && n > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <CalendarClock className="w-4 h-4" /> Parcelas <span className="text-muted-foreground text-xs">(data e valor opcionais)</span>
              </Label>
              <ScrollArea className="h-72 rounded border p-2">
                <div className="space-y-2 pr-2">
                  {vencs.map((v, idx) => (
                    <div key={idx} className="space-y-1 rounded-md bg-muted/30 p-2">
                      <span className="text-[11px] font-mono text-muted-foreground">Parcela {idx + 1}/{n}</span>
                      <div className="flex items-center gap-1.5">
                        {v ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input type="date" value={v} onChange={e => setVencParcela(idx, e.target.value)} className="h-7 text-xs flex-1" />
                            <button type="button" onClick={() => setVencParcela(idx, "")} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button" onClick={() => setVencParcela(idx, today)}
                            className="flex-1 h-7 text-left px-2 text-xs text-muted-foreground border border-dashed rounded hover:border-muted-foreground/60 transition-colors"
                          >
                            + Data
                          </button>
                        )}
                        <div className="flex items-center gap-1 w-32 shrink-0">
                          <span className="text-xs text-muted-foreground shrink-0">R$</span>
                          <Input
                            type="number" min={0} step={0.01}
                            placeholder="0,00"
                            value={vals[idx] || ""}
                            onChange={e => setValParcela(idx, parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs"
                            data-testid={`input-valor-parcela-${idx}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{vencs.filter(v => v).length}/{n} datas · {vals.filter(v => v > 0).length}/{n} valores definidos</span>
                {vals.some(v => v > 0) && (
                  <span className="font-mono">Total: R$ {vals.reduce((s, v) => s + (v || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} className="bg-brand-gold text-brand-navy hover:bg-brand-gold/90" data-testid="modal-confirm-pagamento">
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
