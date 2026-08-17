# Auditoria Integral da Plataforma

**Versao:** 2026-08-17
**Escopo:** repositorio completo, PostgreSQL e Directus em leitura, contratos frontend/API, regras de negocio, seguranca, desempenho e validacao visual disponivel.
**Regra desta etapa:** nenhum comportamento ou dado de negocio foi corrigido. Somente documentacao, inventario e verificadores foram adicionados.

## Resultado executivo

O sistema possui boa cobertura de testes de dominio (99 testes passando) e o build de producao conclui, mas isso atualmente mascara falhas relevantes: o typecheck encontra 71 erros, a API concentra 327 endpoints em um arquivo com mais de 24 mil linhas e existem limites de autorizacao ausentes em rotas privilegiadas.

| Severidade | Quantidade | Leitura executiva |
| --- | ---: | --- |
| P0 | 14 | Acesso indevido, perda/corrupcao de dados ou indisponibilidade exploravel |
| P1 | 24 | Regra financeira, permissao, integridade ou fluxo critico incorreto |
| P2 | 10 | Inconsistencia funcional, visual, cobertura ou manutencao relevante |
| P3 | 2 | Desempenho e divida estrutural preventiva |
| **Total** | **50** | Itens independentes ou grupos com a mesma causa-raiz |

Os cinco primeiros lotes recomendados permanecem: (1) verificacoes obrigatorias; (2) seguranca e integridade; (3) financeiro; (4) ciclos de vida e sincronizacao; (5) interface, mobile e desempenho.

## Baseline verificavel

- `npm run build`: passa; bundle principal medido em aproximadamente 2,68 MB (cerca de 706 KB gzip).
- `npm run check`: falha com 71 erros TypeScript em 19 arquivos; 34 estao em `server/routes.ts`.
- `npm run test:all`: 99/99 testes passam, incluindo quatro arquivos antes ausentes da suite agregada.
- Inventario automatico: 64 rotas frontend, 327 endpoints Express e 60 tabelas Drizzle.
- PostgreSQL: 71 tabelas encontradas; 11 nao possuem declaracao Drizzle.
- Directus: colecoes criticas presentes, mas o codigo referencia simultaneamente `Tipos_CPP` e `tipos_cpp`; somente a primeira foi encontrada.
- Leitura de schema de `land_bank_assets` no Directus retornou 403; nenhuma escrita foi realizada.
- Visual: login validado em 1440x900 e 390x844 sem overflow horizontal; as rotas protegidas nao exibiram conteudo sem sessao. A sessao disponivel estava deslogada, portanto a matriz visual por papel ficou adiada.
- Seguranca: varredura Codex Security `db7c3198-260a-4f3f-8e3d-8778d7224a6d`, 18 achados validados, cobertura parcial pelas limitacoes acima.

## Achados P0

### AUD-001 - Administracao de usuarios sem autenticacao

- **Modulo/usuarios:** Administracao; toda a plataforma.
- **Atual/esperado:** `/api/users` lista, cria, altera e exclui contas sem sessao; somente superadmin deveria executar essas operacoes.
- **Evidencia/reproducao:** `server/routes.ts:21020`, `server/routes.ts:21349`, `shared/schema.ts:725`; POST anonimo aceita `role`, `permissions` e `password`.
- **Dados/APIs:** PostgreSQL `users`; `/api/users*`.
- **Risco de corrigir:** medio; o painel admin e fluxos internos podem depender do contrato amplo atual.
- **Solucao/testes:** guard unico de superadmin, DTOs separados, auditoria; testes 401 anonimo, 403 membro e transicoes de papel.
- **Dependencias:** AUD-015, AUD-034.

### AUD-002 - Escape de caminho em chamadas privilegiadas do Directus

- **Modulo/usuarios:** Integracoes e arquivos; anonimos e autenticados.
- **Atual/esperado:** IDs decodificados entram em URLs com token de servico; IDs deveriam ser segmentos canonicos e autorizados.
- **Evidencia/reproducao:** `server/routes.ts:1088`, `server/routes.ts:3906`, `server/routes.ts:18984`, `server/routes.ts:21330`; segmentos relativos codificados podem normalizar para outro endpoint.
- **Dados/APIs:** Directus `/assets` e `/items/*`.
- **Risco de corrigir:** baixo para IDs validos; alto se existirem IDs legados fora de UUID.
- **Solucao/testes:** UUID estrito, codificacao, rejeicao de barras/dot segments e token minimo; testes de traversal codificado.
- **Dependencias:** AUD-005, AUD-013.

