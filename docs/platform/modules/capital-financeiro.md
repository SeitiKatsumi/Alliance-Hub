# Capital e Financeiro da BIA

- Nova BIA preenche Equipe + DM em fichas unicas por participante; MAP Zero e somente a previa automatica expansivel, sem outro formulario/aba durante a criacao. `MapZeroFields` e compartilhado com a Calculadora; POST e PUT mantem a mesma validacao/calculo no backend. DM total e a soma dos indices individuais, distinta da participacao final; totais parciais nao representam composicao concluida. Capital comprometido e natureza sao preservados sem conversao pelo peso arredondado. Criar a BIA com MAP completo grava base e revisao juntas, sem lancamentos financeiros; aportes e parcelas permanecem em etapa separada. Apos criar, MAP Zero, MAP Atual e Historico continuam em Capital; MOU/aceites e BIAs antigas nao mudam.

## Objetivo e usuarios

Controla Banco da BIA, documentos bancarios, lancamentos, pagamentos, valor de origem, DM/CPP, cotas e analises financeiras.

## Telas e URLs

- Capital exibe **DM** (chaves tecnicas `capital=calculadora` e `capital_calculadora` preservadas). Novas BIAs exibem referencia do Valor de Origem, DM total/equivalente e uma linha/cartao por pessoa com unico indice editavel. Salvar DM reutiliza a composicao e revisao de origem; CPP positiva sem classificacao bloqueia salvar e orienta MAP Zero, sem inferencia automatica.
- `/movimentacao-cotas/:biaId?view=atual|zero|historico`: MAP Atual e entrada padrao, preservando mapa e movimentacoes. MAP Zero inicia em leitura; Editar composicao reutiliza o formulario e salvamento de DM. Comparacao e expansivel; Historico conserva versoes/PDFs. BIAs legadas nao recebem base retroativa.
- Financeiro abre em Lancamentos; `capital=financeiro&financeiro=aportes` abre Aportes e parcelas somente no modelo 3. O componente de cronogramas existe apenas aqui. O link antigo `capital=calculadora#aportes-iniciais` redireciona para esta secao.
- DM, composicao e cronogramas preservam alteracoes locais durante revalidacao. Navegar/sair com rascunho exige confirmacao; gravar usa a revisao capturada antes da edicao para preservar conflitos 409, nao a revisao recebida em segundo plano. Permissoes e motivos obrigatorios continuam validados pelo backend.

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
- Para BIAs novas, `GET|PUT /api/bias/:id/map-inicial` mantem o rascunho/snapshot e `GET /api/bias/:id/map` retorna o MAP atual oficial. BIAs anteriores sem snapshot continuam nos endpoints e campos legados.

## Dados e fontes de verdade

