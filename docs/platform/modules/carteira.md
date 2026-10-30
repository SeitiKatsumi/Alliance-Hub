# Carteira Patrimonial

## Pendências patrimoniais acionáveis (26/10/2026)

- Refinamento visual: no atalho de correção, valor de referência vazio/inválido continua amarelo independentemente da situação escolhida (`assetCorrectionFields`). Isso orienta o preenchimento sem alterar a elegibilidade patrimonial: negociação/análise/alienado continuam excluídos do cálculo. Salvar alteração do editor de estrutura é projetado no rodapé fixo da edição em página (Ativos/Jurídico/Orçamento), com a mesma validação, permissão e controle de concorrência; histórico e modo leitura não ganham ação de gravação.

- Ao chegar pelo atalho de um ativo, cada campo pendente recebe contorno e fundo amarelos, em vez de marcar o cartão inteiro. O primeiro campo pendente recebe foco. `missingPatrimonyFields` e `setupPatrimonyAsset` compartilham as regras com o cálculo: situação/valor ausentes e, após aquisição, percentual/dívida inválidos. O destaque some ao corrigir, sem salvar automaticamente. Campos opcionais, demais ativos, criação normal e documentos exportados não recebem marcação; permissões/API/dados permanecem iguais.

- Editor de estrutura e estimativa patrimonial usam `readResolvedBiaSetup`: revisão versionada tem precedência; somente na ausência dela, leem o mesmo cadastro legado (PostgreSQL e campos preenchidos do Directus). Nenhum backfill, duplicação ou gravação na leitura. Uma revisão com ativos removidos não ressuscita o legado.
- Ativo legado com endereço/matrícula é reconhecido, mas não vira propriedade/valor por presunção. Situação ausente e valor ausente geram pendências identificadas pelo nome do ativo. Adquiridos exigem valor, fração e dívida explícitos; zero de dívida é válido. Alienados/em negociação ficam fora do patrimônio sem exigir avaliação para contabilizá-los.
- O aviso amarelo contém detalhes e links de correção por origem: Ativos Vinculados da BIA (`section=ativos&asset=ID`), cadastro do imóvel de origem formal, ou Financeiro. A edição abre na seção e destaca/foca o ativo. Botões exigem permissão de edição da configuração, financeira ou propriedade/administração do imóvel, respectivamente; os endpoints continuam validando autorização. Um link não concede acesso.
- Campos `issues` permanecem compatíveis; `issueDetails` é aditivo e identifica alvo/ID sem endereço/matrícula. Totais, parcelas/CPPs, percentuais MAP, documentos assinados e observações históricas não são regravados. A revalidação existente da Carteira consulta novamente a fonte após a correção.

## Dashboard consolidado, integralização das CPPs e estimativa dos imóveis (23/10/2026)

