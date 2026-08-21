# Agenda, Alertas e Notificacoes

## Objetivo e usuarios

Consolida compromissos, chamadas, convites, aprovacoes e pendencias acionaveis de todos os modulos, com destino direto para a acao correta.

## Telas e URLs

- `/agenda-alertas` com visoes de agenda e alertas.
- `/agenda`, `/notificacoes` e `/convites` sao redirecionamentos legados.
- Chamadas de Capital em `/built-capital/chamadas*`.
- Implementacao principal: `client/src/pages/agenda-alertas.tsx`, `client/src/lib/agenda-alerts.ts` e `client/src/components/app-sidebar.tsx`.

## APIs e tarefas

- `/api/agenda*`, `/api/agenda-alertas/contador`, `/alertas` e `/resumo`.
- APIs de convites, chamadas, aprovacoes, documentos, pagamentos e alertas da Carteira sao fontes.
- Cron/timers e polling podem criar ou atualizar lembretes; deduplicacao e obrigatoria.

## Dados e fontes de verdade

- PostgreSQL `agenda_tarefas` para compromissos.
- Pendencias permanecem no modulo de origem; a central usa projecao normalizada.
- Estado da acao e historico devem ser persistidos no objeto apropriado, nao apenas no cache do painel.

## Papeis e permissoes

- Usuario recebe somente itens nos quais e destinatario ou possui papel de acao.
- Aliado e Diretor de Alianca devem conseguir prosseguir fluxos operacionais sem painel admin.
- Link de notificacao nunca substitui autorizacao no endpoint de destino.

## Estados e transicoes

- Agenda: planejada, concluida ou cancelada.
- Pendencia: aberta/acionavel, em andamento, resolvida ou ignorada.
- Convite/chamada/aprovacao herda a maquina de estados do modulo de origem.

## Invariantes

- A explicacao do modulo usa um controle de informacao acionavel no cabecalho da pagina, sem poluir as abas ou o menu lateral.
- Contador e lista usam a mesma regra e o mesmo escopo de usuario.
- Um evento de origem gera no maximo uma pendencia acionavel equivalente.
- Resolver na origem remove da central sem apagar o historico.
- URL conserva aba/filtro para refresh.
- Polling nao deve duplicar e-mails, notificacoes ou mutacoes.

## Efeitos e dependencias

- Depende de praticamente todos os modulos e pode enviar e-mail.
- Mudanca em qualquer status precisa revisar contador, lista, destino e texto de notificacao.

## Testes e impacto

- `server/agenda-alerts.test.ts`
- `client/src/lib/agenda-alerts.test.ts`
- `client/src/lib/dashboard-navigation.test.ts`
- Ao alterar: testar destinatarios por papel, deduplicacao, item resolvido, links profundos, refresh, badge lateral e mobile.
