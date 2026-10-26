import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContributionPaymentDetails } from './contribution-payment';

test('pendência mostra motivo e atalho interno, sem aceitar links arbitrários',()=>{
  const render=(href:string)=>renderToStaticMarkup(React.createElement(ContributionPaymentDetails,{data:{amountCents:1000,message:'CPF do pagador incompleto',correction:{label:'Corrigir cadastro',href}}}));
  assert.match(render('/meu-perfil?campo=cpf'),/href="\/meu-perfil\?campo=cpf"/);
  assert.match(render('/admin?tab=membros&editar=payer&campo=cpf'),/Corrigir cadastro/);
  assert.doesNotMatch(render('https://evil.example/'),/href=/);
  assert.doesNotMatch(render('javascript:alert(1)'),/href=/);
});

test('pagamento integrado mostra os dois meios e restringe URLs',()=>{
  const render=(details:any)=>renderToStaticMarkup(React.createElement(ContributionPaymentDetails,{data:{environment:'sandbox',amountCents:1000,paymentState:'open',details}}));
  const html=render({pix:'000201teste',qrImage:'aGVsbG8=',barcode:'12345',bankSlipUrl:'https://www.asaas.com/b/test'});
  for(const label of ['Pix copia e cola','Linha digitável','Abrir boleto','não pague com dinheiro real','sm:grid-cols-2']) assert.ok(html.includes(label),label);
  const unsafe=render({bankSlipUrl:'javascript:alert(1)',qrImage:'<script>'});
  assert.doesNotMatch(unsafe,/javascript:|<script>|data:image/);
  assert.match(unsafe,/Pix indisponível/);
  assert.match(render(null),/Aguardando pagamento/);
  assert.doesNotMatch(render(null),/Copiar código Pix|Abrir boleto/);
});
