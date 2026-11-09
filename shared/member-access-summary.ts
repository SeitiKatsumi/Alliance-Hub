import { canAccessBuiltEnvironment } from './environment-access';
import { BIA_PARTICIPANT_ROLE_LABELS, collectBiaParticipantRoles, defaultBiaAccessForRoles, resolveBiaParticipantPermissions, FULL_BIA_ACCESS, canConfigureBiaParticipantAccess, type BiaAccessMatrix } from './bia-access';

export const ACCOUNT_ROLE_LABELS: Record<string,string> = {user:'Usuário comum',membro:'Membro BUILT',investidor:'Investidor (perfil anterior)',aliado:'Aliado licenciado',manager:'Gestor da plataforma',admin:'Superadmin',superadmin:'Superadmin',master:'Superadmin',coproprietario:'Coproprietário limitado',employee:'Funcionário'};
export const ACCESS_LEVEL_LABELS = {none:'Sem acesso',view:'Visualizar',edit:'Editar'};
export const MEMBER_BIA_ACCESS_LABELS: Record<keyof BiaAccessMatrix,string> = {diretoria:'Diretoria',configuracao_bia:'Configuração da BIA',documentos_tecnico:'Documentos técnicos',documentos_obra:'Documentos de obra',documentos_comercial:'Documentos comerciais',documentos_capital:'Documentos de capital',capital_banco:'Banco',capital_financeiro:'Financeiro',capital_analises:'Análises',capital_calculadora:'Composição econômica (DM)'};

export function accountProfiles(role:string, member:any): string[] {
  const seals=Array.isArray(member?.Outras_redes_as_quais_pertenco)?member.Outras_redes_as_quais_pertenco:[];
  return [
    ...(role==='membro'||member?.em_membros_built===true||seals.includes('BUILT_PROUD_MEMBER')?['membro']:[]),
    ...(role==='aliado'||seals.includes('BUILT_ALLIANCE_PARTNER')?['aliado']:[]),
  ];
}

export function memberAccessSummary(input: {user:any; member:any; biases:any[]; overrides:any[]; entitlement:boolean; employee:any; bootstrap:boolean; sharedProperties?:{id:string;name:string}[]}) {
  const {user,member,employee}=input;
  const role = employee ? 'employee' : input.bootstrap ? 'admin' : user.role || 'user';
  const admin = ['admin','superadmin','manager','master'].includes(role);
  const memberId=String(user.membro_directus_id || '');
  const alliances=input.biases.flatMap(bia=>{
    const roles=collectBiaParticipantRoles(bia).get(memberId)||[];
    if(!roles.length) return [];
    const override=input.overrides.find(row=>String(row.bia_id)===String(bia.id));
    const permissions=resolveBiaParticipantPermissions(roles,override?.permissions);
    return [{id:String(bia.id),code:bia.codigo_publico || bia.id,name:bia.nome_bia || 'BIA',roles,roleLabels:roles.map(r=>BIA_PARTICIPANT_ROLE_LABELS[r]),permissions:admin?{...FULL_BIA_ACCESS}:permissions,participantPermissions:permissions,defaults:defaultBiaAccessForRoles(roles),customized:!!override,editable:!admin && !employee && canConfigureBiaParticipantAccess(roles),updatedAt:override?.updated_at || null}];
  });
  const subject={...member,role,permissions:user.permissions,has_alliance_participation:alliances.length>0,company_employee:!!employee,company_permissions:employee?.permissions};
  return {sharedProperties:input.sharedProperties || [],userId:String(user.id),memberId,role,roleLabel:ACCOUNT_ROLE_LABELS[role]||role,profiles:accountProfiles(role,member),active:!!user.ativo,bootstrap:input.bootstrap,admin,employee:!!employee,entitlement:input.entitlement,alliances,environments:role==='coproprietario'?[
    {key:'carteira',label:'Imóveis compartilhados',allowed:true},
    {key:'alliances',label:'Alianças compartilhadas',allowed:true},
  ]:[
    {key:'vitrine',label:'Vitrine',allowed:canAccessBuiltEnvironment(subject,'vitrine')},
    {key:'alliances',label:'Alianças',allowed:canAccessBuiltEnvironment(subject,'alliances')},
  ],published:member.na_vitrine===true, professional: Array.isArray(member.account_purposes)&&member.account_purposes.includes('profissional')};
}
export type MemberAccessSummary = ReturnType<typeof memberAccessSummary>;
