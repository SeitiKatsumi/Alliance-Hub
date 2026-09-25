# Area de Aliancas, Oportunidades e BIAs

## Criação em sete etapas (2026-09-25)

- Ativos Vinculados oferece **Adicionar da Carteira** com busca por nome/cidade/endereço, ordenação pt-BR e seleção de vários ativos sem repetir a mesma origem. Reutiliza `GET /api/carteira/imoveis?para_bia=1`: somente imóveis ativos próprios ou com administração explicitamente compartilhada; privilégio global de admin, colaboração ou leitura não habilitam exportação de cadastro privado para a BIA. A validação é repetida no backend ao adicionar/trocar a referência no rascunho ou na estrutura concluída.
- `ativos[].carteiraImovelId` é referência opcional ao cadastro original PostgreSQL; nome, descrição, endereço, área e matrícula/cartório são uma cópia informativa editável da seleção. Não copia dinheiro, dívida, titularidade, documentos ou acessos; não sincroniza alterações posteriores. A seleção só é persistida ao salvar. Não altera `bia_imovel_origens`, participações, cálculos, totais da Carteira, fase, notificações ou documentos já emitidos. Remover o cadastro na BIA não exclui o original. Referências históricas existentes permanecem editáveis pela permissão da BIA sem exigir acesso atual à Carteira privada.
- A lista comporta vários ativos da Carteira e manuais, sem converter registros legados ou inferir correspondência para ativos anteriormente preenchidos. Nenhuma nova migração é necessária para a referência JSON; a tabela versionada da migração de sete etapas continua necessária para salvar BIAs concluídas. PDF e revisão usam os campos informativos existentes, sem buscar conteúdo privado adicional.

- Edição existente: `/bias/:id/editar` usa página completa, identidade visual/controles BUILT e as mesmas sete áreas da criação. Entradas pelo detalhe, lista e `?edit=` convergem para essa rota. Permissões são consultadas antes de exibir; falhas não liberam edição.
- Dados da BIA salva apenas identidade/capa/anexos, sem reenviar equipe, percentuais, análises, fase ou informações comerciais antigas. Ativo incompleto não bloqueia uma correção cadastral. BEI reutiliza o editor econômico com revisão própria; MAP Inicial filtra seu histórico, sem misturar MAP Atual. Jurídico/ativos reutilizam o editor versionado e dependem da migração já descrita. Ativação permanece uma consulta/atalho, nunca efeito de Salvar.
- Edição mantém os editores de BEI/jurídico montados ao trocar de área, protege saída com alterações pendentes e mantém rodapé visível. Navegação numerada no desktop e seletor de área no celular. Revisão distingue salvamento cadastral dos salvamentos econômicos/jurídicos, que conservam confirmações independentes.

- Fluxo atual: Dados da BIA → Base Econômica Inicial → MAP Inicial → Estrutura Jurídica → Ativos Vinculados → Revisão → Ativação. As descrições de quatro etapas abaixo são históricas, não o fluxo atual.
- Dados conserva identidade/capa/localização/anexos/selo. BEI conserva cálculo e oito blocos; participantes, CIs e aportes ficam no bloco 5; funções acumuladas no bloco 7, Governança e Divisor Multiplicador. Nomes visuais não substituem identificadores canônicos.
- MAP Inicial separa condição/Autor da coluna Governança, incluindo funções com índice zero. Autor é opcional; Aliado e Diretor de Aliança continuam obrigatórios.
- `shared/bia-setup.ts` define o contrato `estrutura_bia` de rascunho, validações, adaptação legada e consolidação monetária. Estrutura Jurídica permite Societária/Contratual, responsável com OAB, empresa/instrumento, sócios formais e conta. Sócio formal externo não cria participação, CPP ou acesso.
- Administrador e responsável jurídico permitem buscar nomes no diretório autorizado existente (`GET /api/membros`), em ordem alfabética, ou digitar pessoa externa. São identificações textuais, não vínculos de acesso, Governança ou MAP. O atalho de convite exige ação explícita e reutiliza `POST /api/meu-convite` (`unificado`, sem forçar novo link), incluindo autenticação/comunidade/validade do fluxo da rede. Não envia e-mail nem convida automaticamente para a BIA. Controles de convite ficam indisponíveis em consulta/salvamento.
- `juridico.oabResponsavel` é texto limitado a 100 caracteres, sem consulta automática ao registro profissional; substitui CPF/CNPJ como requisito na nova conclusão. `documentoResponsavel` permanece legado, nunca é convertido em OAB e aparece identificado no histórico/resumo/PDF. OAB integra o JSON versionado PostgreSQL e rascunho, sem nova coluna/migração ou escrita no perfil Directus. Omissão por cliente antigo preserva identificadores já armazenados; string vazia explícita permite limpar OAB. Conclusões já iniciadas e BIAs ativas não são invalidadas. Sócios formais e dados da empresa continuam com CPF/CNPJ.
- O editor valida a estrutura antes do envio e a API identifica o primeiro campo inválido com o motivo correspondente; não substituir a mensagem por um `400` genérico nem relaxar CPF/CNPJ, datas, valores não negativos, unicidade de ativos ou funções canônicas.
- Ativos são lista informativa, com dados antigos reaproveitados uma vez e datas/titularidade/situação desconhecidas vazias. Valores em moeda da BIA são somados somente entre ativos identificados; indicadores legados não distribuídos ficam separados. Percentuais nunca são somados. Não altera Carteira, propriedade, lançamentos ou fase; não reescreve cláusulas patrimoniais de MOU por simples cadastro informativo.
- Após conclusão, `GET/PUT /api/bias/:id/estrutura` consulta/edita pelo acesso `configuracao_bia`; conta exige também `capital_banco` e, para funcionário, acesso empresarial Capital. `GET/PUT /api/bias/:id/governanca` usa `diretoria`, sem expor dados jurídicos/bancários. Papéis vêm das relações normalizadas Directus; essa API altera somente início conhecido e responsabilidades específicas. Atribuições-padrão aguardam texto aprovado.
- Persistência aditiva: `migrations/20260925_bia_setup.sql`, tabela PostgreSQL `bia_estrutura_versoes`. Versões completas imutáveis, autor/horário/motivo/conteúdo anterior, revisão esperada e lock da BIA. Directus permanece oficial para identidade/fase. API antiga de informações bloqueia escrita quando existe estrutura versionada.
- Rascunhos mantêm a versão econômica original; omissão de `estrutura_bia` em cliente antigo não apaga os dados novos. Conclusão valida responsável jurídico antes de congelar/enviar convites, registra snapshot com BEI/MAP/participantes/documentos e segue Em captação. CNPJ, constituição, banco e ativo indefinido são avisos. Anexos são informativos, não exigências de assinatura.
- Após aceites vigentes, exibe Ativa + fase operacional. Registro de ativação usa evento idempotente e revisão da estrutura capturada na intenção de fase; recuperação não inventa datas de BIAs antigas. Documentos/aceites existentes não são reemitidos ou invalidados.
- PDF de Revisão acrescenta seleções Jurídico, Ativos e Documentos; mantém paisagem, marca oficial e cabeçalho/rodapé aprovados. Exporta somente o conteúdo já autorizado da revisão, sem consulta adicional ou upload automático.
- A API local não aplica essa migração automaticamente. Em produção, `start.sh` executa o runner existente `migrate.cjs` antes de iniciar a API, com transação e registro das migrações aplicadas. Sem a tabela, novos endpoints/conclusão respondem erro recuperável; não enviar convites antes desse preflight. Aplicação no banco compartilhado e deploy exigem autorização operacional.
- Regressões: `shared/bia-setup.test.ts`, `server/bia-setup.test.ts`, `server/bia-draft-api.test.ts`, testes BEI/revisão/criação, além da suíte de fases/MAP/aceites existente.

