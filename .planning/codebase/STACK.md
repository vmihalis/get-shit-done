# Technology Stack

**Analysis Date:** 2026-02-05

## Languages

**Primary:**
- JavaScript (Node.js) - Core GSD system implementation
- Markdown - Command definitions, agent prompts, and documentation

**Secondary:**
- YAML - Configuration format for tool definitions and settings

## Runtime

**Environment:**
- Node.js >= 16.7.0 (specified in `package.json` engines field)
- Platform support: macOS, Windows, Linux

**Package Manager:**
- npm (npm v7+ required for lock file format)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- None - Pure Node.js standard library implementation

**Build/Dev:**
- esbuild ^0.24.0 - JavaScript bundler for hook compilation (dev dependency)

**CLI/Command Line:**
- Native Node.js CLI infrastructure (no framework)
- readline module - Interactive CLI prompts

## Key Dependencies

**Critical:**
- esbuild ^0.24.0 - Bundles JavaScript hooks for distribution
  - Used in `scripts/build-hooks.js` to prepare `hooks/dist/` for npm publication
  - Supports multi-platform binary distribution via @esbuild/[platform] packages

**Runtime Standard Library Only:**
- fs - File system operations (config files, GSD command installation)
- path - Cross-platform path handling
- os - Operating system utilities (home directory detection)
- child_process - Subprocess management (npm version checks, hook execution)
- readline - Interactive terminal UI for installation prompts

## Configuration

**Environment:**
- Runtime-specific directories:
  - Claude Code: `~/.claude/` (overridable via `CLAUDE_CONFIG_DIR`)
  - OpenCode: `~/.config/opencode/` (follows XDG Base Directory spec)
  - Gemini: `~/.gemini/` (overridable via `GEMINI_CONFIG_DIR`)
- Project-local installs: `./.claude/`, `./.opencode/`, `./.gemini/`

**Build:**
- `scripts/build-hooks.js` - Pre-publish hook compilation
- `package.json` prepublishOnly script - Runs hook build before npm publish

## Platform Requirements

**Development:**
- Node.js >= 16.7.0
- npm with lock file support (v7+)
- Git (for development installation from source)

**Production/Distribution:**
- Node.js >= 16.7.0
- npm for installation via `npx get-shit-done-cc`
- Network access to npm registry for version checks and updates

**Cross-Platform Support:**
- macOS: Full support (x64, ARM64)
- Windows: Full support (ia32, x64, ARM64)
- Linux: Full support (x64, ARM64, ARM, others)

---

*Stack analysis: 2026-02-05*
