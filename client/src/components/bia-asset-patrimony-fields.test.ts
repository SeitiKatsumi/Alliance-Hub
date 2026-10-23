import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {legacyBiaSetup} from '../../../shared/bia-setup';

test('campos de fração e dívida respeitam modo leitura, referências e consórcios; resumo preserva zero',()=>{
 const source=readFileSync(new URL('./bia-asset-patrimony-fields.tsx',import.meta.url),'utf8');
 const code=source.replace(/^import .*;\r?\n/gm,'').replace(/export function/g,'function');
 const numberInput=({label,value}:any)=>React.createElement('input',{'aria-label':label,value:Number.isFinite(value)?value:'',readOnly:true});
 const [Fields,Summary]=new Function('React','BiaNumberInput',transformSync(code,{loader:'tsx'}).code+';return [BiaAssetPatrimonyFields,BiaAssetPatrimonySummary];')(React,numberInput);
 const value=legacyBiaSetup({info_comercial:{ativo_endereco:'Ativo'}}),asset=value.ativos[0];
 const render=(overrides={})=>renderToStaticMarkup(React.createElement(Fields,{asset,onChange:()=>{},moeda:'BRL',...overrides}));
 assert.match(render(),/Participação da BIA no imóvel/);assert.match(render(),/Dívida total do imóvel/);assert.match(render({disabled:true}),/<fieldset disabled/);
 assert.match(render(),/sm:grid-cols-2/);
 for(const patch of [{carteiraImovelId:'private'},{tipo:'consorcio'}])assert.equal(render({asset:{...asset,...patch}}),'');
 const summary=()=>renderToStaticMarkup(React.createElement(Summary,{value,moeda:'BRL'}));
 assert.equal(summary(),'');Object.assign(asset,{participacaoBiaPercentual:50,dividaSaldo:0});
 assert.match(summary(),/50%/);assert.match(summary(),/0,00/);assert.match(summary(),/data-pdf-section/);
 const integration=readFileSync(new URL('./bia-setup-fields.tsx',import.meta.url),'utf8');
 assert.match(integration,/<BiaAssetPatrimonyFields asset=\{a\}/);assert.match(integration,/<BiaAssetPatrimonySummary value=\{value\}/);
});
