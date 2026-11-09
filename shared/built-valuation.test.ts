import test from 'node:test';
import assert from 'node:assert/strict';
import { builtCaseSchema, calculateBuiltCase, validateBuiltCalibration, type BuiltCase } from './built-valuation';

const fact = (valor: number, classificacao = 'informada') => ({ valor, classificacao, fonte: 'Fonte identificada', data: '2026-01-01', verificacao: 'nao_conferida', limitacao: '' });
const base = (calculo: any): any => ({ titulo: 'Estudo', finalidade: 'Planejamento', dataBase: '2026-01-01', moeda: 'BRL', categoria: 'residencial', direito: 'Propriedade',
  participacaoPercentual: 50, tese: 'FLIPPING', contexto: 'atual', condicoes: '', restricoes: 'Nenhuma conhecida', condicaoAtual: 'Ocupado', vistoria: 'nao_realizada', caracteristicas: [], calculo, limitacoes: 'Fontes precisam de conferência.' });
const flow = (categoria: string, valor: number, data = '2026-01-01') => ({ id: `${categoria}-${valor}-${data}`, descricao: categoria, categoria, data, valor: fact(valor) });
const income = () => ({ metodo: 'renda', receitaAnual: fact(90000), despesaAnual: fact(20000), perdasAnuais: fact(10000), taxaCapitalizacao: fact(6) });
const scenarios = () => ['conservador', 'central', 'favoravel'].map(nome => ({ nome, premissas: 'Premissas explícitas', variacaoVenda: 0, variacaoCustos: 0, atrasoMeses: 0, ocupacaoPercentual: 100, inadimplenciaPercentual: 0, aprovada: true }));

