import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { registerBuiltValuationRoutes } from './built-valuation';
import { builtReportHtml } from './built-valuation-report';
import { calculateBuiltCase } from '../shared/built-valuation';

const fact = (valor: number) => ({valor,classificacao:'informada',fonte:'Contrato identificado',data:'2026-01-01',verificacao:'nao_conferida',limitacao:''});
const input = (): any => ({titulo:'Manter alugado',finalidade:'Planejamento',dataBase:'2026-01-01',moeda:'BRL',categoria:'comercial',direito:'Propriedade',participacaoPercentual:50,tese:'BUY_AND_HOLD',contexto:'atual',condicoes:'',restricoes:'Nenhuma conhecida',condicaoAtual:'Ocupado',vistoria:'nao_realizada',caracteristicas:[],limitacoes:'Sem vistoria',
  calculo:{metodo:'renda',receitaAnual:fact(90000),despesaAnual:fact(20000),perdasAnuais:fact(10000),taxaCapitalizacao:fact(6)}});

test('API SQL real: isolamento, gravação append-only, concorrência, evidências, relatório, revisão e adoção explícita', async () => {
  const pg=new PGlite();
  try {
    await pg.exec(`CREATE TABLE inventario_imoveis(id text PRIMARY KEY,data jsonb,updated_at timestamp default now());
      CREATE TABLE carteira_analises(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),imovel_id text,tipo text,versao_regra text,entrada jsonb,resultado jsonb,criado_por_user_id text,criado_por_membro_id text,criado_em timestamp default now());
      CREATE TABLE carteira_documentos(id uuid PRIMARY KEY,imovel_id text,nome text,criado_em timestamp default now());
      CREATE TABLE inventario_lancamentos(imovel_id text,data jsonb);
      CREATE TABLE carteira_eventos(imovel_id text,tipo text,origem text,titulo text,payload jsonb,criado_por_user_id text,criado_por_membro_id text);
      CREATE FUNCTION pg_advisory_xact_lock(integer) RETURNS void LANGUAGE SQL AS 'SELECT';`);
    const db=drizzle(pg), handlers=new Map<string,any>();
    let permission='administracao',queries=0;
    const originalExecute=db.execute.bind(db);db.execute=((q:any)=>{queries++;return originalExecute(q);}) as any;
    const property={id:'own',nome:'Imóvel Teste',moeda:'BRL',valor_atual:100,valor_pago:50,tipo:'Loja',cidade:'Vitória',estado:'ES',endereco:'Rua A',participacao_percentual:50};
    let currentProperty:any=property;
    await pg.query('INSERT INTO inventario_imoveis(id,data) VALUES($1,$2)',['own',JSON.stringify(property)]);
    for(const launch of [{tipo:'receita',status:'pago',valor:100},{tipo:'despesa',status:'pago',valor:40},{tipo:'receita',status:'agendado',valor:999},{tipo:'receita',status:'pago',valor:'inválido'}]) await pg.query('INSERT INTO inventario_lancamentos VALUES($1,$2)',['own',JSON.stringify(launch)]);
    const document='22222222-2222-4222-8222-222222222222';await pg.query('INSERT INTO carteira_documentos(id,imovel_id,nome) VALUES($1,$2,$3)',[document,'own','Parecer']);
    registerBuiltValuationRoutes({get:(p:string,h:any)=>handlers.set('GET '+p,h),post:(p:string,h:any)=>handlers.set('POST '+p,h)} as any,{db,
      actor:(req:any)=>{if(!req.user)throw Object.assign(new Error('Login necessário'),{status:401});return {userId:req.user,membroId:null,role:'membro',isPlatformAdmin:false};},
      access:async(id,actor,level)=>{if(id!=='own'||actor.userId!=='owner')throw Object.assign(new Error('Não encontrado'),{status:404});if(level==='administracao'&&permission!=='administracao')throw Object.assign(new Error('Sem permissão'),{status:403});return {imovel:currentProperty};}});
    const call=async(method:string,suffix:string,body:any={},params:any={},user='owner')=>{
      let status=200,output:any,headers:any={};const res:any={status:(n:number)=>{status=n;return res;},json:(o:any)=>output=o,type:(s:string)=>{headers.type=s;return res;},setHeader:(k:string,v:string)=>headers[k]=v,send:(s:any)=>output=s};
      currentProperty=(await pg.query<any>('SELECT data FROM inventario_imoveis WHERE id=$1',['own'])).rows[0].data;
      await handlers.get(`${method} /api/carteira/imoveis/:id/metodo-built${suffix}`)({params:{id:'own',...params},query:params.antes?{antes:params.antes}:{},body,user},res);return {status,output,headers};
    };
    const before=queries;assert.equal((await call('GET','',{}, {},'stranger')).status,404);assert.equal(queries,before);
    assert.equal((await call('GET','',{}, {},'')).status,401);
    permission='leitura';assert.equal((await call('POST','',{entrada:input(),anteriorId:null})).status,403);permission='administracao';
    const caseId='11111111-1111-4111-8111-111111111111',payload={casoId:caseId,anteriorId:null,motivo:'cadastro',entrada:input(),resultado:{valorAtual:99999999}};
    const first=await call('POST','',payload);assert.equal(first.status,201);assert.equal(first.output.resultado.valorAtual,1000000);assert.equal(first.output.resultado.desempenhoSnapshot.resultado,60);assert.equal(first.output.resultado.desempenhoSnapshot.excluidos,1);
    assert.equal((await call('POST','',payload)).status,409); // Unknown response/retry cannot create a duplicate.
    const second=await call('POST','',{...payload,anteriorId:first.output.id,motivo:'referencias',entrada:{...input(),titulo:'Nova versão'}});assert.equal(second.status,201);
    assert.equal((await pg.query<any>('SELECT count(*)::int n FROM carteira_analises')).rows[0].n,2);
    const old=(await pg.query<any>('SELECT entrada FROM carteira_analises WHERE id=$1',[first.output.id])).rows[0];assert.equal(old.entrada.dados.titulo,'Manter alugado');
    const page=await call('GET','');assert.equal(page.output.analises.length,2);assert.equal(page.output.desempenho.resultado,60);assert.equal(page.output.imovel.valorAtual,100);
    assert.equal((await call('POST','',{...payload,casoId:undefined,entrada:{...input(),calculo:{...input().calculo,receitaAnual:{...fact(1),documentoId:'33333333-3333-4333-8333-333333333333'}}}})).status,400);
    assert.equal((await call('POST','',{...payload,casoId:undefined,entrada:{...input(),moeda:'USD'}})).status,400);
    const invalidReview=await call('POST','/:analiseId/revisao',{credencial:'CREA declarado',escopo:'Escopo do parecer',parecer:'Parecer com ressalvas',documentoId:'33333333-3333-4333-8333-333333333333',conclusao:'ressalvas',confirmoResponsabilidade:true},{analiseId:first.output.id});assert.equal(invalidReview.status,400);
    const review=await call('POST','/:analiseId/revisao',{credencial:'Profissional · CREA declarado',escopo:'Escopo do parecer',parecer:'Parecer com ressalvas',documentoId:document,conclusao:'ressalvas',confirmoResponsabilidade:true},{analiseId:first.output.id});assert.equal(review.status,201);assert.equal(review.output.registradoPor,'owner');
    const report=await call('GET','/:analiseId/relatorio',{}, {analiseId:first.output.id});assert.equal(report.status,200);assert.match(report.output,/Manter alugado/);assert.doesNotMatch(report.output,/Nova versão/);assert.match(report.output,/CREA declarado/);assert.match(report.headers['Content-Security-Policy'],/default-src 'none'/);
    assert.equal((await call('GET','/:analiseId/relatorio',{}, {analiseId:'not-uuid'})).status,400);
    assert.equal((await call('POST','/:analiseId/adotar',{confirmo:true,valorAnterior:999},{analiseId:second.output.id})).status,409);
    const adopted=await call('POST','/:analiseId/adotar',{confirmo:true,valorAnterior:100},{analiseId:second.output.id});assert.equal(adopted.status,200);
    const adoptedData=(await pg.query<any>('SELECT data FROM inventario_imoveis')).rows[0].data;assert.equal(adoptedData.valor_atual,1000000);assert.equal(adoptedData.valor_pago,50);assert.equal(adoptedData.participacao_percentual,50);assert.equal(adoptedData.valor_origem,'metodo_built_referencia_confirmada');
    const changed={...input(),contexto:'condicionado',condicoes:'Após obra',dataCondicionada:'2027-01-01'};
    const cond=await call('POST','',{anteriorId:null,motivo:'obra',entrada:changed});assert.equal(cond.status,201);
    assert.equal((await call('POST','/:analiseId/adotar',{confirmo:true,valorAnterior:1000000},{analiseId:cond.output.id})).status,400);
    const mutation={...adoptedData,endereco:'Rua B'};await pg.query('UPDATE inventario_imoveis SET data=$1',[JSON.stringify(mutation)]);
    assert.equal((await call('POST','/:analiseId/adotar',{confirmo:true,valorAnterior:1000000},{analiseId:first.output.id})).status,409);
    const badSample=await call('POST','/validacao',{versaoModelo:'v1',moeda:'BRL',linhas:[]});assert.equal(badSample.status,400);
    await pg.query(`INSERT INTO carteira_analises(imovel_id,tipo,versao_regra,entrada,resultado,criado_em)
      SELECT imovel_id,tipo,versao_regra,entrada,resultado,now()+s * interval '1 second'
      FROM carteira_analises CROSS JOIN generate_series(1,205) s WHERE id=$1`,[first.output.id]);
    const firstPage=await call('GET','');assert.equal(firstPage.output.analises.length,200);assert.ok(firstPage.output.maisAntigasCursor);
    const lastPage=await call('GET','',{}, {antes:firstPage.output.maisAntigasCursor});assert.equal(lastPage.output.analises.length,8);assert.equal(lastPage.output.maisAntigasCursor,null);
    const allIds=[...firstPage.output.analises,...lastPage.output.analises].map(r=>r.id);assert.equal(new Set(allIds).size,208);
  } finally {await pg.close();}
});

test('relatório UTF-8 escapa todos os dados, separa quatro resultados e preserva fontes e limitações',()=>{
  const data={...input(),titulo:'<script>alert("X")</script> · 日本語',condicaoAtual:'Área técnica com água'};
  const result=calculateBuiltCase(data),html=builtReportHtml({id:'r1',casoId:'c1',motivo:'obra',entrada:data,resultado:{...result,imovelSnapshot:{id:'p',nome:'Imóvel & sócios'},capturadoEm:'2026-11-09',hash:'abc',desempenhoSnapshot:{receitas:100,despesas:40,resultado:60}}});
  assert.match(html,/charset="utf-8"/);assert.match(html,/日本語/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
  for(const heading of ['Valor atual do imóvel inteiro','Valor condicionado','Resultado do projeto','Desempenho efetivamente','Fontes e classificação','Pendências, limitações'])assert.ok(html.includes(heading));
});
