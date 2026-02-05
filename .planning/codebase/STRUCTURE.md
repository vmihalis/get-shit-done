# Codebase Structure

**Analysis Date:** 2026-02-05

## Directory Layout

```
get-shit-done/
├── bin/                          # Installation entry point
│   └── install.js                # npm install entrypoint (runtime selection, file copying)
├── agents/                        # Specialized execution agents
│   ├── gsd-planner.md             # Creates phase plans
│   ├── gsd-executor.md            # Executes plans, per-task commits
│   ├── gsd-verifier.md            # Validates must-haves post-execution
│   ├── gsd-debugger.md            # Systematic issue diagnosis
│   ├── gsd-project-researcher.md  # Domain research for new projects
│   ├── gsd-phase-researcher.md    # Phase-specific pattern research
│   ├── gsd-plan-checker.md        # Validates plans before execution
│   ├── gsd-codebase-mapper.md     # Analyzes existing codebase
│   ├── gsd-roadmapper.md          # Generates roadmap from requirements
│   ├── gsd-research-synthesizer.md # Consolidates research findings
│   ├── gsd-integration-checker.md # Validates external integrations
│   └── gsd-integration-checker.md # Validates external integrations
├── commands/gsd/                  # User-facing slash commands
│   ├── new-project.md             # Initialize project (questions → research → requirements → roadmap)
│   ├── discuss-phase.md           # Capture user decisions before planning
│   ├── plan-phase.md              # Create phase plans with research
│   ├── execute-phase.md           # Execute plans with wave-based parallelization
│   ├── verify-work.md             # Manual UAT with auto-diagnosis
│   ├── pause-work.md              # Handoff when stopping mid-phase
│   ├── resume-work.md             # Restore from last session
│   ├── add-phase.md               # Append phase to roadmap
│   ├── insert-phase.md            # Insert urgent work between phases
│   ├── remove-phase.md            # Remove future phase, renumber
│   ├── complete-milestone.md      # Archive milestone, tag release
│   ├── new-milestone.md           # Start next version
│   ├── audit-milestone.md         # Verify milestone definition of done
│   ├── plan-milestone-gaps.md     # Create phases to close audit gaps
│   ├── list-phase-assumptions.md  # See Claude's intended approach
│   ├── quick.md                   # Ad-hoc task execution
│   ├── debug.md                   # Systematic debugging with state
│   ├── progress.md                # Show current status
│   ├── help.md                    # Command reference
│   ├── settings.md                # Configure workflow
│   ├── set-profile.md             # Switch model profile
│   ├── add-todo.md                # Capture idea for later
│   ├── check-todos.md             # List pending todos
│   ├── update.md                  # Check for updates
│   └── join-discord.md            # Join community
├── get-shit-done/                 # System templates and references
│   ├── references/                # Read-only reference docs
│   │   ├── questioning.md         # Deep question templates
│   │   ├── ui-brand.md            # UI/UX terminology and patterns
│   │   ├── model-profiles.md      # Model selection logic
│   │   ├── git-integration.md     # Git commit patterns
│   │   ├── planning-config.md     # Configuration options
│   │   ├── verification-patterns.md # Testing and verification patterns
│   │   ├── tdd.md                 # Test-driven development flow
│   │   ├── continuation-format.md # Checkpoint continuation format
│   │   └── checkpoints.md         # Checkpoint protocol
│   ├── templates/                 # Artifact templates
│   │   ├── project.md             # PROJECT.md template
│   │   ├── requirements.md        # REQUIREMENTS.md template
│   │   ├── context.md             # CONTEXT.md template (per-phase decisions)
│   │   ├── plan.md                # PLAN.md template (atomic tasks)
│   │   ├── summary.md             # SUMMARY.md template (execution report)
│   │   ├── discovery.md           # DISCOVERY.md template (research findings)
│   │   ├── UAT.md                 # UAT.md template (manual testing)
│   │   ├── DEBUG.md               # DEBUG.md template (issue diagnosis)
│   │   ├── milestone.md           # Milestone definition template
│   │   ├── milestone-archive.md   # Milestone archive template
│   │   ├── continue-here.md       # Checkpoint continuation guide
│   │   ├── phase-prompt.md        # Phase execution prompt structure
│   │   ├── config.json            # Planning config template
│   │   ├── planner-subagent-prompt.md # Planner context template
│   │   ├── debug-subagent-prompt.md  # Debugger context template
│   │   └── codebase/              # Codebase analysis templates
│   │       ├── architecture.md    # ARCHITECTURE.md template
│   │       ├── structure.md       # STRUCTURE.md template
│   │       ├── conventions.md     # CONVENTIONS.md template
│   │       ├── testing.md         # TESTING.md template
│   │       ├── stack.md           # STACK.md template
│   │       ├── integrations.md    # INTEGRATIONS.md template
│   │       └── concerns.md        # CONCERNS.md template
│   └── workflows/                 # Workflow orchestration docs
│       ├── execute-phase.md       # Execute phase orchestration
│       ├── plan-phase.md          # Planning orchestration
│       ├── verify-work.md         # Verification orchestration
│       ├── verify-phase.md        # Phase verification orchestration
│       ├── execute-plan.md        # Single plan execution
│       ├── discuss-phase.md       # Discussion orchestration
│       ├── discovery-phase.md     # Research orchestration
│       ├── diagnose-issues.md     # Issue diagnosis orchestration
│       ├── complete-milestone.md  # Milestone completion
│       ├── resume-project.md      # Session resumption
│       ├── transition.md          # Phase-to-phase transition
│       ├── map-codebase.md        # Codebase mapping orchestration
│       └── list-phase-assumptions.md # Phase assumptions
├── hooks/                         # Git hooks and session hooks
│   ├── gsd-statusline.js          # Status display for IDE statusline
│   ├── gsd-check-update.js        # Update checker
│   └── dist/                      # Compiled hooks (esbuild output)
├── scripts/                       # Build scripts
│   └── build-hooks.js             # Compiles hooks/ to dist/
├── package.json                   # Node.js package metadata
├── CHANGELOG.md                   # Version history
├── README.md                      # Main documentation
├── GSD-STYLE.md                   # Style guide for GSD development
├── CONTRIBUTING.md               # Contribution guidelines
└── MAINTAINERS.md                # Maintainer information
```

