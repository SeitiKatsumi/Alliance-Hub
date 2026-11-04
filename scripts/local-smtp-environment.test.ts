import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { applyLocalSmtpEnvironment, LOCAL_SMTP_KEYS } from './local-smtp-environment';

test('SMTP local usa somente a configuração do projeto sem alterar banco, porta ou Directus', () => {
  const environment: Record<string,string|undefined> = { SMTP_USER:'old-account',SMTP_PASS:'old-key',SMTP_FROM:'Old <old@example.test>',SMTP_SECURE:'true',PORT:'3004',DATABASE_URL:'db-sentinel',DIRECTUS_URL:'directus-sentinel' };
  applyLocalSmtpEnvironment({SMTP_HOST:'smtp.example.test',SMTP_PORT:'587',SMTP_USER:'project-account',SMTP_PASS:'project-key',SMTP_FROM:'BUILT <built@example.test>'},environment);
  assert.equal(environment.SMTP_USER,'project-account');assert.equal(environment.SMTP_PASS,'project-key');
  assert.equal(environment.SMTP_FROM,'BUILT <built@example.test>');assert.equal(environment.SMTP_SECURE,undefined);
  assert.equal(environment.PORT,'3004');assert.equal(environment.DATABASE_URL,'db-sentinel');assert.equal(environment.DIRECTUS_URL,'directus-sentinel');
});
test('configuração incompleta nunca combina credencial herdada com a do projeto', () => {
  const environment=Object.fromEntries(LOCAL_SMTP_KEYS.map(k=>[k,'inherited']));
  applyLocalSmtpEnvironment({SMTP_HOST:'smtp.example.test'},environment);
  assert.deepEqual(environment,{SMTP_HOST:'smtp.example.test'});
});
test('bootstrap real aplica SMTP antes do primeiro import do servidor e o launcher usa esse bootstrap', () => {
  const root=mkdtempSync(join(tmpdir(),'built-local-smtp-'));
  try {
    mkdirSync(join(root,'scripts'));mkdirSync(join(root,'server'));
    writeFileSync(join(root,'package.json'),'{"type":"module"}');
    for(const file of ['start-local-app.ts','local-smtp-environment.ts'])copyFileSync(new URL('./'+file,import.meta.url),join(root,'scripts',file));
    writeFileSync(join(root,'.env'),'SMTP_HOST=smtp.example.test\nSMTP_USER=project\nSMTP_PASS=project-key\nSMTP_FROM="BUILT <built@example.test>"\n');
    writeFileSync(join(root,'server','index.ts'),'console.log(JSON.stringify({user:process.env.SMTP_USER,key:process.env.SMTP_PASS,from:process.env.SMTP_FROM,port:process.env.PORT,db:process.env.DATABASE_URL,secure:process.env.SMTP_SECURE??null}));');
    const require=createRequire(import.meta.url);
    const child=spawnSync(process.execPath,['--import',pathToFileURL(require.resolve('tsx')).href,join(root,'scripts','start-local-app.ts')],{
      cwd:root,encoding:'utf8',env:{...process.env,SMTP_USER:'inherited',SMTP_PASS:'inherited-key',SMTP_FROM:'wrong',SMTP_SECURE:'true',PORT:'3004',DATABASE_URL:'db-sentinel'},
    });
    assert.equal(child.status,0,child.stderr);
    assert.deepEqual(JSON.parse(child.stdout.trim()),{user:'project',key:'project-key',from:'BUILT <built@example.test>',port:'3004',db:'db-sentinel',secure:null});
    assert.match(readFileSync(new URL('./start-local-app.ps1',import.meta.url),'utf8'),/'scripts\/start-local-app.ts'/);
  } finally {
    const resolved=realpathSync(root);
    assert.equal(dirname(resolved),realpathSync(tmpdir()));assert.ok(basename(resolved).startsWith('built-local-smtp-'));
    rmSync(resolved,{recursive:true,force:true});
  }
});
