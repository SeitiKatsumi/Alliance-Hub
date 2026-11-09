import { PROPERTY_AREA_FIELDS, PROPERTY_AREA_LABELS, type PropertyValuationAreas } from "@shared/property-valuation";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function PropertyValuationAreaFields({ value, onChange }: { value: PropertyValuationAreas; onChange: (patch: PropertyValuationAreas) => void }) {
  return <fieldset className="col-span-full min-w-0 space-y-3 rounded-lg border p-4">
    <legend className="px-1 text-sm font-semibold">Áreas para avaliação BUILT</legend>
    <div className="grid gap-3 sm:grid-cols-2">{PROPERTY_AREA_FIELDS.map(key => <Label key={key} className="space-y-2">
      <span>{PROPERTY_AREA_LABELS[key]} (m²)</span><Input inputMode="decimal" value={value[key] ?? ""} onChange={event => onChange({ [key]: event.target.value })} />
    </Label>)}</div>
    <Label className="block space-y-2"><span>Área usada na comparação</span>
      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value.area_avaliacao_tipo || ""} onChange={event => onChange({ area_avaliacao_tipo: (event.target.value || null) as PropertyValuationAreas["area_avaliacao_tipo"] })}>
        <option value="">Selecione a natureza da área</option><option value="privativa">Privativa</option><option value="construida">Construída</option>
      </select>
    </Label>
  </fieldset>;
}
