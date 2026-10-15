# Base Asaas da BUILT

Implementada em 14/10/2026. Esta versão prepara configuração, transporte HTTP, persistência, permissões e acompanhamento. Nenhuma operação externa está habilitada.

## Modelo de contas

Conforme orientação enviada pelo Asaas, cada SPE ou holding terá uma subconta individual vinculada ao seu CNPJ. BIAs relacionadas à mesma empresa podem usar o mesmo vínculo de conta, mantendo o escopo de acesso por BIA. Conta Asaas não é um participante da BIA. O modelo escolhido é BaaS, com jornada dentro da BUILT; habilitação, contrato e playbook de produção ainda deverão ser fornecidos.

## Configuração

O arquivo `.env.asaas.example` contém somente nomes e valores vazios. A base usa `ASAAS_BASE_ENABLED`, `ASAAS_BASE_ENVIRONMENT`, `ASAAS_SANDBOX_API_KEY`, `ASAAS_SANDBOX_WEBHOOK_TOKEN` e `ASAAS_BAAS_ENABLED`. O padrão é Sandbox desabilitado. As variáveis antigas `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` não são herdadas; o checkout/webhook antigo continua separado e não foi reconfigurado.

Habilitar a base ou informar BaaS não libera operações bancárias. Produção é bloqueada no cliente, chamadas externas são bloqueadas no cliente de negócio e nenhuma rota/tarefa instancia o transporte HTTP desacoplado. Status de configuração não equivale à aprovação do Asaas.

URLs do transporte são fixas conforme documentação oficial, com redirecionamento bloqueado, User-Agent, autenticação servidor, timeout15s e validação JSON. Não há retentativa de criação financeira nem credenciais no navegador.

## Persistência

Migração aditiva `20261014_asaas_foundation.sql`, validada em PostgreSQL isolado (PGlite), cria esquemas `asaas_sandbox` e `asaas_production`. Cada um possui accounts, bia_accounts, operations e events. Não modifica tabelas antigas e não é executada pelo carregamento de status.

- Accounts: identificação local, titular/referência da empresa, ID externo, walletId e referência a cofre; nenhuma chave de subconta em texto simples.
- Bia_accounts: uma conta por BIA e várias BIAs por conta dentro de cada ambiente. O vínculo só deve ser criado por fluxo autorizado futuro, depois de conferir titularidade.
- Operations: intenção persistida por conta/BIA, executor, tipo, valor inteiro em centavos, referência externa, chave de idempotência e hash canônico. Mesma chave/pedido recupera a intenção; pedido diferente retorna conflito409. Estados: prepared, sent, pending, unknown, completed, rejected, cancelled. Mudanças condicionais impedem sobrescrever estado concorrente/terminal.
- Events: ID único do evento por ambiente, tipo, origem/entidade, hash e projeção mínima de referências. Duplicados não são reprocessados. Payload integral, documentos, chaves e efeitos financeiros não são registrados nesta base. Campos novos do provedor são tolerados sem serem expostos.

Sem migração no banco configurado, as telas informam armazenamento pendente. Nenhuma criação de esquema acontece nas consultas. A migração não foi aplicada ao banco real nesta entrega.

## APIs e telas

- `GET /api/admin/asaas/status`: admin/superadmin ativo, com verificação servidor do usuário e vínculo empresarial; funcionário, manager e master não recebem acesso. Retorna apenas flags, pendências e capacidades bloqueadas.
- `GET /api/bias/:biaId/banco/asaas/status`: acesso `capital_banco=view` da BIA solicitada; consulta usa ID canônico autorizado. Retorna estado e resumo mínimo do vínculo local. Nunca expõe chave, credential_reference ou payload externo.
- `POST /api/webhooks/asaas/sandbox`: base Sandbox habilitada, token próprio no header `asaas-access-token`, ID e tipo de evento obrigatórios. Registra referências de eventos com deduplicação, responde200 após persistir e informa financialEffects=false. Token errado401, formato inválido400, conflito409, falha/configuração/armazenamento503. Produção não é aceita nesse endpoint.
- Administrativo → Asaas: configuração, BaaS, armazenamento, próximos passos e recursos em preparação, sem cadastro de segredo ou botões financeiros.
- Capital → Banco: vínculo da SPE/holding e seu estado, com histórico anterior preservado. Conta aprovada não habilita operações automaticamente. Falha de consulta não é apresentada como saldo zero nem ausência de vínculo.

Os endpoints antigos de operação bancária permanecem desativados. O receptor existente `/api/webhooks/asaas` e as cobranças atuais permanecem inalterados; o novo receptor não encaminha eventos a eles.

## Próximos dados necessários

Conta e chave Sandbox configuradas privadamente; token exclusivo de webhook; habilitação BaaS e playbook Asaas; empresa/titular responsável por cada BIA; recursos/limites/taxas do contrato; homologação das jornadas antes de liberar produção. Nenhum documento pessoal real é necessário para desenvolver esta base.

## Fontes oficiais

- Autenticação: https://docs.asaas.com/docs/authentication-2
- Webhooks: https://docs.asaas.com/docs/sobre-os-webhooks
- Idempotência de eventos: https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks
- BaaS/subcontas: https://docs.asaas.com/docs/creating-baas-subaccounts

## Verificação

Testes cobrem configuração sem herança, bloqueio produção/operações, transporte simulado, token, evento duplicado, isolamento, autorização, consulta sem escrita, estados e idempotência em banco isolado. Não houve criação de conta, cobrança, transferência ou comunicação real com o Asaas.