### AUD-003 - Upload pode alocar cerca de 5 GB por requisicao

- **Modulo/usuarios:** Arquivos, Aura, Carteira, Financeiro; servidor inteiro.
- **Atual/esperado:** `memoryStorage`, 500 MB por arquivo e dez arquivos; autorizacao e limite agregado deveriam ocorrer antes do buffering.
- **Evidencia/reproducao:** `server/routes.ts:2693`, `server/routes.ts:3927`, `server/routes.ts:11277`, `server/routes.ts:24266`; mensagem informa 10 MB, limite real e 500 MB.
- **Dados/APIs:** `/api/upload` e rotas multipart.
- **Risco de corrigir:** medio; uploads grandes existentes precisam de streaming/migracao.
- **Solucao/testes:** autenticar antes do parser, streaming, limite real pequeno, `Content-Length`, rate limit e teste concorrente.
- **Dependencias:** AUD-004.

### AUD-004 - Upload anonimo persiste arquivo com token de servico

- **Modulo/usuarios:** Onboarding e arquivos; qualquer visitante.
- **Atual/esperado:** `/api/upload` nao exige identidade e aceita extensao **ou** MIME declarado; upload deveria ter capability curta, finalidade e proprietario.
- **Evidencia/reproducao:** `server/routes.ts:2693`, `server/routes.ts:3927`, `client/src/pages/login.tsx:557`.
- **Dados/APIs:** Directus Files; `/api/upload`.
- **Risco de corrigir:** medio, pois cadastro pre-login usa o endpoint.
- **Solucao/testes:** capability assinada de onboarding, assinatura real do arquivo, quarentena e ownership; testar spoof de MIME.
- **Dependencias:** AUD-003, AUD-005.

### AUD-005 - Proxy publico ignora autorizacao do arquivo

- **Modulo/usuarios:** Documentos, Financeiro, Vitrine e Carteira.
- **Atual/esperado:** conhecer `fileId` permite download com token de servico; acesso deveria derivar do recurso pai.
- **Evidencia/reproducao:** `server/routes.ts:3906`, duplicatas em `server/routes.ts:4184` e `server/routes.ts:21212`; a rota protegida da Carteira em `server/routes.ts:14422` mostra o padrao correto.
- **Dados/APIs:** `/api/files/:fileId`, `/api/assets/:id`, Directus Files.
- **Risco de corrigir:** alto se URLs publicas usam o proxy generico.
- **Solucao/testes:** separar midia publica, autorizar privado por parent/tenant e URL curta; revogacao deve invalidar download.
- **Dependencias:** AUD-002, AUD-009.

### AUD-006 - Conta comum recebe PII integral de membros

- **Modulo/usuarios:** Membros e comunidades; todos os autenticados.
- **Atual/esperado:** `fields=*` expoe identidade, familia, contato e endereco sem escopo; deveria existir projecao minima por finalidade.
- **Evidencia/reproducao:** `server/routes.ts:4483`, `server/routes.ts:4588`, `server/routes.ts:4724`.
- **Dados/APIs:** Directus `cadastro_geral`; `/api/membros*`.
- **Risco de corrigir:** alto; telas podem consumir campos nao documentados.
- **Solucao/testes:** DTO publico/proprio/admin, escopo por todas as comunidades e mascaramento; testes cross-community.
- **Dependencias:** AUD-015, AUD-042.

### AUD-007 - BIA publica devolve projecao interna e flag ausente publica

- **Modulo/usuarios:** Alliances; visitantes.
- **Atual/esperado:** `fields=*`, anexos e `bia_publica !== false`; publicacao deveria ser opt-in e sanitizada.
- **Evidencia/reproducao:** `server/routes.ts:5329`, `server/routes.ts:5365`, `server/routes.ts:8721`, `shared/schema.ts:766`.
- **Dados/APIs:** Directus `bias_projetos`; APIs publicas de BIA.
- **Risco de corrigir:** medio; listagens publicas podem mudar.
- **Solucao/testes:** exigir `=== true`, DTO allowlist, anexos separados e migracao default-private.
- **Dependencias:** AUD-005, AUD-008.

### AUD-008 - Analise de IA le e transmite BIA privada sem autorizacao

