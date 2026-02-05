# Architecture

**Analysis Date:** 2026-02-05

## Pattern Overview

**Overall:** Multi-tier agent orchestration system with context engineering and spec-driven development workflow.

**Key Characteristics:**
- **Command-driven interface** — User runs slash commands that spawn orchestrators
- **Thin orchestrators** — Route and coordinate work without executing
- **Specialized agents** — Each agent owns one responsibility (planner, executor, verifier, researcher)
- **Subagent spawning via Task tool** — Fresh context per subagent (up to 200k tokens per execution)
- **Atomic state management** — `.planning/` directory tracks all decisions and progress
- **Git-integrated commits** — Per-task atomic commits with deterministic history

## Layers

**CLI Entry Layer:**
- Location: `bin/install.js`
- Purpose: Installation and runtime selection (Claude Code, OpenCode, Gemini)
- Handles: File copying, path translation, platform compatibility
- Depends on: Node.js filesystem APIs, readline for prompts
- Used by: npm install phase only

**Command Layer:**
- Location: `commands/gsd/*.md`
- Purpose: User-facing slash commands (e.g., `/gsd:new-project`, `/gsd:execute-phase`)
- Contains: ~28 commands with XML frontmatter (name, description, allowed-tools)
- Depends on: Agents, template system, state management
- Used by: User directly in Claude Code/OpenCode/Gemini

**Orchestrator Layer:**
- Location: Commands like `execute-phase.md`, `plan-phase.md` with process steps
- Purpose: Coordinate agents, manage dependencies, aggregate results
- Pattern: Parse state → Delegate to agents → Collect results → Update state
- Key orchestrators: execute-phase, plan-phase, verify-work, new-project
- Depends on: STATE.md, ROADMAP.md, config.json
- Used by: Task tool to spawn parallel agent waves

**Agent Layer:**
- Location: `agents/gsd-*.md`
- Purpose: Specialized execution engines
- Key agents:
  - `gsd-planner` — Creates atomic task plans from phase requirements
  - `gsd-executor` — Implements plans, commits per task, produces SUMMARY.md
  - `gsd-verifier` — Checks must-haves against actual codebase
  - `gsd-project-researcher` — Domain research for project initialization
  - `gsd-phase-researcher` — Phase-specific pattern research
  - `gsd-codebase-mapper` — Analyzes existing codebase structure
  - `gsd-debugger` — Systematic issue diagnosis
  - `gsd-plan-checker` — Validates plans achieve goals before execution
- Depends on: Templates, references, previous STATE.md
- Used by: Orchestrators via Task tool

**State & Template Layer:**
- Location: `get-shit-done/templates/`, `get-shit-done/references/`
- Purpose: Reusable templates and reference docs
- Templates: `project.md`, `requirements.md`, `plan.md`, `summary.md`, `context.md`, UAT.md, DEBUG.md
- References: `questioning.md`, `model-profiles.md`, `git-integration.md`, `verification-patterns.md`, `planning-config.md`
- Codebase templates: `architecture.md`, `structure.md`, `conventions.md`, `testing.md`, `stack.md`, `integrations.md`, `concerns.md`
- Used by: Agents when creating project artifacts
- Depends on: None (self-contained)

## Data Flow

**New Project Flow:**

1. User runs `/gsd:new-project` command
2. Command orchestrator executes: Brownfield detection → Questions → Research (optional) → Requirements extraction → Roadmap generation
3. Creates `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`
4. User proceeds to `/gsd:plan-phase 1`

**Phase Planning Flow:**

1. User runs `/gsd:plan-phase N`
2. Orchestrator discovers phase requirements from ROADMAP.md
3. Spawns 4 parallel research agents if `workflow.research=true`
4. Planner receives research results + user CONTEXT.md from discuss-phase
5. Planner creates 2-3 atomic PLAN.md files grouped by wave
6. Plan checker validates plans achieve goals (iteration loop if fails)
7. Plans ready for `/gsd:execute-phase`

**Phase Execution Flow:**

1. User runs `/gsd:execute-phase N`
2. Orchestrator discovers all *-PLAN.md files, groups by wave
3. For each wave (sequential):
   - Spawn parallel executor agents (Task calls) for each plan
   - Each executor: Read PLAN.md → Execute tasks → Commit each → Produce SUMMARY.md
   - Executors complete, return SUMMARY.md
4. Orchestrator triggers verifier if `workflow.verifier=true`
5. Verifier checks must-haves against actual codebase
6. Routes: gaps_found → offer gap closure plan, passed → next phase
7. Updates ROADMAP.md, STATE.md, REQUIREMENTS.md
8. Single orchestrator commit: `docs(phase-N): complete phase-name`

**State Management:**

1. `.planning/STATE.md` — Accumulated project state across sessions
   - Current phase/plan position
   - Accumulated decisions (locked constraints)
   - Blockers and concerns
   - Alignment status
