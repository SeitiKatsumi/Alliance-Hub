// These are real persisted account roles, not simulated BIA or company assignments.
export const ACCOUNT_ACCESS_PRESETS = [
  {value:'user',role:'user',label:'Usuário comum · imóveis próprios',description:'Usuário comum gerencia seus imóveis, receitas, despesas e documentos, acompanha a Agenda e consulta a Vitrine.'},
  {value:'professional',role:'user',label:'Profissional · Vitrine',description:'Profissional tem os acessos da conta comum e pode publicar seu perfil na Vitrine para oferecer serviços e receber oportunidades.'},
  {value:'membro',role:'membro',label:'Membro BUILT',description:'Membro BUILT inclui os acessos de Profissional e pode acessar Alianças e Aura. Participações, benefícios e ações dependem dos vínculos e requisitos de cada área.'},
  {value:'aliado',role:'aliado',label:'Aliado licenciado',description:'Aliado licenciado inclui os acessos de Membro e pode desenvolver alianças. A gestão de comunidades e os cargos nas BIAs dependem das atribuições recebidas.'},
  {value:'manager',role:'manager',label:'Gestor da plataforma',description:'Gestor inclui os acessos de Aliado e tem acesso operacional amplo às BIAs, seus módulos e atividades de gestão.'},
  {value:'admin',role:'admin',label:'Superadmin · Administração',description:'Superadmin inclui os acessos de Gestor e pode administrar contas, conceder acessos, configurar a plataforma e gerenciar a integração Asaas.'},
] as const;
export type AccountAccessPreset = typeof ACCOUNT_ACCESS_PRESETS[number]['value'];

export function normalizeAccountRole(role: string | null | undefined): string {
  const value=String(role||'user').toLowerCase();
  return value==='superadmin'||value==='master'?'admin':value;
}

export function accountAccessPreset(value: string) {
  return ACCOUNT_ACCESS_PRESETS.find(preset=>preset.value===value);
}
