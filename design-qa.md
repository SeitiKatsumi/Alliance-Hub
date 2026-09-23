# Design QA — Equipe e DM em largura total (2026-09-22)

- Fonte: `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-a7389f25-03ec-405f-b2fc-861a68e07da2.png`, 984×700.
- Implementação: `http://localhost:3004/bias/nova`, capturas inline do navegador nesta tarefa (desktop1294×920 e mobile390×844; sem arquivo de captura exportado).
- Comparação conjunta: referência e screenshot final exibidos na mesma chamada. Comparados os blocos de totais e participantes; sidebar/cabeçalho do produto e dados diferentes não são desvios. Mesma etapa, desktop, detalhes recolhidos. Comparação de estrutura/densidade, não pixel a pixel.
- Tipografia: componentes/fontes existentes preservados; totais destacados e rótulos legíveis.
- Espaçamento: faixa superior horizontal, tabela sem coluna lateral, capital e DM visíveis; no mobile empilham sem overflow (scrollWidth=390).
- Cores: superfícies claras, navy, bordas e controles do produto; painel navy removido apenas na etapa2.
- Ativos: nenhuma imagem nova necessária; logo e ícones existentes mantidos.
- Conteúdo: DM por cargo separado, capital único por pessoa; CPPs/natureza e ações expansíveis, aviso de classificação pendente. Totais não duplicados no rodapé por já estarem no topo.
- Interações: capital1500000 e três índices0/1.25/2; CPPs explicitamente selecionadas; MAP Zero mostra DM3.25000%, BEI1548750 e retorno preserva entradas. DOM confirma 1 capital/3 DMs/0 aside; console sem erros. Nenhum salvamento.
- Histórico: primeira comparação confirmou hierarquia; verificação mobile e comparação final preenchida sem P0/P1/P2. Campos de pessoa permanecem seletores funcionais; múltiplos cargos geram linhas separadas como requerido pelo modelo vigente.
- Limite: validação desta alteração visual, não homologação das fases financeiras do plano maior.

final result: passed

---

# Design QA — Dados da BIA sem resumo lateral

## Referência e normalização

- Fonte visual: `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-637f69aa-6f87-4a93-beef-6dfd49a273db.png` (974 × 917 px), estado anterior com o resumo econômico azul.
- Implementação desktop: `C:/Users/ESPC/Documents/New project 2/output/bia-nova-dados-desktop.png` (1292 × 918 px, viewport CSS 1292 × 918, densidade 1:1).
- Implementação mobile: `C:/Users/ESPC/Documents/New project 2/output/bia-nova-dados-mobile.png` (390 × 844 px, viewport CSS 390 × 844, densidade 1:1).
- Comparação integral conjunta: `C:/Users/ESPC/Documents/New project 2/output/bia-nova-dados-comparison.png`.
- Estado: usuário autenticado, `/bias/nova`, primeira etapa `Dados da BIA`, campos vazios e rolagem no topo.

## Verificação por superfície

1. Tipografia e conteúdo — passou. Títulos, rótulos, pesos e textos existentes foram preservados; somente o resumo duplicado saiu da primeira etapa.
2. Espaçamento e layout — passou. O formulário usa toda a largura disponível no desktop. Em 390 px, `scrollWidth=390`, sem corte horizontal.
3. Cores e tokens — passou. A área azul removida não deixou fundo, borda ou espaçamento residual; os controles mantêm os tokens do produto.
4. Imagens e ativos — passou. Logo, ícones e upload de capa existentes permanecem inalterados; nenhum ativo novo foi necessário.
5. Interação e acessibilidade — passou. A navegação entre `Base econômica inicial` e `Dados da BIA` foi exercitada; os controles e rótulos permanecem acessíveis.
6. Console — passou. Nenhum erro foi registrado durante a verificação.

## Comparação focada

- Não foi necessário recorte adicional: o painel removido e a expansão do formulário são claramente legíveis na comparação integral. A consulta ao DOM confirmou `summaryVisible=false` no desktop e no mobile.

## Histórico de iterações

