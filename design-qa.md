# Governança em organograma — QA

- Fonte: C:/Users/ESPC/AppData/Local/Temp/codex-clipboard-df3264dc-44b6-4267-a1ab-42c4f2aa1749.png (979×732px); PDF Organograma BIA renderizado em tmp/pdfs/governance-reference/page.png.
- Implementação: http://localhost:3018/bias/868NEL6DXJ e ?tab=diretoria, sessão existente, somente leitura.
- Capturas: C:/Users/ESPC/Documents/ChatGPT/BUILT/organograma-bia/desktop.png (1280×720); mobile.png (390×844). CSS e pixels1:1. Fonte e renderização comparadas juntas no mesmo resultado visual.
- Diferença intencional: referência documental clara e dados fictícios; interface usa Inter, tokens escuros e Lucide existentes, bordas suaves e condições por vínculo real. Hierarquia é a referência, não a paleta plana do documento. Logo existente da plataforma preservado, nenhuma imagem gerada.
- Tipografia: Inter herdada, nomes14px sem truncamento, rótulos12px, títulos14/16px, entrelinha1.5. Nomes/cargos longos quebram dentro do cartão.
- Espaçamento: padding24desktop/16mobile, quatro colunas em largura útil>=760, árvore vertical abaixo disso. Diretor sobre a linha principal, conselheiro lateral tracejado (indentado no mobile).
- Cores: tokens background/card/border/foreground; Guardião verde e Multiplicador azul por vínculo explícito, ambos visíveis quando aplicável. Vazio=Não atribuído.
- Conteúdo: diretor, aliado, quatro núcleos, autor separado e participantes extras consultáveis. Áreas de atuação do PDF não são pessoas nem permissões; não há vínculo cadastrado que permita distribuí-las por profissão.
- Interações: áreas abrem/fecham por mouse e Enter; Outros participantes lista Luhan sem duplicar os diretores; visao/diretoria reutilizam o mesmo organograma; editor de responsabilidades e MOU preservados. Sem escrita.
- Console: zero erros no navegador. Medida DOM na largura1024: clientWidth=scrollWidth=673, um organograma ativo.

## Histórico de comparação
1. Desktop1280 e mobile390: estrutura e conteúdo conforme intenção; sem overflow observado; fonte e renderização comparadas juntas.
2. [P2] Na largura1024, linha entre diretoria e árvore vertical tinha intervalo e sobra horizontal. Ajustados top/altura/largura e removida limitação max-width do cabeçalho intermediário. Captura pós-correção em organograma-bia/tablet.png (1024×768): conexão contínua da diretoria à árvore, sem sobra. Comparada novamente com a fonte no mesmo resultado visual; P2 resolvido.

## Resultado
Sem achados P0/P1/P2 remanescentes. Comparação da região central suficiente: diagrama não utiliza os selos decorativos do PDF; os ativos de marca do shell permanecem os originais. Teste em390,1024,1280, mouse/teclado, seções recolhidas/abertas e cargos vazios.

final result: passed

## Revisão da opção 1 — paleta discreta e equipes
- Alvo: imagem gerada exec-0a20f3d1-aa76-4879-ad8b-754a2def1ea4.png; desktop com quatro núcleos e versão estreita recolhível.
- Código: cartões neutros, bordas/rótulos suaves por condição; pessoas do roster agrupadas por contribuição oficial do perfil, sem inferir pela profissão. Diretores sem ramo/segmento.
- Testes focados: 9 aprovados; TypeScript aprovado. Verificação completa em .BUILT-tmp/org-redesign-verify.log.
- Bloqueio: navegador integrado indisponível. A ferramenta de Computer Use encerrou a sessão porque não conseguiu determinar a URL atual do navegador com confiança para aplicar sua política. Nenhuma captura da nova implementação foi obtida; a aprovação anterior não se aplica a esta revisão.
- Homologação3018 ainda não atualizada nesta revisão; prévia sintética preparada em127.0.0.1:54818. Não houve commit/push ou produção.

final result: blocked

## 2026-11-03 — Ajuste do limite responsivo do organograma
Captura do usuário mostra 4 núcleos recolhidos indevidamente em cerca de 846px úteis. CSS passa a manter quatro colunas a partir de 700px, com cartões compactos até 999px; abaixo disso permanece o acordeão. Mesmo componente nas duas posições da BIA. Ajuste somente de apresentação, sem dados, API, permissões ou integrações.
Conferência visual automática ainda indisponível (browser.user is unavailable). Captura do usuário é evidência do problema anterior, não prova da nova renderização. Revisão global segue pendente; não representa autorização para produção ou commit.

## 2026-11-03 — Conferência final para commit
A indisponibilidade da sessão autenticada foi contornada para fins de teste exclusivamente por uma página local sintética, renderizando o componente real e o CSS atual. Nenhuma sessão, dado ou permissão de usuário foi reproduzida.
- Chromium isolado, larguras do componente 1100, 900, 760, 390 e 320px; quatro núcleos na mesma linha nas três primeiras, acordeão nas duas últimas. Nenhum overflow horizontal do componente.
- Enter e clique abrem/fecham núcleos; primeiro núcleo preenchido inicia aberto. Diretores não exibem ramo/segmento, equipes exibem; nomes longos quebram, cartões vazios e pessoas com ambas as condições permanecem legíveis. Zero erros de página.
- Capturas atuais inspecionadas: output/governance-commit/900-dark.png, 390-dark.png, 320-dark.png, 1100-light.png. Resultado automatizado em output/governance-commit/results.json. Barra auxiliar do teste removida antes da captura; não integra o produto.
- Captura posterior do usuário codex-clipboard-63cabb44-f5b1-4451-acf1-96c34583619b.png confirma quatro núcleos conectados na homologação autenticada. Não foi feita nova automação dentro da sessão autenticada.
- platform:verify: 721 testes aprovados, zero falhas, tipos e build aprovados. Nenhuma mudança de código após essa execução.
final result: passed (componente real em página sintética; sessão autenticada evidenciada pela captura do usuário)
