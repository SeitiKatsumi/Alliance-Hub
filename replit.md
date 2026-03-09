# Built Alliances Platform

## Overview

This is a business management platform for Built Alliances, a construction and engineering industry network. The application provides a dashboard for managing members, BIAS projects (alliance initiatives), and business opportunities through a sales funnel. The platform integrates with Directus CMS as a headless backend for data management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom Built Alliances brand colors (navy, gold, gray palette)
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **API Pattern**: RESTful endpoints proxying to Directus CMS + local PostgreSQL user management
- **Database ORM**: Drizzle ORM with PostgreSQL (node-postgres driver)
- **Database Connection**: `server/db.ts` using `drizzle-orm/node-postgres` with pg Pool
- **Storage Layer**: `server/storage.ts` with `DatabaseStorage` class (PostgreSQL-backed)

### Data Flow
- Frontend makes API calls to `/api/directus/*` endpoints (proxied to Directus)
- Frontend makes API calls to `/api/users` endpoints (local PostgreSQL)
- Express server proxies Directus requests to external instance at `app.builtalliances.com`
- Authentication via `DIRECTUS_TOKEN` environment variable for Directus
- User management stored locally in PostgreSQL with hashed passwords (scrypt)
- React Query handles caching and refetching strategies

### Key Design Decisions

1. **Hybrid Data Architecture**: Directus CMS for business data (members, BIAs, opportunities), PostgreSQL for user/auth management with granular permissions.

2. **Proxy Architecture**: API requests go through Express to avoid CORS issues and keep authentication tokens server-side.

3. **Component Library**: shadcn/ui provides accessible, customizable components that can be modified in-place rather than depending on external package updates.

4. **Shared Schema**: TypeScript types and Zod schemas in `/shared` directory ensure type safety across frontend and backend.

5. **Granular Permissions**: Each user has per-module permissions (none/view/edit) for all 8 platform modules.

## External Dependencies

### Third-Party Services
- **Directus CMS**: Primary backend at `https://app.builtalliances.com` - manages all business data including members (cadastro_geral), BIAS projects, opportunities, cash flow, and sales funnel

### Database
- **PostgreSQL**: Required for Drizzle ORM schema (users table defined). Connection via `DATABASE_URL` environment variable

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `DIRECTUS_URL`: Directus instance URL (defaults to https://app.builtalliances.com)
- `DIRECTUS_TOKEN`: API token for Directus authentication

### Key NPM Dependencies
- Express 5 for HTTP server
- Drizzle ORM + drizzle-zod for database operations and validation
- TanStack React Query for data fetching
- Radix UI primitives for accessible components
- Tailwind CSS for styling

## Recent Changes (February 2026)

### Navigation Structure
The application navigation was reorganized with the following order:
1. **Oportunidades** (/) - Main entry point, showcasing opportunities to attract new members
2. **BIAS - Alianças** (/bias) - Alliance projects with architectural visualization
3. **Calculadora DM** (/bias-calculadora) - Financial calculator (Divisor Multiplicador) for BIA projects
4. **Fluxo de Caixa** (/fluxo-caixa) - Cash flow management per BIA (entries/exits tracking)
5. **Membros** (/membros) - Member directory
6. **AURA Built** (/aura) - AURA scoring system
7. **Meu Painel** (/painel) - Personal dashboard
8. **Administração** (/admin) - Admin settings

### Data Collections (Directus)
- **tipos_oportunidades**: Main collection for alliance opportunities (10 created)
  - Types: OPA-TEC (Técnico), OPA-OBR (Obras), OPA-LID (Comercial), OPA-CAP (Capital)
  - Each opportunity is linked to a BIA project
  - Fields: nome_oportunidade, tipo, bia, valor_origem_opa, nucleo_alianca, objetivo_alianca, descricao
- **bias_projetos**: BIA alliance projects (2 active)
  - Full directory structure: Autor → Aliado → Dir. Aliança → Dir. Obra → Dir. Comercial → Dir. Capital
  - Gestão Financeira group: valor_origem, divisor_multiplicador, perc_autor_opa, cpp_autor_opa, perc_aliado_built, cpp_aliado_built, perc_built, cpp_built, perc_dir_tecnico, cpp_dir_tecnico, perc_dir_obras, cpp_dir_obras, perc_dir_comercial, cpp_dir_comercial, perc_dir_capital, cpp_dir_capital, custo_origem_bia, custo_final_previsto, valor_realizado_venda, comissao_prevista_corretor, ir_previsto, resultado_liquido, lucro_previsto
  - CPPs are calculated on valor_origem (not custo_origem_bia)
- **fluxo_caixa**: Cash flow transactions per BIA
  - Fields: id (uuid), bia (FK → bias_projetos), tipo (entrada/saida), valor (decimal), data (date), descricao (string), categoria (string), membro_responsavel (FK → cadastro_geral)
  - Entries (entradas) = aportes/investments, require membro_responsavel
  - Exits (saidas) = costs of the project
  - Calculated totals: Total de Aportes (sum of entradas), Custo da Obra (sum of saidas), Saldo (entradas - saidas)
- **cadastro_geral**: Members database (16+ members)
  - Key field: `nome` (member name)

### Architecture
- 4 Alliance Nuclei: Técnico, Obras, Comercial, Capital
- Each nucleus contains cells (células) for specific functions
- Opportunities serve as the "chamariz" (attraction point) for new members to join BIAs
- Calculadora DM manages the Divisor Multiplicador percentages and CPPs per role
- Fluxo de Caixa tracks all financial transactions (entries and exits) per BIA project

### User Management (March 2026)
- Users managed in local PostgreSQL (not Directus)
- Schema: `shared/schema.ts` defines `users` table with id, username, password (hashed), nome, email, membro_directus_id, role, permissions (jsonb), ativo, created_at
- Roles: admin, manager, user
- Per-module permissions: 8 modules × 3 levels (none/view/edit)
- Modules: oportunidades, bias, calculadora, fluxo_caixa, membros, aura, painel, admin
- Admin page (`/admin`) has Tabs: "Usuários" (CRUD users with permissions) and "Membros" (edit Directus members)
- Users can be linked to a Directus member via `membro_directus_id`
- Passwords hashed with scrypt (server/storage.ts)
- API: GET/POST `/api/users`, GET/PATCH/DELETE `/api/users/:id`
- `apiRequest` signature: `(method, url, data?)` — NOT fetch-style

### Technical Notes
- Field `diretor_execucao` (not `diretor_obra`) is used in bias_projetos
- Divisor calculation includes fallback: `divisor = toNum(projeto.divisor_multiplicador) || anyPerc || 1`
- Generic Directus proxy routes support GET, POST, PATCH, DELETE for any collection