- **Modulo/usuarios:** Alliances/IA; visitantes e titulares de BIAs privadas.
- **Atual/esperado:** `/api/analyze/bia/:id` busca e envia o registro completo sem `canViewBia`; deveria reutilizar autorizacao e minimizacao.
- **Evidencia/reproducao:** `server/routes.ts:18984`; `JSON.stringify(bia)` entra no prompt e `bia` volta na resposta.
- **Dados/APIs:** Directus `bias_projetos`, provedor de IA.
- **Risco de corrigir:** baixo.
- **Solucao/testes:** sessao, `canViewBia`, DTO minimo e retirada do objeto bruto; teste anonimo/privado.
- **Dependencias:** AUD-007.

### AUD-009 - Papel global permite excluir BIA alheia

- **Modulo/usuarios:** Alliances; Aliados e portadores de selo global.
- **Atual/esperado:** `canDeleteBia` aceita papel/selo antes do vinculo ao alvo; exclusao deveria ser target-scoped.
- **Evidencia/reproducao:** `server/routes.ts:5510`, `server/routes.ts:9424`.
- **Dados/APIs:** DELETE de `bias_projetos`.
- **Risco de corrigir:** medio; poderes historicos de Aliado mudarao.
- **Solucao/testes:** papel normalizado na BIA ou superadmin, soft-delete e auditoria; teste com duas comunidades.
- **Dependencias:** AUD-015, AUD-042.

### AUD-010 - Qualquer usuario autenticado administra comunidades

- **Modulo/usuarios:** Comunidades; todos os autenticados.
- **Atual/esperado:** CRUD verifica apenas sessao e aceita relacoes arbitrarias; deveria exigir gestao na comunidade alvo.
- **Evidencia/reproducao:** `server/routes.ts:21544`, `server/routes.ts:21633`, `server/routes.ts:21702`.
- **Dados/APIs:** Directus comunidades e relacoes.
- **Risco de corrigir:** alto; fluxos admin e convites podem usar as mesmas rotas.
- **Solucao/testes:** `canManageCommunity`, validacao de relacoes e protecao do ultimo gestor; matriz multicomunidade.
- **Dependencias:** AUD-006, AUD-042.

### AUD-011 - CRUD financeiro privilegiado e publico

- **Modulo/usuarios:** Capital; qualquer visitante.
- **Atual/esperado:** categorias/tipos e estudos usam Directus com token de servico sem sessao/ownership; deveriam exigir BIA e capability.
- **Evidencia/reproducao:** `server/routes.ts:11839`, `server/routes.ts:12000`, `server/routes.ts:21305`.
- **Dados/APIs:** `Categorias`, `Tipos_CPP`, `estudos_viabilidade`.
- **Risco de corrigir:** medio; catalogos de leitura publica devem ser separados da escrita.
- **Solucao/testes:** guard por operacao, DTO e escopo BIA; testes anonimo, outra BIA e gestor.
- **Dependencias:** AUD-033.

### AUD-012 - Interesses de OPA sao publicos e alteraveis globalmente

- **Modulo/usuarios:** OPAs/CRM; visitantes e qualquer conta.
- **Atual/esperado:** GET anonimo e PATCH por ID global antes de conferir OPA; somente titular/gestor deveria acessar.
- **Evidencia/reproducao:** `server/routes.ts:12373`, `server/storage.ts:410`, `shared/schema.ts:923`.
- **Dados/APIs:** PostgreSQL `opa_interests`.
- **Risco de corrigir:** baixo.
- **Solucao/testes:** consulta/update atomico por `opa_id + id`, guard de gestor e agregado publico.
- **Dependencias:** nenhuma.

### AUD-013 - POST com ID permite sobrescrever/tomar ativo de terceiro

- **Modulo/usuarios:** Land Bank e Carteira; usuarios autenticados.
- **Atual/esperado:** `body.id` + `ON CONFLICT UPDATE` transforma create em update e pode reatribuir owner; create deveria gerar ID no servidor.
- **Evidencia/reproducao:** `server/routes.ts:12741`, `server/routes.ts:12809`, `server/routes.ts:13448`.
- **Dados/APIs:** PostgreSQL `land_bank_assets` e inventario.
- **Risco de corrigir:** baixo; clientes que enviam ID precisarao parar.
- **Solucao/testes:** INSERT simples, conflito explicito, update/transferencia separados; teste de colisao cross-owner.
- **Dependencias:** AUD-033.

### AUD-014 - Cobranca PINBANK pode sumir apos reinicio

