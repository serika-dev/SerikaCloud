# Agent Technical Overview: Serika Office Suite

This document provides essential context for AI agents working on the Serika codebase.

## 🚀 Architecture & Tech Stack
- **Framework**: Next.js (App Router)
- **Runtime**: Bun
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js (shared across all apps)
- **Storage Layer**: Modular abstraction (`src/lib/storage.ts`) supporting S3 (Backblaze B2) and Local Filesystem.
- **Styling**: Tailwind CSS with Framer Motion for animations.
- **UI Components**: Base UI / Shadcn UI inspired components.
- **Rich Text**: TipTap (ProseMirror-based) for SerikaDocs editor.

## 🏗️ Office Suite — Multi-App Architecture
All apps live in **one Next.js codebase** with subdomain routing via middleware:
- **cloud.serika.dev** → `src/app/(dashboard)/` — SerikaCloud (file storage)
- **write.serika.dev** → `src/app/write/` — SerikaDocs (document editor)
- **mail.serika.dev** → `src/app/mail/` — SerikaMail (email client)
- **present.serika.dev** → `src/app/present/` — SerikaPresent (presentations)

Middleware (`src/middleware.ts`) detects the subdomain and rewrites URLs internally.
For local dev, use `?app=write` / `?app=mail` / `?app=present` query params, or navigate directly to `/write`, `/mail`, `/present`.

### App Switcher
`src/components/shared/app-switcher.tsx` — grid popover to navigate between apps. Included in every app's sidebar/header.

## 📦 Key Modules
- `src/lib/storage.ts`: Unified file operations interface. Use instead of direct S3 calls.
- `src/lib/audio-metadata.ts`: ID3 tags and album art via `music-metadata-browser`.
- `src/app/api/files/`: SerikaCloud file management endpoints.
- `src/app/api/docs/`: SerikaDocs CRUD endpoints.
- `src/app/api/mail/`: SerikaMail endpoints (list, send, aliases, incoming webhook).
- `src/app/api/present/`: SerikaPresent endpoints (CRUD, slides).
- `src/components/files/`: Cloud file browsing and previews.
- `src/components/docs/`: TipTap document editor + toolbar.
- `src/components/mail/`: Email client UI + compose dialog.
- `src/components/present/`: Slide editor, canvas, present mode.

## 🛠️ Storage Abstraction
The app supports dual-mode storage controlled by `STORAGE_PROVIDER` (.env):
- **S3 Mode**: Uses `@aws-sdk/client-s3`. Expects B2 credentials.
- **Local Mode**: Saves files to `LOCAL_STORAGE_PATH` (default `./storage`). Handles recursive directory cleanup and basic range requests.

## 📧 SerikaMail Architecture
- **Sending**: AWS SES v2 (`@aws-sdk/client-sesv2`). Credentials via `AWS_SES_*` env vars.
- **Receiving**: `POST /api/mail/incoming` webhook — external MTA (Postal/Maddy) delivers here.
- **Address Setup**: Users choose their own `username@serika.pro` address on first visit. No auto-creation.
- **Aliases**: Users can create additional @serika.pro aliases routed to their primary mailbox.
- **Folders**: Auto-created when mailbox is claimed (inbox, sent, drafts, spam, trash, archive).
- **Domain**: `MAIL_DOMAIN` env var (default: `serika.pro`). `serika.email` is used only for verification emails via SMTP.

## 🔧 Core Conventions
1. **File Keys**: Always generated via `generateB2Key(userId, fileName)` to ensure uniqueness and user isolation.
2. **Recursive Deletion**: Folder deletion MUST be recursive. Use `getDeepFiles` to identify all nested assets before purging.
3. **MIME Types**: Use `mime-types` lookup for all extraction and upload operations.
4. **Storage Quotas**: Always increment/decrement `User.storageUsed` in the same transaction or immediate sequence as file operations.
5. **Subdomain Routing**: New apps must be added to `SUBDOMAIN_APPS` in middleware.ts and get their own route segment.

## 📄 File Previews
- **Video/Music**: Handled via custom players in `FilePreview.tsx`.
- **Images**: Direct rendering.
- **PDF/Text**: Rendered via sandboxed iframes.
- **Scaling**: Previews use `sm:max-w-4xl` for a spacious feel on desktop.

## 🚧 Current WIP / Gotchas
- **BigInt Serialization**: Prisma `BigInt` (size/storageUsed) must be converted to `Number` before sending in JSON responses.
- **Storage Auto-Repair**: `/api/user` contains a self-healing bridge that recalculates quotas if they fall out of sync.
- **MTA Setup Required**: SerikaMail receiving requires an external MTA (Postal/Maddy) configured to POST to `/api/mail/incoming` with `MAIL_WEBHOOK_SECRET` bearer token.
- **DNS for Subdomains**: Coolify needs wildcard or per-app subdomain configuration (cloud/write/mail/present.serika.dev).
