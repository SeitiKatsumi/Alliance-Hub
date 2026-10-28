// Separate operator entrypoint: do not put this in normal startup or cron.
import {MigrationInbox,maintenanceApp} from '../server/migration-inbox';

async function main(){
  const directory=process.env.BUILT_MIGRATION_INBOX_DIR;
  if(!directory)throw new Error('Fila privada não configurada.');
  const inbox=new MigrationInbox(directory);
  if(process.argv.includes('--serve-maintenance')){
    const port=Number(process.env.PORT||3019);
    if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Porta inválida.');
    maintenanceApp(inbox).listen(port,'0.0.0.0',()=>console.log('Receptor de manutenção iniciado.'));
  }else if(process.argv.includes('--replay-preserved-events')){
    const target=process.env.BUILT_MIGRATION_REPLAY_TARGET;
    if(!target)throw new Error('Destino local não informado.');
    console.log(JSON.stringify(await inbox.replay(target)));
  }else throw new Error('Ação explícita de manutenção obrigatória.');
}
main().catch(()=>{console.error('Operação não concluída. A fila foi preservada.');process.exitCode=1;});
