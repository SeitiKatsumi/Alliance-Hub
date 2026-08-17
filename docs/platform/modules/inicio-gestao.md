# Inicio e Gestao

## Objetivo e usuarios

Oferece a visao consolidada do usuario: progresso cadastral, ambientes disponiveis, compromissos, pendencias, negocios, BIAs, Aura e atalhos operacionais.

## Telas e URLs

- `/` e `/painel`: painel principal em `client/src/pages/painel.tsx`.
- `/agenda-alertas`: destino de Agenda, Alertas e Pendencias.
- Navegacao e composicao: `client/src/App.tsx`, `client/src/components/app-sidebar.tsx` e `client/src/lib/dashboard-navigation.ts`.

## APIs e tarefas

- `/api/me`, `/api/me/negocios`, `/api/agenda-alertas/*`, `/api/agenda`.
- Contadores de convites, chamadas, aprovacoes, Carteira e pendencias de perfil.
- Polling de 30 segundos em dados acionaveis; novas consultas devem reutilizar cache/chaves existentes.

## Dados e fontes de verdade

- O painel nao e fonte de verdade: ele agrega estados dos modulos de origem.
- Cada card deve derivar de endpoint autorizado e manter link para o objeto que originou a pendencia.
- Contadores devem usar a mesma regra de inclusao da lista detalhada.

## Papeis e permissoes

- Todo usuario autenticado ve apenas recursos aos quais possui acesso efetivo.
- Administradores podem receber atalhos extras, mas isso nao altera a autorizacao dos recursos de destino.
- Funcionarios respeitam a matriz do Plano Empresa.

## Estados e transicoes

Alertas sao `acionavel`, `em andamento`, `resolvido` ou `ignorado`, conforme o modulo de origem. A alteracao deve ser registrada no objeto de origem; o painel apenas reflete o estado.

## Invariantes

- Nenhum card pode revelar nome, valor ou documento de recurso sem acesso.
- Um contador nunca pode somar itens que a lista correspondente omite.
- Acao concluida deixa de aparecer sem apagar historico.
- Redirecionamentos legados preservam filtros e aba selecionada quando aplicavel.

## Efeitos e dependencias

- Depende de Acesso, Comunidades, BIAs, Carteira, Agenda, Aura e Notificacoes.
- Interacoes podem invalidar varias chaves React Query; documentar todas no contrato da funcionalidade.

## Testes e impacto

- `client/src/lib/dashboard-navigation.test.ts`
- `server/agenda-alerts.test.ts`
- `client/src/lib/agenda-alerts.test.ts`
- Ao alterar: comparar contador/lista, estados vazios, usuario sem BIA, usuario multicomunidade, funcionario limitado, mobile e links profundos.
