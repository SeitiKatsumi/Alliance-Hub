import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { transformInterface } from './interface-localization.mjs';

const files = execFileSync('git',['ls-files','--cached','--others','--exclude-standard','--','client/src','shared'],{encoding:'utf8'})
  .split(/\r?\n/).filter(f=>/\.tsx?$/.test(f)&&!/(?:\.test\.|interface-language|interface-locale|interface-catalog)/.test(f));
const keys = new Set();
for(const file of files) transformInterface(fs.readFileSync(file,'utf8'),file,key=>keys.add(key));
if (process.argv[2] === '--check') {
  const catalog = JSON.parse(fs.readFileSync('client/src/lib/interface-catalog.json','utf8'));
  const tokens = text => (text.match(/\{\d+\}/g) || []).sort().join(',');
  const missing = [...keys].filter(key => {
    const row = catalog[key];
    return !Array.isArray(row) || row.length !== 2 ||
      row.some(value => typeof value !== 'string' || !value.trim() || tokens(key) !== tokens(value));
  });
  if (missing.length) {
    console.error('Mensagens sem tradução válida em inglês ou espanhol:', missing);
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(process.argv[2], JSON.stringify([...keys].sort(),null,2)+'\n');
}
console.log(`${keys.size} mensagens de interface em ${files.length} arquivos examinados.`);
