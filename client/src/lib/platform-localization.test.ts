import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { createRequire } from 'node:module';
import * as runtime from './interface-locale-runtime';
import { localizedTaskDescription, localizedTaskTitle } from './agenda-interface-copy';
import { transformInterface } from '../../../scripts/interface-localization.mjs';
import { readFileSync } from 'node:fs';

test('compiled screens localize authored text, attributes and counts while preserving names and values',()=>{
  const source = `import React from 'react';
    const choices=[{label:'Nova Comunidade'}];
    export default function View({member}){return <section>
      <h1>Alianças</h1><p>{member.name}</p><p>{member.label}</p><p>{choices[0].label}</p>
      <input placeholder="Buscar por nome, sigla, país, território..." value={member.name} readOnly />
      <select defaultValue="Alianças"><option>Alianças</option></select>
      <div translate="no">Alianças</div><span>{\`\${2} comunidades ativas\`}</span></section>}
  `;
  const code=transformSync(transformInterface(source,'view.tsx')!,{loader:'tsx',format:'cjs'}).code;
  const req=createRequire(import.meta.url);
  const module:any={exports:{}};
  new Function('module','exports','require',code)(module,module.exports,(name:string)=>name==='@/lib/interface-locale-runtime'?runtime:req(name));
  for(const lang of ['es','en','pt-BR'] as const){
    const html=renderToStaticMarkup(React.createElement(runtime.InterfaceLocale.Provider,{value:lang},React.createElement(module.exports.default,{member:{name:'Alianças',label:'Nova Comunidade'}})));
    assert.ok(html.includes('<p>Alianças</p><p>Nova Comunidade</p>'));
    assert.match(html,/<option value="Alianças" selected=""/);
    assert.ok(html.includes('<div translate="no">Alianças</div>'));
    assert.ok(html.includes(({es:'<h1>Alianzas</h1>',en:'<h1>Alliances</h1>','pt-BR':'<h1>Alianças</h1>'})[lang]));
    if(lang==='es'){assert.match(html,/Nueva comunidad/);assert.match(html,/2 comunidades activas/);assert.match(html,/Buscar por nombre/);}
    if(lang==='en'){assert.match(html,/2 active communities/);assert.match(html,/Search by name/);}
  }
});
test('dashboard, communities and BIAs participate in the same Vite transformation',()=>{
  for(const [file,label] of [['painel','Seus ambientes BUILT'],['comunidade','Nova Comunidade'],['bias','MAPA DE OPERAÇÕES'],['area-aliancas','Alianças']]){
    const source=readFileSync(new URL('../pages/'+file+'.tsx',import.meta.url),'utf8'),keys=new Set<string>();
    assert.ok(transformInterface(source,file+'.tsx',key=>keys.add(key)));assert.ok(keys.has(label),file);
  }
});
test('generated reminder is translated only with the official origin; user text is preserved',()=>{
  const task={id:'x',titulo:'Pagar aporte',descricao:'Aporte de R$ 100,00 · Nova Comunidade.',contexto_tipo:'aporte_reminder',origem_tarefa_id:'flow'};
  assert.equal(localizedTaskTitle(task,'en'),'Pay contribution');
  assert.equal(localizedTaskDescription(task,'en'),'Contribution of R$ 100,00 · Nova Comunidade.');
  assert.equal(localizedTaskTitle({...task,contexto_tipo:'manual'},'en'),'Pagar aporte');
});

test('authored lists and status dictionaries localize even through filters and destructuring', () => {
  const source = `import React from 'react';
    const tabs = [{ id: 'membros', label: 'Membros' }, { id: 'politicas', label: 'Políticas' }] as const;
    const statusLabels = { open: 'Nova Comunidade' };
    export default function Screen({ member, status }) {
      return <nav>{tabs.filter(tab => tab.id).map(({id, label}) => <a key={id} href={'/' + id}>{label}</a>)}
        {['Membros', 'Políticas'].map(item => <option key={item} value={item}>{item}</option>)}
        <p>{statusLabels[status] || status}</p><b>{member.nome}</b>
      </nav>;
    }`;
  const code = transformSync(transformInterface(source, 'screen.tsx')!, {loader:'tsx', format:'cjs'}).code;
  const mod = {exports: {} as {default: React.ComponentType<any>}};
  const req = createRequire(import.meta.url);
  new Function('module','exports','require',code)(mod,mod.exports,(name: string) => name === '@/lib/interface-locale-runtime' ? runtime : req(name));
  for (const [language, members, policies] of [['en','Members','Policies'],['es','Miembros','Políticas'],['pt-PT','Membros','Políticas'],['pt-BR','Membros','Políticas']] as const) {
    const html = renderToStaticMarkup(React.createElement(runtime.InterfaceLocale.Provider,{value:language},React.createElement(mod.exports.default,{member:{nome:'Membros'}, status:'open'})));
    assert.ok(html.includes('href="/membros">'+members+'</a>'));
    assert.ok(html.includes('<option value="Políticas">'+policies+'</option>'));
    assert.ok(html.includes('<p>'+runtime.interfaceText(language)('Nova Comunidade')+'</p>'));
    assert.ok(html.includes('<b>Membros</b>'));
  }
});
