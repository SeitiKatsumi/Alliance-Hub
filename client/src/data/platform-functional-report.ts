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

export type PlatformReleaseControlStatus = "protegido" | "validar" | "bloqueador";

export interface BiaFunctionalPhase {
  id: string;
  title: string;
  operation: "manual" | "automatica" | "final";
  purpose: string;
  available: string[];
  requirements: string[];
  next: string;
  actors: string;
  restrictions: string[];
}

export interface PlatformAccessProfile {
  id: string;
  title: string;
  identity: string;
  available: string[];
  conditional: string[];
  unavailable: string[];
}

export interface BiaRoleAccessProfile {
  id: string;
  title: string;
  defaultAccess: string[];
  actions: string[];
  limits: string[];
}

export interface PlatformAccessContext {
  id: string;
  title: string;
  effect: string[];
  doesNotGrant: string[];
}

export interface PlatformReleaseControl {
  id: string;
  title: string;
  status: PlatformReleaseControlStatus;
  rule: string;
  evidence: string;
  action: string;
}

export const PLATFORM_FUNCTIONAL_REPORT_UPDATED_AT = "2026-10-22";

export const PLATFORM_FUNCTIONAL_MODULES: PlatformFunctionalModule[] = [
  {
    id: "acesso-onboarding",
    title: "Acesso, cadastro e onboarding",
    summary: "Entrada segura na plataforma, aceite documental e evolução cadastral do usuário.",
    features: [
      { id: "login-email", title: "Login por e-mail e senha", description: "Autenticação com sessão protegida e recuperação de senha.", status: "disponivel" },
      { id: "login-google", title: "Login com Google", description: "Entrada por conta Google quando a integração está habilitada.", status: "disponivel" },
      { id: "convites", title: "Cadastro por convite", description: "Links rastreáveis para adesão de parceiros, candidatos e participantes da rede.", status: "disponivel" },
      { id: "onboarding-perfil", title: "Onboarding de perfil", description: "Coleta progressiva de informações pessoais, profissionais, empresariais e de endereço. Telefone com seletor de país por extenso e DDI acima do número, com validação na etapa Perfil.", status: "disponivel" },
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
      { id: "salvamento-feedback", title: "Feedback de salvamento", description: "Botões de salvamento assíncrono mostram animação e Salvando… enquanto a operação está em andamento, ficam bloqueados contra cliques repetidos e retornam ao estado normal ao concluir ou falhar. Padrão compartilhado entre módulos, com suporte a leitores de tela e redução de movimento.", status: "disponivel" },
      { id: "frase-dia", title: "Frase do dia", description: "Conteúdo institucional rotativo apresentado no painel do usuário.", status: "disponivel" },
      { id: "atalhos-ambientes", title: "Acesso aos ambientes BUILT", description: "Atalhos para Vitrine e Alliances, respeitando o nível de acesso do usuário.", status: "disponivel" },
      { id: "alertas-pendencias", title: "Alertas e pendências", description: "Centraliza convites, chamadas, aprovações, alertas patrimoniais e revisões vigentes do MOU/MAP Inicial destinadas ao próprio signatário. A revisão do MOU aparece dentro de Aprovações pendentes e participa da busca e do contador; revisões superadas ou já aceitas não aparecem, e funcionários não herdam esse aceite pessoal.", status: "disponivel" },
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
      { id: "pulso-obas", title: "Pulso de OBAs", description: "Distribuição em cinco ondas, da comunidade de origem à Vitrine geral, com notificação e e-mail por etapa.", status: "disponivel" },
      { id: "compartilhar-obas", title: "Compartilhamento externo de OBA", description: "Convite individual e temporário que conduz usuários existentes ou novos até a OBA compartilhada.", status: "disponivel" },
      { id: "mapa-obas", title: "Mapa de oportunidades", description: "Visualização geográfica e filtragem das OBAs disponíveis.", status: "disponivel" },
      { id: "interesse-obas", title: "OBAs de interesse", description: "Registro e acompanhamento do interesse do usuário em oportunidades da rede.", status: "disponivel" },
      { id: "bias", title: "BIAs", description: "Criação e gestão das alianças imobiliárias com identificação pública rastreável.", status: "disponivel" },
      { id: "bia-visao-geral", title: "Visão geral da BIA", description: "Tese de interesse, localização, destinação, situação, papéis e OBAs relacionadas.", status: "disponivel" },
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
      { id: "capital-banco", title: "Banco da BIA", description: "Conta Asaas da empresa com saldo atual, cobranças e transferências por situação, período de criação, busca, histórico paginado e comprovantes disponíveis. Os dados são da subconta exclusiva da BIA; consultas incompletas e falhas são informadas. Transferir mantém autorização e confirmação explícitas.", status: "disponivel" },
      { id: "capital-financeiro", title: "Gestão financeira", description: "Entradas, saídas, saldo, contas a pagar e receber por BIA.", status: "disponivel" },
      { id: "lancamentos-crud", title: "Lançamentos financeiros", description: "Criação, edição, exclusão individual e exclusão em lote com confirmação. Ao criar uma despesa, é possível gerar aportes vinculados, herdando participantes, rateio e CPP já definidos na saída, sem campos duplicados. Individual gera um par; Em Grupo gera uma saída e uma entrada correspondente por participante. A prévia fecha o total em centavos e permite ajustar o vencimento dos aportes. Retomada sem duplicação, histórico e consulta dos vínculos; exclusão isolada de registros vinculados é bloqueada. Na criação, os aportes herdam o status e a data de pagamento da saída; Pago exige data. Edições posteriores são independentes e lotes anteriores não são recalculados. A emissão opcional de Pix e boleto para aportes abertos em dinheiro é preparada separadamente após salvar, sujeita à habilitação Asaas. Saídas existentes pendentes, agendadas ou vencidas também podem gerar somente entradas, por valores/percentuais manuais ou MAP oficial, preservando a despesa e seu histórico. Prévia revalidada, origem única, tentativa recuperável e proteção do cronograma legado; Ver aportes permite consultar os vínculos.", status: "disponivel" },
      { id: "lancamentos-filtros", title: "Filtros financeiros", description: "Busca por tipo, categoria, responsável, favorecido, CPP, status, descrição e vencimento. Categorias equivalentes aparecem uma única vez nos seletores de criação, edição e filtro, incluindo duplicações por acentos corrompidos. O filtro inclui os IDs equivalentes e a edição preserva o ID original do lançamento; categorias de grupos, códigos, tipos ou BIAs diferentes continuam separadas.", status: "disponivel" },
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
      { id: "carteira-dashboard", title: "Painel patrimonial", description: "Dois blocos consolidados: Imóveis próprios mostra a soma das estimativas centrais válidas e a soma proporcional dos valores de aquisição declarados; imóvel sem valor de aquisição informado contribui com zero, enquanto valor declarado sem conversão cambial válida permanece incompleto. CPPs em alianças separa Aportado de A aportar. Em BIAs novas, Aportado é a CPP atual multiplicada pelo percentual das parcelas iniciais vigentes, conciliadas e totalmente pagas; o saldo é A aportar. BIAs legadas sem snapshot usam a posição vigente, formada por aportes pagos e origens aceitas. Ausência de evidência ou conciliação pendente fica incompleta, sem virar zero ou 100% por presunção; respostas transitórias ou legadas sem os novos campos exibem Dados insuficientes sem interromper a tela. A antiga estimativa patrimonial da BIA não é apresentada como pagamento. Pesquisa imobiliária permanece automática, sem botão ou listagem individual; prioriza três comparáveis verificáveis em10km e, sem amostra, permite aproximação indicativa de baixa confiança. O card mostra somente o valor central, sem faixa mínima/máxima; evidência técnica, aquisição e preços cadastrados permanecem intactos. Gráficos privados usam observações reais: aquisição versus estimativa e Aportado versus A aportar; pontos legados sem a separação ficam desconhecidos. Não cria lançamentos, não altera MAP/CPP, financeiro, aceites ou histórico original.", status: "disponivel" },
      { id: "carteira-imoveis", title: "Cadastro de imóveis", description: "Criação, edição e exclusão com foto, localização, área, ocupação, objetivo e titularidade.", status: "disponivel" },
      { id: "carteira-pendencias-bia", title: "Correção de pendências patrimoniais", description: "Editor e cálculo da BIA reconhecem a mesma estrutura vigente ou cadastro legado, sem duplicar ativos. Aviso amarelo identifica ativo e campos faltantes e oferece acesso direto à origem da pendência: Ativos Vinculados, imóvel da Carteira ou Financeiro, respeitando a permissão de edição de cada área. No destino do ativo, os campos pendentes ficam contornados em amarelo e o destaque desaparece conforme são corrigidos, sem salvar automaticamente. O valor vazio mantém seu destaque ao trocar a situação; Salvar alteração permanece no rodapé fixo da edição. Endereço ou matrícula não presumem valor nem aquisição; dados ausentes mantêm a estimativa incompleta.", status: "disponivel" },
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
      { id: "agenda", title: "Agenda em lista", description: "Cadastro, filtros e acompanhamento de compromissos, prioridades, responsáveis e horários.", status: "disponivel" },
      { id: "agenda-calendario", title: "Calendário mensal e semanal", description: "Calendário como visualização principal, com navegação por mês ou semana e grade semanal das 24 horas.", status: "disponivel" },
      { id: "agenda-criacao-contextual", title: "Criação pelo calendário", description: "Clique em um dia ou horário abre a nova ação com data e hora preenchidas; a gravação só ocorre após confirmação no formulário autorizado.", status: "disponivel" },
      { id: "chamadas-alianca", title: "Chamadas para aliança", description: "Convocação de participantes para papéis e necessidades das BIAs.", status: "disponivel" },
      { id: "convites-diretoria", title: "Convites de diretoria e sociedade", description: "Aceite ou recusa de indicações para papéis em uma BIA.", status: "disponivel" },
      { id: "notificacoes-painel", title: "Pendências no Início", description: "Destaque de aprovações, pagamentos, documentos, chamadas e ações patrimoniais.", status: "disponivel" },
      { id: "lembretes-carteira", title: "Lembretes do Pulso", description: "Periodicidade mensal, trimestral ou desativada para atualização patrimonial.", status: "evolucao" },
      { id: "lembretes-aporte", title: "Lembretes de pagamento de aportes", description: "Opção por aporte em dinheiro: e-mail e Agenda/Alertas, um mês, uma semana e um dia antes. Dentro da janela escolhida, aviso imediato ao configurar. Uma ação Pagar aporte no calendário na data do vencimento, aberta pelo e-mail e pelo alerta, com acesso ao Pix/boleto. Concluir ação não dá baixa financeira. Gestores configuram; somente o pagador recebe. Deduplicação persistente, suspensão após pagamento e respeito às preferências de e-mail. Sem emissão automática de cobrança pelo lembrete; SMTP e conta do destinatário precisam estar disponíveis.", status: "disponivel" },
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
      { id: "asaas-banco", title: "Banco da BIA — Asaas", description: "Conta própria da empresa, saldo, cobranças e transferências com permissões da BIA. Aportes em dinheiro podem preparar Pix e boleto após salvar e consultar os meios na plataforma, vinculados ao mesmo pagamento. Bloqueios identificam pendências do pagador ou conta; atalhos levam ao campo do cadastro ou Banco conforme a permissão, sem ampliar acesso. Pix exige habilitação na conta recebedora. Pagos e não caixa não são emitidos; falha de emissão preserva o lançamento. Sandbox separado de Produção; emissão depende das habilitações. Homologação de Produção, split e extrato completo não são declarados concluídos.", status: "homologacao" },
      { id: "openai", title: "Serviços de IA", description: "Análise de documentos, transcrição, sugestões e explicações com revisão humana.", status: "evolucao" },
      { id: "mapas-geocodificacao", title: "Mapas e geocodificação", description: "Localização de BIAs, OBAs, comunidades e imóveis.", status: "disponivel" },
      { id: "armazenamento-documentos", title: "Armazenamento de arquivos", description: "Upload e recuperação protegida de imagens, comprovantes e documentos.", status: "disponivel" },
    ],
  },
];

