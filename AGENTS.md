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
4. Rode os testes indicados e, quando possível, `npm run platform:verify`.
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
