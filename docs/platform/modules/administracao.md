# Administracao

## 03/11/2026 — edição administrativa da composição das BIAs

- Superadmin (`admin` canônico, aliases `superadmin`/`master`) pode editar a composição moderna e legada de qualquer BIA autorizada, sem estar na Equipe, em estruturação/captação/ativa/suspensa/encerrada. A projeção canEdit e o salvamento sob lock usam o mesmo helper de domínio em server/bia-map-history.ts. Perfil `manager`, Diretor de Capital e sócios isolados não ganham esse direito; Diretor da Aliança/Aliado mantêm suas permissões anteriores e leitura na encerrada.
- Pedido contextual à edição da composição: demais módulos e permissões administrativas existentes preservados. A mudança não altera papéis reais, matriz de outra conta, fase da BIA ou movimentos financeiros. Motivo, revisão esperada, validações econômicas, autoria, notificações vigentes e documentos/versões anteriores permanecem. Sem migração ou publicação automática.

## 02/11/2026 — Consulta e edição dos acessos de uma conta

- Cadastro Geral > Acessos consulta `/api/admin/member-access/:userId`: conta, anuidade/plano ativo, publicação, entrada em ambientes, cargos múltiplos e matriz por BIA. Usa `memberAccessSummary`, `environment-access`, `bia-access` e as tabelas oficiais; não deduz cargo de selo nem confunde publicação com acesso.
- O seletor compartilhado `ACCOUNT_ACCESS_PRESETS` prepara a mesma conta como comum, profissional, membro, aliado, gestor ou Superadmin (`admin` canônico) e substitui os perfis globais ao aplicar/salvar. Não cria contas, anuidade, participação econômica ou cargo de diretor. Funcionário é contextual ao Plano Empresa e aparece identificado sem simular o vínculo. Todos os cargos da BIA são listados a partir de `BIA_PARTICIPANT_ROLE_LABELS`; a alteração oficial continua no editor de Equipe pelo atalho, e a matriz configurável continua editável diretamente aqui.
- A finalidade profissional é lida de `user_account_purposes`, como em `/api/me`, e atualizada junto com o papel no cadastro da conta. O endpoint anterior continua disponível por PUT `/api/admin/member-access/:userId/professional`, com validação booleana, autorização renovada e auditoria na mesma transação. A seleção de outro perfil desativa essa finalidade sem apagar a linha, seus objetivos ou as outras finalidades; publicação de perfil permanece separada e não é ativada automaticamente.
- Administradores possuem bypass declarado; a matriz contextual não revoga esse bypass. Conta de recuperação é identificada e não serve como conta comum de teste. Funcionários continuam sujeitos à matriz empresarial; não se editam seus direitos por esta nova matriz.
- Leitura administrativa e `/api/users` revalidam conta administrativa ativa e ausência de vínculo empresarial no servidor. Uma alteração de role/permissões/atividade registra intenção sem senha/e-mail em `user_usage_events` antes da gravação. O registro é de solicitação, não de confirmação de sucesso. A matriz BIA mantém `updated_by_*` e `updated_at` existentes.
- Não há impersonação: teste com a mesma conta em outra sessão de navegador. Após salvar, `live-account-access` relê a conta persistida antes dos controles de cada API; não depende de novo login ou de consultar `/api/me` para revogar privilégios antigos. O cliente consulta a cada10s e ao recuperar foco/visibilidade, sinaliza mudanças na mesma origem e limpa consultas anteriores quando a identidade/permissão ou revisão dos cargos/matrizes da BIA mudar. Essa atualização também alcança as abas já abertas. Rascunhos continuam aguardando o botão Aplicar/Salvar. Requisitos de onboarding, aceites, vínculo e fase são mantidos.
- `superadmin`/`master` legados são normalizados para `admin` na sessão, preservando as telas e regras existentes sem criar papel persistido concorrente. A conta de recuperação continua explicitamente Superadmin e não pode ser rebaixada/desativada por esse seletor; usar outra conta para os testes. Finalidade profissional e papel são salvos na mesma transação.
- Consumidores: editor e relatório funcional atualizados; sessão/login e regras de cada módulo preservados. APIs de BIA não alteradas. Sem migração, emissão, envio de mensagens, atualização de documentos ou alteração em produção.

- 23/10/2026 — nomenclatura pública unificada: relatório funcional (inclusive versão impressa), administração da taxonomia, demandas, opções do PDF da BIA e erros do perfil/API usam Tese de interesse. `shared/public-labels.ts` resolve apenas aliases antigos conhecidos de `Market`, tanto na projeção da API quanto no cache do hook; nomes personalizados de outros conceitos são preservados. Escrita continua restrita a admin e normaliza o nome antes de persistir. Sem migração, reclassificação de BIAs, alteração de valores, permissões ou documentos emitidos. Regressões: `shared/public-labels.test.ts` e `client/src/data/platform-functional-report.test.ts`; guarda global de nomenclatura ampliada em `docs/platform/deprecations.json`.

