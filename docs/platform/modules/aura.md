# Aura Percebida

- 04/11/2026: Consultar Aura das ações rápidas do Início abre `AuraLookupDialog` sobre o próprio Início, mantendo URL/aba e restaurando o foco ao fechar. A página Aura usa o mesmo componente, busca, filtros Todos/Posso avaliar, permissões e expansão10a10 ordenada por nome. Selecionar pessoa mantém navegação para sua Aura; `/aura?registrar=1` continua compatível como link direto legado. Gate de membro e diálogo de acesso do Início preservados; leituras só quando modal aberto, sem avaliar/gravar automaticamente. Refatoração não muda endpoints, cadastro, vínculos ou autorização de registro.

## Objetivo e usuarios

Registra percepcoes reputacionais entre membros por palavras ou expressoes, com apoio de IA/audio, e consolida indice, dimensoes e matriz de aplicabilidade.

## Telas e URLs

- `/aura` e `/aura/:membroId`.
- A previa superior de `/meu-perfil` exibe o score, a faixa e o estado da Aura do proprio membro ao lado do nome, com circulo do mesmo diametro da foto; o clique abre `/aura/:membroId`. Sem score, o texto ao lado do círculo é “Aura em formação”.
- `/avaliar-aura/:token` para avaliacao publica controlada de candidato.
- Implementacao principal: `client/src/pages/aura.tsx`, `client/src/pages/avaliar-aura-candidato.tsx`, `client/src/components/aura-score.tsx` e `client/src/lib/aura-access.ts`.

## APIs

- `/api/aura/membros/busca`, `/vinculos`, `/lexico`, `/score/:membroId`.
- `/api/aura/avaliacao/:avaliadoId`, `/avaliar`, `/minhas-avaliacoes`.
- `/api/aura/analisar-texto`, `/extrair-arquivo`, `/transcrever-audio` e leitura contextual.

## Dados e fontes de verdade

- PostgreSQL `aura_avaliacoes` mais lexico/canonicidade em `server/aura-lexico.ts`.
- Comunidades e papeis servem para comprovar vinculo; o score e derivado das avaliacoes validas.
- Texto, arquivo e audio sao entradas de apoio e nao substituem os termos confirmados.

## Papeis e permissoes

- Avaliador autenticado pode avaliar membro quando existe ao menos um vinculo permitido em qualquer comunidade/BIA.
- A verificacao deve percorrer todos os vinculos, sem usar somente comunidade mae ou a primeira comunidade.
- Superadmin segue excecao explicita; candidato publico usa token com escopo, validade e uso controlado.

## Estados e transicoes

- Avaliacao: enviada, validada/incluida ou desconsiderada conforme politica.
- Confianca: inicial, em validacao, validada e consolidada.
- Permissao de microfone: prompt, concedida, negada ou indisponivel; negar nao bloqueia envio de arquivo/texto.
- Convite do novo onboarding: `termos_aceitos -> aguardando_avaliacao_aura` logo apos os aceites quando candidato e aliado conector estao identificados; a avaliacao pode ocorrer enquanto o candidato conclui as demais etapas.

## Invariantes

- Os cinco controles de informação da Matriz de Aplicabilidade abrem por toque/clique/teclado e permanecem abertos até novo acionamento, clique externo ou Escape, com conteúdo contido na largura móvel. Rotas própria e de outro membro compartilham a mesma tela.
- Compatibilidade Cultural mantém a regra existente: média aritmética das convergências T/R/C com evidência; Alta >=70%, Média >=50% e <70%, Baixa <50%. O texto de ajuda mostra os valores usados e esclarece que recorrência de termos não é uma medição direta de valores pessoais. A correção de ajuda não muda score, faixas, avaliações persistidas ou permissões.

- A explicacao do modulo usa um controle de informacao acionavel no cabecalho da pagina, sem poluir as abas ou o menu lateral.
- Aura nao aparece como modulo separado no menu lateral; Inicio e Meu Perfil fornecem os acessos contextuais.
- Um par avaliador/avaliado respeita a unicidade definida no dominio.
- Ate tres termos ou expressoes canonicas por avaliacao.
- Canonizacao, sinonimos, dimensoes e pesos vivem no helper de dominio.
- Backend e frontend usam a mesma regra de vinculo multicomunidade.
- Audio e anexos validam MIME/tamanho e nao ficam publicos.

