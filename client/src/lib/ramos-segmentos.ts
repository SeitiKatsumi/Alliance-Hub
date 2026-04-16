export interface SegmentoItem {
  codigo: string;
  nome: string;
}

export interface RamoItem {
  codigo: string;
  nome: string;
  segmentos: SegmentoItem[];
}

export const RAMOS_SEGMENTOS: RamoItem[] = [
  {
    codigo: "1",
    nome: "Arquitetura, Engenharia & Planejamento",
    segmentos: [
      { codigo: "1.1", nome: "Avaliação técnica de terrenos" },
      { codigo: "1.2", nome: "Consultoria para produto imobiliário" },
      { codigo: "1.3", nome: "Drenagem urbana" },
      { codigo: "1.4", nome: "Engenharia elétrica" },
      { codigo: "1.5", nome: "Engenharia estrutural" },
      { codigo: "1.6", nome: "Engenharia hidráulica" },
      { codigo: "1.7", nome: "Projetos viários" },
      { codigo: "1.8", nome: "Projetos de terraplenagem e movimentação de terra" },
      { codigo: "1.9", nome: "Projetos de fundações" },
      { codigo: "1.10", nome: "Estudos de viabilidade técnica e econômica" },
      { codigo: "1.11", nome: "Modelagem e compatibilização BIM" },
      { codigo: "1.12", nome: "Planejamento de acessibilidade e inclusão" },
      { codigo: "1.13", nome: "Planejamento urbano e loteamentos" },
      { codigo: "1.14", nome: "Projetos de arquitetura" },
      { codigo: "1.15", nome: "Projetos de paisagismo" },
      { codigo: "1.16", nome: "Sustentabilidade e certificações técnicas (LEED, EDGE)" },
      { codigo: "1.17", nome: "Topografia e georreferenciamento" },
      { codigo: "1.18", nome: "Arquitetura de interiores" },
      { codigo: "1.19", nome: "Patrimônio histórico e restauro" },
      { codigo: "1.20", nome: "Prevenção e combate a incêndio (PPCI)" },
      { codigo: "1.21", nome: "Acústica e conforto ambiental" },
      { codigo: "1.22", nome: "Climatização passiva e eficiência térmica" },
      { codigo: "1.23", nome: "Estudos de impacto ambiental e urbano" },
      { codigo: "1.24", nome: "Regularização e aprovação de projetos em órgãos públicos" },
      { codigo: "1.25", nome: "Consultoria em patologia das construções" },
    ],
  },
  {
    codigo: "2",
    nome: "Construção & Execução de Obras",
    segmentos: [
      { codigo: "2.1", nome: "Construção de edifícios residenciais e comerciais" },
      { codigo: "2.2", nome: "Construção de obras industriais" },
      { codigo: "2.3", nome: "Obras de infraestrutura e urbanização" },
      { codigo: "2.4", nome: "Retrofit, reforma e requalificação técnica" },
      { codigo: "2.5", nome: "Fundações, estruturas, alvenarias e coberturas" },
      { codigo: "2.6", nome: "Construção modular e seriada" },
      { codigo: "2.7", nome: "Gerenciamento de obra (prazos, escopo, custo)" },
      { codigo: "2.8", nome: "Segurança de obra (NRs)" },
      { codigo: "2.9", nome: "Preparação de canteiro e controle de insumos" },
      { codigo: "2.10", nome: "Construção de estruturas temporárias (stands, eventos)" },
      { codigo: "2.11", nome: "Obras em zonas especiais (ambientais, patrimoniais)" },
      { codigo: "2.12", nome: "Execução de pavimentação asfáltica" },
      { codigo: "2.13", nome: "Execução de pavimentação intertravada" },
      { codigo: "2.14", nome: "Estruturas metálicas e serralheria" },
      { codigo: "2.15", nome: "Construção de telhados e carpintaria" },
      { codigo: "2.16", nome: "Impermeabilização" },
      { codigo: "2.17", nome: "Concretagem e controle tecnológico" },
      { codigo: "2.18", nome: "Estruturas pré-moldadas e pré-fabricadas" },
      { codigo: "2.19", nome: "Alvenaria estrutural" },
      { codigo: "2.20", nome: "Demolição técnica e descarte controlado" },
      { codigo: "2.21", nome: "Montagem industrial pesada" },
      { codigo: "2.22", nome: "Obras de contenção e estabilidade de taludes" },
      { codigo: "2.23", nome: "Execução de barragens e canais" },
      { codigo: "2.24", nome: "Construções em ambientes especiais (offshore, subterrâneas, hospitalares)" },
    ],
  },
  {
    codigo: "3",
    nome: "Sistemas Técnicos & Instalações Prediais",
    segmentos: [
      { codigo: "3.1", nome: "Instalações elétricas" },
      { codigo: "3.2", nome: "Instalações hidráulicas" },
      { codigo: "3.3", nome: "Sistemas de climatização e HVAC" },
      { codigo: "3.4", nome: "Energia solar (fotovoltaica, térmica)" },
      { codigo: "3.5", nome: "Cabeamento estruturado e redes" },
      { codigo: "3.6", nome: "Automação predial (iluminação, controle de acesso, sensores)" },
      { codigo: "3.7", nome: "Sistemas de prevenção e combate a incêndio (SPCI, sprinklers, detectores)" },
      { codigo: "3.8", nome: "Instalação de elevadores e sistemas verticais" },
      { codigo: "3.9", nome: "Sistemas de segurança (CFTV, alarmes)" },
      { codigo: "3.10", nome: "Sistemas de reaproveitamento e eficiência" },
      { codigo: "3.11", nome: "Fossas e biodigestores" },
      { codigo: "3.12", nome: "Sistemas de iluminação de emergência e sinalização" },
      { codigo: "3.13", nome: "Automação residencial inteligente (smart homes)" },
      { codigo: "3.14", nome: "Sistemas de ventilação mecânica e exaustão" },
      { codigo: "3.15", nome: "Sistemas de pressurização de escadas" },
      { codigo: "3.16", nome: "Instalações de gás (GLP, GN)" },
      { codigo: "3.17", nome: "Sistemas de geração de energia (geradores, nobreaks)" },
      { codigo: "3.18", nome: "Carregadores para veículos elétricos (eletropostos)" },
      { codigo: "3.19", nome: "Integração de sistemas prediais em plataforma única (BMS – Building Management System)" },
    ],
  },
  {
    codigo: "4",
    nome: "Acabamentos, Revestimentos & Soluções de Interiores",
    segmentos: [
      { codigo: "4.1", nome: "Revestimentos e acabamentos" },
      { codigo: "4.2", nome: "Pedras, mármores e granitos" },
      { codigo: "4.3", nome: "Madeira e derivados" },
      { codigo: "4.4", nome: "Gesso, forros, drywall e divisórias técnicas" },
      { codigo: "4.5", nome: "Pintura e textura decorativa" },
      { codigo: "4.6", nome: "Marcenaria e móveis planejados" },
      { codigo: "4.7", nome: "Serralheria fina" },
      { codigo: "4.8", nome: "Iluminação técnica e decorativa" },
      { codigo: "4.9", nome: "Esquadrias de alto desempenho" },
      { codigo: "4.10", nome: "Soluções acústicas e térmicas" },
      { codigo: "4.11", nome: "Ambientação e design de interiores" },
      { codigo: "4.12", nome: "Soluções personalizadas para espaços corporativos" },
      { codigo: "4.13", nome: "Execução final de ambientes sensíveis (hospitais, hotéis)" },
      { codigo: "4.14", nome: "Fachadas ventiladas e tecnológicas" },
      { codigo: "4.15", nome: "Revestimentos ecológicos (bambu, materiais reciclados)" },
      { codigo: "4.16", nome: "Revestimentos térmicos e acústicos (painéis isolantes)" },
      { codigo: "4.17", nome: "Revestimentos monolíticos" },
      { codigo: "4.18", nome: "Telhas e coberturas" },
      { codigo: "4.19", nome: "Calhas e rufos" },
      { codigo: "4.20", nome: "Pisos vinílicos e laminados" },
      { codigo: "4.21", nome: "Carpetes técnicos e decorativos" },
      { codigo: "4.22", nome: "Coberturas tensionadas e especiais" },
      { codigo: "4.23", nome: "Vidros especiais (temperados, laminados, insulados)" },
      { codigo: "4.24", nome: "Portas técnicas (corta-fogo, acústicas, hospitalares)" },
      { codigo: "4.25", nome: "Painéis arquitetônicos decorativos" },
      { codigo: "4.26", nome: "Mobiliário urbano e corporativo integrado" },
      { codigo: "4.27", nome: "Soluções de branding e ambientação de marca" },
    ],
  },
  {
    codigo: "5",
    nome: "Legalização, Regulação & Viabilidade",
    segmentos: [
      { codigo: "5.1", nome: "Advocacia imobiliária, urbanística e contratual" },
      { codigo: "5.2", nome: "Consultoria em zoneamento e uso do solo" },
      { codigo: "5.3", nome: "Auditoria técnica e de conformidade legal" },
      { codigo: "5.4", nome: "Defesa técnica em processos administrativos e judiciais" },
      { codigo: "5.5", nome: "Due diligence técnica e documental" },
      { codigo: "5.6", nome: "Mediação e arbitragem de conflitos contratuais" },
      { codigo: "5.7", nome: "Apoio jurídico para parcerias público-privadas (PPPs)" },
      { codigo: "5.8", nome: "Estruturação de garantias e compliance regulatório" },
      { codigo: "5.9", nome: "Consultoria Contábil Especializada" },
      { codigo: "5.10", nome: "Licenciamento ambiental, urbanístico e patrimonial" },
      { codigo: "5.11", nome: "Regularização fundiária" },
      { codigo: "5.12", nome: "Pareceres e laudos técnicos" },
      { codigo: "5.13", nome: "Perícia e avaliação de imóveis" },
      { codigo: "5.14", nome: "Estruturação jurídica de SPEs e permutas" },
      { codigo: "5.15", nome: "Emissão de AVCB e aprovação junto a bombeiros" },
      { codigo: "5.16", nome: "Consultoria normativa" },
      { codigo: "5.17", nome: "Assessoria para registro de incorporação imobiliária" },
    ],
  },
  {
    codigo: "6",
    nome: "Facilities, Manutenção & Sustentabilidade Operacional",
    segmentos: [
      { codigo: "6.1", nome: "Facilities management (corporativo, condominial, institucional)" },
      { codigo: "6.2", nome: "Manutenção preventiva e corretiva" },
      { codigo: "6.3", nome: "Operação de sistemas técnicos (geradores, bombas, elevadores)" },
      { codigo: "6.4", nome: "Monitoramento remoto e telemetria" },
      { codigo: "6.5", nome: "Implementação de planos de manutenção" },
      { codigo: "6.6", nome: "Gestão de sustentabilidade (ESG, resíduos, energia)" },
      { codigo: "6.7", nome: "Atendimento técnico pós-obra" },
      { codigo: "6.8", nome: "Certificação de performance técnica" },
      { codigo: "6.9", nome: "Operação e manutenção predial integrada" },
      { codigo: "6.10", nome: "Planejamento operacional para empreendimentos" },
      { codigo: "6.11", nome: "Gestão de contratos e fornecedores de manutenção" },
      { codigo: "6.12", nome: "Serviços de limpeza e conservação técnica de ativos" },
      { codigo: "6.13", nome: "Monitoramento de desempenho energético" },
      { codigo: "6.14", nome: "Gestão de resíduos sólidos e reciclagem" },
      { codigo: "6.15", nome: "Inspeção predial periódica" },
      { codigo: "6.16", nome: "Modernização de sistemas prediais antigos" },
      { codigo: "6.17", nome: "Consultoria em segurança patrimonial e predial" },
      { codigo: "6.18", nome: "Relatórios de performance operacional para investidores" },
    ],
  },
  {
    codigo: "7",
    nome: "Suprimentos, Logística & Fornecimento Estratégico",
    segmentos: [
      { codigo: "7.1", nome: "Comércio de materiais de construção diversos" },
      { codigo: "7.2", nome: "Indústria de estruturas metálicas" },
      { codigo: "7.3", nome: "Indústria de pré-moldados" },
      { codigo: "7.4", nome: "Fornecimento de concreto" },
      { codigo: "7.5", nome: "Fornecimento de cimento e argamassa" },
      { codigo: "7.6", nome: "Fornecimento de aço" },
      { codigo: "7.7", nome: "Fornecimento de madeira" },
      { codigo: "7.8", nome: "Fornecimento de areia e brita" },
      { codigo: "7.9", nome: "Fornecimento de material hidráulico" },
      { codigo: "7.10", nome: "Fornecimento de material elétrico" },
      { codigo: "7.11", nome: "Logística de abastecimento para obras" },
      { codigo: "7.12", nome: "Locação de equipamentos técnicos" },
      { codigo: "7.13", nome: "Suprimentos especializados (EPI, ferramentas)" },
      { codigo: "7.14", nome: "Cadeia integrada BIM-Logística" },
      { codigo: "7.15", nome: "Armazenagem e transporte técnico" },
      { codigo: "7.16", nome: "Fornecimento just-in-time" },
      { codigo: "7.17", nome: "Comercialização técnica de sistemas prontos" },
      { codigo: "7.18", nome: "Transporte e logística de peças de grande porte (heavy lift)" },
      { codigo: "7.19", nome: "Fornecimento de insumos sustentáveis (verde e reciclado)" },
      { codigo: "7.20", nome: "Gestão de estoque em obra (just-in-place)" },
      { codigo: "7.21", nome: "Centros de distribuição regionais integrados" },
      { codigo: "7.22", nome: "Logística reversa de materiais de construção" },
      { codigo: "7.23", nome: "Transporte especializado para obras urbanas sensíveis" },
    ],
  },
  {
    codigo: "8",
    nome: "Desenvolvimento Imobiliário, Investimento & Negócios",
    segmentos: [
      { codigo: "8.1", nome: "Incorporação imobiliária" },
      { codigo: "8.2", nome: "Modelagem de negócios e parcerias patrimoniais" },
      { codigo: "8.3", nome: "Estruturação de SPEs e permutas" },
      { codigo: "8.4", nome: "Captação e negociação de terrenos" },
      { codigo: "8.5", nome: "Análise de viabilidade financeira e técnica" },
      { codigo: "8.6", nome: "Comercialização estratégica com foco patrimonial" },
      { codigo: "8.7", nome: "Investimentos estruturados em ativos reais" },
      { codigo: "8.8", nome: "Desenvolvimento de produto imobiliário" },
      { codigo: "8.9", nome: "Gestão de portfólio de empreendimentos" },
      { codigo: "8.10", nome: "Relacionamento com fundos, family offices e investidores institucionais" },
      { codigo: "8.11", nome: "Estruturação de consórcios e joint ventures" },
      { codigo: "8.12", nome: "Gestão de ativos imobiliários (asset management)" },
      { codigo: "8.13", nome: "Operação de fundos imobiliários (FIIs)" },
      { codigo: "8.14", nome: "Estudos de mercado e inteligência imobiliária" },
      { codigo: "8.15", nome: "Estruturação de operações de built-to-suit" },
      { codigo: "8.16", nome: "Captação de recursos via mercado de capitais" },
      { codigo: "8.17", nome: "Consultoria em internacionalização de investimentos" },
      { codigo: "8.18", nome: "Modelagem de concessões e PPPs imobiliárias" },
      { codigo: "8.19", nome: "Comercialização de consórcios e cartas contempladas" },
      { codigo: "8.20", nome: "Instituições financeiras e financiamento imobiliário" },
    ],
  },
];