- **Modulo/usuarios:** PINBANK/Capital; gestores financeiros.
- **Atual/esperado:** provedor e chamado antes da persistencia; se PostgreSQL falhar, somente memoria recebe o registro e a API retorna sucesso.
- **Evidencia/reproducao:** `server/routes.ts:9840`, `client/src/pages/nucleo-capital.tsx:252`; frontend nao envia `fluxoCaixaId` nem espelha no Directus.
- **Dados/APIs:** `bia_bank_charges`, PINBANK e fluxo de caixa.
- **Risco de corrigir:** alto; requer idempotencia e reconciliacao.
- **Solucao/testes:** outbox/transacao, chave idempotente, estado `persistence_failed` e reconciliador; simular falha apos criar cobranca.
- **Dependencias:** AUD-028, AUD-029.

## Achados P1

### AUD-015 - Identidade e papeis divergem entre provedores de login

- **Modulo/usuarios:** Acesso; inativos, manager, admin e superadmin.
- **Atual/esperado:** login local bloqueia inativo, Directus/Google nao; `manager` e elevado de forma diferente; todos os provedores deveriam usar uma identidade normalizada unica.
- **Evidencia/reproducao:** `server/routes.ts:19638`, `server/routes.ts:19767`, `server/routes.ts:19818`, `server/auth-google.ts:84`, `shared/schema.ts:56`.
- **Risco/solucao/testes:** alto; criar resolvedor unico, encerrar sessao inativa e matriz por provedor/papel.
- **Dependencias:** AUD-001, AUD-034.

### AUD-016 - `/admin` depende da ocultacao do menu

- **Modulo/usuarios:** Administracao; membros sem papel.
- **Atual/esperado:** a pagina nao valida papel; deveria bloquear/redirectar, alem dos guards backend.
- **Evidencia/reproducao:** `client/src/pages/admin.tsx:6`, `client/src/components/app-sidebar.tsx:145`.
- **Risco/solucao/testes:** baixo; wrapper de rota por capability e teste de navegacao direta.
- **Dependencias:** AUD-001.

### AUD-017 - Aprovacao do Aliado nao bloqueia ativacao da BIA

- **Modulo/usuarios:** Estruturacao de BIA; Aliado e Diretor.
- **Atual/esperado:** pendencia e criada, mas ativacao valida convites/MOU sem exigir aprovacao; transicao deveria depender do workflow.
- **Evidencia/reproducao:** `server/routes.ts:9022`, `server/routes.ts:9361`, `server/routes.ts:10824`.
- **Risco/solucao/testes:** alto; definir maquina de estados unica e testar todas as pre-condicoes.
- **Dependencias:** AUD-018, AUD-019, AUD-020.

### AUD-018 - Falha no convite concede papel de Diretor diretamente

- **Modulo/usuarios:** BIA/Equipe.
- **Atual/esperado:** se a solicitacao falha, campos de diretor ficam persistidos e o acesso e derivado deles; falha deveria manter estado pendente/erro.
- **Evidencia/reproducao:** `server/routes.ts:8992`, `server/routes.ts:9184`, `shared/bia-access.ts:139`.
- **Risco/solucao/testes:** medio; gravar papel somente apos aceite ou separar candidato de membro ativo.
- **Dependencias:** AUD-017.

### AUD-019 - Excecao permanente para a BIA RHCF8KKLKC

- **Modulo/usuarios:** BIA/lifecycle.
- **Atual/esperado:** codigo ignora pendencias para uma BIA especifica sem expiracao/auditoria; excecoes deveriam ser temporarias, configuradas e rastreaveis.
- **Evidencia/reproducao:** `server/routes.ts:5544`, `server/routes.ts:8895`, `server/routes.ts:9169`.
- **Risco/solucao/testes:** alto se testes dependem dela; migrar para feature flag expirada e auditada.
- **Dependencias:** AUD-017.

### AUD-020 - Ativacao aceita MOU de qualquer versao

- **Modulo/usuarios:** Documentos/BIA.
- **Atual/esperado:** convite valida versao atual, ativacao procura qualquer aceite; deveria exigir versao/hash vigente.
- **Evidencia/reproducao:** `server/routes.ts:6001`, `server/routes.ts:9379`, `shared/schema.ts:1186`.
- **Risco/solucao/testes:** medio; reaceite pode ser necessario.
- **Dependencias:** AUD-037.

### AUD-021 - Convite publico devolve dados contratuais apos uso/expiracao

- **Modulo/usuarios:** Convites/onboarding.
- **Atual/esperado:** GET espalha o convite completo sem bloquear status/expiracao; deveria retornar projecao minima ou indisponivel.
- **Evidencia/reproducao:** `server/routes.ts:22183`, `server/routes.ts:22201`.
- **Risco/solucao/testes:** baixo; verificar expirado/usado/revogado.
- **Dependencias:** AUD-038.

