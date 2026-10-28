# Homologação dos cadastros após a migração — 28/10/2026

## Escopo e resultado

O usuário adiou a publicação e pediu testes desde o onboarding até as criações anteriormente ligadas ao Directus. Esta rodada usa somente `http://localhost:3018`, uma cópia isolada. O site oficial, o Directus original e os backups não foram modificados. Não houve commit ou push.

Resultado final: **27 jornadas aprovadas, 174 chamadas instrumentadas verificadas, 0 falhas**. `npm run platform:verify` passou com **594 testes**, checagem de contratos, consistência, tipos e build. Dois novos testes de regressão cobrem os defeitos encontrados. O script de jornadas também verifica persistência por consultas ao banco privado e compara bytes de arquivos, além das chamadas contadas.

## Cobertura executada

| Jornada | Evidência verificada |
| --- | --- |
| Comunidade | Criar, editar, recarregar e deduplicar vínculo repetido de membro. |
| Células | Tipos do catálogo compartilhado, edição e rejeição de criação duplicada. |
| Onboarding profissional | Convite, cadastro, etapas, retomada após login e conclusão; telefone português, segmento longo, CPF opcional e rejeição de telefone inválido. |
| Onboarding imóveis | Cadastro e conclusão com telefone brasileiro e CPF opcional. |
| Onboarding capital | Cadastro e conclusão, inclusive telefone opcional vazio. |
| BIA pelo cadastro existente | Criar, editar, recarregar e preservar MAP inicial com três participantes. |
| Especialidade | Criar, vincular ao membro, editar e recarregar. |
| Favorecido externo e usuário | Criar, autenticar usuário e rejeitar duplicidade. |
| Banco de terrenos | Criar, editar, conferir espelho no esquema importado e excluir somente o registro sintético. |
| Estudo de viabilidade | Criar, editar, listar e excluir o registro sintético. |
| Arquivos | Enviar PNG, baixar e comparar os bytes. |
| Assistente de BIA | Criar rascunho, retomar, editar, rejeitar revisão desatualizada, concluir e repetir sem duplicação; estrutura e mídia preservadas, fase em captação. |
| Ativos da BIA | Criar estrutura com ativo, valor, dívida zero e data; conferir revisão e rejeitar alteração concorrente. |
| Fases da BIA | Bloquear ativação prematura com HTTP 409. |
| Múltiplas comunidades | Vincular BIA, conferir relações e acesso pela segunda comunidade. |
| Aporte inicial | Gerar programação, confirmar, repetir sem duplicar parcelas e registrar quitação local. |
| Saída com aportes | Gerar lote vinculado, herdar pagamento, repetir sem duplicação e impedir exclusão que quebraria o vínculo. |
| Isolamento entre usuários | Usuário sem vínculo não acessa financeiro nem altera BIA privada. |
| Financeiro e lembretes | Categoria, CPP, anexo, pendente/pago, histórico, exclusão protegida e confirmada; repetir configuração de lembrete mantém uma ação de calendário. |
| Comprovante de aporte | Enviar PNG, aprovar e repetir sem criar duas entradas pagas. |
| Demanda | Criar rascunho privado, editar e consultar relação com a BIA. |
| OBA | Criar, vincular mídia, editar, recarregar e excluir a OBA sintética. |
| Documentos do núcleo técnico | Criar, editar, consultar e excluir usando armazenamento próprio, sem fallback externo. |
| Documentos da aliança | Mesmo ciclo, preservando vínculo e permissões. |
| Histórico do MAP | Conferir versão persistida e baixar PDF válido com assinatura de arquivo `%PDF`. |
| Carteira imobiliária | Criar imóvel, conferir titularidade, editar, recarregar e excluir o registro sintético. |
| Sem autenticação | Rejeitar gravações com HTTP 401. |

As três jornadas de onboarding são contadas separadamente, totalizando 27. A rodada anterior também executou 34 leituras de coleções e relações do catálogo importado; estas são evidência de leitura, não de criação de todas as tabelas internas do Directus.

## Defeitos encontrados e corrigidos

1. **Editar OBA falhava ao consultar campos inexistentes.** A busca anterior pedia `bia_id` e `status`, ausentes na tabela física. A rota agora lê apenas `id,bia`, os campos usados para autorizar o vínculo, e mantém as validações existentes.
2. **Concluir o assistente da BIA enviava a estrutura à tabela errada.** `estrutura_bia` pertence ao versionamento em `bia_estrutura_versoes`, não à apresentação da BIA. O payload da apresentação agora remove essa propriedade, preservando o objeto original para a gravação versionada posterior. A criação completa e sua repetição foram verificadas por API.

