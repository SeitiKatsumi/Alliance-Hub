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
- Endpoints de Plano Empresa, funcionarios e permissoes.

## Dados e fontes de verdade

- Directus `cadastro_geral`: perfil de pessoa/empresa.
- Classificacao profissional oficial: `ramo_atuacao`, `segmento`, `area_atuacao`, `especialidade_livre` e `idiomas`; onboarding e edicao de perfil escrevem nesses mesmos campos.
- Taxonomias compartilhadas: `client/src/lib/ramos-segmentos.ts`, `shared/profile-taxonomy.ts` e `shared/contribution-areas.ts`.
- PostgreSQL `users`: login; `membros`: espelho/apoio operacional; `membro_comunidade_mae`: ancora preferencial.
- Relacoes de comunidade sao muitos-para-muitos. A lista integral de vinculos e a fonte para regras de associacao.

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
- Nunca selecionar apenas a primeira comunidade para autorizar Aura, convite ou estruturacao de BIA.
- Vinculo deve comparar IDs normalizados de usuario, membro Directus e registros relacionais.
- Funcionario possui login proprio; auditoria registra quem executou, nao somente a empresa.
- Cadastro, onboarding, Meu Perfil e administracao de membros nao podem manter listas paralelas para ramo, segmento, abrangencia, idiomas ou areas de contribuicao.
- Cards de recomendacao aceitam foto Directus ou URL externa e sempre preservam fallback visual quando a imagem estiver indisponivel.

## Efeitos e dependencias

- Mudar identificadores ou vinculos afeta Acesso, Aura, BIA, convites, Agenda, Vitrine, Carteira compartilhada e Administracao.
- Foto/avatar pode existir como arquivo Directus; atualizacao deve invalidar todos os cards que usam a imagem.

## Testes e impacto

- `shared/company-access.test.ts`
- `server/member-business-feed.test.ts`
- Ao alterar: testar membro em 0/1/varias comunidades, comunidade mae diferente da ativa, empresa e funcionario, perfis publico/privado e remocao parcial.
