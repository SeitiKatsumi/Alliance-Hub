import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('percepção abre diretamente mantendo restrição, conferência e avaliação já registrada', () => {
  const source = readFileSync(new URL('./aura.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('aura.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let card: ts.JsxElement | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(ast) === 'data-testid' && p.initializer?.getText(ast) === '"card-avaliar"')) card = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(card);
  assert.doesNotMatch(card.getText(ast), /Registrar percepção|Fechar registro|registrationOpen/);
  const content = card.children.find(n => ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'CardContent') as ts.JsxElement;
  assert.ok(content);
  const className = content.openingElement.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === 'className') as ts.JsxAttribute;
  assert.equal(className.initializer?.getText(ast), '"space-y-4"', 'conteúdo não espera outro clique nem fica oculto');
  const expression = (content.children.find(ts.isJsxExpression) as ts.JsxExpression).expression!;
  const names = ['loadingLinks', 'checkingSelectedEvaluation', 'linksError', 'selectedEvaluationError', 'canRegisterSelectedAura', 'selectedMembro'];
  const branch = (values: unknown[]) => {
    let node = expression;
    while (ts.isConditionalExpression(node)) {
      const condition = new Function(...names, `return (${node.condition.getText(ast)});`)(...values);
      node = condition ? node.whenTrue : node.whenFalse;
      while (ts.isParenthesizedExpression(node)) node = node.expression;
    }
    return node.getText(ast);
  };
  assert.match(branch([true, false, false, false, true, {}]), /Conferindo permissão/);
  assert.match(branch([false, true, false, false, true, {}]), /Conferindo permissão/);
  assert.match(branch([false, false, true, false, true, {}]), /Não foi possível conferir/);
  assert.match(branch([false, false, false, true, true, {}]), /Não foi possível conferir/);
  assert.match(branch([false, false, false, false, false, {}]), /Registro restrito/);
  const eligible = branch([false, false, false, false, true, { id: 'target' }]);
  assert.match(eligible, /input-palavra/);
  assert.match(eligible, /minhaAvaliacaoDoSelecionado && minhaAvaliacaoDoSelecionado.palavras.length > 0/);
  assert.match(eligible, /Avaliação enviada/);
  assert.match(eligible, /Sua avaliação não pode ser alterada/);
});
