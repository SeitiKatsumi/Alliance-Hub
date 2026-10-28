# Aportes de despesas existentes — homologação privada

Escopo autorizado: implementar e testar somente na cópia isolada, usando participantes e BIAs sintéticos. Sem commit, push, produção, envio real de e-mail ou cobrança externa. Directus original e backups permanecem preservados.

## Invariantes e regressões

- Partes manuais em valores/percentuais e MAP oficial; total conservado em centavos, inclusive 100/3. Rejeição de repetidos, terceiros, valores inválidos e total incompleto.
- Prévia não grava; status pago/parcial/cancelado bloqueados. Despesa, vencimento, CPP ou MAP alterado e autorização retirada invalidam confirmação.
- Intenção persistida antes do lote, origem única e IDs estáveis. Repetição, duas solicitações distintas concorrentes e resposta perdida não duplicam registros. Saída mantém ID, quantidade, total e histórico.
- Falha antes da gravação retoma a intenção aprovada. Foi corrigida comparação de snapshot após leitura JSONB: ordem das chaves não representa mudança da despesa.
- Na homologação foi identificada ausência de lock para BIA legada sem snapshot. A transação agora obtém lock por BIA antes de consultar o snapshot; vale para geração e escritas financeiras concorrentes.
- Parcelas legadas e entradas vinculadas são preservadas na reconciliação do cronograma. Exclusão, cancelamento e alteração incompatível de valor permanecem bloqueados.
- Prévia de criação e edição usa o mesmo componente de apresentação e os mesmos helpers de cálculo. Opções de lembretes e cobrança executam somente depois do lote financeiro.

## Verificações

- Verificação completa: 597 testes/0 falhas, contratos, consistência, TypeScript do app/ferramentas e build.
- Cinco cenários e 35 chamadas HTTP na cópia: valores manuais, percentuais, MAP, confirmação concorrente, IDs/totais/histórico, proteção de exclusão/valor, lembretes separados e ressincronização real.
- A tentativa de Pix/boleto retorna 202 com pedido privado e external_id nulo. O executor externo continua desativado. Não foi emitida cobrança nem enviado e-mail real.
- Desktop: menu e edição, bloqueio de rascunho não salvo, prévia manual/MAP, carregamento e reabertura Ver aportes. Mobile 390x844: prévia, confirmação e vínculos, sem corte horizontal. Dados usados são sintéticos.
- Após geração visual de R$100, A Receber passou de R$100 para R$200; quatro saídas continuaram somando R$400. A saída escolhida manteve ID, valor e status.
- O gate integral possui quatro pendências anteriores em 2026-10-26-remote-sandbox-contributions.json; não foram atestadas. Revisão do escopo desta entrega é executada separadamente com índice temporário, sem alterar o índice do usuário ou criar commit.
- A cópia anterior do servidor/interface fica preservada antes de cada atualização privada. Produção e Directus original não foram reiniciados nem alterados.

Logs locais: `.BUILT-tmp/existing-expense-verify.log`, `.BUILT-tmp/existing-expense-impact.log`. Operador de fixtures usa checks de `BUILT_ISOLATED_STAGE`, backend PostgreSQL, URL Directus desativada e marcador `isolated-rehearsal` antes de escrever.

## 29/10 — recuo do rodapé de edição

Três ações excediam a largura útil do modal de 500px. Editor ampliado para 560px no desktop e rodapé permite quebra de linha; celular continua empilhado. Conferência visual somente leitura na homologação: Cancelar com recuo de 74px no desktop e 18px em 390px, sem overflow horizontal. Nenhum lançamento salvo ou aporte gerado nesta conferência. `platform:verify` passou novamente (597/597); revisão do escopo aprovada (636 fontes, 59 arquivos), com as mesmas quatro pendências anteriores na revisão integral. Logs: `.BUILT-tmp/expense-footer-verify.log` e `.BUILT-tmp/expense-footer-review-exact.log`.
