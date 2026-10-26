import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { STRATEGIC_CELL_TYPES, STRATEGIC_CELL_BUSINESS_TYPES, formatBusinessThesisLabel } from "@shared/strategic-cells";

type Preferences = { business_type_codes: string[] };
export function BiaBusinessType({ value, onChange, disabled }: { value: string; onChange: (code: string) => void; disabled?: boolean }) {
  const preferences = useQuery<Preferences>({ queryKey: ["/api/me/celulas-preferencias"], staleTime: 0, refetchOnWindowFocus: true });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const save = useMutation({
    mutationFn: async () => (await apiRequest("PUT", "/api/me/celulas-preferencias", { business_type_codes: draft })).json(),
    onSuccess: async (data: Preferences) => {
      queryClient.setQueryData(["/api/me/celulas-preferencias"], data);
      void queryClient.invalidateQueries({ queryKey: ["/api/me/celulas"] });
      if (value && !data.business_type_codes.includes(value)) onChange("");
      setOpen(false);
    },
  });
  const available = STRATEGIC_CELL_BUSINESS_TYPES.filter(([, code]) => code === value || preferences.data?.business_type_codes.includes(code));
  return <section className="min-w-0 space-y-3" data-testid="bia-business-type">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-medium">Tese de interesse *</h3>
      <Button type="button" variant="ghost" aria-expanded={open} aria-controls="bia-business-review" className="h-auto whitespace-normal p-0 text-primary underline" disabled={disabled || !preferences.data || save.isPending} onClick={() => { setDraft([...preferences.data!.business_type_codes]); save.reset(); setOpen(!open); }}>Revisar teses de interesse</Button>
    </div>
    {preferences.isPending ? <p role="status">Carregando suas teses de interesse…</p> : preferences.isError ? <div role="alert"><p>Não foi possível carregar suas teses de interesse</p><Button type="button" variant="outline" onClick={() => preferences.refetch()}>Tentar novamente</Button></div> : !available.length ? <p className="text-sm text-muted-foreground">Você ainda não selecionou nenhuma tese do catálogo atual. Use “Revisar teses de interesse” para escolher antes de continuar</p> : <div className="space-y-4">{STRATEGIC_CELL_TYPES.map((cell) => {
      const items = available.filter(([cellCode]) => cellCode === cell.code);
      return items.length > 0 && <div key={cell.code}><h3 className="mb-2 text-sm font-medium text-muted-foreground">{cell.publicName}</h3><div className="flex flex-wrap gap-2">{items.map(([, code, , label]) => <Button key={code} type="button" variant={value === code ? "default" : "outline"} aria-pressed={value === code} disabled={disabled} className="h-auto max-w-full whitespace-normal text-left" onClick={() => onChange(code)}>{formatBusinessThesisLabel(label)}</Button>)}</div></div>;
    })}</div>}
    {open && <div id="bia-business-review" className="space-y-4 rounded-lg border bg-muted/30 p-4">
        <h4 className="font-medium">Revisar teses de interesse</h4>
        {STRATEGIC_CELL_TYPES.map((cell) => <div key={cell.code} className="space-y-2"><h3 className="font-medium">{cell.publicName}</h3><div className="flex flex-wrap gap-2">{STRATEGIC_CELL_BUSINESS_TYPES.filter(([cellCode]) => cellCode === cell.code).map(([, code, , label]) => <Button key={code} type="button" variant={draft.includes(code) ? "default" : "outline"} aria-pressed={draft.includes(code)} disabled={save.isPending} className="h-auto max-w-full whitespace-normal text-left" onClick={() => setDraft((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code])}>{formatBusinessThesisLabel(label)}</Button>)}</div></div>)}
        {save.isError && <p role="alert" className="text-sm text-destructive">Não foi possível salvar suas escolhas. Tente novamente</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" disabled={save.isPending} onClick={() => save.mutate()} loading={save.isPending}>{save.isPending ? "Salvando…" : "Salvar teses de interesse"}</Button></div>
    </div>}
  </section>;
}
