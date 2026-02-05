# Testing Patterns

**Analysis Date:** 2026-02-05

## Test Framework

**Status:** Not currently used

- No test runner configured (Jest, Vitest, Mocha, etc.)
- No test files in codebase (`*.test.js`, `*.spec.js`)
- No test configuration files (jest.config.js, vitest.config.ts, etc.)
- Node.js code is primarily installation/runtime scripts without unit test coverage

## Testing Approach

**Manual Testing:**
- Installation workflows tested manually by running `npx get-shit-done-cc` with various flags
- Hook integration verified through Claude Code/OpenCode/Gemini runtime execution
- Test scenarios include:
  - Global installation (`--global`, `-g`)
  - Local installation (`--local`, `-l`)
  - Runtime selection (`--claude`, `--opencode`, `--gemini`, `--all`)
  - Uninstall operations (`--uninstall`, `-u`)
  - Config directory override (`--config-dir`, `-c`)
  - Force statusline replacement (`--force-statusline`)

**Verification Methods:**

Interactive prompts tested with readline simulation (hardcoded in development):
- Runtime selection prompt (4 options)
- Installation location prompt (2 options)
- Statusline configuration prompt (2 options)

File system operations verified by checking:
- Directory creation (recursive with `{ recursive: true }`)
- File copies and transformations
- Orphaned file cleanup
- Settings.json persistence

**Error Conditions Tested:**
- Missing required arguments
- Invalid argument combinations (`--global` + `--local`)
- Non-existent source files
- Invalid JSON in configuration files

## Code Coverage Approach

**Implicit Coverage:**
The GSD framework itself is meta-prompting system that orchestrates Claude agents. Real testing happens in the GSD workflows (agent prompts), not unit tests on the codebase.

**Critical Paths Manually Verified:**
1. Installation flow: `bin/install.js` → copies files, transforms frontmatter, updates settings
2. Frontmatter conversion: `convertClaudeToOpencodeFrontmatter()` → tool names, color mapping, path replacement
3. Settings persistence: Read/write/cleanup of `settings.json` and `opencode.json`
4. Hook registration: SessionStart hooks registered correctly for update checks
5. Uninstall flow: Selective removal of GSD files without destroying user content

## File System Operations Testing

**Patterns Verified:**
- Directory creation: `fs.mkdirSync(dir, { recursive: true })`
- File copying: `fs.copyFileSync(src, dest)`
- Recursive directory copy with transformation: `copyWithPathReplacement()`
- Orphaned file cleanup: `cleanupOrphanedFiles()`

**Helper Functions:**
- `verifyInstalled(dirPath, description)` - checks directory exists and is non-empty
- `verifyFileInstalled(filePath, description)` - checks file exists
- Both return boolean and log errors

**Error Handling Pattern:**
```javascript
try {
  const entries = fs.readdirSync(dirPath);
  if (entries.length === 0) {
    console.error(`  ${yellow}✗${reset} Failed to install: directory is empty`);
    return false;
  }
} catch (e) {
  console.error(`  ${yellow}✗${reset} Failed to install: ${e.message}`);
  return false;
}
return true;
```

## Configuration Testing

**Settings.json Manipulation:**
Read current settings:
```javascript
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}
```

Write with formatting:
```javascript
function writeSettings(settingsPath, settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}
```

Test scenarios:
- Create new settings.json if doesn't exist
- Parse existing settings gracefully
- Preserve user settings while adding GSD config
- Update hooks and statusline without losing other settings

**Specific Settings Tests (Manual):**
- SessionStart hook registration and deduplication
- Statusline configuration replacement
- Hook cleanup for orphaned entries
- Attribution processing (removal, replacement, preservation)

## Runtime Compatibility Testing

**Runtimes Tested:**
- Claude Code (`.claude` directory, settings.json)
- OpenCode (`.config/opencode` directory, opencode.json, flat command structure)
- Gemini (`.gemini` directory, settings.json, YAML array format for tools)

**Frontmatter Conversion Tests:**
1. Claude → OpenCode: Tool name mapping, color conversion, path replacement
2. Claude → Gemini: Tool name conversion to snake_case, MCP tool filtering, color removal

