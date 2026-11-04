# Agenda, Alertas e Notificacoes

- 04/11/2026: Pulso das ROs acrescenta avisos informativos de cada onda em Atualizações, por destinatário/canal/onda. Usa fonte ro_pulse_deliveries e link autenticado de resumo `/ros/avisos/:id`; não transforma convite em presença/aceite nem cria pendência obrigatória/tarefa duplicada. Preferência própria `ro_pulses` em Meu Perfil > Configurações > Notificações por e-mail (“Pulsos das ROs”); desligar suprime somente SMTP, mantendo avisos internos. JSON antigo sem essa chave herda a preferência opportunities, preservando recusas anteriores; escolha explícita passa a ser independente. Mesmo SMTP visual BUILT; dados privados da reunião continuam com acesso original. Fila, permissões, parada por data/status e migração descritas no contrato built-alliances. Sem disparo pela leitura e sem envio retroativo automático para ROs legadas.

- 03/11/2026 — ações estáveis: convites de comunidade/Aura, diretoria, sócio e revisões de MOU são sempre reservados aos controles nativos. A projeção central não cria linhas genéricas enquanto essas fontes carregam. IDs ainda não representados entram na contagem, com carregamento ou erro/retentativa explícitos, sem falso vazio ou link circular. Polling preserva cartões já carregados. Falhas HTTP das fontes de convites deixam de virar listas vazias silenciosas.
- Lembretes de aporte exibem `Ver lançamento` e sua projeção aponta diretamente para Financeiro da BIA + `paymentFlow` do lançamento, via `contributionFlowHref`. A consulta de pagamento existente autoriza o usuário; abrir não emite Pix/boleto nem paga. Calendário, tarefas e e-mails mantêm seus links históricos por ID (interpretados por agendaSourceAction). Nenhuma alteração de elegibilidade, destinatário, envio, aceite, persistência ou autorização. Consumidores revisados: projeção ContributionReminders, helper compartilhado de navegação, lista/Resumo/Agenda e diálogo financeiro; contratos do banco e documentos permanecem.

- 03/11/2026 — revisão solicitada pelo usuário: Alertas monta diretamente a área existente de `Aprovações pendentes`, com Chamadas para Aliança, Novas OBAs, busca e histórico preservados. Removida a camada extra `Pendências / Convites e chamadas`. Os lembretes de aporte, imóvel e aprovações de BIA entram como linhas do mesmo quadro, sem outro título/painel. O cartão vermelho do Resumo mantém `Ver pendências` e abre essa mesma área. URLs antigas com section=convites continuam compatíveis e não criam uma segunda tela.
- `additionalApprovalAlerts` acrescenta fontes adicionais ativas/acionáveis; `unresolvedNativeApprovalAlerts` identifica fontes nativas ainda não representadas por ID+tipo para carregamento/recuperação. Busca sem acentos e total da aba/quadro incluem os itens, sem repetição. Erro/carregamento não vira estado vazio; histórico não mistura lembretes ativos. Aceitar/recusar/registrar Aura/ler MOU continuam em seus controles anteriores. Regressões: agenda-unified-approvals.test.ts, agenda-pending-shortcut.test.ts, agenda-alerts.test.ts e agenda-pending-alerts.test.ts.

- A consulta completa `/api/agenda-alertas/alertas?grupo=pendencias` permanece como projeção autorizada dos itens ativos que exigem ação; o resumo limitado a cinco não é usado como lista completa. Polling de2 segundos e invalidação existentes preservados. API, PostgreSQL/Directus, workers, e-mails, PDFs e histórico não mudam. A separação visual criada antes neste dia foi substituída pela área única descrita acima.

- 31/10/2026: avisos de MOU usam `Ler e aceitar MOU` e link com BIA/revisão. Alertas, resumo, Próximas ações e calendário compartilham `shared/agenda-action.ts`. O destino só abre automaticamente uma revisão da lista autorizada do próprio signatário; links substituídos/resolvidos orientam consultar as pendências atuais, sem escolher outra versão. Polling não reabre o modal após fechar. Abrir não assina nem ativa a BIA; o POST existente verifica a revisão sob lock antes do aceite explícito e conserva dados contratuais/localização. Tarefas legadas são interpretadas pela origem `map:BIA:revisão`, sem regravar histórico; correção informativa `MAP Inicial corrigido` mantém sua função. Aportes conhecidos abrem o fluxo financeiro existente, tarefas comuns abrem sua edição por ID; o botão Editar permanece disponível na Lista.
- Alcance revisado: produtor `notifyMapRevision`, projeção SQL, resumo, painel, Agenda e leitor em Comunidade atualizados. Contador/isolamento SQL preservados. E-mails de lembrete já apontam para a tarefa por ID e passam a abrir seu destino, sem reenviar mensagens. Convites/chamadas/carteira continuam nos módulos próprios. PostgreSQL/Directus, PDFs assinados, templates MOU/MAP, regras de revisão, cálculos, cron e relatório histórico não são migrados; relatório funcional registra somente a nova navegação. Não se assume que todo novo membro gere uma revisão.

- Logo dos e-mails: o template compartilhado usa a imagem HTTPS pública de app.builtalliances.com, independente de APP_URL local. Links de ação continuam no ambiente configurado; destinatários, preferências e filas não mudam. E-mails já recebidos não são alterados. Regressão em server/mailer.test.ts com APP_URL localhost, SMTP simulado e convites/lembrete de aporte.

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
