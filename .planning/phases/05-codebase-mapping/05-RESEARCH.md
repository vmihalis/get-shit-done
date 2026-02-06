# Phase 5 Research: Codebase Mapping

**Researched:** 2026-02-05
**Domain:** Parallel codebase analysis via CLI subagents, mapper orchestration, output synthesis
**Confidence:** HIGH

## Executive Summary

Phase 5 implements the `/gsd-map-codebase.md` Cline workflow -- the command that spawns parallel mapper agents to analyze an existing codebase and produce 7 structured documents in `.planning/codebase/`. All the infrastructure this phase needs already exists:

- **Agent spawning** (`src/agent-spawn.js`): `spawnAgent()`, `spawnAgents()`, `waitForAgents()` -- fully implemented in Phase 2
- **Output collection** (`src/agent-collect.js`): `verifyOutputs()`, `collectOutputs()`, `reportResults()` -- fully implemented in Phase 2
- **State management** (`src/state-init.js`, `src/state-read.js`, `src/state-write.js`): Directory creation, config reading, state updates -- fully implemented in Phase 3
- **Upstream reference**: Complete agent definition (`agents/gsd-codebase-mapper.md`), command definition (`commands/gsd/map-codebase.md`), and workflow orchestration (`get-shit-done/workflows/map-codebase.md`) already exist in the upstream GSD codebase that was cloned
- **Codebase templates**: All 7 templates exist at `get-shit-done/templates/codebase/*.md`

The primary work is:
1. **Create the Cline workflow** (`workflows/gsd/gsd-map-codebase.md`) -- the markdown file that Cline injects as instructions when the user types `/gsd-map-codebase.md`
2. **Wire up the Node.js orchestration** -- a thin module (or direct Bash invocations in the workflow) that calls `spawnAgents()` + `waitForAgents()` + `verifyOutputs()` to coordinate the 4 mapper agents
3. **Write an integration test** (`scripts/test-map-codebase.js`) that validates the spawn -> wait -> verify -> collect pipeline in mock mode

No new dependencies are needed. No new agent definitions are needed (the upstream `gsd-codebase-mapper.md` agent is already complete). The Cline adaptation is purely about translating the upstream orchestration from Claude Code's `Task()` tool to Cline's `cline -y "prompt" &` CLI subagent pattern.

## Existing Infrastructure

### Agent Spawning (Phase 2 -- Complete)

**Module:** `src/agent-spawn.js`

| Function | Purpose | API |
|----------|---------|-----|
| `spawnAgent(prompt, options)` | Spawn single Cline CLI agent in background | Returns `{ pid, process }` |
| `spawnAgents(agents)` | Spawn multiple agents in parallel | Takes array of `{ prompt, outputFile, timeout, cwd }`, returns array |
| `waitForAgents(agents, options)` | Wait for all agents to complete | Returns `Promise<Array<{ pid, exitCode, outputFile, success }>>` |

**Key implementation details:**
- Platform-specific: Unix uses `detached: true` + `unref()`, Windows uses `shell: true`
- Spawns via `cline -y` (headless mode, auto-approve)
- Output file path appended to prompt: `"Write your output to: ${outputFile}"`
- Timeout support at both per-agent and overall level
- Captures stdout/stderr via `_capturedStdout()` / `_capturedStderr()` for debugging

### Output Collection (Phase 2 -- Complete)

**Module:** `src/agent-collect.js`

| Function | Purpose | API |
|----------|---------|-----|
| `verifyOutputs(files)` | Check expected output files exist | Returns `Promise<Array<{ path, exists, lines, bytes }>>` |
| `collectOutputs(files)` | Read content from output files | Returns `Promise<Array<{ path, content, error }>>` |
| `reportResults(verifications)` | Generate summary report string | Returns `{ total, found, missing, report }` |

### State Management (Phase 3 -- Complete)

