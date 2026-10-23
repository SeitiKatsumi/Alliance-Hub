# Mudanças de ponta a ponta

Qualquer alteração inclui todos os usos e dependências ativos, mesmo quando o pedido menciona apenas uma tela. Uma limitação explicitamente pedida pelo usuário deve ser registrada. Renomear um título sem trocar a origem dos dados não conclui uma mudança de domínio.

## Antes de alterar

1. Leia AGENTS, o contrato do módulo e a fonte de verdade. Anote a referência Git inicial e preserve trabalhos paralelos.
2. Execute `npm run platform:impact -- "nome antigo"`, repita para o nome novo, identificadores técnicos, enums e arquivos. Complemente com `rg` para aliases/variações e conexões indiretas.
3. O comando busca em todos os fontes/configurações/documentação versionados ou novos não ignorados, inclusive diretórios ainda não mapeados. Exclui segredos/env, logs, dependências, binários, artefatos gerados e experimentos locais. Mostra somente caminhos/linhas, não conteúdo privado.
4. O grafo segue imports, reexports, require, import dinâmico literal e aliases do tsconfig. Ele não consegue inferir endpoints em strings calculadas, eventos, SQL/Directus, chamadas externas ou semântica de negócio. Revise essas ligações nas dez áreas do registro.
5. Se nenhum módulo estiver mapeado, a varredura global ainda aparece, mas o comando termina com aviso/erro: registre o alcance no contrato. Não interprete falta de mapeamento como ausência de impacto.

## Registro obrigatório

Copie a estrutura de [change-review.example.json](./change-review.example.json) para um arquivo novo em `docs/platform/changes/`. Use o editor normal/aplicação de patch. O modelo fica pendente de propósito: não é uma aprovação pronta.

- Declare fonte de verdade, tipo da mudança e termos pesquisados (antigos, novos e técnicos).
- Cada arquivo alterado e consumidor encontrado recebe decisão: `updated`, `reviewed`, `preserved`, `removed` ou `pending`, sempre com motivo concreto. Sem curingas genéricos para "aprovar tudo".
- Cubra interface, API, dados, cálculos/gráficos, notificações/e-mails, documentos/relatórios, integrações/tarefas, permissões, legado e testes. `not-applicable` exige justificativa; `pending` bloqueia a conclusão.
- Declare os testes reais executados pelo `test:all`. O registro não substitui sua execução.
- Registros são evidência do diff em que foram criados/atualizados. Um registro antigo intocado não aprova alterações novas. Não edite registros históricos só para contornar o gate.
- Mudanças compartilhadas devem centralizar nomenclaturas/regras em helpers, taxonomias ou catálogos já existentes. Não criar listas concorrentes em cada tela.

## Guarda contra reaparecimento

[deprecations.json](./deprecations.json) contém termos descontinuados e seus testes. Toda renomeação/remoção registra uma regra com alcance adequado. O catálogo inicial protege Objetivo da Aliança e a antiga alocação por tipo de negócio; os testes de domínio também protegem a origem dos dados e percentuais.

As buscas ignoram caixa/acentos e incluem arquivos novos. Testes negativos podem mencionar o termo antigo. Uma exceção exige arquivo, texto integral da linha e justificativa. Se a linha mudar, desaparecer ou for duplicada, a exceção falha e precisa de revisão. Isso não libera outros usos no mesmo arquivo.

Colunas físicas, adapters de compatibilidade e documentos assinados não devem ser apagados automaticamente. Migração precisa de plano/autorização; categorias antigas ambíguas não recebem equivalência inventada. A guarda textual complementa os testes de comportamento, não os substitui.

## Comandos de conclusão

```sh
# Guarda global permanente, sem comparar alterações:
npm run platform:consistency
# Contrato + guarda + tipos (app e ferramentas) + todos os testes + build:
npm run platform:verify
# Working tree completo (inclui novos arquivos); padrão: base HEAD:
npm run platform:review -- --base HEAD
# Exatamente o que entrará no commit, sem usar correções fora do índice:
npm run platform:review -- --staged
# Exatamente um intervalo de commits, ignorando mudanças locais:
npm run platform:review -- --base BASE_SHA --head HEAD_SHA
```

`platform:review` sem argumentos também é estrito: compara a árvore de trabalho com HEAD. Considera remoções, ambos os lados de renomeações e consumidores nos grafos atual e anterior. Bloqueia arquivos sem decisão, referências pesquisadas omitidas, áreas pendentes, evidência/teste inexistente e renomeação/remoção sem regra. Falha de Git/leitura/JSON nunca vira aprovação.

Árvore suja pode conter vários trabalhos. Se outras alterações não têm revisão, o gate deve apontá-las; não marcar como aprovadas sem revisar. Para publicar apenas um trabalho autorizado, validar o índice ou intervalo exato correspondente. Não há bypass automático para mudanças antigas ainda não publicadas.

## CI e publicação

O workflow `Validar e publicar no CapRover` passa a validar pull requests para main e pushes. Usa histórico Git completo e o diff base→head, depois executa `platform:verify`. O deploy continua dependendo do job de validação; nunca roda em pull request. Em execução manual/primeiro push sem base fornecida pelo evento, compara HEAD^→HEAD e falha se essa referência não existir.

Esta alteração configura arquivos locais do workflow; só entra em vigor no GitHub após commit/push autorizado. Para impedir também o botão de merge, o administrador deve tornar o status **Validar aplicacao** obrigatório na proteção de main. Isso é uma configuração externa separada; não foi alterada automaticamente. Os gates não autorizam deploy, migração, mensagens ou movimentação financeira fora do pedido.

## Prova e limites

`scripts/platform-change-safety.test.ts` testa regressão textual, exceções estreitas, imports transitivos, consumidores por busca, pendências, remoções, referências inválidas, versões do índice/range e integração com CI. A revisão humana/agente ainda deve julgar o significado das mudanças e a qualidade da evidência. Nenhum script garante sozinho que toda ligação semântica foi descoberta.