## Objetivo e usuarios

Na conclusão de rascunhos, as validações da criação (inclusive autorização e Aliado) são reaproveitadas antes de congelar a revisão. Recusas de validação não bloqueiam a edição; falhas após iniciar efeitos externos mantêm a revisão congelada para recuperação. A interface retoma essa revisão sem reenviar um PUT com defaults locais. Rascunhos incompletos aceitam índices ausentes, mas rejeitam estruturas de contribuição malformadas.

O fluxo anterior usa MAP Zero modelo 3: capital comprometido por valor e CPPs classificadas por componente na estruturacao. A nova criação em etapas usa modelo 4, descrito abaixo, ainda em validação integrada. A origem de imovel preenche valores pela copropriedade aceita, com natureza patrimonial, mas exige selecionar os tipos de CPP antes do aceite. Modelos anteriores nao sao convertidos. Cadastro/confirmacao de aportes seguem o contrato de Capital/Financeiro; salvar MAP nao gera caixa.

Organiza oportunidades, OBAs/OPAs, Banco de Ativos, comunidades e o ciclo completo de estruturacao e operacao de uma BIA.

## Telas e URLs

- A criação em etapas em desenvolvimento (`/bias/nova`) preserva os seletores do cadastro anterior: Destinação (Residencial, Comercial, Industrial, Misto, Hospedagem, Rural), Objetivo (Renda, Venda, Operação), catálogo completo de moedas com busca e localização no mapa. As opções compartilhadas em `shared/bia-form-options.ts` são usadas também pela validação dos rascunhos; mudar o layout não remove opções nem escolhe destinação/objetivo silenciosamente.

- MAP Zero em BIA legada admite composição original revisada explicitamente, registrada somente no histórico. Não converte a BIA para o modelo novo nem altera participações vigentes ou documentos assinados; autorização, pendências e confirmação estão no contrato de Capital.

- Na BIA, Capital -> DM edita apenas os indices individuais. Composicao fica em MAP -> MAP Zero -> Editar composicao (`/movimentacao-cotas/:biaId?view=zero`); Financeiro -> Aportes e parcelas concentra cronogramas. Criacao de BIA, regras de equipe, revisoes, MOU e aceites permanecem inalterados.

- `/area-aliancas`, `/area-aliancas/oportunidades/:codigo`.
- `/area-aliancas?tab=comunidades` e `/area-aliancas?tab=oportunidades` deixam Comunidades e Oportunidades acessiveis na navegacao principal do ambiente. Celulas e ROs pertencem a uma Comunidade e aparecem como abas em `/comunidade/:id?tab=celulas` e `/comunidade/:id?tab=ros`.
- `/opas/:id`, `/bias`, `/bias/:id`.
- `/land-bank/:id`, `/oportunidades*`.
- `/banco-ativos` exibe diretamente Land Bank e Ativos Edificados, sem a navegacao geral de Rede da Area de Aliancas.
- `/rastreabilidade/:codigo`.
- Implementacao principal em `client/src/pages/area-aliancas.tsx`, `client/src/pages/opa-detalhe.tsx`, `client/src/pages/bias.tsx`, `client/src/pages/bia-detalhe.tsx`, `client/src/pages/land-bank-detalhe.tsx` e componentes de estruturacao/distribuicao.

