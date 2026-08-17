# Aura Percebida

## Objetivo e usuarios

Registra percepcoes reputacionais entre membros por palavras ou expressoes, com apoio de IA/audio, e consolida indice, dimensoes e matriz de aplicabilidade.

## Telas e URLs

- `/aura` e `/aura/:membroId`.
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

## Invariantes

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
