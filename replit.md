# Built Alliances Platform

## Overview
The Built Alliances Platform is a business management system designed for a construction and engineering industry network. Its primary purpose is to provide a comprehensive dashboard for managing members, alliance initiatives (BIAS projects), and business opportunities. The platform integrates real-time data from Directus CMS for core business entities while managing user authentication and specific application data locally. The system features a Portuguese (pt-BR) interface with a distinct navy/gold branding, aiming to streamline operations and enhance collaboration within the Built Alliances network.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with custom Built Alliances brand colors
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express 5
- **API Pattern**: RESTful endpoints. Business data CRUD via Directus API; user management via local PostgreSQL.
- **Directus Integration**: Custom helper functions (`directusFetch`, etc.) for full CRUD operations with Directus CMS.
- **Database ORM**: Drizzle ORM with PostgreSQL (for local user data and sessions).
- **Authentication**: `express-session` with `connect-pg-simple` for persistent session management.

### Data Flow
- Frontend communicates with `/api/*` endpoints.
- All business data (members, BIAs, cash flow, categories, opportunities) is synchronized in real-time with Directus.
- User authentication and permissions are managed in a local PostgreSQL database with hashed passwords.
- React Query manages data caching and refetching on the frontend.

### Key Design Decisions
- **Directus as Source of Truth**: Primary business data is managed entirely through Directus, ensuring real-time synchronization.
- **Component Library**: Utilizes `shadcn/ui` for accessible and customizable UI components.
- **Shared Schema**: TypeScript types and Zod schemas in `/shared` provide type safety across the stack.
- **Granular Permissions**: Supports per-module permissions (none/view/edit) for 8 platform modules.
- **Geolocation for BIAs**: Uses Nominatim (OpenStreetMap) for geocoding, displaying BIAs on an interactive map.
- **Currency Support**: BIAs support multiple currencies with dynamic formatting using `Intl.NumberFormat`.
- **Nucleo Técnico Module**: Manages documents with CRUD functionality, storing data in local PostgreSQL.
- **Convites & Adesão às Comunidades**: Implements a multi-step invitation and membership process with email notifications and public-facing pages for application, terms acceptance, and manual payment confirmation.

### Navigation Structure
A collapsible sidebar provides access to:
- **Meu Dashboard**: Main overview, including:
    - **Minhas BIAs**: Dashboard for BIAS projects with detailed views, CRUD, and geographical visualization.
    - **Minhas OPAs**: Opportunities dashboard with detail pages and CRUD.
    - **Núcleo Técnico**: Document management across various alliances (Projects, Legal, Intelligence, Governance).
    - **Núcleo de Capital**: Financial management (Fluxo de Caixa, Resultados).
- **Administração**: Member directory.

## External Dependencies
- **Directus CMS**: For core business data management (members, BIAS projects, cash flow, categories, opportunity types).
- **PostgreSQL**: Local database for user accounts, authentication sessions, Nucleo Técnico documents, invitations, and advertisement data.
- **Nodemailer**: For sending email notifications related to invitations and membership.
- **Nominatim (OpenStreetMap)**: Free geocoding service for BIA location data.
- **`react-simple-maps`**: For rendering interactive geographical maps.
- **Multer**: For handling multipart file uploads to the API.
- **`express-session` and `connect-pg-simple`**: For session management and storage in PostgreSQL.
- **TanStack React Query**: Client-side server state management.
- **shadcn/ui and Radix UI**: UI component libraries.
- **Tailwind CSS**: Utility-first CSS framework.
- **Vite**: Frontend build tool.
- **Node.js and Express**: Backend runtime and web framework.
- **Drizzle ORM**: Object-relational mapper for PostgreSQL.
- **TypeScript**: Programming language for both frontend and backend.
- **Zod**: Schema validation library.