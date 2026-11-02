import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Paperclip, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ReceiptCandidate, ReceiptFacts } from "@shared/receipt-matching";

type Analysis = { id: string; arquivo: string; dados: ReceiptFacts; candidatos: ReceiptCandidate[]; anexado: boolean; automatico: boolean; lancamentoId: string | null };
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (v: string | null) => v ? v.slice(0, 10).split("-").reverse().join("/") : "Não identificada";
export function ReceiptMatching({ biaId, onEdit }: { biaId: string; onEdit: (id: string, paid: boolean, paymentDate: string | null) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const availability=useQuery<{disponivel:boolean;motivo:string|null}>({queryKey:['/api/fluxo-caixa/comprovantes/disponibilidade'],enabled:open,staleTime:0,retry:false});
  function receive(data: Analysis) {
    setResult(data); setSelected(""); setError("");
    if (data.anexado) {
      queryClient.invalidateQueries({ queryKey: ["/api/fluxo-caixa"] });
      queryClient.invalidateQueries({ predicate: q => q.queryKey.some(k => typeof k === "string" && k.includes("historico")) });
    }
  }
  const analyze = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um comprovante.");
      const form = new FormData(); form.append("file", file); form.append("bia_id", biaId);
      const response = await fetch("/api/fluxo-caixa/comprovantes/analisar", { method: "POST", body: form, credentials: "include", signal: AbortSignal.timeout(90_000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível analisar o comprovante.");
      return data as Analysis;
    }, onSuccess: receive, onError: (e: Error) => setError(e.name === "TimeoutError" ? "A leitura demorou mais que o esperado. Tente novamente com o mesmo arquivo." : e.message),
  });
  const attach = useMutation({
    mutationFn: async () => {
      const candidate = result?.candidatos.find(c => c.id === selected);
      if (!result || !candidate) throw new Error("Escolha o lançamento.");
      return (await apiRequest("POST", `/api/fluxo-caixa/comprovantes/${result.id}/anexar`, { lancamento_id: candidate.id, fingerprint: candidate.fingerprint })).json();
    }, onSuccess: receive, onError: (e: Error) => setError(e.message),
  });
  const busy = analyze.isPending || attach.isPending || opening;
  async function edit(paid: boolean) {
    if (!result?.lancamentoId) return;
    setOpening(true); setError("");
    try { await onEdit(result.lancamentoId, paid, result.dados.situacao === "realizado" ? result.dados.data_pagamento : null); setOpen(false); }
    catch (e: any) { setError(e.message || "Não foi possível abrir o lançamento."); }
    finally { setOpening(false); }
  }
  return <>
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Paperclip className="h-4 w-4" />Anexar comprovante com IA</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Anexar comprovante com IA</DialogTitle><DialogDescription>
          Envie o comprovante para localizar e anexar ao lançamento correspondente.
        </DialogDescription></DialogHeader>
        <div className="space-y-2"><Label htmlFor="receipt-file">Comprovante · PDF, JPG, PNG ou WebP · até 10 MB</Label>
          <Input id="receipt-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy} onChange={e => {
            const next = e.target.files?.[0] || null; setFile(next); setResult(null); setSelected("");
            setError(next && next.size > 10 * 1024 * 1024 ? "O arquivo deve ter até 10 MB." : "");
          }} />
        </div>
        {availability.data?.motivo && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{availability.data.motivo}</p>}
        {availability.isError && <p role="alert">Não foi possível conferir a disponibilidade da leitura. Feche e abra novamente.</p>}
        {error && !busy && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!result?.anexado && <Button type="button" disabled={!availability.data?.disponivel || !file || file.size > 10 * 1024 * 1024 || busy} loading={analyze.isPending} loadingText="Lendo e procurando…" onClick={() => { setError(""); analyze.mutate(); }}>Ler e localizar lançamento</Button>}
        {result && <ReceiptMatchingResult result={result} selected={selected} onSelect={setSelected} disabled={busy} />}
        {result?.anexado && <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => edit(false)}>Editar lançamento</Button>
          {result.candidatos.find(c => c.id === result.lancamentoId)?.status !== "pago" && <Button type="button" disabled={busy} onClick={() => edit(true)}>Marcar como pago</Button>}
          <p className="w-full text-xs text-muted-foreground">Confira e salve a edição para confirmar qualquer alteração no pagamento.</p>
        </div>}
        {result && !result.anexado && result.candidatos.length > 0 && <Button type="button" loading={attach.isPending} disabled={!selected || busy} onClick={() => { setError(""); attach.mutate(); }}>Anexar ao lançamento escolhido</Button>}
      </DialogContent>
    </Dialog>
  </>;
}
export function ReceiptMatchingResult({ result, selected, onSelect, disabled }: { result: Analysis; selected: string; onSelect: (id: string) => void; disabled: boolean }) {
  if (result.anexado) {
    const linked = result.candidatos.find(c => c.id === result.lancamentoId);
    return <div role="status" className="rounded-lg border p-4 space-y-2"><p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Comprovante anexado{result.automatico ? " automaticamente" : ""}</p>
      <p className="text-sm break-words">{linked?.descricao || "Lançamento encontrado"}{linked ? ` · ${money(linked.valor)}` : ""}</p>
      {!!linked?.motivos.length && <p className="text-sm text-muted-foreground">{linked.motivos.join(" · ")}</p>}
      {!!linked?.avisos?.length && <p className="text-sm text-amber-700 dark:text-amber-300">Confira: {linked.avisos.join(" ")}</p>}
      <p className="text-sm text-muted-foreground">Disponível nos anexos e no histórico do lançamento. Status de pagamento preservado.</p></div>;
  }
  return <div className="space-y-3">
    <div className="rounded-lg border p-3 text-sm space-y-1 break-words"><p className="font-medium">Dados lidos do arquivo</p>
      <p>Valor: {result.dados.valor !== null ? (result.dados.moeda === "BRL" ? money(result.dados.valor) : `${result.dados.valor} · moeda não identificada`) : "Não identificado"}</p>
      <p>Data de pagamento: {day(result.dados.data_pagamento)}</p><p>Vencimento: {day(result.dados.data_vencimento)}</p>
      {result.dados.pagador && <p>Pagador: {result.dados.pagador}</p>}{result.dados.recebedor && <p>Recebedor: {result.dados.recebedor}</p>}
      {result.dados.multiplas_transacoes && <p>O arquivo pode conter mais de uma transação. Confira antes de vincular.</p>}
    </div>
    <p role="status" className="text-sm">{result.candidatos.length > 1
      ? `Encontrei ${result.candidatos.length} possíveis lançamentos para este comprovante. Confira as informações e escolha a qual ele pertence:`
      : result.candidatos.length === 1
        ? "Encontrei um possível lançamento para este comprovante. Confira as informações e diferenças antes de confirmar:"
        : "Nenhum lançamento compatível foi encontrado nesta BIA. Confira os dados do arquivo e do lançamento; você também pode anexá-lo pela edição do lançamento."}</p>
    <fieldset className="space-y-2"><legend className="sr-only">Lançamento para receber o comprovante</legend>{result.candidatos.map(c => <label key={c.id} className="flex gap-3 rounded-lg border p-3 cursor-pointer">
      <input type="radio" name="receipt-candidate" className="mt-1" checked={selected === c.id} onChange={() => onSelect(c.id)} disabled={disabled} />
      <span className="min-w-0 text-sm break-words"><span className="block font-medium">{c.descricao}</span><span className="block">{c.tipo === "entrada" ? "Entrada" : "Saída"} · {money(c.valor)} · {day(c.data)} · {c.status}</span>{c.pessoa && <span className="block">{c.pessoa}</span>}<span className="block text-muted-foreground">{c.motivos.join(" · ")}</span>{!!c.avisos?.length && <span className="mt-1 block text-amber-700 dark:text-amber-300">Confira: {c.avisos.join(" ")}</span>}</span>
    </label>)}</fieldset>
  </div>;
}