## Objetivo e usuarios

Permite operar membros, configuracoes, uso, estruturacao de BIAs, monetizacao e auditoria da plataforma sem transformar regras administrativas em permissao global implicita.

## Telas e URLs

- `/admin` e abas por query string, incluindo dashboard, membros, configuracoes, pagamentos, estruturacao de BIAs e `?tab=politicas`.
- `/documentacao/relatorio-funcionalidades` consolida o inventario funcional, as fases da BIA e seus requisitos, perfis globais, papeis por BIA, efeitos de tese/convite/vinculo e controles de isolamento para a decisao de lancamento. O relatorio distingue capacidade de produto de permissao efetiva e registra bloqueadores conhecidos; sua audiencia em producao deve ser decidida antes do release.
- O painel do provedor bancário anterior foi removido. Indicadores de cobranças das BIAs mantêm valores históricos, separados da receita da plataforma. `/admin?tab=asaas` oferece consulta de configuração e pendências da base, exclusiva de admin/superadmin ativo, excluindo funcionário empresarial. Nunca expõe segredos nem oferece ações financeiras; backend revalida usuário ativo, papel e vínculo empresarial.
- Implementacao principal: `client/src/pages/admin.tsx` e `client/src/components/bia-structuring-queue.tsx`.

## APIs

- `/api/admin/usage-heatmap`, `/api/admin/monetization` e indicadores administrativos.
- `GET /api/admin/asaas/status`: somente consulta, sem chamadas externas; mostra ambiente, opt-ins e capacidades efetivamente disponíveis, incluindo a trava adicional de Produção.
- CRUD administrativo de membros/comunidades e configuracoes.
- `/api/bia-estruturacao-solicitacoes*` para fila compartilhada com os papeis operacionais.
- `/api/admin/monetization/policies*`, `/api/admin/bias/:id/monetization*` e `/api/admin/taxonomy/*` para politicas versionadas, termos imutaveis e nomes publicos.
- `/api/admin/subscriptions*` lista e altera renovacoes de anuidade e Plano Empresa, incluindo suspensao de cobranca e congelamento/retomada do prazo.

## Dados e fontes de verdade

- Indicadores agregam PostgreSQL, Directus e provedores; cada metrica deve informar fonte e janela.
- `user_usage_events`, assinaturas empresariais, convites, anuncios e pagamentos alimentam monetizacao.
- `membro_anuidades` e `company_plan_subscriptions` sao editados diretamente pelos controles de renovacao; nao ha copia administrativa paralela.
- Administracao nao deve criar uma segunda copia editavel de dados sem sincronizacao declarada.
- `monetization_policies` e a fonte versionada; `bia_billing_terms.snapshot` congela a versao aplicada e `bia_billing_charges` preserva competencias e IDs externos.

## Papeis e permissoes

- Admin: operacao delegada conforme escopo.
- Superadmin: excecoes centrais e auditadas.
- Aliado/Diretor pode agir em tarefas de sua BIA/comunidade por tela ou notificacao especifica, nao ganha acesso ao admin inteiro.
- Todas as mutacoes administrativas exigem backend autorizado e registro do executor.

## Estados e transicoes

- Estruturacao, pagamento, membro e anuncio mantem os estados do dominio de origem.
- Dashboard e fila sao projecoes; mudar status exige endpoint do dominio.

## Invariantes

- Qualquer mudanca em funcionalidades, fases/requisitos/transicoes da BIA, perfis, papeis, permissoes, teses/Tipos de negocio, finalidades, anuidade, empresa, Comunidades/Celulas, convites, publicacao ou isolamento de dados atualiza no mesmo trabalho `client/src/data/platform-functional-report.ts`, sua apresentacao quando aplicavel e este contrato. O status publicado sempre corresponde ao comportamento autorizado e testado no backend; uma interface sem endpoint, integracao sem homologacao ou regra sem regressao nao e marcada como disponivel. Executar `npm run test:functional-report` e `npm run platform:contract` nesse escopo.
- O relatorio funcional precisa documentar as seis fases novas da BIA, a compatibilidade `ativa` legada, os perfis globais e todos os papeis internos suportados por `shared/bia-access.ts`. Escolha de Tipo de negocio, finalidade, anuidade, Comunidade, convite e publicacao nunca pode ser descrita como permissao implicita. Bloqueadores de lancamento devem permanecer visiveis ate que o codigo e os testes correspondentes provem a correcao.
- A auditoria de lancamento registra como bloqueadores atuais: a ausencia do POST autorizado/idempotente de fases consumido pela interface e o uso de uma projecao ampla nas rotas publicas de BIA/MAP. Nao declarar essas capacidades prontas nem ocultar os itens do relatorio antes da correcao e da regressao entre BIAs.

