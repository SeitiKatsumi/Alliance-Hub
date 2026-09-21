# MAP Zero — validação de 18/09/2026

## Resultado

- Código implementado com nomes técnicos legados preservados; sem nova dependência.
- `test:all`: 248 testes aprovados, incluindo regressões de MAP e fluxos legados.
- `platform:contract`: 11 módulos e 98 funcionalidades válidas.
- `build`: aprovado.
- `platform:verify`: contrato aprovado; interrompido nos mesmos 66 erros TypeScript anteriores. Comparação por arquivo, código e mensagem (desconsiderando deslocamentos de linha): nenhuma diferença. Testes e build executados separadamente.
- Impacto de Capital, helper de histórico e `server/routes.ts` verificado.
- Visual: componentes reais da calculadora e histórico em prévia isolada com dados fictícios; desktop e viewport de 390px, comparação selecionável e valores legíveis. Sem gravação em BIA real.

## Regressões executadas

- Migração repetível, restrições de imutabilidade, deduplicação de eventos, no-op e sequência de versões.
- Rotas reais de salvamento/aceite/PDF em Express e PGlite: permissão, motivo, revisão esperada, novo aceite depois da alteração, corrida edição/assinatura e ativação com revisão vigente.
- PDF histórico idêntico byte a byte antes e depois das alterações; evidência antiga de aceite preservada.
- Cálculo compartilhado, cinco casas, pesos, índice zero explícito e ausência de índices mantida pendente (inclusive origem de imóvel).
- Aporte pendente não cria versão; pago cria; repetição não duplica; cancelamento cria alteração efetiva.
- Falha da fonte aborta; interrupção depois da escrita externa é conciliada na operação seguinte. No teste, a conexão independente do outbox Directus/PostgreSQL é simulada em memória porque PGlite usa conexão única; revisões/aceites/rollback usam SQL real.
- Base incompatível com transferência existente é rejeitada sem alterar a revisão.
- MAP Zero não cria registro financeiro; correções/reversões de transferências passam pelo lock compartilhado.

## Implantação pendente

A conexão configurada em `DATABASE_URL` retornou `ECONNREFUSED`. Não foi possível aplicar a migração nem fazer homologação autenticada com Directus/PostgreSQL reais. O servidor anterior em 3004 estava parado (log anterior com `ECONNRESET`); não foi reiniciado contra banco indisponível.

Restabelecer a conexão e aplicar `migrations/20260918_map_zero_versions.sql` após a estrutura MAP Inicial existente. O bootstrap também aplica essa migração aditiva ao iniciar a API. Validar depois o fluxo autenticado completo, notificações e webhooks no ambiente de homologação. Não criar lançamentos ou aceites reais para teste.

Nenhum commit, push ou deploy realizado. Alterações anteriores do usuário preservadas.
