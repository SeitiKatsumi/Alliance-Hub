# Pagamentos e Integracoes Externas

- Cobranças de aportes (2026-10-19): adaptador `server/contribution-billing-provider.ts` usa o ambiente selecionado com timeout, sem retry cego de POST e credencial cifrada própria da SPE aprovada/wallet validada. Opt-ins de cobrança e Produção são separados. Webhook agenda consulta autoritativa; legado ignora prefixo built:contribution:. Contrato: [CONTRIBUTION_BILLING.md](../../CONTRIBUTION_BILLING.md).

## Objetivo e usuarios

Centraliza provedores de pagamento, conta bancaria, IA, e-mail, mapas, Directus e armazenamento. Integracoes sao adaptadores; regras de negocio permanecem no dominio da plataforma.

## Telas e URLs

- `/pagamento/:token` e `/pagamento/sucesso`.
- Banco/Capital dentro de `/bias/:id?tab=capital`.
- Configuracoes e monetizacao em `/admin`.
- Fluxos de IA aparecem em Aura, Carteira e Financeiro.

## APIs e provedores

- Base Asaas isolada em `server/asaas/`: criação/vínculo de subconta, saldo, cobranças de aportes, transferências Pix/entre contas vinculadas e webhooks, com credenciais próprias por ambiente e sem herança das antigas. Produção exige opt-in adicional e configuração completa. Detalhes em `docs/ASAAS_BASE.md`.
- `GET /api/admin/asaas/status`: admin/superadmin ativo, nunca funcionário. `GET /api/bias/:biaId/banco/asaas/status`: `capital_banco=view`, ID canônico autorizado. `POST /api/bias/:biaId/banco/asaas/accounts` e `/account/refresh`: `capital_banco=edit`, somente Sandbox. `POST /api/webhooks/asaas/sandbox`: token próprio, persistência/deduplicação sem efeitos financeiros.
- Armazenamento separado em `asaas_sandbox`/`asaas_production`: contas, credenciais cifradas, vínculos BIA, intenções e eventos. A chave da subconta usa AES-256-GCM com chave mestra apenas no ambiente; navegador, API e logs recebem somente o resumo. Consultas não aplicam migração nem escrevem dados; sem estrutura mostram pendência. Nenhum ID/aceite antigo é convertido.

- Anuidade de Membro BUILT de R$ 3.197/ano: Asaas no Brasil e Stripe nos demais paises.
- Plano Empresa de R$ 3.836,40/ano: checkout Asaas ou Stripe; upgrade de membro vigente cobra R$ 639,40 e preserva a data de renovacao.
- PostgreSQL `membro_anuidades` e a fonte de vigencia; `/api/me` separa usuario cadastrado, Membro BUILT, comunidades e permissoes.
- `ends_at` e `current_period_end` sao as datas oficiais de renovacao. `billing_suspended` interrompe novas cobrancas iniciadas pela plataforma e `frozen_at` pausa a contagem sem revogar acesso.
- Banco da BIA em migração para Asaas; adaptadores, painel de homologação e operações do provedor anterior removidos. `server/bia-bank-history.ts` mantém apenas consulta histórica autorizada e bloqueia chamadas operacionais antigas com 410. Abertura/reutilização e consulta de situação da subconta funcionam no Sandbox; onboarding/KYC, saldo, extrato, comprovantes, split, repasses e produção ainda exigem implementação e homologação. Plano: `docs/ASAAS_MIGRACAO_PLANO.md`.
- OpenAI em rotas de audio, texto, arquivo e analise.
- Directus para dados/arquivos; geocodificacao/mapas; SMTP para e-mail.

## Dados e fontes de verdade

- Evento validado do provedor e fonte para estado externo de pagamento.
- Segredo/token existe somente no servidor/ambiente.
- IDs externos sao persistidos junto ao recurso interno para reconciliacao e idempotencia.
- Resultado de IA e proposta ate confirmacao humana.

## Papeis e permissoes

