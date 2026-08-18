# BUILT Alliances, Oportunidades e BIAs

## Objetivo e usuarios

Organiza oportunidades, OBAs/OPAs, Banco de Ativos, comunidades e o ciclo completo de estruturacao e operacao de uma BIA.

## Telas e URLs

- `/area-aliancas`, `/area-aliancas/oportunidades/:codigo`.
- `/opas/:id`, `/bias`, `/bias/:id`.
- `/land-bank/:id`, `/oportunidades*`.
- `/rastreabilidade/:codigo`.
- Implementacao principal em `client/src/pages/area-aliancas.tsx`, `client/src/pages/opa-detalhe.tsx`, `client/src/pages/bias.tsx`, `client/src/pages/bia-detalhe.tsx`, `client/src/pages/land-bank-detalhe.tsx` e componentes de estruturacao/distribuicao.

## APIs e tarefas

- `/api/bias*`, `/api/opas*`, `/api/oportunidades*`, `/api/land-bank-assets*`.
- `/api/bia-estruturacao-solicitacoes*`, aprovacoes, diretorias, socios e chamadas.
- Demandas, distribuicao, feedback, reunioes, rastreabilidade e oportunidades economicas.
- Timer de oportunidade no backend e invalidacoes React Query no frontend.

## Dados e fontes de verdade

- Directus `bias_projetos`, `land_bank_assets` e colecoes legadas de oportunidade.
- PostgreSQL: `bias_projetos` operacional, `oportunidades`, `opportunity_*`, `business_trace_*`, aprovacoes, solicitacoes e permissoes.
- Uma entidade espelhada deve declarar a direcao de sincronizacao; ID Directus nao e substituido por codigo publico.

## Papeis e permissoes

- Autor, Aliado BUILT, Diretor de Alianca, diretorias de nucleo, socios e administradores acumulam acessos.
- A finalidade `imoveis` nao substitui o vinculo: quem a selecionou acessa o ambiente somente quando tambem e membro BUILT, aliado, administrador ou funcionario explicitamente autorizado.
- Maior permissao valida prevalece; papel em uma BIA nao concede acesso a outra.
- Aliado/Diretor responsavel deve conseguir agir em seu fluxo por notificacao/pagina apropriada, sem depender do painel admin.
- Backend valida a etapa, o papel e o recurso antes de mutar.

## Estados e transicoes

- Oportunidade: capturada, distribuida, em analise, convertida, encerrada ou descartada com motivo.
- Estruturacao: solicitada, aguardando complementos, complementada, aprovada/rejeitada e convertida.
- BIA: rascunho, em formacao, ativa, suspensa/encerrada conforme regra vigente.
- Transicoes criam evento historico e sao idempotentes.

## Invariantes

- Uma origem preserva rastreabilidade ate a BIA/resultado final.
- Convite pendente nao e membro aceito, mas deve permanecer visivel no papel correto.
- IDs de relacao do Directus podem chegar como string, numero ou objeto e devem ser normalizados.
- Nao apagar ou recriar BIA para sincronizar formulario parcial.
- Abas da BIA persistem em URL para refresh e compartilhamento.

## Efeitos e dependencias

- Gera notificacoes, e-mails, PDFs/MOU, acessos, documentos e eventualmente estrutura financeira.
- Depende de Comunidades, Perfis, Vitrine, Capital, Agenda, Pagamentos e Administracao.

## Testes e impacto

- `shared/bia-access.test.ts`
- `server/bia-lifecycle.test.ts`
- `server/opportunity-platform.test.ts`
- `server/network-opportunities.test.ts`
- `server/business-trace.test.ts`
- Ao alterar: testar cada papel, usuario multicomunidade, refresh de aba, transicao repetida, Directus indisponivel e rastreabilidade.
