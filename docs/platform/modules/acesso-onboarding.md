# Acesso, Cadastro e Onboarding

## Objetivo e usuarios

Controla a entrada de usuarios, criacao da identidade, recuperacao de acesso, convites, aceite dos documentos obrigatorios e conclusao progressiva do perfil. Atende visitantes, candidatos, membros, funcionarios de empresas e administradores.

## Telas e URLs

- `/login`: login local e Google.
- `/convite/:token` e `/adesao/:token`: entrada publica por convite.
- `/pagamento/:token` e `/pagamento/sucesso`: adesao paga.
- `/aguardando-aprovacao`: estado anterior a liberacao.
- `/onboarding/personalizacao`, `/onboarding/perfil`, `/onboarding/configuracao`, `/onboarding/conexoes`, `/onboarding/pronto` e `/onboarding/aceites`: jornada obrigatoria para contas novas.
- `/meu-perfil`: conclusao cadastral e documentos aceitos.
- Implementacao principal: `client/src/pages/login.tsx`, `client/src/pages/initial-onboarding.tsx`, `client/src/pages/convite.tsx`, `client/src/pages/adesao.tsx`, `client/src/pages/meu-perfil.tsx` e `client/src/App.tsx`.

## APIs e tarefas

- `/api/login`, `/api/logout`, `/api/me`, `/api/register` e `/api/register/validate`.
- `/api/register/start`, `/api/onboarding`, `/api/onboarding/etapas/:etapa`, `/api/onboarding/upload`, `/api/onboarding/concluir` e `/api/onboarding/finalizar-aceites`.
- `/api/auth/google/*`, recuperacao e alteracao de senha.
- `/api/minha-conta/finalidades`: leitura e gravacao atomica das finalidades e respectivas intencoes.
- `/api/convites/*`, `/api/meu-convite`, `/api/convite-publico/*`.
- `/api/me/documentos-aceitos/*` e endpoints de aceite associados ao cadastro ou convite.
- Sessao persistida pelo Express; polling de `/api/me` mantem identidade e permissoes atualizadas.

## Dados e fontes de verdade

- PostgreSQL: `users`, `password_reset_tokens`, `convites_link`, `initial_onboarding_journeys`, `user_account_purposes`, `company_employee_accounts` e registros locais de aceite.
- Directus: `cadastro_geral` para perfil do membro.
- A etapa Configuracao grava a classificacao profissional nos campos oficiais `ramo_atuacao`, `segmento`, `area_atuacao`, `especialidade_livre` e `idiomas` de `cadastro_geral`.
- Areas de contribuicao usam valores canonicos de `shared/contribution-areas.ts`; ramo e segmento usam `client/src/lib/ramos-segmentos.ts`; abrangencia e idiomas usam `shared/profile-taxonomy.ts`.
- Usuario autenticavel e membro da rede sao identidades relacionadas, mas nao intercambiaveis. IDs devem ser normalizados por helper.
- As finalidades e intencoes ativas da conta em `user_account_purposes` sao devolvidas por `/api/me`; a taxonomia canonica de intencoes fica em `shared/initial-onboarding.ts` e e reutilizada pelo onboarding e pelo Meu Perfil.

## Papeis e permissoes

- Rotas de autenticacao e convite possuem trechos publicos estritamente limitados.
- Dados completos do perfil exigem sessao e autorizacao.
- Funcionario usa identidade propria e herda apenas os acessos empresariais explicitamente concedidos.
- Admin e superadmin nao dispensam validacao de sessao, rastreabilidade ou aceite exigido.

## Estados e transicoes

Contas novas: `credenciais validadas -> aceites -> personalizacao -> perfil -> configuracao -> conexoes -> pronto -> acesso liberado`.

Jornadas iniciadas na versao anterior preservam a ordem legada, com aceites depois da etapa Pronto.

Estados de convite, pagamento e usuario devem ser idempotentes. Repetir callback, refresh ou webhook nao pode criar outro usuario, pagamento ou aceite.

## Invariantes

