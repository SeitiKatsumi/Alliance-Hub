import {useId,useState} from 'react';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {normalizePropertyCib} from '@shared/property-cib';

export function PropertyCibField({value,onChange,disabled=false}:{value?:string|null;onChange:(value:string)=>void;disabled?:boolean}) {
  const id=useId();const [error,setError]=useState('');
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>CIB (opcional)</Label>
    <Input id={id} value={value||''} disabled={disabled} autoComplete="off" autoCapitalize="characters" spellCheck={false}
      placeholder="Ex.: ABC1234-5" aria-describedby={`${id}-help`} aria-invalid={!!error}
      onChange={event=>{setError('');onChange(event.target.value.toUpperCase());}}
      onBlur={()=>{try{onChange(normalizePropertyCib(value));setError('');}catch(reason:any){setError(reason.message);}}}/>
    <p id={`${id}-help`} className="text-xs text-muted-foreground">Cadastro Imobiliário Brasileiro. Preencha se já tiver o código.</p>
    {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