export const BIA_FUNCTIONAL_PHASES: BiaFunctionalPhase[] = [
  {
    id: "em_estruturacao",
    title: "1. Em estruturação",
    operation: "manual",
    purpose: "Montar a BIA antes de qualquer operação financeira ou exposição pública.",
    available: [
      "Criar e retomar o rascunho privado da BIA.",
      "Definir nome, capa, descrição, localização, moeda, destinação e Tese de interesse.",
      "Montar Equipe, cargos, sócios, Base Econômica Inicial, MAP Inicial, CIs, aportes e cronogramas.",
      "Cadastrar estrutura jurídica, Governança, ativos, documentos e informações comerciais.",
      "Salvar revisões e gerar a prévia de conferência sem ativar a BIA.",
    ],
    requirements: [
      "Sessão vinculada a um membro autorizado a criar BIA; hoje o backend aceita membro BUILT, Aliado/selo de aliança, liderança ou administração.",
      "Comunidade de origem e Aliado BUILT identificáveis; o criador entra como Autor e, quando aplicável, Diretor da Aliança.",
      "Para concluir: nome, destinação, Tese de interesse, localização e descrição preenchidos.",
      "Estrutura jurídica sem bloqueios, Equipe com Aliado BUILT e Diretor da Aliança, participantes únicos e MAP Inicial economicamente válido.",
      "Classificações de CPP, CIs, valores, cargos, ativos e anexos devem passar pelas validações do servidor.",
    ],
    next: "Ao concluir a revisão validada, a BIA passa para Em captação e a versão é congelada para os aceites.",
    actors: "Criador do rascunho; depois, participante com Configuração da BIA = editar. Administração possui bypass auditado.",
    restrictions: [
      "A BIA permanece privada.",
      "Banco, lançamentos e demais movimentações financeiras ficam bloqueados.",
      "Salvar rascunho não gera aporte, cobrança, caixa, cota ou aceite.",
    ],
  },
  {
    id: "em_captacao",
    title: "2. Em captação",
    operation: "automatica",
    purpose: "Resolver a composição formal e obter os aceites da revisão vigente antes da ativação operacional.",
    available: [
      "Acompanhar convites de diretorias e sócios, reenviar quando permitido e registrar aceite ou recusa.",
      "Consultar a revisão congelada, o MAP Inicial e o MOU correspondente.",
      "Cada signatário exigido pode aceitar o MOU/MAP da revisão vigente com evidência de identidade, horário e localização.",
      "Preparar aportes iniciais e cronogramas sem liberar movimentação financeira antecipada.",
    ],
    requirements: [
      "Estruturação marcada como concluída.",
      "Aliado BUILT e Diretor da Aliança definidos.",
      "Nenhum convite de diretoria ou sociedade pendente.",
      "MAP Inicial existente, calculável e com classificações de contribuições válidas.",
      "Todos os diretores, sócios e participantes formais da composição devem aceitar o MOU/MAP da mesma revisão.",
      "Nenhuma transição anterior pode estar pendente de conciliação.",
    ],
    next: "Quando todos os requisitos ficam verdadeiros, a conciliação avança automaticamente para Em execução e registra o evento de ativação.",
    actors: "Aliado BUILT e Diretor da Aliança acompanham o fluxo; cada convidado decide apenas o próprio convite/aceite.",
    restrictions: [
      "Convite pendente não é participação aceita e não concede acesso interno.",
      "Aceite de revisão antiga não vale para a revisão atual.",
      "Movimentações financeiras permanecem bloqueadas até Em execução.",
    ],
  },
  {
    id: "em_execucao",
    title: "3. Em execução",
    operation: "automatica",
    purpose: "Executar a implantação da aliança, integralizar aportes e operar os núcleos autorizados.",
    available: [
      "Banco da BIA, Financeiro, Análises e DM conforme papel e matriz individual de acesso.",
      "Aportes, parcelas, cobranças habilitadas, lançamentos, comprovantes e acompanhamento patrimonial.",
      "Documentos dos núcleos Técnico, Obra, Comercial e Capital conforme a diretoria responsável.",
      "Demandas, OBAs, Agenda, alertas, Governança e histórico da BIA.",
      "Correções autorizadas do MAP Inicial e movimentações de cotas com motivo, revisão e auditoria.",
    ],
    requirements: [
      "Transição de captação aplicada e snapshot de ativação registrado.",
      "Acesso financeiro depende simultaneamente da fase, da participação na BIA e da chave específica da matriz de acesso.",
      "Funcionário de empresa também precisa da permissão do Plano Empresa para Alliances ou Capital.",
    ],
    next: "A associação formal de um imóvel ativo à BIA aciona automaticamente a passagem para Em operação.",
    actors: "Cada participante atua somente nos módulos liberados; Diretor de Capital edita Capital por padrão, demais papéis acumulam permissões quando aplicável.",
    restrictions: [
      "Ser membro da BUILT, pertencer à mesma Comunidade ou escolher a mesma tese não libera os dados internos desta BIA.",
      "Autor isolado não recebe leitura automática de Capital.",
      "Terceiro e convite pendente não recebem acesso interno por padrão.",
    ],
  },
  {
    id: "em_operacao",
    title: "4. Em operação",
    operation: "manual",
    purpose: "Operar o ativo e acompanhar receitas, custos, desempenho, demandas e decisões da aliança.",
    available: [
      "Mantém os módulos operacionais e financeiros liberados conforme a matriz da BIA.",
      "Registra receitas, despesas, análises, documentos, demandas, decisões e histórico.",
      "Permite preparar e registrar a deliberação do resultado que seguirá para distribuição.",
    ],
    requirements: [
      "Imóvel formalmente associado e transição de execução conciliada.",
      "Para avançar: resultado positivo informado, motivo/referência e confirmação explícita da deliberação.",
      "A pessoa que registra a deliberação precisa de Configuração da BIA = editar.",
    ],
    next: "Uma deliberação válida de resultado aprovado deve levar a BIA para Em distribuição.",
    actors: "Aliado BUILT, Diretor da Aliança ou outra pessoa com edição efetiva de Configuração; administração por bypass auditado.",
    restrictions: [
      "Receita, aporte ou lançamento isolado não muda a fase automaticamente.",
      "A rota de gravação das deliberações manuais precisa ser concluída antes do lançamento; hoje a interface chama POST /api/bias/:id/fases, mas o backend atual expõe apenas leitura.",
    ],
  },
  {
    id: "em_distribuicao",
    title: "5. Em distribuição",
    operation: "manual",
    purpose: "Executar e comprovar a distribuição do resultado aprovado aos participantes autorizados.",
    available: [
      "Mantém consulta e operação dos módulos de Capital durante a distribuição.",
      "Registra saídas, favorecidos, comprovantes, cotas e histórico conforme as permissões financeiras.",
      "Preserva documentos, MAP, decisões e rastreabilidade para prestação de contas.",
    ],
    requirements: [
      "Resultado aprovado por deliberação registrada na fase anterior.",
      "Para encerrar com segurança, distribuições, obrigações, documentos e pendências devem estar regularizados e conferidos.",
      "Encerramento exige motivo, confirmação e autorização de edição da Configuração da BIA.",
    ],
    next: "Após a prestação de contas e a deliberação de encerramento, passa para Encerrada.",
    actors: "Núcleo de Capital executa finanças; gestores da BIA deliberam e registram o encerramento.",
    restrictions: [
      "A fase não autoriza qualquer membro a consultar valores; continuam valendo a matriz individual e o isolamento por BIA.",
      "O encerramento manual depende da mesma rota de fases ainda pendente no backend.",
    ],
  },
  {
    id: "encerrada",
    title: "6. Encerrada",
    operation: "final",
    purpose: "Preservar a prestação de contas, os documentos e a trilha histórica sem novas operações.",
    available: [
      "Consulta dos módulos anteriormente autorizados, documentos, aceites, MAP e histórico.",
      "Auditoria das transições, movimentações, correções e responsáveis.",
    ],
    requirements: [
      "Deliberação de encerramento aplicada após conferência das pendências.",
      "Motivo e identidade do responsável registrados no histórico.",
    ],
    next: "Não há próxima fase operacional.",
    actors: "Participantes conservam somente a consulta que já possuíam; administração mantém auditoria.",
    restrictions: [
      "O backend bloqueia novas edições e operações nos módulos da BIA encerrada.",
      "Encerrar não apaga dados, aceites, documentos ou histórico.",
    ],
  },
  {
    id: "ativa-legada",
    title: "Compatibilidade: Ativa · fase a revisar",
    operation: "manual",
    purpose: "Classificar BIAs antigas que usam o estado genérico “ativa” dentro do novo ciclo operacional.",
    available: [
      "Consulta e operação financeira continuam pela compatibilidade de fase legada.",
      "A interface oferece revisão para Em execução, Em operação ou Em distribuição.",
    ],
    requirements: [
      "Gestor autorizado deve conferir a situação real e registrar motivo da classificação.",
      "A revisão não deve recriar a BIA, alterar aceites antigos ou inventar uma data histórica.",
    ],
    next: "Depois da revisão aplicada, segue o fluxo da fase escolhida.",
    actors: "Aliado BUILT, Diretor da Aliança, pessoa com Configuração = editar ou administração.",
    restrictions: [
      "A classificação manual depende do POST de fases ainda ausente no backend atual.",
    ],
  },
];