**Relevant functions:**
- `ensurePlanningDir(projectRoot)` -- Creates `.planning/` and `.planning/phases/` (from `state-init.js`)
- `readPlanningConfig(planningDir)` -- Reads config.json with defaults merging, provides `model_profile` and `parallelization` settings (from `state-read.js`)
- `readState(planningDir)` -- Reads STATE.md for current position context (from `state-read.js`)

### Platform Detection (Phase 1 -- Complete)

**Module:** `src/platform.js`
- `getPlatform()` -- Returns `'mac'` | `'windows'` | `'linux'` | `'unknown'`
- Used by `agent-spawn.js` for platform-specific spawn options

### Terminal Output (Phase 1 -- Complete)

**Module:** `src/output.js`
- `success()`, `error()`, `warn()`, `info()`, `dim()`, `cyan()` -- Colored terminal output with picocolors

### Existing Workflow Patterns (Phase 4 -- Complete)

Two Cline workflows already established:
- `workflows/gsd/gsd-new-project.md` -- 10-step questioning + file generation workflow (244 lines)
- `workflows/gsd/gsd-progress.md` -- State reading + routing workflow (96 lines)

**Workflow format:**
```markdown
---
description: Brief description for command palette
---

# /gsd-name.md - Title

Instructional text...

## Step N: Step Name

Instructions with bash code blocks and conditional logic.
```

Key pattern: Workflows are pure markdown that Cline injects as instructions. The AI follows the steps, using tools (Read, Write, Bash, Glob, Grep) as directed. Node.js helpers are invoked via `node -e "..."` in Bash tool calls.

### Existing Documentation Workflows

Reference workflows already exist in the upstream clone:
- `workflows/gsd/gsd-spawn-agents.md` -- Documents the parallel agent spawning pattern (180 lines)
- `workflows/gsd/gsd-collect-outputs.md` -- Documents the output verification and collection pattern (184 lines)

These serve as documentation; the actual Cline workflow that the user triggers is `gsd-map-codebase.md`.

## Upstream Reference

### Upstream Agent: `gsd-codebase-mapper.md`

**Location:** `agents/gsd-codebase-mapper.md` (739 lines)

The upstream mapper agent is fully defined with:

**4 focus areas**, each producing specific documents:
| Focus | Output Documents | Content |
|-------|-----------------|---------|
| `tech` | STACK.md, INTEGRATIONS.md | Languages, runtime, frameworks, dependencies, external APIs, databases |
| `arch` | ARCHITECTURE.md, STRUCTURE.md | Pattern overview, layers, data flow, entry points, directory layout |
| `quality` | CONVENTIONS.md, TESTING.md | Code style, naming, imports, error handling, test framework, mocking |
| `concerns` | CONCERNS.md | Tech debt, known bugs, security, performance, fragile areas |

**Key design principles from upstream:**
1. **Agents write documents directly** to `.planning/codebase/` -- orchestrator never receives document contents
2. **Agents return only confirmation** (~10 lines) with file paths and line counts
3. **Templates are embedded in the agent definition** -- each focus area has a complete template with sections and placeholders
4. **File paths are mandatory** -- every finding must include a backtick-formatted file path
5. **Prescriptive over descriptive** -- "Use X pattern" not "X pattern is used"

**Agent output format:**
```
## Mapping Complete

**Focus:** {focus}
**Documents written:**
- `.planning/codebase/{DOC1}.md` ({N} lines)
- `.planning/codebase/{DOC2}.md` ({N} lines)

Ready for orchestrator summary.
```

### Upstream Command: `commands/gsd/map-codebase.md`

**Location:** `commands/gsd/map-codebase.md` (72 lines)

Defines the user-facing command with:
- References `get-shit-done/workflows/map-codebase.md` as execution context
- Checks for optional focus area argument
- Can run before or after `/gsd:new-project`
- Offers refresh/update/skip if `.planning/codebase/` already exists

### Upstream Workflow: `get-shit-done/workflows/map-codebase.md`

**Location:** `get-shit-done/workflows/map-codebase.md` (323 lines)

