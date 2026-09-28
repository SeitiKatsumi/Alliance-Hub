import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIA_CREATION_STEPS, emptyBiaSetup, legacyBiaSetup, biaSetupSchema, biaSetupValidationMessage, parseBiaSetup, legalBlockers, setupWarnings, assetTotals, governanceRoles, biaAssetFromPortfolio, biaConsortiumSchema } from './bia-setup';
import { validateBiaDraft } from '../server/bia-workflow';
test('eight steps and legacy adapter preserve unknowns and do not duplicate metrics',()=>{
  assert.equal(BIA_CREATION_STEPS.length,8);
  assert.equal(BIA_CREATION_STEPS[1],'Capitalização e direitos econômicos');
  assert.equal(BIA_CREATION_STEPS[5],'CAPEX e OPEX');
  const value=legacyBiaSetup({info_comercial:{ativo_endereco:'Endereço legado',razao_social:'Empresa',conta:'123'},valor_geral_venda_vgv:900});
  assert.equal(value.ativos.length,1);assert.equal(value.juridico.info.conta,'123');assert.equal(value.ativos[0].info.conta,'');
  assert.equal(value.ativos[0].dataVinculo,'');assert.equal(value.juridico.modalidade,'');assert.equal(value.indicadoresLegados.valor_geral_venda_vgv,900);
  assert.equal(assetTotals(value).valor_geral_venda_vgv,null);
  assert.equal(legacyBiaSetup({valor_geral_venda_vgv:'900.50'}).indicadoresLegados.valor_geral_venda_vgv,900.5);
  value.ativos[0].indicadores.valor_geral_venda_vgv=300;
  value.ativos.push({...value.ativos[0],id:'two',indicadores:{...value.ativos[0].indicadores,valor_geral_venda_vgv:400}});
  assert.equal(assetTotals(value).valor_geral_venda_vgv,700);
  assert.deepEqual(legacyBiaSetup({estrutura_bia:value}),value);
});
test('legal and assets pending are warnings; legal responsible and modality required',()=>{
  const value=emptyBiaSetup();assert.equal(legalBlockers(value).length,3);
  Object.assign(value.juridico,{modalidade:'societaria',responsavel:'Responsável',documentoResponsavel:'12345678901',situacao:'A constituir'});
  assert.deepEqual(legalBlockers(value),['Informe a OAB do responsável jurídico.']);
  value.juridico.oabResponsavel='SP 123456';
  assert.deepEqual(legalBlockers(value),[]);assert.equal(setupWarnings(value).length,4);
  const draft=validateBiaDraft({nome_bia:'Teste',moeda:'BRL',estrutura_bia:value});
  assert.deepEqual(draft.estrutura_bia,value);
  value.juridico.socios.push({id:'external',memberId:'',nome:'Terceiro',documento:'12345678901',cotas:10});
  assert.equal(biaSetupSchema.parse(value).juridico.socios.length,1);
  assert.throws(()=>biaSetupSchema.parse({...value,juridico:{...value.juridico,documentoResponsavel:'abc'}}));
  assert.throws(()=>biaSetupSchema.parse({...value,governanca:[{cargo:'inexistente',memberId:'a'}]}));
});
test('OAB is separate from legacy CPF, retained for old clients and validated without changing roles',()=>{
  const value=emptyBiaSetup();value.juridico.oabResponsavel='123456/SP';value.juridico.documentoResponsavel='12345678901';
  const old=JSON.parse(JSON.stringify(value));delete old.juridico.oabResponsavel;
  const legacy=legacyBiaSetup({estrutura_bia:old});
  assert.equal(legacy.juridico.oabResponsavel,'');assert.equal(legacy.juridico.documentoResponsavel,'12345678901');
  assert.equal(parseBiaSetup(old,value).juridico.oabResponsavel,'123456/SP');
  assert.equal(parseBiaSetup({...value,juridico:{...value.juridico,oabResponsavel:''}},value).juridico.oabResponsavel,'');
  assert.equal(biaSetupSchema.parse({...value,juridico:{...value.juridico,oabResponsavel:' SP 123456 '}}).juridico.oabResponsavel,'SP 123456');
  for(const invalid of [null,123,'a'.repeat(101)])assert.throws(()=>biaSetupSchema.parse({...value,juridico:{...value.juridico,oabResponsavel:invalid}}));
  const invalidDocument=biaSetupSchema.safeParse({...value,juridico:{...value.juridico,documentoResponsavel:'OAB 123'}});
  assert.equal(invalidDocument.success,false);if(!invalidDocument.success)assert.equal(biaSetupValidationMessage(invalidDocument.error),'Corrija CPF/CNPJ legado do responsável jurídico: Informe CPF com 11 dígitos ou CNPJ com 14 dígitos.');
  value.juridico.administrador='Pessoa da rede';value.juridico.responsavel='Outra pessoa';
  assert.deepEqual(parseBiaSetup(value).governanca,[]);assert.deepEqual(parseBiaSetup(value).juridico.socios,[]);
});
test('governance includes zero rights and multiple functions, excluding author and capital',()=>{
  assert.deepEqual(governanceRoles({cargos:['Autor da Oportunidade','Aliado BUILT'],contribuicoes:[{cargo:'Contribuição individual'},{cargo:'Aliado BUILT'},{cargo:'Diretor de Aliança'}]}),['Aliado BUILT','Diretor de Aliança']);
});

