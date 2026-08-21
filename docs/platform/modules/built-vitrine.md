# Area de Vitrine

## Objetivo e usuarios

Publica perfis, OBAs, demandas, ativos e anuncios para descoberta pela rede, mantendo separacao entre informacao publica e dados privados.

## Telas e URLs

- `/vitrine`, `/vitrine/:id` e `/vitrine/parceiros`.
- `/vitrine/oportunidades/obas`, `/vitrine/oportunidades/obas/:id`.
- `/vitrine/oportunidades/demandas`, `/vitrine/oportunidades/demandas/:id`.
- Redirecionamentos legados `/vitrine/obas*`, `/vitrine/demandas*` e `/vitrine/opas*`.

## APIs

- `/api/vitrine`, `/api/vitrine/:id`, `/api/vitrine/demandas*`.
- APIs de OBA/OPA, interesses, anuncios e publicacao de ativos/Carteira.
- `/api/assets/:id` e endpoints de Land Bank exigem atencao a rotas duplicadas/legadas.

## Dados e fontes de verdade

- Perfis: Directus `cadastro_geral`.
- Oportunidades e demandas: registro de origem mais projecao publica.
- Anuncios: PostgreSQL `anuncios` e integracao administrativa.
- Carteira permanece privada; a Vitrine recebe apenas copia explicitamente publicada.

## Papeis e permissoes

- Visitante ou membro recebe apenas campos autorizados pelo tipo de publicacao.
- Todo usuario autenticado pode consultar a Area de Vitrine; funcionarios continuam respeitando a permissao explicita do Plano Empresa.
- `account_purposes` com finalidade `profissional` define quem pode publicar perfil profissional; `na_vitrine` controla essa publicacao opt-in.
- Usuario cadastrado recebe demandas e OBAs resumidas sem contatos privados; anuidade ativa de Membro BUILT libera detalhes autorizados.
- Dados de contato, endereco exato, proprietario e anexos privados exigem permissao especifica.
- Criar, editar, publicar e moderar sao permissoes distintas.

## Estados e transicoes

`rascunho -> em revisao -> publicado -> pausado/encerrado` deve ser refletido em busca, detalhe, mapa, interesse e administracao. Itens removidos da vitrine nao apagam a origem.

## Invariantes

- A explicacao do modulo fica em um controle de informacao acionavel no cabecalho da pagina, nunca no item do menu lateral.
- O termo da BUILT Vitrine nao integra o aceite inicial do onboarding; ele e exibido e registrado, com versao e evidencia de localizacao, no primeiro acesso ao modulo.
- A finalidade escolhida nao bloqueia a consulta da Area de Vitrine.
- Publicacao e opt-in e reversivel.
- Projecao publica nunca retorna objeto interno completo.
- Interesse duplicado do mesmo usuario/recurso e idempotente.
- Busca, mapa, contador e detalhe usam o mesmo conjunto de itens publicaveis.

## Efeitos e dependencias

- Depende de Perfis, Alliances, Carteira, Banco de Ativos, Administracao e Notificacoes.
- Publicacao pode gerar evento de uso, interesse, e-mail e oportunidade economica rastreavel.

## Testes e impacto

- `server/opportunity-platform.test.ts`
- `server/network-opportunities.test.ts`
- `server/property-journey.test.ts`
- Ao alterar: testar anonimato/publico/autenticado, dono/nao dono, publicacao e retirada, busca/mapa/detalhe e viewport mobile.