### AUD-022 - Aprovacao de BIA pode ir ao Aliado da comunidade errada

- **Modulo/usuarios:** BIA/comunidades.
- **Atual/esperado:** BIA resolve comunidade mae, mas aprovador usa consulta `limit=1` separada; deveria usar a mesma relacao canonica.
- **Evidencia/reproducao:** `server/routes.ts:8970`, `server/routes.ts:9034`.
- **Risco/solucao/testes:** alto; fixture com duas comunidades e Aliados distintos.
- **Dependencias:** AUD-010, AUD-042.

### AUD-023 - PATCH de BIA recalcula e sobrescreve custos em qualquer edicao

- **Modulo/usuarios:** BIA/Capital.
- **Atual/esperado:** `withUpdatedBiaDm()` injeta `custo_final_previsto` mesmo em edicao nao financeira; somente mudanca financeira deveria recalcular.
- **Evidencia/reproducao:** `server/routes.ts:8791`, `server/routes.ts:9207`.
- **Risco/solucao/testes:** alto; separar comando financeiro e fixture de edicao de texto.
- **Dependencias:** AUD-024, AUD-025.

### AUD-024 - Atualizacao da BIA e lancamentos nao sao atomicos

- **Modulo/usuarios:** BIA/Financeiro.
- **Atual/esperado:** Directus salva primeiro; falha do ledger ainda retorna HTTP 200 com `_cppError`; operacao deveria ser atomica ou explicitamente parcial/reconciliavel.
- **Evidencia/reproducao:** `server/routes.ts:9233`, `server/routes.ts:9294`.
- **Risco/solucao/testes:** alto; outbox/saga e idempotencia.
- **Dependencias:** AUD-023, AUD-033.

### AUD-025 - Formulas financeiras divergem entre telas

- **Modulo/usuarios:** Analises, Calculadora DM e visao geral.
- **Atual/esperado:** custo, resultado e lucro descontam conjuntos diferentes e podem duplicar saidas; uma fonte de calculo deveria alimentar todas as exibicoes/PDFs.
- **Evidencia/reproducao:** `client/src/pages/resultados.tsx:501`, `client/src/pages/resultados.tsx:530`, `client/src/pages/resultados.tsx:571` e sete erros de tipo no arquivo.
- **Risco/solucao/testes:** alto; criar fixture dourada compartilhada e testes de igualdade entre tres telas.
- **Dependencias:** AUD-023, AUD-026, AUD-030.

### AUD-026 - Liquidacao PINBANK nao entra nos totais pagos

- **Modulo/usuarios:** PINBANK/Fluxo de caixa.
- **Atual/esperado:** webhook atualiza `pagamento_status`, mas totais usam `status === "pago"`; normalizacao deveria ser central e persistida nos dois campos necessarios.
- **Evidencia/reproducao:** `server/routes.ts:9913`, `client/src/pages/fluxo-caixa.tsx:1927`.
- **Risco/solucao/testes:** alto; mapa canonico de estados e testes de webhook idempotente.
- **Dependencias:** AUD-014, AUD-025.

### AUD-027 - Mapa de cotas inclui entradas pendentes/canceladas

- **Modulo/usuarios:** Capital/Movimentacao de cotas.
- **Atual/esperado:** filtro considera apenas `tipo === entrada`; deveria considerar estados financeiros efetivos.
- **Evidencia/reproducao:** `client/src/pages/fluxo-caixa.tsx:1989`.
- **Risco/solucao/testes:** alto; fixture com pago, pendente e cancelado.
- **Dependencias:** AUD-028.

### AUD-028 - Transferencia de cotas nao valida invariantes no servidor

- **Modulo/usuarios:** Capital; Diretor/Aliado.
- **Atual/esperado:** participantes, saldo, valor, percentual e separacao de funcoes ficam na UI; backend deveria recalcular tudo transacionalmente.
- **Evidencia/reproducao:** `server/routes.ts:21403`, `server/routes.ts:21503`, `server/quota-transfer.ts:6`, `shared/schema.ts:979`.
- **Risco/solucao/testes:** alto; testes de nao participante, saldo excedido, negativo e aprovador.
- **Dependencias:** AUD-027, AUD-040.

### AUD-029 - API de fluxo de caixa aceita contrato financeiro sem schema

