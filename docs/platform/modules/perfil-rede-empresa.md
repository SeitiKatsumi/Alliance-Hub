# Perfis, Rede, Empresas e Comunidades

- 23/10/2026 — o nome público atual da entidade técnica BusinessType/Market é Tese de interesse, também em demandas, administração e mensagens de erro. Referências históricas a Tipo de negócio abaixo não representam um segundo campo. O adapter de rótulos normaliza somente aliases descontinuados conhecidos sem modificar códigos, preferências, associações ou nomes personalizados. Onboarding e Perfil já exibiam teses; cadastro e salvamento permanecem iguais.

- 16/10/2026: ao salvar um Proud Member sem associação efetiva, o editor administrativo confirma a Comunidade Mãe pelo endpoint autorizado existente, em vez de bloquear o salvamento. Promoção administrativa com selo também assegura M2M à mãe conhecida. Origem de convite de candidato não vira associação em consultas; vínculos extras são preservados e falha remota bloqueia sucesso.

- 16/10/2026: avisos Complete seu perfil (Início) e Próxima etapa recomendada (Perfil) têm fundo/borda e hover próprios no tema escuro, corrigindo superfícies claras translúcidas com baixo contraste. Seletores restritos a dark e screen; modo claro e impressão preservados. Sem alteração de completude, navegação ou dados.

## Objetivo e usuarios

Mantem identidade publica/profissional, empresas, membros da rede, comunidades e acessos delegados de funcionarios.

## Telas e URLs

- `/meu-perfil`, `/area-membros`, `/membro/:id`.
- `/comunidade`, `/comunidade/:id` e `/comunidade/:id/celulas/:cellId`.
- Cadastro geral em `/admin?tab=membros` para administradores.
- Componentes principais: `client/src/pages/meu-perfil.tsx`, `client/src/pages/area-membros.tsx`, `client/src/pages/membro-detalhe.tsx`, `client/src/pages/comunidade.tsx`, `client/src/pages/comunidade-detalhe.tsx` e `client/src/components/company-access-panel.tsx`.

## APIs

- `/api/membros*`, `/api/membros-built`, `/api/comunidades*`.
- `/api/strategic-cell-types`, `/api/celulas/ativas`, `/api/me/celulas`, `/api/me/celulas-preferencias` e `/api/comunidades/:id/celulas*` expoem a estrutura Comunidade -> Celula -> Tipo de Negocio.
- `/api/membros/:id/comunidades`, `/comunidade`, `/comunidade-mae` e `/convidador`.
- `/api/empresa/plano/checkout`, Plano Empresa, funcionarios e permissoes; `/ativar` e somente um adaptador para o checkout pago. `/api/me` informa a proxima renovacao e eventuais suspensoes ou congelamentos ao titular.
- APIs de nomes publicos e relacao N:N entre area de contribuicao e segmento.

## Dados e fontes de verdade

- Seletores telefônicos compartilham `PhoneInput`: país por extenso e DDI (Brasil (+55), África do Sul (+27)), com nome acessível País e código internacional. Seletor ocupa uma linha própria para não cortar nomes nem comprimir o número em telas estreitas. Mudança somente visual; catálogo, valores enviados e números existentes permanecem iguais, sem novo campo obrigatório de DDD.

- Directus `cadastro_geral`: perfil de pessoa/empresa.
- Identidade do membro: `nome` e o nome publico exibido no perfil; `nome_completo` e `cpf` sao dados restritos de formalizacao. Registros legados sem `nome_completo` podem usar `nome` apenas como fallback de leitura em documentos.
- PostgreSQL `user_account_purposes`: finalidades escolhidas e suas intencoes; Meu Perfil usa a mesma taxonomia de `shared/initial-onboarding.ts`.
- PostgreSQL `strategic_cell_types`, `strategic_cell_preferences`, `strategic_cells`, `strategic_cell_memberships` e `strategic_cell_events`: tipos canonicos, preferencias do usuario, instancias por Comunidade, participacao e auditoria. `strategic_cell_markets` permanece apenas como armazenamento legado dos `BusinessType` durante a migracao compativel.
- Classificacao profissional oficial: `ramo_atuacao`, `segmento`, `area_atuacao`, `especialidade_livre` e `idiomas`; onboarding e edicao de perfil escrevem nesses mesmos campos.
- Taxonomias compartilhadas: `client/src/lib/ramos-segmentos.ts`, `shared/profile-taxonomy.ts` e `shared/contribution-areas.ts`.
- PostgreSQL `users`: login; `membros`: espelho/apoio operacional; `membro_comunidade_mae`: ancora preferencial.
- PostgreSQL `company_plan_subscriptions` concede o direito financeiro; cada funcionario possui `users` e `cadastro_geral` proprios.
- PostgreSQL `membro_anuidades.ends_at` e `company_plan_subscriptions.current_period_end` sao as fontes da proxima renovacao exibida ao usuario.
- Relacoes de comunidade sao muitos-para-muitos. A lista integral de vinculos e a fonte para regras de associacao.
- ROs usam `community_id` como vinculo oficial com a Comunidade; `strategic_cell_id` e apenas um foco opcional dentro dela.
- Antes da adesao completa, o primeiro convite e sua ancora `membro_comunidade_mae` sao gravados na mesma transacao. Essa origem nao concede associacao M2M nem deve ser ignorada enquanto o candidato conclui a adesao.
- O editor de membros solicita `/api/membros/:id/comunidades?incluir_origem=1` para mostrar também a comunidade mãe ainda sem M2M, com `papel=origem` e rótulo de associação não confirmada. A consulta padrão e os consumidores de autorização continuam recebendo somente vínculos efetivos. Não cria associação, aprovação, pagamento ou permissão; preserva mudanças manuais da mãe e não duplica vínculos existentes. Falha de carregamento mostra erro com nova tentativa, não ausência de comunidade.

