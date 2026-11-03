import { manualTrackingFields, type TrackingValues } from '@shared/bia-tracking';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function BiaTrackingFields({ thesis, values, onChange, disabled, currency = 'BRL' }: {
  thesis: string; values: TrackingValues; onChange: (values: TrackingValues) => void; disabled?: boolean; currency?: string;
}) {
  const fields = manualTrackingFields(thesis);
  if (!fields.length) return null;
  return <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label="Acompanhamento da tese">
    <h3 className="font-semibold">Acompanhamento da BIA</h3>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {fields.map(field => <div key={field.key} className="min-w-0 space-y-2">
        <Label htmlFor={`tracking-${field.key}`}>{field.label}{field.kind === 'money' ? ` (${currency})` : ''}</Label>
        {field.kind === 'select' ? <select id={`tracking-${field.key}`} value={values[field.key] ?? ''} disabled={disabled} onChange={e => onChange({ ...values, [field.key]: e.target.value || null })} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50">
          <option value="">Não informado</option>{field.options!.map(option => <option key={option} value={option}>{option}</option>)}
        </select> : <Input id={`tracking-${field.key}`} type={field.kind === 'month' || field.kind === 'date' ? field.kind : 'number'} min={field.kind === 'money' && field.signed ? undefined : field.kind === 'integer' || field.kind === 'money' ? 0 : undefined} step={field.kind === 'integer' ? 1 : field.kind === 'money' ? '0.01' : undefined} value={values[field.key] ?? ''} disabled={disabled} onChange={e => onChange({ ...values, [field.key]: e.target.value === '' ? null : field.kind === 'money' || field.kind === 'integer' ? Number(e.target.value) : e.target.value })} />}
      </div>)}
    </div>
  </section>;
}