## Efeitos e dependencias

- Depende de Perfis, Comunidades, BIAs, OpenAI, Arquivos e permissoes do navegador.
- Nova avaliacao invalida score, card, busca e indicadores relacionados.

## Testes e impacto

- `server/aura-lexico.test.ts`
- `server/aura-audio.test.ts`
- Ao alterar: testar palavras/expressoes, usuario em varias comunidades, relacao BIA, duplicidade, permissao negada de microfone e falha de IA.

## Contraste do aviso de vínculo
Descrição do aviso de registro restrito usa âmbar escuro opaco no tema claro e âmbar claro no tema escuro, sem transparência no texto. Mudança visual localizada; vínculo, score e permissões preservados.

O aviso Cobertura e travas da Aura usa fundo âmbar opaco claro/escuro explícito, título/ícone e descrição/motivos com cores correspondentes a cada tema. Evita a mistura do fundo claro translúcido com texto secundário no tema escuro; texto, condição de exibição e regras de cobertura/travas permanecem iguais.

## Lista progressiva no modal — 04/11/2026
Consultar e registrar Aura mostra10 membros inicialmente e botão Ver mais (N restantes) abaixo da lista. Cada clique acrescenta10 membros; busca e reabertura reiniciam o limite. Filtro por nome/empresa/cargo considera todos os resultados retornados, removendo corte visual anterior em20; API preserva seu limite existente de100 por consulta. Lista continua rolável e modal limitado a90dvh no celular. Rotas, permissões, avaliações, IA, áudio, score, e-mails e documentos não mudam.

A lista é ordenada pelo nome exibido com locale pt-BR, sem diferenciar caixa/acentos e ignorando espaços nas extremidades antes de paginar. Isso evita nomes com espaço inicial no topo.
## Entrada única e elegibilidade — 04/11/2026
A ação rápida do Início e o cabeçalho/modal usam Consultar Aura. Link legado /aura?registrar=1 continua abrindo a consulta. Modal oferece Posso avaliar à esquerda e Todos os membros à direita; cada abertura seleciona Posso avaliar, inclusive após fechar tendo escolhido Todos. Mantém busca alfabética e10 itens por expansão. Cada linha indica Pode avaliar, Somente consulta (sem BIA/comunidade em comum), Já avaliado por você, ou conferência/indisponibilidade. Dados ainda não confirmados nunca viram ausência de vínculo. Consulta de vínculos e avaliações usa endpoints autenticados; falha aparece com Tentar novamente.
Posso avaliar usa GET /api/aura/membros/busca?avaliaveis=1: servidor resolve vínculos pela mesma fonte de requireAuraRegisterTarget e exclui avaliações dadas antes de aplicar limite100 e busca. Assim um elegível fora dos100 primeiros da listagem geral pode ser encontrado. Rótulos usam auraLookupState e vínculos confirmados pelo servidor, sem união concorrente com listas de comunidades/BIAs no cliente. Consultas duplicadas dessas listas foram removidas da página; helper antigo permanece para consumidores de compatibilidade. Status já avaliado tem precedência sobre vínculo atual. Nenhuma avaliação é exposta a outro avaliador.
No perfil de outra pessoa, o formulário de percepção aparece diretamente para elegíveis, sem botão intermediário para abrir/fechar o registro. Registro já existente continua consultável e bloqueado para nova avaliação. Não elegível vê motivo da restrição; carregamento/indisponibilidade não oferecem formulário. Backend de gravação/uniquidade/IA/score permanece autorizado pelas guardas existentes. Sem migração, e-mail, notificação, mudança em candidatos públicos ou publicação de dados. Consumidores: painel, modal/perfil Aura, catálogo funcional, busca privada, vínculos e minhas-avaliacoes. Testes aura-lookup e aura-member-search cobrem estados, isolamento/filtro antes do limite e erro503 em vez de vazio falso.
