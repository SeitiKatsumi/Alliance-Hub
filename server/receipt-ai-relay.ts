import {financialImportPrompt} from './financial-import-prompt';
import express from 'express';
import {timingSafeEqual} from 'node:crypto';
import {validateReceiptFile,RECEIPT_EXTRACTION_PROMPT} from './receipt-matching';
import OpenAI from 'openai';
export function receiptRelay(token:string, extract:(file:any, context?:any)=>Promise<string>) {
 if(token.length<32)throw new Error('Relay requires authentication');
 const app=express();
 app.use((req,res,next)=>{const given=Buffer.from(req.headers.authorization||'');const expected=Buffer.from('Bearer '+token);if(given.length!==expected.length||!timingSafeEqual(given,expected))return res.sendStatus(401);next();});
 app.use(express.json({limit:'15mb'}));
 app.post('/extract',async(req,res)=>{try {
   const operation=req.body?.operation || 'receipt';
   if(!['receipt','financial-import'].includes(operation))return res.sendStatus(400);
   let context:any;
   if(operation==='financial-import') {
     context=req.body.context;
     if(!context || typeof context.textContent!=='string' || context.textContent.length>18100 ||
       !/^\d{4}-\d{2}-\d{2}$/.test(context.today) ||
       !['deterministicLancamentos','categoriaOptions','tipoCppOptions'].every(k=>Array.isArray(context[k]) && context[k].length<=140) ||
       JSON.stringify(context).length>180000)return res.sendStatus(400);
     if(req.body.base64==null)return res.json({text:await extract(null,context)});
   }
   if(typeof req.body?.base64!=='string'||req.body.base64.length>14_000_000)return res.sendStatus(400);
   const file=await validateReceiptFile({buffer:Buffer.from(req.body.base64,'base64')});
   res.json({text:await extract(file,context)});
 } catch {res.status(503).json({error:'Leitura indisponível.'});}});
 return app;
}
export function openAIReceiptReader(key:string) {
 const client=new OpenAI({apiKey:key,timeout:65_000,maxRetries:0});
 return async(file:any,context?:any)=>{
  const response=await client.responses.create({model:'gpt-4.1-mini',max_output_tokens:context?6000:2200,temperature:0,input:[{role:'user',content:[{type:'input_text',text:context?financialImportPrompt(context):RECEIPT_EXTRACTION_PROMPT},...(file == null ? [] : file.mimetype==='application/pdf'?[{type:'input_file',filename:'comprovante.pdf',file_data:'data:application/pdf;base64,'+file.buffer.toString('base64')}]:[{type:'input_image',detail:'auto',image_url:'data:'+file.mimetype+';base64,'+file.buffer.toString('base64')}])]}] as any});
  return response.output_text;
 };
}
