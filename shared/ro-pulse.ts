import { z } from 'zod';
import { normalizeRoTimeZone } from './ro';

export const RO_PULSE_STAGES = ['origem', 'regional', 'nacional', 'global'] as const;
export type RoPulseStage = typeof RO_PULSE_STAGES[number];
export const RO_PULSE_LABELS: Record<RoPulseStage,string> = {origem:'Comunidade de origem',regional:'Comunidades regionais',nacional:'Comunidades nacionais',global:'Comunidades globais'};
const ids = z.array(z.string().trim().min(1).max(100)).max(500).transform(values => [...new Set(values)]);
export const roPulseSchema = z.object({intervalo_horas:z.number().int().min(1).max(168),comunidades:z.object({regional:ids,nacional:ids,global:ids})}).strict();
export type RoPulseConfig = z.infer<typeof roPulseSchema>;
export type PulseCommunity = {id:string;nome?:string;sigla?:string;territorio?:string|null;pais?:string|null};
const normalized = (v:unknown) => String(v || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

/** Community scopes are disjoint; an empty country never implies a global destination. */
export function roCommunityStage(origin:PulseCommunity, target:PulseCommunity):RoPulseStage|null {
  if(String(origin.id)===String(target.id))return 'origem';
  if(!normalized(origin.pais)||!normalized(target.pais))return null;
  if(normalized(origin.pais)!==normalized(target.pais))return 'global';
  return normalized(origin.territorio)&&normalized(origin.territorio)===normalized(target.territorio)?'regional':'nacional';
}
export function roPulseWaves(originId:string, communities:PulseCommunity[], raw:unknown) {
  const config=roPulseSchema.parse(raw),origin=communities.find(c=>String(c.id)===originId);
  if(!origin)throw new Error('Comunidade de origem indisponível.');
  const waves:Array<{stage:RoPulseStage;communities:string[]}>= [{stage:'origem',communities:[originId]}];
  for(const stage of RO_PULSE_STAGES.slice(1) as Array<Exclude<RoPulseStage,'origem'>>) {
    for(const id of config.comunidades[stage]) {
      const community=communities.find(c=>String(c.id)===id);
      if(!community||roCommunityStage(origin,community)!==stage)throw new Error('Comunidade fora do alcance selecionado.');
    }
    if(config.comunidades[stage].length)waves.push({stage,communities:config.comunidades[stage]});
  }
  return {config,waves};
}
export function roPulseOpen(meeting:{data:unknown;hora?:unknown;timezone?:unknown;status?:unknown}, now=new Date()) {
  if(meeting.status!=='agendada')return false;
  let zone:string;try{zone=normalizeRoTimeZone(meeting.timezone);}catch{return false;}
  const values=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const part=(type:string)=>values.find(v=>v.type===type)?.value;
  const current=`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  const date=meeting.data instanceof Date?meeting.data.toISOString().slice(0,10):String(meeting.data).slice(0,10);
  return `${date}T${String(meeting.hora||'00:00').slice(0,5)}`>current;
}
export function roPulseHref(id:string){return `/ros/avisos/${encodeURIComponent(id)}`;}
/** Receiving a pulse authorizes only this invitation summary, never the RO's private objects. */
export function roPulseSummary(meeting:any){return {id:String(meeting.id),codigo:meeting.codigo,titulo:meeting.titulo,data:meeting.data instanceof Date?meeting.data.toISOString().slice(0,10):String(meeting.data).slice(0,10),hora:meeting.hora,timezone:meeting.timezone,location_type:meeting.location_type,status:meeting.status};}
