import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {ACCOUNT_ACCESS_PRESETS} from '../../../shared/account-access-profiles';

test('seletor exibe todos os perfis reais, identifica funcionário contextual e aguarda aplicar',()=>{
 const source=readFileSync(new URL('./account-profile-picker.tsx',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
 const Picker=new Function('React','Button','ACCOUNT_ACCESS_PRESETS',transformSync(source,{loader:'tsx'}).code+';return AccountProfilePicker;')(React,({loading,...props}:any)=>React.createElement('button',{...props,disabled:props.disabled||loading},loading?'Salvando…':props.children),ACCOUNT_ACCESS_PRESETS);
 const html=(saving=false)=>renderToStaticMarkup(React.createElement(Picker,{value:'admin',dirty:false,saving,onSelect:()=>{},onApply:()=>{}}));
 assert.match(html(),/<option value="admin" selected="">Superadmin · Administração/);
 assert.match(html(),/Gestor da plataforma/);assert.match(html(),/Coproprietário · consulta compartilhada/);
 assert.match(html(),/<option disabled="">Funcionário · acesso definido pela empresa/);
 assert.match(html(),/<button[^>]*disabled=""/);
 assert.match(html(true),/<select[^>]*disabled=""/);
 assert.match(html(true),/Salvando…/);
});
