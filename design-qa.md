# Design QA — Início sem BUILT Capital

## Evidências

- Fonte visual: `C:\Users\ESPC\AppData\Local\Temp\codex-clipboard-abbf0860-8b66-4d10-aab3-ea0bdaacabeb.png`
- Implementação: `C:\Users\ESPC\AppData\Local\Temp\codex-dashboard-home-no-capital-20260824.png`
- Comparação conjunta: `C:\Users\ESPC\AppData\Local\Temp\codex-dashboard-home-comparison-20260824.png`
- Mobile: `C:\Users\ESPC\AppData\Local\Temp\codex-dashboard-home-no-capital-mobile-20260824.png`
- Fonte: 1017 × 925 px.
- Implementação desktop: viewport e captura de 1024 × 925 CSS px, device scale 1; normalizada por ajuste central para 1017 × 925 px na comparação.
- Implementação mobile: viewport e captura de 390 × 844 CSS px, device scale 1.
- Estado: usuário autenticado, aba Início, menu lateral recolhido e seção de ambientes visível.

## Comparação visual

- Layout e espaçamento: os dois cards ocupam duas colunas iguais e usam toda a largura disponível, sem lacuna residual.
- Tipografia: família, pesos, tamanhos, entrelinhas e hierarquia permanecem iguais ao painel de referência.
- Cores: tokens, contrastes, bordas, sombras e cores de Vitrine e Alliances foram preservados.
- Imagens: os ativos originais e seus recortes foram mantidos, sem perda aparente de nitidez.
- Conteúdo: BUILT Capital foi removido; Vitrine e Alliances mantêm títulos, descrições e ações.
- Responsividade: no mobile os cards empilham sem overflow horizontal; `scrollWidth` e `innerWidth` ficaram em 390 px.
- Região focada adicional: não necessária; a seção alterada está legível por inteiro na comparação conjunta.

## Interações verificadas

- Vitrine abriu `/vitrine`.
- Alliances abriu `/area-aliancas?tab=oportunidades&tipo=demandas`.
- Console verificado sem erros ou avisos durante a validação final.

## Histórico da correção

- P1 inicial: o painel ainda exibia o card BUILT Capital e dividia a seção em três colunas.
- Correção: remoção do card e alteração da grade desktop para duas colunas.
- Evidência posterior: comparação conjunta mostra os dois cards preenchendo a seção; mobile sem overflow.

## Findings

Nenhum P0, P1 ou P2 restante. Não há P3 necessário para esta entrega.

## Implementation Checklist

- [x] Remover BUILT Capital da página inicial.
- [x] Redistribuir Vitrine e Alliances em duas colunas.
- [x] Preservar ações e identidade visual.
- [x] Validar desktop, mobile e destinos dos cards.

final result: passed
