import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBiaSetup, biaAssetFromPortfolio } from '../../../shared/bia-setup';
import { mergeSetupEdits, keepDraftHandoff, takeDraftHandoff, draftSectionStep } from './bia-draft-handoff';
import { readFileSync } from 'node:fs';

test('draft handoff preserves untouched draft fields and transfers only local changes',()=>{
  const base=emptyBiaSetup();base.ativosIndefinidos=false;base.ativos=[biaAssetFromPortfolio({id:'one',nome:'Casa'})];
  const edit=structuredClone(base),draft=structuredClone(base);
  edit.ativos[0].valorReferencia=123;
  draft.ativos[0].nome='Nome atualizado';draft.juridico.responsavel='Responsável do rascunho';
  const result=mergeSetupEdits(base,edit,draft);
  assert.equal(result.ativos[0].valorReferencia,123);assert.equal(result.ativos[0].nome,'Nome atualizado');
  assert.equal(result.juridico.responsavel,'Responsável do rascunho');
  assert.equal(base.ativos[0].valorReferencia,null);
  draft.ativos[0].valorReferencia=456;
  assert.throws(()=>mergeSetupEdits(base,edit,draft),/mesmo campo/);
});
test('draft handoff handles asset additions/removals, no changes and cross-BIA isolation',()=>{
  const base=emptyBiaSetup();base.ativosIndefinidos=false;base.ativos=[biaAssetFromPortfolio({id:'one',nome:'Casa'})];
  const edit=structuredClone(base),draft=structuredClone(base);edit.ativos=[];
  assert.equal(mergeSetupEdits(base,edit,draft).ativos.length,0);
  draft.ativos.push(biaAssetFromPortfolio({id:'two',nome:'Outra'}));
  assert.equal(mergeSetupEdits(base,base,draft).ativos.length,2);
  keepDraftHandoff('a',{setup:edit,revision:7});assert.equal(takeDraftHandoff('b'),undefined);
  assert.equal(takeDraftHandoff('a')?.revision,7);assert.equal(takeDraftHandoff('a'),undefined);
  assert.equal(draftSectionStep('ativos'),4);assert.equal(draftSectionStep('juridico'),3);assert.equal(draftSectionStep('orcamento'),5);assert.equal(draftSectionStep('invalid'),0);
});
test('editor preflights draft before writes; destination keeps revision and original saved baseline',()=>{
  const editor=readFileSync('client/src/components/bia-setup-panel.tsx','utf8');
  assert.ok(editor.indexOf('const draft=await readOpenBiaDraft')<editor.indexOf("apiRequest('PUT'"));
  assert.match(editor,/if\(draft\)\{await continueDraft\(draft\);return;\}/);
  assert.match(editor,/draft.conclusao_iniciada/);
  assert.match(editor,/queryClient.setQueryData\(\['\/api\/bias',biaId,'rascunho'\],draft\)/);
  const destination=readFileSync('client/src/pages/bia-nova.tsx','utf8');
  assert.match(destination,/setSaved\(JSON.stringify\(restored\)\)/);
  assert.match(destination,/setRevision\(handoff\?\.revision \?\? draft.data.revisao\)/);
});