## Papeis e permissoes

- Membro edita o proprio perfil; empresa administra apenas seus funcionarios.
- Aliado administra comunidades sob sua governanca; Diretor de Alianca nao e admin global.
- Admin/superadmin usam helpers centrais e deixam rastro de edicao.
- Perfil publico usa projecao sanitizada e consentida.
- O membro escolhe somente seus Tipos de Negocio no onboarding ou no Meu Perfil. O dominio deriva as Celulas correspondentes e cria a associacao ativa automatica em todas as suas Comunidades. Isso nao concede funcao de coordenacao, papel em BIA ou permissao administrativa. Gestores continuam definindo coordenacao e decidindo solicitacoes manuais no backend.

## Estados e transicoes

- Vinculo de comunidade pode ser `convidado`, `pendente`, `membro`, `aliado` ou equivalente legado.
- Remover comunidade nao remove o usuario nem os demais vinculos.
- Alterar comunidade mae nao cria nem apaga associacoes.
- As seis Celulas canonicas sao criadas ativas com a Comunidade e permanecem disponiveis. Preferencias do perfil sao sincronizadas de forma idempotente; solicitacoes manuais preservam seus estados legados.

## Invariantes

- O componente compartilhado `phone-input.tsx` usa `background`/`foreground` tanto no seletor de DDI quanto nas opções nativas. Cadastro Geral não sobrepõe esse par com branco/azul fixos; telefone, WhatsApp e telefone secundário permanecem legíveis nos dois temas. Sem mudança no catálogo, normalização ou dados salvos. Regressão: `client/src/components/phone-input.test.ts`.

- Rótulos das teses no Perfil e onboarding não exibem pontos de fim de frase, inclusive na explicação entre parênteses. Formatação compartilhada, sem modificar códigos, preferências ou vínculos persistidos.

- Catálogo atualizado em 15/10/2026: cinco Células e 13 teses em `shared/strategic-cells.ts` (Valorização e Revenda 3, Renda Imobiliária 2, Desenvolvimento Imobiliário 3, Destravamento de Ativos 3 e Operação Imobiliária 2). Substitui as contagens/listas históricas de seis Células/22 negócios abaixo. Desenvolvimento para manter e alugar pertence a Desenvolvimento, não Renda. Investimento e Capital e opções retiradas são arquivados no catálogo sem excluir preferências, instâncias, relações ou histórico. Códigos anteriores continuam interpretáveis; não se infere uma nova tese para escolhas ambíguas. Meu Perfil mostra escolhas retiradas separadamente, permitindo remoção explícita. A API sincroniza nomes e agrupamentos canônicos; onboarding usa o mesmo catálogo. Sem alteração de papéis ou acesso a BIAs.

- O aviso visual sobre mensagens essenciais foi removido de Configurações a pedido do usuário. A política de envio obrigatório permanece intacta; não há mudança nas preferências, APIs ou e-mails.