## APIs e tarefas

### Criação em etapas (modelo 4, validação integrada em andamento)

- `Adicionar cargo` fica sempre visível abaixo das linhas de cada participante, fora de Detalhes. Cria outra linha de cargo/DM na mesma ficha; o seletor de cada linha continua escolhendo um cargo, e cargos já atribuídos a outras pessoas permanecem indisponíveis.

- Na tabela compacta da criação, cada pessoa tem um único seletor e um único capital na primeira linha. Cargos adicionais ocupam linhas abaixo dentro do mesmo grupo, com DM próprio e sem repetir o participante. No celular os cargos continuam agrupados abaixo da pessoa. Estrutura persistida e demais editores não mudam.

- Equipe e DM usa toda a largura, sem resumo lateral: Valor de Origem e totais ficam em uma faixa superior. A tabela compacta mantém DM por cargo e capital editável somente na primeira linha de cada pessoa; natureza, CPPs e ações de cargos ficam em detalhes expansíveis com aviso de classificação pendente. No celular, os campos empilham. Outras etapas preservam o resumo lateral. É mudança de apresentação, sem novos cálculos, permissões, endpoints ou gravações.

- `/bias/nova` e `/bias/:id/estruturacao` usam Dados, Equipe e DM, MAP Zero e Revisão. A edição geral permanece no formato anterior. Capa, anexos, moeda, localização, destinação, objetivo, selo, análises e informações complementares reutilizam controles/opções existentes.
- `POST /api/bias` com `_rascunho=true` e UUID `chaveCriacao` registra dados incompletos; `GET/PUT /api/bias/:id/rascunho` consulta/atualiza com `revisaoEsperada`. Proprietário de rascunho não concluído ou configuração efetiva pode retomá-lo. Campos ausentes não viram zero.
- `POST /api/bias/:id/concluir-estruturacao` valida e congela a revisão antes dos efeitos externos. Falha deixa conclusão recuperável; alteração da revisão congelada é recusada. Repetição não deve duplicar convites. Nenhum aceite é permitido enquanto a conclusão estiver pendente.
- Fonte oficial da BIA/fase: Directus. Rascunho e histórico de transições: PostgreSQL `bia_estruturacao_rascunhos` e `bia_fase_eventos`, migração aditiva `20260922_bia_workflow.sql`. Não converter registros anteriores.
- `GET/POST /api/bias/:id/fases` registra deliberações autorizadas por Diretor, Aliado ou superadmin, motivo e revisão de fase (`faseEsperada`). Evento estável deduplica; `acao=retomar` recupera somente uma intenção já existente. A UI exibe conciliação pendente.
- Fases novas: estruturação → captação → execução → operação → distribuição; encerramento é explícito, com pendências regularizadas. Execução depende dos aceites vigentes, não de imóvel. Operação depende do vínculo formal. Distribuição depende de deliberação com valor aprovado, não de receita, aporte ou empréstimo.
- Compatibilidade dos caminhos de origem por imóvel e revisão completa de consumidores ainda precisa ser encerrada antes de publicação. Ver relatório de trabalho `docs/audit/BIA_WIZARD_WIP_2026-09-22.md`.

- `/api/bias*`, `/api/opas*`, `/api/oportunidades*`, `/api/land-bank-assets*`.
- `/api/bia-estruturacao-solicitacoes*`, aprovacoes, diretorias, socios e chamadas.
- `/api/carteira/imoveis/:id/origem-bia*` cria uma BIA rastreada a partir de um imovel e reutiliza aprovacoes e MOU existentes; `/convites-alianca` disponibiliza o aceite para contas limitadas.
- Demandas, Pulso, feedback, reunioes, rastreabilidade e oportunidades economicas.
- Demandas aceitam Celula e Tipo de negocio; OBAs podem selecionar outras Celulas ativas como destino do disparo gradual e ROs podem registrar uma Celula em foco.
- `/api/rede/oportunidades/:codigo/disparo` executa o mesmo `pulse-v2` para Demanda e OBA; `/api/rede/oportunidades/:codigo/convite` cria o link externo individual somente para gestores autorizados da OBA.
- Toda nova RO pertence a uma Comunidade e registra `event_type=RO`, inicio, termino opcional, fuso, formato, endereco/link e politica de convidados. O foco e `Geral da Comunidade` ou uma Celula ativa da mesma Comunidade.
- `/api/reunioes-oportunidades/:id/convidados` cria convite externo individual; `/api/reunioes-oportunidades/convidado/:token*` permite consultar e confirmar publicamente o convite sem criar associacao de membro.
- `/api/demandas/:id/converter-oba` converte uma Demanda de BIA em uma unica OBA; `converter-opa` permanece como adaptador legado.
- Timer de oportunidade no backend e invalidacoes React Query no frontend.

## Dados e fontes de verdade