Complete orchestration flow:
1. **resolve_model_profile** -- Read `model_profile` from config.json, look up mapper model (quality=sonnet, balanced=haiku, budget=haiku)
2. **check_existing** -- If `.planning/codebase/` exists, offer Refresh/Update/Skip
3. **create_structure** -- `mkdir -p .planning/codebase`
4. **spawn_agents** -- 4 parallel agents (tech, arch, quality, concerns) using Task tool with `run_in_background: true`
5. **collect_confirmations** -- Wait for all 4 agents, read confirmation output files
6. **verify_output** -- `ls -la .planning/codebase/` + `wc -l .planning/codebase/*.md`, check all 7 docs exist with >20 lines
7. **commit_codebase_map** -- `git add .planning/codebase/*.md && git commit -m "docs: map existing codebase"`
8. **offer_next** -- Line counts summary, suggest `/gsd:new-project` as next step

**Cline adaptation needed:** The upstream uses `Task()` tool with `subagent_type` and `model` parameters. Cline-GSD replaces this with `spawnAgents()` from `src/agent-spawn.js`, which calls `cline -y "prompt" &`.

### Upstream Templates: `get-shit-done/templates/codebase/*.md`

All 7 templates exist with:
- Detailed section structure with placeholders
- Good examples showing completed templates
- Guidelines for what belongs / doesn't belong in each document
- "Useful for phase planning when" guidance

Templates: `stack.md`, `architecture.md`, `structure.md`, `conventions.md`, `testing.md`, `integrations.md`, `concerns.md`

## Implementation Approach

### Plan 05-01: Mapper Workflow and Orchestration Module

**Deliverables:**
1. `workflows/gsd/gsd-map-codebase.md` -- Cline workflow file (user types `/gsd-map-codebase.md`)
2. `src/map-codebase.js` -- Node.js orchestration module that coordinates the spawn -> wait -> verify pipeline

**Why a Node.js module:** The workflow needs to:
- Read config.json for model_profile and parallelization settings
- Construct 4 mapper prompts with focus area and output file paths
- Call `spawnAgents()` with the prompt array
- Call `waitForAgents()` with timeout
- Call `verifyOutputs()` on the 7 expected files
- Call `reportResults()` to generate the summary

This is more logic than comfortable as inline `node -e` in the workflow. A dedicated module keeps the workflow clean and the logic testable.

**Workflow structure (gsd-map-codebase.md):**
```
Step 1: Check existing -- ls .planning/codebase/, offer refresh/skip
Step 2: Create directory -- mkdir -p .planning/codebase
Step 3: Spawn mappers -- invoke src/map-codebase.js (or inline Bash calling Node)
Step 4: Wait and verify -- check all 7 files exist
Step 5: Commit -- git add + commit if commit_docs=true
Step 6: Present results -- line counts, suggest next step
```

**Orchestration module API (src/map-codebase.js):**
```javascript
/**
 * Build mapper agent prompts for each focus area.
 * @param {string} cwd - Working directory for agents
 * @returns {Array<{prompt: string, outputFile: string, focus: string}>}
 */
export function buildMapperPrompts(cwd)

/**
 * Run the full mapping pipeline: spawn -> wait -> verify -> report.
 * @param {string} projectRoot - Project root directory
 * @param {object} options
 * @param {number} [options.timeout] - Per-agent timeout in ms (default: 300000 = 5 min)
 * @returns {Promise<{success: boolean, data?: {report: string, verifications: Array}, error?: string}>}
 */
export async function runMapping(projectRoot, options)
```

**Mapper prompt construction:** Each prompt includes:
- The focus area (tech/arch/quality/concerns)
- The exact output file paths
- The full agent role description and template (embedded from `agents/gsd-codebase-mapper.md`)
- Instruction to explore thoroughly and write directly

**Critical decision: Prompt content.** The upstream `gsd-codebase-mapper.md` is 739 lines. Sending the entire agent definition as a CLI prompt would be impractical. Two approaches:

