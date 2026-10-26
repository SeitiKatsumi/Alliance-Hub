import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentGuidance, payerMissingFields } from './contribution-payment-guidance';

test('pendências indicam campos reais sem revelar documentos e respeitam destino autorizado', () => {
  const base = {code:'PAYER_PENDING',payer:{nome:'Teste',cpf:'1'},owner:'payer',viewer:'payer'};
  const own = paymentGuidance(base);
  assert.match(own.message,/CPF.*11 dígitos/);
  assert.equal(own.correction?.href,'/meu-perfil?campo=cpf');
  assert.equal(paymentGuidance({...base,viewer:'manager'}).correction,null);
  assert.match(paymentGuidance({...base,viewer:'admin',canEditPayers:true}).correction!.href,/editar=payer&campo=cpf/);
  assert.deepEqual(payerMissingFields({nome:'',cnpj:'1'}),['nome','cnpj']);
  assert.equal(paymentGuidance({...base,payer:{nome:'Teste',cnpj:'12345678901234'}}).correction,null);
  assert.match(paymentGuidance({...base,payer:{nome:'Teste',cpf:'12345678901'}}).message,/reavaliada automaticamente/);
  assert.equal(paymentGuidance({...base,code:'ACCOUNT_PENDING'}).correction,null);
  assert.match(paymentGuidance({...base,code:'ACCOUNT_PENDING',bankHref:'/bias/bia?tab=capital&capital=banco'}).correction!.href,/capital=banco/);
  assert.doesNotMatch(paymentGuidance({...base,code:'secret_raw_error'}).message,/secret_raw_error/);
});
