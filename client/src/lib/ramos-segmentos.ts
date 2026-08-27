import {
  CONTRIBUTION_AREA_GROUPS,
  getContributionAreaDisplayName,
  getPublicContributionAreas,
} from "@shared/contribution-areas";

export interface SegmentoItem {
  codigo: string;
  nome: string;
}

export interface RamoItem {
  codigo: string;
  nome: string;
  segmentos: SegmentoItem[];
}

export const SEGMENTOS_MULTI_SEPARATOR = "; ";

export const RAMOS_SEGMENTOS: RamoItem[] = [
  {
    "codigo": "1",
    "nome": "Arquitetura, Engenharia & Planejamento",
    "segmentos": [
      {
        "codigo": "1.1",
        "nome": "Avaliação técnica de terrenos"
      },
      {
        "codigo": "1.2",
        "nome": "Consultoria para produto imobiliário"
      },
      {
        "codigo": "1.3",
        "nome": "Estudos de viabilidade técnica e econômica"
      },
      {
        "codigo": "1.4",
        "nome": "Projetos de arquitetura"
      },
      {
        "codigo": "1.5",
        "nome": "Arquitetura de interiores"
      },
      {
        "codigo": "1.6",
        "nome": "Projetos de engenharia estrutural"
      },
      {
        "codigo": "1.7",
        "nome": "Projetos de engenharia elétrica"
      },
      {
        "codigo": "1.8",
        "nome": "Projetos de engenharia hidráulica"
      },
      {
        "codigo": "1.9",
        "nome": "Projetos de fundações"
      },
      {
        "codigo": "1.10",
        "nome": "Projetos viários"
      },
      {
        "codigo": "1.11",
        "nome": "Projetos de drenagem urbana"
      },
      {
        "codigo": "1.12",
        "nome": "Projetos de terraplenagem e movimentação de terra"
      },
      {
        "codigo": "1.13",
        "nome": "Planejamento urbano e loteamentos"
      },
      {
        "codigo": "1.14",
        "nome": "Projetos de paisagismo"
      },
      {
        "codigo": "1.15",
        "nome": "Topografia e georreferenciamento"
      },
      {
        "codigo": "1.16",
        "nome": "Modelagem e compatibilização BIM"
      },
      {
        "codigo": "1.17",
        "nome": "Planejamento de acessibilidade e inclusão"
      },
      {
        "codigo": "1.18",
        "nome": "Prevenção e combate a incêndio"
      },
      {
        "codigo": "1.19",
        "nome": "Acústica e conforto ambiental"
      },
      {
        "codigo": "1.20",
        "nome": "Eficiência térmica e climatização passiva"
      },
      {
        "codigo": "1.21",
        "nome": "Sustentabilidade e certificações técnicas"
      },
      {
        "codigo": "1.22",
        "nome": "Estudos de impacto ambiental e urbano"
      },
      {
        "codigo": "1.23",
        "nome": "Patrimônio histórico e restauro"
      },
      {
        "codigo": "1.24",
        "nome": "Regularização e aprovação de projetos em órgãos públicos"
      },
      {
        "codigo": "1.25",
        "nome": "Consultoria em patologia das construções"
      }
    ]
  },
  {
    "codigo": "2",
    "nome": "Construção & Execução de Obras",
    "segmentos": [
      {
        "codigo": "2.1",
        "nome": "Construção de edifícios residenciais"
      },
      {
        "codigo": "2.2",
        "nome": "Construção de edifícios comerciais"
      },
      {
        "codigo": "2.3",
        "nome": "Construção de obras industriais"
      },
      {
        "codigo": "2.4",
        "nome": "Obras de infraestrutura e urbanização"
      },
      {
        "codigo": "2.5",
        "nome": "Obras de loteamento"
      },
      {
        "codigo": "2.6",
        "nome": "Retrofit, reforma e requalificação técnica"
      },
      {
        "codigo": "2.7",
        "nome": "Fundações"
      },
      {
        "codigo": "2.8",
        "nome": "Estruturas de concreto"
      },
      {
        "codigo": "2.9",
        "nome": "Estruturas metálicas"
      },
      {
        "codigo": "2.10",
        "nome": "Alvenaria convencional e estrutural"
      },
      {
        "codigo": "2.11",
        "nome": "Coberturas e telhados"
      },
      {
        "codigo": "2.12",
        "nome": "Carpintaria para construção"
      },
      {
        "codigo": "2.13",
        "nome": "Serralheria estrutural"
      },
      {
        "codigo": "2.14",
        "nome": "Construção modular e seriada"
      },
      {
        "codigo": "2.15",
        "nome": "Estruturas pré-moldadas e pré-fabricadas"
      },
      {
        "codigo": "2.16",
        "nome": "Impermeabilização"
      },
      {
        "codigo": "2.17",
        "nome": "Concretagem e controle tecnológico"
      },
      {
        "codigo": "2.18",
        "nome": "Pavimentação asfáltica"
      },
      {
        "codigo": "2.19",
        "nome": "Pavimentação intertravada"
      },
      {
        "codigo": "2.20",
        "nome": "Obras de contenção e estabilidade de taludes"
      },
      {
        "codigo": "2.21",
        "nome": "Demolição técnica e descarte controlado"
      },
      {
        "codigo": "2.22",
        "nome": "Preparação de canteiro de obras"
      },
      {
        "codigo": "2.23",
        "nome": "Segurança de obra e adequação às NRs"
      },
      {
        "codigo": "2.24",
        "nome": "Gerenciamento de obra: prazo, escopo e custo"
      },
      {
        "codigo": "2.25",
        "nome": "Construções em ambientes especiais"
      }
    ]
  },
  {
    "codigo": "3",
    "nome": "Sistemas Técnicos & Instalações Prediais",
    "segmentos": [
      {
        "codigo": "3.1",
        "nome": "Instalações elétricas"
      },
      {
        "codigo": "3.2",
        "nome": "Instalações hidráulicas"
      },
      {
        "codigo": "3.3",
        "nome": "Instalações sanitárias"
      },
      {
        "codigo": "3.4",
        "nome": "Instalações de gás"
      },
      {
        "codigo": "3.5",
        "nome": "Sistemas de climatização e HVAC"
      },
      {
        "codigo": "3.6",
        "nome": "Sistemas de ventilação e exaustão"
      },
      {
        "codigo": "3.7",
        "nome": "Sistemas de pressurização de escadas"
      },
      {
        "codigo": "3.8",
        "nome": "Energia solar fotovoltaica e térmica"
      },
      {
        "codigo": "3.9",
        "nome": "Sistemas de geração de energia"
      },
      {
        "codigo": "3.10",
        "nome": "Nobreaks e geradores"
      },
      {
        "codigo": "3.11",
        "nome": "Cabeamento estruturado e redes"
      },
      {
        "codigo": "3.12",
        "nome": "Automação predial"
      },
      {
        "codigo": "3.13",
        "nome": "Automação residencial"
      },
      {
        "codigo": "3.14",
        "nome": "Sistemas de segurança, CFTV e alarmes"
      },
      {
        "codigo": "3.15",
        "nome": "Controle de acesso"
      },
      {
        "codigo": "3.16",
        "nome": "Sistemas de prevenção e combate a incêndio"
      },
      {
        "codigo": "3.17",
        "nome": "Iluminação de emergência e sinalização"
      },
      {
        "codigo": "3.18",
        "nome": "Instalação de elevadores e sistemas verticais"
      },
      {
        "codigo": "3.19",
        "nome": "Carregadores para veículos elétricos"
      },
      {
        "codigo": "3.20",
        "nome": "Fossas, biodigestores e soluções sanitárias"
      },
      {
        "codigo": "3.21",
        "nome": "Sistemas de reaproveitamento de água e eficiência predial"
      },
      {
        "codigo": "3.22",
        "nome": "Integração de sistemas prediais"
      }
    ]
  },
  {
    "codigo": "4",
    "nome": "Acabamentos, Revestimentos & Interiores",
    "segmentos": [
      {
        "codigo": "4.1",
        "nome": "Revestimentos e acabamentos"
      },
      {
        "codigo": "4.2",
        "nome": "Pedras, mármores e granitos"
      },
      {
        "codigo": "4.3",
        "nome": "Madeira e derivados"
      },
      {
        "codigo": "4.4",
        "nome": "Pisos vinílicos e laminados"
      },
      {
        "codigo": "4.5",
        "nome": "Carpetes técnicos e decorativos"
      },
      {
        "codigo": "4.6",
        "nome": "Revestimentos monolíticos"
      },
      {
        "codigo": "4.7",
        "nome": "Revestimentos ecológicos"
      },
      {
        "codigo": "4.8",
        "nome": "Revestimentos térmicos e acústicos"
      },
      {
        "codigo": "4.9",
        "nome": "Gesso, forros e drywall"
      },
      {
        "codigo": "4.10",
        "nome": "Divisórias técnicas"
      },
      {
        "codigo": "4.11",
        "nome": "Pintura e textura decorativa"
      },
      {
        "codigo": "4.12",
        "nome": "Marcenaria e móveis planejados"
      },
      {
        "codigo": "4.13",
        "nome": "Serralheria fina"
      },
      {
        "codigo": "4.14",
        "nome": "Esquadrias de alto desempenho"
      },
      {
        "codigo": "4.15",
        "nome": "Vidros especiais"
      },
      {
        "codigo": "4.16",
        "nome": "Portas técnicas"
      },
      {
        "codigo": "4.17",
        "nome": "Fachadas ventiladas e tecnológicas"
      },
      {
        "codigo": "4.18",
        "nome": "Painéis arquitetônicos decorativos"
      },
      {
        "codigo": "4.19",
        "nome": "Iluminação técnica e decorativa"
      },
      {
        "codigo": "4.20",
        "nome": "Ambientação e design de interiores"
      },
      {
        "codigo": "4.21",
        "nome": "Soluções para espaços corporativos"
      },
      {
        "codigo": "4.22",
        "nome": "Execução final de ambientes sensíveis"
      },
      {
        "codigo": "4.23",
        "nome": "Telhas e coberturas especiais"
      },
      {
        "codigo": "4.24",
        "nome": "Calhas e rufos"
      },
      {
        "codigo": "4.25",
        "nome": "Coberturas tensionadas e especiais"
      },
      {
        "codigo": "4.26",
        "nome": "Mobiliário urbano e corporativo integrado"
      },
      {
        "codigo": "4.27",
        "nome": "Ambientação de marca para espaços físicos"
      }
    ]
  },
  {
    "codigo": "5",
    "nome": "Legalização, Desembaraço & Regularização Imobiliária",
    "segmentos": [
      {
        "codigo": "5.1",
        "nome": "Advocacia imobiliária"
      },
      {
        "codigo": "5.2",
        "nome": "Advocacia urbanística"
      },
      {
        "codigo": "5.3",
        "nome": "Advocacia contratual imobiliária"
      },
      {
        "codigo": "5.4",
        "nome": "Consultoria em zoneamento e uso do solo"
      },
      {
        "codigo": "5.5",
        "nome": "Duediligence jurídica, técnica e documental"
      },
      {
        "codigo": "5.6",
        "nome": "Auditoria técnica e de conformidade legal"
      },
      {
        "codigo": "5.7",
        "nome": "Regularização fundiária"
      },
      {
        "codigo": "5.8",
        "nome": "Regularização de imóveis urbanos"
      },
      {
        "codigo": "5.9",
        "nome": "Regularização de imóveis rurais"
      },
      {
        "codigo": "5.10",
        "nome": "Assessoria para registro de incorporação imobiliária"
      },
      {
        "codigo": "5.11",
        "nome": "Estruturação jurídica de SPEs e permutas"
      },
      {
        "codigo": "5.12",
        "nome": "Licenciamento ambiental"
      },
      {
        "codigo": "5.13",
        "nome": "Licenciamento urbanístico"
      },
      {
        "codigo": "5.14",
        "nome": "Licenciamento patrimonial"
      },
      {
        "codigo": "5.15",
        "nome": "Emissão de AVCB e aprovação junto a bombeiros"
      },
      {
        "codigo": "5.16",
        "nome": "Pareceres e laudos técnicos"
      },
      {
        "codigo": "5.17",
        "nome": "Perícia e avaliação de imóveis"
      },
      {
        "codigo": "5.18",
        "nome": "Defesa técnica em processos administrativos e judiciais"
      },
      {
        "codigo": "5.19",
        "nome": "Mediação e arbitragem de conflitos contratuais"
      },
      {
        "codigo": "5.20",
        "nome": "Consultoria normativa"
      },
      {
        "codigo": "5.21",
        "nome": "Serviços paralegais e apoio documental imobiliário"
      },
      {
        "codigo": "5.22",
        "nome": "Compliance societário, cadastral e regulatório"
      },
      {
        "codigo": "5.23",
        "nome": "Consultoria contábil, fiscal e tributária especializada"
      },
      {
        "codigo": "5.24",
        "nome": "Planejamento tributário para operações imobiliárias"
      }
    ]
  },
  {
    "codigo": "6",
    "nome": "Facilities, Manutenção & Operação Predial",
    "segmentos": [
      {
        "codigo": "6.1",
        "nome": "Facilities management"
      },
      {
        "codigo": "6.2",
        "nome": "Manutenção preventiva e corretiva"
      },
      {
        "codigo": "6.3",
        "nome": "Manutenção elétrica predial"
      },
      {
        "codigo": "6.4",
        "nome": "Manutenção hidráulica predial"
      },
      {
        "codigo": "6.5",
        "nome": "Manutenção de sistemas de climatização"
      },
      {
        "codigo": "6.6",
        "nome": "Operação de geradores, bombas e sistemas técnicos"
      },
      {
        "codigo": "6.7",
        "nome": "Manutenção de elevadores e sistemas verticais"
      },
      {
        "codigo": "6.8",
        "nome": "Monitoramento remoto e telemetria"
      },
      {
        "codigo": "6.9",
        "nome": "Implementação de planos de manutenção"
      },
      {
        "codigo": "6.10",
        "nome": "Operação e manutenção predial integrada"
      },
      {
        "codigo": "6.11",
        "nome": "Serviços de limpeza e conservação técnica de ativos"
      },
      {
        "codigo": "6.12",
        "nome": "Gestão de resíduos sólidos e reciclagem"
      },
      {
        "codigo": "6.13",
        "nome": "Monitoramento de desempenho energético"
      },
      {
        "codigo": "6.14",
        "nome": "Modernização de sistemas prediais antigos"
      },
      {
        "codigo": "6.15",
        "nome": "Inspeção predial periódica"
      },
      {
        "codigo": "6.16",
        "nome": "Atendimento técnico pós-obra"
      },
      {
        "codigo": "6.17",
        "nome": "Certificação de performance técnica"
      },
      {
        "codigo": "6.18",
        "nome": "Consultoria em segurança patrimonial e predial"
      },
      {
        "codigo": "6.19",
        "nome": "Relatórios técnicos de performance operacional"
      }
    ]
  },
  {
    "codigo": "7",
    "nome": "Suprimentos, Materiais & Fornecimento Estratégico",
    "segmentos": [
      {
        "codigo": "7.1",
        "nome": "Comércio de materiais de construção diversos"
      },
      {
        "codigo": "7.2",
        "nome": "Fornecimento de concreto"
      },
      {
        "codigo": "7.3",
        "nome": "Fornecimento de cimento e argamassa"
      },
      {
        "codigo": "7.4",
        "nome": "Fornecimento de aço"
      },
      {
        "codigo": "7.5",
        "nome": "Fornecimento de madeira"
      },
      {
        "codigo": "7.6",
        "nome": "Fornecimento de areia e brita"
      },
      {
        "codigo": "7.7",
        "nome": "Fornecimento de material hidráulico"
      },
      {
        "codigo": "7.8",
        "nome": "Fornecimento de material elétrico"
      },
      {
        "codigo": "7.9",
        "nome": "Fornecimento de tintas e impermeabilizantes"
      },
      {
        "codigo": "7.10",
        "nome": "Fornecimento de revestimentos e acabamentos"
      },
      {
        "codigo": "7.11",
        "nome": "Fornecimento de esquadrias, vidros e portas técnicas"
      },
      {
        "codigo": "7.12",
        "nome": "Fornecimento de sistemas prontos para obra"
      },
      {
        "codigo": "7.13",
        "nome": "Indústria de estruturas metálicas"
      },
      {
        "codigo": "7.14",
        "nome": "Indústria de pré-moldados"
      },
      {
        "codigo": "7.15",
        "nome": "Suprimentos especializados: EPI, ferramentas e acessórios"
      },
      {
        "codigo": "7.16",
        "nome": "Locação de equipamentos técnicos"
      },
      {
        "codigo": "7.17",
        "nome": "Locação de máquinas para obra"
      },
      {
        "codigo": "7.18",
        "nome": "Compras técnicas e procurement para obras"
      },
      {
        "codigo": "7.19",
        "nome": "Cotação, equalização e negociação com fornecedores"
      },
      {
        "codigo": "7.20",
        "nome": "Gestão de pedidos, notas fiscais, entregas e abastecimento"
      },
      {
        "codigo": "7.21",
        "nome": "Controle de estoque e suprimentos de obra"
      },
      {
        "codigo": "7.22",
        "nome": "Armazenagem e transporte técnico"
      },
      {
        "codigo": "7.23",
        "nome": "Logística de abastecimento para obras"
      },
      {
        "codigo": "7.24",
        "nome": "Transporte de peças de grande porte"
      },
      {
        "codigo": "7.25",
        "nome": "Logística reversa de materiais de construção"
      },
      {
        "codigo": "7.26",
        "nome": "Fornecimento de insumos sustentáveis"
      },
      {
        "codigo": "7.27",
        "nome": "Centros de distribuição regionais"
      }
    ]
  },
  {
    "codigo": "8",
    "nome": "Desenvolvimento Imobiliário & Negócios Aplicados",
    "segmentos": [
      {
        "codigo": "8.1",
        "nome": "Incorporação imobiliária"
      },
      {
        "codigo": "8.2",
        "nome": "Desenvolvimento de produto imobiliário"
      },
      {
        "codigo": "8.3",
        "nome": "Modelagem de negócios imobiliários"
      },
      {
        "codigo": "8.4",
        "nome": "Captação e negociação de terrenos"
      },
      {
        "codigo": "8.5",
        "nome": "Análise de viabilidade financeira e técnica"
      },
      {
        "codigo": "8.6",
        "nome": "Comercialização estratégica de empreendimentos"
      },
      {
        "codigo": "8.7",
        "nome": "Estudos de mercado e inteligência imobiliária"
      },
      {
        "codigo": "8.8",
        "nome": "Gestão comercial de ativos para venda ou locação"
      },
      {
        "codigo": "8.9",
        "nome": "Administração de locações e receitas imobiliárias"
      },
      {
        "codigo": "8.10",
        "nome": "Gestão de recebíveis imobiliários"
      },
      {
        "codigo": "8.11",
        "nome": "Estruturação de operações built-to-suit"
      },
      {
        "codigo": "8.12",
        "nome": "Modelagem de concessões e PPPs imobiliárias"
      },
      {
        "codigo": "8.13",
        "nome": "Operações de retrofit com reposicionamento de ativos"
      },
      {
        "codigo": "8.14",
        "nome": "Comercialização de consórcios e cartas contempladas"
      },
      {
        "codigo": "8.15",
        "nome": "Consultoria para multipropriedade e uso compartilhado"
      },
      {
        "codigo": "8.16",
        "nome": "Gestão de portfólio de empreendimentos"
      },
      {
        "codigo": "8.17",
        "nome": "Planejamento de monetização de ativos imobiliários"
      }
    ]
  },
  {
    "codigo": "9",
    "nome": "Backoffice, BPO & Apoio Operacional Imobiliário",
    "segmentos": [
      {
        "codigo": "9.1",
        "nome": "BPO financeiro e administrativo para operações imobiliárias"
      },
      {
        "codigo": "9.2",
        "nome": "Organização documental operacional"
      },
      {
        "codigo": "9.3",
        "nome": "Apoio operacional para certidões, matrículas e documentos"
      },
      {
        "codigo": "9.4",
        "nome": "Backoffice de contratos, medições e entregas"
      },
      {
        "codigo": "9.5",
        "nome": "Apoio operacional a compras, pedidos e notas fiscais"
      },
      {
        "codigo": "9.6",
        "nome": "BPO comercial, CRM e gestão de leads imobiliários"
      },
      {
        "codigo": "9.7",
        "nome": "Atendimento, suporte operacional e pós-venda imobiliário"
      },
      {
        "codigo": "9.8",
        "nome": "PMO e coordenação operacional de processos"
      },
      {
        "codigo": "9.9",
        "nome": "Apoio administrativo para redes comerciais e parcerias"
      },
      {
        "codigo": "9.10",
        "nome": "Secretariado operacional para empresas imobiliárias"
      },
      {
        "codigo": "9.11",
        "nome": "Organização de arquivos técnicos e acervos digitais"
      }
    ]
  },
  {
    "codigo": "10",
    "nome": "Produção Visual, Imagem Técnica & Conteúdo Imobiliário",
    "segmentos": [
      {
        "codigo": "10.1",
        "nome": "Fotografia imobiliária"
      },
      {
        "codigo": "10.2",
        "nome": "Vídeos para empreendimentos imobiliários"
      },
      {
        "codigo": "10.3",
        "nome": "Imagens aéreas com drones"
      },
      {
        "codigo": "10.4",
        "nome": "Monitoramento visual de obras com drones"
      },
      {
        "codigo": "10.5",
        "nome": "Tours virtuais"
      },
      {
        "codigo": "10.6",
        "nome": "Realidade virtual para apresentação de imóveis"
      },
      {
        "codigo": "10.7",
        "nome": "Maquetes eletrônicas"
      },
      {
        "codigo": "10.8",
        "nome": "Imagens 3D para projetos e lançamentos"
      },
      {
        "codigo": "10.9",
        "nome": "Vídeos institucionais para construtoras e incorporadoras"
      },
      {
        "codigo": "10.10",
        "nome": "Plantas humanizadas"
      },
      {
        "codigo": "10.11",
        "nome": "Tratamento de imagens, plantas e materiais técnicos"
      },
      {
        "codigo": "10.12",
        "nome": "Digitalização e organização visual de acervos técnicos"
      }
    ]
  },
  {
    "codigo": "11",
    "nome": "Marketing, Vendas & Comunicação Imobiliária",
    "segmentos": [
      {
        "codigo": "11.1",
        "nome": "Branding para empreendimentos imobiliários"
      },
      {
        "codigo": "11.2",
        "nome": "Identidade visual para lançamentos imobiliários"
      },
      {
        "codigo": "11.3",
        "nome": "Marketing digital imobiliário"
      },
      {
        "codigo": "11.4",
        "nome": "Gestão de tráfego pago"
      },
      {
        "codigo": "11.5",
        "nome": "Social media para construtoras, incorporadoras e imobiliárias"
      },
      {
        "codigo": "11.6",
        "nome": "Copywriting imobiliário"
      },
      {
        "codigo": "11.7",
        "nome": "Landing pages para empreendimentos"
      },
      {
        "codigo": "11.8",
        "nome": "Funis comerciais para venda ou locação"
      },
      {
        "codigo": "11.9",
        "nome": "Estratégia de lançamento imobiliário"
      },
      {
        "codigo": "11.10",
        "nome": "Materiais institucionais e apresentações comerciais"
      },
      {
        "codigo": "11.11",
        "nome": "Catálogos, folders e peças comerciais"
      },
      {
        "codigo": "11.12",
        "nome": "Stands de vendas e experiência comercial"
      },
      {
        "codigo": "11.13",
        "nome": "Comunicação visual e sinalização de empreendimentos"
      },
      {
        "codigo": "11.14",
        "nome": "Assessoria de imprensa e reputação institucional"
      },
      {
        "codigo": "11.15",
        "nome": "Produção de campanhas para captação de compradores, locatários ou parceiros"
      }
    ]
  },
  {
    "codigo": "12",
    "nome": "Administração Condominial & Ativos em Operação",
    "segmentos": [
      {
        "codigo": "12.1",
        "nome": "Administração condominial"
      },
      {
        "codigo": "12.2",
        "nome": "Implantação de condomínios"
      },
      {
        "codigo": "12.3",
        "nome": "Síndico profissional"
      },
      {
        "codigo": "12.4",
        "nome": "Gestão de locações"
      },
      {
        "codigo": "12.5",
        "nome": "Gestão operacional de empreendimentos"
      },
      {
        "codigo": "12.6",
        "nome": "Gestão de receitas condominiais"
      },
      {
        "codigo": "12.7",
        "nome": "Gestão de inadimplência condominial"
      },
      {
        "codigo": "12.8",
        "nome": "Operação de imóveis comerciais"
      },
      {
        "codigo": "12.9",
        "nome": "Operação de imóveis logísticos"
      },
      {
        "codigo": "12.10",
        "nome": "Operação de imóveis corporativos"
      },
      {
        "codigo": "12.11",
        "nome": "Gestão de multipropriedade e uso compartilhado"
      },
      {
        "codigo": "12.12",
        "nome": "Relatórios operacionais para proprietários e investidores"
      }
    ]
  }
];

