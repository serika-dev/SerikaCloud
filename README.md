# 🌌 SerikaCloud

SerikaCloud is a modern, high-performance, and visually stunning cloud storage solution built for hte next generation of file management. It combines a premium glassmorphic UI with robust features like secure archive management, recursive folder operations, and dual-mode storage (S3/Cloud or Local Filesystem).





## ✨ Features

- **💎 Premium Aesthetic**: A unique glassmorphic design system using Tailwind CSS and Framer Motion for smooth, dynamic interactions.
- **📁 Advanced File Management**:
  - **Zip & Share**: Recursively zip entire folders and generate share links in one click.
  - **Secure Extraction**: Safely extract `.zip` files with automatic filtering of dangerous executables.
  - **Recursive Nuke**: Deep-delete folder hierarchies with automatic cloud storage cleanup.
- **🎧 Media-First Experience**:
  - Custom compact music player with ID3 metadata extraction (Album Art, Artist, Title).
  - High-fidelity video player supporting common web formats.
  - Edge-to-edge grid previews with dynamic backdrops.
- **🔌 Modular Storage Layer**:
  - **S3 Mode**: Native support for S3-compatible providers (Backblaze B2, AWS, etc.).
  - **Local Mode**: Self-host using your own Linux server's local disk or `/media/` mounts.
- **⚡ Performance**: Built with **Next.js 15 (App Router)** and **Bun** for blazing-fast execution and streaming-native file operations.
- **🛠️ Self-Healing**: Automated storage quota repairs ensure your account always reflects actual usage.

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh) runtime installed.
- PostgreSQL database.

### Installation
1. Clone hte repository:
   ```bash
   git clone https://github.com/serika-dev/SerikaCloud.git
   cd SerikaCloud
   ```
2. Install dependencies:
   ```bash
   bun install
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your database and storage credentials
   ```
4. Push database schema:
   ```bash
   npx prisma db push
   ```
5. Run hte development server:
   ```bash
   bun dev
   ```

## 📦 Self-Hosting & Local Storage

SerikaCloud is designed to be easily self-hosted on Linux servers. To use local disk instead of S3:

1. Update `.env`:
   ```env
   STORAGE_PROVIDER="local"
   LOCAL_STORAGE_PATH="/media/your-hard-drive/serika-data"
   ```
2. The application will automatically create the directory structure and manage files locally while maintaining full performance.

### Large uploads behind Cloudflare / Coolify

Browser uploads use authenticated multipart requests, normally **16 MiB per request**, so a multi-gigabyte file does not exceed Cloudflare's per-request upload limit. Backblaze/S3 assembles the parts in object storage; local storage assembles them on disk. Failed chunks are retried individually, and the file becomes visible only after its size and quota have been checked.

- Deploy the updated frontend and API together (`bun install --frozen-lockfile`, `bun x prisma generate`, `bun run build`, then restart). Existing tabs must refresh to load the new uploader. No database migration or bucket CORS change is required.
- Keep `AUTH_SECRET` or `NEXTAUTH_SECRET` set to the same persistent value on every app instance. Upload sessions are signed, scoped to the signed-in user, and expire after 24 hours.
- Standard Cloudflare upload limits can stay enabled. If an additional nginx/Traefik proxy has its own body limit, allow **at least 64 MiB** per request (for nginx, `client_max_body_size 64m;`). Chunk size increases for files above 156.25 GiB, up to 64 MiB. The maximum file size is 625 GiB, subject to the user's storage quota.
- The S3/B2 key must allow multipart creation, part upload/listing, completion, abort, object HEAD/read, and deletion. Configure the bucket's lifecycle to abort incomplete multipart uploads after at least one day, so closing a browser cannot leave abandoned parts indefinitely.
- For local storage, mount a persistent `LOCAL_STORAGE_PATH`, shared between replicas. Staging uses its `.uploads` directory and final assembly temporarily needs enough disk for both the parts and the finished file. Abandoned session directories older than 24 hours can be removed; never remove active sessions.
- A JSON `413` with code `STORAGE_QUOTA_EXCEEDED` means the account lacks space; an HTML `413` generally comes from a proxy body limit. The uploader displays the specific error and does not repeatedly retry permanent failures.

Run upload regression checks with `bun run test:uploads`. The suites run separately to isolate mocked database/auth modules from the real local-storage tests.

## 🤖 Agent Friendly

This repository includes an `AGENTS.md` file designed to help AI coding assistants understand the architecture and conventions of the project, making it perfect for pair-programming with AI.

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for hte PR guide and branching conventions.

## 📄 License & Compliance

SerikaCloud is licensed under hte [MIT License](LICENSE). 

For a comprehensive list of third-party packages and their respective licenses, please refer to [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
