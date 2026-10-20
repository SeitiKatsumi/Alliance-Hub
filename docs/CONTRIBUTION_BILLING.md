# Aportes e cobranças da BIA

## Estado de homologação — 20/10/2026

Após autorizações específicas, a migração aditiva de cinco tabelas foi aplicada ao banco compartilhado, sem alterar registros existentes. O receptor público Sandbox foi configurado e passou a responder200; app reiniciado com a mesma imagem, sem deploy de código ou habilitação de produção financeira. A informação abaixo sobre migração apenas isolada descreve a entrega original de19/10, não o estado atual.

Criada uma subconta fictícia no Asaas Sandbox, com chave própria somente no .env local ignorado pelo Git. O processador real da aplicação em banco/lançamentos ISOLADOS emitiu um boleto R$10, revisou para R$9 e retornou R$10 mantendo o mesmo pagamento; simulação terminou RECEIVED. Asaas enviou PAYMENT_CREATED, dois PAYMENT_UPDATED e PAYMENT_RECEIVED ao receptor público. O harness encaminhou o evento real ao worker isolado e confirmou 100% recebido, idempotência e interrupção dos avisos. Nenhuma parcela/BIA real, CPP/MAP ou documento foi alterado; fila compartilhada permanece vazia. Não equivale à operação já vinculada em uma BIA do portal.

E-mail/SMS não foram enviados; Agenda foi exercitada isoladamente. O boleto não retornou QR Pix: a modalidade Pix dedicada e SMTP real continuam pendentes de homologação. Flags locais/servidor de emissão não são ligadas automaticamente pelo teste. A subconta fictícia não deve ser usada como conta recebedora de uma BIA real. O teste não cobre produção, transferências, split ou abertura automática de contas.

## Escopo e fontes

Financeiro → Aportes e parcelas conserva cronograma/compromissos originais. O dashboard separado “Acompanhamento dos aportes” foi removido em 20/10/2026; obrigação vigente, conciliação e meios individuais continuam no serviço de cobrança, sem uma tela agregada. Modelo 3 ou posterior, sem conversão de BIAs legadas.

`bia_aportes_parcelas` conserva IDs e valor originalmente comprometido; seus movimentos espelham a obrigação revisada. `bia_contribution_charges` guarda valor corrente em centavos e vínculo ambiente/parcela/conta/pagamento. Directus `fluxo_caixa`, no MESMO ID, recebe valor sincronizado e pagamento recebido. Não cria entrada adicional, CPP, cota, transferência ou versão do MAP. O resumo de integralização original continua referenciado ao compromisso original, distinto da obrigação corrente conciliada pelo serviço.

Rascunhos não emitem. Confirmar/reconciliar prepara intenções somente para capital em dinheiro; propriedade/direitos/pares compensatórios não geram cobrança. Não há backfill em GET. Parcelas já pagas nunca são emitidas novamente. Cronograma com cobranças gerenciadas não pode ser substituído no editor antigo: usar o fluxo financeiro autorizado.

## Acesso e APIs

O dashboard não concede mais acesso financeiro excepcional a todo participante. As rotas obedecem à permissão `capital_financeiro`; convite pendente não é vínculo e funcionário continua sujeito à delegação empresarial de Capital. Falha de permissões bloqueia. Administração conserva bypass existente.

Diretor Capital, Diretor Aliança e Aliado vinculados gerenciam conforme overrides explícitos e fase ativa. Meios privados somente pagador/gestor. Resumo não contém URL externa, Pix, documentos, IDs de conta ou chaves. Respostas `no-store`; logger HTTP não registra corpos dessas rotas.

Base `/api/bias/:id/aportes-iniciais/cobrancas`, com ID/código resolvido pelo backend:

| Método/sufixo | Finalidade |
| --- | --- |
| GET base | Resumo, parcelas vigentes, configuração, histórico |
| GET `/:chargeId/pagamento` | Meios privados da parcela selecionada |
| PUT `/lembretes` | Canais, offsets, forma das novas cobranças; revisão da configuração obrigatória |
| POST `/preparar` | Enfileira cronograma já confirmado |
| POST `/revisoes/previa` | Seleção, data inicial, novo valor/percentual e motivo |
| POST `/revisoes` | Confirmação explícita, hash da prévia, UUID de lote |

Lote idêntico recupera a mesma revisão; mesma chave/outro pedido retorna 409. Prévia desatualizada ou seleção protegida/de outra BIA é recusada. Armazenamento indisponível nunca vira zero. Worker trabalha em ciclos de 60 s.

## Revisões e estados

Somente parcelas futuras, integralmente abertas e em dinheiro. Hoje/vencidas/parciais/com evidência/pagas/confirmadas/processando são protegidas. Arredondamento em centavos por parcela; resultado positivo. Autor/data/motivo/antes/depois/versão e resultado individual persistidos: queued/applied/failed/unknown. Não declarar sucesso integral de lote parcial.

Com cobrança, atualiza primeiro no provedor, lê novamente situação/valor e recupera boleto/Pix; só então aplica valor local e incrementa versão. Recusa bloqueia conservando anterior, sem cancelar/reemitir. Sem cobrança, revisão local pode avançar, mas emissão continua bloqueada até homologação.

