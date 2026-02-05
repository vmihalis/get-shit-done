# Coding Conventions

**Analysis Date:** 2026-02-05

## Naming Patterns

**Files:**
- Kebab-case for all files (commands, workflows, hooks, agents)
- Example: `gsd-executor.md`, `gsd-check-update.js`, `build-hooks.js`
- Convention applies across: command files, workflow files, agent files, and JavaScript

**Functions:**
- camelCase for JavaScript functions
- Example: `getGlobalDir()`, `expandTilde()`, `copyWithPathReplacement()`
- Prefixed with verb when appropriate: `buildHookCommand()`, `verifyInstalled()`, `parseConfigDirArg()`

**Variables:**
- camelCase for runtime variables in JavaScript
- CAPS_UNDERSCORES for environment variables and configuration constants
- Example: `homeDir`, `configPath`, `HOOKS_DIR`, `DIST_DIR`, `projectVersionFile`
- Boolean prefixes: `has*`, `is*`, `should*` (e.g., `hasGlobal`, `isOpencode`, `shouldInstallStatusline`)

**Step names in XML:**
- snake_case for `<step name="">` attributes
- Example: `name="validate_phase"`, `name="load_project_state"`, `name="record_start_time"`

**Constants:**
- SCREAMING_SNAKE_CASE for module-level constants
- Example: `HOOKS_TO_COPY`, `HOOKS_DIR`, `DIST_DIR`

**XML tags in markdown:**
- kebab-case for tag names
- Example: `<execution_context>`, `<required_reading>`, `<archival_behavior>`

## Code Style

**Formatting:**
- 2-space indentation throughout (JavaScript and Markdown)
- No tabs
- Line continuations use proper nesting (no hanging indents)

**Linting:**
- No ESLint or Prettier configuration in repo
- Manual consistency maintained through code review and conventions

**Comments:**
- JSDoc format for functions with parameters and return types
- Format: `/**\n * Description.\n * @param {type} name - description\n * @returns {type} description\n */`
- Example from `bin/install.js`:
  ```javascript
  /**
   * Get the global config directory for a runtime
   * @param {string} runtime - 'claude', 'opencode', or 'gemini'
   * @param {string|null} explicitDir - Explicit directory from --config-dir flag
   */
  function getGlobalDir(runtime, explicitDir = null) {
  ```

**Block comments:**
- Inline comments use `//` for explanations
- Example: `// Runtime selection - can be set by flags or interactive prompt`

## Import Organization

**JavaScript:**
1. Built-in Node.js modules (fs, path, os, child_process, readline)
2. External packages (none in core code)
3. Local functions/variables

**Example from `bin/install.js`:**
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
```

**Markdown:**
- `@-references` used for lazy-loading file references
- Static references (always load): `@~/.claude/get-shit-done/workflows/...`
- Conditional references (if exists): `@.planning/DISCOVERY.md (if exists)`
- See `GSD-STYLE.md` line 162-176 for full @-reference pattern guidance

## Error Handling

**Patterns:**
- Silent failure for non-critical operations with try-catch blocks
- Example from `gsd-statusline.js` (line 88-90):
  ```javascript
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
  ```

- Explicit error logging and exit for critical errors
- Example from `bin/install.js` (line 1226):
  ```javascript
  console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
  process.exit(1);
  ```

- User-facing error messages use color codes:
  - Errors: `yellow` or `red`
  - Success: `green`
  - Info: `dim` or `cyan`
  - Format: `${yellow}message${reset}` to avoid color bleeding

**Validation:**
- Validate arguments early with clear error messages
- Example from `bin/install.js` (lines 123-130):
  ```javascript
  if (!nextArg || nextArg.startsWith('-')) {
    console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
    process.exit(1);
  }
  ```

## Logging

**Framework:** Native console API

**Patterns:**
- `console.log()` for normal output
- `console.error()` for error messages
- No structured logging (timestamps, severity levels) in core code
- Terminal color codes for visual distinction

**When to Log:**
- Installation progress (success with `✓` symbol)
- Error conditions with actionable messages
- Silent failures for non-critical operations (file parsing, cache reads)

**Example from `bin/install.js` (line 1115):**
```javascript
console.log(`  ${green}✓${reset} Installed ${count} commands to command/`);
```

## Function Design

**Size:** Functions range from 10-50 lines for utility functions, up to 150+ lines for orchestration
- Shorter for simple transformations: `expandTilde()`, `getDirName()`
- Longer for complex workflows: `install()` (200 lines), `copyWithPathReplacement()` (45 lines)

**Parameters:**
- Maximum 4-5 parameters before considering object destructuring
- Runtime selection and explicit directory handling use explicit parameters
- Example: `function install(isGlobal, runtime = 'claude')`

**Return Values:**
- Simple types: string, boolean, null
- Objects for bundled results: `{ settingsPath, settings, statuslineCommand, runtime }`
- Early returns for validation failures

## Module Design

**Exports:**
- Node.js scripts are executable files, not modules
- `#!/usr/bin/env node` shebang at top of executable files
- No module.exports or ES6 export patterns (scripts not intended for reuse)

