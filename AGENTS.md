<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Overview
- Warehouse Inventory Movement System for SPINDO.
- Tech Stack: Next.js 16 (beta), Prisma (PostgreSQL), Next-Auth v5, Tailwind CSS 4, Lucide React.

## Key Commands
- `npm run dev`: Start development server.
- `npm run build`: Production build.
- `npm run lint`: Linting check.
- `npx prisma generate`: Generate Prisma client (runs automatically on postinstall).
- `npx prisma db push`: Sync schema to database.

## Architecture
- `app/`: Next.js App Router.
- `lib/auth.ts`: Next-Auth v5 configuration.
- `lib/db.ts`: Prisma client instance.
- `lib/utils.ts`: Tailwind CSS class merging utility.
- `components/`: Reusable UI components.
- `prisma/schema.prisma`: Database schema definition.

## Conventions
- Use `cn()` from `@/lib/utils` for Tailwind class merging.
- Prefer server components where possible; use `"use client"` for interactive elements.
- Authentication is handled via Next-Auth v5 (Beta). Use `useSession()` on client or `auth()` on server.

