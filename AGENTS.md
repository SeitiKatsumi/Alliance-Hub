# AGENTS.md

Este arquivo define o processo obrigatório para qualquer pessoa ou agente que altere a plataforma BUILT.

## Antes de editar

1. Leia `AI_HANDOFF.md` e rode `git status --short`. Não reverta alterações existentes que não sejam suas.
2. Leia `docs/platform/README.md` e o contrato do módulo afetado em `docs/platform/modules/`.
3. Rode `npm run platform:impact -- <funcionalidade-ou-arquivo>`.
4. Identifique a fonte de verdade antes de alterar um campo, cálculo, status ou permissão.
5. Confirme todos os consumidores: tela, API, PostgreSQL, Directus, e-mail, notificação, PDF, tarefa automática e relatório.

## Regras de mudança

- Regra de negócio deve existir em um helper de domínio compartilhado, não ser recalculada de forma diferente em páginas distintas.
- Permissão visual nunca substitui autorização no backend.
- Um membro pode pertencer a mais de uma comunidade. Nunca use apenas a primeira relação como prova de vínculo global.
- `comunidade_mae` é uma preferência/âncora, não a lista completa de comunidades do usuário.
- Relações da BIA devem considerar IDs normalizados, papéis múltiplos e convites ainda pendentes.
- Valores monetários são números no domínio. Formatação `pt-BR` pertence à entrada/saída da interface.
- Alterar nome visual não implica renomear coluna. Alterar coluna exige migração, compatibilidade e atualização de todos os consumidores.
- Mudanças em status exigem revisar a máquina de estados, filtros, contadores, notificações e histórico.
- Uploads devem validar autenticação, autorização, tamanho, MIME real, extensão e propriedade do recurso.
- PDFs e aceites devem preservar versão, identidade, horário, evidências e codificação UTF-8.
- Nunca use dados do perfil como substituto de evidência capturada no momento de um aceite.
- Não registre segredos, tokens, senhas, documentos ou localização precisa em logs e relatórios de auditoria.

## Mudanças transversais — conclusão obrigatória de ponta a ponta

Quando o usuário pedir para alterar, substituir, renomear ou remover um conceito, campo ou regra, o escopo padrão inclui TODOS os seus usos e dependências ativos na plataforma. O usuário não precisa repetir "em toda a plataforma". Uma correção apenas na tela citada não conclui uma mudança de domínio, salvo quando ele limitar explicitamente o pedido à apresentação/local específico.

1. **Mapeie antes de editar.** Busque com `rg` o nome antigo, o novo, os identificadores técnicos, enums, aliases e valores legados. Siga produtores e consumidores dos dados, inclusive referências indiretas. `platform:impact` é o ponto de partida, não prova de cobertura completa; resultado vazio exige busca manual.
2. **Registre o alcance.** No contrato do módulo ou no `AI_HANDOFF.md`, mantenha uma lista curta dos consumidores encontrados e da decisão para cada um: atualizar, preservar por compatibilidade/histórico com justificativa, ou pendente. Inclua cadastro/edição/detalhe, filtros, pesquisa, dashboards, gráficos, cálculos, API, bancos, integrações, tarefas, notificações, e-mails, PDFs, exportações e relatórios que realmente dependam do conceito.
3. **Atualize o significado, não só o título.** Revise a origem do dado, agrupamentos, percentuais, legendas, filtros, validações e cálculos derivados. Exemplo: substituir Objetivo da Aliança por Tipo de Negócio/tese exige que a alocação use a taxonomia compartilhada e os dados correspondentes; renomear o gráfico enquanto ele continua agrupando por `Venda/Renda/Operação` não atende ao pedido.
4. **Resolva dados existentes explicitamente.** Não invente correspondência quando um valor antigo puder representar várias categorias novas. Defina compatibilidade/mapeamento com evidência e teste; peça a decisão do usuário se houver ambiguidade de negócio. Não renomeie colunas, exclua dados nem execute migrações destrutivas automaticamente. Preserve documentos assinados, aceites e snapshots históricos imutáveis; atualize apenas seus consumidores ativos quando aplicável.
5. **Centralize o domínio.** Use a fonte de verdade e os helpers/taxonomias compartilhados. Não mantenha listas, traduções de enums ou fórmulas concorrentes em telas e endpoints. A abrangência funcional não autoriza mudar permissões, movimentar dinheiro, publicar ou alterar sistemas externos sem a autorização correspondente.
6. **Prove a propagação.** Adicione testes que falhem se o conceito antigo continuar alimentando um consumidor derivado. Cubra o produtor/helper e os consumidores afetados, inclusive agregações e dados legados. Quando houver gráfico, confira categorias, base de cálculo, legenda e total — não apenas o texto do cabeçalho.
7. **Faça a busca de fechamento.** Repita as buscas do item 1, revise cada ocorrência restante e rode impacto, testes indicados e validações aplicáveis. Ocorrências históricas/compatíveis podem permanecer com justificativa; usos ativos contraditórios não podem ser ignorados por estarem em outra tela ou módulo.
8. **Não declare conclusão parcial como completa.** Informe de forma curta o que foi atualizado, o que foi validado e qualquer consumidor pendente/bloqueado. Se faltar decisão, acesso ou autorização, registre a pendência e peça o necessário; não deixe a descoberta para o usuário. Não acrescente textos explicativos na interface sem pedido — esse controle pertence aos contratos, testes e relato da entrega.

