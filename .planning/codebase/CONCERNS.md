# Codebase Concerns

**Analysis Date:** 2026-02-05

## Tech Debt

### Fragile JSON Configuration Parsing

**Area:** Configuration management across workflows
**Files:**
- `get-shit-done/workflows/execute-phase.md:20, 62, 76-77, 80-86, 128-132`
- `get-shit-done/workflows/execute-plan.md:18`
- `get-shit-done/workflows/map-codebase.md:27-29`
- `get-shit-done/workflows/verify-work.md:25-27`
- `get-shit-done/workflows/complete-milestone.md:590, 598, 610`
- `commands/gsd/execute-phase.md:45, 100`
- `agents/gsd-executor.md:47`

**Issue:** Config values are parsed using fragile grep/sed patterns instead of proper JSON parsing:
```bash
# Current: fails if JSON is minified, spacing varies, or values aren't quoted
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
BRANCHING_STRATEGY=$(cat .planning/config.json 2>/dev/null | grep -o '"branching_strategy"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:.*"\([^"]*\)"/\1/' || echo "none")
```

**Impact:**
- Configuration settings silently fall back to defaults even when explicitly set
- Changes to JSON formatting could break workflow initialization
- Branch and milestone templates may not be read correctly
- Model profile selection becomes unpredictable

**Fix approach:**
Replace all grep/sed JSON parsing with `jq` (more robust):
```bash
MODEL_PROFILE=$(jq -r '.model_profile // "balanced"' .planning/config.json 2>/dev/null || echo "balanced")
```

This is a **high-priority fix** to prevent silent configuration failures across all workflows.

---

### Hardcoded Directory Paths

**Area:** Path constants scattered across codebase
**Files:**
- `hooks/gsd-statusline.js:49` - hardcoded `~/.claude/todos`
- `hooks/gsd-check-update.js:12` - hardcoded `~/.claude/`
- Multiple workflow files - hardcoded `.planning/`

**Issue:** Paths like `~/.claude/`, `.planning/`, etc. are repeated in many places. Changes to directory structure would require updates across multiple files.

**Impact:**
- Maintenance burden increases with each new location added
- Risk of inconsistency if path changes aren't applied everywhere
- Makes it harder to refactor directory layout

**Fix approach:**
Centralize path constants in a shared configuration module (e.g., `lib/constants.js` or `.planning/config.json`)

---

## Known Bugs

### Missing Error Handling in Statusline

**Bug description:** File system errors can crash the statusline
**Files:** `hooks/gsd-statusline.js:50-67`
**Severity:** High
**Status:** ✅ Already fixed (verified in `FIXES_APPLIED.md`)

**Current state:** The fix wraps directory operations in try-catch (lines 51-66), preventing crashes from permission errors or race conditions.

---

### Git Staging Violates Documented Rules

**Bug description:** Inconsistent use of `git add` flags
**Files:** `commands/gsd/execute-phase.md:94` (original violation)
**Severity:** Medium
**Status:** ✅ Already fixed

**Current state:** The fix replaced `git add -u` with individual file staging to comply with stated rules: "NEVER use git add . or git add -A or git add src/"

---

### Hex Color Validation Missing

**Bug description:** Invalid hex colors accepted in configuration
**Files:** `bin/install.js:437-441` (original issue)
**Severity:** Medium
**Status:** ✅ Already fixed

**Current state:** The fix validates hex color format with regex `/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i` before writing to config

---

## Security Considerations

### Insufficient Input Validation in Phase Names

**Risk:** Phase names used in shell commands and directory paths
**Files:**
- `get-shit-done/workflows/execute-phase.md:100-103`
- `get-shit-done/workflows/discuss-phase.md:290`

**Current situation:** Phase names are extracted via sed/grep and used in variable expansion. Special characters (spaces, quotes, etc.) could cause issues:

```bash
PHASE_NAME=$(grep "Phase ${PHASE}:" .planning/ROADMAP.md | sed 's/.*Phase [0-9]*: //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
# Used in: mkdir ".planning/phases/${PADDED_PHASE}-${PHASE_NAME}"
```

