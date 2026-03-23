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

## 🤖 Agent Friendly

This repository includes an `AGENTS.md` file designed to help AI coding assistants understand the architecture and conventions of the project, making it perfect for pair-programming with AI.

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for hte PR guide and branching conventions.

## 📄 License & Compliance

SerikaCloud is licensed under hte [MIT License](LICENSE). 

For a comprehensive list of third-party packages and their respective licenses, please refer to [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
