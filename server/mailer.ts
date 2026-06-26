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
const BASE_URL = process.env.APP_URL || "https://app.builtalliances.com";

const WINDOWS_1252_BYTE_BY_CHAR: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function decodeMojibakeUtf8(value: string): string {
  let text = value;

  for (let attempt = 0; attempt < 3 && /[ÃÂâðï¿½]/.test(text); attempt++) {
    const bytes: number[] = [];
    let canDecode = true;

    for (const char of text) {
      const code = char.charCodeAt(0);
      const byte = code <= 0xff ? code : WINDOWS_1252_BYTE_BY_CHAR[code];
      if (byte === undefined) {
        canDecode = false;
        break;
      }
      bytes.push(byte);
    }

    if (!canDecode) break;

    const decoded = Buffer.from(bytes).toString("utf8");
    if (!decoded || decoded === text || decoded.includes("\uFFFD")) break;
    text = decoded;
  }

  return text
    .replace(/ï¿½/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/\u00A0/g, " ");
}

async function send(to: string, subject: string, html: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const safeTo = to.replace(/^(.{2}).*(@.*)$/, "$1***$2");
  const cleanSubject = decodeMojibakeUtf8(subject);
  const cleanHtml = decodeMojibakeUtf8(html);
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject: cleanSubject,
      html: cleanHtml,
      encoding: "utf-8",
    });
    console.log(`[mailer] Email accepted by SMTP: to=${safeTo} subject="${cleanSubject}" messageId=${info.messageId || "n/a"}`);
    return { ok: true, messageId: info.messageId };
  } catch (err: any) {
    // Email failures are logged but not re-thrown so SMTP errors never break
    // API routes that have already committed a DB change.
    console.error(`[mailer] Failed to send email to ${safeTo} ("${cleanSubject}"): ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function baseTemplate(content: string): string {
  return `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#f5f7fb">
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#001D34;color:#fff;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#001D34,#0a2a4a);padding:28px 24px;text-align:center;border-bottom:1px solid rgba(215,187,125,0.2)">
        <img src="${BASE_URL}/built-logo-horizontal-branca-email.png?v=20260514" alt="BUILT Alliances" style="width:280px;max-width:88%;height:auto;display:inline-block" />
      </div>
      <div style="padding:32px">
        ${content}
      </div>
      <div style="padding:16px 32px;border-top:1px solid rgba(215,187,125,0.1);text-align:center">
        <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px">© Built Alliances • Rede de Alianças Estratégicas</p>
      </div>
    </div>
    </body>
    </html>
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
  return send(
    opts.candidatoEmail,
    `Você foi convidado para a ${opts.comunidadeNome} — BUILT Alliances`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Convite para Comunidade BUILT</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.candidatoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">${opts.invitadorNome} te convidou para fazer parte da <strong style="color:#D7BB7D">${opts.comunidadeNome}</strong>, uma comunidade de negócios da rede BUILT Alliances.</p>
      <p style="color:rgba(255,255,255,0.7)">Clique no botão abaixo para conhecer a comunidade e preencher seu formulário de candidatura:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Demonstre interesse</a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:12px">Se não reconhece este convite, pode ignorar este e-mail com segurança.</p>
    `)
  );
}

export async function notificarAliadoCandidatura(opts: {
  aliadoEmail: string;
  aliadoNome: string;
  candidatoNome: string;
  candidatoEmail?: string;
  comunidadeNome: string;
  comunidadeId: string;
  interesses?: string[];
}) {
  const INTERESSE_LABELS: Record<string, string> = {
    vitrine: "Vitrine",
    capital: "Capital",
    membros: "Área de Alianças",
  };
  const interessesArr = opts.interesses ?? [];
  const interessesList = interessesArr.length > 0
    ? interessesArr.map((i) => INTERESSE_LABELS[i] ?? i).join(", ")
    : null;
  const hasAliancas = interessesArr.includes("membros");

  const emailLine = opts.candidatoEmail
    ? `<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:4px 0 0">E-mail: <strong>${opts.candidatoEmail}</strong></p>`
    : "";
  const interessesLine = interessesList
    ? `<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:4px 0 0">Áreas de interesse: <strong style="color:#D7BB7D">${interessesList}</strong></p>`
    : "";
  const aliancasNote = hasAliancas
    ? `<div style="background:rgba(215,187,125,0.08);border-left:3px solid rgba(215,187,125,0.4);padding:12px 16px;margin:20px 0;border-radius:0 6px 6px 0"><p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px">Este candidato selecionou <strong style="color:#D7BB7D">Área de Alianças</strong> — ele seguirá para o pagamento antes da aprovação formal.</p></div>`
    : "";

  await send(
    opts.aliadoEmail,
    `Nova candidatura na ${opts.comunidadeNome}`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Nova Candidatura Recebida</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.aliadoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)"><strong style="color:#D7BB7D">${opts.candidatoNome}</strong> se cadastrou como candidato na <strong>${opts.comunidadeNome}</strong>.</p>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(215,187,125,0.2);border-radius:8px;padding:16px;margin:20px 0">
        <p style="color:rgba(255,255,255,0.8);margin:0;font-weight:bold">${opts.candidatoNome}</p>
        ${emailLine}
        ${interessesLine}
      </div>
      ${aliancasNote}
      <p style="color:rgba(255,255,255,0.7)">Acesse a plataforma para revisar a candidatura e tomar uma decisão:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${BASE_URL}/notificacoes" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Candidatos</a>
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
  return send(
    opts.candidatoEmail,
    `Sua candidatura foi aprovada! — ${opts.comunidadeNome}`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">🎉 Candidatura Aprovada!</h2>
      <p style="color:rgba(255,255,255,0.8)">Parabéns, <strong>${opts.candidatoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">Sua candidatura para a <strong style="color:#D7BB7D">${opts.comunidadeNome}</strong> foi aprovada.</p>
      <p style="color:rgba(255,255,255,0.7)">O próximo passo é assinar os termos de adesão. Clique no botão abaixo para continuar:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Aceitar Termos de Adesão</a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:12px">Este link é válido por 12 horas. Após aceitar os termos, você receberá as instruções de pagamento.</p>
    `)
  );
}

export async function enviarConviteAdesaoMembro(opts: {
  candidatoEmail: string;
  candidatoNome: string;
  comunidadeNome: string;
  invitadorNome: string;
  token: string;
}) {
  const link = `${BASE_URL}/adesao/${opts.token}`;
  return send(
    opts.candidatoEmail,
    `Convite de adesao BUILT - ${opts.comunidadeNome}`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Continue sua adesao BUILT</h2>
      <p style="color:rgba(255,255,255,0.8)">Ola, <strong>${opts.candidatoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">Voce solicitou acesso para se tornar membro da <strong style="color:#D7BB7D">${opts.comunidadeNome}</strong>.</p>
      <p style="color:rgba(255,255,255,0.7)">Este convite foi vinculado a sua comunidade de origem e ao seu convidador, <strong>${opts.invitadorNome}</strong>. Clique abaixo para iniciar o fluxo de adesao e liberar a manifestacao de interesse em OPAs apos receber o selo Proud Member.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Iniciar adesao</a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:12px">Se voce nao solicitou este convite, pode ignorar este e-mail com seguranca.</p>
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
        <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Aceitar Termos de Adesão</a>
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
        <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Instruções de Pagamento</a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:12px">Você tem 24 horas para concluir o pagamento.</p>
    `)
  );
}

export async function enviarNovoMembro(opts: {
  emails: string[];
  novoMembroNome: string;
  comunidadeNome: string;
  novoMembroId?: string;
}) {
  const link = opts.novoMembroId ? `${BASE_URL}/vitrine/${opts.novoMembroId}` : `${BASE_URL}/comunidade`;
  const html = baseTemplate(`
    <h2 style="color:#D7BB7D;margin-top:0">🎉 Novo Membro na Comunidade!</h2>
    <p style="color:rgba(255,255,255,0.7)"><strong style="color:#D7BB7D">${opts.novoMembroNome}</strong> acabou de se tornar membro oficial da <strong>${opts.comunidadeNome}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)">Acesse a plataforma para conhecer o novo membro e ampliar sua rede de alianças:</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Perfil do Membro</a>
    </div>
  `);
  for (const email of opts.emails) {
    await send(email, `Novo membro na ${opts.comunidadeNome}!`, html);
  }
}

export async function enviarResetSenha(opts: {
  email: string;
  nome: string;
  token: string;
}) {
  const link = `${BASE_URL}/login?reset=${opts.token}`;
  return send(
    opts.email,
    "Redefinição de senha — BUILT Alliances",
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Redefinição de Senha</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.nome || "membro"}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">Recebemos uma solicitação de redefinição de senha para sua conta na plataforma BUILT Alliances.</p>
      <p style="color:rgba(255,255,255,0.7)">Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Redefinir minha senha</a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:12px">Se você não solicitou esta redefinição, ignore este e-mail — sua senha permanece a mesma.</p>
    `)
  );
}

export async function enviarSolicitacaoBiaParaAliado(opts: {
  aliadoEmail: string;
  aliadoNome: string;
  diretorNome: string;
  biaNome: string;
  comunidadeNome: string;
  aprovacaoId: string;
}) {
  const link = `${BASE_URL}/bias`;
  const html = baseTemplate(`
    <h2 style="color:#D7BB7D;margin-top:0">Nova BIA aguardando sua aprovação</h2>
    <p style="color:rgba(255,255,255,0.8)">Olá, <strong style="color:#D7BB7D">${opts.aliadoNome}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)">O Diretor de Aliança <strong>${opts.diretorNome}</strong> criou uma nova BIA que precisa da sua aprovação como Aliado BUILT da <strong>${opts.comunidadeNome}</strong>.</p>
    <div style="background:rgba(215,187,125,0.08);border:1px solid rgba(215,187,125,0.2);border-radius:8px;padding:16px;margin:20px 0">
      <p style="color:#D7BB7D;margin:0;font-weight:bold;font-size:15px">${opts.biaNome}</p>
      <p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:12px">Solicitada por ${opts.diretorNome}</p>
    </div>
    <p style="color:rgba(255,255,255,0.7)">Acesse a plataforma para aprovar ou rejeitar esta BIA.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver BIAs Pendentes</a>
    </div>
  `);
  await send(opts.aliadoEmail, `BIA "${opts.biaNome}" aguarda sua aprovação`, html);
}

export async function enviarResultadoAprovacaoBia(opts: {
  diretorEmail: string;
  diretorNome: string;
  biaNome: string;
  aprovado: boolean;
  motivo?: string;
}) {
  const html = baseTemplate(opts.aprovado
    ? `
      <h2 style="color:#D7BB7D;margin-top:0">✅ Sua BIA foi aprovada!</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong style="color:#D7BB7D">${opts.diretorNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">O Aliado BUILT aprovou sua BIA <strong>${opts.biaNome}</strong>. Ela já está ativa na plataforma.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${BASE_URL}/bias" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver minha BIA</a>
      </div>
    `
    : `
      <h2 style="color:#D7BB7D;margin-top:0">BIA não aprovada</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong style="color:#D7BB7D">${opts.diretorNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">O Aliado BUILT não aprovou a BIA <strong>${opts.biaNome}</strong> por enquanto.</p>
      ${opts.motivo ? `<div style="background:rgba(255,255,255,0.05);border-left:3px solid rgba(215,187,125,0.4);padding:12px 16px;margin:16px 0"><p style="color:rgba(255,255,255,0.6);margin:0;font-size:13px">${opts.motivo}</p></div>` : ""}
      <p style="color:rgba(255,255,255,0.5);font-size:12px">Entre em contato com o Aliado BUILT da sua comunidade para mais informações.</p>
    `
  );
  const subject = opts.aprovado
    ? `✅ BIA "${opts.biaNome}" aprovada!`
    : `BIA "${opts.biaNome}" não aprovada`;
  await send(opts.diretorEmail, subject, html);
}

export async function enviarSolicitacaoDiretoriaBia(opts: {
  diretorEmail: string;
  diretorNome: string;
  biaNome: string;
  papel: string;
  percentual?: string | number | null;
  solicitanteNome?: string | null;
}) {
  const percentualText = opts.percentual !== null && opts.percentual !== undefined && String(opts.percentual) !== ""
    ? `${opts.percentual}%`
    : "percentual não informado";
  const html = baseTemplate(`
    <h2 style="color:#D7BB7D;margin-top:0">Convite para diretoria de BIA</h2>
    <p style="color:rgba(255,255,255,0.8)">Olá, <strong style="color:#D7BB7D">${opts.diretorNome || "membro"}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)">Você foi indicado para atuar como <strong>${opts.papel}</strong> na BIA <strong>${opts.biaNome}</strong>.</p>
    <div style="background:rgba(215,187,125,0.08);border:1px solid rgba(215,187,125,0.2);border-radius:8px;padding:16px;margin:20px 0">
      <p style="color:#D7BB7D;margin:0;font-weight:bold;font-size:15px">${opts.biaNome}</p>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px">Papel: ${opts.papel}</p>
      <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px">Percentual: ${percentualText}</p>
      ${opts.solicitanteNome ? `<p style="color:rgba(255,255,255,0.45);margin:8px 0 0;font-size:12px">Indicado por ${opts.solicitanteNome}</p>` : ""}
    </div>
    <p style="color:rgba(255,255,255,0.7)">Acesse a plataforma para aceitar ou recusar esta diretoria.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${BASE_URL}/notificacoes" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Responder solicitação</a>
    </div>
  `);
  await send(opts.diretorEmail, `Convite para ${opts.papel} — ${opts.biaNome}`, html);
}

export async function enviarSolicitacaoSocioBia(opts: {
  socioEmail: string;
  socioNome: string;
  biaNome: string;
  papel: string;
  solicitanteNome?: string | null;
}) {
  const html = baseTemplate(`
    <h2 style="color:#D7BB7D;margin-top:0">Convite para participar de BIA</h2>
    <p style="color:rgba(255,255,255,0.8)">Ola, <strong style="color:#D7BB7D">${opts.socioNome || "membro"}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)">Voce foi indicado para atuar como <strong>${opts.papel}</strong> na BIA <strong>${opts.biaNome}</strong>.</p>
    <div style="background:rgba(215,187,125,0.08);border:1px solid rgba(215,187,125,0.2);border-radius:8px;padding:16px;margin:20px 0">
      <p style="color:#D7BB7D;margin:0;font-weight:bold;font-size:15px">${opts.biaNome}</p>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px">Papel: ${opts.papel}</p>
      ${opts.solicitanteNome ? `<p style="color:rgba(255,255,255,0.45);margin:8px 0 0;font-size:12px">Indicado por ${opts.solicitanteNome}</p>` : ""}
    </div>
    <p style="color:rgba(255,255,255,0.7)">Acesse a plataforma para aceitar ou recusar este convite.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${BASE_URL}/notificacoes" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Responder convite</a>
    </div>
  `);
  await send(opts.socioEmail, `Convite para ${opts.papel} - ${opts.biaNome}`, html);
}

export async function enviarRespostaSolicitacaoBia(opts: {
  destinatarioEmail: string;
  destinatarioNome?: string | null;
  convidadoNome?: string | null;
  biaNome: string;
  papel: string;
  aceito: boolean;
}) {
  const titulo = opts.aceito ? "Convite aceito" : "Convite recusado";
  const cor = opts.aceito ? "#22C55E" : "#EF4444";
  const html = baseTemplate(`
    <h2 style="color:${cor};margin-top:0">${titulo}</h2>
    <p style="color:rgba(255,255,255,0.8)">Ola, <strong style="color:#D7BB7D">${opts.destinatarioNome || "membro"}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)"><strong>${opts.convidadoNome || "O convidado"}</strong> ${opts.aceito ? "aceitou" : "recusou"} o convite para atuar como <strong>${opts.papel}</strong> na BIA <strong>${opts.biaNome}</strong>.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${BASE_URL}/notificacoes" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver notificacoes</a>
    </div>
  `);
  await send(opts.destinatarioEmail, `${titulo}: ${opts.papel} - ${opts.biaNome}`, html);
}

export async function enviarNovoIntegranteBia(opts: {
  destinatarioEmail: string;
  destinatarioNome?: string | null;
  novoNome?: string | null;
  biaNome: string;
  papel: string;
}) {
  const html = baseTemplate(`
    <h2 style="color:#D7BB7D;margin-top:0">Novo integrante confirmado na BIA</h2>
    <p style="color:rgba(255,255,255,0.8)">Ola, <strong style="color:#D7BB7D">${opts.destinatarioNome || "membro"}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)"><strong>${opts.novoNome || "Um novo membro"}</strong> aceitou o MOU Padrao BUILT e agora atua como <strong>${opts.papel}</strong> na BIA <strong>${opts.biaNome}</strong>.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${BASE_URL}/area-aliancas?tab=bias" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver BIA</a>
    </div>
  `);
  await send(opts.destinatarioEmail, `Novo integrante na BIA ${opts.biaNome}`, html);
}

export async function enviarChamadaAlianca(opts: {
  destinatarioEmail: string;
  destinatarioNome?: string | null;
  destinatarioMembroId?: string | null;
  titulo: string;
  biaNome?: string | null;
  escopo: string;
  dataHora: string | Date;
  linkReuniao: string;
  nucleo?: string | null;
  opaId?: string | null;
}) {
  const data = new Date(opts.dataHora);
  const dataText = Number.isNaN(data.getTime())
    ? String(opts.dataHora)
    : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const calendarStart = Number.isNaN(data.getTime()) ? new Date() : data;
  const calendarEnd = new Date(calendarStart.getTime() + 60 * 60 * 1000);
  const toCalendarDate = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const opaLink = opts.opaId ? `${BASE_URL}/opas/${opts.opaId}` : `${BASE_URL}/notificacoes`;
  const calendarDetails = [
    `Chamada para aliança vinculada a BIA ${opts.biaNome || "BUILT"}.`,
    opts.nucleo ? `Núcleo: ${opts.nucleo}.` : null,
    `Escopo: ${opts.escopo}.`,
    `Link da reunião: ${opts.linkReuniao}`,
    opts.opaId ? `OPA: ${opaLink}` : null,
  ].filter(Boolean).join("\n");
  const googleCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(opts.titulo)}&dates=${toCalendarDate(calendarStart)}/${toCalendarDate(calendarEnd)}&details=${encodeURIComponent(calendarDetails)}&location=${encodeURIComponent(opts.linkReuniao)}`;
  const platformAgendaParams = new URLSearchParams({
    titulo: opts.titulo,
    biaNome: opts.biaNome || "",
    escopo: opts.escopo,
    dataHora: calendarStart.toISOString(),
    linkReuniao: opts.linkReuniao,
    nucleo: opts.nucleo || "",
    opaId: opts.opaId || "",
    membroId: opts.destinatarioMembroId || "",
    google: googleCalendarLink,
  });
  const calendarLink = `${BASE_URL}/api/chamadas-alianca/adicionar-agenda?${platformAgendaParams.toString()}`;
  const html = baseTemplate(`
    <h2 style="color:#D7BB7D;margin-top:0">${opts.titulo}</h2>
    <p style="color:rgba(255,255,255,0.8)">Ola, <strong style="color:#D7BB7D">${opts.destinatarioNome || "membro"}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)">Voce recebeu uma chamada para participar da alianca vinculada a BIA <strong>${opts.biaNome || "BUILT"}</strong>.</p>
    <div style="background:rgba(215,187,125,0.08);border:1px solid rgba(215,187,125,0.2);border-radius:8px;padding:16px;margin:20px 0">
      <p style="color:#D7BB7D;margin:0;font-weight:bold;font-size:15px">${opts.titulo}</p>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px">Escopo: ${opts.escopo}</p>
      ${opts.nucleo ? `<p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px">Nucleo: ${opts.nucleo}</p>` : ""}
      <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px">Data: ${dataText}</p>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${opaLink}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;margin:6px">Acessar OPA</a>
      <a href="${calendarLink}" style="display:inline-block;background-color:transparent;color:#D7BB7D;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;border:1px solid rgba(215,187,125,0.55);margin:6px">Adicionar a agenda</a>
    </div>
    <p style="color:rgba(255,255,255,0.45);font-size:12px">Voce tambem pode acompanhar esta chamada em ${BASE_URL}/notificacoes.</p>
  `);
  await send(opts.destinatarioEmail, opts.titulo, html);
}

export async function notificarInteresseOpa(opts: {
  destinatarioEmail: string;
  destinatarioNome: string;
  papel: string;
  membroNome: string;
  membroId?: string | null;
  opaNome: string;
  biaNome: string;
  mensagem?: string | null;
  multiplicador?: string | null;
}) {
  const multLine = opts.multiplicador
    ? `<tr><td style="color:rgba(255,255,255,0.5);font-size:12px;padding:4px 0">Multiplicador proposto</td><td style="color:#D7BB7D;font-size:13px;font-weight:bold;padding:4px 0">${opts.multiplicador}%</td></tr>`
    : "";
  const msgBlock = opts.mensagem
    ? `<div style="background:rgba(255,255,255,0.04);border-left:3px solid rgba(215,187,125,0.35);padding:10px 14px;margin:16px 0;border-radius:0 6px 6px 0"><p style="color:rgba(255,255,255,0.65);margin:0;font-size:13px;font-style:italic">"${opts.mensagem}"</p></div>`
    : "";
  await send(
    opts.destinatarioEmail,
    `Interesse manifestado na OPA "${opts.opaNome}"`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Interesse manifestado em OPA</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.destinatarioNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">O membro <strong style="color:#D7BB7D">${opts.membroNome}</strong> manifestou interesse na seguinte OPA da BIA <strong>${opts.biaNome}</strong>:</p>
      <div style="background:rgba(215,187,125,0.07);border:1px solid rgba(215,187,125,0.2);border-radius:8px;padding:16px;margin:20px 0">
        <p style="color:#D7BB7D;margin:0;font-weight:bold;font-size:15px">${opts.opaNome}</p>
        <table style="width:100%;margin-top:10px;border-collapse:collapse">
          ${multLine}
        </table>
      </div>
      ${msgBlock}
      <p style="color:rgba(255,255,255,0.6);font-size:13px">Você está recebendo esta notificação como <strong>${opts.papel}</strong> desta BIA.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${opts.membroId ? `${BASE_URL}/vitrine/${opts.membroId}` : `${BASE_URL}/membros`}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Perfil</a>
      </div>
    `)
  );
}

