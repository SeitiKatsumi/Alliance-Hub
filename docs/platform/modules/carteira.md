# Carteira Patrimonial

## Objetivo e usuarios

Mantem o patrimonio privado do usuario e consolida imoveis proprios com participacoes economicas confirmadas em Aliancas.

## Telas e URLs

- A visao geral da Carteira fica na aba `Carteira` do Inicio; `/carteira` redireciona para essa aba.
- `/carteira/:id` e `/carteira/novo` permanecem como rotas de detalhe e cadastro.
- `/convite-imovel/:token` permite aceitar ou recusar um convite individual de copropriedade.
- `/convites-alianca` permite que a conta limitada revise convites e aceite o MOU sem acessar comunidade ou Agenda.
- `/oportunidades`, `/oportunidades/nova` e `/oportunidades/:id` para a jornada imobiliaria externa.
- Implementacao principal em `client/src/pages/carteira.tsx`, `client/src/pages/carteira-assistente.tsx` e `client/src/pages/oportunidades-imobiliarias.tsx`.

## APIs

- `/api/carteira/resumo` retorna `imoveis`, `aliancas` e totais consolidados; `/imoveis*`, `/lancamentos*`, `/documentos*`.
- `/api/carteira/imoveis/:id/financiamento/preview|confirmar` separa extracao, revisao e gravacao idempotente.
- `/api/carteira/imoveis/:id/socios*` mantem a composicao de coproprietarios; `/api/carteira/convites/:token` resolve o convite; `/api/carteira/imoveis/:id/origem-bia*` revisa, envia e cancela a origem.
- `/api/bias/:id/patrimonio` e `/aporte-solicitacoes*` registram valor oficial e aportes sujeitos a decisao do diretor.
- Pulsos, alertas, diagnostico, alternativas, demandas, acessos e transferencia de proprietario.
- Assistente de cadastro e publicacao opcional em Banco de Ativos/Vitrine.

## Dados e fontes de verdade

- PostgreSQL `inventario_imoveis`, `inventario_lancamentos`, `carteira_eventos`, `carteira_documentos`, `carteira_analises`, `carteira_alertas`, `carteira_demandas`, `carteira_cotacoes_cambio`, acessos e sessoes do assistente.
- PostgreSQL `carteira_imovel_socios` e a fonte oficial da copropriedade declarada e de seus aceites; `bia_imovel_origens` vincula um imovel a uma BIA e `bia_map_origem_alocacoes` congela o MAP inicial ativado.
- PostgreSQL `bia_patrimonial_snapshots` e `bia_aporte_solicitacoes`; MAP deriva das alocacoes de origem, dos aportes oficiais do Directus e das transferencias aceitas no helper central.
- Historico de evento e append-only; o snapshot atual nao substitui a trilha.
- Ativo publicado e uma projecao/copia rastreada, nao a fonte do item privado.

## Papeis e permissoes

- Proprietario: controle total e transferencia consciente; administrador da plataforma pode excluir um registro mediante confirmacao operacional.
- Coproprietario confirmado: consulta o imovel, documentos, financeiro e sua participacao; somente o administrador principal altera composicao e lancamentos.
- Conta limitada `coproprietario`: sem comunidade, Aura ou anuidade; middleware restringe a API aos imoveis compartilhados, convites e BIAs originadas desses imoveis.
- Convidado: leitura, colaboracao ou administracao conforme acesso explicito e validade.
- Administrador da plataforma nao recebe acesso automatico ao patrimonio privado sem regra operacional auditavel.
- Arquivo e dado privado exigem autorizacao sobre o imovel pai.

## Estados e transicoes

- Imovel: ativo, arquivado ou transferido; publicacao e compartilhamento possuem estados proprios.
- Documento: versao ativa, substituida, expirada ou removida conforme politica.
- Alerta: aberto, em andamento, resolvido ou ignorado com justificativa.
- Demanda: rascunho, publicada, atendida ou encerrada.

## Invariantes

- A Carteira le o financeiro oficial da BIA, mas nunca o altera sem solicitacao e aprovacao autorizada.
- Somente MAP maior que zero e snapshot patrimonial confirmado entram no patrimonio consolidado.
- `Patrimonio Total Estimado` e bruto: soma o valor estimado dos imoveis proprios, proporcional a propriedade, ao valor confirmado das participacoes em BIAs pelo MAP; dividas ficam separadas.
- `Valor de aquisicao` soma o valor pago proporcional dos imoveis aos aportes oficiais nas BIAs.
- `Valorizacao registrada` considera somente ativos que possuam valor atual/estimado e base de aquisicao/aporte.
- A estimativa automatica usa no minimo tres anuncios do mesmo tipo com distancia geocodificada de ate 10 km, vale por 30 dias e nao substitui o valor oficial sem confirmacao humana.
- O resumo nao chama servicos externos; pesquisas e cotacoes desatualizadas sao renovadas em segundo plano e resultados validos permanecem disponiveis durante falhas.
- Consolidacoes multimoeda usam a ultima cotacao de venda PTAX persistida; sem cotacao, a moeda e identificada e excluida do total, nunca tratada silenciosamente como BRL.
- Cada imovel registra a participacao percentual do usuario; aquisicao, valor atual, divida e concentracao usam essa fracao.
- Parcelas importadas de XLS, XLSX, CSV ou PDF so viram documento e lancamentos depois da confirmacao da previa editavel.
- Diretores autorizados registram snapshots e aprovam ou rejeitam aportes; participantes apenas enviam solicitacoes e comprovantes.
- `valor_pago` permanece a coluna compativel e e apresentado como “Valor de aquisicao”.
- Edicao relevante gera evento com autor, origem e horario.
- IA propoe dados; confirmacao humana grava o snapshot oficial.
- Matriculas em PDF usam leitura visual quando o texto incorporado e insuficiente; uma analise sem nenhum campo identificado retorna erro e nao registra a fonte como processada.
- Em Conversar com a IA, o usuario pode digitar, enviar um arquivo de audio ou gravar a fala no momento; gravacao e arquivo usam a mesma analise e permanecem revisaveis antes de salvar.
- Negar o microfone nao bloqueia o cadastro: a interface orienta como liberar a permissao e preserva o envio de arquivo e o texto como alternativas.
- Compartilhar um imovel nao compartilha toda a Carteira.
- A composicao proposta, inclusive convites pendentes, deve totalizar exatamente 100%; convite pendente nao concede acesso e qualquer alteracao de e-mail ou percentual invalida o aceite afetado.
- Originar uma BIA exige todos os coproprietarios confirmados, MAP total de 100%, valor de origem positivo e nenhum outro vinculo ativo; imovel financiado usa valor bruto e mantem a divida separada.
- O MAP inicial so e gravado uma vez depois de todos aceitarem o MOU, nao cria receita ou caixa e permanece imutavel diante de alteracoes posteriores da copropriedade.
- Um imovel com BIA ativa vinculada nao pode ser excluido.
- Publicar e opt-in, reversivel e deve mascarar dados privados.

## Efeitos e dependencias

- Alimenta Agenda/Alertas, Vitrine, Banco de Ativos, oportunidades economicas e rastreabilidade.
- Upload e extracao dependem de Arquivos/OpenAI; lembretes dependem de cron/notificacoes.

## Testes e impacto

- `server/carteira-domain.test.ts`
- `server/carteira-alertas.test.ts`
- `server/property-journey.test.ts`
- `server/market-comparables.test.ts`
- `shared/property-ownership.test.ts`
- Ao alterar: testar dono/convidado/nao autorizado, evento gerado, publicacao/retirada, documentos, alertas e viewport mobile.
