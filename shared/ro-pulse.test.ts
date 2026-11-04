import test from 'node:test';
import assert from 'node:assert/strict';
import {roCommunityStage,roPulseWaves,roPulseOpen,roPulseSummary,roPulseSchema,roPulseHref} from './ro-pulse';
const communities=[{id:'o',pais:'Brasil',territorio:'Sudeste'},{id:'r',pais:'BRÁSIL',territorio:'sudeste'},{id:'n',pais:'Brasil',territorio:'Sul'},{id:'g',pais:'Japão',territorio:'Aichi'},{id:'unknown'}];
test('quatro alcances por comunidade, sem presumir localização ausente',()=>{
 assert.deepEqual(communities.map(c=>roCommunityStage(communities[0],c)),['origem','regional','nacional','global',null]);
 const raw={intervalo_horas:7,comunidades:{regional:['r','r'],nacional:['n'],global:['g']}};
 assert.deepEqual(roPulseWaves('o',communities,raw).waves.map(w=>w.stage),['origem','regional','nacional','global']);
 assert.deepEqual(roPulseWaves('o',communities,raw).config.comunidades.regional,['r']);
 assert.throws(()=>roPulseWaves('o',communities,{...raw,comunidades:{...raw.comunidades,global:['r']}}),/alcance/);
 for(const value of [0,-1,1.5,169,NaN,'4',null])assert.equal(roPulseSchema.safeParse({...raw,intervalo_horas:value}).success,false);
 assert.equal(roPulseWaves('o',communities,{intervalo_horas:1,comunidades:{regional:[],nacional:[],global:[]}}).waves.length,1);
});
test('divulgação respeita fuso da RO, virada do dia e encerramento',()=>{
 const meeting={data:'2031-01-01',hora:'00:30',timezone:'Asia/Tokyo',status:'agendada'};
 assert.equal(roPulseOpen(meeting,new Date('2030-12-31T15:29:00Z')),true);
 assert.equal(roPulseOpen(meeting,new Date('2030-12-31T15:30:00Z')),false);
 assert.equal(roPulseOpen({...meeting,timezone:'invalido'}),false);
 for(const status of ['cancelada','realizada','concluida','rascunho'])assert.equal(roPulseOpen({...meeting,status},new Date('2030-12-01')),false);
  assert.equal(roPulseHref('id&1'),'/ros/avisos/id%261');
 const summary=roPulseSummary({...meeting,id:'1',titulo:'RO',ata:'privada',link:'privado',address:'privado',participantes:['privado'],data:new Date('2031-01-01T00:00:00Z')});
 assert.equal(summary.data,'2031-01-01');for(const key of ['ata','link','address','participantes'])assert.ok(!(key in summary));
});
