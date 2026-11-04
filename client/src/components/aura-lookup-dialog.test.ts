import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import { auraLookupState, isBuiltMemberForAura } from '../lib/aura-access';
test('modal compartilhado mostra filtros na ordem solicitada e expande10 por vez mantendo busca, permissões, fechamento e seleção', () => {
    const source = readFileSync(new URL('./aura-lookup-dialog.tsx', import.meta.url), 'utf8'), ast = ts.createSourceFile('dialog.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const functions = ast.statements.filter(ts.isFunctionDeclaration).map(n => n.getText(ast).replace(/^export /, ''));
    const people = Array.from({ length: 65 }, (_, i) => ({ id: String(i), nome: `Pessoa ${String(i).padStart(2, '0')}`, empresa: 'Empresa', cargo: 'Engenheiro', foto: null }));
    people[1].nome = '  Abner';
    const states: any[] = [], effectDeps: any[] = [];
    let index = 0, effectIndex = 0, dirty = false, effects: Array<() => void> = [], selected: any, opened = true, failed = false, loading = false, restore = 0;
    const user = { id: 'user', role: 'membro', membro_directus_id: 'self' };
    const Button = ({ children, ...props }: any) => React.createElement('button', props, children), Input = (props: any) => React.createElement('input', props);
    const Dialog = ({ open, children }: any) => open ? React.createElement('div', {}, children) : null;
    const Box = ({ children, onCloseAutoFocus, ...props }: any) => React.createElement('div', props, children);
    const queries: any[] = [];
    const scope: any = { React, auraLookupState, isBuiltMemberForAura, Button, Input, Dialog, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box, Skeleton: Box, Search: () => null, ChevronRight: () => null, ChevronDown: () => null, useMemo: (fn: any) => fn(), useState: (initial: any) => { const id = index++; if (!(id in states))
            states[id] = initial; return [states[id], (v: any) => { const next = typeof v === 'function' ? v(states[id]) : v; if (!Object.is(next, states[id])) {
                states[id] = next;
                dirty = true;
            } }]; }, useEffect: (fn: any, deps: any[]) => { const id = effectIndex++; if (!effectDeps[id] || deps.some((v, i) => !Object.is(v, effectDeps[id][i]))) {
            effectDeps[id] = deps;
            effects.push(fn);
        } }, useQuery: (options: any) => { queries.push(options); const key = options.queryKey[0]; return { data: key.endsWith('/vinculos') ? ['1', '2'] : key.endsWith('/minhas-avaliacoes') ? { dadas: [{ avaliado_membro_id: '2' }] } : options.queryKey[2] ? [people[1], people[2]] : [...people, { id: 'self', nome: 'Meu perfil', foto: null }], isPending: false, isLoading: key.endsWith('/busca') && loading, isError: failed && key.endsWith('/busca'), refetch: () => { } }; } };
    const component = new Function(...Object.keys(scope), transformSync(functions.join('\n') + '\nreturn AuraLookupDialog;', { loader: 'tsx' }).code)(...Object.values(scope));
    const render = () => { let tree: any; for (let i = 0; i < 4; i++) {
        index = effectIndex = 0;
        dirty = false;
        effects = [];
        tree = component({ user, open: opened, onOpenChange: (v: boolean) => opened = v, onSelect: (v: any) => selected = v, restoreFocus: () => restore++ });
        effects.forEach(fn => fn());
        if (!dirty)
            return tree;
    } throw Error('Efeito sem estabilização'); };
    const nodes = (el: any): any[] => el && typeof el === 'object' ? [el, ...React.Children.toArray(el.props?.children).flatMap(nodes)] : [];
    const memberButtons = (tree: any) => nodes(tree).filter(n => n.props?.['data-testid']?.startsWith('btn-consultar-aura-membro-'));
    let tree = render();
    assert.equal(memberButtons(tree).length, 1);
    assert.equal(nodes(tree).find(n => n.type === Button && n.props.children === 'Posso avaliar').props['aria-pressed'], true);
    assert.equal(queries.at(-1).queryKey[2], true, 'abertura consulta elegíveis no servidor');
    nodes(tree).find(n => n.type === Button && n.props.children === 'Todos os membros').props.onClick();
    tree = render();
    assert.equal(memberButtons(tree).length, 10);
    assert.deepEqual(nodes(tree).filter(n => n.type === Button && ['Posso avaliar', 'Todos os membros'].includes(n.props.children)).map(n => n.props.children), ['Posso avaliar', 'Todos os membros']);
    assert.equal(memberButtons(tree)[0].props['data-testid'], 'btn-consultar-aura-membro-1');
    assert.match(renderToStaticMarkup(tree), /55 restantes/);
    assert.match(renderToStaticMarkup(tree), /Pode avaliar/);
    assert.match(renderToStaticMarkup(tree), /Já avaliado por você/);
    for (const count of [20, 30, 40, 50, 60, 65]) {
        nodes(tree).find(n => n.type === Button && String(n.props.children[0]).startsWith('Ver mais')).props.onClick();
        tree = render();
        assert.equal(memberButtons(tree).length, count);
    }
    assert.ok(!nodes(tree).some(n => n.type === Button && String(n.props.children[0]).startsWith('Ver mais')));
    nodes(tree).find(n => n.type === Input).props.onChange({ target: { value: 'abner' } });
    tree = render();
    assert.equal(memberButtons(tree).length, 1);
    nodes(tree).find(n => n.type === Input).props.onChange({ target: { value: '' } });
    tree = render();
    assert.equal(memberButtons(tree).length, 10);
    nodes(tree).find(n => n.type === Button && n.props.children === 'Posso avaliar').props.onClick();
    tree = render();
    assert.equal(memberButtons(tree).length, 1);
    memberButtons(tree)[0].props.onClick();
    assert.equal(opened, false);
    assert.equal(selected.id, '1');
    render();
    opened = true;
    tree = render();
    assert.equal(memberButtons(tree).length, 1);
    nodes(tree).find(n => n.type === Button && n.props.children === 'Todos os membros').props.onClick();
    tree = render();
    opened = false;
    render();
    opened = true;
    tree = render();
    assert.equal(nodes(tree).find(n => n.type === Button && n.props.children === 'Posso avaliar').props['aria-pressed'], true, 'reabrir restaura elegíveis mesmo após selecionar Todos');
    assert.equal(memberButtons(tree).length, 1);
    nodes(tree).find(n => n.type === Button && n.props.children === 'Todos os membros').props.onClick();
    tree = render();
    assert.equal(memberButtons(tree).length, 10);
    let prevented = false;
    nodes(tree).find(n => n.props?.onCloseAutoFocus).props.onCloseAutoFocus({ preventDefault: () => prevented = true });
    assert.equal(restore, 1);
    assert.equal(prevented, true);
    failed = true;
    assert.match(renderToStaticMarkup(render()), /Não foi possível buscar os membros/);
    failed = false;
    loading = true;
    assert.equal(memberButtons(render()).length, 0);
    loading = false;
    opened = false;
    render();
    assert.ok(queries.slice(-3).every(q => q.enabled === false), 'fechado não dispara consultas');
});
test('ação rápida abre localmente e mantém bloqueio de acesso para quem não é membro', () => {
    const source = readFileSync(new URL('../pages/painel.tsx', import.meta.url), 'utf8'), ast = ts.createSourceFile('painel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let handler = '';
    function visit(n: ts.Node) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'goToAuraRegister') {
        handler = n.getText(ast);
        return;
    } ts.forEachChild(n, visit); }
    visit(ast);
    assert.ok(handler);
    for (const member of [true, false]) {
        const calls: any[] = [];
        const values: any = { user: member ? { role: 'membro' } : { role: 'user' }, isBuiltMemberForAura, environmentAccessFor: () => ({ canAccess: false }), setBlockedAccess: () => calls.push('blocked'), setAuraLookupOpen: (v: boolean) => calls.push(v), navigate: () => calls.push('navigate') };
        new Function(...Object.keys(values), transformSync(handler + ';goToAuraRegister();', { loader: 'ts' }).code)(...Object.values(values));
        assert.deepEqual(calls, member ? [true] : ['blocked']);
    }
    assert.doesNotMatch(source, /\/aura\?registrar=1/);
    assert.match(source, /<AuraLookupDialog user=\{user\} open=\{auraLookupOpen\}/);
    const aura = readFileSync(new URL('../pages/aura.tsx', import.meta.url), 'utf8');
    assert.match(aura, /<AuraLookupDialog user=\{user\} open=\{lookupOpen\}/);
});
