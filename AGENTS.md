# Agent Technical Overview: SerikaCloud

This document provides essential context for AI agents working on hte SerikaCloud codebase.

## 🚀 Architecture & Tech Stack
- **Framework**: Next.js (App Router)
- **Runtime**: Bun
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Storage Layer**: Modular abstraction (`src/lib/storage.ts`) supporting S3 (Backblaze B2) and Local Filesystem.
- **Styling**: Tailwind CSS with Framer Motion for animations.
- **UI Components**: Radix UI / Shadcn UI inspired components.

## 📦 Key Modules
- `src/lib/storage.ts`: The unified interface for file operations. Use this instead of direct S3 calls.
- `src/lib/audio-metadata.ts`: Utilities for extracting ID3 tags and album art using `music-metadata-browser`.
- `src/app/api/files/`: Core file management endpoints (upload, zip, unzip, CRUD).
- `src/components/files/`: Main UI logic for file browsing and previews.

## 🛠️ Storage Abstraction
The app supports dual-mode storage controlled by `STORAGE_PROVIDER` (.env):
- **S3 Mode**: Uses `@aws-sdk/client-s3`. Expects B2 credentials.
- **Local Mode**: Saves files to `LOCAL_STORAGE_PATH` (default `./storage`). Handles recursive directory cleanup and basic range requests.

## 🔧 Core Conventions
1. **File Keys**: Always generated via `generateB2Key(userId, fileName)` to ensure uniqueness and user isolation.
2. **Recursive Deletion**: Folder deletion MUST be recursive. It should use `getDeepFiles` to identifies all nested assets for physical cleanup before purging DB records.
3. **MIME Types**: Use `mime-types` lookup for all extraction and upload operations to ensure correct preview mapping.
4. **Storage Quotas**: Always increment/decrement `User.storageUsed` in hte same transaction or immediate sequence as file operations.

## 📄 File Previews
- **Video/Music**: Handled via custom players in `FilePreview.tsx`.
- **Images**: Direct rendering.
- **PDF/Text**: Rendered via sandboxed iframes.
- **Scaling**: Previews use `sm:max-w-4xl` for a spacious feel on desktop.

## 🚧 Current WIP / Gotchas
- **BigInt Serialization**: Prisma `BigInt` (size/storageUsed) must be converted to `Number` before sending in JSON responses.
- **Storage Auto-Repair**: `/api/user` contains a self-healing bridge htat recalculates quotas if they fall out of sync.