- Configurações agora inclui Aparência, Notificações por e-mail e Idioma (2026-10-15). Preferências de e-mail/idioma pertencem à conta PostgreSQL em `user_platform_preferences`, sem reaproveitar idiomas profissionais do cadastro, permissões ou respostas de onboarding. GET/PATCH `/api/me/preferences` resolve apenas o usuário ativo da sessão (incluindo funcionário), rejeita IDs e chaves extras no corpo, não expõe outro perfil e retorna503 em falha. PATCH parcial é mesclado atomicamente por campo; consultar não grava. Migração aditiva `20261015_user_preferences.sql` aplicada com autorização explícita, sem alterar registros existentes. Padrão pt-BR e categorias de e-mail ativas preservam comportamento legado.
- Idiomas pt-BR/en/es possuem catálogo curado e alternativa em português para chaves ausentes. Tradução atual cobre Configurações, navegação principal e títulos/descrições de categorias do Perfil; a tela informa que outras páginas ainda podem aparecer em português. Não traduz nomes/conteúdo de usuário, e-mails, valores, documentos, contratos ou evidências históricas; não há tradução automática externa nem manipulação global do DOM. Idioma muda após salvar as preferências, por conta/dispositivo conectado; o tema permanece local e imediato. Falha de gravação mantém preferências anteriores e permite nova tentativa.
- A descrição anterior de Configurações apenas com tema representa a primeira entrega; é substituída pelos dois itens acima. As opções de notificação controlam somente e-mail, não avisos internos. Fonte e política de envio em `server/user-preferences.ts` e `server/email-preference-policy.ts`; detalhes no contrato de Agenda.

- Troca de categoria do Perfil reposiciona o contêiner real de rolagem no topo. Mudanças de rota também reiniciam a rolagem do shell; links profundos de campo continuam com seu foco específico. Sem salvar perfil ou preferência de tema.

- Aparência fica em Meu Perfil → Configurações, categoria própria com engrenagem e sem indicador de pendência; não há rota ou item lateral novo. Conta e segurança conserva senha/acesso/convite sem duplicar Aparência. Funcionário recebe seção Configurações no próprio perfil. Por enquanto só há preferência de tema, sem interruptores fictícios de notificações. Escuro é o padrão desde 20/10/2026, independentemente do sistema operacional. Preferências claras/escuras já salvas são respeitadas; valores inválidos voltam ao escuro. Claro/Escuro aplica imediatamente e persiste somente na chave `built-ui-theme` do localStorage deste navegador/origem, compartilhada entre abas (não sincroniza entre dispositivos ou contas). Não chama API, salva cadastro, altera permissões, convites ou aceites. O provider global usa a paleta existente; superfícies/textos legados e CSS do perfil acompanham o tema, sem inversão de imagens. Impressão continua clara, e artes/logos permanecem intactos. Regressões: `client/src/components/appearance-settings.test.ts` e `client/src/pages/meu-perfil-layout.test.ts`.

- O painel Dados da candidatura compartilhado entre o card de aprovação e Ver detalhes usa fundo/texto/bordas do tema (card, card-foreground, muted-foreground e border), sem texto branco fixo sobre fundo claro. Mantém os mesmos campos, filtros de dados restritos e fonte autorizada de `/api/convites`; não grava nem amplia acesso. Regressão em `client/src/pages/comunidade-celulas.test.ts` cobre as duas apresentações, ausência de dados e preservação dos filtros.

