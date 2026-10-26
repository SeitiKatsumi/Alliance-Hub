import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const source=readFileSync(new URL('./button.tsx',import.meta.url),'utf8');
const module={exports:{} as any};
new Function('require','module','exports',transformSync(source,{loader:'tsx',format:'cjs'}).code)((name:string)=>name==='@/lib/utils'?{cn:(...classes:any[])=>classes.filter(Boolean).join(' ')}:require(name),module,module.exports);
const {Button}=module.exports;

test('shared loading button shows one spinner, accessible status and blocks repeated clicks',()=>{
  let clicks=0,prevented=0;
  const props={loading:true,onClick:()=>clicks++,children:'Salvar alteração'};
  const element=Button.render(props,null);
  assert.equal(element.props.disabled,true);assert.equal(element.props['aria-busy'],true);
  element.props.onClick({preventDefault:()=>prevented++,stopPropagation:()=>{}});
  assert.equal(clicks,0);assert.equal(prevented,1);
  const html=renderToStaticMarkup(React.createElement(Button,props));
  assert.equal((html.match(/<svg/g)||[]).length,1);
  assert.match(html,/animate-spin motion-reduce:animate-none/);
  assert.match(html,/role="status">Salvando…/);
  assert.doesNotMatch(html,/Salvar alteração/);
  const done=Button.render({...props,loading:false},null);
  assert.equal(done.props.disabled,false);assert.equal(done.props['aria-busy'],undefined);
  done.props.onClick();assert.equal(clicks,1);assert.equal(done.props.children,'Salvar alteração');
  assert.equal(Button.render({...props,loading:false,disabled:true},null).props.disabled,true);
  assert.equal(Button.render({children:'Consultar','aria-busy':true},null).props['aria-busy'],true);
});

test('custom loading labels, errors returning idle, and Slot children remain compatible',()=>{
  const html=renderToStaticMarkup(React.createElement(Button,{loading:true,loadingText:'Saving…'},'Save'));
  assert.match(html,/Saving…/);
  const idle=renderToStaticMarkup(React.createElement(Button,{asChild:true},React.createElement('a',{href:'/local'},'Abrir')));
  assert.match(idle,/<a/);assert.match(idle,/href="\/local"/);assert.doesNotMatch(idle,/Salvando/);
  let clicks=0;
  const busy=Button.render({asChild:true,loading:true,children:React.createElement('a',{href:'/local',onClick:()=>clicks++},'Salvar')},null);
  busy.props.children.props.onClick({preventDefault:()=>{},stopPropagation:()=>{}});assert.equal(clicks,0);
  assert.equal(busy.props['aria-disabled'],true);
});

test('every asynchronous Save control uses explicit loading; future forms cannot omit it',()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const exempt:Record<string,string>={
    'components/bia-data-dialog.tsx':'Exportação PDF local, não persiste cadastro.',
    'components/bia-pdf-dialog.tsx':'Apenas abre diálogo de exportação.',
    'pages/relatorio-funcionalidades.tsx':'Impressão nativa local.',
    'pages/portal-localhosts.tsx':'Preferência local síncrona em localStorage.',
  };
  let controls=0;
  function scan(dir:string){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory()){scan(path);continue;}if(!path.endsWith('.tsx'))continue;
    const text=readFileSync(path,'utf8'),ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function walk(node:ts.Node){if(ts.isJsxElement(node)&&['Button','button'].includes(node.openingElement.tagName.getText(ast))&&/salvar|salvando/i.test(node.children.map(c=>c.getText(ast)).join(''))){
      const file=relative(root,path).replaceAll('\\','/');
      if(exempt[file]){assert.match(node.children.map(c=>c.getText(ast)).join(''),file.includes('portal-localhosts')?/Salvar/:/PDF/);}
      else {controls++;assert.ok(node.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(ast)==='loading'),`${file}: botão Salvar sem loading explícito`);}
    }ts.forEachChild(node,walk);}walk(ast);
  }}scan(root);assert.ok(controls>=53);
});
