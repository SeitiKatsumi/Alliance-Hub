import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import { EMPTY_RO_PULSE, RoPulseExplanation, RoPulseSetup } from './ro-pulse-setup';

test('selecionar todas inclui apenas comunidades disponíveis por etapa, sem duplicação, e limpar preserva origem fixa', () => {
  let value = { intervalo_horas: 9, comunidades: { regional: [] as string[], nacional: [] as string[], global: [] as string[] } };
  const communities: any[] = [{ id:'o',nome:'Origem',stage:'origem' },{ id:'r',nome:'Regional',stage:'regional' },{ id:'r',nome:'Regional repetida',stage:'regional' },{ id:'n',nome:'Nacional',stage:'nacional' },{ id:'g',nome:'Global',stage:'global' }];
  const nodes = (n:any):any[] => n && typeof n==='object' ? [n,...React.Children.toArray(n.props?.children).flatMap(nodes)] : [];
  const render = (disabled=false) => RoPulseSetup({id:'all',value,communities,disabled,onChange:v=>value=v});
  let tree=render();
  nodes(tree).find(n=>n.props?.children==='Selecionar todas as comunidades').props.onClick();
  assert.deepEqual(value,{intervalo_horas:9,comunidades:{regional:['r'],nacional:['n'],global:['g']}});
  tree=render();nodes(tree).find(n=>n.props?.children==='Limpar seleção').props.onClick();
  assert.deepEqual(value.comunidades,{regional:[],nacional:[],global:[]});
  assert.equal(nodes(render()).find(n=>n.props?.['data-testid']==='ro-pulse-community-o').props.checked,true);
  assert.equal(nodes(render(true)).find(n=>n.props?.children==='Selecionar todas as comunidades').props.disabled,true);
});


test('formulário de criação explica o Pulso, permite optar e trata carregamento/erro sem iniciar envio', () => {
  const source = readFileSync(new URL('./ro-pulse-creation.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('creation.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'RoPulseCreation')!;
  let value: any = null, loading = false, error = false, retries = 0, query: any;
  const Button = ({ children, ...props }: any) => React.createElement('button', props, children);
  const Checkbox = (props: any) => React.createElement('input', { type: 'checkbox', checked: props.checked, disabled: props.disabled, readOnly: true });
  const scope = { React, Button, Checkbox, EMPTY_RO_PULSE, RoPulseExplanation, RoPulseSetup, useId: () => 'test-interval',
    useQuery: (options: any) => { query = options; return { data: [{ id: 'o', nome: 'Origem', stage: 'origem' }], isPending: loading, isError: error, refetch: () => retries++ }; }, apiRequest: () => { throw Error('Render não envia solicitações'); } };
  const component = new Function(...Object.keys(scope), transformSync(declaration.getText(ast).replace(/^export /, '') + '; return RoPulseCreation;', { loader: 'tsx' }).code)(...Object.values(scope));
  const render = (communityId = 'o', disabled = false) => component({ communityId, value, onChange: (v: any) => value = v, disabled });
  const nodes = (n: any): any[] => n && typeof n === 'object' ? [n, ...React.Children.toArray(n.props?.children).flatMap(nodes)] : [];
  let tree = render();
  assert.equal(query.enabled, false);
  const text = renderToStaticMarkup(tree);
  assert.match(text, /Atualizações e um e-mail/); assert.match(text, /preferências/); assert.match(text, /regionais, nacionais e globais/);
  nodes(tree).find(n => n.type === Checkbox).props.onCheckedChange(true);
  assert.deepEqual(value, EMPTY_RO_PULSE);
  loading = true; assert.match(renderToStaticMarkup(render()), /Carregando comunidades/); assert.equal(query.enabled, true);
  loading = false; error = true; tree = render(); assert.match(renderToStaticMarkup(tree), /Não foi possível carregar/);
  nodes(tree).find(n => n.type === Button).props.onClick(); assert.equal(retries, 1);
  error = false; tree = render(); const setup = nodes(tree).find(n => n.type === RoPulseSetup);
  setup.props.onChange({ ...value, intervalo_horas: 9 }); assert.equal(value.intervalo_horas, 9);
  assert.match(renderToStaticMarkup(render()), /4 horas depois/);
  nodes(render()).find(n => n.type === Checkbox).props.onCheckedChange(false); assert.equal(value, null);
  assert.equal(nodes(render('', true)).find(n => n.type === Checkbox).props.disabled, true);
});

test('mutação real da criação envia configuração opcional em uma requisição e não cria Pulso no perfil de funcionário', async () => {
  const source = readFileSync(new URL('../pages/network-opportunities.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('hub.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let mutation: ts.Node | undefined;
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'createMeeting') {
      const call = n.initializer as ts.CallExpression;
      const options = call.arguments[0] as ts.ObjectLiteralExpression;
      mutation = options.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'mutationFn');
    }
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(mutation);
  const expression = (mutation as ts.PropertyAssignment).initializer.getText(ast);
  for (const [config, employee] of [[null, false], [EMPTY_RO_PULSE, false], [EMPTY_RO_PULSE, true]] as const) {
    const calls: any[] = [];
    const scope = { meetingForm: { titulo: 'Teste', focus_mode: 'general', strategic_cell_id: 'old', end_at: '' }, meetingPulse: config,
      meQuery: { data: { company_employee: employee } }, apiRequest: async (...args: any[]) => { calls.push(args); return { json: async () => ({ id: 'created' }) }; } };
    const fn = new Function(...Object.keys(scope), transformSync('return (' + expression + ');', { loader: 'tsx' }).code)(...Object.values(scope));
    await fn(); assert.equal(calls.length, 1); assert.equal(calls[0][1], '/api/reunioes-oportunidades');
    assert.deepEqual(calls[0][2].pulso, employee ? null : config);
    assert.equal(calls[0][2].strategic_cell_id, null);
  }
});
