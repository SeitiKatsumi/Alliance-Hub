import {readFileSync} from 'node:fs';
export function receiptStageConfig():{url:string;token:string}|null {
 try {const c=JSON.parse(readFileSync('/app/receipt-ai.json','utf8'));if(c.url!=='http://built-receipt-ai:3025/extract'||typeof c.token!=='string'||c.token.length<32)return null;return c;}catch{return null;}
}
export async function readStageReceipt(file:any) {
 const config=receiptStageConfig();if(!config)throw new Error('Receipt AI disabled');
 const res=await globalThis.fetch(config.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.token},body:JSON.stringify({base64:file.buffer.toString('base64')}),signal:AbortSignal.timeout(75_000)});
 if(!res.ok)throw new Error('Receipt reader unavailable');
 return String((await res.json()).text||'');
}

export async function readStageFinancialImport(file:any, context:any) {
 const config=receiptStageConfig();
 if(!config)throw new Error('A leitura por IA ainda não está habilitada neste ambiente.');
 const res=await globalThis.fetch(config.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.token},body:JSON.stringify({operation:'financial-import',base64:file?.buffer.toString('base64'),context}),signal:AbortSignal.timeout(75_000)});
 if(!res.ok)throw new Error('O serviço de leitura está indisponível. Tente novamente com o mesmo arquivo. Nenhum lançamento foi criado.');
 return String((await res.json()).text||'');
}