export async function notificarInvitadorAvaliarAura(opts: {
  invitadorEmail: string;
  invitadorNome: string;
  candidatoNome: string;
  comunidadeNome: string;
  avaliacaoToken: string;
}) {
  const link = `${BASE_URL}/avaliar-aura/${opts.avaliacaoToken}`;
  await send(
    opts.invitadorEmail,
    `Registre a Percepção de Aura de ${opts.candidatoNome} — BUILT Alliances`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">✨ Registre a Percepção de Aura</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.invitadorNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)"><strong style="color:#D7BB7D">${opts.candidatoNome}</strong> aceitou os Termos de Adesão da <strong>${opts.comunidadeNome}</strong> e concluiu seu acesso inicial à plataforma.</p>
      <p style="color:rgba(255,255,255,0.7)">Na BUILT, reputação antecede participação. Como você foi responsável pelo convite, sua leitura contribui para contextualizar a reputação, a postura e o potencial de contribuição do candidato.</p>
      <div style="background:rgba(215,187,125,0.08);border:1px solid rgba(215,187,125,0.2);border-radius:8px;padding:16px;margin:20px 0">
        <p style="color:rgba(255,255,255,0.6);margin:0;font-size:13px">Registre até <strong style="color:#D7BB7D">3 palavras</strong> que representem, na sua visão, as principais qualidades, atitudes ou características percebidas em ${opts.candidatoNome} dentro da rede BUILT.</p>
      </div>
      <p style="color:rgba(255,255,255,0.7)">Após o registro, o Aliado BUILT será notificado para dar continuidade à análise da candidatura.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Registrar Percepção de Aura</a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:12px">Este link é pessoal e intransferível.</p>
    `)
  );
}

export async function notificarAliadoAposAuraInvitador(opts: {
  aliadoEmail: string;
  aliadoNome: string;
  candidatoNome: string;
  candidatoEmail?: string;
  candidatoId: string;
  invitadorNome: string;
  auraScore?: number | null;
  auraFaixa?: string | null;
  auraPalavras?: string[];
  comunidadeNome: string;
  comunidadeId: string;
}) {
  const candidatoLink = `${BASE_URL}/vitrine/${opts.candidatoId}`;
  const painelLink = `${BASE_URL}/notificacoes`;
  const auraBlock = opts.auraFaixa
    ? `<div style="background:rgba(215,187,125,0.08);border:1px solid rgba(215,187,125,0.2);border-radius:8px;padding:16px;margin:20px 0">
        <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.1em">Percepção de Aura registrada pelo convidador</p>
        <p style="color:#D7BB7D;font-size:17px;font-weight:bold;margin:0 0 4px">${opts.auraFaixa}${opts.auraScore != null ? ` — ${opts.auraScore.toFixed(1)}` : ""}</p>
        ${opts.auraPalavras?.length ? `<p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0">${opts.auraPalavras.join(" · ")}</p>` : ""}
      </div>`
    : "";
  await send(
    opts.aliadoEmail,
    `Nova candidatura com Aura registrada — ${opts.candidatoNome}`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Candidatura Pronta para Análise</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.aliadoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)"><strong style="color:#D7BB7D">${opts.candidatoNome}</strong> aceitou os termos de adesão da <strong>${opts.comunidadeNome}</strong> e teve sua Aura avaliada por <strong>${opts.invitadorNome}</strong>.</p>
      ${auraBlock}
      <p style="color:rgba(255,255,255,0.7)">Acesse o painel de candidatos para analisar o perfil e tomar a decisão:</p>
      <div style="text-align:center;margin:28px 0 12px">
        <a href="${painelLink}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Candidatos</a>
      </div>
      <div style="text-align:center;margin:0 0 24px">
        <a href="${candidatoLink}" style="color:#D7BB7D;font-size:13px;text-decoration:underline">Ver Perfil de ${opts.candidatoNome}</a>
      </div>
    `)
  );
}

