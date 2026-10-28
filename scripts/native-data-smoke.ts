// Operator probe for the isolated clone. No mutations, credentials or row data in output.
import pg from 'pg';
import {loadNativeCatalog,NativeDataStore,NATIVE_COLLECTIONS,parseNativeQuery,ident} from '../server/native-data-store';

async function main() {
  if(process.env.BUILT_ISOLATED_STAGE!=='1')throw new Error('Requires isolated stage');
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
  const failures:Array<{collection:string;error:string}>=[];let passed=0;
  try {
    await db.query('BEGIN READ ONLY');
    const control=await db.query("SELECT state FROM built_migration.control WHERE state='isolated-rehearsal'");
    if(control.rowCount!==1)throw new Error('Missing isolated database marker');
    const catalog=await loadNativeCatalog(db), store=new NativeDataStore(db,catalog);
    for(const name of NATIVE_COLLECTIONS) {
      if(!catalog.columns.some(c=>c.table_name===name))continue;
      try {
        const count=Number((await db.query(`SELECT count(*) n FROM built_legacy.${ident(name)}`)).rows[0].n);
        const rows=await store.read(name,parseNativeQuery(new URLSearchParams('limit=5&fields=*')));
        if(rows.length!==Math.min(count,5))throw new Error('Count mismatch');
        if(name==='Comunidade')await store.read(name,parseNativeQuery(new URLSearchParams('limit=5&fields=id,nome,membros.cadastro_geral_id.nome,bias.bias_projetos_id.id')));
        if(name==='bias_projetos')await store.read(name,parseNativeQuery(new URLSearchParams('limit=5&fields=*,participantes.*')));
        if(name==='fluxo_caixa')await store.read(name,parseNativeQuery(new URLSearchParams('limit=5&fields=*,Favorecidos.cadastro_geral_id.nome,bia.nome_bia')));
        passed++;
      }catch(error:any){failures.push({collection:name,error:typeof error?.status==='number'?error.message:'Query failed'});}
    }
    await db.query('ROLLBACK');
    console.log(JSON.stringify({passed,failures}));
    if(failures.length)process.exitCode=1;
  }finally{await db.end();}
}
main().catch(()=>{console.error('Isolated data probe failed');process.exitCode=1;});