export const PLATFORM_ACCESS_PROFILES: PlatformAccessProfile[] = [
  {
    id: "visitante",
    title: "Visitante sem sessão",
    identity: "Pessoa que ainda não entrou na plataforma.",
    available: ["Login, recuperação de senha e novo cadastro.", "Convites públicos específicos de adesão, OBA, RO, imóvel ou Aura, sempre pelo token correspondente."],
    conditional: ["O token pode ter validade, uso único, escopo e destino definidos pelo fluxo que o criou."],
    unavailable: ["Não acessa Início, Vitrine, Alianças, Carteira, Comunidades, perfis privados, BIAs ou finanças."],
  },
  {
    id: "candidato-onboarding",
    title: "Conta em cadastro ou onboarding",
    identity: "Usuário autenticado que ainda precisa completar dados, aceites ou aprovação.",
    available: ["Continuar somente a primeira etapa pendente do onboarding.", "Preencher identidade, finalidades, perfil, endereço, atuação, contribuições, teses de interesse e aceites.", "Consultar o contexto estritamente necessário aos próprios passos."],
    conditional: ["Acesso pleno começa apenas depois dos requisitos individuais e da vinculação do perfil de membro."],
    unavailable: ["Preferências, convite recebido ou conta criada não equivalem a membro, papel em BIA, comunidade confirmada ou permissão administrativa."],
  },
  {
    id: "usuario-cadastrado",
    title: "Usuário cadastrado sem anuidade ativa",
    identity: "Conta autenticada e concluída, mas sem benefício ativo de Membro BUILT.",
    available: ["Início, próprio perfil, configurações, Agenda pessoal quando liberada, Carteira própria e Negócios para você.", "Vitrine autenticada com resumos de parceiros, Demandas e OBAs sem contatos ou anexos privados.", "BIAs das quais já é participante continuam acessíveis conforme a matriz própria da BIA."],
    conditional: ["Finalidade profissional permite optar pela publicação do próprio perfil na Vitrine; a publicação continua voluntária.", "Convites explícitos podem liberar apenas o recurso e a ação indicados."],
    unavailable: ["Não recebe automaticamente Gestão, rede completa de membros, Comunidades/ROs, Banco de Ativos ou dados privados da Vitrine.", "Não vê finanças, documentos ou participantes de outra BIA."],
  },
  {
    id: "membro-ativo",
    title: "Membro BUILT com anuidade ativa",
    identity: "Membro individual com participação vigente na rede.",
    available: ["Tudo do usuário cadastrado, mais Gestão, Comunidades e ROs, Rede de Membros Aliados e Banco de Ativos.", "Criar e manter imóveis e oportunidades, demandas, interesses e propostas nos fluxos autorizados.", "Escolher teses de interesse, participar automaticamente das Células derivadas em suas Comunidades e usar filtros de oportunidades das próprias Células.", "Criar uma BIA quando possui sessão de membro, comunidade e Aliado identificável; o rascunho nasce privado e o backend valida toda a estrutura."],
    conditional: ["Acesso a uma BIA específica depende de participação/papel e da matriz daquela BIA.", "Criar ou administrar OBA da BIA depende do papel de diretoria ou administração.", "Publicar dados depende de consentimento e projeção própria de cada módulo."],
    unavailable: ["Anuidade ou tese escolhida não concede Administração, coordenação de Célula, papel em BIA, Capital de outra aliança ou Carteira de terceiros."],
  },
  {
    id: "funcionario",
    title: "Funcionário do Plano Empresa",
    identity: "Usuário individual vinculado à empresa, com onboarding, aceites e auditoria próprios.",
    available: ["Somente Início por padrão.", "O titular pode conceder none, view ou edit para Agenda, Carteira, Vitrine, Alianças, Capital e Aura."],
    conditional: ["Para um módulo interno de BIA, precisa ao mesmo tempo da permissão empresarial e de papel/permissão na própria BIA.", "Edição exige nível edit; view nunca é tratado como edição."],
    unavailable: ["Não herda automaticamente a identidade, comunidades, Carteira, papéis ou acessos do titular.", "A empresa não pode conceder Administração da plataforma pela matriz do Plano Empresa."],
  },
  {
    id: "titular-empresa",
    title: "Titular ou gestor do Plano Empresa",
    identity: "Responsável pelo plano e pelos acessos empresariais.",
    available: ["Gerenciar os funcionários da própria empresa e definir a matriz de módulos de cada conta.", "Consultar assinatura, renovação, suspensão e congelamento do próprio plano."],
    conditional: ["Funcionários continuam obrigados a usar login individual, onboarding e aceites próprios."],
    unavailable: ["Gerenciar empresa não concede Administração global, acesso a outra empresa nem acesso automático a uma BIA ou Carteira privada."],
  },
  {
    id: "aliado-built",
    title: "Aliado BUILT",
    identity: "Responsável de governança da Comunidade e/ou Aliado formal de uma BIA.",
    available: ["Entrar em Alianças antes da primeira BIA quando o papel/selo oficial está presente.", "Administrar as Comunidades sob sua governança, tratar aprovações e acompanhar fluxos de aliança.", "Criar BIA quando reconhecido pelo cadastro/comunidade; na própria BIA, editar Diretoria e Configuração, administrar acessos e consultar Capital por padrão.", "Corrigir MAP Inicial após ativação, deliberar fases quando o fluxo estiver completo e excluir BIA quando autorizado, sempre com confirmação e rastro."],
    conditional: ["O papel é contextual: Aliado de uma Comunidade ou BIA não é administrador de todas as Comunidades/BIAs."],
    unavailable: ["Não acessa o painel administrativo global, Carteira privada de membros ou finanças de outra aliança."],
  },
  {
    id: "coproprietario-limitado",
    title: "Conta limitada de coproprietário",
    identity: "Conta criada para um vínculo patrimonial específico.",
    available: ["Imóveis compartilhados, documentos, participação, convites e BIAs originadas desses imóveis dentro do escopo autorizado."],
    conditional: ["Coproprietário confirmado consulta o imóvel e sua participação; colaboração/administração dependem do acesso explícito do imóvel."],
    unavailable: ["Sem Comunidades, Aura, anuidade geral, Carteira de terceiros ou acesso a outras BIAs."],
  },
  {
    id: "administracao",
    title: "Administração e superadmin",
    identity: "Papéis operacionais centrais da plataforma.",
    available: ["Dashboard, cadastro geral, configurações, monetização, integrações, auditoria e bypass completo dos módulos internos da BIA.", "Ações administrativas registram executor e continuam exigindo sessão e validações de domínio."],
    conditional: ["Exceções sensíveis, como DM abaixo de 1%/zero, ficam restritas ao superadmin e devem ser auditadas."],
    unavailable: ["O papel administrativo não concede acesso global automático à Carteira privada; a listagem patrimonial continua limitada a propriedade, copropriedade aceita e compartilhamento explícito."],
  },
];

