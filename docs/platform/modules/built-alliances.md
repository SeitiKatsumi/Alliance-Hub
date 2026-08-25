# Area de Aliancas, Oportunidades e BIAs

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
- `/api/carteira/imoveis/:id/origem-bia*` cria uma BIA rastreada a partir de um imovel e reutiliza aprovacoes e MOU existentes; `/convites-alianca` disponibiliza o aceite para contas limitadas.
- Demandas, distribuicao, feedback, reunioes, rastreabilidade e oportunidades economicas.
- Timer de oportunidade no backend e invalidacoes React Query no frontend.

## Dados e fontes de verdade

- Directus `bias_projetos`, `land_bank_assets` e colecoes legadas de oportunidade.
- PostgreSQL: `bias_projetos` operacional, `oportunidades`, `opportunity_*`, `business_trace_*`, aprovacoes, solicitacoes e permissoes.
- PostgreSQL `bia_imovel_origens` e `bia_map_origem_alocacoes` preservam o imovel, o valor e o MAP inicial imutavel; a BIA continua oficial no Directus.
- Uma entidade espelhada deve declarar a direcao de sincronizacao; ID Directus nao e substituido por codigo publico.

## Papeis e permissoes

- Autor, Aliado BUILT, Diretor de Alianca, diretorias de nucleo, socios e administradores acumulam acessos.
- O ambiente lista somente BIAs relacionadas ao usuario. Participante preserva acesso operacional a sua BIA mesmo sem anuidade vigente, conforme a matriz da propria BIA.
- Maior permissao valida prevalece; papel em uma BIA nao concede acesso a outra.
- Aliado/Diretor responsavel deve conseguir agir em seu fluxo por notificacao/pagina apropriada, sem depender do painel admin.
- Quando o backend autoriza a exclusao, a mesma acao fica disponivel no card da BIA na Carteira; admin e superadmin tambem a veem na lista de BIAs da Area de Aliancas. Toda exclusao exige confirmacao.
- A exclusao remove primeiro os vinculos da BIA com comunidades no Directus para respeitar as chaves estrangeiras; registros historicos locais permanecem preservados.
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
- Uma BIA originada de imovel somente ativa depois que todos os coproprietarios aceitam o MOU; Guardiao/Multiplicador e MAP inicial sao efetivados de forma idempotente.
- Alocacao de MAP de origem participa do helper central, mas nao e receita, aporte ou entrada de caixa.
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
