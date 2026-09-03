# Perfis, Rede, Empresas e Comunidades

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
- Antes da adesao completa, a comunidade registrada no convite original e uma evidencia valida de origem e alimenta a ancora `membro_comunidade_mae`; ela nao deve ser ignorada apenas porque o candidato ainda nao entrou no M2M de membros.

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

- Um usuario pode participar de varias comunidades simultaneamente.
- Uma RO de Comunidade fica visivel aos membros daquela Comunidade sem usar `comunidade_mae` como substituta dos demais vinculos.
- Celulas existem somente dentro de Comunidades, sem menu global, subcomunidades ou subcelulas. Cada Comunidade possui exatamente uma Celula ativa para cada um dos seis tipos canonicos; registros legados ausentes ou inativos sao regularizados pela API da Comunidade.
- A pagina da Comunidade separa `Visao Geral` e `Celulas` em abas; as seis Celulas nao ficam repetidas no final da visao geral. Seus cards nao exibem Tipos de Negocio nem coordenacao e abrem uma pagina propria com status, descricao e participantes autorizados.
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
- Cadastro, onboarding, Meu Perfil e administracao de membros nao podem manter listas paralelas para ramo, segmento, abrangencia, idiomas ou areas de contribuicao.
- Os cards de finalidade do Meu Perfil abrem a configuracao das intencoes canonicas; alterar uma finalidade nao altera os campos de associacao `em_membros_built` ou `em_built_capital`.
- Meu Perfil abre em uma central resumida com a previa completa no topo e quatro categorias abaixo; progresso e proxima etapa aparecem somente enquanto houver pendencias. Cada editor exibe apenas os campos da categoria escolhida e reutiliza o mesmo estado de formulario e os endpoints existentes. Os Tipos de Negocio usam a taxonomia compartilhada como exibicao imediata e a API atualiza seus nomes em segundo plano. O salvamento geral inclui os Tipos de Negocio e aparece fixo no canto somente enquanto houver alteracoes nao salvas; validacoes de campo oculto abrem a categoria correspondente, inclusive CNPJ em Empresa e Vitrine. Conta e seguranca nao exibe pendencia ficticia; a alteracao de senha aparece antes do convite e do resumo tanto no desktop quanto no mobile.
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