Não foram alteradas regras de participação, valores, permissões, assinaturas ou fases para contornar esses defeitos. As correções estão carregadas somente na aplicação privada; o bundle anterior foi preservado e o novo hash consta de `journey-runtime.json` no diretório da homologação.

## Conferência na interface

Uma conta sintética foi usada para conferir Início, Agenda e Perfil. O contato com Portugal (+351) foi salvo pela interface, exibiu o estado de salvamento e permaneceu após recarregar. Perfil conferido em desktop e largura de 390 pixels, com capturas em `migracao-perfil-desktop.png` e `migracao-perfil-mobile.png` no workspace BUILT. A sessão e os dados reais do usuário não foram alterados. A cobertura completa das jornadas acima é por API; não se afirma que cada formulário foi percorrido manualmente no navegador.

## Limites explícitos

- SMTP, Asaas, Stripe, OAuth externo e IA não foram acionados: rede privada, ausência de credenciais e bloqueios de execução permanecem ativos. Esta rodada não comprova entrega de e-mail, emissão ou pagamento bancário real.
- A BIA sintética do fluxo legado recebeu fase ativa diretamente na cópia **apenas como preparação dos testes financeiros**. O assistente moderno foi concluído pelas rotas reais até em captação; ativação antecipada foi rejeitada. Não se afirma que a cadeia completa de assinaturas e aprovação legal foi exercitada.
- Marcas de aceite e localização artificial foram usadas exclusivamente na conta sintética, identificadas como QA. Nenhum aceite ou documento de pessoa real foi criado, alterado ou reemitido.
- Os registros de cada execução usam prefixo `qa-migration-` e endereços `example.invalid`. Permanecem na cópia privada; não entram na cópia final para produção. Exclusões dos testes atingem somente seus próprios registros.
- O painel genérico de administração do Directus não foi recriado. Metadados, registros históricos e arquivos foram preservados; a cobertura funcional corresponde aos recursos ativos da plataforma acima.
- O retorno é uma restauração em clones privados e comparação dos dados, não a ativação do sistema antigo com integrações externas. Uma futura virada exige nova cópia atualizada e conferência, pois esta cópia contém fixtures de teste.

## Repetição e evidências

Novo retorno ensaiado depois destas gravações: `recovery-f614c58a8abedc55`, sob `/srv/built-migration/stage/runtime-6d2f8fb5ddf2`. Estado `private-return-restored-and-compared`: **198 tabelas, 1.097 arquivos e 5.388 eventos**. Os dois layouts reconstruídos têm 67 e 129 tabelas; conteúdo, sequências e arquivos comparados sem diferenças. Clone de recuperação parado após o ensaio; aplicação privada retomada. Backups anteriores continuam preservados, inclusive as cópias locais já verificadas. O novo retorno fica preservado no servidor, sem afirmar que foi copiado para fora dele.

`scripts/native-platform-journey.ts` é uma ferramenta de operador, não um worker ou endpoint. Exige modo isolado, backend PostgreSQL, URL Directus inválida propositalmente e marcador `isolated-rehearsal` no banco. O destino HTTP é fixo em loopback na porta 3018. A senha da conta sintética é fornecida por `QA_ADMIN_PASSWORD`, nunca gravada no relatório. O programa cria fixtures novas, não substitui registros existentes.

Empacotar com esbuild para Node, mantendo os pacotes externos, e executar no contêiner privado com as variáveis da homologação. Não executar na aplicação oficial. O relatório privado `/tmp/native-platform-journey-results.json` contém apenas o identificador da execução, IDs das fixtures e resultados; modo de arquivo 0600. Logs locais de conferência: `.BUILT-tmp/native-journey-results.log`, `.BUILT-tmp/native-journey-verify.log`, `.BUILT-tmp/native-journey-tooling.log` e `.BUILT-tmp/native-journey-regression.log`. Dados brutos e logs não são destinados ao Git.

Testes de regressão: `server/native-migration-journey.test.ts`, junto às suítes de armazenamento nativo, onboarding, financeiro, documentos, permissões e recuperação já integradas à verificação da plataforma.

Revisão do diff desta migração aprovada: 45 arquivos e consumidores, 628 fontes inspecionados, em índice temporário separado, sem alterar o índice de trabalho do usuário. `platform:review -- --base HEAD` também foi executado: a árvore completa continua com quatro pendências do registro paralelo `2026-10-26-remote-sandbox-contributions`, que não foram atestadas por esta tarefa. Evidências: `.BUILT-tmp/native-journey-review-exact.log` e `.BUILT-tmp/native-journey-review-tree.log`. Homologação respondeu HTTP 200 após o retorno, e o clone de recuperação foi confirmado parado.
