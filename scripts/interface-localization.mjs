// Vite pre-transform. Translate at the presentation boundary; leave API payloads, ids,
// select values, component keys and user-provided text untouched.
import ts from 'typescript';
const fields = new Set(['label','title','subtitle','description','placeholder','helper','hint','text','message','aria-label','alt','emptyText','loadingText','caption','heading','tooltip','actionLabel','summary','displayName']);
const labelDictionary = name => /labels$/i.test(name) || /^labels[A-Z]/.test(name);
const normalize = s => s.replace(/\s+/g, ' ').trim();
const readable = s => /[A-Za-zÀ-ÿ]/.test(s) && s.length < 1400 && !/https?:\/\/|(?:^|\s)\/[a-z]|[<>\x00]|\bclassName\b|[\w.-]+@[\w.-]+\.[a-z]{2}|[\w]-[\w]+-\d|\b(?:bg|text|px|py|grid|border|font|rounded)-[a-z0-9]/.test(s);

const f = ts.factory;
const displayFields = new Set([...fields,'action','buttonText','emptyMessage','loadingMessage','searchPlaceholder','disabledPlaceholder','itemLabel','itemLabelPlural','aria-description']);
const metadataFields = new Set([...displayFields,'role','footer','nucleo','cpp','publicName','nome','name']);
const propName = n => n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : '';
function isCopy(n) {
  return ts.isStringLiteralLike(n) && readable(normalize(n.text));
}
function transformInterface(source, file, collect = () => {}) {
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const call=(name,args)=>f.createCallExpression(f.createIdentifier(name),undefined,args);
  let views=false, objects=false, formats=false, changed=false;
  const ownFunctions=new Set();
  const bindings=new Map();
  const scopeOf=n=>{while(n && !ts.isBlock(n) && !ts.isSourceFile(n) && !ts.isFunctionLike(n))n=n.parent;return n;};
  function recordBinding(scope,name,value){
    if(!scope||!name)return;
    if(!bindings.has(scope))bindings.set(scope,new Map());
    bindings.get(scope).set(name,value);
  }
  // Follow direct iterations over authored lists. Options keep their canonical value
  // in callbacks, while the label at the JSX boundary follows the selected language.
  const initializers = new Map();
  function indexCollections(n) {
    const scope = ts.isParameter(n) ? n.parent : ts.isVariableDeclaration(n) ? scopeOf(n.parent) : null;
    if (scope && ts.isIdentifier(n.name)) {
      if (!initializers.has(scope)) initializers.set(scope, new Map());
      initializers.get(scope).set(n.name.text, ts.isVariableDeclaration(n) && n.parent.flags & ts.NodeFlags.Const ? n.initializer : undefined);
    }
    ts.forEachChild(n,indexCollections);
  }
  indexCollections(ast);
  function literalItems(n,seen = new Set()) {
    if (!n || seen.has(n)) return;
    seen.add(n);
    if (ts.isArrayLiteralExpression(n)) return n.elements;
    if (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n)) return literalItems(n.expression,seen);
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['filter','slice'].includes(n.expression.name.text)) return literalItems(n.expression.expression,seen);
    if (ts.isIdentifier(n)) {
      for (let scope=scopeOf(n.parent);scope;scope=scopeOf(scope.parent)) {
        if (initializers.get(scope)?.has(n.text)) return literalItems(initializers.get(scope).get(n.text),seen);
      }
    }
  }
  function iterationCopy(param) {
    const fn=param.parent, invocation=fn.parent;
    if (fn.parameters?.[0]!==param || !ts.isCallExpression(invocation) || invocation.arguments[0]!==fn ||
        !ts.isPropertyAccessExpression(invocation.expression) || invocation.expression.name.text!=='map') return;
    const items=literalItems(invocation.expression.expression);
    if (!items?.length) return;
    if (ts.isIdentifier(param.name) && items.every(isCopy)) recordBinding(fn,param.name.text,items.map(item=>normalize(item.text)));
    if (ts.isObjectBindingPattern(param.name)) for (const binding of param.name.elements) {
      const field=propName(binding.propertyName || binding.name);
      if (!metadataFields.has(field) || !ts.isIdentifier(binding.name)) continue;
      const values=items.map(item=>ts.isObjectLiteralExpression(item) && item.properties.find(prop=>ts.isPropertyAssignment(prop) && propName(prop.name)===field)?.initializer);
      if (values.every(value=>value && isCopy(value))) recordBinding(fn,binding.name.text,values.map(value=>normalize(value.text)));
    }
  }
  function staticCopy(n){
    if(!n)return false;
    if(isCopy(n))return [normalize(n.text)];
    if(!ts.isConditionalExpression(n))return false;
    const a=staticCopy(n.whenTrue),b=staticCopy(n.whenFalse); return a && b && a.concat(b);
  }
  function copyVariable(n){
    for(let scope=scopeOf(n.parent);scope;scope=scopeOf(scope.parent)){
      if(bindings.get(scope)?.has(n.text))return bindings.get(scope).get(n.text);
    }
    return false;
  }
  function findCopyFunctions(n) {
    if(ts.isParameter(n)) { recordBinding(n.parent,propName(n.name),false); iterationCopy(n); }
    if(ts.isVariableDeclaration(n))recordBinding(scopeOf(n.parent),propName(n.name),!!(n.parent.flags&ts.NodeFlags.Const)&&staticCopy(n.initializer));
    // Only plain functions whose entire return vocabulary is authored in this module.
    if (ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n) && n.initializer && (ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer))) {
      const fn=ts.isFunctionDeclaration(n)?n:n.initializer;
      const values=[];
      function scan(child){ if(child!==fn.body && ts.isFunctionLike(child))return; if(ts.isReturnStatement(child)) values.push(child.expression); else ts.forEachChild(child,scan); }
      if(fn.body && ts.isBlock(fn.body))scan(fn.body); else if(fn.body)values.push(fn.body);
      if(values.length && values.every(v=>v && isCopy(v))){ownFunctions.add(propName(n.name));values.forEach(v=>collect(normalize(v.text)));}
    }
    ts.forEachChild(n,findCopyFunctions);
  }
  findCopyFunctions(ast);
  const result=ts.transform(ast,[context=>root=>{
    let translating=false, used=false;
    function t(node){used=true;if(ts.isStringLiteralLike(node))collect(normalize(node.text));return call('__builtText',[node]);}
    function expression(n) {
      if(isCopy(n))return t(n);
      if(ts.isIdentifier(n)){const copy=copyVariable(n);if(copy){copy.forEach(collect);return t(n);}}
      if(ts.isParenthesizedExpression(n))return f.updateParenthesizedExpression(n,expression(n.expression));
      if(ts.isConditionalExpression(n))return f.updateConditionalExpression(n,n.condition,n.questionToken,expression(n.whenTrue),n.colonToken,expression(n.whenFalse));
      if(ts.isBinaryExpression(n) && [ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.AmpersandAmpersandToken].includes(n.operatorToken.kind))return f.updateBinaryExpression(n,n.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken ? n.left : expression(n.left),n.operatorToken,expression(n.right));
      if(ts.isCallExpression(n) && ownFunctions.has(propName(n.expression)))return t(n);
      if((ts.isCallExpression(n)||ts.isNewExpression(n)) && n.arguments?.[0]?.text === 'pt-BR'
        && ts.isPropertyAccessExpression(n.expression) && ['toLocaleDateString','toLocaleString','toLocaleTimeString','NumberFormat','DateTimeFormat'].includes(n.expression.name.text)){
        used=true;
        const args=[f.createPropertyAccessExpression(f.createIdentifier('__builtText'),'locale'),...n.arguments.slice(1)];
        return ts.isNewExpression(n)?f.updateNewExpression(n,n.expression,n.typeArguments,args):f.updateCallExpression(n,n.expression,n.typeArguments,args);
      }
      if(ts.isTemplateExpression(n)) {
        const parts=[n.head.text,...n.templateSpans.map(v=>v.literal.text)];
        if(parts.some(p=>readable(normalize(p)))) {
          parts.filter(p=>readable(normalize(p))).forEach(p=>collect(normalize(p)));
          collect(normalize(parts.map((p,i)=>p+(i<parts.length-1?'{'+i+'}':'')).join('')));
          used=true;
          return f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('__builtText'),'template'),undefined,[
            f.createArrayLiteralExpression(parts.map(p=>f.createStringLiteral(p))),
            f.createArrayLiteralExpression(n.templateSpans.map(s=>expression(s.expression)))]);
        }
      }
      if(ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression) && labelDictionary(n.expression.text)) {
        used=true;
        return f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('__builtText'),'field'),undefined,[n.expression,n.argumentExpression]);
      }
      if(ts.isPropertyAccessExpression(n) && metadataFields.has(n.name.text) && !ts.isSuperProperty(n)) {
        used=true;
        return f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('__builtText'),'field'),undefined,[n.expression,f.createStringLiteral(n.name.text)]);
      }
      return ts.visitEachChild(n,visit,context);
    }
    function visit(n) {
      // Localize display formatters only. Input masks, wire formats and parse helpers keep their contracts.
      if((ts.isCallExpression(n)||ts.isNewExpression(n)) && n.arguments?.[0]?.text==='pt-BR' && ts.isPropertyAccessExpression(n.expression)
        && ['NumberFormat','DateTimeFormat','toLocaleDateString','toLocaleString','toLocaleTimeString'].includes(n.expression.name.text)){
        let owner=n.parent;while(owner&&!ts.isFunctionLike(owner))owner=owner.parent;
        const name=owner && (propName(owner.name)||propName(owner.parent?.name));
        if(name && /^(brl|fmt|fmtPercent|formatCurrency|formatMoney|formatDate|formatDateTime|formatPercent|formatBRL)$/i.test(name)){
          formats=changed=true;const args=[call('__builtDisplayLocale',[]),...n.arguments.slice(1)];
          return ts.isNewExpression(n)?f.updateNewExpression(n,n.expression,n.typeArguments,args):f.updateCallExpression(n,n.expression,n.typeArguments,args);
        }
      }
      // Values are persisted by controls and must never be turned into translated labels.
      if(ts.isJsxAttribute(n) && ['value','defaultValue','key','id','name','href','to','data-testid'].includes(propName(n.name)))return n;
      if(ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text==='toast' && n.arguments.length===1 && ts.isObjectLiteralExpression(n.arguments[0])){
        const obj=n.arguments[0];
        const props=obj.properties.map(p=>{
          if(!ts.isPropertyAssignment(p)||!['title','description'].includes(propName(p.name))||!isCopy(p.initializer))return ts.visitNode(p,visit);
          views=changed=true;collect(normalize(p.initializer.text));
          const value=call('__builtLocalizedView',[f.createArrowFunction(undefined,undefined,[f.createParameterDeclaration(undefined,undefined,'__builtText')],undefined,undefined,call('__builtText',[p.initializer]))]);
          return f.updatePropertyAssignment(p,p.name,value);
        });
        return f.updateCallExpression(n,n.expression,n.typeArguments,[f.updateObjectLiteralExpression(obj,props)]);
      }
      if(ts.isJsxElement(n)){
        const tag=n.openingElement.tagName.getText(ast);
        const attrs=n.openingElement.attributes.properties;
        if(['pre','code','style','script'].includes(tag) || attrs.some(a=>ts.isJsxAttribute(a) && (propName(a.name)==='contentEditable' || propName(a.name)==='translate' && a.initializer?.text==='no')))return n;
        if(tag==='option' && !attrs.some(a=>ts.isJsxAttribute(a)&&propName(a.name)==='value')){
          const kids=n.children.filter(k=>!ts.isJsxText(k)||normalize(k.text));
          if(kids.length!==1)return n;
          const original=ts.isJsxText(kids[0])?f.createJsxExpression(undefined,f.createStringLiteral(normalize(kids[0].text))):ts.isJsxExpression(kids[0])?kids[0]:null;
          if(!original)return n;
          n=f.updateJsxElement(n,f.updateJsxOpeningElement(n.openingElement,n.openingElement.tagName,n.openingElement.typeArguments,f.createJsxAttributes([...attrs,f.createJsxAttribute(f.createIdentifier('value'),original)])),n.children,n.closingElement);
        }
      }
      if(ts.isObjectLiteralExpression(n)){
        let declaration=n.parent;
        while(ts.isAsExpression(declaration)||ts.isSatisfiesExpression(declaration))declaration=declaration.parent;
        const dictionary=ts.isVariableDeclaration(declaration) && labelDictionary(propName(declaration.name));
        const marked=n.properties.filter(p=>ts.isPropertyAssignment(p) && (dictionary || metadataFields.has(propName(p.name))) && isCopy(p.initializer)).map(p=>propName(p.name));
        const obj=ts.visitEachChild(n,visit,context);
        if(marked.length){ objects=changed=true;n.properties.filter(p=>ts.isPropertyAssignment(p)&&marked.includes(propName(p.name))&&isCopy(p.initializer)).forEach(p=>collect(normalize(p.initializer.text)));return call('__builtCopyObject',[obj,f.createArrayLiteralExpression(marked.map(v=>f.createStringLiteral(v)))]); }
        return obj;
      }
      const jsx=ts.isJsxElement(n)||ts.isJsxFragment(n)||ts.isJsxSelfClosingElement(n);
      if(jsx && !translating) {
        translating=true;used=false;
        const child=ts.visitEachChild(n,visit,context);
        translating=false;
        if(!used)return child;
        views=changed=true;
        const attrs=ts.isJsxFragment(n)?[]:(ts.isJsxElement(n)?n.openingElement:n).attributes.properties;
        const key=attrs.find(a=>ts.isJsxAttribute(a)&&propName(a.name)==='key')?.initializer;
        const args=[f.createArrowFunction(undefined,undefined,[f.createParameterDeclaration(undefined,undefined,'__builtText')],undefined,undefined,child)];
        if(key && (ts.isStringLiteral(key)||ts.isJsxExpression(key)&&key.expression))args.push(ts.isStringLiteral(key)?key:key.expression);
        return call('__builtLocalizedView',args);
      }
      if(translating && ts.isJsxText(n) && readable(normalize(n.text))) {
        // The JSX compiler folds indentation/newlines, but preserves meaningful inline spaces.
        const text=n.text.replace(/\r/g,'').split('\n').map((line,i,arr)=>(i?line.trimStart():line).replace(i<arr.length-1?/\s+$/:/$^/,'')).filter(Boolean).join(' ');
        if(/&(?:\w+|#\d+);/.test(text))return n;
        return f.createJsxExpression(undefined,t(f.createStringLiteral(text)));
      }
      if(translating && ts.isJsxExpression(n) && n.expression && !ts.isJsxAttribute(n.parent))return f.updateJsxExpression(n,expression(n.expression));
      if(translating && ts.isJsxAttribute(n) && displayFields.has(propName(n.name)) && n.initializer) {
        const v=n.initializer;
        if(isCopy(v))return f.updateJsxAttribute(n,n.name,f.createJsxExpression(undefined,t(f.createStringLiteral(v.text))));
        if(ts.isJsxExpression(v) && v.expression)return f.updateJsxAttribute(n,n.name,f.updateJsxExpression(v,expression(v.expression)));
      }
      return ts.visitEachChild(n,visit,context);
    }
    return ts.visitNode(root,visit);
  }]);
  try{
    if(!changed)return null;
    const imports=[views && 'localizedView as __builtLocalizedView',objects && 'markCopyObject as __builtCopyObject',formats && 'presentationLocale as __builtDisplayLocale'].filter(Boolean).join(', ');
    return 'import { '+imports+' } from "@/lib/interface-locale-runtime";\n'+ts.createPrinter({removeComments:true}).printFile(result.transformed[0]);
  }finally{result.dispose();}
}
const skip=/\/lib\/interface-(?:language|locale|catalog)|legal-acceptance|\/terms-content|\.test\./;
function interfaceLocalization(){return {name:'built-interface-localization',enforce:'pre',transform(src,id){
  const file=id.split('?')[0].replace(/\\/g,'/');
  if(!/\/(?:client\/src|shared)\/.*\.tsx?$/.test(file)||skip.test(file))return null;
  return transformInterface(src,file);
}}}
export {transformInterface,interfaceLocalization};
