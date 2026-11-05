import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { transformSync } from 'esbuild';

test('Google Agenda: conectar, reconectar, sincronizar e desconectar exigem ação explícita', async () => {
  const source = readFileSync(new URL('./google-calendar-connection.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('google-calendar.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const componentSource = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'GoogleCalendarConnection')!.getText(ast).replace('export ', '');
  let status: any = { ready: true, connected: false, reconnect: false }, pending = false, open = false;
  const mutations: any[] = [], requests: any[] = [], assigned: string[] = [], effects: any[] = [], lists: any[] = [];
  const Button = ({ children }: any) => React.createElement('button', {}, children);
  const scope: any = { React, Button, CalendarDays: () => null, RefreshCw: () => null, Unplug: () => null,
    useState: () => [open, (value: boolean) => { open = value; }],
    Dialog: ({children, open}: any) => open ? React.createElement('div', {role:'dialog'}, children) : null,
    DialogContent: ({children}: any) => React.createElement('div', {}, children),
    DialogHeader: ({children}: any) => React.createElement('div', {}, children),
    DialogTitle: ({children}: any) => React.createElement('h2', {}, children),
    DialogDescription: ({children}: any) => React.createElement('p', {}, children),
    useToast: () => ({ toast: () => {} }), useEffect: (fn: any) => effects.push(fn),
    useQuery: (q: any) => ({ data: q.queryKey[0].endsWith('/status') ? status : { entries: [{ id: 'google:fixture' }] }, isLoading: false }),
    useMutation: (options: any) => { mutations.push(options); return { isPending: pending, mutate: () => {} }; },
    apiRequest: async (method: string, path: string) => { requests.push({ method, path }); return { json: async () => ({ redirect: '/auth/google/calendar' }) }; },
    queryClient: { invalidateQueries: () => {}, removeQueries: () => {} },
    window: { location: { assign: (url: string) => assigned.push(url), href: 'http://localhost/agenda-alertas?view=agenda' }, history: { replaceState: () => {} } },
  };
  const Component = new Function(...Object.keys(scope), transformSync(componentSource + ';return GoogleCalendarConnection;', { loader: 'tsx' }).code)(...Object.values(scope));
  const render = (compact = false) => { mutations.length = effects.length = 0; return Component({ compact, from: '2032-01-01', to: '2032-02-01', onEventsChange: (value: any) => lists.push(value) }); };
  const nodes = (el: any): any[] => el && typeof el === 'object' ? [el, ...React.Children.toArray(el.props?.children).flatMap(nodes)] : [];
  let tree = render(); effects[0](); assert.deepEqual(lists.at(-1), []); assert.equal(requests.length, 0);
  assert.match(renderToStaticMarkup(tree), /Conectar Google Agenda/);
  tree = render(true);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Conectar Google Agenda|role="dialog"/);
  effects[0](); assert.equal(requests.length, 0, 'consulta permanece ativa sem iniciar OAuth ou sincronizar');
  nodes(tree).find(n => n.props?.['data-testid'] === 'btn-google-calendar-settings').props.onClick();
  tree = render(true);
  assert.match(renderToStaticMarkup(tree), /role="dialog"/);
  assert.match(renderToStaticMarkup(tree), /Conectar Google Agenda/);
  assert.equal(requests.length, 0, 'abrir o modal não envia dados ao Google');
  const next = await mutations[0].mutationFn(); mutations[0].onSuccess(next);
  assert.deepEqual(assigned, ['/auth/google/calendar']); assert.equal(requests[0].method, 'POST');
  status = { ready: false, connected: false }; tree = render();
  assert.equal(nodes(tree).find(n => n.props?.['data-testid'] === 'connect-google-calendar').props.disabled, true);
  status = { ready: true, connected: true, reconnect: false, email: 'fixture@example.invalid', timeZone: 'Asia/Tokyo' }; tree = render(); effects[0]();
  assert.equal(lists.at(-1)[0].id, 'google:fixture');
  assert.match(renderToStaticMarkup(tree), /Sincronizar agora/); assert.match(renderToStaticMarkup(tree), /Desconectar/);
  await mutations[2].mutationFn(); mutations[2].onSuccess(); assert.equal(requests.at(-1).method, 'DELETE'); assert.deepEqual(lists.at(-1), []);
  status.reconnect = true; tree = render(); assert.match(renderToStaticMarkup(tree), /Reconectar Google Agenda/);
  pending = true; tree = render(); assert.ok(nodes(tree).filter(n => n.type === Button).every(n => n.props.disabled));
});

test('eventos externos abrem no Google e não passam pela edição/mutação da BUILT', () => {
  const source = readFileSync(new URL('../pages/agenda.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('agenda.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler = '';
  function visit(n: ts.Node) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'openAction') handler = n.getText(ast); else ts.forEachChild(n, visit); }
  visit(ast);
  const calls: any[] = [];
  const scope = { window: { open: (...args: any[]) => calls.push(args) }, toast: () => {}, agendaSourceAction: () => { throw Error('Não deve usar fonte BUILT'); }, openEdit: () => { throw Error('Não deve editar tarefa'); }, navigate: () => {} };
  const open = new Function(...Object.keys(scope), transformSync(handler + ';return openAction;', { loader: 'ts' }).code)(...Object.values(scope));
  open({ google_event: true, google_url: 'https://calendar.google.com/calendar/event?eid=fixture' });
  assert.deepEqual(calls[0], ['https://calendar.google.com/calendar/event?eid=fixture', '_blank', 'noopener,noreferrer']);
  assert.match(source, /!tarefa.google_event && <button/);
  assert.match(source, /tarefa.google_event \? <Button[^>]*onClick=\{\(\) => openAction\(tarefa\)\}/);
  assert.match(source, /return tarefas.reduce<Record<AgendaStatus, number>>/);
});