2. `.planning/config.json` — Persistent workflow settings
   - Model profiles (quality/balanced/budget)
   - Workflow toggles (research, plan_check, verifier)
   - Execution settings (parallelization, commit_docs)
   - Git branching strategy
3. `.planning/ROADMAP.md` — Phase status and requirements traceability
   - Phase definitions with requirement IDs
   - Completion status per phase
   - Summary of deliverables

## Key Abstractions

**Command (Orchestrator):**
- Purpose: User-facing entry point with process steps
- Files: `commands/gsd/*.md` with YAML frontmatter
- Frontmatter: name, description, allowed-tools (determines what Claude can do)
- Process: Sequential steps with bash commands and conditional logic
- Pattern: Discover state → Validate → Execute → Update artifacts → Route next steps

**Agent:**
- Purpose: Specialized execution context for focused work
- Files: `agents/gsd-*.md` with role definition and responsibilities
- Role: Clear ownership of what this agent does (never overlaps)
- Tools: Specific subset (never `Task` — agents don't spawn agents)
- Output: Specific artifact (PLAN.md, SUMMARY.md, VERIFICATION.md, etc.)

**Task (Subagent Call):**
- Pattern: Orchestrator → `Task(agent: 'gsd-name', ...)` → Fresh 200k context → Subagent returns result
- Benefit: No context accumulation, each subagent starts fresh
- Usage: Orchestrators spawn parallel Task waves for executor, verifier, researchers
- Never recursive: Agents never call Task

**Plan (Executable Specification):**
- Format: PLAN.md with YAML frontmatter + XML task structure
- Frontmatter: phase, plan_number, type, wave, depends_on, autonomous
- Tasks: XML elements with type (auto/checkpoint/human), name, files, action, verify, done
- Execution: Parse XML → Execute tasks sequentially → Commit per task → Produce SUMMARY.md
- Verification: Built-in per-task (verify:) and plan-level success criteria

**CONTEXT.md (User Decisions):**
- Purpose: Captures user preferences from `/gsd:discuss-phase` before planning
- Structure: Decisions (locked choices), Deferred Ideas (out of scope), Claude's Discretion (use judgment)
- Usage: Planner reads this BEFORE planning, honors locked decisions exactly
- Impact: Ensures implementation matches user's vision, not reasonable defaults

## Entry Points

**User-Facing:**
- `commands/gsd/help.md` — Lists all available commands
- `commands/gsd/new-project.md` — Initialize project (mandatory first command)
- `commands/gsd/discuss-phase.md` — Capture implementation preferences
- `commands/gsd/plan-phase.md` — Create atomic task plans
- `commands/gsd/execute-phase.md` — Execute plans with parallel waves
- `commands/gsd/verify-work.md` — Manual UAT with auto-diagnosis

**Installation:**
- `bin/install.js` — Entry point for `npx get-shit-done-cc`
- Handles runtime selection, path setup, template copying

**Agents (Spawned by Orchestrators):**
- `agents/gsd-executor.md` — Spawned per plan in each wave
- `agents/gsd-planner.md` — Spawned once per phase
- `agents/gsd-verifier.md` — Spawned after execute-phase
- `agents/gsd-debugger.md` — Spawned by verify-work if failures detected
- `agents/gsd-phase-researcher.md` — Spawned in parallel if research enabled
- `agents/gsd-codebase-mapper.md` — Spawned by map-codebase (focus: tech, arch, quality, concerns)

## Error Handling

**Strategy:** Explicit error states with automatic routing, no silent failures.

**Patterns:**

1. **Validation errors (orchestrator):**
   - Check prerequisites before spawning agents
   - Example: Validate ROADMAP.md exists before planning
   - Action: Show error + suggest fix + exit

2. **Execution deviations (executor):**
   - Detect when task implementation doesn't match specification
   - Action: Log deviation, continue execution, flag in SUMMARY.md for human review

3. **Goal-backward verification (verifier):**
   - Check must-haves against actual codebase files
   - Gap found: Create gap-closure PLAN.md and offer re-execution
   - Action: User decides to re-plan with gaps or accept partial completion

4. **Checkpoint handling (executor):**
   - Executor stops at checkpoint, returns structured message
   - Orchestrator pauses, waits for user input
   - Continuation spawns fresh executor with `<completed_tasks>` context

5. **State recovery:**
   - If STATE.md exists but corrupted: Reconstruct from artifacts
   - If phase incomplete but executor crashed: Resume from last committed task

## Cross-Cutting Concerns

**Logging:** Console output via echo in orchestrators, detailed logging in SUMMARY.md per task

**Validation:** Every orchestrator validates prerequisites before spawning agents

**Authentication:** Not applicable (runs in Claude Code/user's IDE)

**Authorization:** Not applicable (assumes user owns the project)

**Testing:** Executors include verify: field per task for built-in assertions

**Documentation:** All planning artifacts tracked in `.planning/` with git integration

---

*Architecture analysis: 2026-02-05*