export async function enviarLembreteTermos(opts: {
  candidatoEmail: string;
  candidatoNome: string;
  comunidadeNome: string;
  conviteToken: string;
  intervalHours: 24 | 48 | 72;
}) {
  const link = `${BASE_URL}/adesao/${opts.conviteToken}`;
  await send(
    opts.candidatoEmail,
    `Lembrete: Termos de Adesão aguardando sua assinatura — BUILT Alliances`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">⏰ Termos aguardando você</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.candidatoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">
        ${opts.intervalHours === 72
          ? `Este é o último lembrete sobre os Termos de Adesão da <strong>${opts.comunidadeNome}</strong>. Após este prazo, o seu convite será expirado automaticamente.`
          : `Há ${opts.intervalHours}h você se cadastrou na plataforma BUILT Alliances, mas ainda não aceitou os Termos de Adesão da <strong>${opts.comunidadeNome}</strong>.`
        }
      </p>
      <p style="color:rgba(255,255,255,0.7)">Acesse o link abaixo para ler e aceitar os termos:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Aceitar Termos de Adesão</a>
      </div>
    `)
  );
}

export async function notificarAliadoConviteExpirado(opts: {
  aliadoEmail: string;
  aliadoNome: string;
  candidatoNome: string;
  comunidadeNome: string;
}) {
  await send(
    opts.aliadoEmail,
    `Convite expirado — ${opts.candidatoNome} não aceitou os termos`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Convite Expirado</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.aliadoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">O candidato <strong style="color:#D7BB7D">${opts.candidatoNome}</strong> não aceitou os Termos de Adesão da <strong>${opts.comunidadeNome}</strong> dentro do prazo de 72 horas e o convite foi expirado automaticamente.</p>
      <p style="color:rgba(255,255,255,0.7)">Um novo link de convite pode ser gerado pelo membro que fez o convite original, se necessário.</p>
    `)
  );
}

