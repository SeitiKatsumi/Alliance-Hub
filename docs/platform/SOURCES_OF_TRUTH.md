# Fontes de Verdade

## Princípio

Uma informação deve ter uma fonte oficial. Espelhos servem para leitura, desempenho ou integração, mas não podem criar uma segunda regra de negócio.

| Conceito | Fonte principal | Cópias/derivações | Cuidados |
| --- | --- | --- | --- |
| Sessão e usuário de login | PostgreSQL `users` + sessão | Directus `cadastro_geral` | normalizar `directusUserId`, `membroId` e e-mail |
| Finalidades e intencoes da conta | PostgreSQL `user_account_purposes` (`purpose` + `objectives`) | `/api/me`, Meu Perfil, onboarding, Carteira e acesso aos ambientes | opcoes canonicas ficam em `shared/initial-onboarding.ts`; selecionar finalidade nao concede papel de membro; `imoveis` libera a entrada na Vitrine sem usar `na_vitrine` como prova unica |
| Perfil do membro | Directus `cadastro_geral` | tipos locais e cards | não confundir usuário de login com membro |
| Identidade publica e formal | Directus `cadastro_geral.nome` para exibicao; `nome_completo` e `cpf` para formalizacao | perfil, indicador de preenchimento e documentos formais | nome formal nao pode sobrescrever o nome publico; fallback de `nome` vale apenas para registros legados sem `nome_completo` |
| Classificacao de atuacao profissional | Directus `cadastro_geral.ramo_atuacao`, `segmento`, `area_atuacao`, `especialidade_livre` e `idiomas` | onboarding, cadastro, Meu Perfil, Membros e Vitrine | ramos/segmentos usam `client/src/lib/ramos-segmentos.ts`; abrangencia e idiomas usam `shared/profile-taxonomy.ts`; nao criar campos ou listas paralelas |
| Areas de contribuicao | Directus `cadastro_geral.tipos_alianca` e `nucleos_alianca` | cadastro, onboarding, perfil, filtros e cards | valores, nomes visuais, nucleos e metadados usam `shared/contribution-areas.ts` |
| Comunidades do membro | relações de comunidade + `membro_comunidade_mae` | sessão e perfil | associação é muitos-para-muitos; comunidade mãe não é lista completa |
| BIA | Directus `bias_projetos` | tabelas operacionais locais | IDs podem chegar como string ou objeto de relação |
| Acesso por BIA | papéis da BIA + `bia_user_permissions` | matriz no frontend | backend decide; múltiplos papéis usam maior acesso |
| Fluxo financeiro da BIA | Directus `fluxo_caixa` | cards e análises | valores derivados não devem ser persistidos por telas diferentes |
| Valor de origem | campo da BIA + lançamentos protegidos | calculadora e análises | sincronização preserva parcelas pagas/com evidência |
| DM/CPP | percentuais e helper de domínio da BIA | cards de visão geral e análises | zero explícito é diferente de ausente |
| Carteira | tabelas locais `carteira_*` e `inventario_*`; copropriedade em `carteira_imovel_socios`; origem em `bia_imovel_origens` e `bia_map_origem_alocacoes`; MAP/aportes no financeiro oficial da BIA | publicação opcional e totais calculados | estimativas ficam em `carteira_analises`; cotacoes PTAX ficam em `carteira_cotacoes_cambio`; item privado não vira ativo público automaticamente; MAP de origem não cria receita ou caixa |
| Oportunidades | registro local e objetos de origem | Vitrine, OBA, Land Bank | projeção pública remove dados privados |
| Aura | `aura_avaliacoes` + léxico | score e cards | vínculo deve considerar todas as comunidades |
| Aceites | registros locais versionados | PDFs | perfil atual não substitui evidência do momento do aceite |
| Notificações | estado do objeto de origem | contadores, cards e e-mails | contador inclui apenas pendências acionáveis e deduplicadas |
| Pagamentos externos | evento validado do provedor | convite, assinatura e dashboard | webhook deve ser idempotente e autenticado |

## Regras para sincronização

1. Declare qual lado inicia a escrita.
2. Use IDs estáveis e normalize relações do Directus.
3. Não transforme erro de sincronização em resposta de sucesso sem um estado de pendência explícito.
4. Operações repetidas devem ser idempotentes.
5. Dados financeiros e jurídicos exigem histórico ou evidência imutável.
6. Nunca apague valor existente porque um formulário parcial omitiu o campo.

## Leitura somente na auditoria

A auditoria pode comparar schema, contagens e amostras mascaradas. Ela não pode executar `INSERT`, `UPDATE`, `DELETE`, migrações ou correções no Directus/PostgreSQL sem uma etapa posterior aprovada.