### Travas executáveis de conclusão

- Siga `docs/platform/CHANGE_SAFETY.md`. Toda alteração de código/configuração, inclusive manutenção, precisa de um registro do mesmo trabalho em `docs/platform/changes/<id>.json`. Use o modelo `docs/platform/change-review.example.json`; nunca preencha verificações como concluídas por suposição.
- Rode `platform:impact` para nomes antigos/novos e identificadores técnicos. Ele varre os fontes de todo o repositório, inclusive arquivos novos não ignorados, e segue consumidores transitivos. Revise também dependências por API, SQL/Directus, cache, templates e tarefas que não são capturadas pelo grafo de imports.
- Uma renomeação/remoção exige regra em `docs/platform/deprecations.json` e teste de regressão do comportamento. Exceções só por arquivo + linha exata + motivo; nunca libere um diretório inteiro para ocultar ocorrências. Registros antigos, assinaturas e compatibilidade são preservados conscientemente.
- Antes de declarar a tarefa concluída, execute `npm run platform:verify` e `npm run platform:review -- --base <referência-inicial>`. Antes de commit, valide o índice exato com `npm run platform:review -- --staged`. Para commits fechados, use `--base <base> --head <head>`.
- O registro deve cobrir os arquivos alterados/removidos, referências encontradas e seus consumidores; marcar cada uma das dez áreas como verificada ou não aplicável com evidência. Pendência não vira aprovação. Mudança visual localizada também registra a limitação explícita e por que os demais consumidores não mudam.
- Em árvore suja, não ateste alterações paralelas que você não revisou. Valide separadamente o diff autorizado para publicação e informe o que continua bloqueado. Nunca enfraqueça o gate ou invente uma revisão para obter resultado verde.
- A automação verifica ocorrências e cobertura declarada, não compreende sozinha toda regra de negócio. É obrigatório conferir semântica, autorização e dados reais quando aplicável; a responsabilidade pela revisão global continua sendo do agente.

## Checklist de impacto

Para qualquer mudança funcional, responda antes de editar:

- Qual é a fonte oficial da informação?
- Quais papéis podem ver e editar?
- A regra vale para todas as comunidades e BIAs do usuário?
- Quais telas desktop e mobile exibem o resultado?
- Quais endpoints leem ou gravam o campo?
- Existe cópia no PostgreSQL e no Directus?
- Há e-mail, notificação, PDF, webhook ou cron relacionado?
- Há dados legados ou status anteriores que precisam continuar funcionando?
- Qual teste falharia se a regra fosse quebrada?

## Depois de editar

1. Atualize o contrato do módulo quando o comportamento, interface ou fonte de verdade mudar.
2. Adicione ou ajuste o teste de regressão correspondente.
3. Rode `npm run platform:impact -- <arquivo-alterado>` novamente.
4. Rode os testes indicados, `npm run platform:verify` e o gate `platform:review` do diff. Se não puder executar, registre o bloqueio e não declare validação concluída.
5. Verifique desktop e mobile nos fluxos afetados.
6. Informe claramente verificações que não puderam ser executadas.

## Bloqueadores conhecidos

- O baseline de 2026-08-17 possui erros TypeScript legados. Eles estão catalogados em `docs/audit/PLATFORM_AUDIT_2026-08-17.md`.
- Enquanto o typecheck não estiver limpo, nenhuma mudança pode aumentar a contagem de erros.
- `server/routes.ts` concentra muitas responsabilidades. Alterações nesse arquivo exigem impacto amplo e testes do domínio afetado.

## Documentos principais

- Índice: `docs/platform/README.md`
- Arquitetura: `docs/platform/ARCHITECTURE.md`
- Fontes de verdade: `docs/platform/SOURCES_OF_TRUTH.md`
- Glossário: `docs/platform/GLOSSARY.md`
- Contrato estruturado: `docs/platform/platform-contract.json`
- Auditoria: `docs/audit/PLATFORM_AUDIT_2026-08-17.md`
