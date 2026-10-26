# Agenda, Alertas e Notificacoes

- 26/10/2026 (calendário do aporte): ao habilitar lembretes cria uma única ação Pagar aporte no vencimento, inclusive antes da primeira janela de aviso. E-mail e Alertas abrem essa ação por ID, somente se estiver na agenda autorizada do usuário; o calendário posiciona o mês e abre o detalhe com acesso ao Pix/boleto. Os prazos não geram ações duplicadas. Mudar pagador/vencimento cancela ação anterior; pagar encerra a pendência. Concluir ação manualmente não dá baixa financeira. Sem migração nova, valores e cobrança preservados.

- 26/10/2026: lembretes opcionais por lançamento de aporte em dinheiro, via e-mail (preferências `bia` preservadas) e Agenda/Alertas. Prazos selecionáveis: mês calendário anterior (dia limitado ao fim do mês), 7 e 1 dias antes; São Paulo. Ao optar dentro da primeira janela, aviso imediato. Sem configuração não há novos avisos. Worker persistente coalesce prazos perdidos no mais recente, impede duplicidade por lançamento/vencimento/pagador/prazo/canal e não repete SMTP incerto. Pagos, parciais, não caixa e conciliação pendente não recebem; confirmado/processando no provedor também suspende. GET não envia. Configuração explícita substitui offsets antigos apenas daquele lançamento; avisos de revisão preservados.

- 22/10/2026: A revisão vigente do MOU/MAP Inicial deixa de aparecer como cartão isolado acima dos convites e passa a compor a lista `Aprovações pendentes`, com o mesmo contador, busca, estado vazio e atualização após o aceite. O item continua destinado somente ao próprio signatário e abre o fluxo de leitura/aceite já existente; não muda documento, revisão, permissão, endpoint ou evidência do aceite. Regressão: `client/src/pages/comunidade-celulas.test.ts`.

- 22/10/2026: A Agenda abre no Calendario antes da Lista. O calendario preserva a visao mensal e acrescenta a semanal de domingo a sabado com as 24 horas, navegacao anterior/hoje/proximo e rolagem responsiva. Clique em um dia, no bloco de dia inteiro ou em uma hora abre o formulario existente com data/hora preenchidas; nenhuma acao e gravada antes da confirmacao do usuario. Compromissos continuam abrindo a edicao. Mes, semana e calendario vazio permitem iniciar uma acao. Tema escuro usa tokens/variantes proprios. Fonte e regressao: `client/src/pages/agenda.tsx`, `client/src/lib/agenda-calendar.ts` e `client/src/lib/agenda-calendar.test.ts`.

- 22/10/2026: Avisos já existentes de revisão do MAP em agenda_tarefas também aparecem nas pendências/contador de Alertas, com link para `/convites-alianca`. Projeção central `listMouRevisionAlerts`: mesma conta e membro, origem map:BIA:revisão vigente, não ativada/aceita, signatário atual de BIA em captação; exclui sessão de funcionário, revisões superadas, duplicatas e tarefas canceladas/concluídas. GET não cria/reenvia tarefa, convite, e-mail, aceite ou direito. Falha de consulta não vira ausência silenciosa. Regressão SQL em `server/agenda-alerts.test.ts`. Reaviso pontual só mediante pedido explícito e revalidação da pendência; histórico de convites/aceites permanece intacto.

- 22/10/2026: Linhas de convites de diretoria/sócios em `/convites-alianca` usam superfície opaca `dark:bg-card` no modo escuro e divisórias do tema. Preservadas cores translúcidas no claro, textos, estados, destinatários, ações/confirmacões e APIs; sem reenvio ou aceite automático. Regressão renderiza ambas as linhas em `client/src/components/appearance-settings.test.ts`.

- Aportes (2026-10-19): fila persistente em bia_contribution_notices, somente pagador, padrão -5/0/+3 às 9h São Paulo, canais/dias por BIA. Categoria e-mail bia respeita preferências; Agenda independente, deduplicada por ID e concluída após recebimento. Meios consultados no Asaas imediatamente antes do envio; sem conta/cobrança homologada não envia. D-2 legado preservado fora dos movimentos gerenciados. SMTP incerto não é repetido às cegas. Contrato: [CONTRIBUTION_BILLING.md](../../CONTRIBUTION_BILLING.md).

## Objetivo e usuarios

