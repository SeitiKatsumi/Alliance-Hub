# Google Agenda na BUILT

## Comportamento

Agenda e Alertas → Agenda oferece **Conectar Google Agenda**, escolha da conta e consentimento próprio. A conexão não troca o usuário da BUILT nem altera o login Google existente.

- A agenda principal do Google aparece no calendário/lista da pessoa conectada, no período das cinco/seis semanas visíveis do mês. Eventos externos aparecem em Todas, identificados como Google, e abrem o Google para edição. Dias inteiros, múltiplos dias, ocorrências recorrentes e fuso Google são considerados. Não entram em contadores, Resumo, alertas/e-mails ou agendas de outros membros. O botão Google Agenda no cabeçalho do calendário abre as configurações em diálogo; fechar conserva a conexão e a consulta automática.
- Fonte das ações exportadas: `agenda_tarefas WHERE user_id = proprietário da sessão autenticada`, incluindo ações compartilhadas/geradas por módulos para essa pessoa. Credenciais ficam na conta local ativa. Sessões antigas com ID Directus anterior só resolvem a conta pelo e-mail assinado se houver exatamente uma correspondência e o vínculo de membro for compatível; `agenda_user_id` preserva a origem, vinculada ao state OAuth. Ambiguidade/suspensão bloqueiam a conexão. Nunca consulta a agenda de terceiros, mesmo para superadmin.
- Ações com horário duram1h e ficam ocupadas; sem horário são eventos de dia inteiro livres. Concluídas permanecem identificadas; canceladas/removidas apagam somente seu evento exportado. Título/descrição e link autenticado são enviados à agenda principal, com visibilidade privada e sem adicionar convidados/conferências.
- A BUILT gerencia seus eventos exportados. Alterações do Google não escrevem em tarefas/financeiro/MOU/RO. Reenvio após resposta incerta usa ID determinístico e prova de proprietário/tarefa; nunca altera evento alheio. Exportados não aparecem duas vezes na tela.
- Job a cada5min e botão Sincronizar agora. Limite50 alterações/45s por ciclo e5000 ações por usuário; parcial/falha são explícitos. Próximo ciclo retoma por fingerprint. Mudança de conta usa IDs distintos e preserva eventos da conta anterior; sem retry cego com outro ID.
- Desconectar apaga credenciais/mapeamentos da BUILT e para sincronização/exibição externa. Eventos já enviados permanecem no Google. A pessoa pode revogar a autorização no painel Google; a BUILT não revoga todas as permissões do cliente compartilhado com o login.

## Configuração do operador

Habilitar a **Google Calendar API** no projeto OAuth web. Configurar consentimento para `https://www.googleapis.com/auth/calendar.events`, openid/email. No modo de teste, cadastrar as contas de teste; para distribuição pública, cumprir a verificação solicitada pelo Google. Não colocar credenciais em código, Git, logs ou chat.

Variáveis do servidor:

- `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET`: opcionais; fallback em `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` existentes.
- `GOOGLE_CALENDAR_ENCRYPTION_KEY`: obrigatória,64 caracteres hexadecimais aleatórios (32bytes). Manter fixa/protegida; trocar sem recriptografar exige reconectar. Não reutiliza segredo de sessão/chave bancária.
- `GOOGLE_CALENDAR_REDIRECT_URI`: callback completo `/auth/google/callback`, cadastrado exatamente no cliente OAuth. Local padrão `http://localhost:3004/auth/google/callback`; produção usa variável explícita ou `GOOGLE_CALLBACK_URL`/`APP_URL`, exigindo HTTPS. POST/DELETE conferem a origem configurada, sem confiar em Host.

Tabelas aditivas em `migrations/20261105_google_calendar.sql`; store garante o mesmo esquema antes do uso, sem modificar Directus/dados existentes. Credenciais AES256-GCM com IV aleatório. API retorna só estado/e-mail/fuso/última sincronização; respostas no-store, sem payload em logs. Eventos Google são consultados sob demanda, sem cópia no banco.

OAuth vincula sessão/conta, state aleatório de10min e PKCE S256; código/token não vai ao frontend. Callback do login preservado. Conta ativa/assinatura/permissões corporativas são relidas antes de conectar/sincronizar; API permanece sob middleware corporativo e worker revalida acesso. Homologação isolada proíbe segredos e integração externa.

## Validação

`server/google-calendar.test.ts`: PGlite/Google simulado, migração repetível, criptografia, datas/fuso/dias inteiros, isolamento, PKCE/state/replay/CSRF, renovação/paginação, criação/alteração/cancelamento/remoção, resposta incerta e desconexão. `client/src/components/google-calendar-connection.test.ts`: ações explícitas, estados e evento externo sem mutação de tarefa. Esses testes não autorizam conta Google real.

Documentação primária consultada em05/11/2026:

- [OAuth web e acesso offline](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Escopos Calendar](https://developers.google.com/workspace/calendar/api/auth)
- [Listar eventos/paginação](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- [Criar eventos, ID e fuso](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
