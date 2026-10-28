# Retirada do Directus — execução por etapas

## Preservação e limite autorizado

Preparar homologação privada no servidor; produção permanece no Directus até aprovação da virada. Dados e arquivos originais nunca serão apagados por esta migração. Não existe expiração automática de backups. Após a futura troca, origem ficará sem escrita. Qualquer exclusão futura exige autorização explícita.

## Estado em 28/10/2026

**Runtime PostgreSQL próprio implementado e homologação privada navegável em `http://localhost:3018`. Produção permanece no Directus; nenhuma virada foi executada.** As evidências de fundação/consolidação abaixo descrevem etapas anteriores, não o estado atual do runtime.

O usuário adiou a publicação para ampliar os testes. Rodada adicional: **27 jornadas de criação aprovadas, 174 chamadas verificadas e 594 testes automatizados**, com correções na edição da OBA e conclusão do assistente da BIA. Cobertura e limites no [relatório de homologação](MIGRATION_QA_2026-10-28.md). Novo retorno após essas gravações: `recovery-f614c58a8abedc55`, 198 tabelas, 1.097 arquivos e 5.388 eventos, restaurados e comparados; clone parado. A aplicação permanece privada e não houve commit/push. Os números abaixo registram etapas anteriores, não substituem esta rodada mais recente.

### Runtime e conferência funcional

- `BUILT_DATA_BACKEND=postgres` seleciona `server/native-data-transport.ts` e `server/native-data-store.ts`. Sem a variável, o comportamento atual Directus é mantido. APIs da plataforma, IDs, regras de domínio e autorização dos endpoints continuam iguais. O protocolo compatível é interno ao servidor, nunca um endpoint SQL público.
- Dados antigos passam a ser lidos/escritos em `built_legacy` no PostgreSQL consolidado; dados operacionais permanecem em `public` e schemas dos provedores. Metadados copiados de campos/relações orientam o adaptador, sem serviço Directus conectado. Login usa hashes Argon2 importados e credenciais locais existentes, preservando status e recusando contorno de MFA. Tickets internos são curtos e de uso único.
- Catálogo explícito de coleções, filtros parametrizados, limites de expansão, transação por operação e preservação de junções. Datas de vencimento são serializadas como data sem horário; valores monetários continuam números. Nenhum cálculo de MAP/CPP/patrimônio foi substituído. Relações repetidas não criam duplicatas nem tomam vínculos de outro registro.
- Uploads usam volume próprio persistente, detecção do conteúdo real, limite de tamanho e caminho restrito; downloads continuam pelo proxy autorizado da plataforma. Remover metadados não apaga bytes da cópia. Links de anexos da BIA usam `/api/assets`. Transformações de tamanho de imagem não são realizadas pelo adaptador nesta versão; o navegador continua dimensionando a imagem original.
- Chamadores atualizados: `server/routes.ts`, `server/index.ts`, `server/auth-google.ts`, `server/bia-community-directus.ts` e `server/payment-reminders.ts`. Helpers de domínio recebem os mesmos adaptadores. Fallback para API de produção/logs foi desativado no modo nativo; falha de leitura não busca outra base.
- Homologação: `/srv/built-migration/stage/runtime-6d2f8fb5ddf2`, aplicação `built-native-stage-11f7679395c9-app`, banco `built-native-stage-11f7679395c9-db`. Rede Docker interna, acesso por túnel local, cookie/segredo próprios, sem credenciais externas. SMTP, cobranças, reconciliações automáticas e outros workers com efeitos externos ficam bloqueados. Os cadastros e lançamentos sintéticos existem somente nessa cópia; ela não será promovida como banco final.
- Conferência:34 leituras reais de coleções/expansões aprovadas; login, membro, comunidades, BIAs, categorias, CPP e fluxo financeiro via API; atualização de telefone português/segmento longo e lançamento sintético na cópia; upload/download byte a byte. Sessão habitual do usuário conferiu Início, Perfil, Agenda e Financeiro; vencimentos corrigidos. Financeiro também conferido em390px. Nenhum aceite, envio de mensagem ou cobrança real foi feito.

### Retorno incluindo dados novos

- Cópia adicional fora do servidor: `C:/Users/ESPC/AppData/Local/BUILT/MigrationBackups`. Contém o backup original `20261028t092611-3cac72c5` e a recuperação `recovery-e3923c99ceff5a33`, com ACL restrita ao usuário/SYSTEM. Sete dumps/arquivos compactados conferidos por SHA256 após a transferência. Esse estado substitui a limitação histórica de cópia somente no host relatada nas etapas anteriores. Nenhuma cópia deve ser adicionada ao Git.

