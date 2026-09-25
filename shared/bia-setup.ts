import { z } from "zod";
import { BIA_INFO_COMERCIAL_FIELDS } from "./bia-form-options";
import { BIA_PARTICIPANT_ROLE_LABELS } from "./bia-access";

export const BIA_CREATION_STEPS = ["Dados da BIA", "Base econômica inicial", "MAP Inicial", "Estrutura Jurídica", "Ativos Vinculados", "Revisão", "Ativação"];
export const LEGAL_TYPES = ["SPE Ltda", "SPE S.A.", "Sociedade Limitada Patrimonial", "Holding Patrimonial", "Outra"] as const;
export const LEGAL_STATES = ["A constituir", "Em constituição", "Constituída"] as const;
export const ASSET_STATES = ["A definir", "Em análise", "Em negociação", "Em aquisição", "Adquirido", "Em operação", "Alienado"] as const;
export const BANK_FIELDS = ["banco", "agencia", "conta", "tipo_conta", "titular_conta", "chave_pix"] as const;
export const ASSET_METRICS = [["valor_geral_venda_vgv","VGV",2],["valor_realizado_venda","Valor realizado de venda",2],["comissao_prevista_corretor","Comissão prevista (%)",5],["ir_previsto","IR previsto (%)",5],["inss_previsto","INSS previsto (%)",5],["manutencao_pos_obra_prevista","Manutenção pós-obra (%)",5]] as const;
const text = z.string().max(4000).default("");
const date = z.string().refine(v=>!v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v),"Data inválida").default("");
const money = z.number().finite().nonnegative().nullable().default(null);
const document = text.refine(v=>!v.trim() || [11,14].includes(v.replace(/\D/g,"").length),"Informe CPF com 11 dígitos ou CNPJ com 14 dígitos");
const fields = Object.fromEntries(BIA_INFO_COMERCIAL_FIELDS.map(k=>[k,text]));
const infoSchema = z.object(fields).strip();
const legalInfoSchema=infoSchema.transform(info=>Object.fromEntries(Object.entries(info).map(([k,v])=>[k,k.startsWith("ativo_")?"":v])));
const assetInfoSchema=infoSchema.transform(info=>Object.fromEntries(Object.entries(info).map(([k,v])=>[k,k.startsWith("ativo_")?v:""])));
const metricsSchema = z.object(Object.fromEntries(ASSET_METRICS.map(([k])=>[k,money]))).strip();
const party = z.object({id:z.string().min(1).max(100),memberId:text,nome:text,documento:document,cotas:money});
export const biaSetupSchema = z.object({
  versao:z.literal(1),
  juridico:z.object({modalidade:z.enum(["","societaria","contratual"]),tipo:z.enum(["",...LEGAL_TYPES]),situacao:z.enum(["",...LEGAL_STATES]),instrumento:text,situacaoInstrumento:text,responsavel:text,oabResponsavel:z.string().trim().max(100).default(""),documentoResponsavel:document,objeto:text,capitalSocial:money,administrador:text,info:legalInfoSchema,socios:z.array(party).max(200)}),
  ativosIndefinidos:z.boolean(),
  ativos:z.array(z.object({id:z.string().min(1).max(100),carteiraImovelId:z.string().min(1).max(100).optional(),nome:text,situacao:z.enum(["",...ASSET_STATES]),titular:text,dataVinculo:date,valorReferencia:money,info:assetInfoSchema,indicadores:metricsSchema})).max(100),
  indicadoresLegados:metricsSchema,
  governanca:z.array(z.object({cargo:z.string().max(200),memberId:z.string().min(1).max(100),inicio:date,responsabilidades:text})).max(200),
}).superRefine((v,ctx)=>{
  if(JSON.stringify(v).length>150000)ctx.addIssue({code:"custom",message:"Estrutura excede o tamanho permitido"});
  for(const rows of [v.ativos,v.juridico.socios])if(new Set(rows.map(r=>r.id)).size!==rows.length)ctx.addIssue({code:"custom",message:"Identificadores repetidos"});
  const portfolioIds=v.ativos.map(a=>a.carteiraImovelId).filter(Boolean);
  if(new Set(portfolioIds).size!==portfolioIds.length)ctx.addIssue({code:"custom",message:"Este ativo da Carteira já foi adicionado à BIA"});
  if(v.ativosIndefinidos && v.ativos.length)ctx.addIssue({code:"custom",message:"Remova os ativos cadastrados antes de marcar ativo indefinido"});
  const roles=Object.values(BIA_PARTICIPANT_ROLE_LABELS);
  if(v.governanca.some(g=>!roles.includes(g.cargo as any)) || new Set(v.governanca.map(g=>g.cargo)).size!==v.governanca.length)ctx.addIssue({code:"custom",message:"Funções inválidas ou repetidas"});
});
export type BiaSetup = z.infer<typeof biaSetupSchema>;
// Only descriptive fields: no ownership, valuation, debt, documents or financial effects.
export function biaAssetFromPortfolio(property:Record<string,unknown>):BiaSetup['ativos'][number] {
  const info:Record<string,string>={};
  for(const [target,source] of Object.entries({qualificacao:'tipo',descricao_adicional:'descricao',area_m2:'area_m2',endereco:'endereco',numero:'numero',complemento:'complemento',cep:'cep',bairro:'bairro',cidade:'cidade',estado:'estado',pais:'pais',numero_matricula:'matricula',cartorio:'cartorio'})) {
    const value=property[source];
    info[`ativo_${target}`]=typeof value==='string' || typeof value==='number'?String(value).slice(0,4000):'';
  }
  return {id:String(property.id),carteiraImovelId:String(property.id),nome:String(property.nome || 'Ativo da Carteira').slice(0,4000),situacao:'',titular:'',dataVinculo:'',valorReferencia:null,info:assetInfoSchema.parse(info),indicadores:metricsSchema.parse({})};
}
export function emptyBiaSetup():BiaSetup {
  return biaSetupSchema.parse({versao:1,juridico:{modalidade:"",tipo:"",situacao:"",info:{},socios:[]},ativosIndefinidos:true,ativos:[],indicadoresLegados:{},governanca:[]});
}
export function legacyBiaSetup(data:any):BiaSetup {
  if(data?.estrutura_bia)return biaSetupSchema.parse(data.estrutura_bia);
  const setup=emptyBiaSetup(),info=infoSchema.parse(data?.info_comercial || {});
  setup.juridico.info=Object.fromEntries(Object.entries(info).map(([k,v])=>[k,k.startsWith("ativo_")?"":v]));
  if(Object.entries(info).some(([k,v])=>k.startsWith("ativo_") && v.trim())){
    setup.ativosIndefinidos=false;
    setup.ativos=[{id:"ativo-legado",nome:"Ativo cadastrado anteriormente",situacao:"",titular:"",dataVinculo:"",valorReferencia:null,info:Object.fromEntries(Object.entries(info).map(([k,v])=>[k,k.startsWith("ativo_")?v:""])),indicadores:metricsSchema.parse({})}];
  }
  setup.indicadoresLegados=metricsSchema.parse(Object.fromEntries(ASSET_METRICS.map(([k])=>[k,data?.[k]!=null && data[k]!=="" && Number.isFinite(Number(data[k])) && Number(data[k])>=0?Number(data[k]):null])));
  return setup;
}
export function legalBlockers(setup:BiaSetup):string[] {
  return [!setup.juridico.modalidade && "Escolha a estrutura Societária ou Contratual.",!setup.juridico.responsavel.trim() && "Informe o responsável jurídico.",!setup.juridico.oabResponsavel?.trim() && "Informe a OAB do responsável jurídico."].filter(Boolean) as string[];
}