test('renda anual líquida / taxa e participação única, sem confundir valor de venda da fração', () => {
  const raw = { ...base(income()), valorVendaParticipacao: fact(400000) };
  const result = calculateBuiltCase(raw);
  assert.equal(result.valorAtual, 1000000); assert.equal(result.parcelaProporcional, 500000);
  assert.equal(result.valorVendaIsoladaParticipacao, 400000); assert.equal(result.valorCondicionado, null);
  assert.equal(result.classificacao, 'simulacao');
  assert.equal(calculateBuiltCase(base({ ...income(), receitaAnual: fact(1) })).valorAtual, null);
  assert.throws(() => calculateBuiltCase(base({ ...income(), taxaCapitalizacao: fact(0) })));
});
test('valor condicionado exige condições e data e nunca vira valor atual', () => {
  const raw = { ...base(income()), contexto: 'condicionado', dataCondicionada: '2027-01-01', condicoes: 'Conclusão e regularização' };
  const result = calculateBuiltCase(raw); assert.equal(result.valorAtual, null); assert.equal(result.valorCondicionado, 1000000);
  assert.throws(() => calculateBuiltCase({ ...raw, condicoes: '' }));
});
test('DCF usa datas e taxa anual efetiva, separa financiamento do projeto', () => {
  const raw = base({ metodo: 'fluxo', taxaDesconto: fact(10), fluxos: [flow('aluguel', 110000, '2027-01-01'), flow('credito', 900000), flow('amortizacao', 950000, '2027-01-01')] });
  assert.equal(calculateBuiltCase(raw).valorAtual, 100000);
  assert.throws(() => calculateBuiltCase({ ...raw, dataBase: '2026-02-30' }));
  assert.throws(() => calculateBuiltCase({ ...raw, dataBase: '2026-01-02' }));
});
test('reposição deprecia apenas construção e mantém terreno separado', () => {
  const result = calculateBuiltCase(base({ metodo: 'custo', terreno: fact(200000), reposicao: fact(500000), depreciacaoFisica: fact(20), depreciacaoFuncional: fact(10), depreciacaoExterna: fact(0) }));
  assert.equal(result.valorAtual, 560000); assert.match(result.formula, /sucessivas/);
  assert.throws(() => calculateBuiltCase(base({ metodo: 'custo', terreno: fact(1), reposicao: fact(1), depreciacaoFisica: fact(101), depreciacaoFuncional: fact(0), depreciacaoExterna: fact(0) })));
});
test('residual deduz custos e margem sobre receitas presentes sem comprar terreno duas vezes', () => {
  const c = { metodo: 'residual', taxaDesconto: fact(10), margemEmpreendedor: fact(20), fluxos: [flow('venda', 1100000, '2027-01-01'), flow('obra', 500000)] };
  assert.equal(calculateBuiltCase({ ...base(c), categoria: 'terreno' }).valorAtual, 300000);
  assert.throws(() => calculateBuiltCase(base({ ...c, fluxos: [...c.fluxos, flow('aquisicao', 1)] })));
  assert.equal(calculateBuiltCase(base({ ...c, fluxos: [flow('obra', 2000000), flow('venda', 1100000, '2027-01-01')] })).valorAtual, -1200000);
});
test('referências específicas com natureza de área igual, mediana, sem preço inventado com amostra insuficiente', () => {
  const ref = (n: number) => ({ identificador: `referencia-${n}`, natureza: 'anuncio', categoria: 'rural', regiao: 'Zona A', data: '2026-01-01', unidadeArea: 'terreno_ha', area: 10, preco: fact(n), justificativa: 'Solo, uso e água comparáveis' });
  const c = { metodo: 'comparativo', area: fact(20), unidadeArea: 'terreno_ha', comparaveis: [ref(100000),ref(120000),ref(900000)] };
  const result = calculateBuiltCase({ ...base(c), categoria: 'rural' });
  assert.equal(result.valorAtual, 240000); assert.equal(result.referenciasAceitas, 3); assert.equal(result.classificacao, 'estimativa_de_mercado');
  for (const change of [{ unidadeArea: 'construida_m2' }, { categoria: 'residencial' }, { data: '2027-01-01' }, { preco: fact(1, 'hipotetica') }, { identificador: 'referencia-100000' }]) {
    assert.equal(calculateBuiltCase({ ...base({ ...c, comparaveis: [c.comparaveis[0],c.comparaveis[1],{ ...c.comparaveis[2],...change }] }), categoria: 'rural' }).valorAtual, null);
  }
});
test('estratégia reproduz exemplo do manual, cenários não probabilísticos e metas de saída sem valor de mercado', () => {
  const raw = { ...base(income()), estrategia: { taxaDesconto: fact(10), dataSaida: '2027-01-01', retornoAlvoPercentual: 20,
    fluxos: [flow('aquisicao',500000),flow('tributos',25000),flow('obra',80000),flow('operacao',15000),flow('venda',750000,'2027-01-01'),flow('tributos',50000,'2027-01-01'),flow('credito',200000),flow('amortizacao',210000,'2027-01-01')], cenarios: scenarios() } };
  raw.estrategia.cenarios[0].variacaoVenda = -10; raw.estrategia.cenarios[0].variacaoCustos = 10;
  raw.estrategia.cenarios[2].aprovada = false;
  const r = calculateBuiltCase(raw);
  assert.equal(r.estrategia?.resultadoProjeto, 80000); assert.equal(r.estrategia?.fluxoProprietario, 70000);
  assert.equal(r.cenarios[1].indicadores?.resultadoProjeto,80000); assert.equal(r.cenarios[2].indicadores,null);
  assert.equal(r.cenarios[0].indicadores?.resultadoProjeto,-12000);
  assert.equal(r.precoNecessario?.equilibrio,732000); assert.equal(r.precoNecessario?.retornoAlvo,878400);
  assert.equal(r.valorAtual,1000000); assert.notEqual(r.valorAtual,r.precoNecessario?.retornoAlvo);
});
test('ocupação, inadimplência, prazo e meses de fim de mês alteram apenas fluxos elegíveis', () => {
  const raw = { ...base(income()), estrategia: { taxaDesconto: fact(10), dataSaida: '2027-01-31', retornoAlvoPercentual: 0,
    fluxos: [flow('aluguel',100000,'2026-01-31')], cenarios: scenarios() } };
  raw.estrategia.cenarios[0].ocupacaoPercentual=50;raw.estrategia.cenarios[0].inadimplenciaPercentual=10;raw.estrategia.cenarios[0].atrasoMeses=1;
  const r=calculateBuiltCase(raw);assert.equal(r.cenarios[0].indicadores?.receitas,45000);
  assert.equal(r.cenarios[0].indicadores?.prazoDias,58);
  assert.throws(()=>calculateBuiltCase({...raw,estrategia:{...raw.estrategia,cenarios:[scenarios()[0],scenarios()[0],scenarios()[0]]}}));
});
test('documento, referência fiscal e hipótese mantêm origem e não viram preço real para treinamento', () => {
  const r=calculateBuiltCase(base({metodo:'documental',valor:fact(500000,'documentada'),natureza:'fiscal'}));
  assert.equal(r.classificacao,'registro_documental');assert.equal(r.evidencias[0].evidencia.fonte,'Fonte identificada');
  assert.equal(calculateBuiltCase(base({metodo:'documental',valor:fact(500000,'hipotetica'),natureza:'expectativa'})).classificacao,'simulacao');
  assert.throws(()=>calculateBuiltCase({...base(income()),vistoria:'informada_com_documento'}));
  assert.throws(()=>builtCaseSchema.parse({...base(income()),participacaoPercentual:101}));
  assert.throws(()=>calculateBuiltCase(base({...income(),receitaAnual:{...fact(1),fonte:''}})));
});