- Directus `fluxo_caixa`, `bias_projetos`, `Categorias` e `Tipos_CPP`.
- PostgreSQL `fluxo_caixa`, `tipos_cpp`, `categorias`, `transferencias_cotas`, `bia_info_comercial`, `bia_map_inicial_snapshots` e operacao bancaria.
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
- Com snapshot, Visao geral e Analises usam `initialMapEconomicSummary` (DM, CPPs e BEI capturados), nunca `perc_*` legado. Analises consulta o detalhe autorizado e bloqueia indicadores enquanto carrega ou falha; sem snapshot preserva o calculo legado.
- A revalidacao do MAP no Financeiro depende de `dataUpdatedAt` das fontes, nao de arrays vazios criados em cada render. Consultas pendentes nao geram loop de invalidacao; erro de transferencias nao e resposta vazia bem-sucedida.
- Em BIAs novas, cada identidade aparece uma vez mesmo com varios cargos: `DM = soma dos indices`, `CPP de Origem = Valor de Origem x indice`, `CPP de Capital = Valor de Origem x peso do Guardiao`, `BEI = Valor de Origem + soma dos CPPs de Origem` e `MAP Inicial = CPP Total / BEI`. Pesos dos Guardioes totalizam 100%; Multiplicador tem peso zero.
- MAP Zero e o nome publico da base (`map-inicial` permanece tecnico). Estruturacao permite revisoes por quem configura a BIA; depois da ativacao somente Diretor da Alianca ou Aliado BUILT vinculados podem corrigir individualmente, com motivo. Administracao isolada nao concede essa permissao.
- Cada mudanca efetiva cria versao imutavel em `bia_map_versoes`: MAP Zero revisao N para a base, MAP N para o atual. Consultar, exportar, repetir evento ou salvar sem mudanca nao cria versao. `revisaoEsperada` incorreta retorna `409`; operacoes concorrentes serializam pela BIA.
- Revisao durante a estruturacao exige novos aceites de todos os signatarios; a ativacao exige a revisao vigente. Correcao apos ativacao notifica os participantes, recalcula imediatamente o MAP atual e nao exige novos aceites. Evidencias antigas preservam texto, hash, identidade, horario e dados capturados.
- O MOU padrao inclui apenas a revisao apresentada do MAP Zero, sem nota dinamica. PDFs historicos usam somente o snapshot armazenado; MAPs posteriores incluem a nota de vinculacao ao MOU. Historico, detalhe e PDF: `/api/bias/:id/map/versoes`, `/:versionId`, `/:versionId/pdf`, sempre com acesso a BIA validado.
- Lancamentos Directus e transferencias aceitas/corrigidas/revertidas atualizam o historico no ponto compartilhado de escrita. `bia_map_eventos` guarda intents duraveis para conciliar uma interrupcao entre Directus e PostgreSQL, antes da proxima escrita ou pelo ciclo de recuperacao de 60 segundos (nao e fechamento mensal). Falha de leitura nao vira zero; correcao incompativel com transferencias e recusada antes de gravar.
- Migracao aditiva `20260918_map_zero_versions.sql`, equivalente ao bootstrap de runtime. Nao ha backfill: snapshots anteriormente assinados sao arquivados integralmente antes da primeira alteracao; BIAs sem snapshot continuam legadas.
- Salvar/revisar o MAP Zero nao gera lancamentos. A acao separada Confirmar cronogramas gera parcelas agendadas. Integralizacao inicial (inclusive reversao) nunca soma ou subtrai a CPP ja reconhecida; somente aportes adicionais elegiveis pagos e transferencias aceitas alteram o MAP Atual.
- Valor de origem preserva parcelas pagas ou com evidencia ao recalcular cronograma.
- Entradas, saidas, saldo, custo total e indicadores por m2 devem declarar formula e base temporal.
- O MAP revalida `fluxo_caixa` ao abrir ou retomar foco e considera somente aportes adicionais elegiveis vinculados a membro com status `pago`; integralizacao inicial, nao caixa, pendente, agendado, parcial, vencido ou cancelado nao acrescenta cotas.
- A analise de preco por m2 valida o raio real de 20 km; quando o endereco completo nao e reconhecido, tenta bairro/cidade, cidade/estado e CEP cadastrados, sem dispensar a verificacao geografica.
- No mobile, a navegacao do Capital permite rolagem horizontal sem sobrepor rotulos, os indicadores financeiros refluem sem cortar valores e cada lancamento aparece como cartao legivel; no desktop, a lista permanece em tabela.
- O PDF do MAP usa a logomarca horizontal oficial e cabecalho branco, sem tarja ou fundo carregado, para preservar legibilidade e economia na impressao.
- Transferencia de cotas totaliza exatamente 100%, preserva valores e percentuais com cinco casas decimais e exige destinatarios pertencentes a BIA. O rateio por percentual conserva o total mesmo abaixo de um centavo por destinatario; valores zerados nao podem ser gravados.
- Webhook/cobranca e idempotente.

## Estados e transicoes

- Modelo 3, apenas novas BIAs: valores comprometidos fecham exatamente o Valor de Origem em cinco casas; pesos sao derivados e nao recalculam capital. Cada componente captura `Tipos_CPP` escolhido na estruturacao, sem inferencia pelo cargo. Natureza dinheiro ou nao caixa tambem e explicita; ausente nao equivale a zero.
- `bia_aportes_iniciais` e `bia_aportes_parcelas` no PostgreSQL guardam cadastros, revisoes, parcelas, pares e IDs estaveis. Directus `fluxo_caixa` executa movimentos e evidencias. Migracao aditiva `20260918_initial_contributions.sql`; snapshots existentes permanecem modelo 1, sem reclassificacao ou backfill.
- `GET|PUT /api/bias/:id/aportes-iniciais`, `POST /confirmar` e `PATCH /parcelas/:parcelaId`: acesso de Capital/Financeiro no backend; salvar exige revisao esperada e revisao vigente do MAP. Corrigir a base continua com as permissoes adicionais de Diretor/Aliado apos ativacao.
- Cronogramas do ativo, capital e contribuicao economica separados; modalidade nao presume credito aprovado. Series nominais em centavos, residuo na ultima parcela, vencimento limitado ao ultimo dia do mes. Data anual ausente exige preenchimento. Sem IGP-M automatico.
- Estado rascunho → pendente de conciliacao → confirmado. Intent local precede escrita no Directus; retomada pelos mesmos IDs nao duplica. Falha retorna 503/pendente, sem sucesso parcial. Pagamento recebido durante retomada nunca e substituido por agendado.
- Intents preservam IDs canonicos de categorias e CPPs. Na criacao/replay no Directus, a borda converte esses IDs para objetos de juncao (`categorias_id` e `tipos_cpp_id`), sem substituir IDs de parcelas ou movimentos ja persistidos.
- Direitos geram par compensatorio entrada/saida, integralizado ou revertido conjuntamente. Propriedade e direitos sao patrimoniais sem caixa: excluidos de saldos, entradas/saidas efetivas, lembretes de pagamento e cobrancas bancarias. Metadata e obtida pelo ID da parcela, nunca pela descricao.
- Parcelas pagas, com evidencia ou cobranca emitida sao protegidas. Correcao incompatível e recusada; nenhum estorno bancario automatico. Historico captura identidade, motivo, horario e campos financeiros, sem copiar documentos pessoais.
- Interface: Estruturacao, MAP Zero, Aportes e parcelas, MAP Atual e Historico; layout em cartoes no celular. Valores/tipos capturados tambem alimentam MOU e PDFs; documentos anteriores permanecem intactos.