- Indicadores do Cadastro Geral usam classe dedicada `members-stats` e superfície `--members-card`, independente de grid mobile/flex desktop. O modo claro não herda o fundo escuro institucional antigo; números/rótulos continuam com os tokens específicos de cada tema.

- Mobile: indicadores em duas colunas; ações do editor empilham em telas estreitas e rodapé usa cores do tema/área segura. Consulta de status Asaas encerra após 15s com erro recuperável, sem chamadas financeiras ou repetição automática. Regressão: `client/src/lib/mobile-layout.test.ts`.

- Dark mode: o Cadastro Geral e o editor de membros usam superfícies/textos/bordas do tema também no cabeçalho, indicadores, barra de busca, campos e avatares. CSS local não força mais branco/preto independentemente do tema; o padrão claro e os cartões institucionais escuros são preservados. Mudança visual sem API, dados ou permissões. Regressão em `client/src/components/appearance-settings.test.ts`.

O campo antigo de seleção adicional foi substituído pelas exceções individuais de área. A consulta à Vitrine e a publicação do perfil são permissões distintas.

- Metrica mostra data de atualizacao, fonte e criterio.
- Dados pessoais sao minimizados e exportacoes sao autorizadas.
- Filtros nao alteram totais de modo silencioso.
- Acao de superadmin nao pode depender apenas de texto/e-mail no frontend.
- Logs e relatorios mascaram PII.
- RIG exige minimo de 1%, aprovacao administrativa e inicio institucional explicito. Governanca de R$ 600/mes comeca na competencia do 25o mes, sem rateio diario, e para de gerar novas competencias quando suspensa ou encerrada.
- Toda alteracao de renovacao, suspensao ou congelamento exige admin/superadmin no backend e registra executor, assinatura, acao e resultado em `user_usage_events`.
- A troca de provedor não reescreve eventos, valores, aceites ou IDs de operações antigas; indicadores identificam cobranças legadas como histórico.

## Efeitos e dependencias

- Depende de todos os modulos e pode disparar comunicacoes, sincronizacoes e PDFs.
- Alterar nomenclatura ou status administrativo exige revisar telas operacionais correspondentes.

## Testes e impacto

- `client/src/data/platform-functional-report.test.ts`
- `server/bia-bank-history.test.ts`
- Testes de dominio dos modulos administrados.
- Ao alterar: testar admin/superadmin/nao admin, acesso direto por URL, mobile, escopo de dados, filtros e trilha de auditoria.


## Navegação superior da Administração — 09/11/2026

A barra usa a largura disponível do conteúdo e as cores do tema. A seção atual é indicada visualmente e por aria-current. No celular há duas colunas com quebra de rótulo. As URLs /admin?tab=... mantêm navegação direta e histórico do navegador. A seção Asaas continua condicionada a canReadAsaasAdmin.

## Perfis da conta — novembro de 2026

BUILT Capital deixa de ser uma concessão global: cartão, seletor, controles acumuláveis, presença, selo concedido pelo editor e ambiente no relatório administrativo removidos. Criação e alteração de papel rejeitam investidor; inscrição e aprovações de convites de capital não o concedem. Preferência de investimento, documentos já aceitos, vínculos e Núcleo de Capital da BIA continuam independentes. Contas históricas não recebem migração automática; no relatório o papel persistido aparece como anterior e a edição comum não o substitui. Gestor e superadmin mantêm o acesso operacional amplo, mas Asaas e edição administrativa de composição têm restrições adicionais. Coproprietário continua restrito ao contexto compartilhado.

O editor tem um seletor único. A hierarquia de capacidades é conta comum, profissional, membro, aliado, gestor e superadmin. O gestor opera as BIAs; administrar contas e a integração Asaas exige superadmin. Copropriedade é um vínculo por imóvel. Cada área mostra Permitido ou Restrito; o padrão vem do cargo e alterações explícitas são persistidas por conta e sobrevivem à troca de perfil. A autorização por área complementa os controles de vínculo, empresa, assinatura e de cada operação. A sessão relê as permissões a cada requisição autenticada.

O perfil e as exceções por área ficam visíveis mesmo antes de preencher as credenciais de uma conta nova. Salvar acessos depende de e-mail, senha válida e confirmação. A lista de áreas começa fechada.

Cada cargo da lista possui um ícone de informação com sua explicação. As descrições dos seis cargos pertencem ao catálogo compartilhado de perfis.

A lista de cargos mostra um botão de informação em cada linha. Abrir a explicação mantém a escolha atual; selecionar o nome fecha a lista e prepara o novo perfil.