**Mitigation:** Variables are quoted in mkdir/directory operations, reducing immediate risk. However, edge cases exist if phase names contain special characters.

**Recommendations:**
- Validate phase names before using in file operations
- Consider allowlist for phase name characters (alphanumeric, hyphens, underscores only)

---

### Git Credentials Exposure Risk

**Risk:** Git operations in workflows may expose credentials in debug output
**Files:**
- `get-shit-done/workflows/execute-phase.md:90-170` (git operations)
- `commands/gsd/execute-phase.md` (git operations)

**Current mitigation:**
- Git commands don't echo credentials in output
- SSH key auth is assumed over HTTPS with embedded credentials

**Recommendations:**
- Document SSH key setup as best practice
- Add warning about not using password auth with embedded credentials in remote URLs
- Consider adding GIT_TERMINAL_PROMPT=0 to prevent credential prompts

---

## Performance Bottlenecks

### Large Workflow Files Affecting Readability and Maintenance

**Problem:** Workflows are very large, making them complex to navigate
**Files:**
- `get-shit-done/workflows/execute-plan.md:1851 lines`
- `get-shit-done/workflows/complete-milestone.md:903 lines`
- `get-shit-done/workflows/execute-phase.md:700 lines`

**Cause:** Monolithic workflow designs with multiple conditional branches and step sequences consolidated in single files

**Improvement path:**
- Consider modularizing workflows into smaller, composable units
- Extract common patterns into reusable templates
- Add section anchors for easier navigation

**Impact:** Medium - affects developer experience but not runtime performance

---

### Context Budget Pressure During Plan Execution

**Problem:** Large codebase context references can cause quality degradation
**Files:**
- `agents/gsd-planner.md:85-92` (explicit warning about context degradation)

**Current situation:** The planner explicitly documents quality degradation at 70%+ context usage. Plans that are too large force Claude into "completion mode" with reduced quality.

**Current mitigations:**
- Aggressive atomicity: 2-3 tasks per plan
- Context budget monitoring documented in planner
- Plans designed to complete within 50% context

**Monitoring needed:** Track average plan context usage over time to identify if atomicity boundaries need adjustment

---

## Fragile Areas

### State Management Across Phase Boundaries

**Component:** Phase execution orchestration
**Files:**
- `get-shit-done/workflows/execute-phase.md` (phase execution)
- `get-shit-done/STATE.md` references across multiple workflows
- `.planning/ROADMAP.md` for phase tracking

**Why fragile:**
- Multiple sources of truth for phase state (ROADMAP.md, STATE.md, directory structure)
- Inconsistencies between "In progress" markers and actual phase directories could cause wrong plan selection
- No validation that STATE.md matches actual file system state

**Safe modification:**
- Always verify STATE.md state against actual artifact existence before proceeding
- Add reconciliation step: list expected files vs. actual files before phase execution
- Document expected state invariants

**Test coverage:**
- No automated tests for state consistency
- Manual verification required for phase transitions

---

### Complex Branch Template Parsing

**Component:** Git branching strategy implementation
**Files:**
- `get-shit-done/workflows/execute-phase.md:80-86` (branch template parsing)
- `get-shit-done/workflows/complete-milestone.md:598-616` (branch list matching)

**Why fragile:**
- Branch names are extracted from templates using string manipulation
- Pattern matching to find milestone/phase branches relies on prefix extraction
- Assumes templates follow standard formats

```bash
# From template, extract prefix by removing variables
BRANCH_PREFIX=$(echo "$MILESTONE_BRANCH_TEMPLATE" | sed 's/{[^}]*}//g')
# Use prefix to find matching branches
PHASE_BRANCHES=$(git branch --list "${BRANCH_PREFIX}*" 2>/dev/null | sed 's/^\*//' | tr -d ' ')
```