- Dois blocos: **Imóveis próprios** reúne o total central estimado e o total de aquisição proporcional; **Valor total de CPPs em alianças** reúne `Aportado` e `A aportar`. O painel não exibe faixa mínima/máxima: a estimativa central soma uma estimativa válida por imóvel da carteira. Imóveis já consolidados na BIA e vínculos sem propriedade não são somados como imóveis diretos.
- Para cada BIA nova, `Aportado = CPP atual × percentual integralizado`; o percentual vem dos compromissos do MAP Inicial e considera somente parcelas vigentes, conciliadas e com todos os movimentos oficiais pagos no Directus. `A aportar = CPP atual − Aportado`. Uma parcela pendente/indisponível torna a métrica incompleta, nunca paga por presunção. BIA sem snapshot inicial preserva a compatibilidade legada: seu MAP atual já é formado por aportes pagos e origens aceitas, portanto essa posição vigente é integralizada. Snapshot antigo sem cronograma nominal permanece incompleto.
- `cppBase` e `cppEstimate` continuam na resposta/histórico para compatibilidade e auditoria, mas não alimentam os dois números visíveis de integralização. A estimativa patrimonial dos ativos/caixa/dívidas da BIA continua disponível no detalhamento próprio e não é renomeada como aporte.
- Os cards não exibem a linha amarela de contagem parcial; a cobertura continua na API, nos gráficos e no texto acessível a leitores de tela. A remoção visual não transforma subtotal em avaliação completa nem inclui imóveis sem amostra.
- `shared/portfolio-dashboard.ts` centraliza os cálculos; `memberContributionProgress` centraliza a integralização. No total de aquisição, imóvel sem valor declarado contribui com zero, pois o indicador soma somente o que o usuário informou; valor declarado sem conversão PTAX continua null/parcial. Parcela sem conciliação ou estimativa ausente/vencida também gera null/parcial, nunca pagamento ou estimativa inventados. Resposta transitória ou legada sem `cppContributed`/`cppRemaining` aparece como **Dados insuficientes**, sem derrubar a Carteira nem reinterpretar o total antigo como pagamento. A flag `propertyEstimate.indicative` e a faixa técnica continuam preservadas na evidência e nas observações, sem serem mostradas como total no card.
- Pesquisa automática em segundo plano ao abrir/revalidar a Carteira, apenas para proprietário/administração do imóvel. Sem botão de atualizar, linhas individuais de resultado ou lista de fontes no dashboard. Método por comparáveis exige três anúncios individuais, mesmo tipo, área compatível e características informadas, até10km inclusivos, grounding do provedor e geocodificação de rua (não centroide). Mediana/faixa desse método continuam calculadas no servidor. Cadastro e aba Análise mantêm seu fluxo de confirmação estrita.
- Sem amostra de três, o dashboard usa `researchIndicativePropertyValue`: pesquisa municipal por tipo/área/cidade/estado/características, sem enviar nome, endereço preciso, bairro, contatos ou preços cadastrados. Não exige três anúncios: aceita uma referência contextual de venda (anúncio com preço e área ou índice de venda/m² do mesmo tipo/cidade/estado/moeda), com URL capturada na busca do provedor. Exclui construção/CUB/SINAPI, tipo/localidade/moeda incompatíveis e, nos anúncios, áreas fora de metade–dobro do alvo. Referências contextuais NÃO são anúncios comprovados nem provam distância em10km. Método `estimativa_indicativa_ia`, confiança baixa, raio null, zero comparáveis/fontes verificadas preservados. Ausência de base/recusa/formato inválido retorna sem estimativa, nunca preço manual como fallback.
- `calculateIndicativeMarketValue` calcula preço/m² de cada referência, usa medianas e multiplica pela área informada. Limites recebem margem heurística de25% (não intervalo estatístico/garantia de preço), sem acréscimo livre de terreno/luxo. Fórmula, área, margem e referências aceitas ficam em `resultado.calculo`. Não usa os totais livres do modelo nem altera laudo/cadastro/financeiro/CPPs. Valida novamente a memória de cálculo ao ler/reutilizar o cache.
- Novas análises usam `estimativas-imoveis-v5`; preserva comparáveis estritos v4/v3 e evidência compatível confirmada v2. Indicativas v4 sem memória de cálculo deixam de alimentar cards e são elegíveis à atualização automática; registros originais não são regravados. Fingerprint das características/localização: sucesso válido30dias; tentativa negativa v5 usa espera1hora. Falha transitória na UI espera5min, sem apagar sucesso válido. Cadastro v2 exige entrada_chave atual, raio<=10km e revalidação de fontes/comparáveis; nunca preço manual. Revisão concorrente409, lock/limite2, timeout90s/sem retry e autorização mantidos; GET somente leitura e POST pesquisa.
- Novas métricas do histórico marcam `propertyEstimate.validationVersion=2`. Na projeção de leitura, estimativas indicativas históricas sem a versão deixam valor/faixa desconhecidos para não desenhar uma falsa queda de milhões; aquisição/CPPs e registros originais permanecem intactos. Não recompõe agregados de datas passadas nem grava em GET. Referências de busca/extratos gerados por IA podem conter erro: as guardas reduzem incoerências e não tornam a aproximação um laudo ou verificação independente do anúncio.
- `GET /api/carteira/evolucao` somente lê; `POST /api/carteira/evolucao/registrar` recalcula fontes autorizadas no servidor, ignora valores do cliente e grava observação do dia em America/Sao_Paulo. Tabela aditiva `carteira_patrimonio_observacoes`, migração20261022; uma observação por conta/membro/escopo/dia. Abrir/revalidar dashboard registra a observação; não há cron de avaliação diária se a Carteira não for acessada. Nenhum mês anterior é reconstruído. Mudança de IDs, participação, moeda ou nível de acesso inicia escopo distinto; agregado privado antigo não reaparece após revogação. Erro/migração ausente é explícito e não interrompe os dois blocos.
- Dois gráficos: imóveis (aquisição e estimativa central) e CPPs (`Aportado` e `A aportar`). Apenas pontos observados, sem interpolação de dados ausentes; linhas parciais tracejadas. Observações antigas sem as novas métricas de integralização aparecem como desconhecidas, sem reescrever o JSON original ou usar a antiga estimativa patrimonial como pagamento. Primeira observação não simula evolução histórica. Sem novos lançamentos, transferências, direitos, e-mails, notificações ou documentos. Fonte financeira Directus preservada; histórico privado somente PostgreSQL, sem cópia pública.
- Regressões: `shared/portfolio-dashboard.test.ts`, `server/portfolio-history.test.ts`, `server/property-market-evidence.test.ts`, `client/src/components/portfolio-patrimony-dashboard.test.ts`, além de comparáveis e permissões de Carteira.