export async function enviarRejeicaoVitrine(opts: {
  candidatoEmail: string;
  candidatoNome: string;
  comunidadeNome: string;
  invitadorEmail?: string;
  invitadorNome?: string;
}) {
  await send(
    opts.candidatoEmail,
    `Candidatura não aprovada — BUILT Alliances`,
    baseTemplate(`
      <h2 style="color:#D7BB7D;margin-top:0">Candidatura não aprovada</h2>
      <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.candidatoNome}</strong>!</p>
      <p style="color:rgba(255,255,255,0.7)">Após análise do Aliado BUILT da comunidade <strong>${opts.comunidadeNome}</strong>, sua candidatura não foi aprovada neste momento.</p>
      <p style="color:rgba(255,255,255,0.5);font-size:13px">Se tiver dúvidas, entre em contato com quem te convidou para a rede BUILT.</p>
    `)
  );
  if (opts.invitadorEmail) {
    await send(
      opts.invitadorEmail,
      `Candidatura rejeitada — ${opts.candidatoNome}`,
      baseTemplate(`
        <h2 style="color:#D7BB7D;margin-top:0">Candidatura não aprovada</h2>
        <p style="color:rgba(255,255,255,0.8)">Olá, <strong>${opts.invitadorNome}</strong>!</p>
        <p style="color:rgba(255,255,255,0.7)">A candidatura de <strong style="color:#D7BB7D">${opts.candidatoNome}</strong> para a comunidade <strong>${opts.comunidadeNome}</strong> não foi aprovada pelo Aliado BUILT.</p>
      `)
    );
  }
}