## Directory Purposes

**`bin/`:**
- Purpose: Installation and setup automation
- Contains: Single entry point for npm
- Key files: `install.js` handles multi-runtime support (Claude, OpenCode, Gemini)
- Usage: Invoked via `npx get-shit-done-cc` during first-time setup

**`agents/`:**
- Purpose: Specialized Claude execution contexts
- Contains: 11+ agent definitions with specific responsibilities
- Key files:
  - `gsd-planner.md` — Creates 2-3 atomic plans per phase
  - `gsd-executor.md` — Executes PLAN.md with per-task commits
  - `gsd-verifier.md` — Validates must-haves post-execution
  - `gsd-debugger.md` — Systematic issue diagnosis with state persistence
  - `gsd-codebase-mapper.md` — Analyzes existing codebase (spawned by `/gsd:map-codebase`)
- Usage: Spawned by orchestrators via Task tool with fresh context per agent

**`commands/gsd/`:**
- Purpose: User-facing slash commands
- Contains: 28 markdown files with YAML frontmatter and process steps
- Key files:
  - `new-project.md` — Mandatory first command
  - `plan-phase.md` — Creates phase plans
  - `execute-phase.md` — Executes plans with parallelization
  - `verify-work.md` — Manual testing and diagnosis
  - `progress.md` — Status display
- Naming: Flat structure under `gsd/` directory
- Usage: Invoked as `/gsd:help`, `/gsd:new-project`, `/gsd:plan-phase 1`, etc.

**`get-shit-done/references/`:**
- Purpose: Read-only reference materials for agents
- Contains: Best practices, patterns, question templates
- Key files:
  - `questioning.md` — Deep questioning frameworks
  - `model-profiles.md` — Model selection logic
  - `verification-patterns.md` — How to verify work
  - `git-integration.md` — Commit message patterns
- Usage: Referenced via `@~/.claude/get-shit-done/references/filename.md` in agents and commands