const dataset=()=>({versaoModelo:'v1',moeda:'BRL',linhas:[
  {imovel:'a',regiao:'ES',categoria:'residencial',grupo:'treino',data:'2025-01-01',dataPrevisao:'2024-12-01',origem:'transacao_documentada',fonte:'Negócio documentado A',area:100,realizado:500000,previsto:500000},
  {imovel:'b',regiao:'ES',categoria:'residencial',grupo:'teste',data:'2026-01-01',dataPrevisao:'2025-02-01',origem:'transacao_documentada',fonte:'Negócio documentado B',area:100,realizado:500000,previsto:550000,minimo:490000,maximo:600000},
  {imovel:'c',regiao:'RJ',categoria:'terreno',grupo:'teste',data:'2026-01-01',dataPrevisao:'2025-02-01',origem:'transacao_documentada',fonte:'Negócio documentado C',area:200,realizado:1000000,previsto:900000,minimo:800000,maximo:950000},
]});
test('validação temporal mede erro, viés, grupos, baseline e cobertura sem certificação automática',()=>{
  const r=validateBuiltCalibration(dataset(),'2026-11-09');
  assert.equal(r.geral.erroAbsolutoMedioPercentual,10);assert.equal(r.geral.viesPercentual,0);assert.equal(r.geral.coberturaFaixasPercentual,50);
  assert.equal(r.geral.baselineErroPercentual,0);assert.equal(r.geral.quantidadeComBaseline,1);assert.equal(r.grupos.length,2);
  assert.equal(r.liberacaoAutomatica,false);assert.equal(r.geral.superavaliados,1);assert.equal(r.geral.subavaliados,1);
});
test('validação bloqueia vazamento, estimativas próprias como verdade, repetição e períodos misturados',()=>{
  for(const mutate of [
    (d:any)=>d.linhas[1].imovel='a', (d:any)=>d.linhas[1].data='2024-01-01',
    (d:any)=>d.linhas[1].dataPrevisao='2024-01-01', (d:any)=>d.linhas[1].data='2028-01-01',
    (d:any)=>d.linhas[1].origem='estimativa_built', (d:any)=>d.linhas[1].minimo=600000,
  ]){const d=dataset();mutate(d);assert.throws(()=>validateBuiltCalibration(d,'2026-11-09'));}
});
