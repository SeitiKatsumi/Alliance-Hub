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