**`get-shit-done/templates/`:**
- Purpose: Artifact templates for projects
- Contains: Markdown templates with placeholder sections
- Key files:
  - `project.md` — PROJECT.md template (vision, stack, constraints)
  - `requirements.md` — REQUIREMENTS.md template (scoped v1/v2)
  - `plan.md` — PLAN.md template (XML task structure)
  - `summary.md` — SUMMARY.md template (execution report)
- Subdirectory `codebase/` — Templates for `/gsd:map-codebase` analysis documents
- Usage: Copied to `.planning/` during execution, filled in by agents

**`get-shit-done/templates/codebase/`:**
- Purpose: Codebase analysis templates
- Contains: 7 templates for existing codebase analysis
- Files:
  - `architecture.md` — Architecture pattern analysis
  - `structure.md` — Directory layout and file placement rules
  - `conventions.md` — Coding standards and patterns
  - `testing.md` — Test framework and patterns
  - `stack.md` — Technology stack
  - `integrations.md` — External service integrations
  - `concerns.md` — Technical debt and issues
- Usage: Written to `.planning/codebase/` by `gsd-codebase-mapper` agent

**`get-shit-done/workflows/`:**
- Purpose: Process orchestration documents
- Contains: Step-by-step workflows for major operations
- Key files:
  - `execute-phase.md` — Wave-based parallel execution
  - `plan-phase.md` — Planning with research and validation
  - `verify-work.md` — User acceptance testing workflow
- Usage: Referenced by orchestrators to guide process steps

**`hooks/`:**
- Purpose: Git and session lifecycle hooks
- Contains: JavaScript files for IDE integration
- Key files:
  - `gsd-statusline.js` — Shows model, task, context usage in IDE statusline
  - `gsd-check-update.js` — Periodic update checking
- Built: `npm run build:hooks` compiles TypeScript to `dist/` for distribution
- Usage: Installed to `~/.claude/hooks/` or project `.claude/hooks/`

**`scripts/`:**
- Purpose: Build and automation
- Contains: esbuild configuration for hook compilation
- Key files: `build-hooks.js` — Compiles hooks for npm distribution

## Key File Locations

**Entry Points:**
- `bin/install.js` — npm install command (runtime detection, file copying)
- `commands/gsd/help.md` — First command users run (`/gsd:help`)
- `commands/gsd/new-project.md` — Mandatory initialization (`/gsd:new-project`)

**Configuration:**
- `get-shit-done/templates/config.json` — Planning behavior config template
- `get-shit-done/references/model-profiles.md` — Model selection logic

**Core Logic:**
- `agents/gsd-planner.md` — Creates phase plans with XML task structure
- `agents/gsd-executor.md` — Executes PLAN.md with per-task commits
- `agents/gsd-verifier.md` — Validates must-haves against actual codebase

**Testing & Verification:**
- `get-shit-done/references/verification-patterns.md` — How to verify work
- `get-shit-done/templates/UAT.md` — Manual user acceptance testing template
- `get-shit-done/templates/DEBUG.md` — Issue diagnosis template

## Naming Conventions

**Files:**
- Commands: `commands/gsd/{verb}-{noun}.md` (e.g., `plan-phase.md`, `verify-work.md`)
- Agents: `agents/gsd-{role}.md` (e.g., `gsd-planner.md`, `gsd-executor.md`)
- Templates: `get-shit-done/templates/{artifact-type}.md` (e.g., `project.md`, `plan.md`)
- Workflows: `get-shit-done/workflows/{process-name}.md` (e.g., `execute-phase.md`)

**Directories:**
- `commands/gsd/` — All user commands under one directory
- `agents/` — All agents at root level (11 files)
- `get-shit-done/` — All system templates and references
- `get-shit-done/templates/codebase/` — Codebase analysis templates
- `hooks/dist/` — Compiled and distributable hooks

