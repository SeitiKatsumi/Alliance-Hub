# Criação de BIA por etapas — trabalho em andamento

Não publicar este conjunto como entrega concluída.

## Verificação executada

- 290 testes passaram em 72 arquivos. A suíte inclui falha/retomada de rascunho, intenção durável de fase, guarda financeira e os nove participantes da planilha. A rota real de criação também foi exercitada com modelo 4, cargos separados e Multiplicador com capital.
- Build passou.
- TypeScript: 66 erros, iguais ao baseline normalizado (nenhum novo).
- platform:verify foi executado; interrompe nos erros TypeScript legados.
- Interface autenticada conferida em desktop e viewport 390x844: controles antigos, índices de 1,25000% e 2,00000%, pessoa agrupada, Multiplicador com capital e retomada após recarregar. Não é validação integral de todas as fases.
- Rascunho de teste `a6bd12fa-88f1-4855-a183-143d635013d2` salvo e retomado. Leitura PostgreSQL/Directus confirmou zero convites de diretor/sócio, snapshots definitivos, cadastros de aporte e lançamentos. Mantido como rascunho; não houve aceite contratual nem pagamento.
- Backend reiniciado (PID 38880, porta 3004; logs locais `.codex-tmp/bia-wizard-server.*.log`). Sessão de desenvolvimento perdida; login aberto na aba 19 e nova autenticação solicitada. Duas correções posteriores (guarda de fase pendente em Ativa legada e mapeamento de anexos para `Anexos`) exigem novo carregamento do backend antes da validação final.
- Sem commit, push ou implantação.

## Ajuste solicitado durante implementação

Preservados os seis botões de Destinação, os três de Objetivo, catálogo completo de moedas com busca e seletor existente de localização no mapa. As opções agora são compartilhadas com a validação de rascunhos. Seleções não recebem defaults silenciosos. Coordenadas são mantidas no rascunho. Um teste de regressão cobre os controles e opções.

## Pendências antes de considerar o plano entregue

Correção adicional: preflight da criação antes do congelamento, retomada sem PUT e validação estrutural das contribuições. Regressão cobre recusa sem congelamento/convites e recuperação após falha externa. Suíte: 290/290; build aprovado; TypeScript 66 erros iguais ao baseline normalizado. Após a última validação estrutural, os quatro testes direcionados foram repetidos e aprovados. Backend local recarregado; integração autenticada ainda depende de novo login. Não publicado.

- Paridade dos campos implementada: capa/anexos usam helper compartilhado, informações complementares foram extraídas do formulário anterior, análises e selo presentes. Testar upload/retomada na integração antes de concluir.
- Testar rascunho/conclusão contra PostgreSQL e Directus, incluindo falha parcial entre convites, snapshot e gravação remota. Não permitir aceite de uma conclusão pendente.
- Revisar todos os consumidores de fase, especialmente origem de imóvel, confirmação financeira, exclusão e operações bancárias.
- Conferir coerência de equipe após edição de composição modelo 4, detalhamento por cargo em PDFs e formatação dos consumidores.
- Histórico, idempotência e recuperação passaram em banco isolado; retomar intenção persistida também está disponível na interface. Falta validar as deliberações autorizadas na integração.
- Retestar conclusão autenticada e navegação com backend final, após login. Revisão apresenta pendências gerais e impede concluir sem localização/descrição/destinação/objetivo.
- Contratos receberam seções do novo modelo em andamento. Harmonizar descrições anteriores e contrato estruturado quando todos os caminhos estiverem cobertos, sem converter históricos.

Os testes existentes aprovados não substituem essas validações integradas. Dados externos não devem ser usados como zero quando indisponíveis.
