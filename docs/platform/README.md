# Contrato Vivo da Plataforma BUILT

Atualizado em: 2026-08-17

Este diretório documenta o comportamento que precisa permanecer coerente entre interface, API, PostgreSQL, Directus, arquivos, notificações e integrações.

## Como usar

1. Localize o módulo abaixo.
2. Leia suas invariantes e dependências.
3. Rode `npm run platform:impact -- <termo>` antes de alterar código.
4. Depois da mudança, rode os testes indicados pelo comando.
5. Atualize o contrato quando uma regra, interface ou fonte de verdade mudar.

## Documentos globais

- [Arquitetura](./ARCHITECTURE.md)
- [Fontes de verdade](./SOURCES_OF_TRUTH.md)
- [Glossário](./GLOSSARY.md)
- [Contrato estruturado](./platform-contract.json)
- [Inventario de rotas frontend](./generated/FRONTEND_ROUTES.md)
- [Inventario de endpoints da API](./generated/API_ENDPOINTS.md)
- [Inventario de armazenamentos](./generated/DATA_STORES.md)
- [Auditoria integral](../audit/PLATFORM_AUDIT_2026-08-17.md)

## Módulos

| Módulo | Contrato | Riscos transversais principais |
| --- | --- | --- |
| Acesso e onboarding | [acesso-onboarding](./modules/acesso-onboarding.md) | sessão, convites, aceites, localização |
| Início e gestão | [inicio-gestao](./modules/inicio-gestao.md) | agregações, contadores, navegação |
| Membros, empresas e comunidades | [perfil-rede-empresa](./modules/perfil-rede-empresa.md) | múltiplos vínculos, permissões empresariais |
| BUILT Vitrine | [built-vitrine](./modules/built-vitrine.md) | exposição pública e dados privados |
| Alliances, oportunidades e BIAs | [built-alliances](./modules/built-alliances.md) | estados, papéis, Directus, rastreabilidade |
| Capital e financeiro | [capital-financeiro](./modules/capital-financeiro.md) | dinheiro, DM/CPP, pagamentos, cotas |
| Carteira Patrimonial | [carteira](./modules/carteira.md) | propriedade, compartilhamento, documentos |
| Aura | [aura](./modules/aura.md) | vínculo entre membros, léxico, IA, áudio |
| Agenda e notificações | [agenda-notificacoes](./modules/agenda-notificacoes.md) | deduplicação, polling, ações pendentes |
| Administração | [administracao](./modules/administracao.md) | superadmin, monetização, auditoria |
| Pagamentos e integrações | [pagamentos-integracoes](./modules/pagamentos-integracoes.md) | webhooks, Pinbank, Stripe, OpenAI |

## Fontes auxiliares existentes

- `client/src/data/platform-functional-report.ts`: catálogo funcional exibido na plataforma.
- `shared/schema.ts`: tipos e tabelas Drizzle do banco local.
- `shared/bia-access.ts` e `shared/company-access.ts`: matrizes compartilhadas de acesso.
- `docs/DIRECTUS_FRONTEND.md`: integração histórica com Directus.
- `docs/AURA_PERCEBIDA_2026.md`: especificação especializada de Aura.
- `replit.md`: decisões históricas; pode estar desatualizado e não substitui este contrato.

## Regra de precedência

Quando documentos divergirem:

1. invariantes e fontes de verdade deste contrato;
2. helpers de domínio cobertos por testes;
3. schema/migrações persistidas;
4. implementação atual de API;
5. implementação visual;
6. documentação histórica.

Divergência entre esses níveis deve ser registrada como achado, não resolvida por suposição.