- Lancamento: nao definido, pendente, agendado, pago ou vencido, com historico.
- Documento bancario: ausente, enviado, em analise, aprovado, substituido/rejeitado.
- Transferencia: solicitada, aprovada/rejeitada e concluida.
- MAP Zero: estruturacao ou base ativa versionada. `status=bloqueado` tecnico sinaliza evidencia de aceite, nao bloqueio definitivo de edicao.

## Efeitos e dependencias

- Pode gerar cobranca, anexo, notificacao, aprovacao, PDF/comprovante e atualizacao de dashboards.
- Depende de BIA, Perfis, Documentos, Pagamentos, Agenda e Administracao.

## Testes e impacto

- `server/migration-runner.test.ts` executa o `migrate.cjs` de produção em PostgreSQL isolado: arquivos SQL inteiros (incluindo `DO $$` e funções), ordem base MAP antes de aportes, idempotência e rollback sem registrar migração incompleta. O executor não divide SQL por ponto-e-vírgula.

- `client/src/pages/dm-map-navigation.test.ts`: separacao, links antigos, zero/CPP ausente, revisao do rascunho, falha segura e protecao de navegacao. Reorganizacao de interface nao modifica formulas, criacao de BIA, persistencia, aceites ou gera lancamentos.

- Cadastro simplificado de Nova BIA usa DM (%) + equivalente calculado pelo mesmo helper do MAP, com tipos Guardiao/Multiplicador explicitos. Guardiao expande valor; mudar para Multiplicador zera so capital (confirmacao se positivo), sem apagar indice ou CPP da contribuicao. Cargos e detalhes patrimoniais ficam recolhidos, mas classificacoes positivas continuam obrigatorias. Edicao da Calculadora existente e contratos financeiros preservados; teste em `shared/member-portfolio.test.ts` cobre equivalencia, zero, precisao e troca de tipo sem restaurar valor antigo.
- A edicao geral de BIA com snapshot nao envia campos de `BIA_MAP_ECONOMIC_FIELDS`; o backend recusa tais campos fora de map-inicial e nao recalcula DM em edicoes nao economicas. Falha na leitura do modelo nao autoriza fallback legado nem salvamento. Regressao em `server/bia-map-creation.test.ts` cobre os campos protegidos, autorizacao, preservacao do MAP e compatibilidade legada.
- `shared/initial-contributions.test.ts`: nove participantes, classificacoes confirmadas, precisao, parcelas, calendario e nao duplicacao de CPP.
- `server/initial-contributions.test.ts`: API real em SQL isolado, concorrencia, falha parcial, retomada, pares, autorizacao e protecao.

- `server/valor-origem-sync.test.ts`
- `server/bia-origin-value.test.ts`
- `server/quota-transfer.test.ts`
- `server/market-comparables.test.ts`
- `server/payment-reminders.test.ts`
- `shared/member-portfolio.test.ts`
- `server/bia-map-history.test.ts` (migracao, imutabilidade, concorrencia, no-op, calculo e permissao).
- `server/bia-map-api.test.ts` (rotas reais em banco isolado, revisao, motivo, falha de fonte, aceites e transferencias incompativeis).
- `client/src/pages/fluxo-caixa-mobile.test.ts`
- Ao alterar: reconciliar manualmente o mesmo caso em calculadora, visao geral, financeiro e analises; testar zero, arredondamento, status e repeticao de webhook.

- Transferências aceitas podem ter valor e percentual corrigidos pela administração (admin/superadmin), diretor da aliança ou aliado BUILT com acesso de edição ao financeiro da BIA. O membro de origem não corrige a própria transferência, preservando a separação de aprovação. Motivo obrigatório; histórico JSONB registra autor, data, antes/depois no mesmo UPDATE. Controle de concorrência rejeita versão desatualizada. Origem, destino, anexos, status e data original permanecem; MAP/PDF usam o valor corrigido, sem movimentar dinheiro ou alterar o Directus. Migração: `20260915_quota_corrections.sql`.

- A reversão usa as mesmas permissões e histórico da correção, exige motivo e confirmação explícita e altera somente o status da transferência aceita para `revertida`, atomicamente com a auditoria. Reversões não são reaplicáveis nem editáveis; continuam na lista/PDF, fora do cálculo do MAP. Demais transferências são recalculadas pelo motor atual, sem estorno bancário ou exclusão do registro.

- Na lista, a ação única é `Corrigir`. O diálogo contém `Reverter transferência`, com opção de voltar à correção de valores; mudar a opção não envia a operação e exige informar o motivo novamente.
