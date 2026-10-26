import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ContributionReminders } from './contribution-reminders';
import { asaasConfig } from "./asaas/config";
import { requestHash, assertExclusiveBiaAccount } from "./asaas/store";
import { AsaasError } from "./asaas/client";
import { accountTransport, ContributionProvider, contributionBillingEnabled } from "./contribution-billing-provider";
import { billingSettingsSchema, defaultBillingSettings, revisionInputSchema, cents, revisedCents, canReviseParcel, billingTotals, saoPauloClock, dayDistance, openPaymentStates, cashContributionProblem } from "../shared/contribution-billing";

type Dependencies={
  db:any; lock:(id:string,work:(tx:any,base:any)=>Promise<any>)=>Promise<any>;
  entries:(id:string)=>Promise<any[]>; member:(id:string)=>Promise<any>;
  bia:(id:string)=>Promise<any>; updateFlow:(id:string,data:any)=>Promise<any>;
  userForMember:(member:any)=>Promise<string|null>;
  sendNotice:(input:{email:string;name:string;biaId:string;amount:number;dueDate:string;details:any;kind:string})=>Promise<{ok:boolean;skipped?:boolean}>;
  provider?:(account:any)=>ContributionProvider|Promise<ContributionProvider>; enabled?:()=>boolean;
};
const fault=(message:string,statusCode=409)=>Object.assign(new Error(message),{statusCode,billingFault:true});
const activePhase=(phase:string)=>["ativa","em_execucao","em_operacao","em_distribuicao"].includes(phase);
const iso=(date:any)=>date instanceof Date?date.toISOString().slice(0,10):String(date).slice(0,10);
const reference=(c:any)=>`built:contribution:${c.environment}:${c.id}`;
const safeError=(e:any)=>e instanceof AsaasError?e.code:e.billingFault===true?e.message:"BILLING_RECONCILIATION_PENDING";

