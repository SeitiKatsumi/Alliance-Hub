import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface OpportunityCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityCode: string;
  onSuccess: () => void;
}

const initialForm = () => ({
  status: "contratada",
  resultado: "",
  valor: "",
  moeda: "BRL",
  sem_valor_financeiro: false,
  observacoes: "",
});

export default function OpportunityCloseDialog({ open, onOpenChange, opportunityCode, onSuccess }: OpportunityCloseDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const closeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rede/oportunidades/${opportunityCode}/fechamento`, {
        ...form,
        valor: form.sem_valor_financeiro ? null : Number(String(form.valor).replace(",", ".")),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Oportunidade encerrada", description: "O resultado foi registrado no histórico de governança." });
      setForm(initialForm());
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: any) => toast({ title: "Não foi possível encerrar", description: error?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Encerrar Oportunidade</DialogTitle>
          <DialogDescription>Registre o desfecho. O participante marcado como selecionado será associado automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Resultado</Label>
            <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contratada">Contratada</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="encerrada_sem_acordo">Encerrada sem acordo</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Descrição do resultado</Label><Textarea value={form.resultado} onChange={(event) => setForm({ ...form, resultado: event.target.value })} placeholder="Ex.: contratação aprovada e início previsto para setembro." /></div>
          <label className="flex items-center gap-3 text-sm"><Checkbox checked={form.sem_valor_financeiro} onCheckedChange={(checked) => setForm({ ...form, sem_valor_financeiro: checked === true })} />Sem valor financeiro</label>
          {!form.sem_valor_financeiro && (
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <div className="space-y-2"><Label>Valor contratado</Label><Input inputMode="decimal" value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} placeholder="0,00" /></div>
              <div className="space-y-2"><Label>Moeda</Label><Select value={form.moeda} onValueChange={(moeda) => setForm({ ...form, moeda })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BRL">BRL</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select></div>
            </div>
          )}
          <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} placeholder="Datas, condições e próximos passos." /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!form.resultado.trim() || (!form.sem_valor_financeiro && !form.valor) || closeMutation.isPending} onClick={() => closeMutation.mutate()}>{closeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar encerramento</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
