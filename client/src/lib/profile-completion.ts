export interface ProfileCompletionSource {
  nome?: unknown;
  nome_completo?: unknown;
  email?: unknown;
  cpf?: unknown;
  telefone?: unknown;
  whatsapp?: unknown;
  foto?: unknown;
  foto_perfil?: unknown;
  nacionalidade?: unknown;
  data_nascimento?: unknown;
  rg?: unknown;
  estado_civil?: unknown;
  regime_comunhao?: unknown;
  conjuge_nome_completo?: unknown;
  cidade?: unknown;
  estado?: unknown;
  pais?: unknown;
  endereco?: unknown;
  numero?: unknown;
  titular_endereco?: unknown;
  titular_numero?: unknown;
  titular_cidade?: unknown;
  titular_estado?: unknown;
  titular_pais?: unknown;
  empresa?: unknown;
  cnpj?: unknown;
  logo_empresa?: unknown;
  cargo?: unknown;
  profissao?: unknown;
  ramo_atuacao?: unknown;
  segmento?: unknown;
  area_atuacao?: unknown;
  especialidade?: unknown;
  especialidade_livre?: unknown;
  tipos_alianca?: unknown;
  idiomas?: unknown;
  perfil_aliado?: unknown;
  link_site?: unknown;
}

export interface ProfileCompletionItem {
  key: string;
  label: string;
  complete: boolean;
}

export interface ProfileCompletionResult {
  percentage: number;
  completedCount: number;
  totalCount: number;
  missing: ProfileCompletionItem[];
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasValue);
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  const text = String(value).trim().toLowerCase();
  return text !== "" && text !== "null" && text !== "undefined";
}

function allFilled(...values: unknown[]): boolean {
  return values.every(hasValue);
}

export function getProfileCompletion(profile?: ProfileCompletionSource | null): ProfileCompletionResult {
  const data = profile || {};
  const hasMainAddress = allFilled(data.endereco, data.numero, data.cidade, data.estado, data.pais);
  const hasFormalAddress = allFilled(
    data.titular_endereco,
    data.titular_numero,
    data.titular_cidade,
    data.titular_estado,
    data.titular_pais,
  );

  const checks: ProfileCompletionItem[] = [
    { key: "foto", label: "Foto de perfil", complete: hasValue(data.foto_perfil) || hasValue(data.foto) },
    { key: "nome", label: "Nome que aparecerá no perfil", complete: hasValue(data.nome) },
    { key: "email", label: "E-mail", complete: hasValue(data.email) },
    { key: "nome_completo", label: "Nome completo para formalização", complete: hasValue(data.nome_completo) },
    { key: "cpf", label: "CPF", complete: hasValue(data.cpf) },
    { key: "telefone", label: "Telefone", complete: hasValue(data.telefone) },
    { key: "whatsapp", label: "WhatsApp", complete: hasValue(data.whatsapp) },
    { key: "nacionalidade", label: "Nacionalidade", complete: hasValue(data.nacionalidade) },
    { key: "data_nascimento", label: "Data de nascimento", complete: hasValue(data.data_nascimento) },
    { key: "rg", label: "RG", complete: hasValue(data.rg) },
    { key: "estado_civil", label: "Estado civil", complete: hasValue(data.estado_civil) },
    { key: "localizacao", label: "Localização", complete: allFilled(data.cidade, data.estado, data.pais) },
    { key: "endereco", label: "Endereço completo", complete: hasMainAddress || hasFormalAddress },
    { key: "areas_contribuicao", label: "Áreas de contribuição", complete: hasValue(data.tipos_alianca) },
    { key: "cargo", label: "Cargo ou profissão", complete: hasValue(data.cargo) || hasValue(data.profissao) },
    { key: "ramo_atuacao", label: "Ramo de atuação", complete: hasValue(data.ramo_atuacao) },
    { key: "segmento", label: "Segmento", complete: hasValue(data.segmento) },
    { key: "area_atuacao", label: "Área de atuação", complete: hasValue(data.area_atuacao) },
    {
      key: "especialidade",
      label: "Especialidade",
      complete: hasValue(data.especialidade_livre) || hasValue(data.especialidade),
    },
    { key: "idiomas", label: "Idiomas", complete: hasValue(data.idiomas) },
    { key: "biografia", label: "Biografia", complete: hasValue(data.perfil_aliado) },
    { key: "site", label: "Site ou portfólio", complete: hasValue(data.link_site) },
  ];

  if (hasValue(data.empresa)) {
    checks.push(
      { key: "cnpj", label: "CNPJ da empresa", complete: hasValue(data.cnpj) },
      { key: "logo_empresa", label: "Marca da empresa", complete: hasValue(data.logo_empresa) },
    );
  }

  const estadoCivil = String(data.estado_civil || "").trim().toLowerCase();
  if (["casado", "casada", "uniao_estavel", "união estável"].includes(estadoCivil)) {
    checks.push(
      { key: "regime_comunhao", label: "Regime de comunhão", complete: hasValue(data.regime_comunhao) },
      { key: "conjuge_nome", label: "Nome do cônjuge", complete: hasValue(data.conjuge_nome_completo) },
    );
  }

  const completedCount = checks.filter((item) => item.complete).length;
  return {
    percentage: checks.length > 0 ? Math.round((completedCount / checks.length) * 100) : 0,
    completedCount,
    totalCount: checks.length,
    missing: checks.filter((item) => !item.complete),
  };
}