// Old clients may omit new identifiers; omission must not erase a stored value.
export function parseBiaSetup(value:any,previous?:BiaSetup):BiaSetup {
  const parsed=biaSetupSchema.parse(value);
  for(const key of ['oabResponsavel','documentoResponsavel'] as const)if(value.juridico[key]===undefined && previous?.juridico[key]!==undefined)parsed.juridico[key]=previous.juridico[key];
  return parsed;
}
export function biaSetupValidationMessage(error:any):string {
  const issue=error?.issues?.[0];
  if(!issue)return "Dados da estrutura inválidos.";
  const path=(issue.path || []).map((part:any)=>typeof part==='number'?'[]':String(part)).join('.');
  const labels:Record<string,string>={
    'juridico.oabResponsavel':'OAB do responsável jurídico',
    'juridico.documentoResponsavel':'CPF/CNPJ legado do responsável jurídico',
    'juridico.capitalSocial':'capital social',
    'juridico.socios.[].documento':'CPF/CNPJ do sócio formal',
    'juridico.socios.[].cotas':'quantidade de quotas societárias',
    'ativos.[].dataVinculo':'data de vínculo do ativo',
    'ativos.[].valorReferencia':'valor de referência do ativo',
  };
  const label=labels[path] || (path?`campo ${path}`:'estrutura');
  return `Corrija ${label}: ${String(issue.message || 'valor inválido').replace(/\.$/,'')}.`;
}
export function setupWarnings(setup:BiaSetup):string[] {
  const j=setup.juridico;
  return [j.modalidade==="societaria" && j.situacao!=="Constituída" && "Empresa ainda não constituída.",j.modalidade==="societaria" && !j.info.cnpj && "CNPJ não informado.",!j.info.conta && "Conta bancária não informada.",(!setup.ativos.length || setup.ativosIndefinidos) && "Ativo ainda não definido."].filter(Boolean) as string[];
}
export function assetTotals(setup:BiaSetup) {
  return Object.fromEntries(["valorReferencia","valor_geral_venda_vgv","valor_realizado_venda"].map(key=>{
    const values=setup.ativos.map(a=>key==="valorReferencia"?a.valorReferencia:a.indicadores[key]).filter((v):v is number=>v!==null && Number.isFinite(v));
    return [key,values.length?values.reduce((a,b)=>a+b,0):null];
  }));
}
export function governanceLabel(role:string) {
  return role==="Aliado BUILT"?"Aliado Licenciado BUILT":role;
}
export function governanceRoles(p:{cargos?:string[];contribuicoes?:Array<{cargo:string}>}) {
  return Array.from(new Set([...(p.cargos || []),...(p.contribuicoes || []).map(c=>c.cargo)])).filter(c=>c!=="Contribuição individual" && c!=="Autor da Oportunidade");
}
