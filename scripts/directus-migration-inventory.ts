import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function inventorySource(file: string, source: string) {
  const references: {line: number; kind: string}[] = [];
  const collections = new Set<string>();
  source.split(/\r?\n/).forEach((line, i) => {
    if (/directus|DIRECTUS|databases\.builtalliances/i.test(line)) {
      references.push({line:i+1, kind:/\/assets|\/files|upload/i.test(line)?'files':/\/fields|\/schema/i.test(line)?'schema':/Fetch|fetch|\/items/i.test(line)?'data':'other'});
    }
    for (const match of line.matchAll(/directus(?:FetchOne|FetchScoped|Fetch|Create|Update|Delete|BulkCreate|BulkPatch|BulkDelete)\(\s*["']([A-Za-z_][\w]*)["']/g)) collections.add(match[1]);
    for (const match of line.matchAll(/\/items\/([A-Za-z_][\w]*)/g)) collections.add(match[1]);
  });
  return {file, references, literalCollections:[...collections].sort()};
}

export function inventory(root: string) {
  const files: ReturnType<typeof inventorySource>[] = [];
  const scan = (dir: string) => {
    for(const entry of readdirSync(path.join(root,dir),{withFileTypes:true})) {
      const relative=path.posix.join(dir,entry.name);
      if(entry.isSymbolicLink()) continue;
      if(entry.isDirectory()) scan(relative);
      else if(/\.(?:ts|tsx|cjs)$/.test(entry.name)&&!entry.name.includes('.test.')) {
        const found=inventorySource(relative,readFileSync(path.join(root,relative),'utf8'));
        if(found.references.length||found.literalCollections.length)files.push(found);
      }
    }
  };
  for(const dir of ['server','shared','client/src'])scan(dir);
  return {version:1, cutoverReady:false, warning:'Static inventory only: dynamic collections, database relations, flows and asset references require runtime review.',
    collections:[...new Set(files.flatMap(f=>f.literalCollections))].sort(),files:files.sort((a,b)=>a.file.localeCompare(b.file))};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(inventory(process.cwd()),null,2));
