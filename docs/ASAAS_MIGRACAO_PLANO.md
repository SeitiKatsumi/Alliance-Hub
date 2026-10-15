# Migração do Banco da BIA para Asaas

Data: 14/10/2026. Plano inicial de implementação, baseado no código local e na documentação oficial consultada nesta data.

## Situação atual

A retirada da integração operacional Pinbank foi implementada no código local: cliente legado, adaptadores DEV/produção, rotas, painel administrativo, formulários KYC e ações de conta/cobrança removidos. Banco da BIA oferece apenas consulta histórica autorizada. URLs operacionais antigas retornam 410 após verificar autenticação e acesso; nenhuma operação é apresentada como concluída.

Tabelas, migrações aplicadas, termos aceitos, documentos, valores e IDs antigos permanecem como histórico. Não há conversão de conta, pagamento ou aceite para Asaas. O estado externo de operações ainda abertas deverá ser conciliado antes do corte em produção. O código retirado pode ser recuperado pelo histórico Git. Credenciais e configurações de produção não foram alteradas nesta etapa.

Já existe Asaas em `server/routes.ts`: checkout de Plano Empresa, criação de boleto de fluxo de caixa e webhook de pagamentos; `client/src/pages/pagamento.tsx` usa links de cobrança de anuidade e o fluxo de anúncios possui links próprios. Isso não comprova homologação de todos esses fluxos. A nova camada deverá consolidá-los, sem criar um segundo processamento concorrente de pagamentos.

Stripe internacional permanece no escopo existente. Este plano substitui Pinbank por Asaas; uma eventual retirada do Stripe é uma decisão separada.

## 1. Conta e desenho da operação

Atualização de 14/10: o usuário forneceu orientação do Asaas confirmando subconta individual por SPE/holding/CNPJ, com saldo, extrato e eventos próprios. A base foi preparada para vínculo das BIAs à conta da empresa responsável, sem provisionar subcontas. BaaS é o objetivo escolhido; habilitação/condições de produção ainda serão fornecidas. Fundação local descrita em `docs/ASAAS_BASE.md`.

- Definir quem recebe cada cobrança: conta da plataforma para receitas BUILT, conta da empresa/BIA para caixa do projeto.
- Confirmar titularidade CNPJ da conta-pai, modalidade de subcontas, habilitação BaaS e condições do contrato Asaas.
- Determinar se cada BIA terá subconta ou se BIAs da mesma empresa compartilharão uma conta; registrar decisão antes de implementar abertura automática.
- Inventariar contas, saldos, documentos, boletos, links, splits, intenções e pagamentos pendentes do provedor anterior. Classificar liquidado, pendente, desconhecido, cancelado e estornado.
- Identificadores antigos não são reutilizados como IDs Asaas. Não recriar cobrança enquanto a anterior puder receber pagamento.
- Saída: mapa conta/BIA/empresa, responsável, pendências antigas e critérios de corte aprovados.

## 2. Fundação e isolamento dos ambientes

- Criar módulo Asaas separado das regras de domínio, com cliente HTTP, autenticação somente no servidor, User-Agent, timeout, tratamento de erros, validação JSON e respostas públicas mínimas.
- Separar Sandbox/produção em credenciais, contas, IDs e armazenamento; ausência de configuração bloqueia operações. Nenhum fallback de credencial entre ambientes.
- Persistir intenção de operação, chave interna de idempotência, hash do pedido, ambiente, conta, BIA e executor antes de chamar o provedor.
- Definir como reconciliar timeout com resultado desconhecido antes de repetir POST. Não presumir suporte a cabeçalho de idempotência sem confirmar o endpoint oficial.
- Guardar chaves de subcontas criptografadas ou em cofre; nunca retornar apiKey ao navegador. Registrar apenas eventos sem tokens/PII.
- Saída: testes de configuração, isolamento, timeout e concorrência aprovados; status de configuração administrativo sem exposição de segredos.

## 3. Pagadores e cobranças

