import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('deployment archive contains every server and operator build entry point', () => {
  const workflow = readFileSync('.github/workflows/deploy-caprover.yml', 'utf8');
  const command = workflow.match(/git archive --format=tar --output=deploy\.tar HEAD -- ([\s\S]*?)(?=\n\s*-[ ]name:)/)?.[1];
  assert.ok(command, 'Deployment archive command must be reviewable');
  const paths = command.replace(/\\\r?\n/g, ' ').trim().split(/\s+/);
  const build = readFileSync('script/build.ts', 'utf8');
  const entries = [...build.matchAll(/["']((?:server|scripts)\/[^"']+\.ts)["']/g)].map(match => match[1]);
  assert.ok(entries.length >= 1, 'Build entry points must be detected');
  const dir = mkdtempSync(path.join(tmpdir(), 'built-deploy-package-'));
  try {
    const archive = path.join(dir, 'deploy.tar');
    execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, 'HEAD', '--', ...paths]);
    const files = new Set(execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).split(/\r?\n/));
    for (const entry of entries) assert.ok(files.has(entry), `Deployment archive is missing ${entry}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
