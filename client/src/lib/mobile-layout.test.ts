import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('navigation resets the shell scroll and window without touching data', () => {
  const source = read('./content-scroll.ts');
  const calls: unknown[] = [];
  const reset = new Function('document', 'window', transformSync(source.replace('export function', 'function'), {loader:'ts'}).code + ';return resetContentScroll;')(
    {querySelector: (selector: string) => { assert.equal(selector, '[data-app-scroll]'); return {scrollTo: (value: unknown) => calls.push(value)}; }},
    {scrollTo: (value: unknown) => calls.push(value)},
  );
  reset();
  assert.deepEqual(calls, [{top:0,left:0,behavior:'instant'}, {top:0,left:0,behavior:'instant'}]);
  assert.match(read('../App.tsx'), /useEffect\(\(\) => \{ resetContentScroll\(\); \}, \[location\]\)/);
  assert.equal((read('../pages/meu-perfil.tsx').match(/requestAnimationFrame\(resetContentScroll\)/g) || []).length, 2);
});

test('mobile forms constrain grid/select intrinsic widths and stack date/actions', () => {
  assert.match(read('../components/ui/dialog.tsx'), /grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(read('../components/ui/select.tsx'), /w-full min-w-0/);
  assert.match(read('../components/ui/select.tsx'), /\[&>span\]:truncate/);
  const finance = read('../pages/fluxo-caixa.tsx');
  assert.match(finance, /grid grid-cols-1 gap-3 sm:grid-cols-2[\s\S]*?Vencimento/);
  const members = read('../pages/membros.tsx');
  assert.match(members, /<footer className="[^"]*bg-background/);
  assert.match(members, /flex w-full min-w-0 flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row/);
});

test('mobile navigation and summary do not center overflowing content', () => {
  assert.match(read('../components/app-sidebar.tsx'), /closest\('a, button'\)\) setOpenMobile\(false\)/);
  assert.match(read('../pages/agenda-alertas.tsx'), /grid min-w-0 grid-cols-1 gap-6/);
  assert.match(read('../pages/agenda-alertas.tsx'), /flex flex-wrap items-center justify-between/);
  assert.match(read('../pages/nucleo-capital.tsx'), /grid-cols-2 gap-1 bg-muted\/60 p-1 sm:grid-cols-4/);
  assert.match(read('../pages/bias.tsx'), /left-4 right-28/);
});

test('status queries terminate and branded dialog helper text remains readable', () => {
  const status = read('../components/asaas-status.tsx');
  assert.match(status, /AbortSignal.timeout\(15_000\)/);
  const dashboard = read('../components/asaas-bank-dashboard.tsx');
  assert.equal((status.match(/retry: false/g) || []).length, 3); // Duas consultas e a atualização explícita da conta.
  assert.match(dashboard, /retry: false/);
  assert.match(dashboard, /setTimeout\(cancel, 45_000\)/);
  assert.match(dashboard, /clearTimeout\(timer\)/);
  assert.match(status, /AbortSignal.timeout\(25_000\)/);
  assert.match(read('../pages/vitrine.tsx'), /vitrine-ad-dialog/);
  assert.match(read('../index.css'), /vitrine-ad-dialog[^\n]*color: #bdc9d7/);
});

test('financial selection retains identity when repeated data does not remove items', () => {
  const source = read('../pages/fluxo-caixa.tsx');
  const body = source.match(/setSelectedLancamentoIds\(\(current\) => \{\s*const next = current.filter[\s\S]*?\n    \}\);/)?.[0];
  assert.ok(body);
  const run = new Function('setSelectedLancamentoIds', 'fluxoItemsAll', body);
  let current = ['a'];
  const original = current;
  const setter = (update: (value: string[]) => string[]) => {current = update(current);};
  run(setter, [{id:'a'}]); run(setter, [{id:'a'}]);
  assert.equal(current, original);
  run(setter, []);
  assert.deepEqual(current, []);
  const empty = current;
  run(setter, []);
  assert.equal(current, empty);
});
