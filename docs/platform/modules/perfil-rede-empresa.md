# Perfis, Rede, Empresas e Comunidades

## Objetivo e usuarios

Mantem identidade publica/profissional, empresas, membros da rede, comunidades e acessos delegados de funcionarios.

## Telas e URLs

- `/meu-perfil`, `/area-membros`, `/membro/:id`.
- `/comunidade` e `/comunidade/:id`.
- Cadastro geral em `/admin?tab=membros` para administradores.
- Componentes principais: `client/src/pages/meu-perfil.tsx`, `client/src/pages/area-membros.tsx`, `client/src/pages/membro-detalhe.tsx`, `client/src/pages/comunidade.tsx`, `client/src/pages/comunidade-detalhe.tsx` e `client/src/components/company-access-panel.tsx`.

## APIs

- `/api/membros*`, `/api/membros-built`, `/api/comunidades*`.
- `/api/membros/:id/comunidades`, `/comunidade`, `/comunidade-mae` e `/convidador`.
- `/api/empresa/plano/checkout`, Plano Empresa, funcionarios e permissoes; `/ativar` e somente um adaptador para o checkout pago.
- APIs de nomes publicos e relacao N:N entre area de contribuicao e segmento.

## Dados e fontes de verdade

- Directus `cadastro_geral`: perfil de pessoa/empresa.
- Identidade do membro: `nome` e o nome publico exibido no perfil; `nome_completo` e `cpf` sao dados restritos de formalizacao. Registros legados sem `nome_completo` podem usar `nome` apenas como fallback de leitura em documentos.
- PostgreSQL `user_account_purposes`: finalidades escolhidas e suas intencoes; Meu Perfil usa a mesma taxonomia de `shared/initial-onboarding.ts`.
- Classificacao profissional oficial: `ramo_atuacao`, `segmento`, `area_atuacao`, `especialidade_livre` e `idiomas`; onboarding e edicao de perfil escrevem nesses mesmos campos.
- Taxonomias compartilhadas: `client/src/lib/ramos-segmentos.ts`, `shared/profile-taxonomy.ts` e `shared/contribution-areas.ts`.
- PostgreSQL `users`: login; `membros`: espelho/apoio operacional; `membro_comunidade_mae`: ancora preferencial.
- PostgreSQL `company_plan_subscriptions` concede o direito financeiro; cada funcionario possui `users` e `cadastro_geral` proprios.
- Relacoes de comunidade sao muitos-para-muitos. A lista integral de vinculos e a fonte para regras de associacao.
- Antes da adesao completa, a comunidade registrada no convite original e uma evidencia valida de origem e alimenta a ancora `membro_comunidade_mae`; ela nao deve ser ignorada apenas porque o candidato ainda nao entrou no M2M de membros.

## Papeis e permissoes

- Membro edita o proprio perfil; empresa administra apenas seus funcionarios.
- Aliado administra comunidades sob sua governanca; Diretor de Alianca nao e admin global.
- Admin/superadmin usam helpers centrais e deixam rastro de edicao.
- Perfil publico usa projecao sanitizada e consentida.

## Estados e transicoes

- Vinculo de comunidade pode ser `convidado`, `pendente`, `membro`, `aliado` ou equivalente legado.
- Remover comunidade nao remove o usuario nem os demais vinculos.
- Alterar comunidade mae nao cria nem apaga associacoes.

## Invariantes

- Um usuario pode participar de varias comunidades simultaneamente.
- Em `Aprovacoes pendentes`, convites aparecem somente quando aguardam decisao sobre o candidato ou avaliacao de Aura; termos enviados, aceitos e pagamento ficam no historico, sem reenvio manual de termos.
- Nunca selecionar apenas a primeira comunidade para autorizar Aura, convite ou estruturacao de BIA.
- O inicio da adesao resolve a comunidade pela ancora de origem e por todos os vinculos atuais; o convite original continua valido para candidatos ainda nao promovidos a membro.
- Vinculo deve comparar IDs normalizados de usuario, membro Directus e registros relacionais.
- Funcionario possui login proprio; auditoria registra quem executou, nao somente a empresa.
- Plano Empresa custa R$ 3.836,40/ano e inclui titular mais dois usuarios adicionais ativos. Upgrade de anuidade individual vigente cobra R$ 639,40 sem alterar a renovacao atual.
- Pagamento empresarial nao substitui onboarding, aceites, AURA ou associacao comunitaria individual; permissoes dos modulos sao controladas pelo titular e validadas no backend.
- As 16 areas publicas de contribuicao excluem as quatro funcoes de lideranca, reservadas a governanca da BIA; ramos e segmentos continuam na taxonomia canonica existente.
- Cadastro, onboarding, Meu Perfil e administracao de membros nao podem manter listas paralelas para ramo, segmento, abrangencia, idiomas ou areas de contribuicao.
- Os cards de finalidade do Meu Perfil abrem a configuracao das intencoes canonicas; alterar uma finalidade nao altera os campos de associacao `em_membros_built` ou `em_built_capital`.
- O resumo do Meu Perfil reutiliza o padrao visual e o score oficial da Aura exibidos no Inicio e abre `/aura/:membroId`; ele nao recalcula nem persiste score.
- Cards de recomendacao aceitam foto Directus ou URL externa e sempre preservam fallback visual quando a imagem estiver indisponivel.
- Editar o nome completo de formalizacao ou o CPF nunca altera o nome publico exibido no perfil; o salvamento geral do perfil nao exige CPF antes de uma formalizacao.
- O link profundo `/meu-perfil?campo=<chave>` abre a secao necessaria, rola ate o controle correspondente e move o foco para ele.

## Efeitos e dependencias

- Mudar identificadores ou vinculos afeta Acesso, Aura, BIA, convites, Agenda, Vitrine, Carteira compartilhada e Administracao.
- Foto/avatar pode existir como arquivo Directus; atualizacao deve invalidar todos os cards que usam a imagem.

## Testes e impacto

- `shared/company-access.test.ts`
- `server/member-business-feed.test.ts`
- Ao alterar: testar membro em 0/1/varias comunidades, comunidade mae diferente da ativa, empresa e funcionario, perfis publico/privado e remocao parcial.
