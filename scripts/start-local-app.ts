import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { applyLocalSmtpEnvironment } from './local-smtp-environment';

// Set the project account before loading any server module, including mailer.ts.
const project = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8'));
applyLocalSmtpEnvironment(project, process.env);
await import(new URL('../server/index.ts', import.meta.url).href);