- Directus `bias_projetos`, `land_bank_assets` e colecoes legadas de oportunidade.
- PostgreSQL: `bias_projetos` operacional, `oportunidades`, `opportunity_*`, `business_trace_*`, aprovacoes, solicitacoes e permissoes.
- PostgreSQL `opportunity_meetings` e `opportunity_meeting_participants` sao as fontes das ROs e dos convidados externos; tokens sao persistidos somente como hash e o aceite preserva versao, horario e evidencia.
- PostgreSQL `bia_imovel_origens` preserva a origem do imovel e `bia_map_inicial_snapshots` e a fonte do MAP Inicial das BIAs novas; `bia_map_origem_alocacoes` permanece somente para BIAs legadas. A BIA continua oficial no Directus.
- Uma entidade espelhada deve declarar a direcao de sincronizacao; ID Directus nao e substituido por codigo publico.

## Papeis e permissoes

- Autor, Aliado BUILT, Diretor de Alianca, diretorias de nucleo, socios e administradores acumulam acessos.
- O ambiente lista somente BIAs relacionadas ao usuario. Participante preserva acesso operacional a sua BIA mesmo sem anuidade vigente, conforme a matriz da propria BIA.
- Maior permissao valida prevalece; papel em uma BIA nao concede acesso a outra.
- Aliado/Diretor responsavel deve conseguir agir em seu fluxo por notificacao/pagina apropriada, sem depender do painel admin.
- Quando o backend autoriza a exclusao, a mesma acao fica disponivel no card da BIA na Carteira; admin e superadmin tambem a veem na lista de BIAs da Area de Aliancas. Toda exclusao exige confirmacao.
- A exclusao remove primeiro os vinculos da BIA com comunidades no Directus para respeitar as chaves estrangeiras; registros historicos locais permanecem preservados.
- Backend valida a etapa, o papel e o recurso antes de mutar.

## Estados e transicoes

- Oportunidade: capturada, distribuida, em analise, convertida, encerrada ou descartada com motivo.
- Estruturacao: solicitada, aguardando complementos, complementada, aprovada/rejeitada e convertida.
- BIA: rascunho, em formacao, ativa, suspensa/encerrada conforme regra vigente.
- Transicoes criam evento historico e sao idempotentes.

## Invariantes

- Uma origem preserva rastreabilidade ate a BIA/resultado final.
- RO pertence a uma unica Comunidade; a Celula, quando informada, deve ser ativa e pertencer a essa Comunidade. Membros da Comunidade podem consultar, mas somente organizador autorizado executa gestao e decisoes.
- ROs nao possuem aba global na Area de Aliancas; links legados encaminham para a Comunidade correspondente ou para a lista de Comunidades quando a origem nao informa `community_id`.
- Convidado externo precisa de convite autorizado e aceite versionado. Confirmar presenca nao cria conta nem vinculo comunitario; se o mesmo e-mail entrar posteriormente no onboarding, `source_type=RO`, `source_event_id`, `invited_by` e `source_community` sao preservados.
- Demanda gerada em RO registra `community_id`, `source_type=RO`, `source_event_id` e a Celula em foco, alem da relacao e do rastro `ro_gerou_demanda`.
- Uma Demanda gera no maximo uma OBA, sempre na propria BIA; `opportunity_relations.demanda_gerou_oba` e a genealogia oficial e `opa_id` e a ponte legada.
- A conversao preserva na OBA a Celula, tipo canonico, Tipo de negocio, area de contribuicao e segmento da Demanda. O filtro `Das minhas Celulas` usa participacao ativa, nunca apenas preferencia de onboarding.
- O disparo para Celulas usa `opportunity_registry.metadata.target_strategic_cell_ids` e as entregas existentes; selecionar outra Comunidade nao cria vinculo comunitario nem participacao na BIA.
- O Pulso possui cinco ondas de quatro horas, da Comunidade de origem ate a Vitrine geral, e pausa quando surge interesse ativo. A deduplicacao de notificacao e e-mail ocorre por destinatario, canal e onda.
- Compartilhar OBA usa `convites_link` com token novo persistido somente em hash, validade de 24 horas e destino interno validado. O resgate ou onboarding libera somente a consulta autenticada da OBA e nao cria interesse, proposta, vinculo com BIA ou associacao comunitaria.
- OBA e o nome publico; nomes internos com OPA permanecem por compatibilidade.
- Termos financeiros aprovados da BIA congelam Valor de Origem, RIG, inicio institucional e versoes das politicas e passam a integrar o MOU/PDF.
- Convite pendente nao e membro aceito, mas deve permanecer visivel no papel correto.
- IDs de relacao do Directus podem chegar como string, numero ou objeto e devem ser normalizados.
- Nao apagar ou recriar BIA para sincronizar formulario parcial.
- Uma BIA originada de imovel preenche os pesos dos Guardioes pela copropriedade aceita. O MAP Zero pode ser revisado durante a estruturacao; a BIA somente ativa depois que todos os signatarios exigidos aceitam a revisao vigente. Aceites antigos preservam evidencias e documento original; repeticoes da mesma revisao sao idempotentes.
- Apos ativacao somente Diretor da Alianca ou Aliado BUILT vinculados corrigem o MAP Zero, com motivo e notificacao, sem desativacao nem novo aceite. Cargo administrativo isolado nao autoriza. Historico imutavel em `bia_map_versoes`; regras e APIs detalhadas no contrato de Capital.
- Alocacao de MAP de origem participa do helper central, mas nao e receita, aporte ou entrada de caixa.
- Novas BIAs usam participantes unicos com cargos acumulados, indice individual e peso de capital; a BUILT somente participa quando adicionada explicitamente. BIAs anteriores sem snapshot continuam no calculo legado, sem backfill.
- Abas da BIA persistem em URL para refresh e compartilhamento.
- Acoes Voltar, Ativar e Editar/Visualizar quebram linha em telas estreitas sem cortar botoes, mantendo as mesmas permissoes e operacoes.
- A leitura das abas acompanha `useSearch`; redirecionamento por permissao aguarda a resposta de acesso da BIA. Carregamento nao equivale a acesso negado. Listas geral e relacionadas tem caches distintos sob o prefixo `/api/bias`, invalidado apos salvar/criar.
- A rota dedicada do Banco de Ativos nao exibe a aba geral Rede; essa rede continua disponivel somente nos ambientes proprios.