Emissão usa referência determinística e marcador durável antes do POST; criação de cliente também possui marcador durável. Timeout/interrupção gera desconhecido: pesquisa referência, nunca repete emissão às cegas. Sem correspondência, requer conciliação operacional, sem apagar marcadores para forçar nova emissão. Escritas Directus/PostgreSQL interrompidas retomam mesmos IDs e revisão, preservando documentos aceitos.

CONFIRMED = confirmado a liquidar; RECEIVED/RECEIVED_IN_CASH = recebido/disponível no acompanhamento. Análise/risco/desconhecido não entram em recebido. Estorno/chargeback após baixa bloqueia para conciliação explícita; não apaga evidência de caixa automaticamente.

Webhook Sandbox valida token/formato, deduplica e agenda conciliação; não aplica payload diretamente ao caixa. Consulta autoritativa usa credencial própria da conta e valida referência/pagador/valor/vencimento/wallet. Payloads atrasados não revertem estado. Webhook legado ignora `built:contribution:`, impedindo ativação de anuidade por fallback de e-mail. Pagamentos antigos seguem separados.

## Lembretes

Padrão -5/0/+3 dias, primeiro ciclo a partir das 9h America/Sao_Paulo, com recuperação no mesmo dia após reinício; aplicação precisa estar executando. Não há envio retroativo de dias perdidos. Gestor configura canais/offsets (-30 a +30, até dez) e PIX/BOLETO para novas cobranças.

Somente pagador recebe. E-mail passa pela preferência `bia` (opt-out/falha suprime opcionais); Agenda independente. Cliente Asaas exclusivo da integração possui notificações do provedor desativadas; não altera clientes legados arbitrários.

Fila persistente por parcela/versão/momento/canal. Antes de enviar revalida obrigação/fase/moeda/conta/situação/valor/vencimento remoto e recupera os meios atuais. Sem cobrança real/link não envia. Pagas/canceladas/revisando/bloqueadas não recebem lembrete desatualizado. Não inventa Pix. Agenda usa ID da notificação, vínculo de origem à parcela e link BIA; baixa conclui tarefa. SMTP incerto fica unknown, sem repetição cega; Agenda retoma pelo mesmo ID. D-2 antigo é substituído SOMENTE para movimentos gerenciados.

## Migração e habilitação Sandbox

Migração aditiva `migrations/20261019_contribution_billing.sql`, cinco tabelas, sem alterar IDs atuais; cobranças/revisões isoladas por ambiente. Validada duas vezes em PGlite isolado, NÃO aplicada ao remoto/produção nesta entrega. Não usar db:push como substituto.

1. Aplicar migração autorizada no ambiente de homologação, após backup/migrações anteriores de aportes/Asaas.
2. Criar ou vincular a BIA à conta aprovada da SPE/holding no esquema do ambiente. O fluxo grava external_account_id, wallet_id e a credencial cifrada no cofre; BIAs da mesma empresa podem compartilhar a conta. Nunca usa a conta BUILT como fallback.
3. Configurar privadamente ASAAS_SANDBOX_ACCOUNT_<REFERENCIA> com a chave própria. `/wallets` e `/myAccount/status` validam conta antes de operar.
4. Token/chave/cofre próprios do ambiente e opt-ins ASAAS_BASE_ENABLED, ASAAS_BAAS_ENABLED e ASAAS_CONTRIBUTIONS_ENABLED. Produção também exige ASAAS_PRODUCTION_OPERATIONS_ENABLED. Flags são false por padrão e não substituem aprovação comercial/regulatória do Asaas.
5. Webhook público `/api/webhooks/asaas/sandbox`, token exclusivo, eventos de cobrança incluindo PAYMENT_UPDATED; validar entrega/retomada com dados fictícios.
6. Homologar emissão/revisão/recebimento, repetidos/atrasados, recusa, timeout e opt-out. Só então aprovar operação assistida.

Produção usa credenciais/cofre próprios e exige `ASAAS_PRODUCTION_OPERATIONS_ENABLED=true`, além do opt-in de cobranças; nunca herda a chave global legada. A credencial cifrada criada na abertura da subconta é a fonte da operação. Transferências possuem fluxo separado no Banco; split/WhatsApp/índice automático continuam fora deste módulo. Nunca incluir credenciais reais em Git/log/relatório.

## Validação

server/contribution-billing.test.ts: domínio, migração idempotente isolada, conta divergente, resposta perdida em emissão/alteração, não duplicação, privacidade, webhook/baixa, lote parcial, SMTP incerto, APIs e ausência do dashboard removido. Complementar com suíte integral, contrato/build e baseline TypeScript.

Não há QA visual do acompanhamento porque a tela agregada foi removida. A homologação financeira continua exigindo conta autorizada e validação operacional do serviço.

Referências oficiais: [atualização](https://docs.asaas.com/reference/atualizar-cobranca-existente), [boleto](https://docs.asaas.com/docs/cobrancas-via-boleto), [eventos](https://docs.asaas.com/docs/webhook-para-cobrancas), [clientes](https://docs.asaas.com/docs/criando-um-cliente), [wallet](https://docs.asaas.com/reference/recuperar-walletid), [cadastro](https://docs.asaas.com/reference/consultar-situacao-cadastral-da-conta).