**File Scope:**
- Module-level constants defined at top
- Helper functions defined before usage
- Main logic at end of file (after all function definitions)
- Example structure in `bin/install.js`:
  1. Requires (lines 1-6)
  2. Constants (lines 8-26)
  3. Functions (lines 42-1450)
  4. Main logic (lines 1494-1530)

**Global State:**
- Limited use of global state (e.g., `attributionCache` in `bin/install.js`)
- Maps used for caching with clear purpose: `const attributionCache = new Map();`

## Configuration Management

**Environment Variables:**
- Uppercase names: `CLAUDE_CONFIG_DIR`, `GEMINI_CONFIG_DIR`, `OPENCODE_CONFIG_DIR`
- Read early in execution flow
- Used for directory resolution with fallbacks

**File Paths:**
- Tilde expansion for home directory: `expandTilde(filePath)` helper function
- Absolute paths preferred over relative for clarity
- Path operations use `path.join()` for cross-platform compatibility

**JSON Configuration:**
- `settings.json` in user config directory
- Preserve formatting with 2-space indentation: `JSON.stringify(settings, null, 2) + '\n'`
- Read with error handling (invalid JSON returns empty object)

## String Handling

**Regex Patterns:**
- Use verbose comments for complex patterns
- Example from `bin/install.js` (line 504):
  ```javascript
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {
  ```

**Escaping:**
- Escape `$` in replacements to prevent backreference injection
- Example from `bin/install.js` (line 258):
  ```javascript
  const safeAttribution = attribution.replace(/\$/g, '$$$$');
  ```

**Template Strings:**
- Use `${variable}` syntax in backtick strings
- Avoid unnecessary string concatenation

## Platform Compatibility

**Node.js Versions:**
- Minimum: v16.7.0 (from `package.json`)
- No version-specific features beyond ES2020

**Windows Support:**
- Use `path` module, not hardcoded separators
- Forward slashes for Node.js compatibility: `hooksPath.replace(/\\/g, '/')`
- Process spawn: `windowsHide: true` to prevent console flash on Windows

**Path Handling:**
- `path.join()` for concatenation
- `expandTilde()` for user home directory
- Absolute paths for cross-platform clarity

## Object Patterns

**Factory Objects:**
- Color mappings as simple key-value objects: `const colorNameToHex = { cyan: '#00FFFF', ... }`
- Tool mapping objects with explicit Claude→target-format conversions
- Example: `const claudeToOpencodeTools = { AskUserQuestion: 'question', ... }`

**Configuration Objects:**
- Settings read into plain objects
- Modified in-place, then written back
- Example pattern:
  ```javascript
  let config = readSettings(configPath);
  config.permission = config.permission || {};
  writeSettings(configPath, config);
  ```

## Temporal Language

**In Implementation Code:**
- Describe current state only (no "was", "previously", "instead of")
- Exceptions: CHANGELOG.md, MIGRATION.md, git commits

**In Comments:**
- Present tense for function behavior
- Example: "Copy commands to a flat structure"

---

*Convention analysis: 2026-02-05*