export const BIA_ROLE_ACCESS_PROFILES: BiaRoleAccessProfile[] = [
  {
    id: "autor",
    title: "Autor da Oportunidade/BIA",
    defaultAccess: ["Diretoria: visualizar.", "Demais chaves internas: sem acesso por padrão."],
    actions: ["Acompanha a estrutura que originou e pode acumular outros cargos.", "Se também for o criador do rascunho, edita esse rascunho até a conclusão."],
    limits: ["Autor isolado não recebe leitura automática de Banco, Financeiro, Análises ou DM.", "Não administra acessos nem fases sem outra permissão acumulada."],
  },
  {
    id: "aliado",
    title: "Aliado BUILT da BIA",
    defaultAccess: ["Diretoria: editar.", "Configuração da BIA: editar.", "Banco, Financeiro, Análises e DM: visualizar no mínimo."],
    actions: ["Administra a matriz de acesso dos participantes configuráveis.", "Conduz aprovações, correções autorizadas do MAP, estrutura, deliberações e exclusão confirmada da própria BIA."],
    limits: ["O acesso vale somente para as BIAs em que está vinculado.", "Edição financeira exige permissão edit adicional; a leitura mínima não vira edição."],
  },
  {
    id: "diretor-alianca",
    title: "Diretor da Aliança",
    defaultAccess: ["Diretoria: editar.", "Configuração da BIA: editar.", "Banco, Financeiro, Análises e DM: visualizar no mínimo."],
    actions: ["Administra acessos, Equipe, Governança, estrutura e transições da própria BIA.", "Pode criar OBA da BIA em fase operacional e corrigir o MAP Inicial após ativação."],
    limits: ["Não é administrador global nem gestor automático de outra BIA/Comunidade.", "Edição de Capital depende da matriz ou de cargo acumulado."],
  },
  {
    id: "diretor-tecnico",
    title: "Diretor do Núcleo Técnico",
    defaultAccess: ["Documentos Técnicos: editar.", "Banco, Financeiro, Análises e DM: visualizar no mínimo."],
    actions: ["Gerencia documentos e atividades do núcleo técnico e atua em fluxos autorizados da BIA."],
    limits: ["Não edita Configuração, Diretoria ou documentos de outros núcleos por esse cargo isolado."],
  },
  {
    id: "diretor-obra",
    title: "Diretor do Núcleo de Obra",
    defaultAccess: ["Documentos de Obra: editar.", "Banco, Financeiro, Análises e DM: visualizar no mínimo."],
    actions: ["Gerencia documentos e atividades de execução/obra da própria BIA."],
    limits: ["Não edita Configuração, Diretoria ou outros núcleos sem permissão acumulada."],
  },
  {
    id: "diretor-comercial",
    title: "Diretor do Núcleo Comercial",
    defaultAccess: ["Documentos Comerciais: editar.", "Banco, Financeiro, Análises e DM: visualizar no mínimo."],
    actions: ["Gerencia documentos e atividades comerciais e pode atuar nas oportunidades autorizadas da BIA."],
    limits: ["Não edita Capital ou Configuração apenas por esse cargo."],
  },
  {
    id: "diretor-capital",
    title: "Diretor do Núcleo de Capital",
    defaultAccess: ["Documentos de Capital: editar.", "Banco, Financeiro, Análises e DM: editar."],
    actions: ["Gerencia conta, aportes, parcelas, lançamentos, análises, DM, comprovantes e distribuição da própria BIA, respeitando a fase."],
    limits: ["Não edita Configuração ou Diretoria sem papel/permissão adicional.", "Fase não financeira e BIA encerrada continuam bloqueando movimentações."],
  },
  {
    id: "socio",
    title: "Sócio Guardião ou Multiplicador",
    defaultAccess: ["Banco, Financeiro, Análises e DM: visualizar no mínimo."],
    actions: ["Consulta sua BIA, composição, direitos, aportes, movimentações e documentos que sua matriz liberar.", "Aceita o próprio MOU/MAP e atua em transferências/solicitações destinadas a si."],
    limits: ["Ser sócio não concede edição financeira, Configuração ou administração de acessos.", "A leitura mínima vale somente na BIA em que o vínculo foi aceito."],
  },
  {
    id: "terceiro",
    title: "Terceiro vinculado",
    defaultAccess: ["Nenhuma chave interna por padrão; o terceiro não entra na matriz configurável."],
    actions: ["Pode aparecer como identificação formal ou destinatário no contexto em que foi incluído."],
    limits: ["Não recebe Capital, Diretoria, Configuração ou documentos internos apenas por estar citado."],
  },
  {
    id: "convite-pendente",
    title: "Convidado pendente",
    defaultAccess: ["Somente o convite e a ação de aceitar/recusar correspondente."],
    actions: ["Consulta as informações mínimas necessárias para decidir o convite."],
    limits: ["Não é participante, não entra nos módulos da BIA e não recebe leitura financeira antes do aceite e da vinculação oficial."],
  },
  {
    id: "admin-bia",
    title: "Administração da plataforma na BIA",
    defaultAccess: ["Todas as dez chaves da matriz em nível editar por bypass do backend."],
    actions: ["Suporte, conciliação, auditoria e operação administrativa dentro das validações de fase e domínio."],
    limits: ["O bypass não remove sessão, rastreabilidade, confirmação ou bloqueio de BIA encerrada."],
  },
];

