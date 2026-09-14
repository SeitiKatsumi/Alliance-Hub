# Capital e Financeiro da BIA

## Objetivo e usuarios

Controla Banco da BIA, documentos bancarios, lancamentos, pagamentos, valor de origem, DM/CPP, cotas e analises financeiras.

## Telas e URLs

- `/bias/:id?tab=capital&capital=banco|documentos|financeiro|analises|calculadora`.
- `/movimentacao-cotas/:biaId`.
- BUILT Capital nao e mais ambiente de navegacao; URLs `/built-capital*` redirecionam para Agenda/Chamadas de Capital sem apagar dados historicos.
- Paginas legadas redirecionadas: `/fluxo-caixa`, `/resultados`, `/bias-calculadora`, `/nucleo-capital`.
- Implementacao principal em `client/src/pages/bia-detalhe.tsx`, `client/src/pages/fluxo-caixa.tsx`, `client/src/pages/resultados.tsx`, `client/src/pages/bias-calculadora.tsx`, `client/src/pages/nucleo-capital.tsx` e `client/src/pages/movimentacao-cotas.tsx`.

## APIs

- `/api/fluxo-caixa*`, categorias, tipos de CPP e anexos.
- `/api/bias/:id/aportes`, `/info-comercial`, `/banco*`.
- Chamadas de capital geram tarefas deduplicadas para finalidade `capital` e/ou contribuicao `Aporte Financeiro`.
- Saidas agendadas geram um unico lembrete por e-mail dois dias corridos antes do vencimento para o responsavel do lancamento ou, sem ele, para o Diretor de Capital.
- Endpoints de percentuais/DM, valor de origem, cotas, transferencias, cobrancas e Pinbank.

## Dados e fontes de verdade

- Directus `fluxo_caixa`, `bias_projetos`, `Categorias` e `Tipos_CPP`.
- PostgreSQL `fluxo_caixa`, `tipos_cpp`, `categorias`, `transferencias_cotas`, `bia_info_comercial` e operacao bancaria.
- Cards, calculadora, analises e PDF sao consumidores; nao podem definir formulas independentes.

## Papeis e permissoes

- Visualizacao/edicao dependem do papel e da matriz `bia_user_permissions`.
- Operacoes financeiras exigem autorizacao no backend e registro do autor.
- Exclusao em lote aguarda todos os resultados, atualiza a lista mesmo com falhas e mantém selecionados os itens nao excluidos. A interface informa os totais e o motivo devolvido pela API; itens protegidos exigem uma segunda confirmação explícita (`confirmar_exclusao_protegida: true`). A API revalida a autorização e registra autor, snapshot e confirmação no histórico antes da exclusão. Cancelar a segunda confirmação preserva esses itens; exclusão não cancela cobranças nem estorna pagamentos externos.
- Excecao de superadmin para DM abaixo de 1%, inclusive zero, deve ser explicita e testada.

## Calculos e invariantes

- Dinheiro permanece numerico; formatacao acontece na borda.
- Zero explicito e valor valido e nao pode disparar fallback para range/default.
- DM/CPP usa um helper unico em calculadora, visao geral, analises e geracao de lancamentos.
- Valor de origem preserva parcelas pagas ou com evidencia ao recalcular cronograma.
- Entradas, saidas, saldo, custo total e indicadores por m2 devem declarar formula e base temporal.
- O MAP revalida `fluxo_caixa` ao abrir ou retomar foco e considera como aporte somente a entrada vinculada a membro com status `pago`; pendente, agendado, parcial, vencido ou cancelado nao altera cotas.
- A analise de preco por m2 valida o raio real de 20 km; quando o endereco completo nao e reconhecido, tenta bairro/cidade, cidade/estado e CEP cadastrados, sem dispensar a verificacao geografica.
- No mobile, a navegacao do Capital permite rolagem horizontal sem sobrepor rotulos, os indicadores financeiros refluem sem cortar valores e cada lancamento aparece como cartao legivel; no desktop, a lista permanece em tabela.
- O PDF do MAP usa a logomarca horizontal oficial e cabecalho branco, sem tarja ou fundo carregado, para preservar legibilidade e economia na impressao.
- Transferencia de cotas totaliza exatamente 100%, com precisao definida e destinatarios pertencentes a BIA.
- Webhook/cobranca e idempotente.

## Estados e transicoes

- Lancamento: nao definido, pendente, agendado, pago ou vencido, com historico.
- Documento bancario: ausente, enviado, em analise, aprovado, substituido/rejeitado.
- Transferencia: solicitada, aprovada/rejeitada e concluida.

## Efeitos e dependencias

- Pode gerar cobranca, anexo, notificacao, aprovacao, PDF/comprovante e atualizacao de dashboards.
- Depende de BIA, Perfis, Documentos, Pagamentos, Agenda e Administracao.

## Testes e impacto

- `server/valor-origem-sync.test.ts`
- `server/bia-origin-value.test.ts`
- `server/quota-transfer.test.ts`
- `server/market-comparables.test.ts`
- `server/payment-reminders.test.ts`
- `shared/member-portfolio.test.ts`
- `client/src/pages/fluxo-caixa-mobile.test.ts`
- Ao alterar: reconciliar manualmente o mesmo caso em calculadora, visao geral, financeiro e analises; testar zero, arredondamento, status e repeticao de webhook.

- Transferências aceitas podem ter valor e percentual corrigidos pela administração (admin/superadmin), diretor da aliança ou aliado BUILT com acesso de edição ao financeiro da BIA. O membro de origem não corrige a própria transferência, preservando a separação de aprovação. Motivo obrigatório; histórico JSONB registra autor, data, antes/depois no mesmo UPDATE. Controle de concorrência rejeita versão desatualizada. Origem, destino, anexos, status e data original permanecem; MAP/PDF usam o valor corrigido, sem movimentar dinheiro ou alterar o Directus. Migração: `20260915_quota_corrections.sql`.

- A reversão usa as mesmas permissões e histórico da correção, exige motivo e confirmação explícita e altera somente o status da transferência aceita para `revertida`, atomicamente com a auditoria. Reversões não são reaplicáveis nem editáveis; continuam na lista/PDF, fora do cálculo do MAP. Demais transferências são recalculadas pelo motor atual, sem estorno bancário ou exclusão do registro.

- Na lista, a ação única é `Corrigir`. O diálogo contém `Reverter transferência`, com opção de voltar à correção de valores; mudar a opção não envia a operação e exige informar o motivo novamente.
