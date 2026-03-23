# Contributing to SerikaCloud

Welcome to the SerikaCloud contributor guide! We value high-quality code, premium aesthetics, and robust engineering.

## 🛠️ Development Workflow

### 1. Branching Model
- `master`: The stable branch. All production-ready code lives here.
- `feat/*`: For new features or significant enhancements.
- `fix/*`: For bug fixes and patches.
- `refactor/*`: For code cleanups and structural changes.

### 2. Commit Conventions
We follow **Conventional Commits**:
- `feat:` for new features.
- `fix:` for bug fixes.
- `docs:` for documentation updates.
- `chore:` for dependency updates or configuration changes.
- `refactor:` for code changes that neither fix a bug nor add a feature.

**Example**: `feat: add local storage support for self-hosting`

### 3. Pull Request Standards
- **Describe your changes**: Explain *what* was changed and *why*.
- **Screenshots/Recordings**: Required for all UI/UX changes.
- **Verification**: List the manual or automated tests performed.
- **Agent Friendly**: If you are an AI agent, ensure you've read `AGENTS.md` before submitting.

### 4. Code Principles
- **Aesthetics First**: Never sacrifice the premium glassmorphic look for "simple" solutions.
- **Streaming Native**: Always use streaming for file operations to handle large assets (up to 1TB).
- **Type Safety**: No `any` types unless absolutely unavoidable for third-party compatibility.

## 🧪 Testing

1. **Database**: Ensure `prisma db push` is run if you modify the schema.
2. **Storage**: Test both `S3` and `LOCAL` storage providers in `.env`.
3. **Auth**: Verify hte login/registration flow still functions.

---

Thank you for helping us build the future of cloud storage! 🌌🚀