**Safe modification:**
- Test template parsing with edge cases (templates with no variables, multiple variables)
- Add validation that extracted branches match expected naming pattern
- Consider storing metadata about which branches correspond to which phases

**Test coverage:**
- No unit tests for template parsing logic
- Manual verification needed for custom branch templates

---

### Multi-Step Wave Execution Without Rollback

**Component:** Plan execution with multiple waves
**Files:**
- `get-shit-done/workflows/execute-plan.md:1607+` (task execution loop)
- `agents/gsd-executor.md` (task execution)

**Why fragile:**
- Tasks execute in waves but no rollback mechanism if a wave fails
- Partial completion could leave code in inconsistent state
- No transaction semantics or checkpoint recovery

**Safe modification:**
- Document that each task should be idempotent
- Add pre-wave sanity checks
- Consider checkpointing after each wave completes

**Test coverage:**
- Integration tests needed for wave execution
- Error recovery scenarios should be tested

---

## Scaling Limits

### .planning Directory Growth

**Resource/System:** Project planning artifacts directory
**Current capacity:** Unbounded file accumulation
**Files:** `get-shit-done/.planning/` structure

**Limit:**
- No archive/cleanup mechanism documented
- Old milestones and phases accumulate indefinitely
- Search/listing becomes slower as artifact count grows

**Scaling path:**
- Archive old milestones to `.planning/.archive/` after completion
- Add cleanup command to remove old planning artifacts
- Consider documenting retention policy (e.g., keep last 5 milestones)

---

### Agent Context Window Saturation

**Resource/System:** Token budget for agent spawning
**Current capacity:** Single agents receive context up to 80% limit
**Files:** Multiple agent files reference context limits

**Limit:**
- Large projects with extensive context references could exceed context windows
- No adaptive context truncation documented
- If CONTEXT.md or referenced artifacts are very large, agents may run out of context

**Scaling path:**
- Implement context-aware reference loading (load only relevant sections)
- Add warning when total context references exceed 50% budget
- Document context limits for different agent profiles in `GSD-STYLE.md`

---

## Dependencies at Risk

### Fragile Bash String Manipulation

**Risk:** Shell script fragility from complex grep/sed patterns
**Impact:** Silent configuration failures, incorrect phase/milestone detection
**Files:**
- `get-shit-done/workflows/execute-phase.md` (multiple)
- `get-shit-done/workflows/complete-milestone.md` (branch template parsing)
- `get-shit-done/workflows/verify-phase.md` (file extraction from SUMMARY.md)

**Current approach:** Extensive use of grep, sed, cut, tr for parsing
**Alternative:** Use `jq` for JSON, proper shell functions for common patterns

**Migration plan:**
1. Create shared bash library with common parsing functions
2. Replace JSON parsing with jq calls
3. Add test cases for parsing edge cases
4. Gradually migrate workflows to use library functions

---

### No Dependency Lock File for Node Version

**Risk:** Inconsistent Node.js versions across environments
**Files:** `.nvmrc` (if present - needs verification)

**Current state:** `package.json` and `package-lock.json` exist, but Node.js version constraint is unclear

**Recommendation:**
- Ensure `.nvmrc` file exists and specifies minimum Node version
- Document Node.js version requirements in README

---

## Missing Critical Features

### No Workflow Undo/Rollback

**Problem:** If a workflow fails partway, no mechanism to undo partial changes
**Blocks:**
- Recovery from failed phase execution is manual
- Users must manually clean up incomplete work

**Solution approach:**
- Add rollback points after critical operations
- Document recovery procedures for common failure scenarios
- Consider git-based recovery (revert commits if workflow fails)

---

### No Automated State Validation

**Problem:** State consistency (STATE.md, ROADMAP.md, phase directories) not validated
**Blocks:**
- Detecting state corruption early
- Preventing workflows from using inconsistent state

**Solution approach:**
- Add `gsd:validate-state` command that checks consistency
- Warn user if state doesn't match artifact reality
- Document expected state invariants

---

### No Built-in Debugging for Failed Phases