## Efeitos e dependencias

- Gera notificacoes, e-mails, PDFs/MOU, acessos, documentos e eventualmente estrutura financeira.
- Depende de Comunidades, Perfis, Vitrine, Capital, Agenda, Pagamentos e Administracao.

## Testes e impacto

- Nova BIA -> Equipe e todos os editores de MAP Zero oferecem somente o atalho `+ Pessoa`, sem `+ BUILT`. Participantes institucionais ja registrados e o cargo Aliado BUILT permanecem preservados; nao ha exclusao ou reclassificacao de dados.

- Nova BIA mostra pessoa + DM (%) e equivalente em reais, usando `initialMapContributionValue`, o mesmo calculo do MAP. Cargos ficam recolhidos com resumo. Tipo de participante exibe explicitamente Guardiao e Multiplicador, com explicacao curta; Guardiao revela valor obrigatorio (ausente nao vira zero). Novas fichas comecam como Multiplicador. Retirar um aporte positivo exige confirmacao, preserva DM/cargos/CPP da contribuicao e limpa apenas o capital e sua classificacao. A primeira selecao em ficha vazia nao pede confirmacao; dados economicos preenchidos continuam protegidos. DM ausente pede preenchimento, sem acusar valor negativo. Natureza e CPPs positivas ficam em Detalhes da participacao, com pendencia visivel e validacao obrigatoria; nao sao inferidas pelos cargos. Ver composicao inicial (MAP Zero) permanece somente leitura.
- Editar BIA tem somente Geral, Equipe, Análises e Informações, inclusive nas BIAs legadas. O atalho Núcleo de Capital → DM centraliza os percentuais; o modal não envia campos econômicos nem cronogramas em nenhuma edição. Com MAP Zero, orienta também para a composição no MAP. Consulta do modelo continua obrigatória; falha bloqueia salvar. Não converte BIAs antigas, cria snapshots ou altera as regras financeiras e permissões. Regressão em `client/src/pages/dm-map-navigation.test.ts`.
- Salvamento da BIA e Informacoes comerciais sao etapas distintas. Falha HTTP ou de rede na segunda etapa exibe aviso de salvamento parcial e orienta reabrir Informacoes da BIA existente; nunca repete automaticamente a criacao.
- Na criacao, o Aliado vinculado a comunidade de origem permanece elegivel mesmo sem o selo no cadastro resumido, inclusive apos desmarcar e remarcar. Checkbox e seletor compartilham `isBiaAllyCandidate`; elegibilidade nao concede permissao de editar nem permite dois responsaveis. A autorizacao e a validacao do Aliado no POST permanecem inalteradas.
- Nova BIA concentra a composicao na aba Equipe, sem aba separada de MAP Zero. Uma unica lista de fichas fornece participantes, cargos canonicos, tipo, Contribuicao no DM (%), capital, natureza e CPPs. O Aliado da comunidade continua automatico e protegido; cada cargo tem um responsavel, e cargos acumulados nao somam indices. Campos ausentes mantem Composicao pendente; zero explicito e valido. Ver MAP Zero expande apenas uma previa calculada, com os mesmos campos/calculo da Calculadora. Trocar a pessoa limpa seus valores; remover ficha preenchida exige confirmacao. Mobile usa fichas empilhadas.
- `POST /api/bias` recebe `map_inicial` opcional para compatibilidade. Quando informado, valida/recalcula antes de gravar, captura nomes e cargos oficiais, exige toda a equipe no MAP e salva a base e primeira revisao na mesma transacao PostgreSQL, antes dos convites. O helper `biaTeamFromMapParticipants` deriva os campos legados das fichas e rejeita pessoas/cargos duplicados; a API confere os cargos recebidos contra os campos da equipe e o Aliado autorizado. Clientes anteriores sem cargos preservam a validacao de inclusao da equipe. Nao cria caixa; cronogramas seguem separados. Clientes antigos sem o campo preservam o rascunho existente.
- A criacao preserva valores comprometidos com cinco casas, natureza e tipos de CPP, sem reconstruir o capital a partir do peso arredondado. BIAs legadas e edicao de DM nao mudam.
- `server/bia-map-creation.test.ts`
- `client/src/pages/bia-creation.test.ts`

