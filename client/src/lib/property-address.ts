export type PropertyAddressDraft = {
  cep?: unknown;
  endereco?: unknown;
  numero?: unknown;
  complemento?: unknown;
  bairro?: unknown;
  cidade?: unknown;
  estado?: unknown;
  pais?: unknown;
  [key: string]: unknown;
};

export type ViaCepAddress = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export function formatBrazilianCep(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  return {
    digits,
    formatted: digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits,
  };
}

export function mergeViaCepAddress<T extends PropertyAddressDraft>(current: T, address: ViaCepAddress): T {
  if (!address || address.erro) return current;
  const { formatted } = formatBrazilianCep(address.cep || current.cep);
  return {
    ...current,
    cep: formatted || current.cep,
    endereco: address.logradouro || current.endereco,
    complemento: address.complemento || current.complemento,
    bairro: address.bairro || current.bairro,
    cidade: address.localidade || current.cidade,
    estado: address.uf || current.estado,
    pais: "Brasil",
  };
}
