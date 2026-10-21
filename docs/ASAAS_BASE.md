# Base Asaas da BUILT

Implementada em 14/10/2026 e ampliada em 20/10/2026. Criação/vínculo, cobranças de aportes, consulta de saldo e transferências Pix/entre contas Asaas são suportados no Sandbox e em Produção. Cada ambiente exige credenciais, webhook, cofre e opt-ins próprios; onboarding documental continua pendente.

## Modelo de contas

Conforme orientação enviada pelo Asaas, cada SPE ou holding terá uma subconta individual vinculada ao seu CNPJ. BIAs relacionadas à mesma empresa podem usar o mesmo vínculo de conta, mantendo o escopo de acesso por BIA. Conta Asaas não é um participante da BIA. O modelo escolhido é BaaS, com jornada dentro da BUILT; habilitação, contrato e playbook de produção ainda deverão ser fornecidos.

## Configuração

O arquivo `.env.asaas.example` contém somente nomes e valores vazios. A base usa `ASAAS_BASE_ENABLED`, `ASAAS_BASE_ENVIRONMENT`, credenciais/cofre `ASAAS_SANDBOX_*` ou `ASAAS_PRODUCTION_*`, `ASAAS_BAAS_ENABLED`, `ASAAS_CONTRIBUTIONS_ENABLED`, `ASAAS_TRANSFERS_ENABLED` e a trava adicional `ASAAS_PRODUCTION_OPERATIONS_ENABLED`. O padrão continua desabilitado. As variáveis antigas `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` não são herdadas.

Habilitar a base ou informar BaaS isoladamente não libera operações. Abertura e transferências exigem `capital_banco=edit`; cobranças de aportes exigem a autorização financeira já definida. Produção só opera com o opt-in adicional, credenciais próprias e conta aprovada. Status de configuração não equivale à aprovação do Asaas.

URLs do transporte são fixas conforme documentação oficial, com redirecionamento bloqueado, User-Agent, autenticação servidor, timeout15s e validação JSON. Não há retentativa de criação financeira nem credenciais no navegador.

## Persistência

As migrações aditivas `20261014_asaas_foundation.sql` e `20261020_asaas_sandbox_subaccounts.sql` criam os esquemas e o cofre cifrado. Cada ambiente possui accounts, account_credentials, bia_accounts, operations e events. Consultas não aplicam migrações.

- Accounts: identificação local, titular/referência da empresa, ID externo, walletId e referência a cofre; nenhuma chave de subconta em texto simples.
- Account_credentials: chave da subconta cifrada com AES-256-GCM; a chave mestra fica somente no ambiente do servidor. API, logs e navegador nunca recebem a credencial.
- Bia_accounts: uma conta por BIA e várias BIAs por conta dentro de cada ambiente. O vínculo Sandbox é criado pelo fluxo autorizado de abertura/reutilização da conta da empresa.
- Operations: intenção persistida por conta/BIA, executor, tipo, valor inteiro em centavos, referência externa, chave de idempotência e hash canônico. Mesma chave/pedido recupera a intenção; pedido diferente retorna conflito409. Estados: prepared, sent, pending, unknown, completed, rejected, cancelled. Mudanças condicionais impedem sobrescrever estado concorrente/terminal.
- Events: ID único do evento por ambiente, tipo, origem/entidade, hash e projeção mínima de referências. Duplicados não são reprocessados. Payload integral, documentos, chaves e efeitos financeiros não são registrados nesta base. Campos novos do provedor são tolerados sem serem expostos.

Sem migração no banco configurado, as telas informam armazenamento pendente. Nenhuma criação de esquema acontece nas consultas. As duas migrações foram aplicadas ao banco compartilhado de desenvolvimento em 20/10/2026; outros ambientes continuam exigindo execução explícita.

## APIs e telas