- Endpoint de webhook e publico apenas no transporte: assinatura/origem devem ser validadas.
- Conta, extrato, cobranca e documento bancario exigem acesso a BIA.
- Chaves, payloads integrais e respostas com PII nao sao enviados ao cliente nem registrados em log.
- Abertura de subconta exige CNPJ válido, confirmação explícita de Sandbox e acesso `capital_banco=edit`; consulta por CNPJ evita duplicidade, uma tentativa inconclusiva nunca é repetida automaticamente e a chave retornada é cifrada antes do vínculo.

## Estados e transicoes

- Anuidade: pending, active, expired, canceled, refunded ou disputed. Cancelamento preserva acesso ate o fim pago; reembolso/chargeback encerra vigencia.
- Plano Empresa: disponivel, pagamento_pendente, ativo, reembolsado ou chargeback. Ativacao ocorre somente por webhook confirmado e idempotente.
- Ao retomar um prazo congelado, a data de renovacao avanca exatamente pelo tempo pausado; suspender cobranca e congelar prazo sao controles independentes.
- Integracao: nao configurada, configurada, degradada ou indisponivel.
- IA: recebida, processando, proposta, confirmada ou falhou.

## Invariantes

- Banco da BIA distingue aprovação cadastral da conta e habilitação dos recursos na plataforma. Após vínculo, Próximos passos informa pendências sanitizadas de configuração, caminho dos aportes, permissões e restrições de fase sem criar cobranças ou liberar operações. `integrationPending` é campo aditivo opcional no status da BIA; clientes/servidores anteriores continuam compatíveis. Atualizar situação tem loading, timeout de consulta, resultado inline acessível com hora da consulta ao provedor e mensagem explícita quando o estado não mudou. Resposta inválida/falha preserva os dados anteriores e não afirma nova aprovação; erro na revalidação de configuração é informado separadamente.

- SMTP aplica preferências somente a categorias opcionais, mantendo recuperação de senha e mensagens essenciais de pagamento/termos/acesso. Lembrete de vencimento é opcional em Agenda e registra supressão sem afirmar entrega nem repetir a fila. Nenhum ajuste de webhook, cobrança, pagamento ou provedor financeiro nesta mudança.

- A cobranca bancaria vinculada a lancamento valida a BIA, natureza de caixa e conciliacao antes de chamar o provedor, serializada por BIA. Propriedade e direitos do MAP Zero nao geram cobranca; esta entrega nao modifica precos, repasses ou monetizacao existentes.

- Aprovar a Aura de um `onboarding_inicial` nao cria cobranca; a anuidade nasce apenas no fluxo posterior de `associacao_completa`.
- Webhook e reprocessamento sao idempotentes.
- Planos gratuitos legados sao marcados para migracao e preservam o acesso ate adesao explicita ou corte administrativo comunicado.
- Timeout/falha externa nao vira sucesso local silencioso.
- Retentativa usa o mesmo identificador quando a operacao for a mesma.
- Upload valida autenticacao, autorizacao, tamanho, MIME e propriedade.
- A plataforma continua com mensagem acionavel quando servico opcional esta indisponivel.
- Falha na leitura do histórico bancário retorna 503, nunca lista vazia simulando ausência de registros. Consulta usa ID autorizado da BIA e projeção mínima; payloads do provedor e documentos pessoais permanecem privados.
- Migrações antigas, termos aceitos e registros financeiros do provedor anterior permanecem como evidência histórica. Nenhuma exclusão de dados, conversão de IDs, cancelamento externo ou transferência real acontece nesta etapa.

## Efeitos e dependencias

- Afeta Acesso, Capital, Carteira, Aura, Documentos, Agenda e Administracao.
- Mudanca de contrato externo exige versao, compatibilidade e teste de erro/timeout.

## Testes e impacto

- `server/aura-audio.test.ts`
- `server/valor-origem-sync.test.ts`
- `server/bia-bank-history.test.ts`
- `server/asaas/foundation.test.ts` e `client/src/components/asaas-status.test.ts`.
- Testes de webhook/idempotencia devem ser adicionados antes de alterar cobrancas.
- Ao alterar: testar sucesso, timeout, resposta invalida, repeticao, assinatura ausente, arquivo malformado e provedor indisponivel.