- `scripts/directus-native-recovery.py --rehearse-private-return --stage-directory <diretório>` valida identidade, rede interna, mounts e flags da homologação antes de pausar somente sua aplicação. Guarda dump completo e arquivos, reinicia a homologação e restaura um clone offline. Em scratch separado, reconstrói os dois layouts anteriores e compara linhas e sequências. Não escreve nas origens nem realiza uma virada.
- Ensaio aprovado em `recovery-e3923c99ceff5a33`:198 tabelas no checkpoint completo,67 no layout de cadastro/Directus,129 no da aplicação,1.087 arquivos e705 eventos no diário. Inclui alterações de teste realizadas depois da importação. Clone `built-native-recovery-8142c18a6029ebaf` parado e preservado.
- O arquivo integral mantém o diário. Nos dumps compatíveis, somente os gatilhos privados desse diário são omitidos da lista de restauração; tabelas e gatilhos de negócio permanecem. A declaração de schema public reaproveita o schema vazio da nova base. Nunca restaurar sobre a origem preservada.
- Isso comprova reconstrução e integridade dos dados; não equivale a ligar uma versão antiga com integrações reais. Antes de um retorno produtivo, pausar escritores, capturar o estado atual, conferir efeitos já realizados nos provedores e usar novos bancos restaurados. Nunca simplesmente apontar para o backup anterior à virada.

### Janela de manutenção e avisos de pagamento

- `server/migration-inbox.ts` é um receptor independente, sem conexão com banco nem workers. `dist/migration-maintenance.cjs --serve-maintenance` só roda por ação explícita do operador, nunca no startup normal. Telas/escritas retornam503; `/health` indica manutenção.
- Recebe os quatro webhooks existentes Asaas/Stripe, valida token/assinatura antes de aceitar e grava envelope AES-256-GCM em diretório privado, com arquivo sincronizado em disco e nome determinístico. Só confirma ao provedor depois da persistência. Não registra payloads/segredos em logs, não processa dinheiro e não apaga fila. Erro de disco, assinatura ou tamanho não recebe confirmação de sucesso.
- Exige `BUILT_MIGRATION_INBOX_DIR` absoluto privado e `BUILT_MIGRATION_INBOX_KEY` aleatória de32 bytes em hexadecimal, além dos segredos de verificação já existentes. Provisionar a chave em cofre do operador, fora do Git e dos relatórios; perdê-la impede ler a fila. Em Linux, rejeita diretório acessível a outros usuários.
- Reprocessamento explícito: `BUILT_MIGRATION_REPLAY_TARGET=http://127.0.0.1:<porta> node dist/migration-maintenance.cjs --replay-preserved-events`. Só aceita destino local, mantém IDs/corpos, autentica novamente nos handlers originais e marca recibo apenas após resposta recebida/processada. Fila de manutenção não pode ser confundida com destino final. Há trava de execução concorrente; crash preserva eventos e exige revisão do lock pelo operador. Uma resposta perdida pode exigir reentrega, respeitando idempotência dos handlers; não há promessa de entrega exatamente uma vez.
- Testes usam somente eventos sintéticos e handlers locais. O receptor não foi ativado no domínio oficial, e nenhum webhook real foi reprocessado.

### Consolidação e possibilidade de retorno