- E-mail normalizado nao pode identificar duas contas ativas diferentes.
- Uma conta com `initial_onboarding_journeys.status != concluido` so acessa autenticacao, onboarding, aceites, upload autorizado e logout.
- Etapas futuras nao podem ser gravadas antes da primeira pendencia; rascunhos e conclusoes sao retomaveis.
- Perfil exclusivo de imovel ou oportunidade nao exige CPF.
- O campo de CPF permanece disponivel para preenchimento opcional em qualquer finalidade, inclusive no perfil exclusivo de imovel ou oportunidade.
- Os blocos de intencao usam os titulos `Imovel ou oportunidade`, `Profissional, fornecedor ou empresa` e `Parceiro de capital`, cada um acompanhado de sua pergunta contextual oficial definida em `shared/initial-onboarding.ts`.
- No Meu Perfil, selecionar um card ainda inativo ou configurar um card ativo abre o mesmo conjunto canonico de intencoes do onboarding e salva finalidade e intencoes na mesma operacao.
- Finalidade escolhida descreve uso pretendido da plataforma e nao concede nem revoga, por si so, vinculo de membro, papel no BUILT Alliances ou acesso administrativo.
- Os perfis da personalizacao preservam identidade visual consistente: imovel em azul, profissional em verde e capital em roxo.
- As acoes recomendadas da etapa Pronto reutilizam essa identidade visual e distinguem a rede em ciano, incluindo card, icone e botao.
- Recomendacoes da etapa Conexoes normalizam fotos vindas de arquivo Directus ou URL externa e exibem fallback quando a imagem falha.
- A leitura de `/api/assets/:id` permanece disponivel durante a jornada para carregar avatares; demais APIs fora da allowlist continuam bloqueadas ate a conclusao.
- Preferencias de atualizacao mostram contexto por categoria e ficam salvas apenas como resposta do onboarding; nao criam conexoes nem publicam o perfil.
- Onboarding, cadastro e Meu Perfil reutilizam a mesma taxonomia e os mesmos campos de atuacao; nao existem nomes alternativos como `regions`, `asset_types`, `main_intent` ou `timeframe` para substituir o perfil oficial.
- Areas de contribuicao preservam valor canonico, nucleo derivado e metadados visuais compartilhados.
- O resumo da jornada reflete em tempo real as areas de contribuicao e a classificacao oficial de atuacao preenchidas na etapa Configuracao.
- No fluxo novo, somente o Codigo de Etica e as Politicas de Participacao e Protecao sao apresentados antes da Personalizacao; os termos da BUILT Vitrine e do BUILT Capital sao solicitados no primeiro acesso ao respectivo modulo.
- Aceites anteriores a Personalizacao aparecem como uma preparacao da jornada, sem marcar ou destacar a etapa 5; a numeracao continua reservada as cinco etapas visiveis do onboarding.
- A tela de aceites informa antes da acao que a localizacao do dispositivo e obrigatoria e interrompe o envio com mensagem orientativa quando o navegador nao concede a permissao.
- Cada acao recomendada da etapa Pronto conclui a jornada e redireciona ao destino interno escolhido; jornadas legadas ainda preservam seus aceites finais.
- A solicitacao de adesao reutiliza a comunidade do convite original quando o candidato ainda nao possui relacao M2M como membro; refresh ou retomada nao perde essa origem.
- Status cadastral so pode ser `informado`, `enviado` ou `pendente` sem evidencia externa.
- Selecao de finalidade nao publica perfil, imovel ou oportunidade.
- A finalidade `imoveis` libera a entrada na BUILT Vitrine sem ativar a publicacao do perfil; BUILT Alliances continua condicionada ao vinculo de membro.
- Aceite registra versao, identidade, data/hora e evidencia do momento.
- Localizacao do aceite e capturada pelo helper compartilhado com `status = capturada`, coordenadas validas, precisao e horario; perfil/endereco nao a substituem.
- Falha de sincronizacao com Directus nao pode ser apresentada como cadastro concluido sem pendencia explicita.
- Retornos publicos nunca incluem hash de senha, token interno ou dados pessoais desnecessarios.

## Efeitos e dependencias

- Envia e-mails, registra eventos de uso, pode criar membro/comunidade e libera modulos.
- Afeta Perfil, Comunidades, Administracao, Pagamentos, Aura e qualquer verificacao de papel.
- PDFs de aceite dependem de dados versionados, fonte UTF-8 e acesso protegido.

## Testes e impacto

- `client/src/lib/profile-completion.test.ts`
- `shared/company-access.test.ts`
- `shared/initial-onboarding.test.ts`
- Ao alterar: testar login local/Google, convite novo/reutilizado/expirado, aceite com e sem permissao, recuperacao de senha, perfil parcial, desktop e mobile.
