import { BIA_PARTICIPANT_ROLE_FIELDS, BIA_PARTICIPANT_ROLE_LABELS, collectBiaParticipantRoles, relationId, type BiaParticipantRole } from './bia-access';
import { getContributionNuclei } from './contribution-areas';

/** Profile contribution nuclei group existing BIA participants for display; they never grant a role or access. */
export const BIA_ORGANIZATION_BRANCHES = [
  {role:'diretor_tecnico', title:'Núcleo Técnico', nucleus:'Núcleo Técnico'},
  {role:'diretor_obra', title:'Núcleo de Obras', nucleus:'Núcleo de Obra'},
  {role:'diretor_comercial', title:'Núcleo Comercial', nucleus:'Núcleo Comercial'},
  {role:'diretor_capital', title:'Núcleo de Capital', nucleus:'Núcleo de Capital'},
] as const;

export type OrganizationMember = {
  id: string;
  ramo_atuacao?: string | null;
  segmento?: string | null;
  tipos_alianca?: unknown;
  tipo_alianca?: unknown;
  nucleos_alianca?: unknown;
  nucleo_alianca?: unknown;
};
export type OrganizationPerson = {id:string;guardian:boolean;multiplier:boolean;roles:BiaParticipantRole[];activity:string[]};

function values(value:unknown):string[] {
  if(Array.isArray(value)) return value.flatMap(values);
  if(typeof value!=='string'||!value.trim()) return [];
  try { const parsed=JSON.parse(value); if(Array.isArray(parsed)) return values(parsed); } catch {}
  return value.split(';').map(v=>v.trim()).filter(Boolean);
}
function nuclei(member?:OrganizationMember):string[] {
  if(!member) return [];
  // Explicit modern selections (even empty) supersede stale legacy selections.
  const areas=member.tipos_alianca??member.tipo_alianca;
  if(areas!=null) return getContributionNuclei(values(areas));
  return values(member.nucleos_alianca??member.nucleo_alianca).map(n=>n==='Núcleo de Obras'?'Núcleo de Obra':n);
}
export function biaOrganization(bia:Record<string,unknown>,members:ReadonlyArray<OrganizationMember>=[]) {
  const roster=collectBiaParticipantRoles(bia);
  const profiles=new Map(members.map(member=>[member.id,member]));
  const person=(id:string|null):OrganizationPerson|null => {
    if(!id) return null;
    const roles=roster.get(id)||[];
    const profile=profiles.get(id);
    const isDirector=roles.some(role=>role.startsWith('diretor_'));
    return {id,guardian:roles.includes('socio_guardiao'),multiplier:roles.includes('socio_multiplicador'),roles,
      activity:isDirector?[]:[...new Set([...values(profile?.segmento),...values(profile?.ramo_atuacao)])]};
  };
  const assigned=(role:keyof typeof BIA_PARTICIPANT_ROLE_FIELDS)=>person(relationId(bia[BIA_PARTICIPANT_ROLE_FIELDS[role]]));
  const director=assigned('diretor_alianca'),advisor=assigned('aliado'),author=assigned('autor');
  const leadership=new Set([director,advisor,...BIA_ORGANIZATION_BRANCHES.map(branch=>assigned(branch.role))].filter(Boolean).map(p=>p!.id));
  const team=[...roster.keys()].filter(id=>!leadership.has(id)).map(id=>person(id)!);
  const branches=BIA_ORGANIZATION_BRANCHES.map(branch=>({...branch,label:BIA_PARTICIPANT_ROLE_LABELS[branch.role],person:assigned(branch.role),
    members:team.filter(p=>nuclei(profiles.get(p.id)).includes(branch.nucleus))}));
  const placed=new Set([...leadership,...branches.flatMap(branch=>branch.members.map(p=>p.id)),...(author?[author.id]:[])]);
  return {director,advisor,author,branches,participants:[...roster.keys()].filter(id=>!placed.has(id)).map(id=>person(id)!)};
}