## Estimativa automática das BIAs (22/10/2026)

### Composição dos imóveis e completude das CPPs (23/10/2026)

- Para ativo próprio declarado Adquirido/Em operação, `participacaoBiaPercentual` e `dividaSaldo` são campos opcionais da estrutura versionada. Valor de referência e dívida representam o imóvel inteiro; aplica-se a fração da BIA uma vez e depois o MAP do membro ao patrimônio líquido total. Campos aparecem em Ativos Vinculados e no resumo/exportação corrente. Ausência da fração/dívida torna a estimativa incompleta; zero de dívida explícito é válido. Clientes antigos não apagam campos omitidos.
- A origem formal ativa continua sendo a evidência do imóvel integral vinculado, com valor_atual/divida_saldo do inventário, sem reaplicar a antiga fração pessoal. A leitura usa `readBiaSetup`, inclusive recuperação de ativação histórica sem desfazer edição posterior. Referência informativa, negociação/alienado, VO/VGV/carta de consórcio não substituem propriedade/valor atual.
- Estimativa parcial mantém apenas componentes e **Subtotal patrimonial conhecido** no detalhamento. `patrimonio_liquido_estimado`, `valor_participacao` e evolução percentual ficam null enquanto houver pendências. O total estimado de CPPs fica null se alguma BIA elegível estiver incompleta, em vez de mostrar a soma de apenas duas como se cobrisse todas. Base das CPPs permanece inalterada.
- Deduplicação de origem formal independe de preço, dívida ou cotação disponível: o imóvel já representado por BIA com MAP positivo não volta à parcela pessoal, inclusive aquisição consolidada. Observações históricas com CPP parcial têm valor ocultado apenas na projeção de leitura; nenhum original é reescrito nem perda artificial desenhada.
- Revisão de dados existentes foi somente leitura: cinco BIAs com MAP positivo da conta do exemplo ainda estavam sem ativos definidos. Não foram atribuídos imóveis, valores, dívidas ou percentuais por inferência; regularização desses cadastros depende dos dados reais. Testes SQL, domínio, API, SSR e histórico cobrem as novas regras.

