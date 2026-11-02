# Administracao

## 02/11/2026 — Consulta e edição dos acessos de uma conta

- Cadastro Geral > Acessos consulta `/api/admin/member-access/:userId`: conta, anuidade/plano ativo, publicação, entrada em ambientes, cargos múltiplos e matriz por BIA. Usa `memberAccessSummary`, `environment-access`, `bia-access` e as tabelas oficiais; não deduz cargo de selo nem confunde publicação com acesso.
- O seletor compartilhado `ACCOUNT_ACCESS_PRESETS` prepara a mesma conta como comum, profissional, investidor, membro, aliado, coproprietário, gestor ou Superadmin (`admin` canônico) e substitui os perfis globais ao aplicar/salvar. Não cria contas, anuidade, participação econômica ou cargo de diretor. Funcionário é contextual ao Plano Empresa e aparece identificado sem simular o vínculo. Todos os cargos da BIA são listados a partir de `BIA_PARTICIPANT_ROLE_LABELS`; a alteração oficial continua no editor de Equipe pelo atalho, e a matriz configurável continua editável diretamente aqui.
- A finalidade profissional é lida de `user_account_purposes`, como em `/api/me`, e alterada por PUT `/api/admin/member-access/:userId/professional`, com validação booleana, autorização renovada e auditoria na mesma transação. A seleção de outro perfil desativa essa finalidade sem apagar a linha, seus objetivos ou as outras finalidades; publicação de perfil permanece separada e não é ativada automaticamente.
- Administradores possuem bypass declarado; a matriz contextual não revoga esse bypass. Conta de recuperação é identificada e não serve como conta comum de teste. Funcionários continuam sujeitos à matriz empresarial; não se editam seus direitos por esta nova matriz.
- Leitura administrativa e `/api/users` revalidam conta administrativa ativa e ausência de vínculo empresarial no servidor. Uma alteração de role/permissões/atividade registra intenção sem senha/e-mail em `user_usage_events` antes da gravação. O registro é de solicitação, não de confirmação de sucesso. A matriz BIA mantém `updated_by_*` e `updated_at` existentes.
- Não há impersonação: teste com a mesma conta em outra sessão de navegador. Após salvar, `live-account-access` relê a conta persistida antes dos controles de cada API; não depende de novo login ou de consultar `/api/me` para revogar privilégios antigos. O cliente consulta a cada10s e ao recuperar foco/visibilidade, sinaliza mudanças na mesma origem e limpa consultas anteriores quando a identidade/permissão ou revisão dos cargos/matrizes da BIA mudar. Essa atualização também alcança as abas já abertas. Rascunhos continuam aguardando o botão Aplicar/Salvar. Requisitos de onboarding, aceites, vínculo e fase são mantidos.
- `superadmin`/`master` legados são normalizados para `admin` na sessão, preservando as telas e regras existentes sem criar papel persistido concorrente. A conta de recuperação continua explicitamente Superadmin e não pode ser rebaixada/desativada por esse seletor; usar outra conta para os testes. Finalidade profissional é salva antes do papel para permitir autoalteração sem uma segunda chamada administrativa após perder esse direito.
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

- O seletor BUILT Vitrine permanece no layout original e grava sua escolha em `users.permissions.vitrine` (`view`/`none`) pelos endpoints existentes de usuarios. A leitura respeita a escolha explicita mesmo com cargo principal Aliado; contas legadas sem a chave usam o cargo original. Essa persistencia da selecao nao altera a regra de entrada `canAccessBuiltEnvironment`, as restricoes empresariais nem `na_vitrine` (publicacao do perfil).

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

- Refinamento: o resumo mostra Membro BUILT Sim/Não a partir do perfil, flag e selo Proud Member. Controles acumuláveis de membro, aliado e investidor ficam junto ao resumo e usam Salvar alterações existente. Administrador não concede automaticamente esses selos; remoção sincroniza flags e selos, preservando selos manuais, anuidade e cargos das BIAs. Testes cobrem remoção/reinclusão mantendo administrador e reabertura do perfil.
