import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {UserPreferencesStore,registerUserPreferences} from './user-preferences';
import {configureEmailPreferencePolicy,emailDeliveryDecision} from './email-preference-policy';
import {defaultPreferences,parsePreferences,preferencesPatchSchema} from '../shared/user-preferences';
import nodemailer from 'nodemailer';
import ts from 'typescript';

test('preferences: isolated migration, account isolation, partial merges and email lookup',async t=>{
  const pg=new PGlite(); t.after(()=>pg.close());const db=drizzle(pg);
  await pg.exec("CREATE TABLE users(id varchar PRIMARY KEY,email text,ativo boolean DEFAULT true); INSERT INTO users VALUES ('a','owner@example.test',true),('b','employee@example.test',true),('c','OWNER@example.test',true)");
  const migration=readFileSync(new URL('../migrations/20261015_user_preferences.sql',import.meta.url),'utf8');
  await pg.exec(migration);await pg.exec(migration);
  const store=new UserPreferencesStore(db);
  assert.deepEqual(await store.read('a'),defaultPreferences());
  await store.patch('a',{language:'es',email:{invites:false}});
  await Promise.all([store.patch('a',{email:{agenda:false}}),store.patch('a',{email:{bia:false}})]);
  assert.deepEqual(await store.read('a'),{language:'es',email:{invites:false,agenda:false,bia:false,opportunities:true,community:true}});
  assert.deepEqual(await store.read('b'),defaultPreferences());
  assert.equal(await store.allowsEmail(' OWNER@example.test ','invites'),false);
  assert.equal(await store.allowsEmail('new@example.test','invites'),true);
  assert.equal(await store.allowsEmail('owner@example.test','essential'),true);
  assert.equal(preferencesPatchSchema.safeParse({email:{essential:false}}).success,false);
  assert.equal(preferencesPatchSchema.safeParse({user_id:'b',language:'en'}).success,false);
  assert.equal(preferencesPatchSchema.safeParse({language:'fr'}).success,false);
  assert.equal(parsePreferences({email:{invites:false}}).email.invites,false);
});

test('preferences routes: session owner only, validation and storage errors are explicit',async()=>{
  const handlers:Record<string,any>={}; let actor:string|null='employee',readId='',writes=0,fail=false;
  registerUserPreferences({get:(_p:string,h:any)=>handlers.get=h,patch:(_p:string,h:any)=>handlers.patch=h},{
    resolveUser:async()=>actor,
    store:{read:async(id:string)=>{readId=id;if(fail)throw Error();return defaultPreferences();},patch:async(id:string)=>{readId=id;writes++;return defaultPreferences();}} as any,
  });
  const call=async(method:string,body:any={})=>{let status=200,result:any;const res:any={status:(s:number)=>{status=s;return res;},set:()=>res,json:(v:any)=>{result=v;return res;}};await handlers[method]({body,params:{userId:'other'}},res);return {status,result};};
  assert.equal((await call('get')).status,200);assert.equal(readId,'employee');assert.equal(writes,0);
  assert.equal((await call('patch',{user_id:'other',email:{invites:false}})).status,400);assert.equal(writes,0);
  assert.equal((await call('patch',{email:{invites:false}})).status,200);assert.equal(readId,'employee');
  actor=null;assert.equal((await call('get')).status,401);
  actor='a';fail=true;assert.equal((await call('get')).status,503);
});

test('email preferences gate actual SMTP, essential bypass and failure safety',async t=>{
  const messages:any[]=[];
  t.mock.method(nodemailer,'createTransport',()=>({sendMail:async(m:any)=>{messages.push(m);return {messageId:'mock-only'};}}));
  const mail=await import('./mailer');
  configureEmailPreferencePolicy(async()=>false);
  const invite=await mail.enviarSolicitacaoSocioBia({socioEmail:'person@example.test',socioNome:'Pessoa',biaNome:'BIA',papel:'Sócio'});
  assert.equal(invite.skipped,true);assert.equal(messages.length,0);
  await mail.enviarResetSenha({email:'person@example.test',nome:'Pessoa',token:'test-only'});
  assert.equal(messages.length,1);
  configureEmailPreferencePolicy(async()=>{throw Error('private database error');});
  assert.equal(await emailDeliveryDecision('person@example.test','agenda'),'unavailable');
  const failed=await mail.enviarSolicitacaoSocioBia({socioEmail:'person@example.test',socioNome:'Pessoa',biaNome:'BIA',papel:'Sócio'});
  assert.equal(failed.ok,false);assert.equal(messages.length,1);
  configureEmailPreferencePolicy(async()=>true);
  await mail.enviarSolicitacaoSocioBia({socioEmail:'person@example.test',socioNome:'Pessoa',biaNome:'BIA',papel:'Sócio'});
  assert.equal(messages.length,2);
});

test('every mail call has an explicit category; only the central sender accesses SMTP',()=>{
  const source=readFileSync(new URL('./mailer.ts',import.meta.url),'utf8');
  const ast=ts.createSourceFile('mailer.ts',source,ts.ScriptTarget.Latest,true);
  let count=0;
  const walk=(node:ts.Node)=>{
    if(ts.isCallExpression(node)&&node.expression.getText(ast)==='send'){
      count++;assert.ok(ts.isStringLiteral(node.arguments[0]));
      assert.match((node.arguments[0] as ts.StringLiteral).text,/^(essential|invites|agenda|bia|opportunities|community)$/);
    }ts.forEachChild(node,walk);
  };walk(ast);assert.equal(count,32);
  assert.equal((source.match(/transporter.sendMail/g)||[]).length,1);
});
