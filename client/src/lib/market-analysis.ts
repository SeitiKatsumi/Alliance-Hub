export interface MarketComparable {
  titulo: string;
  url: string;
  tipo: string;
  bairro: string;
  cidade: string;
  localizacao: string;
  area_m2: number;
  preco_total: number;
  preco_m2: number;
  moeda: string;
  trecho?: string;
}

export interface MarketM2Analysis {
  success?: boolean;
  amostra_suficiente: boolean;
  quantidade_comparaveis: number;
  area_min: number;
  area_max: number;
  comparaveis: MarketComparable[];
  classificacao?: "abaixo" | "media" | "acima";
  preco_m2_informado?: number;
  referencia_m2_min?: number;
  referencia_m2_max?: number;
  referencia_m2_media?: number;
  diferenca_percentual?: number;
  confianca?: "baixa" | "media" | "alta";
  resumo?: string;
  fatores?: string[];
  observacao?: string;
  fontes?: Array<{ titulo: string; url: string; trecho?: string }>;
  valor_total?: number;
  area_m2?: number;
}