// ========== NÚCLEOS DE ALIANÇA → TIPOS ==========

export interface TipoAliancaItem {
  nome: string;
  descricao?: string;
}

export interface NucleoTiposItem {
  nucleo: string;
  tipos: TipoAliancaItem[];
}

export const NUCLEOS_TIPOS: Record<string, TipoAliancaItem[]> = {
  "Núcleo Técnico": [
    { nome: "Alianças de Projeto", descricao: "Arquitetos, engenheiros, projetistas, designers urbanistas" },
    { nome: "Alianças Jurídicas", descricao: "Especialistas em direito imobiliário, societário, contratual e compliance" },
    { nome: "Alianças de Inteligência", descricao: "Inteligência de mercado, viabilidade de produto, marketing" },
    { nome: "Alianças de Governança", descricao: "Compliance, segurança, qualidade, rastreamento, auditoria, ambiental, ESG" },
  ],
  "Núcleo de Obra": [
    { nome: "Alianças de Execução", descricao: "Profissionais independentes, engenheiros de obra, supervisores, construtoras, empreiteiras" },
    { nome: "Alianças de Fornecimento", descricao: "Materiais, equipamentos e logística" },
  ],
  "Núcleo Comercial": [
    { nome: "Alianças Comerciais", descricao: "Captadores, executivos de negócios, articuladores" },
    { nome: "Alianças de Vendas e Locação", descricao: "Corretores, consultores e administradores de imóveis" },
    { nome: "Alianças de Marketing", descricao: "Marketing estratégico, conteúdo e criação, performance e relacionamento" },
    { nome: "Alianças de Operações e Facilities", descricao: "Manutenção, terceirização" },
    { nome: "Alianças de Gestão de Relacionamento com Cliente", descricao: "Pós-venda, SAC, garantias, suporte técnico" },
  ],
  "Núcleo de Capital": [
    { nome: "Alianças de Investimento", descricao: "Captação de recursos, relacionamento com investidores, estruturação de investimentos" },
    { nome: "Alianças Contábeis e Tributárias", descricao: "Contabilidade, tributos e conciliação" },
    { nome: "Alianças de Gestão Financeira", descricao: "Orçamento, caixa, controle" },
  ],
};

