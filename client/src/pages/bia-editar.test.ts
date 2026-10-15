import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import {BIA_CREATION_STEPS} from '../../../shared/bia-setup';

test('edição reutiliza oito áreas, mantém editores montados e salva somente identidade',()=>{
  const source=readFileSync(new URL('./bias.tsx',import.meta.url),'utf8');
  const ast=ts.createSourceFile('bias.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let fields='',tabs='',validation='';
  function visit(n:ts.Node){
    if(ts.isVariableDeclaration(n)&&n.initializer){if(n.name.getText(ast)==='IDENTITY_FIELDS')fields=n.initializer.getText(ast);if(n.name.getText(ast)==='EDIT_TABS')tabs=n.initializer.getText(ast);}
    if(ts.isFunctionDeclaration(n)&&n.name?.text==='getMissingRequiredFields')validation=n.getText(ast);
    ts.forEachChild(n,visit);
  }visit(ast);
  const identity=new Function(transformSync(`return ${fields}`,{loader:'ts'}).code)();
  const sections=new Function(`return ${tabs}`)();
  assert.equal(sections.length,BIA_CREATION_STEPS.length);
  assert.ok(identity.includes('nome_bia'));
  for(const key of ['situacao','autor_bia','aliado_built','diretor_alianca','valor_origem','socios_guardioes','valor_geral_venda_vgv'])assert.equal(identity.includes(key),false,key);
  const missing=(nome:string)=>new Function('page','form',transformSync(validation,{loader:'ts'}).code+';return getMissingRequiredFields();')(true,{nome_bia:nome});
  assert.deepEqual(missing('Nome'),[],'edição cadastral não exige ativo legado completo');
  assert.deepEqual(missing('  '),['Nome da BIA']);
  assert.match(source,/biaId && !structuredInfo && !page/,'editor novo não regrava info-comercial legado');
  assert.match(source,/value="equipe" forceMount/,'BEI não desmonta ao trocar de área');
  assert.match(source,/hidden=\{activeTab!=="juridico" && activeTab!=="ativos" && activeTab!=="orcamento"\}/);
  assert.match(source,/BiaMapHistory biaId=\{bia.id\} initialOnly/);
  assert.match(source,/useUnsavedChanges\(identityDirty/);
  const editor=source.slice(source.indexOf('<BiaFormSurface page={page}'),source.indexOf('</BiaFormSurface>'));
  assert.doesNotMatch(editor,/>Continuar|EDIT_TABS\.indexOf\(activeTab\)\s*[+-]\s*1|index\+1|xl:grid-cols-8/);
  assert.match(editor,/EDIT_LABELS\.map/);
  assert.match(editor,/lg:grid-cols-4/);
  assert.match(editor,/flex flex-col items-start gap-3 sm:flex-row sm:items-center/,'cover controls stack on mobile');
  assert.match(source,/const EDIT_LABELS = \[\.\.\.BIA_CREATION_STEPS\.slice\(0,6\), "Resumo", "Situação"\]/);
  const saveCondition=editor.match(/\{(!readOnly && [^\n]+) && <Button\s*\n\s*onClick=\{handleSaveClick\}/)?.[1];
  assert.ok(saveCondition);
  const showsSave=(page:boolean,readOnly:boolean,activeTab:string)=>new Function('page','readOnly','activeTab',`return ${saveCondition}`)(page,readOnly,activeTab);
  for(const tab of sections){
    assert.equal(showsSave(true,false,tab),tab==='geral'||tab==='revisao','identity save stays scoped to identity and summary');
    assert.equal(showsSave(true,true,tab),false);
  }
  assert.equal(showsSave(false,false,'info'),true,'legacy modal keeps its save');
  assert.match(editor,/\(page && !identityDirty\)/);
  const page=readFileSync(new URL('./bia-editar.tsx',import.meta.url),'utf8');
  assert.match(page,/hasBiaAccess\(permissions,"configuracao_bia","view"\)/);
  assert.match(page,/readOnly=\{!hasBiaAccess\(permissions,"configuracao_bia","edit"\)\}/);
});