- Substitui a exigência de snapshot manual: `shared/bia-patrimony.ts` e adaptador somente leitura `server/bia-patrimony.ts`. Estimativa = ativos adquiridos registrados + entradas pagas − saídas pagas − dívidas informadas dos ativos. Caixa significa saldo dos lançamentos, não saldo bancário/Asaas. VO, CPP, capital prometido, VGV e limite de consórcio não viram dinheiro/valor atual.
- Ativos: origens formalmente ativas (`bia_imovel_origens`/inventario_imoveis: valor_atual e divida_saldo) e valores de referência declarados na estrutura versionada, sem referência à Carteira, com situação Adquirido/Em operação e fração/dívida explícitas. carteiraImovelId apenas informativo não prova propriedade nem autoriza ler valores privados. Negociação, alienados e cartas de consórcio não são somados. IDs de ativos/lançamentos deduplicados. Imóvel direto formalmente já representado numa BIA com MAP positivo não entra duas vezes, mesmo com valor ou câmbio pendente.
- Só movimentos pagos e conciliados de caixa entram; direitos sem caixa, versões substituídas e entradas virtuais de origem não entram. Obrigações pendentes não são subtraídas indiscriminadamente, pois podem estar nas dívidas dos ativos; marcam estimativa parcial. Dívida/valor ausente, moeda diferente ou caixa negativo também sinalizam pendência. Sem dados efetivos, valor null/Dados insuficientes; perdas e valores negativos preservados. Não há nova movimentação, migração, aceite, revisão de MAP/CPP ou escrita em GET.
- Carteira exige vínculo e capital_financeiro:view antes das fontes. Falha de consulta não equivale a zero/ausência. Participação = estimativa completa × MAP. patrimonio_liquido_estimado/estimativa_patrimonial substituem a fonte manual; patrimonio_liquido_oficial fica null por compatibilidade. UI revalida foco/conexão/30s visível e mostra componentes/pendências, sem snapshot manual. Estimativas parciais ficam apenas no detalhamento como subtotal conhecido, não no total das CPPs nem na evolução. Dívidas pessoais seguem separadas; as conhecidas da BIA já reduzem a participação. Aquisição/aportes não são reescritos.
- POST legado /api/bias/:id/patrimonio retorna410 após autorização; GET histórico por ID canônico preservado. Aprovação de aportes permanece independente. Histórico manual e documentos antigos não são alterados. Testes: shared/bia-patrimony.test.ts, server/bia-patrimony.test.ts e client/src/components/bia-patrimony-breakdown.test.ts.
- Receitas/despesas da participação consideram movimentos pagos no período (integralização inicial não é receita); contas a pagar só saídas pendentes/agendadas/vencidas, nunca aportes futuros a receber. Patrimônio usa todo o histórico disponível, não apenas o filtro de receitas/despesas. Valorização de participação com estimativa zero/negativa registra perda, distinguindo ausência de avaliação.

## Objetivo e usuarios

Nas BIAs modelo 3, a composicao patrimonial inclui o MAP Zero uma unica vez: pagamentos iniciais apenas integralizam compromissos. Propriedade e direitos sem caixa nao compoem entradas/saidas financeiras da Carteira; falha de consulta ao financeiro nao e tratada como saldo zero.

Mantem o patrimonio privado do usuario e consolida imoveis proprios com participacoes economicas confirmadas em Aliancas.

## Telas e URLs

- A visao geral da Carteira fica na aba `Carteira` do Inicio; `/carteira` redireciona para essa aba.
- `/carteira/:id` e `/carteira/novo` permanecem como rotas de detalhe e cadastro.
- `/convite-imovel/:token` permite aceitar ou recusar um convite individual de copropriedade.
- `/convites-alianca` permite que a conta limitada revise convites e aceite o MOU sem acessar comunidade ou Agenda.
- `/oportunidades`, `/oportunidades/nova` e `/oportunidades/:id` para a jornada imobiliaria externa.
- Implementacao principal em `client/src/pages/carteira.tsx`, `client/src/pages/carteira-assistente.tsx` e `client/src/pages/oportunidades-imobiliarias.tsx`.

## APIs

- `GET /api/carteira/imoveis?para_bia=1` é a projeção descritiva para o seletor Ativos Vinculados da BIA: apenas ativos não arquivados próprios ou com administração explícita, sem diagnóstico, valores, dívida, documentos ou privilégios globais de administrador. O cadastro original continua oficial; a BIA salva referência e cópia informativa, sem transferir propriedade, gerar caixa ou originar uma BIA pelo fluxo patrimonial.