export function getTiposForNucleos(nucleos: string[]): TipoAliancaItem[] {
  const seen = new Set<string>();
  const result: TipoAliancaItem[] = [];
  for (const nucleo of nucleos) {
    for (const tipo of NUCLEOS_TIPOS[nucleo] || []) {
      if (!seen.has(tipo.nome)) {
        seen.add(tipo.nome);
        result.push(tipo);
      }
    }
  }
  return result;
}

export function getTiposForNucleo(nucleo: string): TipoAliancaItem[] {
  return NUCLEOS_TIPOS[nucleo] || [];
}

export function getAllTipos(): TipoAliancaItem[] {
  const seen = new Set<string>();
  const result: TipoAliancaItem[] = [];
  for (const tipos of Object.values(NUCLEOS_TIPOS)) {
    for (const tipo of tipos) {
      if (!seen.has(tipo.nome)) {
        seen.add(tipo.nome);
        result.push(tipo);
      }
    }
  }
  return result;
}

export function getNucleoForTipo(tipoNome: string): string | null {
  for (const [nucleo, tipos] of Object.entries(NUCLEOS_TIPOS)) {
    if (tipos.some(t => t.nome === tipoNome)) return nucleo;
  }
  return null;
}

export function getNucleosForTipos(tiposNomes: string[]): string[] {
  const seen = new Set<string>();
  for (const nome of tiposNomes) {
    const nucleo = getNucleoForTipo(nome);
    if (nucleo) seen.add(nucleo);
  }
  return Array.from(seen);
}

export function getRamoNome(ramo_atuacao: string): string {
  return RAMOS_SEGMENTOS.find(r => r.nome === ramo_atuacao)?.nome ?? ramo_atuacao;
}

export function getSegmentosForRamo(ramo_atuacao: string): SegmentoItem[] {
  return RAMOS_SEGMENTOS.find(r => r.nome === ramo_atuacao)?.segmentos ?? [];
}