- `GET /api/admin/asaas/status`: admin/superadmin ativo, com verificação servidor do usuário e vínculo empresarial; funcionário, manager e master não recebem acesso. Retorna apenas flags, pendências e capacidades bloqueadas.
- `GET /api/bias/:biaId/banco/asaas/status`: acesso `capital_banco=view` da BIA solicitada; consulta usa ID canônico autorizado. Retorna estado e resumo mínimo do vínculo local. Nunca expõe chave, credential_reference ou payload externo.
- `POST /api/bias/:biaId/banco/asaas/accounts`: exige `capital_banco=edit`, ambiente configurado, BaaS e cofre válidos. Valida CNPJ e campos oficiais, consulta duplicidade por CNPJ, cria uma única subconta, cifra imediatamente a chave retornada e vincula a conta à BIA. Timeout fica inconclusivo e bloqueia repetição automática.
- `POST /api/bias/:biaId/banco/asaas/account/refresh`: exige `capital_banco=edit` e consulta pontualmente `/myAccount/status` com a credencial decifrada apenas em memória.
- `GET /api/bias/:biaId/banco/asaas/finance`: conta aprovada e `capital_banco=view`; consulta saldo e histórico mínimo de transferências sem expor destino/credencial.
- `POST /api/bias/:biaId/banco/asaas/transfers`: `capital_banco=edit`, conta aprovada, saldo suficiente, opt-in e confirmação explícita. Suporta chave Pix e wallet vinculada; intenção/idempotência são persistidas antes do POST e resposta incerta nunca é repetida.
- `POST /api/webhooks/asaas/sandbox|production`: token próprio por ambiente, ID/tipo obrigatórios e deduplicação. Pagamentos entram na fila de conciliação autoritativa; transferências atualizam apenas o estado da intenção, sem confiar no payload para alterar saldo.
- Administrativo → Asaas: configuração, BaaS, cofre, armazenamento e capacidades; não recebe segredos pelo navegador.
- Capital → Banco: usuário com edição pode criar a subconta, atualizar a situação e transferir quando habilitado; leitura vê vínculo, saldo e histórico mínimo. Conta aprovada libera cobranças/transferências apenas quando os opt-ins do ambiente também estiverem ativos. Falha de consulta não é apresentada como saldo zero.

Após criar/vincular, o Banco mostra Próximos passos por situação cadastral, pendências de configuração da plataforma e instruções para preparar os aportes. A conta pode estar aprovada no Asaas enquanto cobranças e transferências continuam desabilitadas. Atualizar situação somente consulta o provedor: exibe carregamento e resultado persistente na tela, incluindo estado inalterado e horário da consulta. Não altera flags, envia documentos, emite cobrança ou transfere. Falha/timeout não remove vínculo nem afirma que o estado mudou. O status da BIA inclui `integrationPending` opcional, com as mesmas mensagens públicas sanitizadas já usadas pelo administrativo; sem chaves ou referências de cofre.

Os endpoints antigos de operação bancária permanecem desativados. O receptor existente `/api/webhooks/asaas` e as cobranças atuais permanecem inalterados; o novo receptor não encaminha eventos a eles.

## Próximos dados necessários

Onboarding e envio documental conforme `onboardingUrl`; tratamento automático dos eventos cadastrais; conciliação assistida para resposta perdida; recursos/limites/taxas do contrato e playbook de marca; homologação dessas jornadas antes de liberar produção. Dados reais não devem ser usados em testes sem autorização do titular.

## Fontes oficiais

- Autenticação: https://docs.asaas.com/docs/authentication-2
- Webhooks: https://docs.asaas.com/docs/sobre-os-webhooks
- Idempotência de eventos: https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks
- BaaS/subcontas: https://docs.asaas.com/docs/creating-baas-subaccounts

## Verificação

Testes cobrem configuração sem herança, separação Sandbox/Produção, CNPJ, cofre cifrado, transporte simulado, criação única, reutilização entre BIAs, timeout sem retry, saldo, transferência única/idempotente, token, evento duplicado, autorização e estados. A UI usa modais responsivos e exige confirmação humana para criação e transferência.