- `/api/carteira/resumo` retorna `imoveis`, `aliancas` e totais consolidados; `/imoveis*`, `/lancamentos*`, `/documentos*`.
- `/api/ai/preco-m2` aceita o cadastro assistido sem valor inicial e retorna minimo, sugerido e maximo a partir de comparaveis; demais origens continuam exigindo valor e area.
- `/api/carteira/imoveis/:id/financiamento/preview|confirmar` separa extracao, revisao e gravacao idempotente.
- `/api/carteira/imoveis/:id/socios*` mantem a composicao de coproprietarios; `/api/carteira/convites/:token` resolve o convite; `/api/carteira/imoveis/:id/origem-bia*` revisa, envia e cancela a origem.
- `/api/bias/:id/patrimonio` preserva consulta do histórico manual; seu POST foi aposentado pelo cálculo automático. `/aporte-solicitacoes*` mantém aportes sujeitos à decisão autorizada.
- Na aba Analise, o botao de Pulso usa `/api/carteira/imoveis/:id/pulso/preview|pulsos`; a confirmacao recalcula o diagnostico.
- Alertas, diagnostico, alternativas, demandas, acessos e transferencia de proprietario.
- `/api/demandas` e o contrato canonico de criacao e gestao; rotas da Carteira continuam como adaptadores com autorizacao do imovel.
- Assistente de cadastro e publicacao opcional em Banco de Ativos/Vitrine.

## Dados e fontes de verdade

- PostgreSQL `inventario_imoveis`, inclusive as caracteristicas opcionais de mercado em `data`, `inventario_lancamentos`, `carteira_eventos`, `carteira_documentos`, `carteira_analises`, `carteira_alertas`, `carteira_demandas`, `carteira_cotacoes_cambio`, acessos e sessoes do assistente.
- PostgreSQL `carteira_imovel_socios` e a fonte oficial da copropriedade declarada e de seus aceites; `bia_imovel_origens` vincula um imovel a uma BIA e `bia_map_inicial_snapshots` preserva o MAP Inicial das novas BIAs. `bia_map_origem_alocacoes` continua como compatibilidade legada.
- PostgreSQL `bia_patrimonial_snapshots` e `bia_aporte_solicitacoes`; MAP atual deriva do snapshot inicial, dos aportes pagos no Directus e das transferencias aceitas no helper central.
- Historico de evento e append-only; o snapshot atual nao substitui a trilha.
- Ativo publicado e uma projecao/copia rastreada, nao a fonte do item privado.

## Papeis e permissoes

- Proprietario: controle total e transferencia consciente; administrador da plataforma pode excluir um registro mediante confirmacao operacional.
- Coproprietario confirmado: consulta o imovel, documentos, financeiro e sua participacao; somente o administrador principal altera composicao e lancamentos.
- Conta limitada `coproprietario`: sem comunidade, Aura ou anuidade; middleware restringe a API aos imoveis compartilhados, convites e BIAs originadas desses imoveis.
- Convidado: leitura, colaboracao ou administracao conforme acesso explicito e validade.
- A Carteira pessoal de `admin` e `superadmin` tambem lista e totaliza somente propriedade, copropriedade aceita e compartilhamentos explicitos; o papel administrativo nao concede acesso global automatico ao patrimonio privado.
- Arquivo e dado privado exigem autorizacao sobre o imovel pai.

## Estados e transicoes

- Receitas e despesas do detalhe oferecem Editar a quem já tem colaboração/administração/propriedade. O formulário reutiliza PATCH /api/carteira/lancamentos/:id com os dados atuais; não recria o lançamento nem reimporta por IA. Permite tipo, categoria, valor, data, status, descrição, vencimento, pagamento e observação. Origem, anexos, criador e identificação do imóvel continuam preservados pelo contrato existente. Cancelar não grava e falha mantém o formulário para correção/reenvio.
- A edição mantém o evento antes/depois existente e revalida lista/detalhe dos imóveis, resumo, lançamentos, eventos, alertas e Agenda. Não muda avaliações patrimoniais, MAP/CPP, histórico de observações ou pagamentos externos. Regressões: carteira-launch-form.test.ts, carteira-launch-edit.test.ts e carteira-mobile-launch.test.ts.

