# Pagamentos e Integracoes Externas

## Objetivo e usuarios

Centraliza provedores de pagamento, conta bancaria, IA, e-mail, mapas, Directus e armazenamento. Integracoes sao adaptadores; regras de negocio permanecem no dominio da plataforma.

## Telas e URLs

- `/pagamento/:token` e `/pagamento/sucesso`.
- Banco/Capital dentro de `/bias/:id?tab=capital`.
- Configuracoes e monetizacao em `/admin`.
- Fluxos de IA aparecem em Aura, Carteira e Financeiro.

## APIs e provedores

- Anuidade de Membro BUILT de R$ 3.197/ano: Asaas no Brasil e Stripe nos demais paises.
- Plano Empresa de R$ 3.836,40/ano: checkout Asaas ou Stripe; upgrade de membro vigente cobra R$ 639,40 e preserva a data de renovacao.
- PostgreSQL `membro_anuidades` e a fonte de vigencia; `/api/me` separa usuario cadastrado, Membro BUILT, comunidades e permissoes.
- Pinbank em `server/pinbank-client.ts`: onboarding, documentos, conta, saldo, extrato e cobrancas.
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

## Estados e transicoes

- Anuidade: pending, active, expired, canceled, refunded ou disputed. Cancelamento preserva acesso ate o fim pago; reembolso/chargeback encerra vigencia.
- Plano Empresa: disponivel, pagamento_pendente, ativo, reembolsado ou chargeback. Ativacao ocorre somente por webhook confirmado e idempotente.
- Integracao: nao configurada, configurada, degradada ou indisponivel.
- IA: recebida, processando, proposta, confirmada ou falhou.

## Invariantes

- Webhook e reprocessamento sao idempotentes.
- Planos gratuitos legados sao marcados para migracao e preservam o acesso ate adesao explicita ou corte administrativo comunicado.
- Timeout/falha externa nao vira sucesso local silencioso.
- Retentativa usa o mesmo identificador quando a operacao for a mesma.
- Upload valida autenticacao, autorizacao, tamanho, MIME e propriedade.
- A plataforma continua com mensagem acionavel quando servico opcional esta indisponivel.

## Efeitos e dependencias

- Afeta Acesso, Capital, Carteira, Aura, Documentos, Agenda e Administracao.
- Mudanca de contrato externo exige versao, compatibilidade e teste de erro/timeout.

## Testes e impacto

- `server/aura-audio.test.ts`
- `server/valor-origem-sync.test.ts`
- Testes de webhook/idempotencia devem ser adicionados antes de alterar cobrancas.
- Ao alterar: testar sucesso, timeout, resposta invalida, repeticao, assinatura ausente, arquivo malformado e provedor indisponivel.
