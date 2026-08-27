# AI_HANDOFF.md

Leia este arquivo antes de editar quando houver mais de um chat trabalhando neste repo.

## Estado Atual
- O outro chat esta implementando a reorganizacao de Gestao de BIAs: nucleos dentro da BIA, gestao da OPA dentro da OPA e ajustes de acesso.
- Este chat deve evitar mexer em rotas/sidebar/estrutura de `Gestao de BIAs`, `BIAs`, `OPAs` e `BUILT Alliances` enquanto esse trabalho estiver ativo.
- Mudancas recentes deste chat: ajustes da Vitrine, cards/lista de BIAs e correcoes do fluxo de anuncio/OPA.
- Em `client/src/pages/bia-detalhe.tsx`, as abas de nucleos agora sao liberadas por BIA e por cargo: admin/manager ve tudo; demais usuarios veem apenas Diretoria, Tecnico, Obra, Comercial ou Capital se o `membro_directus_id` estiver no campo correspondente daquela BIA.

## Tocando Agora
- Este chat implementa em ondas o contrato Demanda -> proposta comercial -> OBA, taxonomias publicas e monetizacao. Ao tocar `server/routes.ts`, `client/src/pages/carteira.tsx` e telas de BIA/OBA, preserva as mudancas patrimoniais, `allowedNucleoTabs`, permissoes cumulativas e a reorganizacao de Alliances ja em andamento.
- A primeira entrega centraliza regras em helpers compartilhados e mantem `carteira_demandas`, `opportunity_registry`, `opportunity_relations`, `opa_id` e rotas legadas compativeis; nao reabre acesso global a BIAs ou nucleos.
- Este chat corrige somente o modal mobile de lançamentos da Carteira e expõe nele a leitura por IA já existente; não altera regras financeiras, permissões, BIAs ou OPAs.
- Este chat corrige somente a validacao geografica da analise de preco por m2: tenta os campos estruturados em granularidades progressivas e respeita o limite do geocodificador publico; formulas e permissoes financeiras permanecem inalteradas.
- Este chat corrige somente a extração assistida de imóveis: PDFs de matrícula passam por leitura visual quando necessário, análises vazias deixam de ser tratadas como sucesso e fontes repetidas são consolidadas.
- Este chat implementa coproprietarios estruturados e MAP de origem em `shared/schema.ts`, `shared/member-portfolio.ts`, `server/routes.ts`, `client/src/pages/carteira.tsx`, `client/src/pages/carteira-assistente.tsx`, `client/src/pages/bia-detalhe.tsx` e contratos da Carteira/Alliances. A conta limitada reutiliza o MOU de `comunidade.tsx` em `/convites-alianca`; `allowedNucleoTabs`, abas, nucleos e a gestao de OPA permanecem preservados.
- Este chat corrige somente a responsividade das abas e dos indicadores do Capital em `nucleo-capital.tsx` e `resultados.tsx`; formulas, dados, papeis e permissoes da BIA permanecem inalterados.
- Este chat ajusta exclusivamente os indicadores e as avaliações automáticas da Carteira Patrimonial em `shared/member-portfolio.ts`, `server/market-comparables.ts`, `server/routes.ts` e `client/src/pages/carteira.tsx`. Ao tocar `server/routes.ts`, preserva as mudanças de onboarding, aprovações, exclusão de BIAs e permissões já em andamento.
- Este chat achata somente a navegacao de `app-sidebar.tsx`: Area de Vitrine e Area de Aliancas ficam no primeiro nivel, sem o agrupador Ambientes BUILT; destinos e permissoes permanecem iguais.
- Este chat move o acesso visual da Aura para o resumo de `meu-perfil.tsx`, com o mesmo card do Inicio, e remove apenas o atalho lateral; rotas, calculo, permissoes e dados da Aura permanecem intactos.
- Este chat esta concluindo a reorganizacao solicitada pelo cliente: libera consulta da Vitrine para autenticados sem liberar publicacao, restringe a Area de Aliancas a BIAs relacionadas, aplica anuidade nas abas premium e completa as interfaces patrimoniais. Ao tocar `server/routes.ts`, `area-aliancas.tsx`, `painel.tsx` e `app-sidebar.tsx`, preserva as permissoes cumulativas e os filtros de nucleos existentes.
- A branch `codex/member-portfolio-reorg` reorganiza os nomes dos ambientes, remove Capital apenas da navegação e adiciona anuidade/Carteira patrimonial. Ao tocar `server/routes.ts` e `app-sidebar.tsx`, preserva integralmente as permissões e abas filtradas das BIAs/OPAs existentes.
- Evitar reabrir acesso global aos nucleos da BIA. Se alterar `bia-detalhe.tsx`, preservar a lista filtrada `allowedNucleoTabs`.
- Este chat altera o resolvedor de comunidade da adesao e a configuracao de finalidades/intencoes no Meu Perfil, preservando rotas, sidebar e estruturas de BIA/OPA/Alliances.
- Este chat tambem altera somente a captura de voz em `carteira-assistente.tsx` e o helper generico de gravacao; nao altera BIAs, OPAs ou a estrutura de Alliances.
- Este chat separa o nome publico (`nome`) do nome de formalizacao (`nome_completo`) no Meu Perfil e toca apenas os fallbacks de qualificacao formal em `server/routes.ts`; nao altera fluxos, papeis ou estrutura de BIA.
- Este chat corrige somente a conclusao do novo onboarding em `server/routes.ts`: convites com aliado conector passam de `termos_aceitos` para `aguardando_avaliacao_aura`, incluindo reparo idempotente de jornadas ja concluidas.
- Este chat remove o atalho duplicado da Carteira em `app-sidebar.tsx`, redireciona `/carteira` para a aba do Inicio em `App.tsx` e torna a ajuda dos cabecalhos acionavel; rotas de cadastro e detalhe da Carteira permanecem intactas.
- Este chat faz `PerfilOnboardingModal` rejeitar respostas HTTP de erro ao carregar o membro; indisponibilidade do backend nao volta a solicitar aceites ja registrados.
- Este chat antecipa a solicitacao de Aura do novo onboarding para logo apos os aceites e repara convites ja aceitos; ao tocar `server/routes.ts`, preserva a conclusao progressiva das cinco etapas.
- Este chat corrige apenas as acoes de exclusao na Carteira e na lista de BIAs: imoveis exibem a permissao efetiva do backend; admin/superadmin veem a lixeira nos cards; a exclusao da BIA remove antes os vinculos bloqueadores de `comunidade_bias`, preservando historicos locais.
- As ondas Demanda/OBA, taxonomias publicas, Plano Empresa e RIG/governanca foram implementadas com contratos atualizados; `test:all` passa com 175 testes, build e contrato passam, e o typecheck caiu de 71 para 67 erros legados (34 permanecem em `server/routes.ts`).

## Cuidado
- Antes de editar arquivos ja modificados, rode `git status --short` e leia o trecho atual.
- Nao reverta mudancas que voce nao fez.
- Se precisar tocar nos mesmos arquivos do outro chat, registre aqui em 1-2 linhas antes.