- Imovel: ativo, arquivado ou transferido; publicacao e compartilhamento possuem estados proprios.
- Documento: versao ativa, substituida, expirada ou removida conforme politica.
- Alerta: aberto, em andamento, resolvido ou ignorado com justificativa.
- Demanda: rascunho, aberta, em negociacao, contratada, em execucao, concluida, convertida ou encerrada.

## Invariantes

- A Carteira le o financeiro oficial da BIA, mas nunca o altera sem solicitacao e aprovacao autorizada.
- MAP maior que zero aplica-se à estimativa automática; falta de dados não equivale a valor zero e subtotais parciais são identificados.
- `Patrimonio Total Estimado` soma imóveis diretos proporcionais e participações estimadas nas BIAs sem duplicar origens formais; dívidas pessoais ficam separadas, mas dívidas conhecidas da BIA já reduzem sua participação.
- O indicador principal de aquisição soma apenas o valor pago proporcional declarado dos imóveis diretos; cadastro sem valor de aquisição contribui com zero. Totais legados da API que combinam imóveis e participações continuam por compatibilidade.
- `Valorizacao registrada` considera somente ativos que possuam valor atual/estimado e base de aquisicao/aporte.
- A estimativa por comparáveis da aba Análise usa três anúncios do mesmo tipo, distância geocodificada até10km e faixa proporcional de área/características. No dashboard, amostra insuficiente permite aproximação indicativa por IA identificada separadamente, sem afirmar que alcançou três anúncios verificáveis.
- No cadastro assistido, o ViaCEP preenche os campos estruturados sem apagar a entrada manual em caso de falha; esses campos permanecem no `inventario_imoveis` e voltam preenchidos na edicao.
- O rodapé fixo do cadastro assistido usa as cores do tema ativo e respeita a área segura inferior do dispositivo; os controles de navegação permanecem legíveis nos modos claro e escuro em todas as etapas.
- A estimativa do cadastro assistido nao vem da extracao generativa: minimo, sugerido e maximo usam comparaveis verificaveis, o valor sugerido e editavel com mascara monetaria `pt-BR` e somente a confirmacao humana grava `valor_atual` numerico e o snapshot em `carteira_analises`.
- A referencia usa a mediana do preco por m2 depois de remover anuncios muito fora da curva; a confianca considera quantidade, raio e cobertura das caracteristicas. A sugestao vale por 30 dias e aparece no card específico de faixa estimada, sem substituir o valor cadastrado/confirmado nos demais consumidores.
- O resumo nao chama servicos externos; pesquisas e cotacoes desatualizadas sao renovadas em segundo plano e resultados validos permanecem disponiveis durante falhas.
- Consolidacoes multimoeda usam a ultima cotacao de venda PTAX persistida; sem cotacao, a moeda e identificada e excluida do total, nunca tratada silenciosamente como BRL.
- Cada imovel registra a participacao percentual do usuario; aquisicao, valor atual, divida e concentracao usam essa fracao.
- Parcelas importadas de XLS, XLSX, CSV ou PDF so viram documento e lancamentos depois da confirmacao da previa editavel.
- Gestores autorizados aprovam ou rejeitam aportes; o patrimônio é estimado em leitura, sem registro manual obrigatório. Participantes apenas enviam solicitações e comprovantes.
- `valor_pago` permanece a coluna compativel e e apresentado como “Valor de aquisicao”.
- Edicao relevante gera evento com autor, origem e horario.
- IA propoe dados; confirmacao humana grava o snapshot oficial.
- No lançamento de receitas e despesas, a leitura por IA aceita arquivo, imagem ou áudio e sempre apresenta prévia editável antes da gravação; no mobile, o modal permanece rolável dentro da altura visível.
- Cada lançamento sugerido pode ser excluído da prévia antes de confirmar; a exclusão é local, não altera registros salvos e fica bloqueada durante a gravação. Somente sugestões restantes são enviadas, e excluir todas oculta a confirmação.
- Matriculas em PDF usam leitura visual quando o texto incorporado e insuficiente; uma analise sem nenhum campo identificado retorna erro e nao registra a fonte como processada.
- Em Conversar com a IA, o usuario pode digitar, enviar um arquivo de audio ou gravar a fala no momento; gravacao e arquivo usam a mesma analise e permanecem revisaveis antes de salvar.
- Negar o microfone nao bloqueia o cadastro: a interface orienta como liberar a permissao e preserva o envio de arquivo e o texto como alternativas.
- Compartilhar um imovel nao compartilha toda a Carteira.
- `carteira_demandas` e a fonte operacional de Demandas globais, de imovel e de BIA; `opportunity_registry` e indice publico e de rastreabilidade.
- Os modos oficiais sao `DIRECT_HIRE`, `NETWORK_DEMAND`, `INTERNAL_BIA` e `OBA`; os dois ultimos exigem BIA e OBA somente nasce de Demanda da propria BIA.
- A composicao proposta, inclusive convites pendentes, deve totalizar exatamente 100%; convite pendente nao concede acesso e qualquer alteracao de e-mail ou percentual invalida o aceite afetado.
- Originar uma BIA exige todos os coproprietarios confirmados, MAP total de 100%, valor de origem positivo e nenhum outro vinculo ativo; imovel financiado usa valor bruto e mantem a divida separada.
- A copropriedade aceita preenche os pesos dos Guardioes do MAP Zero; ajustes na estruturacao criam revisao e exigem novos aceites se o MOU ja foi assinado. A BIA ativa somente com os aceites exigidos da revisao vigente. Nenhuma revisao da base cria receita ou caixa. Apos ativacao, Diretor da Alianca ou Aliado BUILT vinculados podem corrigir com motivo; a Carteira consome o MAP oficial recalculado.
- Um imovel com BIA ativa vinculada nao pode ser excluido.
- Publicar e opt-in, reversivel e deve mascarar dados privados.