- Primeira comparação pós-implementação: nenhum P0/P1/P2 encontrado. O formulário passou a ocupar a largura liberada, sem alterar a ordem dos campos ou as etapas seguintes.

final result: passed

---

# Design QA — Início com melhor aproveitamento do espaço

## Referência e normalização

- Referência: `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-59a6e689-8a57-4961-8725-c312ff93834b.png` (534 × 348).
- Implementação: `C:/Users/ESPC/Documents/New project 2/.codex-tmp/design-qa/home-after-viewport.png` (1329 × 920).
- Mobile: `C:/Users/ESPC/Documents/New project 2/.codex-tmp/design-qa/home-mobile.png` (390 × 844).
- Comparação lado a lado: `C:/Users/ESPC/Documents/New project 2/.codex-tmp/design-qa/home-comparison.png`.
- Estado comparado: usuário autenticado, aba Início, dados do dashboard carregados e rolagem no topo.
- Critério: composição, hierarquia e densidade equivalentes; não foi exigida cópia pixel a pixel da referência reduzida.

## Verificação por superfície

1. Composição e hierarquia — passou. Insight, ambientes e três painéis operacionais formam a coluna principal; perfil e ações rápidas ocupam a coluna lateral sem gerar vazio entre as seções.
2. Interação e estados — passou. As abas Início e Negócios para você foram acionadas no navegador; cartões mantêm seus destinos e estados vazios continuam acionáveis.
3. Responsividade — passou. Em 390 × 844 as seções empilham sem corte horizontal e a navegação continua utilizável.
4. Polimento visual — passou. Ações rápidas foram compactadas para três colunas e os painéis Alertas, Próximas ações e Negócios em foco mantêm alinhamento e contraste do sistema existente.
5. Integridade e segurança — passou. Os negócios usam somente convergências já autorizadas pelo dashboard; nenhuma nova fonte de dados ou permissão foi criada. Console do navegador sem erros.

## Histórico de iterações

- Iteração 1: compactação das ações rápidas e inclusão de Negócios em foco; o vazio ainda persistia porque os painéis operacionais começavam após a altura total da coluna lateral.
- Iteração 2: a coluna lateral passou a ocupar duas linhas do grid e os três painéis foram posicionados diretamente abaixo dos ambientes; a comparação visual confirmou o preenchimento correto.

final result: passed

---

# Design QA — Alterar senha no topo de Conta e segurança

## Referência e normalização

- Fonte visual: `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-6d563d74-a6e0-4805-8300-bbf46cd965dc.png` (1090 × 917 px), estado anterior em que o formulário ficava abaixo do resumo lateral.
- Implementação desktop: `C:/Users/ESPC/Documents/New project 2/output/design-qa/meu-perfil-security-desktop-1366.png` (1366 × 917 px, viewport CSS 1366 × 917, densidade 1:1).
- Implementação mobile: `C:/Users/ESPC/Documents/New project 2/output/design-qa/meu-perfil-security-mobile-390.png` (390 × 844 px, viewport CSS 390 × 844, densidade 1:1).
- Comparação conjunta: `C:/Users/ESPC/Documents/New project 2/output/design-qa/meu-perfil-security-comparison.png` (2456 × 917 px); as duas capturas desktop foram alinhadas pela altura, sem reamostragem.
- Estado: usuário autenticado, editor `Conta e segurança` aberto e rolagem no topo.

## Verificação por superfície

1. Tipografia e cores — passou. O formulário reutiliza os mesmos componentes, pesos, azul, slate e estados de foco existentes.
2. Espaçamento e hierarquia — passou. `Alterar senha` inicia a coluna principal e antecede `Meu Convite`; o resumo continua na lateral no desktop.
3. Responsividade — passou. Em 390 × 844 o formulário aparece imediatamente após o título, empilha os três campos e não cria rolagem horizontal.
4. Imagens e ícones — passou. Avatar e ícones existentes foram preservados; nenhum ativo novo foi criado.
5. Conteúdo e interação — passou. Os três campos, controles individuais de visibilidade e botão mantêm os mesmos rótulos, estados e handler; nenhuma senha foi preenchida ou enviada durante a verificação.
6. Console — passou. Nenhum erro ou aviso foi registrado.

