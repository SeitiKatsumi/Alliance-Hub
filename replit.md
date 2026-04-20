# Built Alliances Platform

## Overview

This is a business management platform for Built Alliances, a construction and engineering industry network. The application provides a dashboard for managing members, BIAS projects (alliance initiatives), and business opportunities. Data is read in real-time from Directus CMS (https://app.builtalliances.com) for collections: cadastro_geral (membros), bias_projetos, fluxo_caixa, Categorias, Tipos_CPP, tipos_oportunidades (oportunidades). Local PostgreSQL stores users/auth data. Interface in Portuguese (pt-BR) with navy/gold branding.

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
- **API Pattern**: RESTful endpoints — all business data CRUD via Directus API, user management via local PostgreSQL
- **Directus Integration**: `directusFetch`, `directusFetchOne`, `directusCreate`, `directusUpdate`, `directusDelete` helpers in `server/routes.ts` for full CRUD via Directus API at `https://app.builtalliances.com` using `DIRECTUS_TOKEN`
- **Database ORM**: Drizzle ORM with PostgreSQL (node-postgres driver) for local data (users only)
- **Database Connection**: `server/db.ts` using `drizzle-orm/node-postgres` with pg Pool
- **Storage Layer**: `server/storage.ts` with `DatabaseStorage` class (PostgreSQL-backed, users only)
- **Session Auth**: `express-session` + `connect-pg-simple` for persistent session management. Endpoints: `POST /api/login`, `POST /api/logout`, `GET /api/me`. Session stored in PostgreSQL (session table auto-created).

### Data Flow
- Frontend makes API calls to `/api/*` endpoints
- All business data CRUD (membros, BIAs, fluxo_caixa, categorias, tipos_cpp, oportunidades) goes through Directus API
- User management with hashed passwords (scrypt) in local PostgreSQL
- React Query handles caching and refetching strategies

### Key Design Decisions

1. **Directus as Source of Truth**: All business data (membros, BIAs, fluxo_caixa, categorias, tipos_cpp, oportunidades) is fully managed through Directus in real-time — both reads and writes. Changes made in either Directus or the app are immediately synchronized.

2. **Component Library**: shadcn/ui provides accessible, customizable components.

3. **Shared Schema**: TypeScript types and Zod schemas in `/shared` directory ensure type safety across frontend and backend.

4. **Granular Permissions**: Each user has per-module permissions (none/view/edit) for all 8 platform modules.

## Database Schema (shared/schema.ts)

### Tables
- **users**: id (uuid), username, password (hashed), nome, email, membro_directus_id, role, permissions (jsonb), ativo, created_at
- **convites_comunidade**: id (uuid PK), token (uuid unique), comunidade_id (text), candidato_membro_id (text), candidato_nome, candidato_email, invitador_membro_id, status (convidado/candidato/aprovado/rejeitado/termos_enviados/termos_aceitos/membro), dados_contratuais (jsonb), criado_em, atualizado_em
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
  - Files are uploaded to Directus `/files` API, local temp files are cleaned up
  - Returns `{ success: true, fileIds: ["directus-file-uuid"] }`

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

## Convites & Adesão às Comunidades
- Fluxo de adesão: convidado → candidato → aprovado/rejeitado → termos_enviados → termos_aceitos → membro
- **Backend**: `server/mailer.ts` com 7 funções de e-mail via nodemailer (SMTP env vars); storage methods em `server/storage.ts`; 7 endpoints REST em `server/routes.ts`
- **Endpoints**: `POST /api/convites`, `GET /api/convites?comunidade_id=X`, `POST /api/convites/:token/candidatura` (público), `PATCH /api/convites/:token/decisao`, `POST /api/convites/:token/termos`, `PATCH /api/convites/:token/pagamento` (ativa BUILT_PROUD_MEMBER no Directus + M2M), `POST /api/convites/:token/lembrete`
- **Páginas públicas** (sem auth): `/convite/:token` (form candidatura), `/adesao/:token` (termos c/ checkbox), `/pagamento/:token` (PIX R$ 500 manual)
- **Vitrine**: botão "Convidar para Comunidade" em `vitrine-detalhe.tsx` (visível quando user tem comunidade E perfil visitado não é BUILT_PROUD_MEMBER)
- **Comunidade**: painel "Candidatos" em `comunidade.tsx` para Aliado BUILT com ações Aprovar/Rejeitar/Reenviar Termos/Confirmar Pagamento
- Pagamento: PIX manual (chave `financeiro@builtalliances.com`), confirmação manual pelo Aliado no painel

## Geolocation (BIAs)
- `latitude` and `longitude` fields are created in Directus `bias_projetos` at server startup via `ensureBiasGeoFields()`
- Location picker uses Nominatim (OpenStreetMap) free geocoding API — no API key required
- BIAs Dashboard has a futuristic Brazil map header using `react-simple-maps` with animated pulse markers for geolocated BIAs
- TopoJSON source: `https://raw.githubusercontent.com/deldersveld/topojson/master/countries/brazil/brazil-states.json`
- Type declarations for react-simple-maps: `client/src/types/react-simple-maps.d.ts`

## Navigation Structure (Collapsible Sidebar)
1. **Meu Dashboard** (/) — Main dashboard with summary blocks (starts closed)
   1.1 Minhas BIAs (/bias) — BIAs Dashboard: cards with key info, create/edit/delete all Directus fields (Geral, Equipe, CPP, Receita tabs), summary stats, search. Each BIA card shows related OPAs count and list. Interactive world+Brazil map with zoom/pan, click on markers shows BIA info panel with related OPAs.
       - Diretoria da Aliança (/diretoria-alianca) — stub placeholder (gold)
       - Núcleo Técnico (/nucleo-tecnico) — **FULL MODULE**: 4 tabs (Projetos/Jurídica/Inteligência/Governança), CRUD de documentos com upload, destaque em verde para itens integrados. Dados em PostgreSQL local (`nucleo_tecnico_docs`).
         - Alianças de Projetos (tab on /nucleo-tecnico)
         - Alianças Jurídicas (tab on /nucleo-tecnico) — green: Termo de adesão, Due diligence, NDA, MOU Padrão BUILT
         - Alianças de Inteligência (tab) — green: Análise de mercado, Roadmap do projeto
         - Alianças de Governança (tab) — green: Manual de governança, Relatórios periódicos
       - Núcleo de Obra (/nucleo-obra) — stub placeholder (orange)
       - Núcleo Comercial (/nucleo-comercial) — stub placeholder (green)
       - Núcleo de Capital (collapsible)
         - Financeiro (/fluxo-caixa) — Cash flow management per BIA
         - Resultados (/resultados) — Investment analysis dashboard (ROI, Múltiplo, Lucro %)
       - Calculadora DM (/bias-calculadora) — Financial calculator
   1.2 Minhas OPAs (/opas) — Full OPAs dashboard: futuristic header with stats, cards with BIA relationship badge, CRUD (create/edit/delete), filter by BIA, search. Each OPA linked to one BIA via bia_id. Clicking a card navigates to /opas/:id (detail page). Edit button from detail page navigates to /opas?edit=:id which auto-opens the edit form.
       - OPA Detalhe (/opas/:id) — Full detail page: hero header, financial metrics, BIA link, descrição, perfil do aliado, anexos, metadata sidebar. Similar to bia-detalhe.tsx.
   1.3 Minha Aura (/aura) — Scoring system
2. **Administração** (/admin) — Admin settings (starts closed)
   2.1 Membros (/membros) — Member directory

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `DIRECTUS_TOKEN`: Bearer token for Directus CMS API access
- `DIRECTUS_URL`: Directus base URL (defaults to https://app.builtalliances.com)

## Ramo de Atuação & Segmento
- `ramo_atuacao` (varchar) and `segmento` (varchar) stored as direct Directus fields in `cadastro_geral`
- 8 ramos fixos with 173 total segments defined in `client/src/lib/ramos-segmentos.ts`
- Cascade selects: choose Ramo first → Segmento list filters to that ramo's options
- Meu Perfil: `select-perfil-ramo` + `select-perfil-segmento` (disabled until ramo chosen)
- Admin Membros: same cascade selects in `MembroEditSheet`
- Display: `vitrine-detalhe.tsx` and `membro-detalhe.tsx` show Ramo / Segmento (fallback to M2M Especialidade if no ramo set)
- Card subtitle in `area-membros.tsx`: shows `segmento` with fallback to `especialidade`
- `especialidade_livre` free-text field preserved as separate "Especialidade (texto livre)" input

## Currency Support
- Each BIA has a `moeda` field (ISO 4217 currency code, e.g. BRL, USD, EUR) stored in Directus
- `CurrencyCombobox` component in `bias.tsx` uses Popover + Command with search across 80+ world currencies
- `formatMoney(value, currency)` helper uses `Intl.NumberFormat` to format values in the BIA's currency
- All monetary displays in `bias.tsx`, `bia-detalhe.tsx`, and `resultados.tsx` use `formatMoney(value, bia.moeda || "BRL")`
- Aggregate totals (cross-BIA) remain formatted in BRL

## Transferência de Cotas (Mapa de Alocação Patrimonial)
- Table `transferencias_cotas` in local PostgreSQL: id, bia_id, membro_origem_id, membro_destino_id, valor_total, status (pendente/aceita/rejeitada), solicitado_por, observacoes, motivo_rejeicao, criado_em, atualizado_em
- API: `GET /api/transferencia-cotas?bia_id=X`, `POST /api/transferencia-cotas`, `PATCH /api/transferencia-cotas/:id` (action: aceitar/rejeitar)
- On accept: updates all Directus fluxo_caixa entries with `tipo=entrada` and `favorecido_id=membro_origem_id` for the BIA to use `favorecido_id=membro_destino_id`
- UI in `fluxo-caixa.tsx`: each mapa row has "Transferir" button → Dialog with destino select + observações; below mapa shows "Solicitações de Transferência" panel with approve/reject buttons for the source member (`currentUser?.membro_directus_id === membro_origem_id`) or admin

## Technical Notes
- `apiRequest` signature: `(method, url, data?)` — NOT fetch-style
- Field `diretor_execucao` (not `diretor_obra`) is used in bias_projetos
- Valor input uses Brazilian currency formatting (1.234,56) with `formatInputBRL`/`parseBRLToNumber`
- Fluxo de caixa `Anexos` field is a Directus many-to-many files relationship (junction table `fluxo_caixa_files`)
- File upload goes to Directus `/files` API, returns file UUIDs; those UUIDs are sent as `[{directus_files_id: "uuid"}]` in `Anexos` field
- GET `/api/fluxo-caixa` resolves Anexos to `{id, title, filename, url, size}` objects via `fields=*,Anexos.directus_files_id.*`
- Frontend stores existing anexos as `AnexoFile[]` objects, sends file IDs (not URLs) in payload
- User permissions: 8 modules × 3 levels (none/view/edit)
