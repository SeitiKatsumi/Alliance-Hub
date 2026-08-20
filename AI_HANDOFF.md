# AI_HANDOFF.md

Leia este arquivo antes de editar quando houver mais de um chat trabalhando neste repo.

## Estado Atual
- O outro chat esta implementando a reorganizacao de Gestao de BIAs: nucleos dentro da BIA, gestao da OPA dentro da OPA e ajustes de acesso.
- Este chat deve evitar mexer em rotas/sidebar/estrutura de `Gestao de BIAs`, `BIAs`, `OPAs` e `BUILT Alliances` enquanto esse trabalho estiver ativo.
- Mudancas recentes deste chat: ajustes da Vitrine, cards/lista de BIAs e correcoes do fluxo de anuncio/OPA.
- Em `client/src/pages/bia-detalhe.tsx`, as abas de nucleos agora sao liberadas por BIA e por cargo: admin/manager ve tudo; demais usuarios veem apenas Diretoria, Tecnico, Obra, Comercial ou Capital se o `membro_directus_id` estiver no campo correspondente daquela BIA.

## Tocando Agora
- Evitar reabrir acesso global aos nucleos da BIA. Se alterar `bia-detalhe.tsx`, preservar a lista filtrada `allowedNucleoTabs`.
- Este chat altera o resolvedor de comunidade da adesao e a configuracao de finalidades/intencoes no Meu Perfil, preservando rotas, sidebar e estruturas de BIA/OPA/Alliances.
- Este chat tambem altera somente a captura de voz em `carteira-assistente.tsx` e o helper generico de gravacao; nao altera BIAs, OPAs ou a estrutura de Alliances.
- Este chat separa o nome publico (`nome`) do nome de formalizacao (`nome_completo`) no Meu Perfil e toca apenas os fallbacks de qualificacao formal em `server/routes.ts`; nao altera fluxos, papeis ou estrutura de BIA.
- Este chat corrige somente a conclusao do novo onboarding em `server/routes.ts`: convites com aliado conector passam de `termos_aceitos` para `aguardando_avaliacao_aura`, incluindo reparo idempotente de jornadas ja concluidas.

## Cuidado
- Antes de editar arquivos ja modificados, rode `git status --short` e leia o trecho atual.
- Nao reverta mudancas que voce nao fez.
- Se precisar tocar nos mesmos arquivos do outro chat, registre aqui em 1-2 linhas antes.