- `shared/bia-access.test.ts`
- `server/bia-lifecycle.test.ts`
- `server/opportunity-platform.test.ts`
- `server/network-opportunities.test.ts`
- `server/business-trace.test.ts`
- `shared/ro.test.ts`
- Ao alterar: testar cada papel, usuario multicomunidade, refresh de aba, transicao repetida, Directus indisponivel e rastreabilidade.

## Nova BIA — Base econômica inicial (modelo 5, 2026-09-23)

- Cabeçalho do resumo PDF (2026-09-24): usa a versão ultrahorizontal aprovada, repetida em todas as páginas A4 landscape. O helper `buildBiaHeaderSvg` preserva os elementos fixos e substitui apenas nome completo e código abaixo do nome; usa o nome atual da Revisão e o mesmo código oficial autorizado da marca vertical. Sem código, exibe “Código após salvar”, nunca ID ou código de exemplo. Arte de 2172×724 a 125mm de largura (472px na prévia), com proporção preservada e margem superior de 30mm, conforme o espaçamento aprovado. Rasterização antes da impressão evita falhas de SVG no Chromium. Falha de carregamento mantém impressão bloqueada. Selo condicionado, download vertical, capa/cards e documentos existentes permanecem intactos; sem alterações de dados, permissões, e-mails, tarefas ou cálculos. A arte foi aprovada a partir de uma demonstração gerada; não há geração por IA em tempo de execução.

- Marca automática (2026-09-24): a Revisão apresenta um único modelo SVG com os logos fornecidos, fundo azul-marinho e frases fixas. `bia-brand.ts` compõe o nome atual do formulário (quebra/redução sem abreviar) e o código público oficial. PNG local em 1352 × 1412, sem IA, dependência nova, upload, migração ou alteração de capa/cards. Não modifica documentos emitidos, cálculos, convites, notificações ou finanças.
- Fonte do código: `bias_projetos.codigo_publico` no Directus, lido somente após autorização existente em `GET /api/bias/:id/rascunho`; resposta ganha `codigo_publico` e `codigo_publico_indisponivel`. A consulta não gera/backfill nem substitui código por ID. Falha da fonte preserva o rascunho e bloqueia a marca definitiva com botão de tentar novamente, sem autosalvar. Permissões de leitura/edição e vínculos multicomunidade não mudam. Rascunhos legados sem código não recebem identificação inventada.
- Sem rascunho salvo: prévia com “Código após salvar”; PNG definitivo exige nome e código. Nome alterado atualiza a marca local imediatamente. O PDF usa a mesma marca em todos os rodapés, convertida no navegador para PNG para evitar falha de imagens SVG nas margens de impressão Chromium; selo Certified Alliance permanece separado e condicionado à marcação atual. As fontes gráficas ficam em `client/public/branding/`; a arte branca transparente é derivada dos logos originais, sem redesenho. Erros de carregamento/conversão impedem impressão automática incompleta.
- Regressões: `client/src/lib/bia-brand.test.ts`, `client/src/components/bia-review-summary.test.ts` e `server/bia-draft-api.test.ts` cobrem nomes/acentos/escape, código ausente, PNG, seleção PDF, autorização, falha Directus e ausência de gravações na consulta. Prévia desktop/mobile390 e PDF fictício de quatro páginas conferidos. Integração do código na sessão local requer reiniciar a API; preservado o formulário aberto enquanto não autorizado.

- Na última Revisão, `Salvar resumo em PDF` abre um modal com seleção independente de Resumo dos dados, Capitalização e integralização, MAP Inicial e Detalhamento das CPPs (modelos anteriores oferecem dados/MAP). Exige pelo menos uma seção. Gerar PDF abre a impressão nativa (destino Salvar como PDF) com marca BIA horizontal personalizada, nome/data, cabeçalho branco sem tarja preenchida para economizar tinta, tabelas paginadas e somente as seções selecionadas; seções omitidas são removidas do documento clonado. Cancelar não imprime nem modifica o formulário. Usa a composição atual válida mesmo sem rascunho salvo ou equipe completa, identificada como prévia em estruturação, sem substituir MOU/aceites. Textos são renderizados pelo React e clonados, não interpolados como HTML. Não grava dados, dispara convites, conclui a BIA, envia arquivos ou altera a revisão; pop-up bloqueado é informado. Ações e navegação ficam fora do relatório.
- O resumo para impressão repete no rodapé de todas as páginas a arte original da marca BIA. O selo Aliança Certificada usa exclusivamente a marcação atual `selo_certified_alliance === true`, sem certificar uma BIA automaticamente. As duas artes fornecidas ficam em `client/public/branding/`; nenhuma imagem externa é consultada. A margem inferior reserva espaço para os selos e a numeração. A impressão aguarda o carregamento/decodificação das artes; falha informa o usuário, sem imprimir automaticamente um relatório incompleto. Não altera documentos históricos, dados oficiais ou permissões.
- PDF de revisão em A4 paisagem (2026-09-24): cabeçalho repete a marca BIA horizontal personalizada descrita acima, título Resumo da BIA, data de São Paulo e linha dourada. Rodapé mantém marca vertical personalizada e selo condicional à esquerda, texto à direita e numeração. A pedido do usuário, o texto é exatamente o do MOU padrão, centralizado em `shared/bia-document-footer.ts` e usado também no backend, sem mudar a saída existente do MOU. No resumo, a identificação usa nome e código público autorizado (ausente é omitido, nunca substituído por ID); o corpo continua identificado como prévia para revisão e não confirma assinatura, aportes ou pagamentos. Tabelas têm largura fixa e quebra de conteúdo para caber na página deitada. Capitalização e integralização recebe padding superior de 8mm, preservado na quebra de página; MAP usa células compactas como na demonstração aprovada. Fonte dos dados continua a revisão autorizada atual; nenhum banco, papel, vínculo, e-mail, cron, notificação, cálculo ou documento já emitido muda. O cabeçalho também participa da espera de decodificação antes de imprimir.
- Cabeçalho, selos e paginação usam as margens nativas `@page` (Chrome/Edge 131+), conferidas em PDF A4 paisagem multipágina com nome longo na tabela. Outros motores de impressão e impressão física mobile não foram validados. Regressão: `client/src/components/bia-review-summary.test.ts` cobre orientação, cabeçalho, rodapé, preservação de seções e falha de arte.