- **Modulo/usuarios:** Financeiro.
- **Atual/esperado:** `tipo`, `valor`, `status` e datas sao aceitos sem validacao de dominio; deveria usar schema compartilhado e estados canonicos.
- **Evidencia/reproducao:** `server/routes.ts:11447`, `server/routes.ts:11495`.
- **Risco/solucao/testes:** alto; contratos de create/update e casos invalidos.
- **Dependencias:** AUD-026, AUD-028.

### AUD-030 - Respostas completas e capabilities sao gravadas em logs

- **Modulo/usuarios:** Transversal; privacidade.
- **Atual/esperado:** middleware serializa toda resposta `/api` e paths concretos; logs deveriam conter somente metadados allowlist.
- **Evidencia/reproducao:** `server/index.ts:117`, `server/routes.ts:22075`, `server/routes.ts:23567`; arquivos `.log` nao sao ignorados de forma abrangente.
- **Risco/solucao/testes:** medio; redacao, retencao e rotacao de tokens possivelmente expostos.
- **Dependencias:** AUD-006, AUD-021, AUD-034.

### AUD-031 - Runtime altera schema e permissoes do Directus

- **Modulo/usuarios:** Infraestrutura/dados.
- **Atual/esperado:** startup cria campos/colecoes, remove validacoes e pode conceder CRUD amplo; mudancas deveriam ser migrations revisadas e idempotentes.
- **Evidencia/reproducao:** `server/routes.ts:640`, `server/routes.ts:2186`, `server/routes.ts:2771`, `server/routes.ts:3416`.
- **Risco/solucao/testes:** alto; capturar estado atual, migrar e comparar ACL/schema em CI.
- **Dependencias:** AUD-011, AUD-033.

### AUD-032 - Sessao usa segredo publico se configuracao faltar

- **Modulo/usuarios:** Autenticacao.
- **Atual/esperado:** fallback `built-alliances-secret-2024` e sessao nao regenerada no login; producao deveria falhar sem segredo forte e rotacionar ID.
- **Evidencia/reproducao:** `server/index.ts:45`, `server/routes.ts:19515`, `server/auth-google.ts:157`.
- **Risco/solucao/testes:** medio; startup config e teste de regeneracao.
- **Dependencias:** AUD-015.

### AUD-033 - Drizzle, PostgreSQL e Directus nao possuem contrato equivalente

- **Modulo/usuarios:** Dados/transversal.
- **Atual/esperado:** PostgreSQL tem 71 tabelas contra 60 Drizzle; `fluxo_caixa` e `bias_projetos` diferem estruturalmente; codigo usa `Tipos_CPP` e `tipos_cpp`; deveria existir ownership e sincronizacao explicitos.
- **Evidencia/reproducao:** inventario somente leitura; 11 tabelas PostgreSQL-only, nenhuma schema-only; Directus possui apenas `Tipos_CPP` entre as duas grafias.
- **Risco/solucao/testes:** alto; catalogar tabela por tabela antes de migrar.
- **Dependencias:** AUD-011, AUD-024, AUD-031.

### AUD-034 - Build passa com 71 erros TypeScript

- **Modulo/usuarios:** Engenharia/transversal.
- **Atual/esperado:** build nao executa typecheck; CI deveria bloquear simbolos inexistentes e contratos divergentes.
- **Evidencia/reproducao:** 34 erros em `server/routes.ts`, 7 em `resultados.tsx`, 4 em `bias-calculadora.tsx` e outros 26; `npm run build` passa.
- **Risco/solucao/testes:** medio; classificar baseline e reduzir por lotes sem `skipLibCheck` artificial.
- **Dependencias:** AUD-025, AUD-036, AUD-037.

### AUD-035 - Falha de API vira rede vazia, lista vazia ou logout

- **Modulo/usuarios:** Membros, Alliances e autenticacao.
- **Atual/esperado:** qualquer erro vira `[]`/`null`; 401, 403, 404 e 500 deveriam ter estados distintos e retry.
- **Evidencia/reproducao:** `client/src/pages/area-membros.tsx:751`, `client/src/pages/area-aliancas.tsx:1584`, `client/src/hooks/use-auth.ts:31`.
- **Risco/solucao/testes:** medio; MSW para cada status e UX de erro explicita.
- **Dependencias:** AUD-015, AUD-036.

### AUD-036 - Cache local pode exibir Land Bank apos revogacao