**Problem:** When a phase fails, limited insight into what went wrong
**Blocks:**
- Quick diagnosis of phase failures
- Root cause analysis without manual file inspection

**Solution approach:**
- Leverage existing `gsd:debug` command more effectively
- Store phase execution logs in `.planning/debug/`
- Add structured error reporting

---

## Test Coverage Gaps

### No Unit Tests for Critical Path Functions

**Untested area:** Bash string parsing and JSON extraction
**Files:**
- Configuration parsing in workflows (grep/sed for model_profile, branching_strategy, etc.)
- Branch template parsing and pattern matching
- Phase name extraction from ROADMAP.md

**Risk:** Silent failures in these areas propagate through entire system
**Priority:** High

**Action:** Create test suite for parsing logic with edge cases:
- Minified JSON
- Missing fields with defaults
- Special characters in phase names
- Various template formats

---

### No Integration Tests for Workflow State Transitions

**Untested area:** Phase execution with multiple plans and waves
**Files:**
- `get-shit-done/workflows/execute-phase.md`
- `get-shit-done/workflows/execute-plan.md`

**Risk:** State corruption between phase/plan transitions could go undetected
**Priority:** Medium

**Test scenarios needed:**
- Phase with 3 plans executes in order
- Plan with multiple waves completes without race conditions
- Partial phase completion followed by resume
- State recovery after interrupted execution

---

### No Tests for Windows Path Handling

**Untested area:** Windows-specific path operations
**Files:**
- Multiple files with hardcoded `~/.claude/` paths
- Workflow files with directory operations

**Risk:** Workflows may fail on Windows without this coverage
**Priority:** Medium

**Test approach:**
- Run on Windows in GitHub Actions CI
- Test UNC paths, drive letters, backslash handling
- Verify shell command compatibility

---

## Additional Concerns

### Versioning and Deprecation Strategy

**Concern:** No clear deprecation path for breaking changes
**Files:** `CHANGELOG.md`, `CONTRIBUTING.md`

**Current state:**
- Pre-release tags documented for experimental features
- But no deprecation warning system for features being removed

**Recommendation:**
- Add deprecation warnings to features being phased out
- Document minimum notice period (e.g., one minor version) before removal
- Add migration guides when breaking changes occur

---

### Documentation Drift

**Concern:** Agent specifications and workflow implementations could diverge
**Files:**
- `agents/gsd-*.md` specifications
- `get-shit-done/workflows/` implementations

**Current state:**
- Both exist in separate locations
- Changes to one might not be reflected in the other

**Recommendation:**
- Single source of truth for workflow behavior (workflows themselves)
- Agent files as reference documentation
- Add validation that agents follow workflow specifications

---

## Summary Table

| Category | Area | Severity | Status | Action |
|----------|------|----------|--------|--------|
| Tech Debt | Fragile JSON parsing | High | Open | Replace grep/sed with jq |
| Tech Debt | Hardcoded paths | Low | Open | Centralize in config |
| Bug | Statusline errors | High | Fixed | Monitoring |
| Bug | Git staging rules | Medium | Fixed | Verification |
| Bug | Color validation | Medium | Fixed | Verification |
| Security | Phase name validation | Low | Mitigated | Add allowlist |
| Security | Git credentials | Low | Mitigated | Document best practices |
| Performance | Large workflow files | Medium | Open | Modularize |
| Performance | Context budget | Medium | Mitigated | Monitor usage |
| Fragile | State management | High | Open | Add validation |
| Fragile | Branch template parsing | Medium | Open | Add tests |
| Fragile | Wave execution | Medium | Open | Add checkpoints |
| Scaling | Planning artifacts | Low | Open | Add archival |
| Scaling | Context windows | Low | Open | Implement adaptive loading |
| Testing | Parsing logic | High | Open | Add unit tests |
| Testing | State transitions | Medium | Open | Add integration tests |
| Testing | Windows paths | Medium | Open | Add CI tests |

---

*Concerns audit: 2026-02-05*
