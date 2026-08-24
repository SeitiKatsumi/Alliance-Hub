# Carteira Patrimonial

## Objetivo e usuarios

Mantem o patrimonio privado do usuario e consolida imoveis proprios com participacoes economicas confirmadas em Aliancas.

## Telas e URLs

- A visao geral da Carteira fica na aba `Carteira` do Inicio; `/carteira` redireciona para essa aba.
- `/carteira/:id` e `/carteira/novo` permanecem como rotas de detalhe e cadastro.
- `/oportunidades`, `/oportunidades/nova` e `/oportunidades/:id` para a jornada imobiliaria externa.
- Implementacao principal em `client/src/pages/carteira.tsx`, `client/src/pages/carteira-assistente.tsx` e `client/src/pages/oportunidades-imobiliarias.tsx`.

## APIs

- `/api/carteira/resumo` retorna `imoveis`, `aliancas` e totais consolidados; `/imoveis*`, `/lancamentos*`, `/documentos*`.
- `/api/carteira/imoveis/:id/financiamento/preview|confirmar` separa extracao, revisao e gravacao idempotente.
- `/api/bias/:id/patrimonio` e `/aporte-solicitacoes*` registram valor oficial e aportes sujeitos a decisao do diretor.
- Pulsos, alertas, diagnostico, alternativas, demandas, acessos e transferencia de proprietario.
- Assistente de cadastro e publicacao opcional em Banco de Ativos/Vitrine.

## Dados e fontes de verdade

- PostgreSQL `inventario_imoveis`, `inventario_lancamentos`, `carteira_eventos`, `carteira_documentos`, `carteira_analises`, `carteira_alertas`, `carteira_demandas`, `carteira_cotacoes_cambio`, acessos e sessoes do assistente.
- PostgreSQL `bia_patrimonial_snapshots` e `bia_aporte_solicitacoes`; MAP continua derivado dos aportes oficiais do Directus e transferencias aceitas.
- Historico de evento e append-only; o snapshot atual nao substitui a trilha.
- Ativo publicado e uma projecao/copia rastreada, nao a fonte do item privado.

## Papeis e permissoes

- Proprietario: controle total e transferencia consciente; administrador da plataforma pode excluir um registro mediante confirmacao operacional.
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
- Em Conversar com a IA, o usuario pode digitar, enviar um arquivo de audio ou gravar a fala no momento; gravacao e arquivo usam a mesma analise e permanecem revisaveis antes de salvar.
- Negar o microfone nao bloqueia o cadastro: a interface orienta como liberar a permissao e preserva o envio de arquivo e o texto como alternativas.
- Compartilhar um imovel nao compartilha toda a Carteira.
- Publicar e opt-in, reversivel e deve mascarar dados privados.

## Efeitos e dependencias

- Alimenta Agenda/Alertas, Vitrine, Banco de Ativos, oportunidades economicas e rastreabilidade.
- Upload e extracao dependem de Arquivos/OpenAI; lembretes dependem de cron/notificacoes.

## Testes e impacto

- `server/carteira-domain.test.ts`
- `server/carteira-alertas.test.ts`
- `server/property-journey.test.ts`
- `server/market-comparables.test.ts`
- Ao alterar: testar dono/convidado/nao autorizado, evento gerado, publicacao/retirada, documentos, alertas e viewport mobile.