- Execução final com verificação adicional das sequências de IDs: `/srv/built-migration/consolidated/20261028t094657-51ecca61`. Mesmas193 tabelas,191806 linhas e1086 arquivos, mais diário em193 tabelas. Checkpoint `checkpoint-7b09b8fce76d906f` restaurado em `recovery_351172741334551f`:195 tabelas (inclui duas de controle), sequências e arquivos iguais. Zero eventos no diário, pois a aplicação não foi iniciada. Container correspondente parado ao terminar. Cópias anteriores mantidas.
- Validação de código: `platform:verify` passou com583 testes/0falhas, tipos e build; dois testes Python adicionais passaram no host. Evidência em `.BUILT-tmp/directus-consolidation-verify.log`. A validação atesta as ferramentas de consolidação/recuperação; não atesta conclusão da migração funcional.
- `scripts/directus-migration-consolidate.py --consolidate-offline --backup-run <id>` lê exclusivamente dumps já verificados. Restaura em um novo PostgreSQL17 sem rede, portas ou aplicação. Renomeia apenas o schema da cópia para `built_legacy` e importa na mesma base `built_stage` da aplicação. Não conecta aos bancos originais.
- Execução `/srv/built-migration/consolidated/20261028t094102-0fffdf12`:193 tabelas,191806 registros e1086 arquivos conferidos. Comparação por tabela inclui contagem e hash de todas as linhas ordenadas; arquivos conferidos individualmente por SHA256. IDs, relações e documentos existentes preservados. Credenciais antigas continuam arquivadas, nunca usadas por uma aplicação clonada.
- Container `built-migration-consolidated-20261028t094102-0fffdf12` permanece parado. Arquivos em `uploads/` privado persistente, fora da imagem e raiz web. Scratch e backups preservados. Nenhuma política de retenção automática.
- Diário `scripts/directus-migration-journal.sql` instalado apenas nessa cópia:193 tabelas acompanhadas. INSERT/UPDATE/DELETE guardam antes/depois e transação; rollback não deixa evento. Bloqueia TRUNCATE e alteração/exclusão do diário. Schema privado; aplicação não recebe acesso aos snapshots. Não substitui auditoria de domínio, não registra DDL e não impede intervenção de superusuário. Mudanças futuras de schema exigem revisar cobertura.
- `scripts/directus-migration-checkpoint.py --checkpoint-and-rehearse --consolidated-run <id>` recusa container produtivo, ativo, com rede/portas ou bind mounts. Guarda dump completo com diário e arquivos; restaura em outra base da mesma cópia isolada e compara todas as tabelas. Não faz retorno automático nem escreve no Directus original.
- Retorno ANTES de gravações no backend novo: manter/redirecionar para a origem preservada após confirmar o checkpoint do corte. Retorno DEPOIS de gravações: pausar escritas, preservar dump/arquivos/diário do destino, reconciliar novas operações com domínio e provedores, validar e só então redirecionar. Nunca apontar silenciosamente para uma origem antiga e perder dados novos. Esse procedimento final ainda depende do runtime substituto e ensaio integrado.
- Backups e checkpoints continuam no mesmo host; réplica externa e recuperação após perda do servidor ainda pendentes. Dumps não substituem provisionamento separado de roles/segredos. Não considerar esta cópia um ponto de corte produtivo: snapshots originais foram tomados em momentos diferentes e precisam ser renovados na manutenção aprovada.

Execução final validada: `/srv/built-migration/backups/20261028t092611-3cac72c5`, com ACL/owners no dump. Dumps Directus4.665.273bytes e aplicação4.316.697bytes; mesmas64/129 tabelas restauradas e1086 arquivos conferidos. Clones correspondentes ao sufixo `20261028t092611-3cac72c5` também parados. A primeira execução abaixo foi mantida, não sobrescrita; usar a final como evidência do script atual.

- Inventário estático: `npx tsx scripts/directus-migration-inventory.ts`. Encontrou43 arquivos e1402 referências. Não cobre integralmente nomes dinâmicos, relações ou automações externas; nunca declara prontidão.
- Backup remoto: `/srv/built-migration/backups/20261028t091909-b2b3e2cd`. Diretórios0700/arquivos0600, fora do Git e da raiz web. Contém dados pessoais, acesso restrito a operadores autorizados.
- Directus: dump4.665.172bytes, restauração transacional em PostgreSQL17 isolado,64 tabelas públicas.
- Aplicação: dump4.316.693bytes, restauração transacional em PostgreSQL16 isolado,129 tabelas nos cinco schemas. Nenhuma aplicação iniciada com esses dados.
- Uploads:1086 arquivos; compactado330.158.620bytes. Manifesto individual e arquivo compactado conferidos por SHA256; fontes não mudaram durante a cópia.
- Containers `built-migration-verify-directus-20261028t091909-b2b3e2cd` e `built-migration-verify-application-20261028t091909-b2b3e2cd` parados, sem rede/portas/reinício automático/aplicativo. Volumes preservados.
- Dumps individuais são consistentes, mas não representam corte simultâneo entre os bancos. Repetir cópia durante manutenção aprovada antes da virada.
- Inventário de automações confirmou dois flows ativos, ambos manuais: Prompts(GET) e Vector_Store(POST), com destino n8n. Não foram acionados. Preservar configuração no backup e revisar uso antes de retirar o Directus; não transportar URLs/tokens operacionais para homologação.
- Schema real contém coleções e junções não detectáveis só por chamadas literais: Comunidade, comunidade_bias, bias_projetos_participantes, bias_projetos_cadastro_geral, bias_projetos_files, fluxo_caixa_files, fluxo_caixa_favorecidos, fluxo_caixa_categorias, fluxo_caixa_tipos_cpp, especialidades e junções de oportunidades. Há também coleções históricas/IA (Credenciais, Prompts, Tools_Content, Vector_Store, IA_Automations, mcp_interface, Dev_Temporario, Calculadora_Aura). Todas estão preservadas no dump; classificar consumidores antes de decidir quais entram no runtime. Não interpretar coleção sem referência literal como descartável.

