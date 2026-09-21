import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { commitmentsFromMap, validateCommitments, validateInitialClassifications } from "../shared/initial-contributions";
import { mapContentHash } from "./bia-map-history";
import { isProtectedValorOrigemEntry } from "./valor-origem-sync";

export const INITIAL_CONTRIBUTIONS_SQL = `
ALTER TABLE bia_map_inicial_snapshots ADD COLUMN IF NOT EXISTS modelo_calculo integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS bia_aportes_iniciais (
 bia_id text PRIMARY KEY, revisao integer NOT NULL DEFAULT 0, revisao_map integer NOT NULL,
 modalidade text NOT NULL, compromissos jsonb NOT NULL, estado text NOT NULL DEFAULT 'rascunho',
 autor jsonb NOT NULL, atualizado_em timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bia_aportes_parcelas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text NOT NULL REFERENCES bia_aportes_iniciais(bia_id),
 revisao integer NOT NULL, chave text NOT NULL, numero integer NOT NULL, natureza text NOT NULL,
 componente text NOT NULL, valor numeric(18,2) NOT NULL, vencimento date NOT NULL,
 movimentos jsonb NOT NULL, vigente boolean NOT NULL DEFAULT true, pendente boolean NOT NULL DEFAULT true,
 historico jsonb NOT NULL DEFAULT '[]'::jsonb,
 UNIQUE(bia_id,revisao,chave,numero)
);
CREATE INDEX IF NOT EXISTS bia_aportes_parcelas_bia ON bia_aportes_parcelas(bia_id);
`;

export async function decorateInitialEntries(executor: any, entries: any[]) {
  if (!entries.length) return entries;
  const ids = entries.map(e => String(e.id || ""));
  const rows = (await executor.execute(sql`SELECT p.id, p.natureza, p.componente, p.pendente, p.vigente, m->>'id' AS fluxo_id
    FROM bia_aportes_parcelas p CROSS JOIN LATERAL jsonb_array_elements(p.movimentos) m
    WHERE m->>'id' IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})`)).rows;
  const byId = new Map(rows.map((r: any) => [r.fluxo_id, r]));
  return entries.map(e => {
    const row: any = byId.get(String(e.id));
    return row ? { ...e, natureza: row.natureza, finalidade: "integralizacao_inicial", parcela_inicial_id: row.id,
      conciliacao_pendente: row.pendente, parcela_vigente: row.vigente } : e;
  });
}

export async function assertInitialCommitmentsCompatible(tx:any,biaId:string,base:any,entries:any[]) {
  if(Number(base.modelo_calculo)!==3)return;
  const expected=commitmentsFromMap(Number(base.valor_origem),base.participantes);
  const rows=(await tx.execute(sql`SELECT * FROM bia_aportes_parcelas WHERE bia_id=${biaId} AND vigente=true`)).rows;
  const reserved=new Map<string,number>();
  for(const p of rows){
    if(p.pendente)throw Object.assign(new Error("Conclua a conciliação das parcelas antes de corrigir o MAP."),{statusCode:409});
    const actual=p.movimentos.map((m:any)=>entries.find(e=>String(e.id)===m.id));
    if(actual.some((e:any)=>!e))throw new Error("Parcela confirmada indisponível; não é possível corrigir a base.");
    if(!actual.some(isProtectedValorOrigemEntry))continue;
    const c=expected.find(c=>c.chave===p.chave);
    if(!c || c.natureza!==p.natureza || (c.componente!=="ativo" && c.beneficiario!==p.movimentos[0]?.favorecido_id) || String(c.tipoCpp?.id || "")!==String(p.movimentos[p.movimentos.length-1]?.tipo_de_cpp?.[0] || ""))throw Object.assign(new Error("Correção incompatível com a classificação de uma parcela protegida."),{statusCode:409});
    reserved.set(c.chave,(reserved.get(c.chave)||0)+Number(p.valor));
    if(Math.round(reserved.get(c.chave)!*100)>Math.round(c.valor*100))throw Object.assign(new Error("O novo compromisso não cobre as parcelas protegidas."),{statusCode:409});
  }
}

