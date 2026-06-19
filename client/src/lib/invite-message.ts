function formatInviteExpiration(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
}

export function formatBuiltInviteMessage(link: string, expiresAt?: string | null) {
  const expiration = formatInviteExpiration(expiresAt);

  return [
    "Quero te convidar pessoalmente para ser meu aliado na minha comunidade BUILT.",
    "Unimos fornecedores, profissionais do mercado imobiliário e parceiros de capital dispostos a converter esforço em patrimônio por meio de alianças integradas.",
    "Segue o link para acessar gratuitamente a vitrine, conhecer e participar:",
    link,
    "BUILT | Builders United for Investment Logistics and Trade®",
    "Build it. Own it.®",
    "",
    `⚠️ *Este convite é individual${expiration ? ` e expira em ${expiration}` : ""}*`,
  ].join("\n");
}