- **Modulo/usuarios:** Land Bank.
- **Atual/esperado:** erro 403/404/500 usa detalhe completo do `localStorage`; autorizacao negada nunca deveria cair para cache privado.
- **Evidencia/reproducao:** `client/src/pages/land-bank-detalhe.tsx:121`, `client/src/pages/land-bank-detalhe.tsx:243`.
- **Risco/solucao/testes:** baixo; cache somente para dado publico, versionado e nao sensivel.
- **Dependencias:** AUD-035.

### AUD-037 - Fila de estruturacao abre a rota errada

- **Modulo/usuarios:** Estruturacao de BIA; Aliado/Diretor/admin.
- **Atual/esperado:** componente ignora `source_type` e sempre usa `asset_id`; oportunidade economica pode abrir `/oportunidades/null`.
- **Evidencia/reproducao:** `client/src/components/bia-structuring-queue.tsx:11`, linha 68; API distingue fontes em `server/routes.ts:13095`.
- **Risco/solucao/testes:** baixo; teste por tipo de origem e URL esperada.
- **Dependencias:** AUD-017.

### AUD-038 - Endpoint de acessos referencia simbolo inexistente

- **Modulo/usuarios:** Carteira/acessos temporarios.
- **Atual/esperado:** `getMembrosCol()` nao existe no typecheck e pode causar 500; deveria usar o provider/resolvedor canonico.
- **Evidencia/reproducao:** `server/routes.ts:18390`.
- **Risco/solucao/testes:** baixo; testar acesso com nome local nulo.
- **Dependencias:** AUD-034.

## Achados P2

### AUD-039 - Rotas duplicadas e fallback de contrato errado

- **Atual/esperado:** `/api/membros-built` e `/api/assets/:id` sao declaradas duas vezes; erro de `/api/bia-aprovacoes` usa cache de `/api/comunidades`.
- **Evidencia:** `server/routes.ts:4059`, `server/routes.ts:4101`, `server/routes.ts:4184`, `server/routes.ts:21212`, `server/routes.ts:10758`.
- **Risco/solucao/testes:** consolidar handler/DTO, proibir duplicatas no inventario e testar tipo do fallback.
- **Dependencias:** AUD-035, AUD-048.

### AUD-040 - Inconsistencias financeiras de borda

- **Atual/esperado:** cobranca pode duplicar na uniao PostgreSQL/Directus; parcela de origem usa regra diferente; UI aceita cinco casas mas DB `numeric(5,2)`; Aportes DM soma todos os estados.
- **Evidencia:** `server/routes.ts:9725`, `client/src/pages/fluxo-caixa.tsx:1827`, `shared/schema.ts:979`, `server/routes.ts:10735`.
- **Risco/solucao/testes:** dedupe por `payment_id`, predicado canonico de origem, precisao contratada e filtros de estado.
- **Dependencias:** AUD-025, AUD-026, AUD-028.

### AUD-041 - Mojibake e codificacao nao sao corrigidos na fonte

- **Atual/esperado:** 622 ocorrencias de padroes suspeitos em TS/TSX; middleware repara apenas JSON, deixando PDF/e-mail/texto vulneravel.
- **Evidencia:** busca estatica por `Ã`, `Â`, `â`; exemplos visiveis anteriores em Analises.
- **Risco/solucao/testes:** normalizar arquivos/dados por origem, remover reparo global e snapshot UTF-8 para UI/PDF/e-mail.
- **Dependencias:** documentos e relatorios.

### AUD-042 - Multicomunidade ainda possui selecoes de primeiro/ultimo vinculo

- **Atual/esperado:** alguns fluxos usam primeira, ultima ou comunidade mae, embora usuario possa pertencer a varias; contexto deveria ser explicito e todas as relacoes consideradas.
- **Evidencia:** `server/storage.ts:535`, `server/routes.ts:4940`, `server/routes.ts:5107`, `server/routes.ts:5202`, `client/src/pages/membro-detalhe.tsx:162`.
- **Risco/solucao/testes:** resolvedor de identidade/contexto e matriz com duas comunidades/papeis diferentes.
- **Dependencias:** AUD-006, AUD-009, AUD-010, AUD-022.

### AUD-043 - Polling duplicado e permanente

- **Atual/esperado:** shell, auth, sidebar, BIA, agenda e comunidade repetem intervalos de 30 s; pagamentos usa 5 s; consultas deveriam ser deduplicadas e pausadas em background.
- **Evidencia:** `client/src/App.tsx:1175`, `client/src/components/app-sidebar.tsx:38`, `client/src/pages/comunidade.tsx:1066`.
- **Risco/solucao/testes:** chaves/query owner unicos, invalidação por evento e orcamento de requests com fake timers.
- **Dependencias:** AUD-044.