export class ContributionBilling {
  readonly reminders=new ContributionReminders(this);
  readonly environment=asaasConfig().environment;
  constructor(readonly deps:Dependencies) {}
  get namespace(){return this.environment==="sandbox"?"asaas_sandbox":"asaas_production";}
  enabled(){return this.deps.enabled?this.deps.enabled():contributionBillingEnabled();}
  async ready(){try{return (await this.deps.db.execute(sql`SELECT to_regclass('bia_contribution_charges') IS NOT NULL AND to_regclass('bia_contribution_settings') IS NOT NULL AND to_regclass('bia_contribution_revisions') IS NOT NULL AND to_regclass('bia_contribution_notices') IS NOT NULL AND to_regclass('bia_contribution_customers') IS NOT NULL AS ready`)).rows[0]?.ready===true;}catch{return false;}}
  async requireReady(){if(!await this.ready())throw fault("Aplique a migração de cobranças de aportes antes de continuar",503);}
  async settings(biaId:string,executor=this.deps.db) {
    const row=(await executor.execute(sql`SELECT settings,revision FROM bia_contribution_settings WHERE bia_id=${biaId}`)).rows[0];
    return { ...defaultBillingSettings,...row?.settings,revision:Number(row?.revision||0) };
  }
  async saveSettings(biaId:string,input:any,actor:string) {
    const {revision,...raw}=input;const settings=billingSettingsSchema.parse(raw);
    return this.deps.lock(biaId,async(tx)=>{
      const previous=await this.settings(biaId,tx);
      if(previous.revision!==revision)throw fault("Configuração alterada; recarregue");
      await tx.execute(sql`INSERT INTO bia_contribution_settings(bia_id,settings,actor_id) VALUES(${biaId},${JSON.stringify(settings)}::jsonb,${actor}) ON CONFLICT(bia_id) DO UPDATE SET settings=excluded.settings,revision=bia_contribution_settings.revision+1,actor_id=excluded.actor_id,updated_at=now()`);
      return {...settings,revision:revision+1};
    });
  }
  // Called only after explicit confirmation/recovery, not from a status query.
  async enqueue(biaId:string,strict=false) {
    if(!await this.ready())return;
    if((await this.deps.bia(biaId))?.moeda!=="BRL") {if(strict)throw fault("Cobranças Asaas exigem moeda BRL confirmada na BIA",422);return;}
    await this.deps.lock(biaId,async(tx)=>{
      const rows=(await tx.execute(sql`SELECT * FROM bia_aportes_parcelas WHERE bia_id=${biaId} AND vigente=true AND pendente=false AND natureza='caixa' AND componente='capital'`)).rows;
      const entries=await this.deps.entries(biaId);
      for(const p of rows) {
        const movement=p.movimentos?.[0],entry=entries.find(e=>String(e.id)===String(movement?.id));
        if(!entry || !movement?.favorecido_id || entry.status==="cancelado" || Number(entry.valor)<=0)continue;
        const protectedEntry=entry.data_pagamento || entry.pagamento_id || entry.pagamento_provider || entry.pagamento_url || (entry.Anexos||[]).length || !["agendado","pendente","vencido"].includes(entry.status);
        const state=entry.status==="pago"?"received":protectedEntry?"processing":"none";
        const job=state==="received"?"ready":protectedEntry?"blocked":"queued";
        await tx.execute(sql`INSERT INTO bia_contribution_charges(id,environment,parcel_id,bia_id,payer_id,flow_id,original_cents,amount_cents,due_date)
          VALUES(${randomUUID()},${this.environment},${p.id},${biaId},${String(movement.favorecido_id)},${String(movement.id)},${cents(p.valor)},${cents(entry.valor)},${iso(p.vencimento)}) ON CONFLICT(environment,parcel_id) DO NOTHING`);
        await tx.execute(sql`UPDATE bia_contribution_charges SET payment_state=${state},job_state=${job},amount_cents=${cents(entry.valor)} WHERE environment=${this.environment} AND parcel_id=${p.id} AND external_id IS NULL AND account_id IS NULL AND pending_revision IS NULL`);
      }
    });
  }
  async rows(biaId:string,executor=this.deps.db) {
    const rows=(await executor.execute(sql`SELECT c.*,CASE WHEN c.parcel_id IS NULL THEN true ELSE p.vigente END AS vigente,COALESCE(p.pendente,false) AS pendente,COALESCE(p.natureza,'caixa') AS natureza,COALESCE(p.componente,'capital') AS componente,p.numero FROM bia_contribution_charges c LEFT JOIN bia_aportes_parcelas p ON p.id=c.parcel_id WHERE c.environment=${this.environment} AND c.bia_id=${biaId} ORDER BY c.due_date,p.numero,c.id`)).rows;
    const entries=await this.deps.entries(biaId);
    return rows.map((r:any)=>{
      const entry=entries.find(e=>String(e.id)===String(r.flow_id));
      if(r.vigente && !entry)throw fault("Uma parcela não pôde ser consultada no financeiro",503);
      const paid=entry?.status==="pago";
      const foreign=!!(entry?.pagamento_id && entry.pagamento_id!==r.external_id);
      const evidence=(entry?.Anexos||entry?.anexos||[]).length>0;
      const protectedStatus=entry && !["agendado","pendente","vencido"].includes(entry.status);
      return {...r,due_date:iso(r.due_date),amount_cents:Number(r.amount_cents),original_cents:Number(r.original_cents),
        payment_state:!r.external_id?(paid?"received":protectedStatus||foreign||evidence||entry?.data_pagamento?"processing":"none"):r.payment_state,
        protected:paid||!!entry?.data_pagamento||foreign||evidence||protectedStatus,entry};
    });
  }
  async dashboard(biaId:string,canManage:boolean,payerId:string|null) {
    await this.requireReady();const today=saoPauloClock().date;
    const [rows,settings]=await Promise.all([this.rows(biaId),this.settings(biaId)]);
    const members=new Map<string,any>();
    for(const r of rows)if(!members.has(r.payer_id))members.set(r.payer_id,await this.deps.member(r.payer_id));
    const history=(await this.deps.db.execute(sql`SELECT r.id,r.charge_id,r.batch_id,r.before_cents,r.after_cents,r.state,r.reason,r.created_at,r.actor_id,r.error_code FROM bia_contribution_revisions r WHERE r.environment=${this.environment} AND r.bia_id=${biaId} ORDER BY r.created_at DESC LIMIT 200`)).rows;
    return {environment:this.environment,enabled:this.enabled(),canManage,settings,totals:billingTotals(rows,today),history,
      rows:rows.filter((r:any)=>r.vigente).map((r:any)=>({id:r.id,parcelId:r.parcel_id,payerId:r.payer_id,name:members.get(r.payer_id)?.nome||"Participante",number:r.numero,
        amountCents:r.amount_cents,originalCents:r.original_cents,dueDate:r.due_date,version:r.version,paymentState:openPaymentStates.includes(r.payment_state)&&r.due_date<today?"overdue":r.payment_state,jobState:r.job_state,errorCode:r.error_code,
        flowId:r.flow_id,canRevise:!!r.parcel_id&&canManage&&canReviseParcel(r,today),canReadPayment:canManage||payerId===r.payer_id,
        pendingRevision:!!r.pending_revision})),
      pending:[...(!this.enabled()?["Cobranças Sandbox aguardam habilitação e homologação"]:[])]};
  }
  async details(biaId:string,chargeId:string,canManage:boolean,payerId:string|null) {
    const row=(await this.rows(biaId)).find((r:any)=>r.id===chargeId&&r.vigente);
    if(!row)throw fault("Cobrança não encontrada",404);
    if(!canManage && row.payer_id!==payerId)throw fault("Meio de pagamento restrito ao pagador e gestores",403);
    if(row.job_state!=="ready" || row.pending_revision || !openPaymentStates.includes(row.payment_state))throw fault("Meios de pagamento indisponíveis nesta situação");
    const details={...row.details};
    if(details.expiresAt&&Date.parse(details.expiresAt)<Date.now()){delete details.pix;delete details.qrImage;details.pixExpired=true;}
    return details;
  }
  async requireFlowStorage() {
    await this.requireReady();
    const row=(await this.deps.db.execute(sql`SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='bia_contribution_charges' AND column_name='parcel_id'`)).rows[0];
    if(row?.is_nullable!=='YES')throw fault('A emissão de aportes avulsos aguarda a migração 20261027_contribution_flow_charges.',503);
  }
  async enqueueFlow(biaId:string,flowId:string) {
    await this.requireFlowStorage();
    return this.deps.lock(biaId,async(tx)=>{
      const prior=(await tx.execute(sql`SELECT id FROM bia_contribution_charges WHERE environment=${this.environment} AND bia_id=${biaId} AND flow_id=${flowId}`)).rows[0];
      if(prior)return prior;
      const bia=await this.deps.bia(biaId);
      if(!activePhase(bia?.situacao)||bia?.moeda!=='BRL')throw fault('A cobrança exige BIA ativa em BRL.',422);
      const entry=(await this.deps.entries(biaId)).find(e=>String(e.id)===flowId);
      if(!entry)throw fault('Lançamento não encontrado nesta BIA.',404);
      const problem=cashContributionProblem(entry);if(problem)throw fault(problem,422);
      const payer=await this.deps.member(String(entry.favorecido_id));
      if(!payer?.id)throw fault('Pagador não encontrado.',422);
      const parcel=(await tx.execute(sql`SELECT * FROM bia_aportes_parcelas WHERE bia_id=${biaId} AND movimentos @> ${JSON.stringify([{id:flowId}])}::jsonb LIMIT 1`)).rows[0];
      if(parcel&&(!parcel.vigente||parcel.pendente||parcel.natureza!=='caixa'||parcel.componente!=='capital'))throw fault('Esta parcela não representa aporte em dinheiro disponível para cobrança.',422);
      const id=randomUUID();
      await tx.execute(sql`INSERT INTO bia_contribution_charges(id,environment,parcel_id,bia_id,payer_id,flow_id,original_cents,amount_cents,due_date) VALUES(${id},${this.environment},${parcel?.id || null},${biaId},${String(entry.favorecido_id)},${flowId},${cents(entry.valor)},${cents(entry.valor)},${iso(entry.data_vencimento)})`);
      return {id};
    });
  }
  async flowPayment(biaId:string,flowId:string,manage:boolean,payerId:string|null) {
    const entry=(await this.deps.entries(biaId)).find(e=>String(e.id)===flowId);
    if(!entry)throw fault('Lançamento não encontrado.',404);
    const charge=(await this.rows(biaId)).find((r:any)=>String(r.flow_id)===flowId&&r.vigente);
    const owner=charge?.payer_id || String(entry.favorecido_id || '');
    if(!manage && (!payerId || owner!==payerId))throw fault('Meio de pagamento restrito ao pagador e gestores.',403);
    const canPrepare=manage&&!charge&&!cashContributionProblem(entry);
    const payable=charge?.job_state==='ready'&&!charge.pending_revision&&['open','overdue'].includes(charge.payment_state)&&entry.status!=='pago';
    return {environment:this.environment,enabled:this.enabled(),canPrepare,chargeId:charge?.id || null,
      amountCents:charge?.amount_cents ?? cents(entry.valor),dueDate:charge?.due_date || iso(entry.data_vencimento),
      paymentState:charge?.payment_state || (entry.status==='pago'?'received':'none'),jobState:charge?.job_state || null,
      message:!this.enabled()?'Emissão aguardando habilitação da integração.':!charge?cashContributionProblem(entry):charge.job_state==='blocked'?'Cobrança bloqueada: confira a conta recebedora e o cadastro do pagador.':charge.job_state==='unknown'?'Emissão em conciliação. Não crie outra cobrança.':null,
      details:payable?await this.details(biaId,charge.id,manage,payerId):null};
  }
  async preview(biaId:string,raw:any,tx=this.deps.db) {
    const input=revisionInputSchema.parse(raw),today=saoPauloClock().date;
    const all=await this.rows(biaId,tx);
    const rows=input.parcelIds.map(id=>{
      const row=all.find((r:any)=>r.parcel_id===id);
      if(!row || !canReviseParcel(row,today) || row.due_date<input.fromDate)throw fault("Seleção inclui parcela paga, vencida, protegida ou em processamento");
      return {id:row.id,parcelId:row.parcel_id,version:row.version,before:row.amount_cents,after:revisedCents(row.amount_cents,input),dueDate:row.due_date};
    });
    return {input,rows,hash:requestHash({biaId,input,rows}),before:rows.reduce((n,r)=>n+r.before,0),after:rows.reduce((n,r)=>n+r.after,0)};
  }
  async revise(biaId:string,raw:any,actor:string) {
    const {batchId,previewHash,confirm,...body}=raw;
    if(!/^[0-9a-f-]{36}$/i.test(batchId||"") || confirm!==true)throw fault("Confirme a prévia e informe chave da revisão",400);
    return this.deps.lock(biaId,async(tx)=>{
      const previous=(await tx.execute(sql`SELECT * FROM bia_contribution_revisions WHERE batch_id=${batchId} ORDER BY charge_id`)).rows;
      const hash=requestHash({body,actor,biaId,previewHash});
      if(previous.length) {
        if(previous.some((r:any)=>r.bia_id!==biaId||r.request_hash!==hash||r.environment!==this.environment))throw fault("Chave usada por revisão diferente");
        return {batchId,queued:previous.length};
      }
      const preview=await this.preview(biaId,body,tx);
      if(preview.hash!==previewHash)throw fault("Valores mudaram; gere uma nova prévia");
      for(const r of preview.rows) {
        const id=randomUUID();
        await tx.execute(sql`INSERT INTO bia_contribution_revisions(id,batch_id,charge_id,bia_id,environment,actor_id,reason,before_cents,after_cents,expected_version,request_hash)
          VALUES(${id},${batchId},${r.id},${biaId},${this.environment},${actor},${preview.input.reason},${r.before},${r.after},${r.version},${hash})`);
        await tx.execute(sql`UPDATE bia_contribution_charges SET pending_revision=${id},job_state=CASE WHEN external_id IS NULL THEN 'queued' ELSE 'ready' END,updated_at=now() WHERE id=${r.id}`);
      }
      return {batchId,queued:preview.rows.length};
    });
  }
  async account(biaId:string,executor=this.deps.db) {
    const row=(await executor.execute(sql`SELECT a.*,(SELECT count(*)::int FROM ${sql.raw(this.namespace+'.bia_accounts')} links WHERE links.account_id=a.id) AS bia_link_count FROM ${sql.raw(this.namespace+".accounts")} a JOIN ${sql.raw(this.namespace+".bia_accounts")} b ON a.id=b.account_id WHERE b.bia_id=${biaId}`)).rows[0];
    assertExclusiveBiaAccount(row);
    return row;
  }
  private async provider(account:any){return this.deps.provider?await this.deps.provider(account):new ContributionProvider(await accountTransport(account,this.deps.db));}
  private async persistSnapshot(c:any,p:any,snapshot:any,tx:any) {
    if(snapshot.dueDate!==c.due_date)throw fault("Vencimento divergente no Asaas");
    const revision=c.pending_revision?(await tx.execute(sql`SELECT * FROM bia_contribution_revisions WHERE id=${c.pending_revision}`)).rows[0]:null;
    const expected=revision?Number(revision.after_cents):Number(c.amount_cents);
    if(snapshot.amount!==expected)throw fault("Valor divergente; conciliação necessária");
    if((c.payment_state==="received"&&["none","open","overdue","confirmed"].includes(snapshot.state)) || (c.payment_state==="confirmed"&&openPaymentStates.includes(snapshot.state)) || (["cancelled","refunded"].includes(c.payment_state)&&snapshot.state!==c.payment_state))throw fault("Estado remoto regressivo; conciliação explícita necessária");
    const paid=snapshot.state==="received";
    const patch:any={valor:expected/100,pagamento_provider:"asaas_contributions",pagamento_id:snapshot.externalId,pagamento_url:snapshot.details.invoiceUrl||null,pagamento_status:snapshot.state};
    if(paid){patch.status="pago";patch.data_pagamento=snapshot.paidAt||saoPauloClock().date;}
    // Existing received evidence is never automatically erased by an old/ambiguous event.
    if(!paid && ["refunded","cancelled","processing"].includes(snapshot.state) && c.entry?.status==="pago")throw Object.assign(fault("Estorno exige conciliação financeira explícita"),{providerState:snapshot.state});
    if(Object.entries(patch).some(([key,value])=>String(c.entry?.[key]??"")!==String(value??"")))await this.deps.updateFlow(c.flow_id,patch);
    await tx.execute(sql`UPDATE bia_contribution_charges SET external_id=${snapshot.externalId},payment_state=${snapshot.state},amount_cents=${expected},details=${JSON.stringify(snapshot.details)}::jsonb,paid_at=${snapshot.paidAt},job_state='ready',error_code=NULL,updated_at=now() WHERE id=${c.id}`);
    if(revision) {
      await this.applyRevision(c,revision,tx);
    }
    if(paid)await tx.execute(sql`UPDATE agenda_tarefas SET status='concluida',atualizado_em=now() WHERE contexto_tipo='bia_contribution' AND origem_tarefa_id=${c.id}`);
  }
  private async applyRevision(c:any,r:any,tx:any) {
    const amount=Number(r.after_cents);
    // Original p.valor and signed commitments stay untouched; mutable movement intent mirrors the current obligation.
    const parcel=(await tx.execute(sql`SELECT movimentos FROM bia_aportes_parcelas WHERE id=${c.parcel_id}`)).rows[0];
    const movements=parcel.movimentos.map((m:any)=>({...m,valor:amount/100}));
    await tx.execute(sql`UPDATE bia_aportes_parcelas SET movimentos=${JSON.stringify(movements)}::jsonb,historico=historico || ${JSON.stringify([{acao:"revisao_financeira",motivo:r.reason,autor:{userId:r.actor_id},data:new Date().toISOString(),antes:Number(r.before_cents)/100,depois:amount/100}])}::jsonb WHERE id=${c.parcel_id}`);
    await tx.execute(sql`UPDATE bia_contribution_charges SET amount_cents=${amount},version=version+1,pending_revision=NULL,updated_at=now() WHERE id=${c.id}`);
    await tx.execute(sql`UPDATE bia_contribution_revisions SET state='applied',error_code=NULL,applied_at=now() WHERE id=${r.id}`);
  }
  async processCharge(id:string) {
    const claimed=(await this.deps.db.execute(sql`UPDATE bia_contribution_charges SET job_state='creating',updated_at=now() WHERE id=${id} AND environment=${this.environment} AND job_state<>'creating' RETURNING *`)).rows[0];
    if(!claimed)return;
    try {
      const before=(await this.rows(claimed.bia_id)).find((r:any)=>r.id===id);
      if(before && !before.parcel_id && (cents(before.entry?.valor)!==before.amount_cents || String(before.entry?.favorecido_id)!==before.payer_id || iso(before.entry?.data_vencimento)!==before.due_date || before.entry?.tipo!=='entrada'))throw fault('Lançamento divergente; conciliação necessária.');
      const currentBia=await this.deps.bia(claimed.bia_id);
      if(!before?.vigente || before.pendente || !activePhase(currentBia?.situacao) || currentBia?.moeda!=="BRL")throw fault("Parcela ou BIA não disponível");
      const localRevision=!before.external_id&&!!before.pending_revision;
      let provider:ContributionProvider|undefined,remoteCustomer:any;
      if(!localRevision) {
        if(!this.enabled())throw new AsaasError("BILLING_DISABLED","Integração não homologada");
        if(!before.external_id&&before.protected)throw fault("Parcela protegida");
        const account=await this.account(before.bia_id);provider=await this.provider(account);
        if(before.account_id && (before.account_id!==account.id||before.external_account_id!==account.external_account_id))throw fault("Vínculo de conta alterado");
        await provider.verifyAccount(account);
        await this.deps.db.execute(sql`UPDATE bia_contribution_charges SET account_id=${account.id},external_account_id=${account.external_account_id} WHERE id=${id}`);
        const customerRef=`built:payer:${this.environment}:${before.payer_id}`;
        await this.deps.db.execute(sql`INSERT INTO bia_contribution_customers(environment,account_id,payer_id) VALUES(${this.environment},${account.id},${before.payer_id}) ON CONFLICT DO NOTHING`);
        const customer=(await this.deps.db.execute(sql`SELECT * FROM bia_contribution_customers WHERE environment=${this.environment} AND account_id=${account.id} AND payer_id=${before.payer_id}`)).rows[0];
        remoteCustomer=customer.external_id?{id:customer.external_id}:await provider.findCustomer(customerRef);
        if(!remoteCustomer) {
          const payer=await this.deps.member(before.payer_id);
          if(!payer?.nome || ![11,14].includes(String(payer.cpf||payer.cnpj||"").replace(/\D/g,"").length))throw new AsaasError("PAYER_PENDING","Cadastro do pagador incompleto");
          const attempt=(await this.deps.db.execute(sql`UPDATE bia_contribution_customers SET attempted=true WHERE environment=${this.environment} AND account_id=${account.id} AND payer_id=${before.payer_id} AND attempted=false RETURNING *`)).rows[0];
          if(!attempt)throw fault("Cadastro do pagador com resultado desconhecido");
          remoteCustomer=await provider.customer(payer,customerRef);
        }
        await this.deps.db.execute(sql`UPDATE bia_contribution_customers SET external_id=${remoteCustomer.id} WHERE environment=${this.environment} AND account_id=${account.id} AND payer_id=${before.payer_id}`);
        await provider.muteCustomer(remoteCustomer.id);
        if(!before.external_id)await this.deps.db.execute(sql`UPDATE bia_contribution_charges SET error_code='CREATE_UNKNOWN' WHERE id=${id}`);
      }
      await this.deps.lock(claimed.bia_id,async(tx)=>{
        const row=(await this.rows(claimed.bia_id,tx)).find((r:any)=>r.id===id);
        if(!row?.vigente || row.pendente)throw fault("Parcela não vigente");
        const bia=await this.deps.bia(row.bia_id);
        if(!activePhase(bia?.situacao)||bia?.moeda!=="BRL")throw fault("BIA não ativa ou moeda incompatível");
        const revision=row.pending_revision?(await tx.execute(sql`SELECT * FROM bia_contribution_revisions WHERE id=${row.pending_revision}`)).rows[0]:null;
        if(revision && (!openPaymentStates.includes(row.payment_state)||row.due_date<=saoPauloClock().date||row.protected))throw fault("Parcela protegida durante revisão");
        if(!row.external_id && revision) {
          await this.deps.updateFlow(row.flow_id,{valor:Number(revision.after_cents)/100});
          await this.applyRevision(row,revision,tx);
          await tx.execute(sql`UPDATE bia_contribution_charges SET job_state='queued' WHERE id=${id}`);
          return;
        }
        if(!this.enabled())throw new AsaasError("BILLING_DISABLED","Integração não homologada");
        if(!row.external_id && row.protected)throw fault("Parcela já paga ou com evidência");
        if(!provider)throw fault("Provedor indisponível");
        let payment:any=row.external_id?await provider.read(row.external_id):await provider.findPayment(reference(row));
        if(!payment) {
          if(claimed.job_state==="unknown" || claimed.error_code==="CREATE_UNKNOWN")throw fault("Emissão com resultado desconhecido; aguarde conciliação");
          // Mark the non-repeatable dispatch durably before sending it.
          payment=await provider.create(remoteCustomer.id,reference(row),row.amount_cents,row.due_date,'BOLETO');
        }
        if(revision && row.external_id) {
          if((!["PENDING","OVERDUE"].includes(payment.status) && !(["CONFIRMED","RECEIVED"].includes(payment.status)&&cents(payment.value)===Number(revision.after_cents))) || payment.deleted)throw fault("Asaas não permite revisar esta cobrança");
          if(cents(payment.value)===Number(revision.before_cents)) {
            await provider.update(payment.id,Number(revision.after_cents));payment=await provider.read(payment.id);
          } else if(cents(payment.value)!==Number(revision.after_cents))throw fault("Valor externo alterado; confira a revisão");
        }
        const snapshot=await provider.snapshot(payment,reference(row),remoteCustomer.id);
        await this.persistSnapshot(row,payment,snapshot,tx);
      });
    } catch(e:any) {
      const fresh=(await this.deps.db.execute(sql`SELECT external_id,error_code,pending_revision FROM bia_contribution_charges WHERE id=${id}`)).rows[0];
      const unknown=fresh?.error_code==="CREATE_UNKNOWN" || ["TIMEOUT","TRANSPORT_ERROR"].includes(e.code);
      if(["refunded","cancelled","processing"].includes(e.providerState))await this.deps.db.execute(sql`UPDATE bia_contribution_charges SET payment_state=${e.providerState} WHERE id=${id}`);
      await this.deps.db.execute(sql`UPDATE bia_contribution_charges SET job_state=${unknown?"unknown":"blocked"},details='{}'::jsonb,error_code=${unknown?"CREATE_UNKNOWN":safeError(e)},updated_at=now() WHERE id=${id}`);
      if(fresh?.pending_revision)await this.deps.db.execute(sql`UPDATE bia_contribution_revisions SET state=${unknown?"unknown":"failed"},error_code=${safeError(e)} WHERE id=${fresh.pending_revision}`);
    }
  }
  // The webhook only requests reconciliation; its payment payload never directly changes money.
  async webhook(body:any) {
    if(typeof body?.payment?.id!=="string")return false;
    const row=(await this.deps.db.execute(sql`SELECT * FROM bia_contribution_charges WHERE environment=${this.environment} AND external_id=${body.payment.id}`)).rows[0];
    if(!row)return false;
    if(body.account?.id && row.external_account_id!==body.account.id)throw fault("Origem de conta divergente",409);
    await this.deps.db.execute(sql`UPDATE bia_contribution_charges SET job_state='sync',updated_at=now() WHERE id=${row.id} AND job_state<>'creating'`);
    return true;
  }
  async tick(now=new Date()) {
    if(!await this.ready())return;
    await this.reminders.tick(now);
    // Crash recovery never repeats a POST; unknown jobs only search the deterministic external reference.
    await this.deps.db.execute(sql`UPDATE bia_contribution_charges SET job_state='unknown',error_code='CREATE_UNKNOWN' WHERE environment=${this.environment} AND job_state='creating' AND updated_at < now()-interval '3 minutes'`);
    await this.deps.db.execute(sql`UPDATE bia_contribution_notices SET state=CASE WHEN channel='agenda' THEN 'queued' ELSE 'unknown' END WHERE state='sending' AND updated_at<now()-interval '3 minutes'`);
    const ids=(await this.deps.db.execute(sql`SELECT id FROM bia_contribution_charges WHERE environment=${this.environment} AND job_state<>'creating' AND NOT(external_id IS NULL AND payment_state IN ('received','processing')) AND (job_state IN ('queued','sync') OR updated_at<now()-interval '5 minutes') ORDER BY updated_at LIMIT 20`)).rows;
    for(const row of ids)await this.processCharge(row.id);
    await this.notices(now);
  }
  async notices(now=new Date()) {
    if(!this.enabled())return;
    const clock=saoPauloClock(now);if(clock.hour<9)return;
    const ids=(await this.deps.db.execute(sql`SELECT DISTINCT bia_id FROM bia_contribution_charges WHERE environment=${this.environment} AND job_state='ready'`)).rows;
    for(const {bia_id:biaId} of ids) {
      const settings=await this.settings(biaId), rows=await this.rows(biaId);
      for(const row of rows) {
        if(!row.vigente || row.pendente || row.pending_revision || row.job_state!=="ready" || !openPaymentStates.includes(row.payment_state) || !row.external_id || !row.details?.invoiceUrl)continue;
        const distance=dayDistance(row.due_date,clock.date),kinds:string[]=[];
        const explicit=await this.reminders.ready()&&(await this.deps.db.execute(sql`SELECT 1 FROM bia_aporte_reminder_settings WHERE flow_id=${row.flow_id}`)).rows.length>0;
        if(!explicit&&settings.offsets.includes(distance))kinds.push(`reminder:${distance}`);
        const revisions=(await this.deps.db.execute(sql`SELECT id FROM bia_contribution_revisions WHERE charge_id=${row.id} AND state='applied' AND notified=false`)).rows;
        for(const rev of revisions)kinds.push(`revision:${rev.id}`);
        for(const kind of kinds)for(const channel of ["email","agenda"] as const)if(settings[channel])await this.deliver(row,kind,channel,now);
        if(kinds.length)await this.deps.db.execute(sql`UPDATE bia_contribution_revisions SET notified=true WHERE charge_id=${row.id} AND state='applied'`);
      }
    }
  }
  private async deliver(row:any,kind:string,channel:"email"|"agenda",now:Date) {
    const id=randomUUID();
    await this.deps.db.execute(sql`INSERT INTO bia_contribution_notices(id,charge_id,version,kind,channel) VALUES(${id},${row.id},${row.version},${kind},${channel}) ON CONFLICT DO NOTHING`);
    const notice=(await this.deps.db.execute(sql`UPDATE bia_contribution_notices SET state='sending',attempts=attempts+1,updated_at=now() WHERE charge_id=${row.id} AND version=${row.version} AND kind=${kind} AND channel=${channel} AND state IN ('queued','failed') AND attempts<3 RETURNING *`)).rows[0];
    if(!notice)return;
    // Holds the same MAP/parcel lock while checking, reserving and delivering: revisions/payments cannot race the send.
    await this.deps.lock(row.bia_id,async(tx)=>{
      const current=(await this.rows(row.bia_id,tx)).find((r:any)=>r.id===row.id);
      const bia=await this.deps.bia(row.bia_id),settings=await this.settings(row.bia_id,tx);
      if(!this.enabled() || !activePhase(bia?.situacao) || bia?.moeda!=="BRL" || !settings[channel] || !current || current.version!==row.version || current.pending_revision || current.job_state!=="ready" || !openPaymentStates.includes(current.payment_state)||current.protected){
        await tx.execute(sql`UPDATE bia_contribution_notices SET state='suppressed',updated_at=now() WHERE id=${notice.id}`);return;
      }
      try {
        // Query provider again immediately before sending, using the account's own credential.
        const account=await this.account(row.bia_id,tx),provider=await this.provider(account);await provider.verifyAccount(account);
        const remote:any=await provider.read(row.external_id);
        if(!["PENDING","OVERDUE"].includes(remote.status)||cents(remote.value)!==row.amount_cents||iso(remote.dueDate)!==row.due_date) {
          await tx.execute(sql`UPDATE bia_contribution_notices SET state='suppressed' WHERE id=${notice.id}`);
          await tx.execute(sql`UPDATE bia_contribution_charges SET job_state='sync' WHERE id=${row.id}`);return;
        }
        if(remote.id!==row.external_id)throw fault("Identificador de cobrança divergente");
        const freshSnapshot=await provider.snapshot(remote,reference(current));
        const details={...freshSnapshot.details};
        if(details.expiresAt&&Date.parse(details.expiresAt)<now.getTime()){delete details.pix;delete details.qrImage;}
        if(!details.invoiceUrl)throw fault("Link de pagamento indisponível");
        const member=await this.deps.member(row.payer_id);
        if(channel==="agenda") {
          const user=await this.deps.userForMember(member);if(!user)throw fault("Pagador sem conta");
          await tx.execute(sql`INSERT INTO agenda_tarefas(id,user_id,membro_id,titulo,descricao,data,status,prioridade,contexto_tipo,contexto_id,origem_tarefa_id)
            VALUES(${notice.id},${user},${row.payer_id},${kind.startsWith("revision")?"Aporte atualizado":"Pagamento de aporte"},${`${row.parcel_id ? `Parcela ${row.numero}` : 'Aporte'}: R$ ${(row.amount_cents/100).toFixed(2)} · vencimento ${row.due_date}. Acesse Financeiro → ${row.parcel_id ? 'Aportes e parcelas' : 'Lançamentos → Pix e boleto do aporte'}.`},${saoPauloClock(now).date},'pendente','media','bia_contribution',${row.bia_id},${row.id}) ON CONFLICT(id) DO NOTHING`);
          await tx.execute(sql`UPDATE bia_contribution_notices SET state='sent',updated_at=now() WHERE id=${notice.id}`);
        } else {
          if(!member?.email)throw fault("Pagador sem email");
          const sent=await this.deps.sendNotice({email:member.email,name:member.nome,biaId:row.bia_id,amount:row.amount_cents,dueDate:row.due_date,details,kind});
          await tx.execute(sql`UPDATE bia_contribution_notices SET state=${sent.skipped?"suppressed":sent.ok?"sent":"unknown"},updated_at=now() WHERE id=${notice.id}`);
        }
      }catch{await tx.execute(sql`UPDATE bia_contribution_notices SET state='unknown',updated_at=now() WHERE id=${notice.id}`);}
    });
  }
}