## Comparação focada

- A comparação integral mostra a mudança solicitada com clareza: o espaço vazio da coluna principal passou a conter o formulário no topo. A captura mobile serviu como comparação focada da ordem e do empilhamento dos campos.

## Histórico de iterações

- Iteração 1 — [P2] em larguras abaixo de `xl`, o resumo ainda aparecia antes da senha. Correção: a categoria Conta e segurança passou a renderizar o resumo depois da coluna principal.
- Iteração 2 — evidência pós-correção em `meu-perfil-security-mobile-390.png`: senha no topo, convite logo abaixo, sem overflow e sem P0/P1/P2 restante.

final result: passed

---

# Design QA — Central do Meu Perfil por categorias

## Referência e normalização

- Fonte visual: `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-231eaeb0-e6d5-42bd-bf89-ef9168a30c21.png` (1034 × 705 px).
- Implementação renderizada: `C:/Users/ESPC/Documents/New project 2/.codex-tmp/meu-perfil-hub-desktop-1440.png` (1440 × 1024 px, viewport CSS 1440 × 1024, deviceScaleFactor 1).
- Mobile renderizado: `C:/Users/ESPC/Documents/New project 2/.codex-tmp/meu-perfil-hub-mobile.png` (390 × 844 px, viewport CSS 390 × 844, deviceScaleFactor 1).
- Comparação conjunta: `C:/Users/ESPC/Documents/New project 2/.codex-tmp/design-qa-comparison.png` (2068 × 700 px). A implementação foi reduzida proporcionalmente para 1034 × 735 e comparada pelo recorte superior de 665 px; a faixa inferior da referência foi removida porque continha sobreposição da interface do chat, não do produto.
- Estado: usuário autenticado, `/meu-perfil`, dados carregados, central no topo e menu lateral aberto no desktop.

## Verificação por superfície

1. Fontes e tipografia — passou. A implementação reutiliza Inter e os pesos do sistema existente; títulos, descrições, estados e ações preservam a hierarquia e a densidade da referência.
2. Espaçamento e ritmo — passou. Cabeçalho compacto, progresso, grade 2 × 2, recomendação e prévia ocupam as mesmas regiões da referência. No mobile, tudo empilha sem sobreposição nem rolagem horizontal.
3. Cores e tokens — passou. Navy, azul, superfícies brancas/slate e estados verde/âmbar reutilizam os tokens atuais da BUILT. Contraste do botão primário foi corrigido antes da aprovação.
4. Imagens e ativos — passou. A sidebar mantém a logo oficial já usada no produto; avatar e marca continuam usando os assets reais do perfil com fallback existente. Nenhum placeholder gráfico ou SVG artesanal foi criado.
5. Cópia e conteúdo — passou. Rótulos principais seguem a referência. Percentual, pendências, recomendações, nome, áreas e renovação permanecem dinâmicos e por isso podem divergir dos valores ilustrativos da imagem.
6. Ícones — passou. A tela reutiliza a família de ícones instalada e já adotada pelo produto, com tamanho, traço e alinhamento consistentes.
7. Interações — passou. Foram testados `Continuar preenchimento`, os quatro cartões, retorno à central e o link profundo `?campo=biografia`; cada ação abriu somente o editor correto e o link moveu o foco ao campo.
8. Responsividade e acessibilidade — passou. Viewport 390 × 844 sem overflow horizontal; botões semânticos, foco visível, rótulos e áreas de toque foram preservados.
9. Console — passou. Nenhum erro ou aviso foi registrado durante a central e os editores testados.

## Comparação focada

- A comparação integral permaneceu legível para cabeçalho, progresso, cartões, recomendação e prévia. Os editores foram verificados separadamente por seletores visíveis porque não aparecem na referência da central; não foi necessário gerar recortes adicionais.

## Histórico de iterações

- Iteração 1 — [P2] o texto do botão primário herdava a cor slate do formulário e a barra podia ser capturada no início da transição. Correções: exceção explícita de contraste para `btn-continuar-perfil` e remoção da transição inicial da largura.
- Iteração 2 — evidência pós-correção em `design-qa-comparison.png`: composição equivalente, contraste correto, barra estabilizada e nenhum P0/P1/P2 restante.

