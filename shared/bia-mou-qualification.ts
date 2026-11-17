export type MouQualification = Record<string, string | boolean>;
export const MOU_PERSON_FIELDS = [
  ['nome_completo', 'Nome completo'], ['nacionalidade', 'Nacionalidade'],
  ['nome_mae', 'Nome da mãe'], ['nome_pai', 'Nome do pai'],
  ['data_nascimento', 'Data de nascimento'], ['profissao', 'Profissão'],
  ['email', 'E-mail'], ['telefone', 'Telefone'], ['cpf', 'CPF'], ['rg', 'RG'],
] as const;
export const MOU_ADDRESS_FIELDS = [
  ['endereco', 'Endereço'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['estado', 'Estado'], ['pais', 'País'],
] as const;
export const mouIsMarried = (data: MouQualification) => ['casado', 'casada'].includes(String(data.estado_civil || '').toLowerCase());

export function mouRequiredFields(data: MouQualification): [string, string][] {
  const fields: [string, string][] = [...MOU_PERSON_FIELDS.map(([k, v]): [string, string] => [k, v]), ['estado_civil', 'Estado civil']];
  if (mouIsMarried(data)) {
    fields.push(['regime_comunhao', 'Regime de comunhão'], ...MOU_PERSON_FIELDS.map(([k, v]): [string, string] => ['conjuge_' + k, v + ' do cônjuge']));
  }
  const prefixes = mouIsMarried(data) && data.mesmo_endereco !== true && data.mesmo_endereco !== 'true' ? ['titular_', 'conjuge_'] : [''];
  for (const prefix of prefixes) fields.push(...MOU_ADDRESS_FIELDS.map(([k, v]): [string, string] => [prefix + k, v + (prefix === 'titular_' ? ' do titular' : prefix ? ' do cônjuge' : '')]));
  return fields;
}

// Same required qualification for platform members and external signatories.
export function validateMouQualification(value: unknown) {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as MouQualification : {};
  const missing = mouRequiredFields(data).filter(([key]) => !String(data[key] || '').trim()).map(([, label]) => label);
  return { ok: missing.length === 0, missing, data };
}

// Only qualification fields may enter an external draft, never acceptance evidence.
export function pickGuestQualification(value: unknown, verifiedEmail: string): MouQualification {
  const body = value && typeof value === 'object' && !Array.isArray(value) ? value as MouQualification : {};
  const data: MouQualification = { mesmo_endereco: body.mesmo_endereco === true, email: verifiedEmail };
  for (const [key] of mouRequiredFields(body)) {
    if (key !== 'email' && typeof body[key] === 'string') data[key] = String(body[key]).trim().slice(0, 500);
  }
  return data;
}

export type GuestFormalization = {
  dados: MouQualification | null;
  mouDisponivel: boolean;
};
export type GuestMouReview = {
  titulo: string; versao: string; texto: string; map_revisao: number; hash: string;
};
