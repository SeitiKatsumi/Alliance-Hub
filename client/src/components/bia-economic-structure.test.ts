import { governanceRoles, governanceLabel } from "../../../shared/bia-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import ts from "typescript";
import { validateEconomicStructure } from "../../../shared/member-portfolio";
import { formatBiaNumber, formatBiaPercent } from "../../../shared/bia-numbers";

const source=readFileSync(new URL("./bia-economic-structure.tsx",import.meta.url),"utf8");
test("nome visual do Aliado preserva valor canônico da função",()=>{
  assert.match(source,/<option key=\{role\} value=\{role\}/);
  assert.equal(governanceLabel('Aliado BUILT'),'Aliado Licenciado BUILT');
});
test("periodicidade personalizada abre descrição e mantém forma válida, sem apagar detalhes",()=>{
  const ast=ts.createSourceFile("form.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const handlers=new Map<string,string>();
  const visit=(node:ts.Node)=>{
    if(ts.isJsxOpeningElement(node) && node.tagName.getText(ast)==="select"){
      const attrs=node.attributes.properties.filter(ts.isJsxAttribute);
      const value=attrs.find(a=>a.name.getText(ast)==="value")?.initializer;
      const change=attrs.find(a=>a.name.getText(ast)==="onChange")?.initializer;
      if(value && change && ts.isJsxExpression(value) && ts.isJsxExpression(change) && value.expression && change.expression)handlers.set(value.expression.getText(ast),change.expression.getText(ast));
    }ts.forEachChild(node,visit);
  };visit(ast);
  let s:any={modalidade:"recursos_proprios",totalCotas:1,instrumentos:[],integralizacao:{forma:"parcelado",quantidade:3,meses:1,primeiroVencimento:"2026-10-20",correcao:"IGP-M",observacoes:""}};
  const change=(field:string,value:string)=>{
    const code=transformSync(`const handler=${handlers.get(`s.integralizacao.${field}`)};`,{loader:"ts"}).code;
    new Function("s","structure","event",code+"handler(event);")(s,(patch:any)=>{s={...s,...patch};},{target:{value}});
  };
  change("meses","0");assert.equal(s.integralizacao.forma,"personalizado");
  assert.throws(()=>validateEconomicStructure(s,100),/detalhes do plano/);
  s.integralizacao.observacoes="A cada 45 dias";
  assert.doesNotThrow(()=>validateEconomicStructure(s,100));
  change("meses","3");assert.equal(s.integralizacao.forma,"parcelado");
  assert.equal(s.integralizacao.observacoes,"A cada 45 dias");
  change("forma","personalizado");assert.equal(s.integralizacao.meses,0);
  change("forma","parcelado");assert.equal(s.integralizacao.meses,1);
  change("forma","a_vista");assert.equal(s.integralizacao.quantidade,1);assert.equal(s.integralizacao.meses,0);
  assert.match(source,/<Textarea[^]*?required=\{customPeriod\}/);
  assert.match(source,/Periodicidade personalizada e detalhes do plano/);
});
test("correção contratual usa dropdown e preserva valores personalizados ou vazios",()=>{
  const start=source.indexOf("const correctionOptions");
  const end=source.indexOf("const memberSearchFilter",start);
  const code=transformSync(source.slice(start,end),{loader:"tsx"}).code;
  const Component=new Function("React","useState","Input","selectCss",code+";return ContractCorrectionField;")(React,React.useState,"input","");
  const render=(value:string)=>renderToStaticMarkup(React.createElement(Component,{value,onChange:()=>{}}));
  for(const value of ["Sem reajuste","IGP-M","IPCA","INCC"]){
    const html=render(value);
    assert.match(html,new RegExp(`<option value="${value}" selected="">`));
    assert.doesNotMatch(html,/<input/);
  }
  const custom=render("IPCA + condição contratual específica");
  assert.match(custom,/<option value="other" selected="">Outra/);
  assert.match(custom,/value="IPCA \+ condição contratual específica"/);
  assert.match(render(""),/<option value="" disabled="" selected="">Selecione/);
  assert.match(source,/onChange\(other\?"":e.target.value\)/);
});
test("seleção de sócios ordena nomes em pt-BR e busca sem distinguir acentos ou maiúsculas",()=>{
  const optionsCode=source.match(/const memberOptions = ([^;]+);/)![1];
  const members=[{id:"z",nome:" Zélia "},{id:"v",nome:"Vilma"},{id:"b",nome:"barão"},{id:"a",Nome_de_usuario:"Átila"},{id:"b2",nome:"barão"}];
  const options=new Function("members",`return ${optionsCode}`)(members);
  assert.deepEqual(options.map((m:any)=>m.id),["a","b","b2","v","z"]);
  assert.equal(members[0].id,"z","não reordena os dados recebidos");
  const code=transformSync(source.match(/const memberSearchFilter = .*;/)![0],{loader:"ts"}).code;
  const filter=new Function(code+";return memberSearchFilter;")();
  assert.equal(filter("b"," BARAO ",["Barão do Império"]),1);
  assert.equal(filter("v","barao",["Vilma"]),0);
  assert.equal(filter("b","",["Barão"]),1);
  assert.match(source,/Command filter=\{memberSearchFilter\}/);
  assert.match(source,/aria-label="Buscar sócio pelo nome"/);
  assert.match(source,/open=\{!readOnly && openMember===i\}/);
  assert.match(source,/disabled=\{people.some\(\(person,n\)=>n!==i && String\(person.memberId\)===m.id\)\}/);
  assert.match(source,/if\(m.id===p.memberId\)\{setOpenMember\(null\);return;\}/);
  assert.match(source,/window.confirm\("Trocar a pessoa limpa as CIs/);
});
test("BEI segue os blocos numerados de 1 a 8 sem entrada ou cálculo de CPP na etapa",()=>{
  const form=source.slice(source.indexOf("export function BiaEconomicStructureFields"));
  const headings=["1. Identificação da BIA","2. Valor de Origem","3. Cotas Iniciais","4. Forma de capitalização","5. Distribuição das Cotas Iniciais e Aportes Financeiros","6. Forma de integralização","7. Governança e Divisor Multiplicador","8. Resumo da Base Econômica Inicial"];
  let previous=-1;
  for(const title of headings){const at=form.indexOf(title);assert.ok(at>previous,title);previous=at;}
  assert.doesNotMatch(form,/Cotas de Investimento|Parcela das CPPs destinada|Classificação do capital/);
  assert.match(form,/Aportes cadastrados/);assert.match(form,/Saldo a integralizar/);
  assert.match(source,/\[0,"Personalizada"\]/);
  assert.match(form,/periodicities.map/);
  assert.match(form,/<dt>Periodicidade<\/dt><dd>\{[^\n]*periodicities.find/);
  assert.match(form,/<dt>Detalhes do plano<\/dt><dd[^>]*>\{s.integralizacao.observacoes\?\.trim\(\) \|\| "Não informado"\}/);
  assert.doesNotMatch(form,/A BEI é todo este arranjo econômico inicial/);
  assert.doesNotMatch(form,/Personalizada \/ única/);
  assert.doesNotMatch(form,/Planejamento contratual\. IGP-M/);
  assert.doesNotMatch(form,/Aportes? de Capital/);
  assert.match(form,/<span>Aporte Financeiro<\/span>/);
  assert.match(form,/<dt>Aportes Financeiros<\/dt>/);
  assert.match(form,/Uma linha por pessoa\. A forma do aporte fica nos detalhes\./);
  assert.match(form,/>Forma do aporte<\/summary>/);
  assert.doesNotMatch(form,/Natureza do aporte|Selecione quando houver aporte/);
  assert.match(form,/<label>Forma do aporte<select/);
  assert.match(form,/<label className="min-w-0 flex-1">Função<select/);
  assert.match(form,/Trocar a função limpa o direito desta linha/);
  assert.match(form,/Remover esta função e seu direito/);
  assert.match(form,/>Remover função<\/Button>/);
  assert.match(form,/>Adicionar função<\/Button>/);
  assert.match(form,/Contribuição individual participa do MAP Inicial pelas CIs e não compõe o DM/);
  assert.match(form,/Informe o índice das demais funções/);
  assert.match(form,/flatMap\(p=>p\.contribuicoes \|\| \[\]\)\.filter\(c=>c\.cargo!=="Contribuição individual"\)/);
  assert.match(form,/filter\(\(\{c\}\)=>c\.cargo!=="Contribuição individual"\)\.map/);
  assert.match(form,/\{cargo:"Contribuição individual",indice:0\}/);
  assert.match(source,/governanceRoles\(p\)/);
  assert.doesNotMatch(form,/Uma linha por pessoa\. Cargos|>Cargo<select|Remover cargo|Adicionar cargo|índice por cargo/);
  assert.match(form,/<h2[^>]*>3\. Cotas Iniciais — CI<\/h2>/);
  assert.doesNotMatch(form,/Quantidade de Cotas Iniciais do instrumento/);
  assert.doesNotMatch(form,/s\.instrumentos\.every\(r=>Number\.isFinite\(r\.cotas\)\)/);
  assert.doesNotMatch(form,/<label>CIs<BiaNumberInput/);
  assert.doesNotMatch(form,/<select aria-label=\{`Direito Econômico/);
  assert.match(form,/economicRightName\(c.cargo,p.naturezaCapital\)/);
  assert.match(form,/if\(readOnly \|\| !types.data\)return/);
  assert.ok(form.indexOf(">Adicionar função")>form.indexOf("7. Governança"));
  assert.match(form,/data-testid="bei-capital-distribution"/);
  assert.match(form,/aria-hidden="true" className="hidden grid-cols-/);
  assert.match(form,/<span className="md:sr-only">Sócio Aliado<\/span>/);
  assert.match(form,/\[&\[open\]\]:w-full/);
  assert.match(form,/label=\{`Índice \(\%\) — \$\{p.nome\} — \$\{c.cargo\}`\}/);
  assert.match(form,/<span aria-hidden="true"[^>]*>%<\/span>/);
});

test("MAP Inicial é relatório em tabela, com totais e naturezas, sem campos editáveis",()=>{
  const start=source.indexOf("export function EconomicMapPreview");
  const code=transformSync(source.slice(start,source.indexOf("type Composition",start)).replace("export function","function"),{loader:"tsx"}).code;
  const Component=new Function("React","formatBiaNumber","formatBiaPercent","natureLabel","governanceRoles","governanceLabel",code+";return EconomicMapPreview;")(React,formatBiaNumber,formatBiaPercent,(s:string)=>s.replace(/^CPP\s*(?:de\s+)?/i,""),governanceRoles,governanceLabel);
  const html=renderToStaticMarkup(React.createElement(Component,{map:{valorOrigem:100,divisorMultiplicador:3.25,participantes:[{memberId:"a",nome:"Sócio A",cargos:["Diretor","Capital"],cotasInvestimento:1,capitalComprometido:100,cppCapitalPercentual:96.75,mapPercentual:100,tipoCppCapital:{nome:"CPP Capital"},contribuicoes:[{cargo:"Diretor",indice:1.25,tipoCpp:{nome:"CPP Liderança"}},{cargo:"Capital",indice:2,tipoCpp:{nome:"CPP Liderança"}}]}]}}));
  assert.equal((html.match(/<table/g)||[]).length,2);
  assert.doesNotMatch(html,/<input|<select|<textarea/);
  assert.match(html,/96,75000%/);assert.match(html,/3,25000%/);assert.match(html,/100,00000%/);
  assert.match(html,/Diretor \/ Capital/);assert.match(html,/CPP Liderança/);
  const custom=renderToStaticMarkup(React.createElement(Component,{map:{valorOrigem:100,divisorMultiplicador:0,participantes:[],estrutura:{modalidade:"outra",descricao:"Plano específico",totalCotas:1,instrumentos:[{nome:"Entrada",valor:100,cotas:NaN}],integralizacao:{forma:"personalizado",quantidade:1,meses:0,primeiroVencimento:"2026-10-20",correcao:"IPCA"}}}}));
  assert.match(custom,/Periodicidade personalizada/);assert.match(custom,/20\/10\/2026/);assert.match(custom,/Plano específico/);
  assert.doesNotMatch(custom,/NaN|Intervalo de 0 meses/);
});