## Follow-up polish

- [P3] O círculo do percentual usa o tratamento simples do sistema, sem reproduzir o arco parcial ilustrativo da referência. A leitura e a barra linear preservam o estado real sem introduzir um componente gráfico novo.

final result: passed

---

# Design QA — Estado de perfil 100% completo

## Referência e normalização

- Fonte visual: `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-73390fa1-99c1-4790-bcb1-c71b4944f326.png` (1387 × 926 px).
- Estado esperado: usuário autenticado, `/meu-perfil`, perfil em 100%; cartões e prévia permanecem, enquanto progresso e próxima etapa não aparecem.
- Implementação renderizada: bloqueada antes da captura porque a sessão local autenticada expirou ao atualizar a página.
- Viewport, densidade, comparação conjunta e recorte focado: bloqueados pela mesma ausência de sessão.

## Verificação disponível

- Regra: passou nos testes do cálculo oficial de completude; perfil completo retorna 100% e nenhuma pendência.
- Build e contrato: passaram.
- Comparação visual, responsividade, interação e console: pendentes de uma sessão autenticada no navegador local.

## Histórico de iterações

- Iteração 1 — progresso e recomendação passaram a ser renderizados somente quando `missing.length > 0`.
- Bloqueador — a rota autenticada redireciona para o login, impedindo a captura pós-alteração e a comparação conjunta exigida.

final result: blocked

---

# Design QA — Prévia superior do Meu Perfil com Aura

## Referência e normalização

- Fonte visual: `C:/Users/ESPC/.codex/generated_images/01a0339c-f577-7c10-95c1-c374c81295e6/exec-697bcb0b-fae6-4208-b338-5b380b390b2a.png` (1487 × 1058 px).
- Implementação renderizada: `C:/Users/ESPC/Documents/New project 2/output/design-qa/meu-perfil-desktop-1440.png` (1440 × 1024 px, viewport CSS 1440 × 1024, densidade 1:1).
- Mobile renderizado: `C:/Users/ESPC/Documents/New project 2/output/design-qa/meu-perfil-mobile-390.png` (390 × 844 px, viewport CSS 390 × 844, densidade 1:1).
- Comparação integral conjunta: `C:/Users/ESPC/Documents/New project 2/output/design-qa/meu-perfil-comparison.png`.
- Comparação focada do cabeçalho: `C:/Users/ESPC/Documents/New project 2/output/design-qa/meu-perfil-header-comparison.png`.
- Estado: usuário autenticado, `/meu-perfil`, perfil completo, menu lateral aberto no desktop e dados reais carregados. A referência usa Aura 82; a conta de verificação está com Aura em formação.

## Verificação por superfície

1. Fontes e tipografia — passou. A implementação reutiliza a tipografia e os pesos do produto; nome, faixa da Aura, renovação, estados e ações preservam a hierarquia do mock.
2. Espaçamento e ritmo — passou. A prévia ocupa toda a largura antes da grade 2 × 2. Foto, identidade, Aura, áreas, renovação e completude mantêm os mesmos agrupamentos da referência. Em 390 px os blocos empilham sem corte horizontal.
3. Cores e tokens — passou. Navy, azul, slate, verde e âmbar reutilizam os tokens existentes. O trilho da Aura em formação recebeu contraste próprio sobre a superfície branca.
4. Imagens e ativos — passou. A foto real e o logo oficial foram preservados; nenhum placeholder, desenho CSS ou SVG artesanal foi criado. Foto e círculo da Aura medem exatamente 105,59 × 105,59 px na renderização desktop.
5. Cópia e conteúdo — passou. Rótulos, áreas e renovação vêm das fontes reais. A diferença `82 / Aura Forte` versus `Em formação` é dinâmica e esperada para a conta usada na verificação.
6. Ícones — passou. A tela mantém a família instalada e os componentes oficiais `AuraScore`, `CheckCircle2` e `ArrowRight`.
7. Interações — passou. Foram testados abertura de `Identidade e contato`, retorno à central e navegação do cabeçalho para `/aura/:membroId`.
8. Responsividade e acessibilidade — passou. Não há overflow horizontal em 390 × 844; links e botões preservam foco visível, rótulos acessíveis e áreas de toque. No celular, a Aura empilha dentro da mesma prévia para acomodar o nome longo e os dois círculos de 96 px.
9. Console — passou. Nenhum erro ou aviso foi registrado na central, no editor testado ou no acesso à Aura.