export const PLATFORM_ACCESS_CONTEXTS: PlatformAccessContext[] = [
  {
    id: "finalidade-conta",
    title: "Selecionar uma finalidade no onboarding",
    effect: ["Personaliza campos, recomendações e jornada para imóvel, atuação profissional e/ou capital.", "A finalidade profissional torna o usuário elegível a optar pela publicação do próprio perfil na Vitrine."],
    doesNotGrant: ["Não concede Alianças, Capital, Administração, comunidade, cargo ou acesso a BIA."],
  },
  {
    id: "tese-negocio",
    title: "Selecionar uma tese de interesse",
    effect: ["Salva a preferência na própria conta.", "Deriva uma das cinco Células estratégicas correspondentes.", "Cria ou reativa participação automática na Célula derivada em todas as Comunidades efetivas e na Comunidade mãe do membro.", "Alimenta filtros de oportunidades e o contexto de criação/revisão da Tese de interesse da BIA.", "Ao remover a preferência, vínculos derivados da preferência saem; vínculos manuais ativos são preservados."],
    doesNotGrant: ["Não torna a pessoa coordenadora, Aliado, diretor, sócio, administrador ou membro de outra Comunidade.", "Não libera uma BIA, seus participantes, documentos, MAP ou finanças.", "Não publica perfil, imóvel, Demanda ou OBA automaticamente."],
  },
  {
    id: "comunidade-celula",
    title: "Pertencer a uma Comunidade ou Célula",
    effect: ["Permite consultar a Comunidade, Células, ROs e oportunidades dentro das regras de anuidade e participação.", "O filtro Das minhas Células usa participação ativa, não apenas preferência salva."],
    doesNotGrant: ["Não concede gestão da Comunidade, coordenação da Célula ou acesso interno às BIAs relacionadas.", "Selecionar outra Célula para distribuir uma OBA não cria vínculo comunitário."],
  },
  {
    id: "convite-oba-ro",
    title: "Receber convite de OBA ou RO",
    effect: ["Token válido libera somente a consulta/decisão do objeto convidado e preserva origem, autor e Comunidade do convite."],
    doesNotGrant: ["Não cria automaticamente interesse, proposta, participação em BIA, associação comunitária ou acesso à rede inteira."],
  },
  {
    id: "convite-imovel",
    title: "Receber compartilhamento de imóvel",
    effect: ["Libera leitura, colaboração ou administração apenas do imóvel indicado, segundo o nível e a validade do convite."],
    doesNotGrant: ["Não abre a Carteira completa do proprietário, outros imóveis, outras empresas ou outras BIAs."],
  },
  {
    id: "anuidade",
    title: "Ter anuidade ativa",
    effect: ["Libera as superfícies de rede que exigem benefício ativo: Gestão, Comunidades/ROs, Rede de Membros e Banco de Ativos, além de detalhes autorizados da Vitrine."],
    doesNotGrant: ["Não substitui papel, aceite, matriz empresarial, matriz de BIA ou autorização sobre Carteira."],
  },
  {
    id: "bia-publica",
    title: "Uma BIA estar marcada como pública",
    effect: ["Deve permitir somente uma apresentação pública sanitizada da existência, tese e contexto da BIA."],
    doesNotGrant: ["Não deve liberar Equipe completa, valores, MAP, cotas, aportes, lançamentos, análises, documentos internos ou dados bancários."],
  },
  {
    id: "permissao-personalizada-bia",
    title: "Receber permissão personalizada em uma BIA",
    effect: ["Aliado/Diretor da Aliança pode definir none, view ou edit para Diretoria, Configuração, quatro grupos documentais e quatro áreas de Capital.", "Quando uma pessoa acumula papéis, prevalece o maior nível válido."],
    doesNotGrant: ["A personalização nunca atravessa para outra BIA.", "Pisos de segurança permanecem: gestores conservam Diretoria edit e papéis de sócio/diretoria conservam leitura mínima de Capital."],
  },
];