**Option A: Reference the agent file in the prompt.** Tell the agent to read the file:
```
Read the agent definition at agents/gsd-codebase-mapper.md and follow its instructions.
Focus: tech
Write output to .planning/codebase/STACK.md and .planning/codebase/INTEGRATIONS.md
```
- Pro: Keeps prompts short, agent file stays authoritative
- Con: Requires the agent to use a Read tool call first, adding latency; depends on file being accessible

**Option B: Embed a condensed prompt with templates inline.**
Build a focused prompt per focus area (~100-200 lines) that includes the relevant template and exploration instructions, without the full 739-line agent definition.
- Pro: Self-contained, no file dependency, faster agent startup
- Con: Template duplication, harder to update

**Recommendation: Option A (reference the agent file).** The agent file is already in the repo at a known path. The Cline agent can read it in one tool call. This keeps prompts DRY and ensures the agent always uses the latest template definition. The slight latency cost is negligible compared to the actual codebase exploration.

### Plan 05-02: Output Synthesis and Integration Test

**Deliverables:**
1. Synthesis logic in the workflow (verify all 7 docs, present summary with line counts)
2. `scripts/test-map-codebase.js` -- Integration test following established pattern

**Synthesis approach:** The upstream workflow explicitly avoids reading document contents back into the orchestrator. Instead, synthesis means:
- Verify all 7 documents exist
- Check each has >20 lines (not empty/stub)
- Present line counts to user
- Git commit all 7 files together
- Suggest next step (`/gsd-new-project.md` or `/gsd-progress.md`)

This is intentional -- the mapper agents write self-contained documents that are consumed by downstream commands (`/gsd-plan-phase`, `/gsd-execute-phase`) directly, not synthesized into a combined document.

**Integration test pattern (from `scripts/test-agent-infra.js`):**
- Check if Cline CLI available
- If not: mock mode (create dummy files, verify the pipeline works)
- If yes: full mode (actually spawn agents)
- Tmpdir isolation
- Cleanup in finally block
- PASS/FAIL output
- Script registered in package.json as `test:map-codebase`

## Mapper Focus Areas

### Focus: tech (Agent 1)
**Outputs:** STACK.md, INTEGRATIONS.md
**Explores:**
- `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `pyproject.toml` -- package manifests
- `*.config.*`, `.env*`, `tsconfig.json`, `.nvmrc` -- configuration files
- SDK/API imports via grep (`import.*stripe`, `import.*supabase`, etc.)
**Writes:**
- STACK.md: Languages, runtime, frameworks, dependencies, configuration, platform requirements
- INTEGRATIONS.md: External APIs, databases, auth providers, file storage, CI/CD, webhooks

### Focus: arch (Agent 2)
**Outputs:** ARCHITECTURE.md, STRUCTURE.md
**Explores:**
- Directory structure via `find . -type d` (excluding node_modules, .git)
- Entry points: `src/index.*`, `src/main.*`, `src/app.*`, `app/page.*`
- Import patterns via `grep -r "^import"` to understand layers
**Writes:**
- ARCHITECTURE.md: Pattern overview, layers, data flow, key abstractions, entry points, error handling
- STRUCTURE.md: Directory layout, purposes, key file locations, naming conventions, "where to add new code"

### Focus: quality (Agent 3)
**Outputs:** CONVENTIONS.md, TESTING.md
**Explores:**
- Linting/formatting config: `.eslintrc*`, `.prettierrc*`, `biome.json`
- Test files: `*.test.*`, `*.spec.*`, test config files
- Sample source files for convention analysis
**Writes:**
- CONVENTIONS.md: Code style, naming, imports, error handling, logging, function design
- TESTING.md: Framework, file organization, test structure, mocking, fixtures, coverage

### Focus: concerns (Agent 4)
**Outputs:** CONCERNS.md
**Explores:**
- TODO/FIXME/HACK/XXX comments
- Large files (complexity indicator)
- Empty returns/stubs
- Security patterns
**Writes:**
- CONCERNS.md: Tech debt, known bugs, security considerations, performance bottlenecks, fragile areas, scaling limits, dependency risks, test coverage gaps

## Workflow Structure

### File: `workflows/gsd/gsd-map-codebase.md`

```markdown
---
description: Analyze existing codebase with parallel mapper agents
---

