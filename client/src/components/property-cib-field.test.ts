import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {normalizePropertyCib} from '../../../shared/property-cib';

test('campo CIB está identificado como opcional e não cria requisito em cadastro novo ou antigo',()=>{
 const source=readFileSync(new URL('./property-cib-field.tsx',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
 const Field=new Function('React','useId','useState','Input','Label','normalizePropertyCib',transformSync(source,{loader:'tsx'}).code+';return PropertyCibField;')(React,React.useId,React.useState,'input','label',normalizePropertyCib);
 const render=(value?:string)=>renderToStaticMarkup(React.createElement(Field,{value,onChange:()=>{}}));
 assert.match(render(),/CIB \(opcional\)/);assert.doesNotMatch(render(),/required=/);assert.match(render(),/value=""/);
 assert.match(render('0012345-6'),/value="0012345-6"/);
 const manual=readFileSync(new URL('../pages/carteira.tsx',import.meta.url),'utf8'),assistant=readFileSync(new URL('../pages/carteira-assistente.tsx',import.meta.url),'utf8');
 assert.match(manual,/<PropertyCibField value=\{form.cib\}/);assert.match(assistant,/<PropertyCibField value=\{draft.cib\}/);
 assert.match(manual,/imovel.cib&&<p[^>]+>CIB:/);
});
