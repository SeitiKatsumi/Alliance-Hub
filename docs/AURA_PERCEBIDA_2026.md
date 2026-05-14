# Aura Percebida BUILT 2026

Manual interno de referência para cálculo, exibição e interpretação do Índice de Aura Percebida BUILT.

Versão metodológica: `2.0`
Atualização: maio de 2026

## Conceito

A Aura Percebida BUILT é o sistema de validação reputacional entre membros da rede. Ela traduz a percepção dos pares sobre atitudes, entregas e comportamento profissional em um índice de 0 a 100.

Cada avaliação é feita por palavras-chave. O avaliador escolhe até 3 palavras que representem sua percepção real sobre o membro avaliado. Essas palavras são classificadas em dimensões oficiais e consolidadas por frequência entre avaliadores distintos.

## Dimensões

O cálculo usa três dimensões oficiais:

| Dimensão | Peso | Interpretação |
| --- | ---: | --- |
| Técnica (T) | 40% | Qualidade da entrega, conhecimento técnico, método, consistência e capacidade de execução. |
| Relacional (R) | 25% | Clareza, confiança, comunicação, colaboração e capacidade de formar boas alianças. |
| Comportamental (C) | 35% | Ética, alinhamento cultural BUILT, protagonismo, maturidade e atitude proativa. |

As dimensões são transversais. Elas se aplicam a todos os membros, independentemente do núcleo de atuação, papel na BIA ou tipo de entrega. A classificação da palavra permanece padronizada, mas a interpretação prática considera o contexto profissional do membro.

## Processo De Avaliação

Cada avaliador pode registrar até 3 palavras para o membro avaliado. As palavras são normalizadas, agrupadas por palavra-cânone e classificadas em uma das dimensões T, R ou C.

Avaliações são cumulativas e formam um histórico reputacional. O mínimo ideal recomendado para leitura institucional da Aura é de 5 avaliadores distintos.

## Peso Por Frequência

O sistema conta quantos avaliadores distintos citaram a mesma palavra-cânone ou sinônimos associados. A convergência aumenta o peso da palavra.

| Frequência entre avaliadores distintos | Peso |
| ---: | ---: |
| 1 avaliador | 1.0 |
| 2 a 3 avaliadores | 1.5 |
| 4 ou mais avaliadores | 2.0 |

Palavras diferentes dentro da mesma dimensão somam entre si. Repetições da mesma palavra-cânone por avaliadores diferentes reforçam a convergência intersubjetiva.

## Fator De Relevância (FR)

O Fator de Relevância ajusta o cálculo quando as palavras atribuídas refletem características fundamentais do Empresário BUILT.

Para cada dimensão:

```text
FR = 1 + (palavras_alinhadas / total_palavras_da_dimensao) * 0.20
```

Regras:

- Se uma dimensão não tiver palavras, o FR dessa dimensão é `1.00`.
- O FR máximo é `1.20`.
- O FR é calculado separadamente para T, R e C.

Esse ajuste reconhece o alinhamento do membro com valores fundamentais da BUILT sem quebrar a comparabilidade do índice.

## Fórmula Oficial

Com:

- `T`, `R`, `C`: somatório dos pesos das palavras por dimensão.
- `FR_T`, `FR_R`, `FR_C`: fator de relevância de cada dimensão.
- `N`: número de avaliadores distintos.
- `2`: peso máximo possível por palavra.

```text
Aura = [ (T * 0.40 * FR_T) + (R * 0.25 * FR_R) + (C * 0.35 * FR_C) ] / (N * 2) * 100
```

O resultado final é limitado a 100.

## Escala Oficial

| Faixa | Nome | Cor oficial | Interpretação |
| ---: | --- | --- | --- |
| 90-100 | Aura Suprema | Branco / dourado no sistema | Excelência validada. Referência global. |
| 70-89 | Aura Forte | Azul | Autoridade confiável. Recomendado para alianças. |
| 50-69 | Aura Confiável | Verde | Cumpre o que promete. Potencial de evolução. |
| 0-49 | Aura em Evolução | Vermelho | Entrada recente ou reputação ainda sem consistência suficiente. |

## Dados Que Devem Ser Registrados

Para rastreabilidade, o sistema deve manter:

- Versão metodológica do cálculo.
- Versão do léxico usado.
- Número de avaliadores distintos.
- Palavras recebidas e palavra-cânone correspondente.
- Dimensão de cada palavra-cânone.
- Frequência por palavra-cânone.
- FR por dimensão.
- Percentual de correspondência de valores por dimensão.
- Data de cada avaliação.

## Observações De Produto

- O avaliador deve registrar palavras baseadas em experiência real.
- Palavras ofensivas, genéricas ou fora de contexto devem ser desconsideradas.
- O sistema pode usar IA para sugerir palavras do léxico a partir de texto, áudio ou anexo, mas o registro final deve continuar limitado a até 3 palavras.
- A avaliação de Aura em fluxos de aprovação serve como percepção inicial e apoio à decisão do Aliado líder.
