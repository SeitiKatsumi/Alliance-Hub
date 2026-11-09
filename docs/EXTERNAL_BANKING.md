# Contas externas da BIA — implementação e habilitação

## Estado em 09/11/2026

Implementados a escolha Asaas/conta externa, contratos de consulta, cofre, persistência, exclusividade, leitura incremental, conciliação e interface de conferência. Nenhum dos 11 bancos está homologado nesta entrega. O usuário informou que ainda não possui acesso às APIs. Não foram contratados serviços, configuradas contas reais, aplicadas migrações no banco compartilhado ou ativadas baixas em produção.

O adaptador direto é orientado ao contrato concedido pelo banco: OAuth client credentials em formulário, mTLS, GET de identidade e GET paginado de créditos, com caminhos e campos definidos pelo operador. **Não são nove implementações específicas já validadas das APIs bancárias.** Contratos que exijam outra autenticação, assinatura, paginação ou formato precisam de extensão e testes antes da liberação. Não há caminhos bancários inventados ou fallback de scraping. Pluggy tem implementação específica das APIs oficiais, também sem homologação real/contratação.

## Cobertura planejada e bloqueios atuais

| Banco | Caminho | Habilitação pendente |
|---|---|---|
| [C6](https://www.c6bank.com.br/apis-integracao/) | Direto, primeiro grupo | API da conta, contrato e especificação concedida; confirmar PF/PJ e condições |
| [Sicoob](https://www.sicoob.com.br/web/sicoob/servicos-empresa/-/asset_publisher/lPNqdz0jZZX1/content/id/166036588) | Direto, primeiro grupo | Adesão, certificado, especificação e modalidade autorizada pela cooperativa |
| [Inter](https://developers.inter.co/docs/introducao/nossas-apis) | Direto, primeiro grupo PJ | Aplicação habilitada, escopos, certificado e contrato de conta empresarial |
| [Banco do Brasil](https://apoio.developers.bb.com.br/apis/80?topico=19424467&versaoApi=2) | Direto, extrato inicialmente PJ | Adesão, certificado, contrato e condições comerciais |
| [Bradesco](https://api.bradesco/openapis) | Direto | Habilitação de consulta/recebimentos, especificação e condições |
| [Santander](https://www.santander.com.br/empresas/cash/api/) | Direto | Contratação/habilitação dos recursos e especificação |
| [Itaú](https://devportal.itau.com.br/autenticacao-documentacao) | Direto Pix | Contrato Pix e identidade verificável; acesso Pix não prova acesso ao extrato geral |
| [BTG Empresas](https://developers.empresas.btgpactual.com/en/docs/tecspecs/Banking%20-%20Accounts-spec) | Direto PJ | API empresarial, identidade e notificações autorizadas |
| [Sicredi](https://developers.sicredi.com.br/public/docs/general-information) | Direto | Adesão e condições da cooperativa, contrato de consulta |
| [Nubank](https://nubank.com.br/empresas/open-finance) | Pluggy/Open Finance | Contrato do parceiro e cobertura PF/PJ confirmada |
| [Caixa](https://www.caixa.gov.br/open-finance/termos-de-uso/Paginas/default.aspx) | Pluggy/Open Finance | Contrato do parceiro e cobertura da modalidade; Pix Automático não é extrato geral |

Cada combinação banco/modalidade tem disponibilidade própria. Catálogo e links vêm de `shared/external-banking.ts`. Nenhuma modalidade é liberada apenas por aparecer no catálogo. Gratuidade dos 11 bancos não foi demonstrada; Pluggy de produção exige viabilização comercial. Cada perfil direto informa seus custos antes de a pessoa autorizar a conexão.

## Fonte de verdade e conciliação

- Banco/provedor autorizado prova titularidade e recebimentos. CPF/CNPJ e chave Pix digitados não comprovam conexão. Sem identidade completa retornada pela instituição, não conecta.
- PostgreSQL guarda escolha, conexão e recebimentos cifrados, intenções e eventos sanitizados. Directus `fluxo_caixa` continua sendo a fonte do lançamento. MAP, parcelas, histórico e indicadores usam a escrita financeira existente sob o bloqueio da BIA.
- Inicialmente consulta somente desde `activated_at`. Sobreposição posterior de dois dias captura atualizações, com dedupe por conta e ID bancário/endToEndId. Até20 páginas por ciclo; cursor/janela persistidos e última consulta bem-sucedida só avança após concluir. Worker verifica a cada minuto conexões com atualização devida a cada15min. Erros/limites preservam dados e tentam depois.
- Só entrada em dinheiro, aberta na mesma BIA e moeda, efetivada no banco, pode conciliar. Automático exige valor exato e documento completo ou referência previamente vinculada, único candidato, sem conflito. A integração atual dos lançamentos projeta documento do favorecido; não há cadastro de referência bancária no formulário nesta entrega.
- Nome/valor fracos ou diferença até o menor de R$5 e1% geram sugestões quando acompanhados de nome/data. Documento/referência podem sugerir divergências maiores ou pagamento parcial. Não há baixa integral com diferença, alteração do valor devido ou lançamento novo para crédito desconhecido.
- Recebimento com cobrança Asaas ativa exige resolução explícita antes de confirmar. Pagos e lançamentos protegidos não são candidatos. Reserva `applying` é confirmada antes do Directus; perda da resposta retoma pelo mesmo `pagamento_provider=external_bank` e receiptID, sem duplicar pagamento/CPP. Estado anterior é reservado para auditoria.
- Estorno/mudança material de crédito já aplicado vira `review`. Webhook `transactions/deleted` pausa automação e envia as decisões dessa conexão à revisão conservadora, sem desfazer lançamento/CPP. Não há reversão automática. Dados sem horário preciso podem ser excluídos na fronteira inicial por segurança; essa limitação deve ser resolvida/verificada na homologação do banco.
- Nunca usa IA para dar baixa ou inferir identidade bancária. O leitor de comprovantes/anexos permanece independente e não comprova recebimento.

## API privada e permissões

Base `/api/bias/:biaId/banco/externo`, registrada antes das rotas bancárias legadas410:

| Ação | Endpoint | Acesso |
|---|---|---|
| Situação/catálogo | GET `/status` | Banco view |
| Escolha Asaas/externa | PUT `/escolha` | Banco edit |
| Iniciar conexão | POST `/conexoes` | Banco edit |
| Listar contas autorizadas | POST `/conexoes/:id/contas` | Banco edit + ator da tentativa |
| Vincular conta retornada | POST `/conexoes/:id/concluir` | Banco edit + ator da tentativa |
| Atualizar | POST `/conexoes/:id/atualizar` | Banco edit |
| Ativar/pausar baixas | PUT `/conexoes/:id/automacao` | Banco edit + Financeiro edit |
| Desconectar localmente | POST `/conexoes/:id/desconectar` | Banco edit |
| Recebimentos/sugestões | GET `/recebimentos` | Banco view + Financeiro view |
| Confirmar sugestão exata | POST `/recebimentos/:id/confirmar` | Banco edit + Financeiro edit |

Sessão/canonicalização e permissão do servidor prevalecem. Worker reconsulta usuário ativo, vínculo/cargos e restrições atuais de colaborador/empresa; autorização removida interrompe processamento. Tentativas Open Finance são vinculadas por nonce ao `clientUserId` e expiram30min. Widget pede somente ACCOUNTS e TRANSACTIONS, restringe connectorId e usa consentimento do provedor; não pede senha do banco na BUILT.

GET de recebimentos atualmente projeta até100 registros recentes e omite documento/segredo. A conferência detalhada de divergências/estornos é operacional/manual nesta versão; não há botão de desfazer pagamento ou fluxo completo para ratear um recebimento parcial.

## Implantação controlada

1. Aplicar `migrations/20261109_external_banking.sql` pelo processo de migração do ambiente, com backup/revisão operacional. DDL aditivo/idempotente testado em PostgreSQL isolado PGlite. Sem backfill ou alteração de valores existentes. Nesta entrega não foi aplicado no banco compartilhado.
2. Criar chave dedicada de32bytes (`BUILT_BANKING_VAULT_KEY`,64hex) em cofre operacional, separada dos dados cifrados e com backup/rotação planejados. Não imprimir chave/segredos em logs, chat ou Git. AAD vincula cada ciphertext à conexão/recibo e ambiente; perder a chave exige reconexão e restauração segura.
3. Configurar `BUILT_BANKING_ENVIRONMENT=sandbox`, `BUILT_BANKING_ENABLED=true`. Em produção também exige `BUILT_BANKING_PRODUCTION_ENABLED=true`. Nenhum desses flags foi ativado aqui; `isolatedStage()` impede conexões reais em stage isolado.
4. Credenciais/certificados de produção devem estar em `BUILT_BANKING_CREDENTIALS`, JSON do resultado de `sealBankData(mapaDeSegredos, 'banking:credentials:production')`. Chaves do mapa são os nomes referenciados pelo perfil, além de `BUILT_PLUGGY_CLIENT_ID`/`BUILT_PLUGGY_CLIENT_SECRET` se necessário. Cifrar dentro do servidor/cofre, sem persistir uma cópia em claro. Sandbox permite env individuais somente para testes; em produção esse fallback é recusado.
5. `BUILT_BANKING_DIRECT_PROFILES` é JSON de perfis restritos à BIA, banco, modalidade e ambiente. Campos obrigatórios: `id,biaId,environment,bank,kind,contractApproved,homologated,costs,baseUrl,tokenUrl,clientIdEnv,certEnv,privateKeyEnv,scope`; opcional `clientSecretEnv`. `identity` especifica `path,account,document`; `receipts` especifica `path,rows,id,amount,date,direction,creditValue,status,settledValue,fromParam,toParam` e opcionais `reversedValue,currency,payerDocument,payerName,description,endToEndId,reference,next,cursorParam`. Paths/campos devem vir da documentação contratada; testes em `server/external-banking.test.ts` usam caminhos fictícios e **não servem para configurar banco real**. Hosts são restritos a domínios oficiais e TLS validado. Certificado expirado/401/403/429 nunca vira sucesso.
6. Para Pluggy, só após aprovação comercial: `BUILT_PLUGGY_APPROVED=true`, credenciais no cofre e `BUILT_PLUGGY_CONNECTORS` JSON com chaves como `inter:PJ` e IDs oficiais cuja cobertura foi confirmada. **Não inventar IDs.** Em produção, incluir cada modalidade homologada em `BUILT_PLUGGY_HOMOLOGATED_CONNECTORS` (lista separada por vírgula). Retirar aprovação/ID/homologação interrompe as consultas do adaptador, mesmo em conexão existente.
7. Se contratar notificações Pluggy, registrar pelo painel/API oficial um webhook HTTPS para `/api/webhooks/banking/pluggy`, com header `x-built-bank-secret` igual a `BUILT_BANKING_WEBHOOK_SECRET` (mínimo32caracteres). Endpoint não registra webhook automaticamente nem segue URLs do payload. Evento só acorda conexão verificada; valores são consultados pela API autenticada. Sem webhook cadastrado, permanece polling. Notificações diretas por banco ainda exigem implementação/homologação de assinatura oficial; não há endpoint genérico sem verificação.
8. Homologar individualmente autorização PF/PJ, titularidade/conta exclusiva, transação real de teste, moeda/horário, paginação/atraso, consentimento revogado, certificado, baixa/histórico/CPP sem duplicação e conflito Asaas. Só depois marcar `homologated=true` no perfil da conta. Flag não substitui essa evidência. C6/Sicoob/Inter são a primeira etapa; demais bancos seguem depois.

## Compatibilidade e desligamento

Sem escolha persistida, preserva Asaas. Escolher outra conta bloqueia novas cobranças automáticas Asaas dessa escolha; cobrança já emitida é consultada/conciliada normalmente. Emissão em andamento precisa terminar a conferência antes da troca. Voltar ao Asaas pausa novas baixas externas sem excluir histórico ou fechar contas. Desconectar apaga o acesso local e para consultas; o titular deve revogar consentimento no aplicativo do banco quando aplicável. Nenhuma desconexão remota destrutiva é enviada silenciosamente.

Interface usa tokens do tema, cards/radios responsivos e confirmação financeira. QA executado com fixtures isoladas e APIs simuladas: desktop/mobile390, claro/escuro, bloqueios de conexão e diálogo de conferência; capturas em `output/external-banking/`. Isso não comprova funcionamento com um banco real. Sem novos e-mails/notificações/PDFs; indicadores e relatórios continuam consumindo o lançamento original após baixa pela regra financeira existente.

Testes: `shared/external-banking.test.ts`, `server/external-banking.test.ts`, `client/src/components/bia-banking.test.ts` e regressão ampliada de `server/contribution-billing.test.ts`. Cobrem contrato/mTLS simulado, Open Finance simulado, cofre e AAD, autorização/origem, exclusividade, duplicação, intenção durável/resposta perdida, paginação retomada, estorno/remoção, pausa e preservação de cobranças Asaas.

Referências do parceiro: [autenticação](https://docs.pluggy.ai/en/reference/authentication), [contas](https://docs.pluggy.ai/en/reference/account/accounts-list), [transações com cursor](https://docs.pluggy.ai/en/reference/transaction/transactions-list-by-cursor), [contratação](https://v2.docs.pluggy.ai/pt/docs/get-started/contact). Compatibilidade real depende da especificação e cobertura concedidas à conta.