export function parseSegmentosValue(value?: string | null): string[] {
  return String(value || "")
    .split(SEGMENTOS_MULTI_SEPARATOR)
    .map(segmento => segmento.trim())
    .filter(Boolean);
}

export function parseRamosValue(value?: string | null): string[] {
  return String(value || "")
    .split(SEGMENTOS_MULTI_SEPARATOR)
    .map(ramo => ramo.trim())
    .filter(Boolean);
}

export function formatSegmentosValue(segmentos: string[]): string | null {
  const unique = Array.from(new Set(segmentos.map(segmento => segmento.trim()).filter(Boolean)));
  return unique.length ? unique.join(SEGMENTOS_MULTI_SEPARATOR) : null;
}

export function formatRamosValue(ramos: string[]): string | null {
  const unique = Array.from(new Set(ramos.map(ramo => ramo.trim()).filter(Boolean)));
  return unique.length ? unique.join(SEGMENTOS_MULTI_SEPARATOR) : null;
}

export function formatSegmentosDisplay(value?: string | null): string {
  return parseSegmentosValue(value).join(", ");
}

export function formatRamosDisplay(value?: string | null): string {
  return parseRamosValue(value).join(", ");
}

// ========== N?CLEOS DE ALIAN?A ? TIPOS ==========

export interface TipoAliancaItem {
  nome: string;
  descricao?: string;
}

