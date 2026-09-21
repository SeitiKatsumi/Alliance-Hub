# MAP Zero, aportes iniciais e cronogramas — validação

Data: 2026-09-18. Implementação local; sem commit, push ou implantação.

## Escopo entregue no código

- Modelo 3 somente para novas BIAs, inclusive origem de imóvel. Valores comprometidos são a fonte de capital; pesos derivados não reduzem a precisão de cinco casas. Identidade única, índices ausentes rejeitados e tipos de CPP capturados da taxonomia oficial.
- MAP Zero, revisão esperada, aceites e histórico reutilizados. Nenhum lançamento ao salvar MAP. Alteração após ativação mantém restrição Diretor/Aliado, motivo e documentos antigos.
- Compromissos e parcelas em PostgreSQL; execução no Directus por IDs estáveis. Cadastro, prévia, confirmação explícita e recuperação de confirmação parcial.
- Cronogramas nominais do ativo separados dos participantes; sinal e séries com calendário, centavos e resíduo final. Direitos herdam inicialmente o cronograma do participante, com ajuste manual. Sem inferir vencimento anual ou liberação de crédito.
- Integralização inicial não duplica CPP. Propriedade e direitos sem caixa ficam fora dos totais de dinheiro, lembretes e geração de cobrança. Pares compensatórios integralizados/revertidos juntos, com histórico.
- Proteção de parcelas pagas, evidências e cobranças. Recuperação não desfaz pagamento recebido durante tentativa; cancelamento detecta pagamento/evidência posterior e permanece pendente para regularização.
- Estruturação, Aportes e parcelas, MAP Zero/Atual e histórico responsivos; MOU/PDF usam classificação capturada. Monetização e IGP-M automático fora desta entrega.

## Verificações executadas

- Baseline anterior: 66 erros TypeScript. Final: mesmos 66 diagnósticos (comparação ignorando apenas linhas/colunas deslocadas); nenhum novo erro.
- `npm run platform:impact -- server/routes.ts` e `-- server/initial-contributions.ts`: executados; contratos de Capital, Alianças, Carteira, Agenda, Pagamentos e fontes de verdade atualizados.
- `npm run platform:contract`: 11 módulos e 98 funcionalidades válidas.
- `npm run test:all`: 252 testes aprovados, 61 arquivos, zero falhas. As últimas extensões de API e calculadora também foram executadas diretamente e passaram.
- `npm run build`: aprovado. Mantidos avisos preexistentes de PostCSS e tamanho do bundle.
- `npm run platform:verify`: interrompido no typecheck pelos 66 erros legados; testes e build executados separadamente. Não declarar o comando completo como aprovado.
- Testes reais de Express com PostgreSQL isolado (PGlite): revisão/concorrência, autorização, SQL aditivo repetido, falha após gravar no Directus simulado e antes de receber resposta, retomada sem duplicar, pagamento durante retomada, pares, reversão e proteção.
- Rota bancária real extraída: rejeita movimento sem caixa, lançamento inexistente e conciliação pendente antes de qualquer chamada ao provedor.
- Modelo 3 na rota real de MAP: nome CPP normalizado pela taxonomia, valor exato, ausência rejeitada, aceite da revisão e PDF antigo byte a byte preservado.
- Planilha: nove participantes, VO 1.500.000, DM 12,5%, contribuição 187.500 e BEI 1.687.500. Ju: CPP 305.000 e cronograma de dinheiro 275.000; calendário e parcelas mistas 400.000 + 960.000 + 140.000. Data anual utilizada no teste é fixture explícita, não valor preenchido no sistema.
- Navegador: componentes reais com dados fictícios isolados; desktop e iframe de 390 px. Campos/valores refluem sem sobreposição. Prévia de parcelas e ação de confirmação conferidas; nenhuma operação financeira real enviada.

## Pendência de implantação integrada

O PostgreSQL configurado recusou conexão (`ECONNREFUSED`). A migração não foi aplicada nesse banco e não houve teste de escrita no Directus real. Os testes isolados não substituem homologação integrada.

Antes de implantar:

1. Restabelecer PostgreSQL/Directus e confirmar as migrações anteriores de MAP (`20260918_initial_map.sql`, `20260918_map_zero_versions.sql`).
2. Aplicar a migração aditiva `migrations/20260918_initial_contributions.sql`; verificar os mesmos campos/índices do bootstrap.
3. Homologar criação de BIA manual e de imóvel, seleção real de `Tipos_CPP`, MOU/PDF e geração de parcelas em uma BIA de teste. Conferir IDs e relações de `fluxo_caixa`, pares, evidências, retomada e proteção de cobrança emitida.
4. Conferir a mesma composição em Capital, Carteira e análises com os dados integrados. Não converter BIAs existentes, reclassificar lançamentos antigos ou reconstruir históricos.

Alterações anteriores e paralelas do workspace foram preservadas.
