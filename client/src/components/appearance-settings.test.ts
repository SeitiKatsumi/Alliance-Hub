import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import ts from "typescript";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
test("avisos de conclusão do perfil têm superfícies escuras sem alterar o modo claro", () => {
  const css = read("../index.css");
  assert.match(css, /\.dark \[data-testid="dashboard-profile-completion"\]\s*\{[^}]*background-color: hsl\(217 65% 18%\)/);
  assert.match(css, /\.dark \[data-testid="dashboard-profile-completion"\]:hover\s*\{[^}]*background-color: hsl\(217 60% 23%\)/);
  assert.match(css, /\.dark \[data-testid="profile-recommendation"\]\s*\{[^}]*background-color: hsl\(35 45% 15%\)/);
  assert.ok(read("../pages/painel.tsx").includes('data-testid="dashboard-profile-completion"'));
  assert.ok(read("../pages/meu-perfil.tsx").includes('data-testid="profile-recommendation"'));
});

test("avisos de integração e tons 950 permanecem legíveis no modo escuro", () => {
  const css = read("../index.css");
  const asaas = read("./asaas-status.tsx");
  for (const token of [
    "text-slate-950", "text-blue-950", "text-cyan-950", "text-emerald-950",
    "text-amber-950", "text-red-950", "text-purple-950", "text-violet-950",
  ]) {
    assert.ok(css.includes(`.${token}`), `${token} precisa de contraste no tema escuro`);
  }
  assert.match(asaas, /bg-blue-50[^"\n]*dark:bg-blue-500\/15[^"\n]*dark:text-blue-100/);
  assert.match(asaas, /bg-amber-50[^"\n]*dark:bg-amber-500\/15[^"\n]*dark:text-amber-100/);
});
test("aparência: padrão escuro, seleção acessível, troca imediata sem escrever perfil",()=>{
  let theme:string|undefined, changes:string[]=[];
  const source=read("./appearance-settings.tsx");
  const scope={React,DEFAULT_THEME:"dark",useLocale:()=>({t:(s:string)=>s}),useTheme:()=>({theme,setTheme:(v:string)=>changes.push(v)}),Moon:()=>null,Sun:()=>null,
    Card:"section",CardHeader:"header",CardTitle:"h2",CardDescription:"p",CardContent:"div"};
  const code=transformSync(source.slice(source.indexOf("export function AppearanceSettings")).replace("export function","function"),{loader:"tsx"}).code;
  const Component=new Function(...Object.keys(scope),code+";return AppearanceSettings;")(...Object.values(scope));
  const radios=(node:any):any[]=>Array.isArray(node)?node.flatMap(radios):node&&typeof node==="object"?[...(node.type==="input"?[node]:[]),...radios(node.props?.children)]:[];
  for(const selected of [undefined,"light","dark"]){
    theme=selected;
    const inputs=radios(Component());
    assert.equal(inputs.length,2);assert.equal(inputs.filter(i=>i.props.checked).length,1);
    assert.equal(inputs.find(i=>i.props.checked).props.value,selected==="light"?"light":"dark");
    for(const input of inputs)input.props.onChange();
    const html=renderToStaticMarkup(React.createElement(Component));
    assert.match(html,/fieldset/);assert.match(html,/Claro/);assert.match(html,/Escuro/);assert.match(html,/neste navegador/);
    assert.match(html,/Escuro<\/span><span[^>]*>Padrão da plataforma/);
    assert.match(html,/Claro<\/span><span[^>]*>Fundos claros e textos escuros/);
  }
  assert.deepEqual(changes,["light","dark","light","dark","light","dark"]);
  assert.doesNotMatch(source,/fetch\(|apiRequest|useMutation/);
});

test("provider fixa padrão escuro, preserva escolha clara e não acompanha tema do sistema",()=>{
  const source=read("./theme-provider.tsx");
  let theme:string|undefined="light";
  const changes:string[]=[];
  const scope={React,ThemeProvider:"provider",useEffect:(effect:()=>void)=>effect(),useTheme:()=>({theme,setTheme:(value:string)=>changes.push(value)})};
  const code=transformSync(source.slice(source.indexOf("export const")).replaceAll("export ",""),{loader:"tsx"}).code;
  const { Provider, Validate }=new Function(...Object.keys(scope),code+";return {Provider:AppThemeProvider,Validate:ValidateTheme};")(...Object.values(scope));
  const node=Provider({children:"child"});
  assert.equal(node.props.defaultTheme,"dark");assert.equal(node.props.enableSystem,false);
  assert.equal(node.props.attribute,"class");assert.equal(node.props.storageKey,"built-ui-theme");
  assert.deepEqual(node.props.themes,["light","dark"]);
  for(const value of [undefined,"light","dark"]) { theme=value; Validate(); }
  assert.deepEqual(changes,[],"preferências válidas não são sobrescritas");
  theme="system"; Validate();
  theme="invalid"; Validate();
  assert.deepEqual(changes,["dark","dark"]);
  assert.match(read("../main.tsx"),/<AppThemeProvider><App\s*\/><\/AppThemeProvider>/);
});

test("opção fica em Meu Perfil (titular/funcionário), sem novo módulo, com impressão clara",()=>{
  const profile=read("../pages/meu-perfil.tsx");
  assert.match(profile,/activeCategory === "settings" \? \([\s\S]*?data-testid="profile-settings"[\s\S]*?<PlatformPreferences\s*\/>/);
  assert.doesNotMatch(profile,/activeCategory === "account" && <AppearanceSettings/);
  assert.equal((profile.match(/<PlatformPreferences\s*\/>/g)||[]).length,2);
  assert.doesNotMatch(read("../App.tsx"),/path="\/configuracoes"/);
  const css=read("../index.css");
  assert.match(css,/@media screen/);assert.match(css,/@media print\s*\{\s*:root\.dark/);
  assert.match(css,/data-theme-fixed/);assert.doesNotMatch(css,/filter:\s*invert/);
  assert.match(profile,/\.dark \.profile-light-page/);
});

test("Administração tematiza cabeçalho, indicadores, filtros e editor sem forçar superfícies brancas",()=>{
  const members=read("../pages/membros.tsx");
  const css=members.slice(members.indexOf("        .membros-light-page {"),members.indexOf("        @keyframes scanline"));
  for(const key of ["bg","card","fg","heading","muted","accent","border","input-border","sticky","caption"]){
    assert.match(css,new RegExp(`--members-${key}:`));
    assert.match(css,new RegExp(`var\\(--members-${key}\\)`));
  }
  assert.match(css,/@media screen\s*\{\s*\.dark \.membros-light-page/);
  assert.doesNotMatch(css,/background:\s*#ffffff\s*!important|color:\s*(#000000|#001d34|#475569)\s*!important/);
  const editor=members.slice(members.indexOf('.membro-edit-light {'),members.indexOf('        `}</style>',members.indexOf('.membro-edit-light {')));
  assert.match(editor,/background: hsl\(var\(--card\)\)/);
  assert.match(editor,/color: hsl\(var\(--foreground\)\)/);
});

test("indicadores administrativos mantêm superfície do tema independentemente de grid ou flex",()=>{
  const source=read("../pages/membros.tsx");
  const ast=ts.createSourceFile('membros.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let stats:ts.JsxElement|undefined;
  function find(node:ts.Node){if(ts.isJsxElement(node)&&node.openingElement.getText(ast).includes('data-testid="member-statistics"'))stats=node;ts.forEachChild(node,find);}
  find(ast);assert.ok(stats);
  const render=new Function('React','StatItem','stats','Users','Building2','Globe','Activity',transformSync(`return (${stats.getText(ast)});`,{loader:'tsx'}).code);
  const html=renderToStaticMarkup(render(React,()=>null,{total:1,empresas:1,estados:1,especialidades:1},()=>null,()=>null,()=>null,()=>null));
  assert.match(html,/members-stats grid grid-cols-2 sm:inline-flex/);
  assert.match(html,/background:var\(--members-card\)/);
  assert.doesNotMatch(html,/rgba\(0,10,20/);
  assert.match(source,/\.membros-light-page \.members-stats \{\s*background: var\(--members-card\)/);
  assert.doesNotMatch(source,/\.membros-light-page \.inline-flex\.items-center\.rounded-lg/);
});

test("Vitrine: hero e espaços vazios usam superfícies e texto do tema, preservando anúncios com imagem",()=>{
  const page=read("../pages/vitrine.tsx");
  const code=page.slice(page.indexOf("function AnuncioHeroCard("),page.indexOf("export default function VitrinePage("));
  const scope={React,useState:()=>[false,()=>{}],safeAdHref:()=>null,visibleAdTitle:(v:any)=>v,
    versionAssetUrl:(v:any)=>v,Megaphone:()=>null,ChevronRight:()=>null,Pencil:()=>null,X:()=>null};
  const Hero=new Function(...Object.keys(scope),transformSync(code,{loader:"tsx"}).code+";return AnuncioHeroCard;")(...Object.values(scope));
  const empty=renderToStaticMarkup(React.createElement(Hero,{isOwn:false,onCreate:()=>{}}));
  assert.match(empty,/background:hsl\(var\(--card\) \/ 0.97\)/);
  assert.match(empty,/Espaço premium disponível/);
  const image=renderToStaticMarkup(React.createElement(Hero,{anuncio:{id:"test",imagem_url:"/example.png",titulo:"Teste"},isOwn:false}));
  assert.match(image,/src="\/example.png"/);assert.doesNotMatch(image,/Espaço premium disponível/);
  const ast=ts.createSourceFile("vitrine.tsx",page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let slot:ts.JsxElement|undefined;
  function find(n:ts.Node){if(ts.isJsxElement(n)&&n.openingElement.getText(ast).includes('data-testid={`slot-anuncio-vazio-'))slot=n;ts.forEachChild(n,find);}
  find(ast);assert.ok(slot);
  const render=new Function("React","i","membroId","openAnuncioCreate","Megaphone",transformSync(`return (${slot.getText(ast)});`,{loader:"tsx"}).code);
  const html=renderToStaticMarkup(render(React,0,"member",()=>{},()=>null));
  assert.match(html,/background:hsl\(var\(--card\) \/ 0.97\)/);
  assert.match(html,/color:hsl\(var\(--foreground\)\)/);
  assert.match(html,/color:hsl\(var\(--muted-foreground\)\)/);
  assert.doesNotMatch(html,/rgba\(255,255,255,0.97\)|color:#001D34/);
});
