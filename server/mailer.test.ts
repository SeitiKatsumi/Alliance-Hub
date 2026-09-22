import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

test("convites de diretoria e sócio mantêm ação antecipada e alternativa em mobile", async (t) => {
  const messages: any[] = [];
  t.mock.method(nodemailer, "createTransport", () => ({sendMail: async (message:any) => {messages.push(message);return {messageId:"preview-only"};}}));
  const mailer = await import("./mailer");
  await mailer.enviarSolicitacaoDiretoriaBia({diretorEmail:"example@example.test",diretorNome:"Pessoa <teste>",biaNome:"Aliança & Imóveis",papel:"Dir. Núcleo de Capital",percentual:0,solicitanteNome:"Outra pessoa"});
  await mailer.enviarSolicitacaoSocioBia({socioEmail:"example@example.test",socioNome:"Pessoa <teste>",biaNome:"Aliança & Imóveis",papel:"Sócio Guardião"});
  assert.equal(messages.length,2);
  for(const {html} of messages){
    assert.match(html,/width="220"[^>]*max-width:100%/);
    assert.match(html,/role="presentation"[^>]*width="100%"/);
    assert.match(html,/bgcolor="#D7BB7D"/);
    assert.match(html,/background-image:linear-gradient\(#001D34,#001D34\)/);
    assert.match(html,/background-image:linear-gradient\(#D7BB7D,#D7BB7D\)/);
    assert.match(html,/<body class="built-email"/);
    assert.match(html,/u \+ \.built-email \.email-ink/);
    assert.match(html,/-webkit-background-clip:text; background-clip:text; color:transparent !important/);
    assert.match(html,/<span class="email-ink" style="color:#001D34">Responder /);
    // Every visible text block needs a protected foreground, not just a locked background.
    assert.doesNotMatch(html,/<(?:p|h2)\s+style=/);
    assert.ok(html.indexOf(">Responder ")<html.indexOf("Papel:"),"Ação vem antes dos detalhes");
    assert.match(html,/Se o botão não aparecer/);
    assert.equal((html.match(/href="[^"]+\/notificacoes"/g)||[]).length,2);
    assert.match(html,/Pessoa &lt;teste&gt;/);
    assert.match(html,/Aliança &amp; Imóveis/);
    assert.doesNotMatch(html,/<form|<script|overflow:hidden[^>]*height:/);
  }
  assert.match(messages[0].html,/Percentual: 0%/);
});