**Project Artifacts (in user's `.planning/` directory):**
- `PROJECT.md` — Project context and vision
- `REQUIREMENTS.md` — Scoped features with v1/v2/out-of-scope
- `ROADMAP.md` — Phase definitions with status
- `STATE.md` — Accumulated decisions and position
- `config.json` — Workflow settings
- `{phase}-CONTEXT.md` — User decisions from discuss-phase (phase-specific)
- `{phase}-PLAN-{N}.md` — Atomic task plans (2-3 per phase)
- `{phase}-SUMMARY-{N}.md` — Execution reports (per plan)
- `{phase}-VERIFICATION.md` — Post-execution verification status

## Where to Add New Code

**New Command:**
- Location: `commands/gsd/{verb}-{noun}.md`
- Structure: YAML frontmatter + `<objective>` + `<execution_context>` + `<process>` with step numbering
- Tools available: Declare in `allowed-tools:` frontmatter
- Pattern: Parse state → Validate → Delegate to agents → Collect → Update state
- Example: `commands/gsd/quick.md` for quick ad-hoc tasks

**New Agent:**
- Location: `agents/gsd-{role}.md`
- Structure: YAML frontmatter with role + responsibilities + specific tool/output constraints
- Output: Single artifact type (PLAN.md, SUMMARY.md, VERIFICATION.md)
- Never spawns other agents (no Task tool)
- Usage: Add to `allowed-tools:` in orchestrator command that spawns it
- Example: `agents/gsd-debugger.md` for issue diagnosis

**New Reference Doc:**
- Location: `get-shit-done/references/{topic}.md`
- Usage: Reference via `@~/.claude/get-shit-done/references/{topic}.md` in agents/commands
- Content: Best practices, patterns, question frameworks (no code execution)
- Example: `references/tdd.md` for test-driven development patterns

**New Template:**
- Location: `get-shit-done/templates/{type}.md`
- Usage: Copied to `.planning/` during project initialization
- Content: Markdown with `[PLACEHOLDER]` sections
- Example: `templates/milestone.md` for milestone definitions

**Codebase Analysis Template:**
- Location: `get-shit-done/templates/codebase/{analysis-type}.md`
- Usage: Written to `.planning/codebase/` by `gsd-codebase-mapper`
- Types: `architecture.md`, `structure.md`, `conventions.md`, `testing.md`, `stack.md`, `integrations.md`, `concerns.md`
- Pattern: Analysis-driven, prescriptive guidance (not descriptive lists)

**New Workflow:**
- Location: `get-shit-done/workflows/{process}.md`
- Structure: Step-by-step orchestration guide
- Usage: Referenced by orchestrator commands
- Example: `workflows/execute-phase.md` guides execute-phase orchestrator

## Special Directories

**`.planning/`:**
- Purpose: Project state and planning artifacts (created per user project)
- Generated: Yes (via `/gsd:new-project`)
- Committed: Yes (default behavior, configurable via `commit_docs` in config.json)
- Contains: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json, phase artifacts
- Auto-created subdirectories: `research/`, `codebase/`, `quick/`

**`.planning/codebase/`:**
- Purpose: Existing codebase analysis (created via `/gsd:map-codebase`)
- Generated: Yes (by gsd-codebase-mapper agent)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

**`.planning/research/`:**
- Purpose: Domain research findings (created via `/gsd:new-project` or `/gsd:plan-phase`)
- Generated: Yes (by research agents)
- Committed: Yes
- Contains: Research reports per domain area (stack, features, architecture, pitfalls)

**`.planning/quick/`:**
- Purpose: Ad-hoc task tracking (created via `/gsd:quick`)
- Generated: Yes (by execute-phase orchestrator in quick mode)
- Committed: Yes
- Contains: `001-{slug}/PLAN.md`, `SUMMARY.md` for quick tasks

**`hooks/dist/`:**
- Purpose: Compiled hook files for distribution
- Generated: Yes (via `npm run build:hooks`)
- Committed: No (generated files, not source)
- Built from: `hooks/gsd-*.js` and `hooks/src/` TypeScript files

**`agents/` & `commands/gsd/`:**
- Purpose: Source code for GSD system
- Generated: No (checked in)
- Committed: Yes (part of distribution)
- Modified: Only when adding new commands or agents

---

*Structure analysis: 2026-02-05*
