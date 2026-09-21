# Area de Aliancas, Oportunidades e BIAs

## Objetivo e usuarios

Novas BIAs usam MAP Zero modelo 3: capital comprometido por valor e CPPs classificadas por componente na estruturacao. A origem de imovel preenche valores pela copropriedade aceita, com natureza patrimonial, mas exige selecionar os tipos de CPP antes do aceite. Modelos anteriores nao sao convertidos. Cadastro/confirmacao de aportes seguem o contrato de Capital/Financeiro; salvar MAP nao gera caixa.

Organiza oportunidades, OBAs/OPAs, Banco de Ativos, comunidades e o ciclo completo de estruturacao e operacao de uma BIA.

## Telas e URLs

- Na BIA, Capital -> DM edita apenas os indices individuais. Composicao fica em MAP -> MAP Zero -> Editar composicao (`/movimentacao-cotas/:biaId?view=zero`); Financeiro -> Aportes e parcelas concentra cronogramas. Criacao de BIA, regras de equipe, revisoes, MOU e aceites permanecem inalterados.

- `/area-aliancas`, `/area-aliancas/oportunidades/:codigo`.
- `/area-aliancas?tab=comunidades` e `/area-aliancas?tab=oportunidades` deixam Comunidades e Oportunidades acessiveis na navegacao principal do ambiente. Celulas e ROs pertencem a uma Comunidade e aparecem como abas em `/comunidade/:id?tab=celulas` e `/comunidade/:id?tab=ros`.
- `/opas/:id`, `/bias`, `/bias/:id`.
- `/land-bank/:id`, `/oportunidades*`.
- `/banco-ativos` exibe diretamente Land Bank e Ativos Edificados, sem a navegacao geral de Rede da Area de Aliancas.
- `/rastreabilidade/:codigo`.
- Implementacao principal em `client/src/pages/area-aliancas.tsx`, `client/src/pages/opa-detalhe.tsx`, `client/src/pages/bias.tsx`, `client/src/pages/bia-detalhe.tsx`, `client/src/pages/land-bank-detalhe.tsx` e componentes de estruturacao/distribuicao.

## APIs e tarefas

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

- Nova BIA -> Equipe oferece somente o atalho `+ Pessoa`, sem `+ BUILT`. O editor de composicao das BIAs existentes e participantes institucionais ja registrados permanecem inalterados; nao ha exclusao ou reclassificacao de dados.

- Nova BIA mostra pessoa + DM (%) e equivalente em reais, usando `initialMapContributionValue`, o mesmo calculo do MAP. Cargos ficam recolhidos com resumo. Tipo de participante exibe explicitamente Guardiao e Multiplicador, com explicacao curta; Guardiao revela valor obrigatorio (ausente nao vira zero). Novas fichas comecam como Multiplicador. Retirar um aporte positivo exige confirmacao, preserva DM/cargos/CPP da contribuicao e limpa apenas o capital e sua classificacao. A primeira selecao em ficha vazia nao pede confirmacao; dados economicos preenchidos continuam protegidos. DM ausente pede preenchimento, sem acusar valor negativo. Natureza e CPPs positivas ficam em Detalhes da participacao, com pendencia visivel e validacao obrigatoria; nao sao inferidas pelos cargos. Ver composicao inicial (MAP Zero) permanece somente leitura.
- Editar BIA consulta o modelo antes de salvar. Com MAP Zero, nao mostra o DM legado nem envia campos economicos ou cronograma antigo; orienta para Capital. Erro de consulta bloqueia salvamento com tentativa novamente. BIAs legadas preservam a aba DM. O PATCH de dados gerais nao recalcula a base nova pelos percentuais legados e continua recusando alteracao economica pelo endpoint errado. `BIA_MAP_ECONOMIC_FIELDS` compartilha a fronteira de campos entre tela e API.
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
