import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { CURRENCIES, BIA_DESTINACOES, BIA_OBJETIVOS, BIA_INFO_COMERCIAL_FIELDS } from "../shared/bia-form-options";
import { BIA_PHASES, nextBiaPhase, type BiaPhase } from "../shared/bia-phase";

export const BIA_WORKFLOW_SQL = `
CREATE TABLE IF NOT EXISTS bia_estruturacao_rascunhos (
 bia_id text PRIMARY KEY, autor_id text NOT NULL, revisao integer NOT NULL DEFAULT 1,
 dados jsonb NOT NULL, concluido boolean NOT NULL DEFAULT false,
 atualizado_em timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bia_fase_eventos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text NOT NULL,
 evento_id text NOT NULL, fase_anterior text NOT NULL, fase text NOT NULL,
 motivo text NOT NULL, autor jsonb NOT NULL, aplicado boolean NOT NULL DEFAULT false,
 criado_em timestamp NOT NULL DEFAULT now(), UNIQUE(bia_id,evento_id)
);
ALTER TABLE bia_estruturacao_rascunhos ADD COLUMN IF NOT EXISTS conclusao_iniciada boolean NOT NULL DEFAULT false;
`;
const failure = (message:string,statusCode=409) => Object.assign(new Error(message),{statusCode});
export function validateBiaDraft(body:any) {
  if(!body || typeof body!=="object" || Array.isArray(body))throw failure("Rascunho inválido.",400);
  const allowed = ["nome_bia","objetivo_alianca","destinacao","moeda","localizacao","latitude","longitude","observacoes","map_inicial","imagem_directus_id","anexos","selo_certified_alliance","info_comercial","valor_geral_venda_vgv","valor_realizado_venda","comissao_prevista_corretor","ir_previsto","inss_previsto","manutencao_pos_obra_prevista"];
  const data = Object.fromEntries(allowed.filter(k=>body[k] !== undefined).map(k=>[k,body[k]]));
  for(const field of ["nome_bia","objetivo_alianca","destinacao","moeda","localizacao","observacoes"])if(data[field]!=null && typeof data[field]!=="string")throw failure("Dados gerais inválidos.",400);
  if(data.map_inicial == null)delete data.map_inicial;
  if (!String(data.nome_bia || "").trim() || String(data.nome_bia).length > 200) throw failure("Informe o nome da BIA (até 200 caracteres).",400);
  if (!CURRENCIES.some(c=>c.code===data.moeda)) throw failure("Escolha uma moeda válida.",400);
  if (data.destinacao && !BIA_DESTINACOES.includes(data.destinacao)) throw failure("Escolha uma destinação válida.",400);
  if (data.objetivo_alianca && !BIA_OBJETIVOS.includes(data.objetivo_alianca)) throw failure("Escolha um objetivo válido.",400);
  for (const [field,limit] of [["latitude",90],["longitude",180]] as const) {
    if (data[field] != null && (!Number.isFinite(data[field]) || Math.abs(data[field])>limit)) throw failure("Localização inválida.",400);
  }
  if (JSON.stringify(data).length > 150000) throw failure("Rascunho excede o tamanho permitido.",400);
  if(data.map_inicial != null && (typeof data.map_inicial!=="object" || !Array.isArray(data.map_inicial.participantes) || data.map_inicial.participantes.length>200 || data.map_inicial.participantes.some((p:any)=>!p || typeof p!=="object" || !Array.isArray(p.cargos) || (p.contribuicoes != null && !Array.isArray(p.contribuicoes)))))throw failure("Composição do rascunho inválida.",400);
  for(const p of data.map_inicial?.participantes || []) {
    if (p.cotasInvestimento != null && (!Number.isFinite(p.cotasInvestimento) || p.cotasInvestimento < 0)) throw failure("CIs inválidas.",400);
    if(p.cargos.some((cargo:any)=>typeof cargo!=="string") || (p.contribuicoes || []).some((c:any)=>!c || typeof c.cargo!=="string" || (c.indice!=null && (!Number.isFinite(c.indice) || c.indice<0))))throw failure("Contribuição do rascunho inválida.",400);
    for(const field of ["nome","memberId","participantId"])if(p[field]!=null && typeof p[field]!=="string")throw failure("Participante do rascunho inválido.",400);
    for(const component of [p.tipoCppCapital,...(p.contribuicoes || []).map((c:any)=>c.tipoCpp)])if(component!=null && (typeof component!=="object" || typeof component.id!=="string" || typeof component.nome!=="string"))throw failure("Classificação do rascunho inválida.",400);
  }
  const economic = data.map_inicial?.estrutura;
  if (data.map_inicial?.modeloCalculo != null && ![4,5].includes(data.map_inicial.modeloCalculo)) throw failure("Versão de composição inválida.",400);
  if (economic != null) {
    if (typeof economic !== "object" || Array.isArray(economic) || !["recursos_proprios","consorcio","financiamento","mista","outra"].includes(economic.modalidade) || !Array.isArray(economic.instrumentos) || economic.instrumentos.length > 100 || !economic.integralizacao || typeof economic.integralizacao !== "object") throw failure("Estrutura econômica inválida.",400);
    for (const n of [economic.totalCotas,economic.integralizacao.quantidade,economic.integralizacao.meses]) if (n != null && (!Number.isFinite(n) || n < 0)) throw failure("Número da estrutura econômica inválido.",400);
    for (const i of economic.instrumentos) if (!i || typeof i.nome !== "string" || [i.valor,i.cotas].some(n=>n!=null && (!Number.isFinite(n) || n<0))) throw failure("Instrumento inválido.",400);
    for (const v of [economic.descricao,economic.integralizacao.forma,economic.integralizacao.primeiroVencimento,economic.integralizacao.correcao,economic.integralizacao.observacoes]) if (v!=null && (typeof v!=="string" || v.length>4000)) throw failure("Dados da integralização inválidos.",400);
  }
  if(data.info_comercial != null) {
    if(typeof data.info_comercial!=="object" || Array.isArray(data.info_comercial))throw failure("Informação complementar inválida.",400);
    data.info_comercial=Object.fromEntries(BIA_INFO_COMERCIAL_FIELDS.map(k=>{
      const value=data.info_comercial[k] ?? "";
      if(typeof value!=="string" || value.length>4000)throw failure("Informação complementar inválida.",400);
      return [k,value];
    }));
  }
  for(const field of ["valor_geral_venda_vgv","valor_realizado_venda","comissao_prevista_corretor","ir_previsto","inss_previsto","manutencao_pos_obra_prevista"]) {
    if(data[field]!=null && (!Number.isFinite(data[field]) || data[field]<0))throw failure("Valor de análise inválido.",400);
  }
  if(data.anexos != null && (!Array.isArray(data.anexos) || data.anexos.length>30 || data.anexos.some((id:any)=>typeof id!=="string" || !/^[a-zA-Z0-9-]{1,100}$/.test(id))))throw failure("Anexos inválidos.",400);
  if(data.anexos == null)delete data.anexos;
  if(data.imagem_directus_id && (typeof data.imagem_directus_id!=="string" || !/^[a-zA-Z0-9-]{1,100}$/.test(data.imagem_directus_id)))throw failure("Imagem inválida.",400);
  if(data.selo_certified_alliance!=null && typeof data.selo_certified_alliance!=="boolean")throw failure("Selo inválido.",400);
  return data;
}

