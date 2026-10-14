# Administracao

## Objetivo e usuarios

Permite operar membros, configuracoes, uso, estruturacao de BIAs, monetizacao e auditoria da plataforma sem transformar regras administrativas em permissao global implicita.

## Telas e URLs

- `/admin` e abas por query string, incluindo dashboard, membros, configuracoes, pagamentos, estruturacao de BIAs e `?tab=politicas`.
- O painel do provedor bancário anterior foi removido. Indicadores de cobranças das BIAs mantêm valores históricos, separados da receita da plataforma. `/admin?tab=asaas` oferece consulta de configuração e pendências da base, exclusiva de admin/superadmin ativo, excluindo funcionário empresarial. Nunca expõe segredos nem oferece ações financeiras; backend revalida usuário ativo, papel e vínculo empresarial.
- Implementacao principal: `client/src/pages/admin.tsx` e `client/src/components/bia-structuring-queue.tsx`.

## APIs

- `/api/admin/usage-heatmap`, `/api/admin/monetization` e indicadores administrativos.
- `GET /api/admin/asaas/status`: somente consulta, sem chamadas externas; produção/capacidades bloqueadas e armazenamento pendente são explícitos.
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
