import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {ACCOUNT_AREAS, ACCOUNT_AREA_KEYS, inheritsArea} from '../../../shared/account-areas';
import {ACCOUNT_ACCESS_PRESETS} from '../../../shared/account-access-profiles';

test('seletor exibe todos os perfis reais, identifica funcionário contextual e aguarda aplicar',()=>{
 const source=readFileSync(new URL('./account-profile-picker.tsx',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
 const Picker=new Function('React','Button','ModuleInfo','ACCOUNT_ACCESS_PRESETS','ACCOUNT_AREAS','ACCOUNT_AREA_KEYS','inheritsArea','useState','Check','ChevronDown','Popover','PopoverContent','PopoverTrigger',transformSync(source,{loader:'tsx'}).code+';return AccountProfilePicker;')(React,({loading,...props}:any)=>React.createElement('button',{...props,disabled:props.disabled||loading},loading?'Salvando…':props.children),({description}:any)=>React.createElement('button',{'aria-label':'Informações'},description),ACCOUNT_ACCESS_PRESETS,ACCOUNT_AREAS,ACCOUNT_AREA_KEYS,inheritsArea,()=>[false,()=>{}],()=>null,()=>null,({children}:any)=>React.createElement('div',null,children),({children}:any)=>React.createElement('div',null,children),({children}:any)=>children);
 const html=(saving=false,role="admin")=>renderToStaticMarkup(React.createElement(Picker,{value:role,choices:{agenda:'deny'},dirty:false,saving,onSelect:()=>{},onApply:()=>{}}));
 assert.match(html(),/Superadmin · Administração/); assert.match(html(),/aria-pressed="true"/);
 assert.match(html(),/Gestor da plataforma/);assert.doesNotMatch(html(),/<option[^>]+value="coproprietario"/);
 assert.doesNotMatch(html(),/<details open/); assert.doesNotMatch(html(),/>Herdar|>Permitir<|>Bloquear</); assert.match(html(),/Informações/); assert.match(html(),/Personalizar acesso por área/); assert.match(html(),/<option value="deny" selected="">Restrito/);
 for (const profile of ACCOUNT_ACCESS_PRESETS) assert.ok(html(false,profile.value).includes(profile.description));
 assert.match(html(),/<button[^>]*disabled=""/);
 assert.match(html(true),/<button[^>]*id="member-access-profile"[^>]*disabled=""/);
 assert.match(html(true),/Salvando…/);
});
