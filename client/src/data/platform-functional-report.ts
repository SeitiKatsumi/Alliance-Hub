export type PlatformFeatureStatus = "disponivel" | "evolucao" | "homologacao";

export interface PlatformFeature {
  id: string;
  title: string;
  description: string;
  status: PlatformFeatureStatus;
}

export interface PlatformFunctionalModule {
  id: string;
  title: string;
  summary: string;
  features: PlatformFeature[];
}

export const PLATFORM_FUNCTIONAL_REPORT_UPDATED_AT = "2026-08-10";

export const PLATFORM_FUNCTIONAL_MODULES: PlatformFunctionalModule[] = [
  {
    id: "acesso-onboarding",
    title: "Acesso, cadastro e onboarding",
    summary: "Entrada segura na plataforma, aceite documental e evolução cadastral do usuário.",
    features: [
      { id: "login-email", title: "Login por e-mail e senha", description: "Autenticação com sessão protegida e recuperação de senha.", status: "disponivel" },
      { id: "login-google", title: "Login com Google", description: "Entrada por conta Google quando a integração está habilitada.", status: "disponivel" },
      { id: "convites", title: "Cadastro por convite", description: "Links rastreáveis para adesão de parceiros, candidatos e participantes da rede.", status: "disponivel" },
      { id: "onboarding-perfil", title: "Onboarding de perfil", description: "Coleta progressiva de informações pessoais, profissionais, empresariais e de endereço.", status: "disponivel" },
      { id: "progresso-perfil", title: "Progresso de preenchimento", description: "Percentual de completude no Início e indicação exata dos campos pendentes.", status: "disponivel" },
      { id: "aceites-obrigatorios", title: "Aceites obrigatórios", description: "Registro de ética, políticas, termos dos ambientes e documentos vinculados às BIAs.", status: "disponivel" },
      { id: "localizacao-aceites", title: "Localização nos aceites", description: "Coleta obrigatória da localização autorizada no momento do aceite para compor a evidência documental.", status: "disponivel" },
      { id: "pdf-aceites", title: "Comprovantes em PDF", description: "Consulta dos termos, políticas e MOUs aceitos em PDF institucional.", status: "disponivel" },
    ],
  },
  {
    id: "inicio-gestao",
    title: "Início e Gestão",
    summary: "Visão consolidada do relacionamento do usuário com a rede e seus próximos passos.",
    features: [
      { id: "painel-inicial", title: "Painel inicial personalizado", description: "Resumo de perfil, ambientes BUILT, Aura, BIAs, convergências e ações rápidas.", status: "disponivel" },
      { id: "frase-dia", title: "Frase do dia", description: "Conteúdo institucional rotativo apresentado no painel do usuário.", status: "disponivel" },
      { id: "atalhos-ambientes", title: "Acesso aos ambientes BUILT", description: "Atalhos para Vitrine e Alliances, respeitando o nível de acesso do usuário.", status: "disponivel" },
      { id: "alertas-pendencias", title: "Alertas e pendências", description: "Centraliza convites, chamadas, aprovações e alertas patrimoniais da Carteira.", status: "disponivel" },
      { id: "acoes-alertas", title: "Tratamento de alertas", description: "Permite registrar uma ação em andamento ou ignorar um alerta da Carteira com histórico.", status: "disponivel" },
      { id: "proximas-acoes", title: "Próximas ações", description: "Resumo de compromissos e prioridades conectado à Agenda.", status: "disponivel" },
      { id: "gestao-comunidade", title: "Gestão de comunidade", description: "Acesso rápido às comunidades administradas, membros, BIAs e pendências.", status: "disponivel" },
      { id: "gestao-documentacoes", title: "Documentações", description: "Área para aceites, MOUs e relatórios institucionais da plataforma.", status: "disponivel" },
    ],
  },
  {
    id: "perfil-rede-empresa",
    title: "Perfis, rede e Plano Empresa",
    summary: "Identidade dos participantes, relacionamento profissional e delegação de acesso empresarial.",
    features: [
      { id: "perfil-completo", title: "Perfil pessoal e empresarial", description: "Dados de identificação, contato, atuação, especialidades, redes e portfólio.", status: "disponivel" },
      { id: "foto-avatar", title: "Foto e avatar", description: "Upload e atualização da imagem de perfil do membro.", status: "disponivel" },
      { id: "rede-profissionais", title: "Rede de profissionais", description: "Busca e filtros por nome, empresa, cidade, estado, ramo, segmento, área de atuação e especialidade.", status: "disponivel" },
      { id: "detalhe-membro", title: "Detalhe público do membro", description: "Visualização rastreável do perfil, atuação e informações liberadas para a rede.", status: "disponivel" },
      { id: "edicao-administrativa", title: "Edição administrativa de usuários", description: "Atualização ampliada dos dados do membro pela administração.", status: "disponivel" },
      { id: "plano-empresa", title: "Plano Empresa", description: "Assinatura empresarial atualmente gratuita para criação de acessos de funcionários.", status: "disponivel" },
      { id: "funcionarios-login", title: "Logins individuais de funcionários", description: "Cada funcionário acessa a plataforma com sua própria identidade.", status: "disponivel" },
      { id: "funcionarios-permissoes", title: "Permissões por funcionário", description: "A empresa define quais módulos cada funcionário pode visualizar ou editar.", status: "disponivel" },
    ],
  },
  {
    id: "built-vitrine",
    title: "BUILT Vitrine",
    summary: "Exposição da rede, ativos, oportunidades e demandas para conexão com o mercado.",
    features: [
      { id: "vitrine-parceiros", title: "Vitrine de parceiros", description: "Perfis profissionais e empresariais pesquisáveis na rede BUILT.", status: "disponivel" },
      { id: "vitrine-detalhes", title: "Página de apresentação", description: "Detalhes do parceiro, especialidades, localização, links e informações de contato.", status: "disponivel" },
      { id: "vitrine-obas", title: "OBAs na Vitrine", description: "Publicação e consulta de Oportunidades BUILT de Aliança abertas ao público autorizado.", status: "disponivel" },
      { id: "vitrine-demandas", title: "Demandas da Vitrine", description: "Registro e acompanhamento de necessidades relacionadas a imóveis e serviços.", status: "disponivel" },
      { id: "vitrine-destaques", title: "Destaques e anúncios", description: "Criação de conteúdos de destaque com rastreamento administrativo.", status: "disponivel" },
      { id: "vitrine-banco-ativos", title: "Ativos publicados", description: "Exposição de imóveis enviados explicitamente pelo Banco de Ativos ou pela Carteira.", status: "disponivel" },
    ],
  },
  {
    id: "built-alliances",
    title: "BUILT Alliances",
    summary: "Estruturação de oportunidades, alianças, comunidades e projetos imobiliários.",
    features: [
      { id: "obas", title: "Oportunidades BUILT de Aliança (OBAs)", description: "Cadastro, edição, publicação, consulta e vinculação de oportunidades às BIAs.", status: "disponivel" },
      { id: "mapa-obas", title: "Mapa de oportunidades", description: "Visualização geográfica e filtragem das OBAs disponíveis.", status: "disponivel" },
      { id: "interesse-obas", title: "OBAs de interesse", description: "Registro e acompanhamento do interesse do usuário em oportunidades da rede.", status: "disponivel" },
      { id: "bias", title: "BIAs", description: "Criação e gestão das alianças imobiliárias com identificação pública rastreável.", status: "disponivel" },
      { id: "bia-visao-geral", title: "Visão geral da BIA", description: "Objetivo, localização, tipo, situação, papéis e OBAs relacionadas.", status: "disponivel" },
      { id: "bia-diretoria", title: "Diretoria da BIA", description: "Autor, Aliado BUILT, Diretor de Aliança e diretorias Técnica, Obra, Comercial e Capital.", status: "disponivel" },
      { id: "bia-acessos", title: "Acessos por participante", description: "Matriz por usuário com níveis de visualização e edição para módulos internos da BIA.", status: "disponivel" },
      { id: "bia-documentos", title: "Documentos unificados", description: "Arquivos classificados por núcleo e subnúcleo, incluindo os documentos do Capital.", status: "disponivel" },
      { id: "bia-mou", title: "MOU da BIA", description: "Geração, aceite e consulta do Memorando de Entendimentos vinculado à aliança.", status: "disponivel" },
      { id: "comunidades", title: "Comunidades", description: "Criação, edição e associação de membros e BIAs por território.", status: "disponivel" },
      { id: "rede-alliances", title: "Rede BUILT Alliances", description: "Consulta de participantes e conexões aplicáveis à formação das alianças.", status: "disponivel" },
      { id: "banco-ativos", title: "Banco de Ativos", description: "Cadastro, edição, consulta e exclusão de imóveis disponíveis para oportunidades.", status: "disponivel" },
    ],
  },
  {
    id: "capital-financeiro",
    title: "BUILT Capital e gestão financeira das BIAs",
    summary: "Estrutura patrimonial, lançamentos financeiros, cotas, custos e análises das BIAs.",
    features: [
      { id: "capital-banco", title: "Banco da BIA", description: "Visão dos participantes, aportes e informações patrimoniais do projeto.", status: "disponivel" },
      { id: "capital-financeiro", title: "Gestão financeira", description: "Entradas, saídas, saldo, contas a pagar e receber por BIA.", status: "disponivel" },
      { id: "lancamentos-crud", title: "Lançamentos financeiros", description: "Criação, edição, exclusão individual e exclusão em lote com confirmação.", status: "disponivel" },
      { id: "lancamentos-filtros", title: "Filtros financeiros", description: "Busca por tipo, categoria, responsável, favorecido, CPP, status, descrição e vencimento.", status: "disponivel" },
      { id: "lancamentos-status", title: "Controle de pagamento", description: "Status pago, agendado, pendente ou vencido, com datas e comprovantes.", status: "disponivel" },
      { id: "lancamentos-ia", title: "Lançamentos por IA", description: "Leitura de PDF, imagem, planilha, CSV e texto com prévia editável antes da gravação.", status: "evolucao" },
      { id: "categorias-financeiras", title: "Categorias e responsáveis", description: "Classificação por categoria, responsável, favorecido e tipo de CPP.", status: "disponivel" },
      { id: "valor-origem", title: "Valor de origem parcelado", description: "Forma de pagamento, parcelas, validação e preservação dos lançamentos já pagos.", status: "disponivel" },
      { id: "dm", title: "Calculadora do Divisor Multiplicador", description: "Percentuais por papel, ranges, custo de origem e sincronização com as análises.", status: "disponivel" },
      { id: "dm-superadmin", title: "Exceções administrativas do DM", description: "Superadministradores podem salvar percentuais abaixo de 1%, inclusive zero.", status: "disponivel" },
      { id: "analises-financeiras", title: "Análises financeiras", description: "Receita, deduções, impostos, custo total, resultado e indicadores por metro quadrado.", status: "disponivel" },
      { id: "preco-m2", title: "Análise de preço por m²", description: "Comparação com anúncios do mesmo tipo, região e faixa de área, exigindo amostra mínima válida.", status: "evolucao" },
      { id: "map-cotas", title: "Mapa de Alocação Patrimonial", description: "Distribuição e histórico de movimentações de cotas da BIA.", status: "disponivel" },
      { id: "transferencia-cotas", title: "Transferência de cotas", description: "Movimentação entre participantes associados à própria BIA, com registro do processo.", status: "disponivel" },
    ],
  },
  {
    id: "carteira",
    title: "Carteira Patrimonial Inteligente BUILT",
    summary: "Gestão privada dos imóveis próprios, independente do fluxo financeiro das BIAs.",
    features: [
      { id: "carteira-dashboard", title: "Painel patrimonial", description: "Patrimônio, valor pago, valor estimado, valorização, receitas, despesas e resultado líquido.", status: "disponivel" },
      { id: "carteira-imoveis", title: "Cadastro de imóveis", description: "Criação, edição e exclusão com foto, localização, área, ocupação, objetivo e titularidade.", status: "disponivel" },
      { id: "carteira-oportunidades", title: "Oportunidades imobiliárias", description: "Cadastro separado de imóveis externos ou ativos de terceiros autorizados, sem incorporá-los ao patrimônio próprio.", status: "disponivel" },
      { id: "carteira-historico", title: "Histórico patrimonial", description: "Eventos imutáveis registram alterações relevantes e a origem de cada informação.", status: "disponivel" },
      { id: "carteira-lancamentos", title: "Receitas e despesas por imóvel", description: "Fluxo financeiro privado e isolado das BIAs.", status: "disponivel" },
      { id: "carteira-pulso", title: "Pulso Patrimonial", description: "Atualizações periódicas de ocupação, receitas, despesas, acontecimentos e objetivo.", status: "disponivel" },
      { id: "carteira-audio", title: "Texto, áudio e anexos", description: "Entrada assistida de informações com transcrição e prévia editável.", status: "evolucao" },
      { id: "carteira-documentos", title: "Documentos do imóvel", description: "Matrícula, tributos, contratos, laudos, fotos e planilhas organizados por versão e validade.", status: "disponivel" },
      { id: "carteira-extracao", title: "Extração assistida", description: "IA propõe dados extraídos sem substituir informações confirmadas automaticamente.", status: "evolucao" },
      { id: "carteira-diagnostico", title: "Diagnóstico patrimonial", description: "Situação, oportunidade, risco, recomendação, próxima ação e confiança baseada na cobertura.", status: "evolucao" },
      { id: "carteira-alertas", title: "Alertas patrimoniais", description: "Pendências documentais e operacionais integradas aos Alertas e Pendências do Início.", status: "disponivel" },
      { id: "carteira-acoes", title: "Ações dos alertas", description: "Registro de providência ou descarte consciente, com responsável, horário e histórico.", status: "disponivel" },
      { id: "carteira-alternativas", title: "Comparação de alternativas", description: "Cenários de manter, gerar renda, vender ou transformar o imóvel.", status: "evolucao" },
      { id: "carteira-demandas", title: "Demandas patrimoniais", description: "Conversão de recomendações em demanda para a rede ou rascunho de OBA.", status: "disponivel" },
      { id: "carteira-compartilhamento", title: "Compartilhamento por imóvel", description: "Níveis de leitura, colaboração e administração para convidados.", status: "disponivel" },
      { id: "carteira-publicacao", title: "Publicar no Banco de Ativos", description: "Cópia opcional e confirmada do imóvel privado para o Banco de Ativos.", status: "disponivel" },
    ],
  },
  {
    id: "aura",
    title: "Aura Percebida BUILT",
    summary: "Registro estruturado da percepção reputacional e de aplicabilidade dos membros.",
    features: [
      { id: "aura-registro", title: "Registro de percepção", description: "Avaliação de outro membro com termos vinculados a experiências reais.", status: "disponivel" },
      { id: "aura-termos", title: "Seleção de termos", description: "Escolha manual de termos e expressões do léxico estruturado de Aura.", status: "disponivel" },
      { id: "aura-ia", title: "Análise de percepção com IA", description: "Sugestão de termos a partir de texto e arquivos enviados pelo avaliador.", status: "evolucao" },
      { id: "aura-audio", title: "Gravação e envio de áudio", description: "Captura, animação de gravação e transcrição direta para o campo de percepção.", status: "evolucao" },
      { id: "aura-indice", title: "Índice de Aura", description: "Consolidação das percepções válidas segundo canonicidade, dimensão e frequência.", status: "disponivel" },
      { id: "aura-matriz", title: "Matriz de Aplicabilidade", description: "Horizonte, responsabilidade, aliança recomendada, compatibilidade e cobertura dimensional.", status: "disponivel" },
      { id: "aura-explicacoes", title: "Explicações contextuais", description: "Informações de apoio em cada indicador da Matriz de Aplicabilidade.", status: "disponivel" },
      { id: "aura-card", title: "Card de Aura Percebida", description: "Resumo visual da reputação e das dimensões aplicáveis ao membro.", status: "disponivel" },
    ],
  },
  {
    id: "agenda-notificacoes",
    title: "Agenda, chamadas e notificações",
    summary: "Organização das atividades e comunicações operacionais da rede.",
    features: [
      { id: "agenda", title: "Agenda", description: "Cadastro e acompanhamento de compromissos, prioridades e horários.", status: "disponivel" },
      { id: "chamadas-alianca", title: "Chamadas para aliança", description: "Convocação de participantes para papéis e necessidades das BIAs.", status: "disponivel" },
      { id: "convites-diretoria", title: "Convites de diretoria e sociedade", description: "Aceite ou recusa de indicações para papéis em uma BIA.", status: "disponivel" },
      { id: "notificacoes-painel", title: "Pendências no Início", description: "Destaque de aprovações, pagamentos, documentos, chamadas e ações patrimoniais.", status: "disponivel" },
      { id: "lembretes-carteira", title: "Lembretes do Pulso", description: "Periodicidade mensal, trimestral ou desativada para atualização patrimonial.", status: "evolucao" },
    ],
  },
  {
    id: "administracao",
    title: "Administração da plataforma",
    summary: "Operação da base de membros, configurações, indicadores e monetização.",
    features: [
      { id: "admin-dashboard", title: "Dashboard administrativo", description: "Indicadores de cadastros, empresas, estados, especialidades e operação.", status: "disponivel" },
      { id: "admin-cadastro", title: "Cadastro geral", description: "Pesquisa, filtros, criação e edição administrativa de membros.", status: "disponivel" },
      { id: "admin-config", title: "Configurações", description: "Parâmetros de acesso, ranges e demais regras operacionais da plataforma.", status: "disponivel" },
      { id: "admin-monetizacao", title: "Pagamentos e monetização", description: "Receita, pendências, adesões, anúncios e canais de cobrança.", status: "disponivel" },
      { id: "admin-mapa-calor", title: "Mapa de calor", description: "Distribuição geográfica e leitura da presença da rede.", status: "disponivel" },
      { id: "admin-auditoria", title: "Rastreabilidade administrativa", description: "Responsáveis, datas e identificadores preservados nos fluxos críticos.", status: "disponivel" },
    ],
  },
  {
    id: "pagamentos-integracoes",
    title: "Pagamentos e integrações externas",
    summary: "Cobranças, análise assistida, mapas e serviços conectados à plataforma.",
    features: [
      { id: "adesao-pagamento", title: "Adesão e pagamento por link", description: "Fluxo de convite, aceite e confirmação de pagamento de adesão.", status: "disponivel" },
      { id: "pinbank", title: "Integração PINBANK", description: "Estrutura para onboarding, conta, Pix e boleto em ambiente de testes.", status: "homologacao" },
      { id: "openai", title: "Serviços de IA", description: "Análise de documentos, transcrição, sugestões e explicações com revisão humana.", status: "evolucao" },
      { id: "mapas-geocodificacao", title: "Mapas e geocodificação", description: "Localização de BIAs, OBAs, comunidades e imóveis.", status: "disponivel" },
      { id: "armazenamento-documentos", title: "Armazenamento de arquivos", description: "Upload e recuperação protegida de imagens, comprovantes e documentos.", status: "disponivel" },
    ],
  },
];

export const PLATFORM_FUNCTIONAL_REPORT_SUMMARY = PLATFORM_FUNCTIONAL_MODULES.reduce(
  (summary, module) => {
    summary.modules += 1;
    summary.features += module.features.length;
    for (const feature of module.features) summary[feature.status] += 1;
    return summary;
  },
  { modules: 0, features: 0, disponivel: 0, evolucao: 0, homologacao: 0 },
);
