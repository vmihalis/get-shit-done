# External Integrations

**Analysis Date:** 2026-02-05

## APIs & External Services

**npm Registry:**
- Service: NPM Package Registry
- What it's used for: Package distribution, version checking, and update detection
  - Published package: `get-shit-done-cc`
  - SDK/Client: Node.js built-in `child_process` module with `execSync()`
  - Version check: `npm view get-shit-done-cc version` (in `hooks/gsd-check-update.js`)
  - Timeout: 10 seconds for update checks

**GitHub:**
- Discord API link: Community server at https://discord.gg/5JJgD5svVS
- Repository: https://github.com/glittercowboy/get-shit-done
- Distribution: npm published from GitHub (manual workflow, no CI/CD)

## Data Storage

**Databases:**
- Not applicable - GSD is a configuration distribution and CLI system

**File Storage:**
- Local filesystem only
- Cache location: `~/.claude/cache/gsd-update-check.json` (update check results)
- Configuration storage: Runtime-specific directories (`~/.claude/`, `~/.config/opencode/`, `~/.gemini/`)

**Caching:**
- Update check caching: `~/.claude/cache/gsd-update-check.json` (written by `hooks/gsd-check-update.js`)
- Cache format: JSON with fields: `update_available`, `installed` version, `latest` version

## Authentication & Identity

**Auth Provider:**
- None - GSD is open source and uses no authentication layer
- npm publish requires NPM_TOKEN (maintainer-only, set via GitHub Actions secrets)

## Monitoring & Observability

**Error Tracking:**
- Not applicable - GSD handles errors via console output and exit codes

**Logs:**
- Console logging via `console.log()` and `console.error()`
- Colored terminal output using ANSI escape codes (cyan, green, yellow, dim, reset)
- Session-based logging through Claude Code/Gemini/OpenCode runtimes

**Statusline Integration:**
- Hook: `hooks/gsd-statusline.js` (executed by runtime for status display)
- Updates runtime UI with GSD status information
- Installed to runtime's session hooks directory

## CI/CD & Deployment

**Hosting:**
- Distribution: npm registry (`https://registry.npmjs.org/get-shit-done-cc`)
- Manual publish workflow (Git commits trigger GitHub workflow)

**CI Pipeline:**
- GitHub Actions (manual publish after version bump)
- Pre-publish script: `npm run build:hooks` (copies hooks to `hooks/dist/`)
- NPM_TOKEN required for automation

**Publication Process:**
- Version bump: `npm version patch|minor|major`
- Pre-publish hook: Runs `scripts/build-hooks.js`
- Files published: All items in `package.json` files array
  - `bin/install.js` - Main CLI installer
  - `commands/gsd/` - All GSD command definitions
  - `agents/` - All agent prompt templates
  - `hooks/dist/` - Compiled hooks
  - `scripts/build-hooks.js` - Hook build script

## Environment Configuration

**Required env vars:**
- `CLAUDE_CONFIG_DIR` (optional) - Override default `~/.claude/`
- `OPENCODE_CONFIG_DIR` or `OPENCODE_CONFIG` (optional) - OpenCode config location
- `GEMINI_CONFIG_DIR` (optional) - Override default `~/.gemini/`
- `XDG_CONFIG_HOME` (optional) - Used for XDG Base Directory spec (OpenCode default)
- `NPM_TOKEN` (maintainers only) - npm automation token for publishing

**Secrets location:**
- Credentials stored locally in runtime-specific config directories
- `.claude/settings.json`, `~/.config/opencode/settings.json`, `~/.gemini/settings.json`
- Attribution settings managed per runtime

## Webhooks & Callbacks

**Incoming:**
- None - GSD is not a server

**Outgoing:**
- None - GSD is CLI-only with no outbound webhooks

## Network Communication

**Update Checking:**
- Service: npm registry
- Endpoint: `npm view get-shit-done-cc version`
- Frequency: Once per Claude Code session (via `gsd-check-update.js` hook)
- Timeout: 10 seconds
- Failure handling: Graceful - errors logged but don't block installation
- Cache: Results stored in `~/.claude/cache/gsd-update-check.json`

---

*Integration audit: 2026-02-05*