**Tool Name Mappings Verified:**
From `claudeToOpencodeTools`:
- `AskUserQuestion` → `question`
- `SlashCommand` → `skill`
- `TodoWrite` → `todowrite`
- Default: lowercase

From `claudeToGeminiTools`:
- `Read` → `read_file`
- `Write` → `write_file`
- `Bash` → `run_shell_command`
- etc.

## Integration Testing

**Installation Flow (End-to-End):**
1. Parse command-line arguments
2. Validate runtime and location selection
3. Call `install(isGlobal, runtime)` for each selected runtime
4. Verify each component installed:
   - Commands copied correctly
   - get-shit-done directory created
   - Agents installed with correct frontmatter
   - Hooks copied
   - VERSION file written
5. Configure settings.json with hooks and statusline
6. Print completion message with next steps

**Uninstall Flow (End-to-End):**
1. Validate directory exists
2. Remove commands (runtime-specific structure)
3. Remove get-shit-done directory
4. Remove agents (gsd-*.md only, preserve user agents)
5. Remove hooks (gsd-*.js only)
6. Clean up settings.json (remove hook registrations, statusline)
7. For OpenCode: clean permissions from opencode.json
8. Print completion message

**Tested Scenarios:**
- Fresh installation on clean system
- Reinstallation over existing installation (orphaned file cleanup)
- Mixed runtimes (Claude + OpenCode, etc.)
- Custom config directories
- Non-interactive environments (defaults to global Claude)

## Test Data & Fixtures

**No Dedicated Fixtures:**
- Test data generated inline for specific scenarios
- Color mappings and tool names hard-coded in module
- Mock data used for JSON parsing tests (e.g., empty settings, corrupted JSON)

**Runtime Configurations Used in Testing:**
Environment variables for config directory override:
- `CLAUDE_CONFIG_DIR`
- `GEMINI_CONFIG_DIR`
- `OPENCODE_CONFIG_DIR`

File locations verified:
- `~/.claude/` (Claude default)
- `~/.config/opencode/` (OpenCode XDG)
- `~/.gemini/` (Gemini default)

## Coverage Gaps

**Not Tested (by design):**
- Interactive readline prompts (tested with predefined responses)
- Actual npm publish workflow
- Gemini experimental agents feature (relies on Gemini CLI configuration)
- Windows-specific console issues (windowsHide verified for cross-platform)

**Partially Tested:**
- Hook execution (hooks installed, but not executed in test context)
- Update checking background process (spawned but not verified)
- OpenCode permission system (permissions written but not verified in actual OpenCode)

**How to Add Unit Tests (if needed):**
1. Install Jest: `npm install --save-dev jest`
2. Create `jest.config.js` with configuration for Node.js
3. Create `__tests__/` directory with test files for each module
4. Test patterns to implement:
   - Path expansion: `expandTilde()` with `~` and absolute paths
   - Tool name conversion: `convertToolName()`, `convertGeminiToolName()`
   - Settings I/O: `readSettings()`, `writeSettings()` with mocked fs
   - Frontmatter parsing: `convertClaudeToOpencodeFrontmatter()` with sample markdown
   - Color mapping: `colorNameToHex` object validation

## Manual Test Checklist

**Before Release:**
- [ ] `npm run build:hooks` succeeds
- [ ] `npx get-shit-done-cc --help` displays all options
- [ ] Interactive install prompts work on macOS/Windows/Linux
- [ ] Global install to ~/.claude succeeds
- [ ] Local install to ./.claude succeeds
- [ ] OpenCode install flattens commands correctly
- [ ] Gemini install converts frontmatter to TOML
- [ ] Statusline appears in Claude Code after install
- [ ] `/gsd:help` command available and loads
- [ ] `--uninstall --global --claude` removes only GSD files
- [ ] Settings.json preserved across reinstall
- [ ] Multiple runtimes install independently

**Configuration Verification:**
- [ ] Verify `settings.json` hook registration is correct
- [ ] Verify OpenCode `opencode.json` permissions set
- [ ] Verify Gemini experimental agents enabled
- [ ] Check PATH/environment variable handling

---

*Testing analysis: 2026-02-05*