# /gsd-map-codebase.md - Map Existing Codebase

## Step 1: Check existing codebase map
[Check if .planning/codebase/ exists, offer refresh/skip/update]

## Step 2: Read configuration
[Read .planning/config.json for model_profile, parallelization, commit_docs]

## Step 3: Create output directory
[mkdir -p .planning/codebase]

## Step 4: Spawn mapper agents
[Invoke Node.js module or construct spawn commands directly]
[4 agents: tech, arch, quality, concerns]
[Each agent reads agents/gsd-codebase-mapper.md and follows its focus area]

## Step 5: Wait for completion and verify
[Wait for all agents, verify 7 files exist with >20 lines each]
[Handle partial failures: report which agents failed, which succeeded]

## Step 6: Commit codebase map
[git add .planning/codebase/*.md && git commit if commit_docs=true]

## Step 7: Present results and next steps
[Line counts for each file]
[Suggest: /gsd-new-project.md or /gsd-progress.md]
```

**Estimated length:** ~120-180 lines (comparable to gsd-new-project.md at 244 lines, simpler flow with fewer interactive steps).

### File: `src/map-codebase.js`

**Module responsibilities:**
1. Build mapper prompts (4 prompts, one per focus area)
2. Execute the spawn -> wait -> verify pipeline
3. Return structured result for the workflow to consume

**Functions:**
- `buildMapperPrompts(cwd)` -- Constructs the 4 agent prompts with focus area and output paths
- `runMapping(projectRoot, options)` -- Full pipeline: spawn, wait, verify, report
- `getExpectedOutputFiles(planningDir)` -- Returns array of 7 expected file paths

**Error-return pattern:** All functions return `{ success, data, error }` per project convention.

## Synthesis Strategy

The synthesis strategy is deliberately minimal, matching the upstream pattern:

1. **No content aggregation.** The orchestrator never reads document contents. Each mapper writes self-contained documents that are consumed directly by downstream commands.

2. **Verification only.** Synthesis = confirming all 7 documents exist, have reasonable length (>20 lines), and were written successfully.

3. **Line count reporting.** The user sees a summary with line counts per document, giving confidence that mappers produced substantive output.

4. **Git commit as coherence checkpoint.** All 7 documents are committed together in a single commit, creating an atomic snapshot of the codebase understanding.

5. **Downstream consumption.** The real "synthesis" happens when other commands consume these documents:
   - `/gsd-plan-phase` loads relevant codebase docs based on phase type (e.g., UI phases load CONVENTIONS.md + STRUCTURE.md)
   - `/gsd-execute-phase` references codebase docs when writing code
   - The mapping table in `agents/gsd-codebase-mapper.md` documents which documents are loaded for which phase types

**Why this works:** Each mapper agent has fresh context (no cross-contamination). Documents are structured with standardized templates, so they compose naturally. The planner/executor loads only the relevant subset, avoiding context bloat.

## Requirements Mapping

| Requirement | Implementation |
|-------------|---------------|
| MAP-01: `/gsd:map-codebase` spawns parallel mappers | Workflow calls `spawnAgents()` with 4 mapper prompts |
| MAP-02: Mappers produce STACK.md, ARCHITECTURE.md, etc. | Each mapper writes to `.planning/codebase/` per focus area |
| MAP-03: Mapping works via CLI subagents | Uses `cline -y "prompt" &` via `src/agent-spawn.js` |

## Estimated Plan Structure

### Plan 05-01: Mapper Orchestration Module and Workflow
**Type:** Feature
**Files:**
- `src/map-codebase.js` (NEW) -- Orchestration module
- `workflows/gsd/gsd-map-codebase.md` (NEW) -- Cline workflow
**Tasks:**
1. Create `src/map-codebase.js` with `buildMapperPrompts()`, `runMapping()`, `getExpectedOutputFiles()`
2. Create `workflows/gsd/gsd-map-codebase.md` workflow with 7-step flow
3. Add `test:map-codebase` script to `package.json`

### Plan 05-02: Integration Test and Verification
**Type:** Test
**Files:**
- `scripts/test-map-codebase.js` (NEW) -- Integration test
**Tasks:**
1. Create integration test with mock mode (no Cline CLI required)
2. Test prompt construction, file path generation, verification pipeline
3. Test workflow can handle partial failures (some agents fail)
4. Verify the complete pipeline in mock mode: spawn (mock) -> verify -> collect -> report

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cline CLI not available during testing | High | Medium | Mock mode in integration test (established pattern) |
| Mapper agents time out on large codebases | Medium | Medium | Default 5-minute timeout, configurable; scope prompts narrowly |
| Agents can't read `agents/gsd-codebase-mapper.md` | Low | High | File is in repo at known path; fallback: embed condensed prompt |
| Race condition on `.planning/codebase/` writes | Low | Low | Each agent writes to different files; no shared file writes |
| Agent context exhaustion on very large repos | Medium | Medium | Upstream agent already advises narrow scoping; per-focus isolation helps |

## Open Questions

1. **Agent prompt approach (reference vs embed)**
   - Current recommendation: Reference the agent file (`agents/gsd-codebase-mapper.md`)
   - Alternative: Embed condensed templates inline in each prompt
   - Decision needed during planning. Reference approach is cleaner but adds one tool call per agent.
   - **Leaning: Reference.** Keeps prompts DRY, ensures template consistency.

2. **Model profile for mapper agents**
   - Upstream uses: quality=sonnet, balanced=haiku, budget=haiku
   - Cline-GSD uses `cline -y` which uses whatever model is configured in Cline settings
   - The `model_profile` config setting may not be directly applicable to Cline CLI invocations
   - **Question:** Can Cline CLI accept a model override flag? If not, model selection is handled at the Cline app level, not per-agent.
   - **Recommendation:** Document that model selection is a Cline-level setting, not per-agent. The workflow can note the recommended model profile but cannot enforce it.

3. **Parallelization disabled**
   - If `config.parallelization=false`, should mappers run sequentially?
   - Upstream doesn't address this (always parallel)
   - **Recommendation:** If parallelization is disabled, run mappers sequentially (spawn one, wait, spawn next). The module can handle both modes.

4. **Partial failure handling**
   - If 1 of 4 agents fails, should we:
     a. Re-run the failed agent once
     b. Continue with partial results
     c. Abort and report
   - **Recommendation:** Continue with partial results + report which agents failed. Offer to re-run failed agents. Matches upstream pattern of graceful degradation.

5. **Installer integration**
   - The workflow file `gsd-map-codebase.md` needs to be copied to `~/Documents/Cline/Workflows/` during installation
   - The installer (`bin/install.js`) already copies `workflows/gsd/*.md` files
   - **No additional work needed** -- the new file will be picked up automatically by the existing installer logic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent spawning | Custom process management | `src/agent-spawn.js:spawnAgents()` | Already handles cross-platform spawn |
| Agent waiting | Custom polling loop | `src/agent-spawn.js:waitForAgents()` | Already handles timeout + exit codes |
| Output verification | Custom file checks | `src/agent-collect.js:verifyOutputs()` | Already counts lines and bytes |
| Output collection | Custom file reading | `src/agent-collect.js:collectOutputs()` | Already handles missing files |
| Summary report | Custom formatting | `src/agent-collect.js:reportResults()` | Already generates summary string |
| Config reading | JSON grep/sed | `src/state-read.js:readPlanningConfig()` | Already merges with defaults |
| Directory creation | Custom mkdir | `src/state-init.js:ensurePlanningDir()` | Already handles .planning/ creation |
| Terminal output | Raw console.log | `src/output.js:success/error/warn/info` | Already provides colored output |
| Mapper templates | New template files | `agents/gsd-codebase-mapper.md` | Already has all 7 templates embedded |
| Codebase doc format | Custom format | `get-shit-done/templates/codebase/*.md` | Already has template structure |

## RESEARCH COMPLETE