- No bloco 5, removido o seletor Natureza do aporte. A Forma do aporte continua explícita e determina `tipoCppCapital` automaticamente pelo catálogo oficial: dinheiro → Capital; propriedade, bens ou direitos → Propriedade. O mesmo helper é usado na edição, prévia, rascunho e validação backend. A classificação do capital continua separada dos direitos por função; não altera valores, caixa, permissões ou snapshots/documentos históricos. Tipo oficial ausente bloqueia com orientação para conferir o catálogo, sem exigir seleção de um campo removido.

- Gerar MAP Inicial depende da composição válida, não do nome cadastral. A navegação da prévia à Revisão também independe do nome. Nome vazio exibe orientação e atalho para Dados da BIA; salvar rascunho continua exigindo nome, e concluir mantém todos os requisitos cadastrais/econômicos/equipe e autorização backend. Gerar a prévia não salva nem dispara efeitos externos.

- A normalização dos direitos é idempotente também com índice vazio (`NaN` no formulário): ausência não vira zero nem dispara atualizações contínuas que bloqueiem a digitação. Índices preenchidos e classificações oficiais permanecem preservados; a validação de completude continua no cálculo/conclusão.

- Na interface da BEI, “Função/Funções” substitui “Cargo/Cargos” nos rótulos, resumos, ações e orientações. É somente nomenclatura visual: a chave interna `cargo`, os valores canônicos das funções, cálculos, APIs, persistência, documentos históricos e modelos anteriores permanecem inalterados.

- Selecionar periodicidade Personalizada define forma Personalizado e revela uma área ampliada obrigatória para descrever frequência/datas/condições em `integralizacao.observacoes`, exibida no resumo. Frequência regular volta a Parcelado; mudar a forma para Parcelado recupera Mensal quando o intervalo era zero. À vista fixa uma parcela e mostra periodicidade não aplicável. Detalhes existentes são preservados; validação de descrição personalizada já existente no backend permanece. Texto não gera parcelas nem é interpretado como cronograma executável.

- Correção contratual usa dropdown com Sem reajuste, IGP-M, IPCA, INCC e Outra. Outra permite texto livre; valores personalizados existentes são preservados e exibidos sem conversão. Ausência permanece vazia e sujeita à validação existente. Mantém `integralizacao.correcao` como texto, refletido no resumo/documentos, sem reajuste automático ou mudanças no backend.

- Resumo da BEI (bloco 8) mostra Periodicidade e Detalhes do plano a partir de `integralizacao.meses`/`observacoes`, reutilizando os rótulos do seletor. Ausências são indicadas como não informadas, sem inventar dados. Removido o aviso azul desse resumo; cálculos, permissões, persistência e documentos permanecem iguais.

- Direito Econômico do bloco 7 é automático, sem seletor: Autor/Aliado → Origem e diretorias → Liderança. No modelo 5, Contribuição individual não compõe nem aparece no DM: o domínio normaliza seu índice para zero e remove a classificação econômica, enquanto a pessoa permanece no MAP Inicial pelas CIs e é identificada nessa posição. Outras funções da mesma pessoa continuam no DM. `economicRightName`/`withAutomaticEconomicRights` compartilham a regra entre BEI, prévia, payload de rascunho e normalização oficial do MAP no backend. IDs e nomes vêm de `Tipos_CPP`; tipo positivo ausente bloqueia, sem fabricar IDs ou aceitar classificação adulterada. Cargo/forma alterados atualizam a classificação, não o índice. Capital/CIs permanecem separados dos direitos por função. Consultas a snapshots, PDFs/aceites existentes e modelos anteriores não são reclassificados; alterações de composição continuam sujeitas a autorização, revisão e confirmação existentes.

- No bloco 7, cada campo `Índice` exibe `%` como unidade visual e no rótulo acessível. O valor persistido continua numérico e os cálculos permanecem dividindo o índice por 100.

- Periodicidade exibe “Personalizada” (sem “/ única”); valor interno `meses: 0` e regras de integralização preservados.
- Forma de integralização não exibe o aviso amarelo de planejamento contratual. Apenas o texto foi removido: índices continuam sem aplicação automática e parcelas/beneficiários exigem confirmação separada no Financeiro; esta etapa não gera lançamentos.