- Um usuario pode participar de varias comunidades simultaneamente.
- Uma RO de Comunidade fica visivel aos membros daquela Comunidade sem usar `comunidade_mae` como substituta dos demais vinculos.
- Celulas existem somente dentro de Comunidades, sem menu global, subcomunidades ou subcelulas. Cada Comunidade possui exatamente uma Celula ativa para cada um dos seis tipos canonicos; registros legados ausentes ou inativos sao regularizados pela API da Comunidade.
- A pagina da Comunidade separa `Visao Geral` e `Celulas` em abas; as seis Celulas nao ficam repetidas no final da visao geral. Seus cards nao exibem Tipos de Negocio nem coordenacao e abrem uma pagina propria com status, descricao e participantes autorizados.
- O detalhe da Celula exibe `cadastro_geral.nome` como nome publico do participante; indisponibilidade do espelho local nunca transforma o UUID do membro em nome visivel.
- O onboarding e o Meu Perfil gravam a mesma preferencia canonica de Tipo de Negocio. A Celula e derivada da taxonomia central, e a escolha cria ou reativa automaticamente a participacao nas Celulas equivalentes de todas as Comunidades atuais; ao ingressar em nova Comunidade, a leitura das preferencias repara o vinculo sem duplicacao.
- A entidade tecnica canonica e `BusinessType`; `Market` aparece somente em campos e tabelas legados mantidos temporariamente por compatibilidade. Investimento e Capital possui apenas `CO_INVESTMENT` e `REAL_ESTATE_DEBT` como Tipos de Negocio.
- Em `Aprovacoes pendentes`, convites aparecem somente quando aguardam decisao sobre o candidato ou avaliacao de Aura; termos enviados, aceitos e pagamento ficam no historico, sem reenvio manual de termos.
- Nunca selecionar apenas a primeira comunidade para autorizar Aura, convite ou estruturacao de BIA.
- O inicio da adesao resolve a comunidade pela ancora de origem e por todos os vinculos atuais; o convite original continua valido para candidatos ainda nao promovidos a membro.
- Vinculo deve comparar IDs normalizados de usuario, membro Directus e registros relacionais.
- Funcionario possui login proprio; auditoria registra quem executou, nao somente a empresa.
- Senhas iniciais, alteracoes e confirmacoes possuem controle individual para mostrar ou ocultar o valor.
- Plano Empresa custa R$ 3.836,40/ano e inclui titular mais dois usuarios adicionais ativos. Upgrade de anuidade individual vigente cobra R$ 639,40 sem alterar a renovacao atual.
- A proxima renovacao fica visivel no Meu Perfil. Congelamento preserva acesso e, na retomada, desloca a renovacao pelo periodo pausado; suspensao de cobranca nao corta o prazo ja pago.
- Pagamento empresarial nao substitui onboarding, aceites, AURA ou associacao comunitaria individual; permissoes dos modulos sao controladas pelo titular e validadas no backend.
- As 16 areas publicas de contribuicao excluem as quatro funcoes de lideranca, reservadas a governanca da BIA; ramos e segmentos continuam na taxonomia canonica existente.
- Onboarding e Meu Perfil permitem indicar as quatro lideranças como preferências entre as 20 áreas canônicas, sem atribuir cargo ou permissão de governança. O “i” das duas telas reutiliza `contribution-area-info.tsx`, com as mesmas explicações; as 16 ofertas públicas permanecem separadas.
- Cadastro, onboarding, Meu Perfil e administracao de membros nao podem manter listas paralelas para ramo, segmento, abrangencia, idiomas ou areas de contribuicao.
- No Cadastro Geral, criar ou editar um membro abre uma pagina completa organizada nas abas Dados gerais, Comunidades, Perfil e presença, Acessos, Termos e Histórico. As abas reutilizam o mesmo estado, taxonomias, autorizações e endpoints do editor administrativo; são apenas uma reorganização visual e não criam cópia de perfil, vínculo, aceite ou permissão.
- Meu Perfil nao exige nem exibe areas de contribuicao quando `imoveis` e a unica finalidade ativa da conta.
- Os cards de finalidade do Meu Perfil abrem a configuracao das intencoes canonicas; alterar uma finalidade nao altera os campos de associacao `em_membros_built` ou `em_built_capital`.
- Meu Perfil abre em uma central resumida com a previa completa no topo e quatro categorias abaixo; progresso e proxima etapa aparecem somente enquanto houver pendencias. Cada editor exibe apenas os campos da categoria escolhida e reutiliza o mesmo estado de formulario e os endpoints existentes. Os Tipos de Negocio usam a taxonomia compartilhada como exibicao imediata e a API atualiza seus nomes em segundo plano. O salvamento geral inclui os Tipos de Negocio e aparece fixo no canto somente enquanto houver alteracoes nao salvas; validacoes de campo oculto abrem a categoria correspondente, inclusive CNPJ em Empresa e Vitrine. Conta e seguranca nao exibe pendencia ficticia; a alteracao de senha aparece antes do convite e do resumo tanto no desktop quanto no mobile.
- No modo escuro, os cards de finalidade preservam seus tons azul, verde e violeta em superficies escuras, e o resumo da Aura nunca usa fundo claro com texto claro.
- A previa superior do Meu Perfil reutiliza o score oficial da Aura exibido no Inicio, posiciona seu circulo ao lado do nome com o mesmo diametro da foto e abre `/aura/:membroId`; ela nao recalcula nem persiste score.
- Cards de recomendacao aceitam foto Directus ou URL externa e sempre preservam fallback visual quando a imagem estiver indisponivel.
- Editar o nome completo de formalizacao ou o CPF nunca altera o nome publico exibido no perfil; o salvamento geral do perfil nao exige CPF antes de uma formalizacao.
- O link profundo `/meu-perfil?campo=<chave>` abre o editor da categoria necessaria, rola ate o controle correspondente e move o foco para ele.

## Efeitos e dependencias

- Mudar identificadores ou vinculos afeta Acesso, Aura, BIA, convites, Agenda, Vitrine, Carteira compartilhada e Administracao.
- Foto/avatar pode existir como arquivo Directus; atualizacao deve invalidar todos os cards que usam a imagem.

## Testes e impacto

- `shared/company-access.test.ts`
- `shared/strategic-cells.test.ts`
- `client/src/pages/comunidade-celulas.test.ts`
- `server/member-business-feed.test.ts`
- Ao alterar: testar membro em 0/1/varias comunidades, comunidade mae diferente da ativa, empresa e funcionario, perfis publico/privado e remocao parcial.

- Meu Perfil não preenche `nome_completo` automaticamente com `nome`: o campo e o indicador usam o valor persistido. `Usar nome do perfil` é uma escolha explícita que marca o formulário como alterado; o botão geral salva e invalida a consulta compartilhada com o Início.
