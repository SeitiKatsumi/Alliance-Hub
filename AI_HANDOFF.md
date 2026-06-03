# AI_HANDOFF.md

Leia este arquivo antes de editar quando houver mais de um chat trabalhando neste repo.

## Estado Atual
- O outro chat esta implementando a reorganizacao de Gestao de BIAs: nucleos dentro da BIA, gestao da OPA dentro da OPA e ajustes de acesso.
- Este chat deve evitar mexer em rotas/sidebar/estrutura de `Gestao de BIAs`, `BIAs`, `OPAs` e `BUILT Alliances` enquanto esse trabalho estiver ativo.
- Mudancas recentes deste chat: ajustes da Vitrine, cards/lista de BIAs e correcoes do fluxo de anuncio/OPA.
- Em `client/src/pages/bia-detalhe.tsx`, as abas de nucleos agora sao liberadas por BIA e por cargo: admin/manager ve tudo; demais usuarios veem apenas Diretoria, Tecnico, Obra, Comercial ou Capital se o `membro_directus_id` estiver no campo correspondente daquela BIA.

## Tocando Agora
- Evitar reabrir acesso global aos nucleos da BIA. Se alterar `bia-detalhe.tsx`, preservar a lista filtrada `allowedNucleoTabs`.

## Cuidado
- Antes de editar arquivos ja modificados, rode `git status --short` e leia o trecho atual.
- Nao reverta mudancas que voce nao fez.
- Se precisar tocar nos mesmos arquivos do outro chat, registre aqui em 1-2 linhas antes.
