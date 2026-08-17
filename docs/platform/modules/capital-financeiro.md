# Capital e Financeiro da BIA

## Objetivo e usuarios

Controla Banco da BIA, documentos bancarios, lancamentos, pagamentos, valor de origem, DM/CPP, cotas e analises financeiras.

## Telas e URLs

- `/bias/:id?tab=capital&capital=banco|documentos|financeiro|analises|calculadora`.
- `/movimentacao-cotas/:biaId`.
- Paginas legadas redirecionadas: `/fluxo-caixa`, `/resultados`, `/bias-calculadora`, `/nucleo-capital`.
- Implementacao principal em `client/src/pages/bia-detalhe.tsx`, `client/src/pages/fluxo-caixa.tsx`, `client/src/pages/resultados.tsx`, `client/src/pages/bias-calculadora.tsx`, `client/src/pages/nucleo-capital.tsx` e `client/src/pages/movimentacao-cotas.tsx`.

## APIs

- `/api/fluxo-caixa*`, categorias, tipos de CPP e anexos.
- `/api/bias/:id/aportes`, `/info-comercial`, `/banco*`.
- Endpoints de percentuais/DM, valor de origem, cotas, transferencias, cobrancas e Pinbank.

## Dados e fontes de verdade

- Directus `fluxo_caixa`, `bias_projetos`, `Categorias` e `Tipos_CPP`.
- PostgreSQL `fluxo_caixa`, `tipos_cpp`, `categorias`, `transferencias_cotas`, `bia_info_comercial` e operacao bancaria.
- Cards, calculadora, analises e PDF sao consumidores; nao podem definir formulas independentes.

## Papeis e permissoes

- Visualizacao/edicao dependem do papel e da matriz `bia_user_permissions`.
- Operacoes financeiras exigem autorizacao no backend e registro do autor.
- Excecao de superadmin para DM abaixo de 1%, inclusive zero, deve ser explicita e testada.

## Calculos e invariantes

- Dinheiro permanece numerico; formatacao acontece na borda.
- Zero explicito e valor valido e nao pode disparar fallback para range/default.
- DM/CPP usa um helper unico em calculadora, visao geral, analises e geracao de lancamentos.
- Valor de origem preserva parcelas pagas ou com evidencia ao recalcular cronograma.
- Entradas, saidas, saldo, custo total e indicadores por m2 devem declarar formula e base temporal.
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
- Ao alterar: reconciliar manualmente o mesmo caso em calculadora, visao geral, financeiro e analises; testar zero, arredondamento, status e repeticao de webhook.