export async function enviarAprovacaoVitrine(opts: {
  candidatoEmail: string;
  candidatoNome: string;
  comunidadeNome: string;
}) {
  const link = `${BASE_URL}/`;
  const html = baseTemplate(`
    <h2 style="color:#D7BB7D;margin-top:0">Parabéns, você foi aprovado!</h2>
    <p style="color:rgba(255,255,255,0.7)">Olá, <strong style="color:#D7BB7D">${opts.candidatoNome}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)">Sua aprovação pelo Aliado BUILT da comunidade <strong>${opts.comunidadeNome}</strong> foi concluída.</p>
    <p style="color:rgba(255,255,255,0.7)">Seu acesso à plataforma BUILT está liberado. Clique no botão abaixo para entrar no site.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${link}" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Acessar o site</a>
    </div>
    <p style="color:rgba(255,255,255,0.55);font-size:13px">Bem-vindo à rede BUILT.</p>
  `);
  await send(opts.candidatoEmail, "Parabéns, você foi aprovado na BUILT!", html);
}

export async function enviarAprovacaoVitrineInvitador(opts: {
  invitadorEmail: string;
  invitadorNome: string;
  candidatoNome: string;
  comunidadeNome: string;
}) {
  const html = baseTemplate(`
    <h2 style="color:#D7BB7D;margin-top:0">✅ Seu convidado foi aprovado!</h2>
    <p style="color:rgba(255,255,255,0.7)">Olá, <strong style="color:#D7BB7D">${opts.invitadorNome}</strong>!</p>
    <p style="color:rgba(255,255,255,0.7)">O candidato <strong>${opts.candidatoNome}</strong> que você convidou foi aprovado pelo Aliado BUILT e já pode acessar a nossa plataforma.</p>
    <p style="color:rgba(255,255,255,0.7)">Sua contribuição fortalece a <strong>${opts.comunidadeNome}</strong>!</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${BASE_URL}/comunidade" style="display:inline-block;background-color:#D7BB7D;background:linear-gradient(135deg,#D7BB7D,#b89a50);color:#001D34;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver Comunidade</a>
    </div>
  `);
  await send(opts.invitadorEmail, `${opts.candidatoNome} foi aprovado na ${opts.comunidadeNome}!`, html);
}