- Implementar cadastro/consulta de clientes pagadores, com CPF/CNPJ, contato e endereço mínimos exigidos por modalidade. Cliente pagador não é subconta nem participante da BIA.
- Consolidar anuidade, Plano Empresa/upgrade, anúncios e cobranças de caixa numa única camada, conservando preços e regras atuais.
- Implementar Pix, boleto, cartão/link e parcelamento conforme prioridade e habilitação. Evitar capturar dados completos de cartão na aplicação; usar jornada autorizada do provedor.
- Persistir customerId, paymentId, externalReference, URL, valor, taxas, valor líquido, vencimento e estado; referência deve permitir correlação segura com entidade e conta corretas.
- Conta pagadora, titular da conta recebedora e ambiente devem ser explícitos. Referência recebida do cliente não autoriza cobrança de outra BIA.
- Validar fase financeira operacional, acesso de edição, natureza de caixa, conciliação e alçadas antes de gerar cobranças. Direitos/propriedade do MAP não geram cobrança; compromissos iniciais não duplicam CPP.
- Saída: cobrança criada uma vez, com valores em centavos e evento conciliado; testes de outro usuário/BIA, repetição e indisponibilidade aprovados.

## 4. Webhooks e conciliação

- Revisar o webhook existente e substituir associações ambíguas por correlação persistida de conta/ambiente/paymentId/entidade. Não ativar pessoa apenas por correspondência de e-mail.
- Validar token oficial, formato, origem lógica da conta, tipo de evento e identificador antes de persistir; limitar tamanho e não registrar payload completo em logs.
- Persistir evento com identificador único antes do processamento; fila com tentativas, estado, erros sanitizados e reprocessamento autorizado.
- Tratar duplicados e eventos fora de ordem, confirmar recebido/liquidado versus somente criado/confirmado e reconciliar estado do provedor quando necessário.
- Atualizar pagamento, anuidade, Plano Empresa, anúncio e fluxo de caixa de forma idempotente. E-mail/notificação devem ocorrer uma vez após o efeito confirmado, com retomada de falha parcial.
- Implementar expiração, cancelamento, reembolso, chargeback e divergências de split. Estorno bancário não é correção de cota/MAP.
- Saída: testes de duplicidade, token ausente/incorreto, conta diferente, reembolso, evento atrasado e falha parcial aprovados.

## 5. Banco da BIA e onboarding

- Implementar criar/vincular subconta, persistindo accountId e walletId próprios, sem usar external_account_id legado como ID Asaas.
- Mapear dados empresariais, representante, renda/faturamento, telefone e endereço conforme modalidade. Validar os campos oficiais atuais, sem reproduzir a lista documental antiga.
- Usar jornada de onboarding e documentação BaaS oficial quando habilitada, ou ativação pelo próprio Asaas para modalidade comum.
- Termos e permissões de compartilhamento novos, versionados, por titular/conta, com executor e evidências; aceite antigo não vale como aceite Asaas.
- Exibir dados incompletos, cadastro enviado, análise, aprovado, recusado e bloqueado a partir de estados confirmados. Não habilitar movimentação pela simples resposta de criação da conta.
- Saída: titularidade e isolamento por BIA testados, dados privados protegidos e onboarding homologado no Sandbox.

## 6. Saldo, extrato, comprovantes e documentos

- Implementar consultas usando credencial da conta correta; leitura permitida aos participantes autorizados da própria BIA, com edição somente a papéis/alçadas existentes.
- Separar saldo do provedor, lançamentos de caixa, recebíveis e participação patrimonial. Falha externa exibe indisponibilidade, nunca saldo zero simulado.
- Conciliar paginação, taxas, liquidação, estornos e saldo disponível versus bloqueado. Importação não pode duplicar lançamento já vinculado.
- Comprovantes e documentos só são baixados com autenticação, acesso à BIA/empresa e recurso autorizado. Exportações têm a mesma autorização.
- Saída: totais conciliados e telas desktop/mobile verificadas, mantendo histórico antigo separado e legível.

