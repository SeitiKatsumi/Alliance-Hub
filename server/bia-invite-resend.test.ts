import test from "node:test";
import assert from "node:assert/strict";
import {registerBiaInviteResend} from "./bia-invite-resend";

test("reenvio valida BIA, estado, destinatário, autorização, SMTP e cliques repetidos sem criar convite", async () => {
  let handler:any, authorized=true, sent=0, loads=0, ok=true;
  let invite:any={id:"i",bia_id:"bia",status:"pendente",papel:"Sócio",socio_email:"test@example.com",diretor_email:"director@example.com"};
  registerBiaInviteResend({post:(_path:string,fn:any)=>handler=fn},{
    authorize:async()=>authorized?{bia:{id:"bia",nome_bia:"BIA teste"}}:null,
    load:async()=>{loads++;return invite;},
    send:async()=>{sent++;return {ok};},
  });
  const call=async(type="socio")=>{let status=200,body:any;const res={status:(v:number)=>{status=v;return res;},json:(v:any)=>body=v};await handler({params:{id:"bia",tipo:type,conviteId:invite.id}},res);return {status,body};};
  authorized=false;await call();assert.equal(loads,0);authorized=true;
  assert.equal((await call("invalido")).status,400);
  invite.bia_id="outra";assert.equal((await call()).status,404);invite.bia_id="bia";
  for(const status of ["aceito","recusado","cancelado"]){invite.status=status;assert.equal((await call()).status,409);}invite.status="pendente";
  invite.socio_email=null;assert.equal((await call()).status,422);invite.socio_email="test@example.com";
  assert.equal(sent,0);
  const snapshot=structuredClone(invite);
  const double=await Promise.all([call(),call()]);assert.deepEqual(double.map(r=>r.status).sort(),[200,429]);assert.equal(sent,1);assert.deepEqual(invite,snapshot);
  assert.equal((await call("diretor")).status,200);assert.equal(sent,2);
  invite.id="failure";ok=false;assert.equal((await call()).status,502);assert.equal((await call()).status,429);
});