## Efeitos e dependencias

- Alimenta Agenda/Alertas, Vitrine, Banco de Ativos, oportunidades economicas e rastreabilidade.
- Upload e extracao dependem de Arquivos/OpenAI; lembretes dependem de cron/notificacoes.

## Testes e impacto

- A escolha de responsável por Demanda usa lista pesquisável, ordenada alfabeticamente em pt-BR e sem duplicar a mesma identidade quando proprietário e acesso se sobrepõem. A opção “Definir depois” permanece fixa e a mudança não altera as permissões do imóvel.

- `server/carteira-domain.test.ts`
- `server/carteira-alertas.test.ts`
- `server/property-journey.test.ts`
- `server/market-comparables.test.ts`
- `client/src/lib/property-address.test.ts`
- `client/src/lib/pt-br-money.test.ts`
- `client/src/pages/carteira-mobile-launch.test.ts`
- `shared/property-ownership.test.ts`
- Ao alterar: testar dono/convidado/nao autorizado, evento gerado, publicacao/retirada, documentos, alertas e viewport mobile.

## 29/10/2026 — Lista de alianças sem duplicação no Início
A aba Imóveis do painel usa showAlliances=false: oculta lista Minhas Alianças e seu atalho interno. A aba própria Minhas Alianças permanece. Rota Carteira independente mantém lista e ações. Dashboard consolidado, totais, API, permissões, dados, notificações e documentos preservados; alteração somente de composição visual.

## 30/10/2026 — Ação principal da Carteira
Removido somente o botão Identifiquei uma oportunidade do cabeçalho de CarteiraDashboardPanel (Início/Imóveis e rota Carteira). Cadastrar meu imóvel e filtro de período preservados. Rotas e demais ações de oportunidades permanecem; nenhuma alteração de dados, cálculo ou permissão.