export const PLATFORM_RELEASE_CONTROLS: PlatformReleaseControl[] = [
  {
    id: "bia-module-gate",
    title: "Módulos internos da BIA",
    status: "protegido",
    rule: "Banco, Financeiro, Análises, DM, Configuração, Diretoria e documentos devem exigir a chave exata da BIA e o nível view/edit no backend.",
    evidence: "requireBiaModuleAccess combina sessão, permissão do funcionário, resolução da BIA, papel/matriz individual, fase financeira e bloqueio de encerramento.",
    action: "Manter testes por papel, por chave, por nível e por BIA diferente em toda nova rota.",
  },
  {
    id: "employee-double-gate",
    title: "Funcionário com dupla autorização",
    status: "protegido",
    rule: "Funcionário precisa da permissão do Plano Empresa e da autorização contextual do recurso/BIA.",
    evidence: "A matriz empresarial é verificada antes da matriz da BIA; falha em qualquer uma retorna 403.",
    action: "Não aceitar a permissão do titular como substituta do papel dentro da BIA.",
  },
  {
    id: "private-wallet",
    title: "Carteira e arquivos privados",
    status: "protegido",
    rule: "Somente proprietário, coproprietário aceito ou convidado explícito acessa o imóvel e seus filhos.",
    evidence: "O escopo é resolvido pelo imóvel pai; até admin/superadmin não recebe listagem patrimonial global automática.",
    action: "Testar sempre outro proprietário, acesso expirado e arquivo apontando para imóvel não autorizado.",
  },
  {
    id: "public-projections",
    title: "Projeções públicas da Vitrine",
    status: "protegido",
    rule: "Resumos públicos omitem contatos, endereço exato, proprietário e anexos privados.",
    evidence: "A Vitrine separa resumo autenticado, detalhe de membro ativo e permissões de publicação/moderação.",
    action: "Evitar retornar objetos brutos de Directus nas rotas públicas; usar allowlist de campos.",
  },
  {
    id: "public-bia-projection",
    title: "Projeção pública das BIAs",
    status: "bloqueador",
    rule: "Usuário comum nunca deve receber finanças, MAP, composição completa ou documentos internos de uma BIA que apenas está pública.",
    evidence: "Hoje canViewBia aceita qualquer BIA com bia_publica diferente de false, e GET /api/bias, GET /api/bias/:id e rotas de MAP baseadas somente nessa checagem retornam objetos amplos.",
    action: "Antes do lançamento, criar projeção pública por allowlist e exigir requireBiaModuleAccess nas rotas de MAP, versões e qualquer dado financeiro/participante. Adicionar testes negativos entre duas BIAs.",
  },
  {
    id: "phase-write-route",
    title: "Transições manuais de fase",
    status: "bloqueador",
    rule: "Resultado aprovado, revisão de BIA legada, encerramento e retomada precisam de endpoint autorizado, idempotente e auditado.",
    evidence: "A interface envia POST /api/bias/:id/fases, mas o backend atual registra apenas os GETs de requisitos e histórico.",
    action: "Implementar e testar o POST antes de declarar Operação → Distribuição e Encerramento como utilizáveis.",
  },
  {
    id: "cross-tenant-regression",
    title: "Matriz de testes contra vazamento",
    status: "validar",
    rule: "Cada recurso sensível deve ser testado com dono, participante, não participante, funcionário view/edit/none, admin e usuário de outra BIA/empresa.",
    evidence: "Existem testes centrais de bia-access, company-access e Carteira, mas o inventário de endpoints ainda precisa virar uma suíte de autorização transversal.",
    action: "Bloquear o release até a suíte cobrir listagem, detalhe, arquivos, exportações, busca, contadores e erros sem revelar existência do recurso.",
  },
  {
    id: "report-visibility",
    title: "Visibilidade deste relatório interno",
    status: "validar",
    rule: "A matriz de prontidão e os bloqueadores devem ter público definido antes da produção.",
    evidence: "A rota do relatório está dentro do aplicativo autenticado, mas não possui guarda administrativa própria no cliente.",
    action: "Decidir se o relatório continua para todos os membros ou se deve ficar somente na Administração; não publicar detalhes de bloqueadores sem decisão consciente.",
  },
  {
    id: "provider-secrets",
    title: "Integrações e dados bancários",
    status: "protegido",
    rule: "Credenciais, payloads integrais e PII de Asaas/Stripe/OpenAI não podem ser enviados ao cliente ou gravados em logs comuns.",
    evidence: "As rotas bancárias exigem BIA, capital_banco/capital_financeiro e configuração separada por ambiente; chaves de subconta são cifradas.",
    action: "Manter Sandbox e Produção separados e revisar logs/erros antes de cada deploy.",
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