export interface NucleoTiposItem {
  nucleo: string;
  tipos: TipoAliancaItem[];
}

export const NUCLEOS_TIPOS: Record<string, TipoAliancaItem[]> = Object.fromEntries(
  CONTRIBUTION_AREA_GROUPS.map((group) => [
    group.nucleus,
    group.areas.map((area) => ({ nome: area.value, descricao: area.description })),
  ]),
);

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
  const normalizedTipo = getTipoDisplayName(tipoNome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const [nucleo, tipos] of Object.entries(NUCLEOS_TIPOS)) {
    if (tipos.some(t => {
      const normalizedCandidate = getTipoDisplayName(t.nome)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return t.nome === tipoNome || normalizedCandidate === normalizedTipo;
    })) return nucleo;
  }
  return null;
}

export function getPublicTipos(): TipoAliancaItem[] {
  return getPublicContributionAreas().map((area) => ({ nome: area.value, descricao: area.description }));
}

export function getTipoDisplayName(nome: string): string {
  return getContributionAreaDisplayName(nome);
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

export function getSegmentosForRamos(ramosAtuacao: string[]): SegmentoItem[] {
  const seen = new Set<string>();
  const segmentos: SegmentoItem[] = [];
  for (const ramo of ramosAtuacao) {
    for (const segmento of getSegmentosForRamo(ramo)) {
      if (!seen.has(segmento.nome)) {
        seen.add(segmento.nome);
        segmentos.push(segmento);
      }
    }
  }
  return segmentos;
}