## Comparação focada

- A comparação do cabeçalho confirmou a mesma ordem visual da referência: foto, nome/cargo, Aura, áreas, renovação e completude. O círculo oficial e a foto possuem o mesmo diâmetro renderizado.

## Histórico de iterações

- Iteração 1 — [P2] no estado sem score, o trilho original do `AuraScore` ficava invisível sobre fundo branco. Correção: contraste slate aplicado somente ao primeiro círculo dentro de `profile-preview-aura`.
- Iteração 2 — evidência pós-correção nas comparações integral e focada: círculo visível, diâmetros equivalentes, hierarquia preservada e nenhum P0/P1/P2 restante.

## Follow-up polish

- [P3] A implementação usa a densidade vertical já adotada pela central existente, ligeiramente mais compacta que o mock, sem alterar a hierarquia aprovada.

final result: passed

---

# Design QA — Porcentagem no Índice da BEI

## Referência e normalização

- Fontes visuais: `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-6ad819a7-2720-40e7-af90-3007def11515.png` (179 × 444 px) e `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-41d4cb52-56e0-4ab3-9136-7b78bd1cbc0d.png` (938 × 643 px).
- Implementação desktop: `C:/Users/ESPC/Documents/New project 2/output/bia-index-percent-desktop-full.png` (1277 × 2856 px; viewport CSS 1292 × 918; densidade 1:1).
- Implementação mobile: `C:/Users/ESPC/Documents/New project 2/output/bia-index-percent-mobile.png` (390 × 844 px; viewport CSS 390 × 844; densidade 1:1).
- Comparação conjunta: `C:/Users/ESPC/Documents/New project 2/output/bia-index-percent-comparison.png` (1872 × 799 px).
- Estado: usuário autenticado em `/bias/nova`, etapa 2 `Base econômica inicial`, bloco 7 `Divisor Multiplicador`, com três cargos.

## Verificação por superfície

1. Tipografia e cópia — passou. O cabeçalho continua `Índice`; o rótulo acessível e o rótulo mobile informam `Índice (%)`.
2. Espaçamento — passou. O sufixo `%` fica dentro do campo, alinhado à direita, com espaço reservado para não sobrepor o valor digitado.
3. Cores — passou. O sufixo reutiliza `text-muted-foreground`, mantendo a hierarquia visual existente.
4. Dados e cálculo — passou. O `%` é somente unidade visual; o valor persistido continua numérico e a fórmula existente permanece inalterada.
5. Responsividade — passou. Os três sufixos aparecem no desktop e no celular; em 390 px, `scrollWidth` e `innerWidth` são 390 px, sem overflow horizontal.
6. Acessibilidade — passou. Os três campos foram encontrados pelo nome acessível `Índice (%) — beneficiário — cargo`; o sufixo decorativo usa `aria-hidden`.
7. Console — passou. Nenhum erro foi registrado durante a validação.

## Comparação focada

- A referência já enquadra integralmente o bloco 7. A comparação conjunta confirma os três campos de índice com `%`, preservando colunas, linhas, total e equivalência econômica.

## Histórico de iterações

- Iteração 1 — sufixo `%` adicionado no ponto de uso dos campos de índice, sem criar abstração nova; nenhum P0/P1/P2 restante.

final result: passed

---

# Design QA — Cotas Iniciais antes da capitalização

## Referência e normalização

