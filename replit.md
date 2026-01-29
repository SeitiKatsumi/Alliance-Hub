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
- **API Pattern**: RESTful endpoints proxying to Directus CMS
- **Database ORM**: Drizzle ORM with PostgreSQL (schema defined but Directus handles primary data)
- **Session Storage**: In-memory storage for development, connect-pg-simple available for production

### Data Flow
- Frontend makes API calls to `/api/directus/*` endpoints
- Express server proxies requests to external Directus instance at `app.builtalliances.com`
- Authentication via `DIRECTUS_TOKEN` environment variable
- React Query handles caching and refetching strategies

### Key Design Decisions

1. **Directus as Backend CMS**: Rather than building custom CRUD endpoints, the application leverages Directus for content management, reducing backend complexity while maintaining flexibility.

2. **Proxy Architecture**: API requests go through Express to avoid CORS issues and keep authentication tokens server-side.

3. **Component Library**: shadcn/ui provides accessible, customizable components that can be modified in-place rather than depending on external package updates.

4. **Shared Schema**: TypeScript types and Zod schemas in `/shared` directory ensure type safety across frontend and backend.

## External Dependencies

### Third-Party Services
- **Directus CMS**: Primary backend at `https://app.builtalliances.com` - manages all business data including members (cadastro_geral), BIAS projects, opportunities, and sales funnel

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

## Recent Changes (January 2026)

### Navigation Structure
The application navigation was reorganized with the following order:
1. **Oportunidades** (/) - Main entry point, showcasing opportunities to attract new members
2. **BIAS - Alianças** (/bias) - Alliance projects with architectural visualization
3. **Membros** (/membros) - Member directory
4. **AURA Built** (/aura) - AURA scoring system
5. **Meu Painel** (/painel) - Personal dashboard
6. **Administração** (/admin) - Admin settings

### Data Collections (Directus)
- **tipos_oportunidades**: Main collection for alliance opportunities (10 created)
  - Types: OPA-TEC (Técnico), OPA-OBR (Obras), OPA-LID (Comercial), OPA-CAP (Capital)
  - Each opportunity is linked to a BIA project
  - Fields: nome_oportunidade, tipo, bia, valor_origem_opa, nucleo_alianca, objetivo_alianca, descricao
- **bias_projetos**: BIA alliance projects (2 active)
  - Full directory structure: Autor → Aliado → Dir. Aliança → Dir. Obra → Dir. Comercial → Dir. Capital
- **cadastro_geral**: Members database (16 members)

### Architecture
- 4 Alliance Nuclei: Técnico, Obras, Comercial, Capital
- Each nucleus contains cells (células) for specific functions
- Opportunities serve as the "chamariz" (attraction point) for new members to join BIAs