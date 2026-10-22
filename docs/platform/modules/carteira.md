# Carteira Patrimonial

## Estimativa automática das BIAs (22/10/2026)

- Substitui a exigência de snapshot manual: `shared/bia-patrimony.ts` e adaptador somente leitura `server/bia-patrimony.ts`. Estimativa = ativos adquiridos registrados + entradas pagas − saídas pagas − dívidas informadas dos ativos. Caixa significa saldo dos lançamentos, não saldo bancário/Asaas. VO, CPP, capital prometido, VGV e limite de consórcio não viram dinheiro/valor atual.
- Ativos: origens formalmente ativas (`bia_imovel_origens`/inventario_imoveis: valor_atual e divida_saldo) e valores de referência declarados na estrutura versionada, sem referência à Carteira, com situação Adquirido/Em operação. carteiraImovelId apenas informativo não prova propriedade nem autoriza ler valores privados. Negociação, alienados e cartas de consórcio não são somados. IDs de ativos/lançamentos deduplicados. Imóvel direto formalmente já representado numa BIA com MAP positivo e moeda convertível não entra duas vezes no valor consolidado.
- Só movimentos pagos e conciliados de caixa entram; direitos sem caixa, versões substituídas e entradas virtuais de origem não entram. Obrigações pendentes não são subtraídas indiscriminadamente, pois podem estar nas dívidas dos ativos; marcam estimativa parcial. Dívida/valor ausente, moeda diferente ou caixa negativo também sinalizam pendência. Sem dados efetivos, valor null/Dados insuficientes; perdas e valores negativos preservados. Não há nova movimentação, migração, aceite, revisão de MAP/CPP ou escrita em GET.
- Carteira exige vínculo e capital_financeiro:view antes das fontes. Falha de consulta não equivale a zero/ausência. Participação = estimativa × MAP. patrimonio_liquido_estimado/estimativa_patrimonial substituem a fonte manual; patrimonio_liquido_oficial fica null por compatibilidade. UI revalida foco/conexão/30s visível e mostra componentes/pendências, sem formulário manual. Estimativas parciais entram como subtotal conhecido explicitamente parcial. Dívidas pessoais seguem separadas; as conhecidas da BIA já reduzem a participação. Aquisição/aportes não são reescritos.
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

- Imovel: ativo, arquivado ou transferido; publicacao e compartilhamento possuem estados proprios.
- Documento: versao ativa, substituida, expirada ou removida conforme politica.
- Alerta: aberto, em andamento, resolvido ou ignorado com justificativa.
- Demanda: rascunho, aberta, em negociacao, contratada, em execucao, concluida, convertida ou encerrada.

## Invariantes

- A Carteira le o financeiro oficial da BIA, mas nunca o altera sem solicitacao e aprovacao autorizada.
- MAP maior que zero aplica-se à estimativa automática; falta de dados não equivale a valor zero e subtotais parciais são identificados.
- `Patrimonio Total Estimado` soma imóveis diretos proporcionais e participações estimadas nas BIAs sem duplicar origens formais; dívidas pessoais ficam separadas, mas dívidas conhecidas da BIA já reduzem sua participação.
- `Valor de aquisicao` soma o valor pago proporcional dos imoveis aos aportes oficiais nas BIAs.
- `Valorizacao registrada` considera somente ativos que possuam valor atual/estimado e base de aquisicao/aporte.
- A estimativa automatica da aba Analise usa no minimo tres anuncios do mesmo tipo, a menor distancia geocodificada viavel de ate 20 km e faixa proporcional de area; quando informados, padrao, idade, conservacao, quartos, banheiros e vagas eliminam comparaveis incompatíveis.
- No cadastro assistido, o ViaCEP preenche os campos estruturados sem apagar a entrada manual em caso de falha; esses campos permanecem no `inventario_imoveis` e voltam preenchidos na edicao.
- A estimativa do cadastro assistido nao vem da extracao generativa: minimo, sugerido e maximo usam comparaveis verificaveis, o valor sugerido e editavel com mascara monetaria `pt-BR` e somente a confirmacao humana grava `valor_atual` numerico e o snapshot em `carteira_analises`.
- A referencia usa a mediana do preco por m2 depois de remover anuncios muito fora da curva; a confianca considera quantidade, raio e cobertura das caracteristicas. A sugestao vale por 30 dias, permanece separada dos cards e totais e so substitui o valor oficial depois de confirmacao humana.
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
