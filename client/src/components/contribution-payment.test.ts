import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContributionPaymentDetails } from './contribution-payment';

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
