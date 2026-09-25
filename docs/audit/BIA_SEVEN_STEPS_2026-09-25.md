# Criação de BIAs em sete etapas — validação local

## Estado da entrega

Relatório da validação local anterior à publicação. Em 2026-09-25 o usuário autorizou explicitamente commit, push, aplicação da migração aditiva e deploy. A preparação repetiu a suíte: **328 testes aprovados no workspace e 327 na cópia isolada da entrega**, incluindo a seleção autorizada de ativos da Carteira. Um teste separado de administração de membros e suas mudanças não fazem parte desta publicação. Contrato e build da cópia isolada aprovados. Backup privado PostgreSQL criado e validado no servidor. A publicação utiliza o runner existente `migrate.cjs`, chamado pelo `start.sh`, com registro transacional. O resultado operacional deve ser confirmado no CapRover e no ledger de migrações; as limitações de homologação real abaixo continuam válidas.

## Fontes e impacto

- Directus mantém identidade, fase e relações oficiais da BIA. PostgreSQL mantém rascunhos, versões econômicas existentes e os novos snapshots jurídicos, de ativos e Governança.
- Cálculos, direitos automáticos, controles e permissões existentes foram reutilizados, sem dependências novas. Funções econômicas continuam com identificadores canônicos, mesmo quando o rótulo visual muda.
- Configuração permite estrutura jurídica/ativos; Governança mantém a chave interna `diretoria`. Banco e indicadores respeitam também as permissões próprias de Capital e as empresariais. Dados restritos são removidos das respostas e do histórico, não apenas ocultados na tela.
- Formalização societária e ativos são informativos: não criam acesso, CPPs, propriedade, cobranças, assinatura obrigatória ou transição operacional. Carteira, documentos emitidos e aceites antigos permanecem preservados.
- A conclusão congela a revisão antes de efeitos externos. A ativação registra a revisão histórica capturada no evento de fase e recupera falhas sem duplicação ou substituição silenciosa de edições posteriores.
- Consumidores revisados: criação/rascunho, detalhe/configuração, Governança, MAP, APIs, PostgreSQL/Directus, convites/aceites, conciliação de fases, resumo PDF e textos novos de MAP Inicial. As integrações de convite/notificação continuam existentes, sem novo disparo pela edição informativa.

## Verificações executadas

- Suíte integral: **323 testes aprovados em 79 arquivos**, zero falhas.
- Persistência e rotas em PGlite isolado: migração, imutabilidade, revisão concorrente, rascunho congelado, recuperação, idempotência, autorização, mascaramento bancário/financeiro, sócio externo e funções acumuladas.
- Regressão de ativação: referência à estrutura original preservada após mudança externa de fase; evento repetido não duplica; recuperação histórica não reverte dados atuais.
- Contrato: **11 módulos e 98 funcionalidades válidos**. Análise de impacto executada antes/depois, incluindo o impacto amplo de `server/routes.ts`.
- TypeScript: **66 diagnósticos**, mantendo a contagem legada. O typecheck não está limpo.
- Build de cliente/servidor aprovado. A execução restrita do esbuild encontrou acesso negado ao diretório pai; repetição autorizada fora dessa restrição. Permanecem avisos de bundle/PostCSS do build.
- `git diff --check` sem problemas de whitespace. Existem avisos de normalização CRLF.
- O comando agregado `platform:verify` não concluiu: `npm.cmd` não estava disponível no runtime utilizado. Contrato, typecheck, testes e build foram executados separadamente; isso não torna o typecheck aprovado.

## Interface e PDF

- Sessão autenticada local conferida após reinício autorizado e novo login do usuário.
- Sete etapas, dados incompletos, navegação para pendências, funções acumuladas/índice zero, quadro societário externo, dois ativos e somatório monetário conferidos com dados fictícios, sem salvar.
- Desktop e largura de 390px verificados: navegação responsiva, tabela MAP com rolagem local, modal PDF com opções acessíveis e sem overflow da página.
- PDF com seleção de Jurídico, Ativos e Documentos; testes cobrem as 127 combinações não vazias. Paisagem, marca personalizada, cabeçalho/rodapé e certificado condicional preservados.
- Amostra fictícia: `output/pdf/bia-sete-etapas-demonstracao.pdf`, sete páginas A4 paisagem. Todas renderizadas e inspecionadas visualmente, com espaçamento, tabelas e rodapés sem sobreposição. Código ausente identificado como “Código após salvar”. Não representa uma BIA real nem certificação.

## Pendências para homologação integrada

1. Autorizar e aplicar a migração aditiva no banco compartilhado, com o procedimento de backup da operação. Não há autorização inferida para alterar esse banco ou publicar em produção.
2. Reiniciar o backend local para carregar os ajustes finais feitos após o primeiro reinício; a interface já recebeu as alterações pelo servidor de desenvolvimento.
3. Homologar gravação/retomada/conclusão e edição de uma BIA de teste nesse ambiente, incluindo convites/aceites e recuperação real. Esses efeitos foram testados em isolamento, não disparados contra membros reais.
4. Conferir impressão física/mobile se necessária. O PDF multipágina foi validado em Chromium e renderização local, não em impressora.

Não foram criados registros reais para esta conferência, nem apagados dados do usuário. A aba de teste foi fechada sem salvar. A migração e a publicação permanecem separadas da implementação local.