- No bloco 5, Sócio Aliado usa seleção com busca por nome (sem distinguir acentos/maiúsculas), ordenada alfabeticamente em pt-BR. Reutiliza Command/Popover existentes; membros já escolhidos permanecem bloqueados, a troca preserva a confirmação de limpeza dos valores e somente leitura não permite abrir a seleção. Aplica-se à criação e à edição compartilhada da BEI, sem alterar membros da API, permissões ou persistência.

- O formulário compartilhado da BEI usa “Aportes Financeiros” (singular: “Aporte Financeiro”) no título, coluna desktop/mobile, resumo e textos explicativos. É nomenclatura visual: mantém capital/CIs, naturezas, CPPs, contratos de API e documentos históricos inalterados.

- Em Instrumentos de capitalização, o usuário informa somente nome e valor. As CIs de cada instrumento são derivadas no cálculo oficial pela proporção `valor do instrumento / Valor de Origem × total de CIs`; a chave `cotas` permanece preenchida nos snapshots para compatibilidade. O total de CIs é informado uma única vez no bloco próprio.

- Salvar rascunho sincroniza nome e capa em `bias_projetos` (Directus), fonte dos cartões e do detalhe, mantendo os dados completos no PostgreSQL. A sincronização usa a revisão mais recente sob o lock da BIA, não modifica composição, papéis, fase, convites ou finanças e não atua após início da conclusão. Falha remota preserva o rascunho e retorna `apresentacao_pendente`: a tela avisa e permite repetir Salvar rascunho, inclusive sem alterar dados. Capa vazia remove a referência; campo omitido preserva a capa existente. Não apaga o arquivo nem altera BIAs concluídas.

- A prévia do MAP Inicial valida a composição econômica e a unicidade de pessoas/cargos, sem exigir equipe completa. Para concluir, somente Aliado BUILT e Diretor de Aliança são obrigatórios, pela regra compartilhada `hasRequiredBiaTeam` na interface e no backend; Autor é opcional e `autor_bia: null` não é substituído pelo criador. O cliente legado que omite esse campo mantém o preenchimento anterior. Cargos e direitos de um Autor informado continuam preservados, sem alterar BIAs, aceites ou documentos existentes. Falhas de consulta de membros/contexto não impedem o cálculo local com dados preenchidos; tentar novamente refaz as consultas sem recarregar a página. Autorizações, revisão, cálculos e efeitos financeiros não mudam.

- Bloco 5 (distribuição/aportes) compacto: cabeçalho único no desktop (tipo, sócio, CIs e aporte), linhas menores e ações discretas. Funções/natureza expandem somente a linha selecionada; Adicionar função permanece visível. No celular os rótulos reaparecem e os campos empilham. É alteração de apresentação, sem mudanças de cálculo, permissões ou persistência.

- Ajuste de fidelidade ao DOCX: ordem numerada de 1 a 8 na interface (identificação, VO, Cotas Iniciais, capitalização, distribuição/aportes, integralização, DM e resumo completo). A expressão oficial é **Cota Inicial**, mantendo `cotasInvestimento` como chave interna compatível. A natureza do aporte/direito usa nomes simples, sem pedir ao usuário uma CPP. Nenhum percentual de CPP calculado é exibido na etapa de entrada; o motor aparece somente como resultado no MAP.
- MAP Inicial em tabela de consulta com totais e MAP detalhado expansível por natureza, preservando Propriedade. As etapas de MAP/revisão usam a largura inteira, sem resumo lateral duplicado. Funções/natureza ficam expansíveis na distribuição; Adicionar função permanece visível e abre o grupo. No celular, formulários empilham e tabelas de consulta têm rolagem própria.

- `/bias/nova` inicia modelo 5. A segunda etapa é Base econômica inicial: VO, CIs, modalidade, instrumentos de capitalização, distribuição por pessoa, condições de integralização e direitos por cargo. Reutiliza dados gerais, seleção de destinação, rascunhos e permissões anteriores; não adiciona BUILT automaticamente.
- A etapa Dados da BIA usa toda a largura, sem o resumo econômico lateral. As demais etapas preservam seus resumos e prévias conforme o modelo.
- Uma pessoa tem capital/CIs uma vez e pode acumular cargos e direitos separados. Guardião e Multiplicador podem aportar. Classificações positivas são obrigatórias, provenientes de `Tipos_CPP`; ausência não equivale a zero.
- Rascunhos anteriores mantêm sua versão. A API rejeita troca de versão de um rascunho existente. Nenhuma BIA, histórico ou documento antigo é convertido.
- A conclusão continua sujeita à validação completa e aos efeitos existentes de convites. Salvar rascunho ou MAP não gera parcelas. Consórcio/financiamento não comprovam crédito aprovado.
- Fonte da BEI: rascunho e snapshot PostgreSQL (`estrutura_economica`, migração aditiva `20260923_bia_economic_structure.sql`). Identificação da BIA continua no Directus. Revisão esperada, autorização e recuperação permanecem no fluxo existente.
- Prévia/MAP e documentos novos usam o cálculo compartilhado. CPPs são somente leitura no MAP; correções usam a composição versionada, respeitando os bloqueios existentes.
- Testes: `shared/bia-model-five.test.ts`, `server/bia-map-creation.test.ts`, `server/bia-map-api.test.ts`, `client/src/pages/dm-map-navigation.test.ts` e suíte de rascunhos.
