# Built Alliances Platform

## Overview

This is a business management platform for Built Alliances, a construction and engineering industry network. The application provides a dashboard for managing members, BIAS projects (alliance initiatives), and business opportunities. All data is stored in local PostgreSQL (no external CMS dependency). Interface in Portuguese (pt-BR) with navy/gold branding.

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
- **API Pattern**: RESTful endpoints backed by local PostgreSQL
- **Database ORM**: Drizzle ORM with PostgreSQL (node-postgres driver)
- **Database Connection**: `server/db.ts` using `drizzle-orm/node-postgres` with pg Pool
- **Storage Layer**: `server/storage.ts` with `DatabaseStorage` class (PostgreSQL-backed)

### Data Flow
- Frontend makes API calls to `/api/*` endpoints
- Express server handles all CRUD via Drizzle ORM + PostgreSQL
- User management with hashed passwords (scrypt)
- React Query handles caching and refetching strategies

### Key Design Decisions

1. **Local PostgreSQL**: All data (members, BIAs, opportunities, cash flow, users) stored in local PostgreSQL via Drizzle ORM.

2. **Component Library**: shadcn/ui provides accessible, customizable components.

3. **Shared Schema**: TypeScript types and Zod schemas in `/shared` directory ensure type safety across frontend and backend.

4. **Granular Permissions**: Each user has per-module permissions (none/view/edit) for all 8 platform modules.

## Database Schema (shared/schema.ts)

### Tables
- **users**: id (uuid), username, password (hashed), nome, email, membro_directus_id, role, permissions (jsonb), ativo, created_at
- **membros**: id (uuid), nome, email, telefone, whatsapp, cidade, estado, empresa, cargo, created_at
- **bias_projetos**: id (uuid), nome_bia, objetivo_alianca, observacoes, localizacao, role FKs (autor_bia, aliado_built, diretor_alianca, diretor_execucao, diretor_comercial, diretor_capital), financial fields (valor_origem, divisor_multiplicador, perc_*/cpp_* pairs, custo_origem_bia, custo_final_previsto, valor_realizado_venda, comissao_prevista_corretor, ir_previsto, resultado_liquido, lucro_previsto), created_at
- **fluxo_caixa**: id (uuid), bia_id (FK), tipo (entrada/saida), valor (decimal), data (date), descricao, membro_responsavel_id (FK→membros), categoria_id (FK→categorias), tipo_cpp_id (FK→tipos_cpp), favorecido_id (FK→membros), anexos (text[]), created_at
- **tipos_cpp**: id (serial), nome, descricao
- **categorias**: id (serial), nome, descricao
- **oportunidades**: id (uuid), nome_oportunidade, tipo, bia_id (FK), valor_origem_opa, objetivo_alianca, nucleo_alianca, pais, descricao, perfil_aliado, created_at

## API Routes

### Data Routes
- `GET/POST /api/membros`, `GET/PATCH/DELETE /api/membros/:id`
- `GET/POST /api/bias`, `GET/PATCH/DELETE /api/bias/:id`
- `GET/POST /api/fluxo-caixa`, `PATCH/DELETE /api/fluxo-caixa/:id`
- `GET/POST /api/tipos-cpp`
- `GET/POST /api/categorias`
- `GET/POST /api/oportunidades`, `PATCH /api/oportunidades/:id`
- `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`

### File Upload
- `POST /api/upload` — Multipart file upload (multer), accepts `files` field, max 10 files, 10MB each
  - Allowed types: PDF, PNG, JPG, JPEG, WebP, GIF, DOC, DOCX, XLS, XLSX
  - Returns `{ success: true, urls: ["/uploads/filename.ext"] }`
- `/uploads/*` — Static file serving for uploaded files (stored in `uploads/` directory)

### AI Routes
- `POST /api/assistant` — AI assistant with context from local data
- `POST /api/analyze/bia/:id` — AI analysis for BIA projects
- `POST /api/analyze/oportunidade/:id` — AI analysis for opportunities

### Fluxo de Caixa Response Shape
The GET /api/fluxo-caixa endpoint returns enriched items with joined data:
```json
{
  "id": "uuid",
  "bia": "bia_id",
  "tipo": "entrada|saida",
  "valor": "decimal",
  "data": "date",
  "descricao": "string",
  "membro_responsavel": "membro_id",
  "anexos": ["url1", "url2"],
  "Categoria": [{ "id": 1, "Nome_da_categoria": "..." }],
  "tipo_de_cpp": [{ "id": 1, "Nome": "..." }],
  "Favorecido": [{ "id": "uuid", "nome": "..." }]
}
```

## Navigation Structure
1. **Oportunidades** (/) — Opportunities to attract new members
2. **BIAS - Alianças** (/bias) — Alliance projects
3. **Calculadora DM** (/bias-calculadora) — Financial calculator
4. **Fluxo de Caixa** (/fluxo-caixa) — Cash flow management per BIA
5. **Membros** (/membros) — Member directory
6. **AURA Built** (/aura) — Scoring system
7. **Meu Painel** (/painel) — Personal dashboard
8. **Administração** (/admin) — Admin settings

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string

## Technical Notes
- `apiRequest` signature: `(method, url, data?)` — NOT fetch-style
- Field `diretor_execucao` (not `diretor_obra`) is used in bias_projetos
- Valor input uses Brazilian currency formatting (1.234,56) with `formatInputBRL`/`parseBRLToNumber`
- Fluxo de caixa `anexos` field stores array of file URLs/paths for receipts
- Storage `_enrichFluxoItems` joins fluxo_caixa with membros, categorias, tipos_cpp for response
- User permissions: 8 modules × 3 levels (none/view/edit)
