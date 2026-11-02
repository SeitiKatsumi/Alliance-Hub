import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importPreviewError, mergeImportPreview, type ImportPreviewItem } from "@shared/import-preview";

type Option = { id: number; nome: string };
const statuses = { pendente: "Pendente", agendado: "Agendado", pago: "Pago", parcial: "Parcialmente pago", vencido: "Vencido", cancelado: "Cancelado" };
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground";

export function ImportPreviewEditor({ items, onChange, disabled, renderCategory, categoryLabel, cppTypes }: {
  items: ImportPreviewItem[]; onChange: (items: ImportPreviewItem[]) => void; disabled: boolean; renderCategory: (item: ImportPreviewItem, index: number, onChange: (id: number | null) => void) => ReactNode; categoryLabel: (id: number | null) => string; cppTypes: Option[];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [undo, setUndo] = useState<ImportPreviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const update = (index: number, patch: Partial<ImportPreviewItem>) => { onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item)); setError(null); };
  return <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-md border border-border p-3">
    <legend className="px-1 font-semibold">Prévia dos lançamentos</legend>
    <p className="text-sm text-muted-foreground">{items.length} lançamento{items.length === 1 ? "" : "s"} com o arquivo anexado. Confira e edite antes de criar.</p>
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.length === items.length} onChange={e => setSelected(e.target.checked ? items.map((_, i) => i) : [])} /> Selecionar todos</label>
      <Button type="button" variant="outline" disabled={disabled || selected.length < 2} onClick={() => {
        try { const merged = mergeImportPreview(items, selected); setUndo(items); onChange(merged); setSelected([]); setEditing(null); setError(null); }
        catch (e) { setError((e as Error).message); }
      }}>Juntar selecionados{selected.length > 0 ? ` (${selected.length})` : ""}</Button>
      {undo && <Button type="button" variant="ghost" onClick={() => { onChange(undo); setUndo(null); setSelected([]); setEditing(null); setError(null); }}>Desfazer junção</Button>}
    </div>
    {(error || importPreviewError(items)) && <p role="alert" className="text-sm text-destructive">{error || importPreviewError(items)}</p>}
    <div className="space-y-3">
      {items.map((item, index) => <div key={index} className="min-w-0 rounded-md border border-border p-3">
        <div className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" aria-label={`Selecionar lançamento ${index + 1}`} checked={selected.includes(index)} onChange={e => setSelected(e.target.checked ? [...selected, index] : selected.filter(i => i !== index))} />
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium">{item.descricao || "Sem descrição"}</p>
            <p className="text-sm">{item.tipo === "saida" ? "Saída" : "Entrada"} · {money(item.valor)} · {statuses[item.status]}</p>
            <p className="text-xs text-muted-foreground">{(item.data_vencimento || item.data).split("-").reverse().join("/")} · {categoryLabel(item.categoria_id) || "Sem categoria"}</p>
          </div>
          <Button type="button" size="sm" variant="outline" aria-label={`Editar lançamento ${index + 1}`} onClick={() => setEditing(editing === index ? null : index)}>{editing === index ? "Concluir" : "Editar"}</Button>
        </div>
        {editing === index && <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Descrição *<Input maxLength={180} value={item.descricao} onChange={e => update(index, { descricao: e.target.value })} /></label>
          <label className="space-y-1 text-sm">Valor (R$) *<Input type="number" min="0.01" step="0.01" value={Number.isFinite(item.valor) ? item.valor : ""} onChange={e => update(index, { valor: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>
          <label className="space-y-1 text-sm">Tipo<select className={selectClass} value={item.tipo} onChange={e => update(index, { tipo: e.target.value as ImportPreviewItem["tipo"] })}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
          <label className="space-y-1 text-sm">Status<select className={selectClass} value={item.status} onChange={e => update(index, { status: e.target.value as ImportPreviewItem["status"], ...(e.target.value !== "pago" && e.target.value !== "parcial" ? { data_pagamento: null } : {}) })}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {([['data','Data do lançamento *'],['data_vencimento','Vencimento'],['data_pagamento','Data do pagamento']] as const).map(([key, label]) => <label key={key} className="space-y-1 text-sm">{label}<Input type="date" value={item[key] || ""} disabled={key === "data_pagamento" && !["pago", "parcial"].includes(item.status)} onChange={e => update(index, { [key]: e.target.value || (key === "data" ? "" : null) })} /></label>)}
          <div className="space-y-1 text-sm"><span>Categoria</span>{renderCategory(item, index, id => update(index, { categoria_id: id, categoria_nome: categoryLabel(id) || null }))}</div>
          <label className="space-y-1 text-sm">Tipo de CPP<select className={selectClass} value={item.tipo_cpp_id ?? ""} onChange={e => { const option = cppTypes.find(c => String(c.id) === e.target.value); update(index, { tipo_cpp_id: option?.id ?? null, tipo_cpp_nome: option?.nome ?? null }); }}><option value="">Nenhum</option>{cppTypes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        </div>}
      </div>)}
    </div>
  </fieldset>;
}