test('portfolio assets retain source, allow multiple properties and never import money or ownership',()=>{
  const asset=biaAssetFromPortfolio({id:'inv-1',nome:'Sítio São José',cidade:'São Paulo',area_m2:240,matricula:'123',valor_atual:900000,moeda:'USD',titularidade:[{nome:'Pessoa'}],conta:'PRIVATE'});
  assert.equal(asset.carteiraImovelId,'inv-1');assert.equal(asset.info.ativo_area_m2,'240');assert.equal(asset.info.ativo_numero_matricula,'123');
  assert.equal(asset.valorReferencia,null);assert.equal(asset.titular,'');assert.equal(asset.dataVinculo,'');assert.equal(asset.info.conta,'');
  const setup={...emptyBiaSetup(),ativosIndefinidos:false,ativos:[asset,biaAssetFromPortfolio({id:'inv-2',nome:'Galpão'})]};
  assert.equal(biaSetupSchema.parse(setup).ativos.length,2);assert.equal(assetTotals(setup).valorReferencia,null);
  assert.deepEqual(validateBiaDraft({nome_bia:'BIA',moeda:'BRL',estrutura_bia:setup}).estrutura_bia,setup);
  assert.throws(()=>biaSetupSchema.parse({...setup,ativos:[asset,{...asset,id:'another'}]}),/já foi adicionado/);
  const manual={...asset};delete manual.carteiraImovelId;
  assert.equal(biaSetupSchema.parse({...setup,ativos:[manual]}).ativos[0].carteiraImovelId,undefined);
});

test('consortium assets retain typed information, legacy clients, zero and independent totals',()=>{
  const value=legacyBiaSetup({info_comercial:{ativo_endereco:'Legado'}}),legacy=structuredClone(value.ativos[0]);
  const consortium={...legacy,id:'consortium',tipo:'consorcio' as const,info:{},consorcio:biaConsortiumSchema.parse({cota:'002352',administradora:'HS Consórcios',valorCarta:1000000,prazoMeses:220,parcelaAteContemplacao:2795,diaVencimento:10})};
  value.ativos.push(consortium);
  const parsed=biaSetupSchema.parse(value);assert.deepEqual(parsed.ativos[0],legacy);
  assert.deepEqual(parsed.ativos[1].consorcio,consortium.consorcio);
  assert.equal(assetTotals(parsed).valorReferencia,null);assert.equal(parsed.orcamento,undefined);
  assert.deepEqual(validateBiaDraft({nome_bia:'Teste',moeda:'BRL',estrutura_bia:parsed}).estrutura_bia,parsed);
  const old=structuredClone(parsed);delete old.ativos[1].tipo;delete old.ativos[1].consorcio;
  assert.deepEqual(parseBiaSetup(old,parsed),parsed);
  for(const patch of [{valorCarta:-1},{parcelaAteContemplacao:Infinity},{prazoMeses:0},{prazoMeses:1.5},{diaVencimento:0},{diaVencimento:32},{diaVencimento:1.5},{cota:123}])assert.throws(()=>biaConsortiumSchema.parse({...consortium.consorcio,...patch}));
  assert.equal(biaConsortiumSchema.parse({valorCarta:0,parcelaAteContemplacao:0}).valorCarta,0);
  assert.equal(biaConsortiumSchema.parse({}).valorCarta,null);
  assert.throws(()=>biaSetupSchema.parse({...parsed,ativos:[{...consortium,carteiraImovelId:'property'}]}),/convertido/);
  assert.throws(()=>biaSetupSchema.parse({...parsed,ativos:[{...consortium,tipo:'imovel'}]}),/incompatíveis/);
});
