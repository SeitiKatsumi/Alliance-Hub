import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { transformSync } from "esbuild";

function harness(overrides: Record<string,unknown> = {}) {
  const state:any[]=[];let cursor=0;
  const module={exports:{} as any};
  const code=transformSync(readFileSync(new URL("./initial-beneficiary-field.tsx",import.meta.url),"utf8"),{loader:"tsx",format:"cjs",jsx:"automatic"}).code;
  const require=(id:string)=>id==="react"?{...React,useState:(value:any)=>{const index=cursor++;if(!(index in state))state[index]=value;return[state[index],(next:any)=>state[index]=typeof next==="function"?next(state[index]):next];}}:id==="react/jsx-runtime"?ReactJsx:id.includes("button")?{Button:"button"}:id.includes("checkbox")?{Checkbox:"checkbox"}:{Input:"input"};
  new Function("require","module","exports",code)(require,module,module.exports);
  const changed:string[]=[];const drafts:boolean[]=[];const names:string[]=[];
  const props={value:"member",options:[{id:"member",nome:"Participante"}],locked:false,disabled:false,onChange:(id:string)=>changed.push(id),onDraftChange:(v:boolean)=>drafts.push(v),onCreate:async(name:string)=>{names.push(name);return{id:"external",nome:name};},...overrides};
  const render=()=>{cursor=0;return module.exports.InitialBeneficiaryField(props);};
  const nodes=(node:any):any[]=>!node || typeof node!=="object"?[]:[node,...React.Children.toArray(node.props?.children).flatMap(nodes)];
  const find=(type:string,text?:string)=>nodes(render()).find(n=>n.type===type && (!text || n.props.children===text));
  return{props,changed,drafts,names,find,nodes,render};
}
import * as ReactJsx from "react/jsx-runtime";

test("beneficiário externo: escolha, nome, adição explícita, seleção e cancelamento",async()=>{
  const h=harness();
  const initialNodes=h.nodes(h.render());
  assert.ok(initialNodes.findIndex(n=>n.type==="checkbox")>initialNodes.findIndex(n=>n.type==="select"));
  assert.ok(initialNodes.some(n=>n.type==="span" && n.props.children==="Não está na plataforma"));
  assert.ok(!initialNodes.some(n=>n.type==="option" && n.props.value==="__externo__"));
  h.find("checkbox").props.onCheckedChange(true);
  assert.deepEqual(h.drafts,[true]);assert.deepEqual(h.changed,[]);
  assert.equal(h.find("select").props.disabled,true);
  assert.equal(h.find("button","Adicionar beneficiário").props.disabled,true);
  h.find("input").props.onChange({target:{value:"  Fornecedor Externo Ltda  "}});
  assert.equal(h.find("input").props.maxLength,200);
  await h.find("button","Adicionar beneficiário").props.onClick();
  assert.deepEqual(h.names,["Fornecedor Externo Ltda"]);assert.deepEqual(h.changed,["external"]);assert.deepEqual(h.drafts,[true,false]);
  h.props.value="external";h.props.options.push({id:"external",nome:"Fornecedor Externo Ltda"});
  assert.equal(h.find("select").props.value,"external");
  h.find("checkbox").props.onCheckedChange(true);
  h.find("button","Cancelar").props.onClick();
  assert.equal(h.find("input"),undefined);assert.deepEqual(h.changed,["external"]);
  h.find("select").props.onChange({target:{value:"member"}});assert.equal(h.changed.at(-1),"member");
});

test("erro não seleciona beneficiário, não repete cadastro e mantém nome para revisão",async()=>{
  let requests=0;
  const h=harness({onCreate:async()=>{requests++;throw new Error("Detalhe privado");}});
  h.find("checkbox").props.onCheckedChange(true);
  h.find("input").props.onChange({target:{value:"Vendedor"}});
  await h.find("button","Adicionar beneficiário").props.onClick();
  assert.equal(requests,1);assert.deepEqual(h.changed,[]);assert.equal(h.find("input").props.value,"Vendedor");
  assert.ok(h.nodes(h.render()).some(n=>n.props?.role==="alert" && /Confira os favorecidos/.test(n.props.children)));
});

test("consulta e aportes do MAP não permitem criar nem trocar o participante",()=>{
  for(const overrides of [{locked:true},{disabled:true}]) {
    const h=harness(overrides);assert.equal(h.find("select").props.disabled,true);
    if(overrides.locked)assert.equal(h.find("checkbox"),undefined);
    if(overrides.disabled)assert.equal(h.find("checkbox").props.disabled,true);
    assert.equal(h.find("input"),undefined);
  }
  const parent=readFileSync(new URL("./initial-contributions.tsx",import.meta.url),"utf8");
  assert.match(parent,/locked=\{c.componente!=="ativo" && !!c.beneficiario\}/);
  assert.match(parent,/allowExternal=\{c.componente==="ativo"\}/);
  assert.match(parent,/apiRequest\("POST","\/api\/membros\/criar-favorecido",\{nome\}\)/);
  assert.doesNotMatch(parent,/socios_guardioes|socios_multiplicadores|apiRequest\("PATCH",`\/api\/bias/);
  assert.match(parent,/useUnsavedChanges\(dirty \|\| !!settlement \|\| beneficiaryDraft\)/);
  assert.match(parent,/disabled=\{dirty \|\| beneficiaryDraft/);
});
