import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultPreferences} from '../../../shared/user-preferences';
import {translateInterface} from '../lib/interface-language';

test('preferences panel renders real controls in three languages, loading and error states',()=>{
  const source=readFileSync(new URL('./platform-preferences.tsx',import.meta.url),'utf8');
  let language:'pt-BR'|'en'|'es'='pt-BR',loading=false,error=false;
  const scope={React,useState:React.useState,useEffect:React.useEffect,useRef:React.useRef,
    useLocale:()=>({t:(s:string)=>translateInterface(s,language)}),
    usePreferences:()=>({data:{...defaultPreferences(),language},loading,error,reload:()=>{},save:async()=>{}}),
    emailCategories:['invites','agenda','bia','opportunities','community'],
    Mail:()=>null,Languages:()=>null,AppearanceSettings:()=>React.createElement('section',null,'Appearance'),
    Card:'section',CardHeader:'header',CardTitle:'h2',CardDescription:'p',CardContent:'div',Button:'button',
    Switch:(props:any)=>React.createElement('button',{role:'switch','aria-label':props['aria-label'],'aria-checked':props.checked,disabled:props.disabled}),
  };
  const code=transformSync(source.slice(source.indexOf('const copy =')).replace('export function','function'),{loader:'tsx'}).code;
  const Component=new Function(...Object.keys(scope),code+';return PlatformPreferences;')(...Object.values(scope));
  for(language of ['pt-BR','en','es']){
    const html=renderToStaticMarkup(React.createElement(Component));
    assert.equal((html.match(/role="switch"/g)||[]).length,5);
    assert.equal((html.match(/<option /g)||[]).length,3);
    assert.ok(html.includes(translateInterface('Salvar preferências',language)));
    assert.ok(html.includes(translateInterface('Notificações por e-mail',language)));
    assert.ok(!html.includes(translateInterface('Mensagens essenciais continuam ativas: recuperação de senha, acesso à conta, termos, decisões cadastrais e comunicações de pagamento.',language)));
    assert.match(html,/disabled/);
  }
  loading=true;assert.match(renderToStaticMarkup(React.createElement(Component)),/role="status"/);
  loading=false;error=true;const html=renderToStaticMarkup(React.createElement(Component));
  assert.match(html,/role="alert"/);assert.doesNotMatch(html,/role="switch"/);
});