## 30/10/2026 — Tese única no cadastro do imóvel
Fonte: shared/strategic-cells.ts, adaptada por shared/property-thesis.ts. Assistente (criação/retomada), primeiro acesso, edição do imóvel e Pulso usam a mesma lista + gerir. O campo JSON intencao da sessão conserva o código; conclusão grava objetivo do imóvel com esse código. Edição/Pulso validam no servidor. Originação de BIA copia somente tese canônica para objetivo_alianca; nomes antigos ambíguos não são convertidos. Estruturação permanece na ação posterior de origem-BIA, sem automatismo. Recomendações profissionais usam a família da tese; análise recebe o rótulo. Diagnóstico trata gerir como tese não definida. Dados legados mantêm uma opção de leitura/edição identificada, sem backfill nem migração. API/autorização privada preservadas. Valores, MAP, gráficos financeiros, alertas, e-mails e documentos assinados não mudam. Testes: shared/property-thesis.test.ts e server/property-journey.test.ts.
Validação final:603 testes/tipos/build aprovados;13 chamadas na homologação com imóvel sintético confirmaram persistência/conclusão/edição e rejeição inválida. Interface conferida em desktop e390x844. Sem commit, push ou produção.

Ajuste de texto solicitado: pergunta inicial e retomada voltam a “Qual é o seu objetivo inicial?”, também no primeiro acesso. Opções canônicas, persistência e regras permanecem; guarda impede listas concorrentes, não essa pergunta aprovada.

Cadastro de Meus Imóveis: removida a escolha É meu imóvel/Identifiquei uma oportunidade. A entrada padrão e path=imovel mantêm o fluxo de imóvel; rotas explícitas legadas de oportunidade continuam respeitadas, sem conversão de sessões existentes. Só apresentação; nenhum dado ou permissão alterado.

## 30/10/2026 — Carteira unificada responsiva
CarteiraDashboardPanel apresenta imóveis e CPPs em colunas no desktop e seções consecutivas no celular. Métricas e observações continuam em shared/portfolio-dashboard.ts. Composição por quantidade usa shared/portfolio-composition.ts: somente imóveis próprios, ID único, sem converter ocupação desconhecida em vaga e sem somar ativos consolidados pela BIA. Painel injeta buildBiaThesisAllocation já usado na lista de alianças (valor investido, não valor de CPP); rota independente oferece acesso à lista quando distribuição não está disponível. Ações abrem cadastro, lista local de imóveis ou aba de alianças, preservando cadastro/edição e suas permissões. Fontes /api/carteira/resumo, /api/carteira/evolucao e dashboard existente; nenhuma migração, alteração financeira, integração, e-mail ou documento.

Ajuste responsivo: duas colunas a partir de 1024px de viewport (lg), incluindo desktop de 1168–1254px. Valores compactos até 1279px, com valor integral na ajuda, evitam quebra em cartões menores. Mobile permanece empilhado.

Pedido posterior: na aba Imóveis do Início, showAlliances=false também oculta o bloco de KPIs, evolução de CPPs e teses de alianças do dashboard; imóveis ocupam a largura disponível. Aba Minhas Alianças preservada. Rota Carteira independente mantém suporte ao bloco. Apenas apresentação, sem excluir dados.

O aviso amarelo de patrimônio parcial por pendências das alianças também respeita showAlliances; não aparece na aba Imóveis. Indicadores de imóveis e avisos próprios preservados.

## CPPs na aba Minhas Alianças
Painel usa CarteiraDashboardPanel em modo alliancesOnly para valores aportados/a aportar e evolução, com mesmos helpers, resumo, observações e filtro de período. Não dispara atualização de cotação nem pesquisa de imóveis nesse modo; nenhuma duplicação de listas/teses. Aba Imóveis usa título Meus imóveis e descrição específica; standalone mantém Carteira Patrimonial. API, cálculos, persistência e permissões preservados.

Ordem solicitada: valores e evolução das CPPs ficam no final da aba Minhas Alianças, depois dos indicadores e da lista de BIAs. Apenas posição visual.