// Directus is official; a committed intent survives a failed remote write and retries use the same event.
export async function transitionBiaPhase(deps:{db:any;fetch:(id:string)=>Promise<any>;update:(id:string,data:any)=>Promise<any>},input:{biaId:string;eventId:string;event:Parameters<typeof nextBiaPhase>[1] | "revisao_legada";target?:BiaPhase;ready:boolean;reason:string;actor:any}) {
  if (!input.reason.trim()) throw failure("Informe o motivo da mudança de fase.",400);
  const intent = await deps.db.transaction(async(tx:any)=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`bia-phase:${input.biaId}`}))`);
    const existing=(await tx.execute(sql`SELECT * FROM bia_fase_eventos WHERE bia_id=${input.biaId} AND evento_id=${input.eventId}`)).rows[0];
    if(existing)return existing;
    const pending=(await tx.execute(sql`SELECT id FROM bia_fase_eventos WHERE bia_id=${input.biaId} AND aplicado=false LIMIT 1`)).rows[0];
    if(pending)throw failure("Há uma transição pendente de conciliação. Repita a operação original.");
    const bia=await deps.fetch(input.biaId);
    let phase:BiaPhase;
    if(input.event === "revisao_legada") {
      if(bia.situacao!=="ativa" || !input.target || !["em_execucao","em_operacao","em_distribuicao"].includes(input.target))throw failure("Revise a fase operacional da BIA legada.");
      phase=input.target;
    }else phase=nextBiaPhase(bia.situacao as BiaPhase,input.event,input.ready);
    return (await tx.execute(sql`INSERT INTO bia_fase_eventos (id,bia_id,evento_id,fase_anterior,fase,motivo,autor) VALUES (${randomUUID()},${input.biaId},${input.eventId},${bia.situacao},${phase},${input.reason},${JSON.stringify(input.actor)}::jsonb) RETURNING *`)).rows[0];
  });
  if (!intent.aplicado) {
    await deps.db.transaction(async(tx:any)=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`bia-phase:${input.biaId}`}))`);
      const current=await deps.fetch(input.biaId);
      if(current.situacao!==intent.fase && current.situacao!==intent.fase_anterior)throw failure("A fase mudou durante a conciliação. Revise o histórico.");
      if(current.situacao!==intent.fase)await deps.update(input.biaId,{situacao:intent.fase});
      await tx.execute(sql`UPDATE bia_fase_eventos SET aplicado=true WHERE id=${intent.id}`);
    });
  }
  return intent.fase;
}