## 7. Split, repasses e pagamentos de saída

- Definir beneficiários, walletIds, regra de split, taxa da plataforma e quem absorve taxas antes de automatizar distribuições.
- Split Asaas usa valor líquido da cobrança; valor fixo admite 2 casas e percentual admite 4. Percentuais patrimoniais BUILT mantêm sua precisão original: conversão para o provedor terá regra explícita de arredondamento/resíduo, sem alterar MAP.
- Destinatário deve ter conta Asaas e walletId validado; não incluir a própria carteira emissora no split. Taxas e limites serão confirmados no contrato antes da homologação.
- Implementar transferências Pix/TED entre contas ou para destino bancário somente nas modalidades habilitadas, com validação do destinatário, saldo, confirmação, alçadas, limites e auditoria.
- Incluir pagamento de boleto/despesas, análise/aprovação, comprovantes e status apenas quando endpoint/contrato oferecerem a função; não presumir equivalência de todas as funções Pinbank.
- Saída: preview e confirmação separados, repetição segura, resultado desconhecido conciliado, transferência e estorno testados sem valores reais.

## 8. Assinaturas, administração e notificações

- Implementar renovação e recorrência respeitando membro_anuidades, company_plan_subscriptions e políticas versionadas; congelamento de prazo e suspensão de cobrança continuam independentes.
- Preservar upgrade sem alterar data de renovação. Cancelamento mantém acesso até fim pago; reembolso/chargeback obedecem regras existentes.
- Painel Asaas: estado por ambiente, contas em análise, eventos com falha, operações desconhecidas, reprocessamento autorizado e conciliação. Cadastro de chave permanece no servidor/cofre.
- Atualizar indicadores por provedor/conta/período, distinguindo receita BUILT de caixa das BIAs e histórico legado.
- E-mails, agenda e alertas acompanham estado real de cobrança/conta, com deduplicação; lembretes não criam cobranças extras.
- Saída: fluxos de renovação, acesso e notificações homologados, incluindo consulta sem edição por participantes da BIA.

## 9. Homologação e entrada em produção

- Testar o fluxo completo no Sandbox: conta, pagador, cobrança, pagamento, webhook, conciliação, split, transferência, documento e estorno.
- Testar simultaneidade, falha de banco, resposta HTML/JSON inválida, timeout, conta/BIA incorreta e retomada sem duplicação.
- Conferir desktop/mobile e autenticação com perfis distintos; manter controles financeiros bloqueados até cada capacidade estar homologada.
- Reconciliar carteira antiga e estabelecer corte por conta/BIA; suspender novas emissões antigas sem apagar recebíveis. Operações pendentes não são recriadas automaticamente.
- Preparar configuração de produção, callbacks/webhooks, alertas, backup, migrações aditivas, piloto e rollback que preserve eventos/valores.
- Remover/revogar credenciais antigas e desligar callbacks no ambiente antigo após conciliação e corte verificados.
- Saída: piloto validado e publicação controlada. Nenhuma transferência, emissão real, migração de banco ou deploy foi executada nesta entrega inicial.

## Próxima etapa

Começar pela decisão conta da plataforma versus subconta por BIA/empresa e pela fundação isolada em Sandbox. Só então ampliar as cobranças existentes e consolidar os webhooks. Não liberar saldo/extrato/transferências antes de definir a conta titular e suas permissões.

## Fontes oficiais consultadas

- Visão geral: https://docs.asaas.com/docs/visao-geral
- Sandbox: https://docs.asaas.com/docs/sandbox
- Subcontas: https://docs.asaas.com/docs/creating-subaccounts
- Criar subconta: https://docs.asaas.com/reference/criar-subconta
- Split: https://docs.asaas.com/docs/payment-split-overview

Campos, habilitações, eventos e contratos específicos deverão ser confirmados novamente ao implementar cada etapa. O inventário de código não substitui a conciliação das operações reais no provedor.