Consolida compromissos, chamadas, convites, aprovacoes e pendencias acionaveis de todos os modulos, com destino direto para a acao correta.

## Telas e URLs

- `/agenda-alertas` com visoes de agenda e alertas.
- `/agenda`, `/notificacoes` e `/convites` sao redirecionamentos legados.
- Chamadas de Capital em `/built-capital/chamadas*`.
- Implementacao principal: `client/src/pages/agenda-alertas.tsx`, `client/src/pages/agenda.tsx`, `client/src/lib/agenda-alerts.ts`, `client/src/lib/agenda-calendar.ts` e `client/src/components/app-sidebar.tsx`.

## APIs e tarefas

- Lembretes financeiros excluem propriedade, direitos sem caixa e parcelas com conciliacao pendente, usando metadata das parcelas iniciais por ID.

- `/api/agenda*`, `/api/agenda-alertas/contador`, `/alertas` e `/resumo`.
- APIs de convites, chamadas, aprovacoes, documentos, pagamentos e alertas da Carteira sao fontes.
- Cron/timers e polling podem criar ou atualizar lembretes; deduplicacao e obrigatoria.
- Proposta recebida, proposta aceita, conversao em OBA e encerramento de Demanda geram textos humanos sem dados privados e com chave idempotente de origem.
- Cada onda do Pulso de Demanda ou OBA cria no maximo uma notificacao interna e um e-mail por destinatario; ondas diferentes podem notificar novamente conforme o avanco do Pulso.
- Enquanto a aplicacao estiver visivel, contador, resumo e fontes de aprovacoes pendentes sao atualizados em ate 2 segundos, sem recarregar a pagina.

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

- Calendario e a primeira visualizacao dentro da Agenda; Lista permanece como alternativa. Mes e semana usam o mesmo filtro de status e a mesma colecao autorizada do usuario.
- Clique no calendario apenas prepara o formulario com data/hora. Criacao, edicao, compartilhamento e validacoes continuam nos endpoints existentes e exigem confirmacao explicita no botao Criar acao ou Salvar alteracoes.

- E-mails opcionais respeitam cinco preferências da conta: convites, agenda/lembretes, atualizações de BIA, oportunidades/demandas e comunidade/rede. Todos os31 envios em `mailer.ts` são classificados explicitamente antes do SMTP. Recuperação de senha, comunicações de acesso/decisão cadastral, termos e pagamentos continuam essenciais e não podem ser desativadas. Sem conta/preferência, comportamento legado; endereço compartilhado é suprimido se qualquer conta ativa vinculada desativou a categoria. Erro de consulta de preferência impede envio opcional, não libera silenciosamente.
- Supressão é resultado explícito `skipped`, não falha SMTP nem envio aceito. Reenvio manual de BIA informa a preferência do destinatário sem contorná-la; lembrete suprimido conserva reserva com status próprio para não reenfileirar; distribuição por onda registra canal e-mail ignorado sem mexer no aviso interno. Supressão não cancela convite, vínculo, aceites, cobrança, tarefa ou notificações internas. Regressões em `server/user-preferences.test.ts`, `server/payment-reminders.test.ts` e `client/src/components/platform-preferences.test.ts`.

- Resumo mobile usa grades que podem encolher e cabeçalhos com quebra de linha; ações não podem sair da tela. Pendências usam contraste específico para tema escuro. Menu móvel fecha ao escolher destino; nenhuma mudança de contador, consulta ou convite.

- E-mails de convite para diretoria e socios de BIA exibem a acao antes dos detalhes, com botao HTML de fundo solido, largura fluida e link alternativo. A logo tem largura explicita; aceitar/recusar continua exigindo acesso e autorizacao na plataforma. E-mails ja enviados nao sao modificados.
- Convites protegem fundo azul-marinho, botao dourado e texto com gradientes de cor unica e recorte de texto restrito ao Gmail. Cores inline permanecem como fallback; texto nao vira imagem. Previa de navegador nao substitui validacao no aplicativo de e-mail em modo escuro.

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

- `server/mailer.test.ts` (SMTP simulado; layout de convites, links, caracteres e percentual zero).

- `server/agenda-alerts.test.ts`
- `client/src/lib/agenda-alerts.test.ts`
- `client/src/lib/agenda-calendar.test.ts`
- `client/src/lib/dashboard-navigation.test.ts`
- Ao alterar: testar destinatarios por papel, deduplicacao, item resolvido, links profundos, refresh, badge lateral e mobile.