- Fonte visual: `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-4dd6466d-e599-4e4f-8489-28160433d421.png` (978 × 590 px), estado anterior com CIs duplicadas por instrumento.
- Implementação desktop: `C:/Users/ESPC/Documents/New project 2/output/bia-ci-instruments-desktop.png` (1277 × 907 px; viewport CSS 1292 × 918; densidade 1:1).
- Implementação mobile: `C:/Users/ESPC/Documents/New project 2/output/bia-ci-instruments-mobile.png` (390 × 844 px; viewport CSS 390 × 844; densidade 1:1).
- Comparação conjunta: `C:/Users/ESPC/Documents/New project 2/output/bia-ci-instruments-comparison.png` (1932 × 757 px).
- Estado: usuário autenticado em `/bias/nova`, etapa `Base econômica inicial`, instrumento expandido e formulário sem salvar.

## Verificação por superfície

1. Tipografia e cópia — passou. A sequência visível é `3. Cotas Iniciais — CI` e `4. Forma de capitalização`; instrumentos exibem somente `Instrumento` e `Valor`.
2. Espaçamento e layout — passou. A linha de instrumentos usa duas colunas no desktop e empilha no celular; o total exibe somente o valor monetário.
3. Cores e tokens — passou. Cartões, bordas, campos e faixa de total preservam os tokens existentes.
4. Imagens e ativos — não se aplica; nenhum ativo foi adicionado ou substituído.
5. Conteúdo e regra — passou. Existe um único campo acessível `Total de CIs`; não existe campo de CIs por instrumento. As CIs internas são derivadas pelo cálculo compartilhado.
6. Responsividade e acessibilidade — passou. Em 390 px, `scrollWidth=innerWidth=390`; rótulos reaparecem, campos empilham e a ordem dos oito títulos permanece correta.
7. Interação — passou. O grupo de instrumentos abre e fecha e as ações existentes permanecem disponíveis; nenhuma gravação foi executada.
8. Console — passou. Nenhum erro foi registrado durante a validação.

## Comparação focada

- A comparação conjunta enquadra diretamente os blocos afetados: a terceira coluna e o total de CIs dos instrumentos foram removidos, enquanto o bloco único de Cotas Iniciais aparece antes da capitalização.

## Histórico de iterações

- Iteração 1 — implementação e comparação pós-alteração sem P0/P1/P2 restante.

final result: passed

---

# Design QA — Cargo para Função na BEI

## Referência e normalização

- Fonte visual: `C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-3900e0d2-b746-498b-b95b-653c84efba9b.png` (942 × 765 px), estado anterior com “Cargo/Cargos”.
- Implementação desktop: `C:/Users/ESPC/Documents/New project 2/output/bia-function-label-desktop.png` (1277 × 907 px; viewport CSS 1292 × 918).
- Implementação mobile: `C:/Users/ESPC/Documents/New project 2/output/bia-function-label-mobile.png` (390 × 844 px; viewport CSS 390 × 844).
- Comparação conjunta: `C:/Users/ESPC/Documents/New project 2/output/bia-function-label-comparison.png` (1756 × 728 px).
- Estado: usuário autenticado em `/bias/nova`, etapa `Base econômica inicial`, bloco 5 expandido e formulário sem salvar.

## Verificação por superfície

1. Cópia — passou. Resumo, grupo, rótulos, confirmações e ações usam “Função/Funções”; a orientação do bloco 7 usa “índice por função”.
2. Hierarquia e layout — passou. Campos, colunas, espaçamento e ordem do bloco permanecem iguais à referência.
3. Dados e regra — passou. A mudança é visual; a chave interna `cargo`, valores canônicos, cálculos e persistência foram preservados.
4. Responsividade — passou. Em 390 px, `scrollWidth=innerWidth=390`; campos empilham sem rolagem horizontal.
5. Acessibilidade — passou. Os três seletores são anunciados como `Função` e as ações como `Remover função`/`Adicionar função`.
6. Console — passou. Nenhum erro foi registrado durante a validação desktop/mobile.

## Comparação focada

- A comparação conjunta mostra a troca direta de “Cargo/Cargos” por “Função/Funções” sem alterar a estrutura do bloco ou os valores selecionados.

## Histórico de iterações

- Iteração 1 — troca textual mínima e validação responsiva concluídas sem P0/P1/P2 restante.

final result: passed