## Operação reproduzível

`scripts/directus-migration-backup.py` exige Python3 no host Docker Linux e argumento explícito `--backup-and-rehearse`. Não roda no boot, CI ou deploy. Usa pg_dump somente leitura, fontes fixas, diretório novo por execução, sem sobrescrever ou remover cópias. Não imprime segredos/linhas de dados.

Antes de executar: conferir host, espaço, fontes e montagem; executar `scripts/directus-migration-backup-test.py`. Recusa origem ambígua, symlinks, arquivo divergente e imagem Docker ausente. Falhas preservam manifesto incompleto e artefatos; não considerar backup validado.

Essas cópias não são a homologação navegável. Antes de iniciar qualquer aplicação clonada, bloquear integrações, isolar credenciais e invalidar sessões/tokens copiados. O localhost atual pode apontar a produção e não deve ser usado como destino da migração.

Backup está no mesmo servidor e ainda não tem cópia externa: não equivale a recuperação após perda do host. O dump preserva ACL/owners; somente a restauração de ensaio ignora esses atributos. Roles e segredos de infraestrutura exigem provisionamento separado na recuperação; não imprimir ou adicionar esses segredos ao repositório.

## Cobertura dos consumidores

| Grupo | Dependências | Decisão |
| --- | --- | --- |
| Perfil/onboarding/login | cadastro_geral, rotas e auth-google | Adaptador nativo; telefones/segmentos e hashes preservados; testes sintéticos sem aceite real |
| Comunidades/BIAs | relações, governança e espelhos locais | Junções/filtros/expansões nativas; APIs e regras de múltiplos vínculos preservadas |
| Financeiro/MAP | fluxo_caixa, aportes, reconciliação | Mesmos serviços de domínio, locks e intenções; valores/datas/beneficiários conferidos na cópia |
| Arquivos/documentos | uploads, /files, /assets, PDFs e anexos | Volume próprio, IDs e bytes preservados; PDFs/aceites existentes não reemitidos |
| Outras coleções | categorias, CPP, estudos, land_bank, oportunidades, especialidades | Allowlist e schema preparados;34 consultas verificadas na cópia; dados sem consumidor ativo continuam preservados |
| Telas/relatórios | perfil, carteira, BIA, agenda, gráficos, exportações | Contratos públicos e helpers preservados; não há consultas diretas do frontend ao banco |
| Automação/integrações | cron, timers, SMTP, pagamentos, IA | Adaptadores nativos para leituras; bloqueados somente em homologação; sem ensaio com dinheiro/mensagens reais |
| Directus externo | dois flows manuais Prompts/Vector_Store e coleções auxiliares | Arquivados integralmente; não são acionados pelo runtime da plataforma; origem permanece disponível até decisão operacional da virada |

APIs públicas permanecem estáveis. Não criar proxy SQL aberto nem traduzir filtros arbitrários sem allowlist. Não usar fallback para Directus/produção na homologação final.

## Operação final ainda pendente de aprovação

1. Aprovar a janela de manutenção e o escopo do domínio oficial. Esta homologação não muda a produção por si só; commit/push/deploy são etapas distintas.
2. Provisionar o receptor com volume/chave persistentes, validar saúde e direcionar o tráfego. Pausar todos os escritores antigos, inclusive workers e edição administrativa do Directus; não apagar serviços/dados.
3. Repetir backup/restauração/consolidação com fontes paradas para obter um ponto de corte simultâneo. As cópias de28/10 não são o banco final. Repetir hashes, relações, sequências e arquivos e guardar cópia fora do host.
4. Preparar o destino e seu acesso de banco com privilégios apropriados, volume próprio e configuração existente; validar primeiro sem efeitos externos. `directus-native-stage.py --prepare-and-start --checkpoint <checkpoint-verificado>` permite ensaio de uma cópia nova, sempre isolado.
5. Conferir APIs, permissões, documentos, dashboards e autenticação no destino final, ativar runtime nativo e reprocessar fila autenticada. Verificar conciliação, contagens e saúde antes de retirar manutenção.
6. Registrar checkpoint do corte e manter origens sem escrita, backups, chave da fila e procedimento de retorno. Para voltar após novas operações, reconstruir bases atualizadas e conciliar provedores; jamais descartar gravações recentes.

Sem commit/push/deploy automático. Esta preparação não autoriza aceites, cobranças, mensagens ou movimentação financeira.
