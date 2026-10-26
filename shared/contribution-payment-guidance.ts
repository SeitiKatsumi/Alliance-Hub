export function payerMissingFields(payer: any): Array<'nome' | 'cpf' | 'cnpj'> {
  const fields: Array<'nome' | 'cpf' | 'cnpj'> = [];
  if (!String(payer?.nome || '').trim()) fields.push('nome');
  const document = String(payer?.cpf || payer?.cnpj || '').replace(/\D/g, '');
  if (![11, 14].includes(document.length)) fields.push(payer?.cpf || !payer?.cnpj ? 'cpf' : 'cnpj');
  return fields;
}

export type PaymentCorrection = { label: string; href: string };
export function paymentGuidance(input: { code: string; payer?: any; owner: string; viewer: string | null; canEditPayers?: boolean; bankHref?: string }) {
  const { code, owner, viewer } = input;
  let correction: PaymentCorrection | null = null;
  if (code === 'PAYER_PENDING') {
    const fields = payerMissingFields(input.payer);
    if (!fields.length) return { message: 'Cadastro do pagador atualizado. A emissão será reavaliada automaticamente; não crie outra cobrança.', correction };
    const labels = fields.map(field => field === 'nome' ? 'nome do pagador não informado' : field === 'cpf' ? 'CPF do pagador ausente ou incompleto (11 dígitos)' : 'CNPJ do pagador ausente ou incompleto (14 dígitos)');
    const field = fields[0];
    if (owner && viewer === owner) correction = { label: 'Corrigir meu cadastro', href: `/meu-perfil?campo=${field}` };
    else if (owner && input.canEditPayers) correction = { label: 'Corrigir cadastro do pagador', href: `/admin?tab=membros&editar=${encodeURIComponent(owner)}&campo=${field}` };
    return { message: `Não foi possível emitir: ${labels.join('; ')}. ${correction ? 'Corrija o cadastro para liberar a emissão.' : 'Peça ao pagador ou a um administrador para corrigir o cadastro.'}`, correction };
  }
  const accountMessages: Record<string, string> = {
    ACCOUNT_PENDING: 'A conta recebedora da BIA ainda não está habilitada ou aprovada.',
    ACCOUNT_MISMATCH: 'A credencial ou a aprovação da conta recebedora não corresponde ao vínculo da BIA.',
    ACCOUNT_CREDENTIAL_PENDING: 'A credencial própria da conta recebedora ainda não foi configurada.',
    CREDENTIAL_VAULT_NOT_CONFIGURED: 'O cofre de credenciais da integração não foi configurado no servidor.',
    CREDENTIAL_KEY_MISMATCH: 'A chave do cofre do servidor não corresponde à credencial armazenada.',
    CREDENTIAL_DECRYPTION_FAILED: 'Não foi possível acessar a credencial da conta recebedora.',
  };
  if (accountMessages[code]) {
    if (input.bankHref) correction = { label: 'Ver configuração da conta da BIA', href: input.bankHref };
    return { message: `${accountMessages[code]} Solicite a revisão ao responsável pela conta ou à administração.`, correction };
  }
  if (code === 'BILLING_DISABLED') return { message: 'A emissão está desabilitada na integração deste ambiente. Solicite a habilitação à administração.', correction };
  if (code === 'CREATE_UNKNOWN') return { message: 'O Asaas ainda não confirmou o resultado da emissão. Aguarde a conciliação; não crie outra cobrança.', correction };
  return { message: 'Não foi possível concluir a emissão. A causa ainda precisa ser verificada pela administração; não crie outra cobrança.', correction };
}
