import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || "Built Alliances <noreply@builtalliances.com>";
const BASE_URL = process.env.APP_URL || "https://app.builtalliances.11mind.com.br";

async function send(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[mailer] Erro ao enviar e-mail:", err);
  }
}

function baseTemplate(content: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#001D34;color:#fff;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#001D34,#0a2a4a);padding:24px;text-align:center;border-bottom:1px solid rgba(215,187,125,0.2)">
        <h1 style="margin:0;color:#D7BB7D;font-size:22px;letter-spacing:2px">BUILT ALLIANCES</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.4);font-size:12px">Plataforma de Alianças Estratégicas</p>
      </div>
      <div style="padding:32px">
        ${content}
      </div>
      <div style="padding:16px 32px;border-top:1px solid rgba(215,187,125,0.1);text-align:center">
        <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px">© Built Alliances • Rede de Alianças Estratégicas</p>
      </div>
    </div>
  `;
}

export async function enviarConvite(opts: {
  candidatoEmail: string;
  candidatoNome: string;
  comunidadeNome: string;
  invitadorNome: string;
  token: string;
}) {
  const link = `${BASE_URL}/convite/${opts.token}`;
  await send(
    opts.candidatoEmail,
    `Você foi convidado para a ${opts.comunidadeNome} — BUILT Alliances`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Convite para Comunidade BUILT</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.candidatoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">${opts.invitadorNome} te convidou para fazer parte da <strong style="color:#D7BB7D">${opts.comunidadeNome}</strong>, uma comunidade de negócios da rede BUILT Alliances.</p>
      <p style="color:rgba(255,255,255,0.7)">Clique no botão abaixo para conhecer a comunidade e preencher seu formulário de candidatura:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Convite e Candidatar-se</a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:12px">Se não reconhece este convite, pode ignorar este e-mail com segurança.</p>
    `)
  );
}

export async function notificarAliadoCandidatura(opts: {
  aliadoEmail: string;
  aliadoNome: string;
  candidatoNome: string;
  comunidadeNome: string;
  comunidadeId: string;
}) {
  await send(
    opts.aliadoEmail,
    `Nova candidatura na ${opts.comunidadeNome}`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Nova Candidatura Recebida</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.aliadoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)"><strong style="color:#D7BB7D">${opts.candidatoNome}</strong> preencheu o formulário de candidatura para a <strong>${opts.comunidadeNome}</strong>.</p>
      <p style="color:rgba(255,255,255,0.7)">Acesse a plataforma para revisar a candidatura e tomar uma decisão:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${BASE_URL}/comunidade" style="background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Candidatos</a>
      </div>
    `)
  );
}

export async function enviarAprovacao(opts: {
  candidatoEmail: string;
  candidatoNome: string;
  comunidadeNome: string;
  token: string;
}) {
  const link = `${BASE_URL}/adesao/${opts.token}`;
  await send(
    opts.candidatoEmail,
    `Sua candidatura foi aprovada! — ${opts.comunidadeNome}`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">🎉 Candidatura Aprovada!</h2>
      <p style="color:rgba(255,255,255,0.8)">Parabéns, <strong>${opts.candidatoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">Sua candidatura para a <strong style="color:#D7BB7D">${opts.comunidadeNome}</strong> foi aprovada.</p>
      <p style="color:rgba(255,255,255,0.7)">O próximo passo é assinar os termos de adesão. Clique no botão abaixo para continuar:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Aceitar Termos de Adesão</a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:12px">Este link é válido por 72 horas. Após aceitar os termos, você receberá as instruções de pagamento.</p>
    `)
  );
}

export async function enviarRejeicao(opts: {
  candidatoEmail: string;
  candidatoNome: string;
  comunidadeNome: string;
  invitadorEmail?: string;
  invitadorNome?: string;
}) {
  await send(
    opts.candidatoEmail,
    `Atualização sobre sua candidatura — ${opts.comunidadeNome}`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Candidatura não aprovada</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.candidatoNome}</strong>.</p>
      <p style="color:rgba(255,255,255,0.7)">Após análise, sua candidatura para a <strong style="color:#D7BB7D">${opts.comunidadeNome}</strong> não foi aprovada neste momento.</p>
      <p style="color:rgba(255,255,255,0.7)">Agradecemos seu interesse na rede BUILT Alliances. Novas oportunidades podem surgir no futuro.</p>
    `)
  );
  if (opts.invitadorEmail) {
    await send(
      opts.invitadorEmail,
      `Candidatura rejeitada — ${opts.comunidadeNome}`,
      baseTemplate(`
        <h2 style="color:#D7BB7D;margin-top:0">Candidatura não aprovada</h2>
        <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.invitadorNome || ""}</strong>.</p>
        <p style="color:rgba(255,255,255,0.7)">A candidatura de <strong style="color:#D7BB7D">${opts.candidatoNome}</strong> para a <strong>${opts.comunidadeNome}</strong> não foi aprovada.</p>
      `)
    );
  }
}

export async function enviarTermos(opts: {
  candidatoEmail: string;
  candidatoNome: string;
  comunidadeNome: string;
  token: string;
}) {
  const link = `${BASE_URL}/adesao/${opts.token}`;
  await send(
    opts.candidatoEmail,
    `[Lembrete] Termos de Adesão — ${opts.comunidadeNome}`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Lembrete: Termos de Adesão Pendentes</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.candidatoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">Você ainda não assinou os termos de adesão da <strong style="color:#D7BB7D">${opts.comunidadeNome}</strong>. Não perca seu acesso!</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Aceitar Termos de Adesão</a>
      </div>
    `)
  );
}

export async function enviarPagamento(opts: {
  candidatoEmail: string;
  candidatoNome: string;
  comunidadeNome: string;
  token: string;
  valor: string;
}) {
  const link = `${BASE_URL}/pagamento/${opts.token}`;
  await send(
    opts.candidatoEmail,
    `Instruções de Pagamento — ${opts.comunidadeNome}`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Pagamento da Adesão</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.candidatoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">Você aceitou os termos de adesão da <strong style="color:#D7BB7D">${opts.comunidadeNome}</strong>. Agora é só realizar o pagamento para se tornar um membro oficial.</p>
      <div style="background:rgba(215,187,125,0.1);border:1px solid rgba(215,187,125,0.3);border-radius:8px;padding:16px;margin:24px 0;text-align:center">
        <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0">Valor da Adesão</p>
        <p style="color:#D7BB7D;font-size:28px;font-weight:bold;margin:8px 0">${opts.valor}</p>
      </div>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Instruções de Pagamento</a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:12px">Você tem 24 horas para concluir o pagamento.</p>
    `)
  );
}

export async function enviarNovoMembro(opts: {
  emails: string[];
  novoMembroNome: string;
  comunidadeNome: string;
}) {
  const html = baseTemplate(`
    <h2 style="color:#D7BB7D;margin-top:0">🎉 Novo Membro na Comunidade!</h2>
    <p style="color:rgba(255,255,255,0.7)"><strong style="color:#D7BB7D">${opts.novoMembroNome}</strong> acabou de se tornar membro oficial da <strong>${opts.comunidadeNome}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)">Acesse a plataforma para conhecer o novo membro e ampliar sua rede de alianças:</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${BASE_URL}/comunidade" style="background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Comunidade</a>
    </div>
  `);
  for (const email of opts.emails) {
    await send(email, `Novo membro na ${opts.comunidadeNome}!`, html);
  }
}