// These dependencies are existing BIA authorization, locking and Directus adapters, not a second persistence layer.
export function registerInitialContributions(app: any, deps: {
  db: any; lock: (id: string, fn: (tx: any, base: any) => Promise<any>) => Promise<any>;
  access: (req: any, res: any, id: string, level: "view" | "edit") => Promise<any>;
  fetchOne: (collection: string, id: string, fields?: string) => Promise<any>;
  fetchEntries: (biaId: string) => Promise<any[]>;
  create: (collection: string, data: any) => Promise<any>;
  update: (collection: string, id: string, data: any) => Promise<any>;
  category: (name: string, type: string) => Promise<string>;
}) {
  const error = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });
  const actor = (req: any) => ({ userId: req.session?.directusUserId, membroId: req.session?.membroId });
  const requireBase = (base: any) => { if (!base || Number(base.modelo_calculo) !== 3) throw error("Esta BIA preserva o modelo anterior de aportes.", 404); };
  const plan = async (tx: any, id: string) => (await tx.execute(sql`SELECT * FROM bia_aportes_iniciais WHERE bia_id=${id}`)).rows[0];
  const parcels = async (tx: any, id: string) => (await tx.execute(sql`SELECT * FROM bia_aportes_parcelas WHERE bia_id=${id} ORDER BY revisao, chave, numero`)).rows;
  const checkRevision = (p: any, body: any) => { if (!Number.isInteger(body.revisaoEsperada) || Number(p?.revisao || 0) !== body.revisaoEsperada) throw error("O cronograma mudou. Recarregue a página."); };
  const applyPending = async (id: string) => deps.lock(id, async (tx) => {
    for (const p of await parcels(tx, id)) {
      if (!p.pendente) continue;
      for (const m of p.movimentos) {
        const existing = await deps.fetchOne("fluxo_caixa", m.id, "fields=*");
        if (!existing && !p.vigente) continue;
        // Stored intents retain target IDs. Directus requires junction objects, not junction IDs.
        // Adapt on replay as well, so already-pending parcels keep their original movement IDs.
        if (!existing) await deps.create("fluxo_caixa", {
          ...m,
          Categoria: (m.Categoria || []).map((id: string) => ({ categorias_id: id })),
          tipo_de_cpp: (m.tipo_de_cpp || []).map((id: string) => ({ tipos_cpp_id: id })),
        });
        else {
          const lastAction=p.historico?.[p.historico.length-1];
          // A retry of creation must not undo a provider payment received meanwhile.
          if(p.vigente && lastAction?.acao==="gerado") continue;
          if(!p.vigente && existing.status!=="cancelado" && isProtectedValorOrigemEntry(existing)) throw error("A parcela recebeu pagamento ou evidência durante a conciliação. Regularize antes de cancelar.");
          const patch = p.vigente ? {status:m.status,data_pagamento:m.data_pagamento} : { status: "cancelado" };
          if (mapContentHash(Object.fromEntries(Object.keys(patch).map(k => [k, existing[k]]))) !== mapContentHash(patch)) {
            await deps.update("fluxo_caixa", m.id, patch);
          }
        }
      }
      await tx.execute(sql`UPDATE bia_aportes_parcelas SET pendente=false WHERE id=${p.id}`);
    }
    await tx.execute(sql`UPDATE bia_aportes_iniciais SET estado='confirmado' WHERE bia_id=${id} AND estado='pendente'`);
  });
  const route = (level: "view" | "edit", work: (req: any, res: any, id: string) => Promise<any>) => async (req: any, res: any) => {
    try {
      const id = String(req.params.id);
      req.initialContributionAccess = await deps.access(req, res, id, level);
      if (!req.initialContributionAccess) return;
      return await work(req, res, String(req.initialContributionAccess.bia?.id || id));
    } catch (e: any) { res.status(e.statusCode || 400).json({ error: e.message }); }
  };

  app.get("/api/bias/:id/aportes-iniciais", route("view", async (req, res, id) => {
    const result = await deps.lock(id, async (tx, base) => {
      requireBase(base);
      const saved = await plan(tx, id);
      const items = await parcels(tx, id);
      const expected = commitmentsFromMap(Number(base.valor_origem), base.participantes);
      const financial = new Map((await deps.fetchEntries(id)).map(e=>[String(e.id),e]));
      const detail: any[] = [];
      for (const p of items) {
        const entries = p.movimentos.map((m: any) => financial.get(String(m.id)));
        if (!p.pendente && p.vigente && entries.some((e:any) => !e)) throw error("Uma parcela confirmada está indisponível no financeiro.", 503);
        const settled = p.vigente && !p.pendente && entries.every((e:any) => e?.status === "pago");
        detail.push({ ...p, valor: Number(p.valor), liquidado: settled, status: p.pendente ? "pendente de conciliação" : entries[0]?.status || "agendado" });
      }
      const summary = expected.filter(e => e.componente !== "ativo").map(e => {
        const integralizado = detail.filter(p => p.chave === e.chave && p.liquidado).reduce((sum,p) => sum+p.valor,0);
        return { ...e, integralizado, saldo: Math.max(0, e.valor-integralizado) };
      });
      return { revisao: Number(saved?.revisao || 0), revisaoMap: Number(base.revisao), revisaoMapSalva: Number(saved?.revisao_map || 0),
        modalidade: saved?.modalidade || "capital_proprio", estado: saved?.estado || "rascunho", compromissos: saved?.compromissos || expected,
        esperados: expected, parcelas: detail, resumo: summary, nominal: true, moeda: base.moeda || "BRL" };
    });
    res.json({...result,canEdit: req.initialContributionAccess.access?.permissions?.capital_financeiro === "edit"});
  }));

  app.put("/api/bias/:id/aportes-iniciais", route("edit", async (req, res, id) => {
    const result = await deps.lock(id, async (tx, base) => {
      requireBase(base);
      const old = await plan(tx,id); checkRevision(old,req.body);
      if (old?.estado === "pendente") throw error("Conclua a conciliação pendente antes de alterar o cronograma.");
      if (req.body.revisaoMap !== Number(base.revisao)) throw error("O MAP Zero mudou. Atualize os compromissos.");
      if (!base.revisao || !Number(base.base_economica_inicial)) throw error("Conclua e salve o MAP Zero primeiro.");
      validateInitialClassifications(base.participantes);
      const normalized = validateCommitments(commitmentsFromMap(Number(base.valor_origem),base.participantes),req.body.compromissos);
      for (const c of normalized) if (!await deps.fetchOne("cadastro_geral",c.beneficiario,"fields=id")) throw error("Beneficiário não encontrado.",400);
      const modalidade = String(req.body.modalidade);
      if (!["capital_proprio","consorcio","financiamento"].includes(modalidade)) throw error("Modalidade inválida.",400);
      const data = normalized.map(({parcelas: _p,...c}) => c);
      if (old && old.revisao_map === base.revisao && old.modalidade === modalidade && mapContentHash(old.compromissos) === mapContentHash(data)) return old;
      // Do not rewrite a paid/protected installment to fit a corrected commitment.
      for (const p of (await parcels(tx,id)).filter((p:any)=>p.vigente)) {
        const c = normalized.find(c=>c.chave===p.chave); const next = c?.parcelas.find(n=>n.numero===p.numero);
        const same = next && next.valor === Number(p.valor) && next.vencimento === String(p.vencimento).slice(0,10) && c?.beneficiario === p.movimentos[0]?.favorecido_id;
        if (!same) for (const m of p.movimentos) {
          const entry = await deps.fetchOne("fluxo_caixa",m.id,"fields=*");
          if (!entry || isProtectedValorOrigemEntry(entry)) throw error("Correção incompatível com parcela protegida. Regularize explicitamente antes de salvar.");
        }
      }
      const row = (await tx.execute(sql`INSERT INTO bia_aportes_iniciais(bia_id,revisao,revisao_map,modalidade,compromissos,autor)
        VALUES(${id},1,${Number(base.revisao)},${modalidade},${JSON.stringify(data)}::jsonb,${JSON.stringify(actor(req))}::jsonb)
        ON CONFLICT(bia_id) DO UPDATE SET revisao=bia_aportes_iniciais.revisao+1,revisao_map=excluded.revisao_map,
        modalidade=excluded.modalidade,compromissos=excluded.compromissos,autor=excluded.autor,estado='rascunho',atualizado_em=now() RETURNING *`)).rows[0];
      return row;
    }); res.json(result);
  }));

  app.post("/api/bias/:id/aportes-iniciais/confirmar", route("edit", async (req,res,id) => {
    await deps.lock(id,async(tx,base)=>{
      requireBase(base); const saved=await plan(tx,id); checkRevision(saved,req.body);
      if (!saved || saved.revisao_map!==base.revisao) throw error("Salve o cronograma da revisão vigente primeiro.");
      if (saved.estado!=="rascunho") return;
      validateInitialClassifications(base.participantes);
      const expected=validateCommitments(commitmentsFromMap(Number(base.valor_origem),base.participantes),saved.compromissos);
      const old=(await parcels(tx,id)).filter((p:any)=>p.vigente);
      const retained=new Set<string>();
      for(const c of expected) for(const p of c.parcelas){
        const prior=old.find((r:any)=>r.chave===c.chave && r.numero===p.numero && Number(r.valor)===p.valor && String(r.vencimento).slice(0,10)===p.vencimento && r.natureza===c.natureza && r.movimentos[0]?.favorecido_id===c.beneficiario && String(r.movimentos[r.movimentos.length-1]?.tipo_de_cpp?.[0] || "")===String(c.tipoCpp?.id || ""));
        if(prior){retained.add(String(prior.id));continue;}
        const movements=[];
        const sides=c.componente==="contribuicao" ? ["saida","entrada"] : [c.componente==="ativo"?"saida":"entrada"];
        for(const tipo of sides){
          const name=c.componente==="ativo"?"1.1 Valor de Origem":c.componente==="contribuicao"?(tipo==="saida"?`Direito econômico — ${c.tipoCpp!.nome}`:"6.3 Aportes em direitos e cessões"):c.natureza==="nao_caixa"?"6.1 Integralização de ativo":"2.1 Aporte inicial";
          const category=await deps.category(name,tipo==="entrada"?"Entrada":"Saída");
          movements.push({id:randomUUID(),bia:id,tipo,valor:p.valor,data_vencimento:p.vencimento,status:"agendado",
            descricao:`${c.componente==="ativo"?"Valor de Origem":c.componente==="capital"?"Aporte inicial":"Direito econômico / cessão"} - Parcela ${p.numero}/${c.parcelas.length}`,
            favorecido_id:c.beneficiario,Categoria:[category],tipo_de_cpp:c.tipoCpp?[c.tipoCpp.id]:[]});
        }
        await tx.execute(sql`INSERT INTO bia_aportes_parcelas(bia_id,revisao,chave,numero,natureza,componente,valor,vencimento,movimentos,historico)
          VALUES(${id},${saved.revisao},${c.chave},${p.numero},${c.natureza},${c.componente},${p.valor},${p.vencimento},${JSON.stringify(movements)}::jsonb,${JSON.stringify([{acao:"gerado",autor:actor(req),data:new Date().toISOString()}])}::jsonb)`);
      }
      for(const p of old) if(!retained.has(String(p.id))){
        for(const m of p.movimentos){const e=await deps.fetchOne("fluxo_caixa",m.id,"fields=*");if(!e || isProtectedValorOrigemEntry(e))throw error("Parcela protegida mudou; confira novamente o cronograma.");}
        await tx.execute(sql`UPDATE bia_aportes_parcelas SET vigente=false,pendente=true,
          historico=historico || ${JSON.stringify([{acao:"substituido",autor:actor(req),revisao:saved.revisao,data:new Date().toISOString()}])}::jsonb WHERE id=${p.id}`);
      }
      await tx.execute(sql`UPDATE bia_aportes_iniciais SET estado='pendente' WHERE bia_id=${id}`);
    });
    // Intent committed before writing Directus; stable IDs make retry safe after a lost response.
    try { await applyPending(id); res.json({estado:"confirmado"}); }
    catch { res.status(503).json({error:"Cronograma salvo, mas a conciliação está pendente. Tente confirmar novamente; não haverá duplicação.",estado:"pendente"}); }
  }));

  app.patch("/api/bias/:id/aportes-iniciais/parcelas/:parcelaId",route("edit",async(req,res,id)=>{
    await deps.lock(id,async(tx,base)=>{
      requireBase(base);const saved=await plan(tx,id);checkRevision(saved,req.body);
      const p=(await parcels(tx,id)).find((p:any)=>String(p.id)===String(req.params.parcelaId) && p.vigente);
      if(!p || p.pendente || saved?.estado!=="confirmado")throw error("Parcela indisponível ou com conciliação pendente.");
      const motivo=String(req.body.motivo||"").trim();
      if(!motivo || !["pago","agendado"].includes(req.body.status))throw error("Informe motivo e status válido.",400);
      if(req.body.status==="pago") {
        const date=String(req.body.dataPagamento || "");const parsed=new Date(`${date}T12:00:00Z`);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date)throw error("Informe a data válida da integralização.",400);
      }
      const entries=await Promise.all(p.movimentos.map((m:any)=>deps.fetchOne("fluxo_caixa",m.id,"fields=*")));
      if(entries.some(e=>!e || e.pagamento_id || e.pagamento_provider || e.pagamento_url || e.pagamento_gerado_em))throw error("Parcela possui cobrança externa ou está indisponível; regularize pelo provedor.");
      const movements=p.movimentos.map((m:any)=>({...m,status:req.body.status,data_pagamento:req.body.status==="pago"?req.body.dataPagamento:null}));
      const evidence=(items:any[])=>items.map(({id,status,valor,data_pagamento})=>({id,status,valor,data_pagamento}));
      await tx.execute(sql`UPDATE bia_aportes_parcelas SET movimentos=${JSON.stringify(movements)}::jsonb,pendente=true,
        historico=historico || ${JSON.stringify([{motivo,autor:actor(req),antes:evidence(entries),depois:evidence(movements),data:new Date().toISOString()}])}::jsonb WHERE id=${p.id}`);
      await tx.execute(sql`UPDATE bia_aportes_iniciais SET revisao=revisao+1,estado='pendente' WHERE bia_id=${id}`);
    });
    try{await applyPending(id);res.json({estado:"confirmado"});}catch{res.status(503).json({error:"Integralização registrada para conciliação. Confirme novamente o cronograma.",estado:"pendente"});}
  }));
  return { recover: async () => {
    const ids=(await deps.db.execute(sql`SELECT bia_id FROM bia_aportes_iniciais WHERE estado='pendente'`)).rows;
    for(const row of ids) await applyPending(String(row.bia_id));
  }};
}