### AUD-044 - Bundle inicial carrega quase toda a plataforma

- **Atual/esperado:** imports de paginas sao eager; login baixa cerca de 2,68 MB JS; rotas deveriam usar lazy chunks.
- **Evidencia:** `client/src/App.tsx:19`, build de producao.
- **Risco/solucao/testes:** `React.lazy`, chunks por modulo e budget de bundle abaixo de 500 KB inicial.
- **Dependencias:** AUD-043.

### AUD-045 - Acessibilidade basica incompleta

- **Atual/esperado:** botoes somente com icone sem nome acessivel e fotos sem `alt`; todos os controles deveriam ser nomeados e navegaveis por teclado.
- **Evidencia:** `client/src/pages/bia-documentos.tsx:556`, `client/src/pages/bias-calculadora.tsx:103`; login mobile apresentou um botao sem nome acessivel.
- **Risco/solucao/testes:** `aria-label`, `alt`, foco e axe-core.
- **Dependencias:** validacao visual por papel.

### AUD-046 - Suite oficial nao incluia todos os testes

- **Atual/esperado:** quatro arquivos nao eram executados por um comando agregado; agora `test:all` os descobre e executa, mas CI ainda nao e bloqueante.
- **Evidencia:** `shared/company-access.test.ts`, `server/aura-audio.test.ts`, `server/bia-origin-value.test.ts`, `server/opportunity-platform.test.ts`.
- **Risco/solucao/testes:** manter descoberta automatica, impedir teste orfao e ligar CI apos classificar erros legados.
- **Dependencias:** AUD-034.

### AUD-047 - Cobertura visual por papel esta incompleta

- **Atual/esperado:** validacao atual cobriu anonimo desktop/mobile; deveria cobrir admin, superadmin, Aliado, Diretor, membro e funcionario em fluxos criticos.
- **Evidencia:** sessao do navegador estava deslogada; rotas protegidas renderizaram login e nao vazaram conteudo.
- **Risco/solucao/testes:** contas fixture sem PII e Playwright por papel/viewport.
- **Dependencias:** AUD-015, AUD-016, AUD-035, AUD-045.

### AUD-048 - Inventario nao bloqueia automaticamente endpoints duplicados

- **Atual/esperado:** gerador lista 327 endpoints, mas ainda nao falha por `metodo + path` repetido; contrato deveria rejeitar colisao salvo allowlist explicita.
- **Evidencia:** duplicatas do AUD-039 aparecem no arquivo gerado.
- **Risco/solucao/testes:** adicionar detector e allowlist versionada ao `platform:contract`.
- **Dependencias:** AUD-039.

## Achados P3

### AUD-049 - Fluxo de caixa carrega toda a colecao antes de filtrar

- **Atual/esperado:** `/api/fluxo-caixa?bia_id=` le todos os itens Directus e filtra localmente; filtro deveria ser enviado ao datastore.
- **Evidencia:** `server/routes.ts:11147`.
- **Risco/solucao/testes:** query server-side e teste de volume/isolamento.
- **Dependencias:** AUD-029, AUD-043.

### AUD-050 - Monolito de rotas amplia o raio de regressao

- **Atual/esperado:** `server/routes.ts` tem mais de 24 mil linhas, mistura schema runtime, providers e 327 endpoints; modulos deveriam ter routers, services e contratos isolados.
- **Evidencia:** inventario automatico e concentracao de 34 erros TypeScript no arquivo.
- **Risco/solucao/testes:** extracao incremental por dominio, sem reescrita total, com testes de contrato antes/depois.
- **Dependencias:** todos os lotes posteriores.

## Sequencia recomendada

1. **Contencao imediata:** AUD-001 a AUD-014, iniciando por usuarios, uploads/arquivos, comunidades/BIA e PINBANK.
2. **Identidade e workflow:** AUD-015 a AUD-022 e AUD-032.
3. **Financeiro e dados:** AUD-023 a AUD-029, AUD-033 e AUD-040.
4. **Confiabilidade:** AUD-030, AUD-031, AUD-034 a AUD-039, AUD-046 e AUD-048.
5. **Produto e desempenho:** AUD-041 a AUD-045, AUD-047, AUD-049 e AUD-050.

Cada correcao deve consultar `docs/platform/platform-contract.json`, executar `npm run platform:impact -- <funcionalidade>` e adicionar teste de regressao antes da alteracao comportamental.
