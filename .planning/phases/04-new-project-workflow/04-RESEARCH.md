# Phase 4: New Project Workflow - Research

**Researched:** 2026-02-05
**Domain:** Cline workflow authoring, project initialization methodology, interactive questioning
**Confidence:** HIGH

## Summary

Phase 4 implements two Cline workflows (`gsd-new-project.md` and `gsd-progress.md`) and the supporting Node.js module (`src/project-init.js`) that generates populated project files. The upstream GSD project has a well-established 10-phase `new-project` flow that guides users through deep questioning, optional research, requirements definition, and roadmap creation. This phase adapts that pattern for Cline's workflow system.

The key architectural insight is that Cline workflows are **prompt injection** -- when a user types `/gsd-new-project.md`, Cline reads the markdown file and injects it as `<explicit_instructions>` at the top of the message. The workflow file itself contains all the instructions the AI needs to orchestrate the conversation. No Node.js orchestration code runs during the workflow -- the AI follows the markdown instructions to call tools (Read, Write, Bash) and interact with the user. The Node.js module (`src/project-init.js`) provides **helper functions** that the workflow can invoke via Bash to generate files programmatically, but the workflow itself is pure markdown.

**Primary recommendation:** Create two workflow markdown files that mirror upstream GSD patterns adapted for Cline, plus a thin Node.js helper module that the workflow invokes via `node -e` or a dedicated CLI command for file generation. The questioning methodology should be conversational (not checklist-based), and the progress command should read existing state files and route to the appropriate next action.

## Standard Stack

### Core (no new libraries needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins | >=20.0.0 | File I/O for helpers | Already established in Phase 1 |
| Existing state modules | src/*.js | Read/write state files | Built in Phase 3 |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| picocolors | ^1.1.1 | Terminal output colors | Only if CLI helper prints status |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Markdown workflow | Node.js script | Workflows are Cline's native mechanism; scripts would require separate invocation |
| Node.js file generator | Pure AI file writing | Node.js helpers ensure consistent templates and reduce AI token usage |
| Single mega-workflow | Modular workflows | Single workflow avoids context fragmentation; upstream GSD uses single flow |

**Installation:** No new packages needed. This phase uses existing modules and creates new workflow markdown files.

## Architecture Patterns

### Recommended File Structure
```
workflows/gsd/
  gsd-new-project.md        # /gsd-new-project.md workflow (questioning + file gen)
  gsd-progress.md           # /gsd-progress.md workflow (status + routing)
  gsd-health.md             # (existing)
  gsd-spawn-agents.md       # (existing)
  gsd-collect-outputs.md    # (existing)

src/
  project-init.js           # NEW: Helper functions for PROJECT.md, config.json generation
  state-init.js             # (existing) - already has templates, may need enrichment
  state-read.js             # (existing) - already reads STATE.md, ROADMAP.md
  state-write.js            # (existing) - already writes STATE.md, ROADMAP.md
```

### Pattern 1: Cline Workflow File Format
**What:** Markdown files in `~/Documents/Cline/Workflows/` that inject instructions when triggered via `/filename.md`
**When to use:** Every GSD command that needs to run as a Cline slash command
**Critical detail:** The workflow `fileName` (including `.md`) must match exactly what the user types after `/`. So the file `gsd-new-project.md` is triggered by `/gsd-new-project.md`.

```markdown
---
description: Brief description shown in command palette
---

# /gsd-new-project.md - Initialize a New GSD Project

## Objective
[What this workflow does]

## Process
[Step-by-step instructions the AI follows]

## Output
[What files are created]
```

**Source:** Verified from Cline source code at `src/core/slash-commands/index.ts` lines 188-250. The matching logic is:
```typescript
// fileName includes .md extension
fileName: filePath.replace(/^.*[/\\]/, "")
// commandName from user input also includes .md (regex allows dots)
const matchingWorkflow = enabledWorkflows.find(
  (workflow) => workflow.fileName === commandName
)
```

### Pattern 2: Conversational Questioning (Upstream GSD Pattern)
**What:** Multi-round conversational exploration of what the user wants to build
**When to use:** Phase 3 of the new-project flow
**Key principles from upstream GSD:**
- "You are a thinking partner, not an interviewer"
- "Follow energy. Whatever they emphasized, dig into that"
- "Challenge vagueness. Never accept fuzzy answers"
- "Know when to stop. When you understand what they want, why they want it, who it's for, and what done looks like -- offer to proceed"

The questioning is NOT a checklist. It's a natural conversation that:
1. Starts with "What do you want to build?" and follows the user's energy
2. Asks follow-up questions that probe what they mentioned
3. Challenges vagueness with concrete alternatives
4. Surfaces hidden assumptions
5. Knows when enough context has been gathered (typically 3-6 exchanges)

### Pattern 3: Atomic Commits per Artifact
**What:** Git commit after each major file creation during the flow
**When to use:** After creating PROJECT.md, config.json, REQUIREMENTS.md, ROADMAP.md, STATE.md
**Why:** Prevents context loss if the session breaks mid-flow. Upstream GSD explicitly commits after each phase.

```markdown
## Step: Commit artifacts
After creating each file, run:
```bash
cd [project-root] && git add .planning/[filename] && git commit -m "docs: create [filename] via /gsd-new-project"
```

### Pattern 4: Progress Command with Smart Routing
**What:** Read state files and suggest the next appropriate action
**When to use:** `/gsd-progress.md` command

The upstream `progress.md` command follows this routing logic:
1. Check if `.planning/` exists (if not, suggest `/gsd-new-project.md`)
2. Load STATE.md, ROADMAP.md, PROJECT.md, config.json
3. Parse current position (phase, plan, status)
4. Determine next action:
   - If unexecuted plans exist -> suggest `/gsd-execute-phase N`
   - If phase needs planning -> suggest `/gsd-plan-phase N`
   - If phase complete -> suggest next phase
   - If all phases complete -> suggest milestone completion

### Anti-Patterns to Avoid
- **Checklist questioning:** Never ask a rapid-fire list of questions. Each question should follow from the previous answer.
- **Over-engineering the Node.js helper:** The workflow markdown does most of the work. The helper just generates template files with the correct structure.
- **Skipping brownfield detection:** Always check if code already exists in the project directory before starting questioning.
- **Generating ROADMAP.md during new-project:** Upstream GSD creates the roadmap as part of new-project flow, but the actual phase structure comes from requirements analysis. The workflow should guide this, not hardcode it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| STATE.md template | New template string | `state-init.js:stateTemplate()` | Already exists with correct upstream format |
| Config defaults | Custom config builder | `state-init.js:configTemplate()` + `state-read.js:readPlanningConfig()` | Already handles defaults merging |
| Progress bar rendering | String formatting | `state-init.js:renderProgressBar()` | Already exists |
| Section parsing | Custom markdown parser | `state-read.js:parseSections()` | Already handles ## level splitting |
| Position tracking | Custom state tracker | `state-read.js:parseStatePosition()` | Already parses Phase/Plan/Status lines |
| Roadmap progress | Custom progress parser | `state-read.js:parseRoadmapProgress()` | Already parses progress table rows |
| State updates | Direct file writes | `state-write.js:updateStatePosition()` | Already handles read-modify-write safely |
| Plan checkbox toggling | Manual regex | `state-write.js:updatePlanCheckbox()` | Already handles both [x] and [ ] |

**Key insight:** Phase 3 built all the state read/write infrastructure. Phase 4 should consume those modules, not rebuild them. The workflow markdown instructs the AI to use these modules via Bash/Node.js invocations when generating files.

## Common Pitfalls

### Pitfall 1: Workflow File Not Triggering
**What goes wrong:** User types `/gsd-new-project` and nothing happens
**Why it happens:** Cline matches the **full filename including .md extension**. The user must type `/gsd-new-project.md`.
**How to avoid:** Document clearly that the command is `/gsd-new-project.md`. Alternatively, investigate if Cline strips .md -- but per source code analysis, the match is exact filename.
**Warning signs:** User reports "command not found" or workflow not loading

### Pitfall 2: Workflow Not Enabled in Cline
**What goes wrong:** File exists in Workflows/ but command doesn't appear
**Why it happens:** Cline has toggle switches for workflows. New files need to be enabled.
**How to avoid:** The installer already copies files to `~/Documents/Cline/Workflows/`. Cline auto-discovers new files and enables them by default (based on `synchronizeRuleToggles` behavior).
**Warning signs:** Workflow file exists but isn't in the slash command list

### Pitfall 3: Questioning Too Shallow or Too Deep
**What goes wrong:** Either the AI asks 1 question and moves on, or asks 20 questions and user gets frustrated
**Why it happens:** No clear "sufficiency criteria" in the workflow instructions
**How to avoid:** Include explicit criteria in the workflow: "You have enough context when you know: (1) what the user is building, (2) why it matters, (3) who it's for, (4) what 'done' looks like, (5) key constraints. This typically takes 3-6 exchanges."
**Warning signs:** PROJECT.md has empty sections, or user abandons flow mid-questioning

### Pitfall 4: Losing Context Mid-Flow
**What goes wrong:** User closes Cline or session crashes after questioning but before file creation
**Why it happens:** All context is in the chat, nothing persisted to disk yet
**How to avoid:** Commit artifacts incrementally. After questioning, immediately write PROJECT.md and commit. Don't wait until the entire flow completes.
**Warning signs:** User has to re-answer all questions after reopening Cline

### Pitfall 5: Config Generation Missing Fields
**What goes wrong:** config.json missing fields that later phases expect
**Why it happens:** Workflow generates partial config, doesn't include all upstream GSD fields
**How to avoid:** Use the existing `configTemplate()` from `state-init.js` as the base, then overlay user preferences. The template already includes all upstream fields (mode, depth, workflow, planning, gates, safety).
**Warning signs:** Later phases crash reading config because expected keys are missing

### Pitfall 6: Progress Command Over-Reading Files
**What goes wrong:** `/gsd-progress.md` tries to read files that don't exist yet and fails
**Why it happens:** Assuming all state files exist when they might not
**How to avoid:** Each file read should be conditional. Check existence first, provide helpful guidance when files are missing (e.g., "No project found. Run /gsd-new-project.md to get started.").
**Warning signs:** Error messages about missing files instead of helpful guidance

### Pitfall 7: Hardcoding Project Paths
**What goes wrong:** Workflow assumes project is at a specific path
**Why it happens:** Not respecting Cline's working directory
**How to avoid:** Always use relative paths (`.planning/`) or detect project root from cwd. The workflow runs in whatever directory the user has open in Cline.
**Warning signs:** Files created in wrong location

## Code Examples

### Cline Workflow Skeleton (New Project)
```markdown
---
description: Initialize a new GSD project with deep questioning and structured output
---

# /gsd-new-project.md - Start a New Project

<objective>
Guide the user through project initialization: questioning -> PROJECT.md -> config -> requirements -> roadmap -> STATE.md
</objective>

<process>

<step name="check-existing">
**Check for existing project:**

```bash
test -d .planning && echo "exists" || echo "new"
```

If `.planning/` exists, warn the user and ask if they want to start fresh or use `/gsd-progress.md` instead.
</step>

<step name="init-git">
**Initialize git if needed:**

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || git init
```
</step>

<step name="detect-brownfield">
**Detect existing code:**

Check for common code indicators (package.json, requirements.txt, Cargo.toml, go.mod, etc.)
If found, offer `/gsd-map-codebase.md` before continuing.
</step>

<step name="questioning">
**Deep questioning phase:**

Start with: "What do you want to build?"

Follow the user's energy. Dig into what they emphasize. Challenge vague answers.
Use concrete alternatives to help thinking: "When you say fast, do you mean..."

You have enough context when you know:
1. What they're building (core product/feature)
2. Why it matters (motivation, problem being solved)
3. Who it's for (users, audience)
4. What "done" looks like (success criteria)
5. Key constraints (technical, timeline, budget)

This typically takes 3-6 exchanges. Don't rush, but don't over-question.
</step>

<step name="create-project-md">
**Write PROJECT.md:**

Using all gathered context, create `.planning/PROJECT.md` with sections:
- What This Is (2-3 sentences)
- Core Value (one clear statement)
- Requirements (Validated / Active / Out of Scope)
- Context (why this exists)
- Constraints
- Key Decisions table

Commit immediately after creation.
</step>

<!-- Additional steps for config, requirements, roadmap, state -->

</process>
```

### Cline Workflow Skeleton (Progress)
```markdown
---
description: Check project progress and suggest next action
---

# /gsd-progress.md - Project Progress & Routing

<objective>
Show project status with visual progress, recent work context, and smart routing to the next action.
</objective>

<process>

<step name="verify">
**Check planning structure:**

```bash
test -d .planning && echo "exists" || echo "missing"
```

If missing: "No project found. Run `/gsd-new-project.md` to get started."
</step>

<step name="load">
**Load project context:**

Read these files (skip any that don't exist):
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/PROJECT.md`
- `.planning/config.json`
</step>

<step name="report">
**Present status:**

```
# [Project Name]

**Progress:** [progress bar] X/Y plans complete

## Current Position
Phase N of M: [phase-name]
Status: [status]

## What's Next
[Next action with command suggestion]
```
</step>

<step name="route">
**Smart routing based on state:**

| Condition | Action |
|-----------|--------|
| Unexecuted plans exist | Suggest `/gsd-execute-phase N` |
| Phase needs planning | Suggest `/gsd-plan-phase N` |
| Phase complete | Suggest next phase discussion |
| All phases complete | Suggest completion |
</step>

</process>
```

### Node.js Helper: Populate PROJECT.md
```javascript
// src/project-init.js
import { writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

/**
 * Write a populated PROJECT.md from gathered context.
 * Used by the gsd-new-project workflow after questioning.
 *
 * @param {string} planningDir - Path to .planning/
 * @param {object} project - Gathered project context
 * @param {string} project.name - Project name
 * @param {string} project.description - 2-3 sentence description
 * @param {string} project.coreValue - Core value statement
 * @param {string} project.context - Why this exists
 * @param {string[]} project.constraints - Technical/business constraints
 * @param {string} [project.date] - Date string, defaults to today
 * @returns {Promise<{success: boolean, data?: {path: string}, error?: string}>}
 */
export async function writeProjectMd(planningDir, project) {
  try {
    const date = project.date || new Date().toISOString().split('T')[0];
    const constraintsList = project.constraints
      .map(c => `- ${c}`)
      .join('\n');

    const content = `# ${project.name}

## What This Is

${project.description}

## Core Value

${project.coreValue}

## Requirements

### Validated

(Requirements confirmed during questioning)

### Active

(Requirements being worked on)

### Out of Scope

(Explicitly excluded features)

## Context

${project.context}

## Constraints

${constraintsList}

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|

---
*Last updated: ${date}*
`;

    const filePath = path.join(planningDir, 'PROJECT.md');
    await writeFile(filePath, content, 'utf-8');
    return { success: true, data: { path: filePath } };
  } catch (err) {
    return { success: false, error: `Failed to write PROJECT.md: ${err.message}` };
  }
}

/**
 * Write config.json with user preferences merged onto defaults.
 *
 * @param {string} planningDir - Path to .planning/
 * @param {object} preferences - User-selected preferences
 * @param {string} [preferences.mode] - 'yolo' | 'interactive'
 * @param {string} [preferences.depth] - 'quick' | 'standard' | 'comprehensive'
 * @param {boolean} [preferences.parallelization]
 * @param {boolean} [preferences.commit_docs]
 * @param {string} [preferences.model_profile] - 'quality' | 'balanced' | 'budget'
 * @param {object} [preferences.workflow] - Research, plan_check, verifier toggles
 * @returns {Promise<{success: boolean, data?: {path: string}, error?: string}>}
 */
export async function writeConfigJson(planningDir, preferences = {}) {
  try {
    // Start from full upstream defaults
    const config = {
      mode: 'yolo',
      depth: 'comprehensive',
      workflow: {
        research: true,
        plan_check: true,
        verifier: true,
      },
      planning: {
        max_tasks_per_plan: 8,
        require_verification: true,
        require_tests: false,
      },
      parallelization: true,
      commit_docs: true,
      model_profile: 'quality',
      gates: {
        plan_review: false,
        checkpoint_approval: true,
      },
      safety: {
        backup_before_execute: false,
        dry_run_first: false,
      },
    };

    // Overlay user preferences
    for (const [key, value] of Object.entries(preferences)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        config[key] = { ...config[key], ...value };
      } else {
        config[key] = value;
      }
    }

    const filePath = path.join(planningDir, 'config.json');
    await writeFile(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    return { success: true, data: { path: filePath } };
  } catch (err) {
    return { success: false, error: `Failed to write config.json: ${err.message}` };
  }
}
```

### Workflow Invoking Node.js Helpers via Bash
```markdown
## Step: Generate config.json

Based on the user's preferences, generate config.json:

```bash
node -e "
import { writeConfigJson } from './src/project-init.js';
const result = await writeConfigJson('.planning', {
  mode: 'yolo',
  depth: 'comprehensive',
  parallelization: true,
  commit_docs: true,
  model_profile: 'quality'
});
console.log(JSON.stringify(result));
"
```

Note: The workflow can also write files directly via Cline's write_to_file tool.
The Node.js helper approach ensures consistent templates.
```

## Upstream GSD Flow Mapping

The upstream GSD `/gsd:new-project` has 10 phases. Here's how they map to Cline-GSD:

| Upstream Phase | Cline-GSD Equivalent | Notes |
|---------------|---------------------|-------|
| 1. Setup (check existing, init git) | Same | Direct port |
| 2. Brownfield detection | Same | Check for code files |
| 3. Deep questioning | Same | Core methodology is AI-driven, portable |
| 4. Write PROJECT.md | Same | Use template from state-init.js |
| 5. Workflow preferences | Same | Mode, depth, parallelization, agents |
| 5.5. Resolve model profile | Simplified | Cline uses its own model selection |
| 6. Optional research | Deferred | Phase 6 (Planning Workflow) handles research |
| 7. Define requirements | Same | Generate REQUIREMENTS.md |
| 8. Create roadmap | Same | Generate ROADMAP.md |
| 9.5. Register with memory | Simplified | STATE.md serves as memory |
| 10. Done | Same | Point to `/gsd-discuss-phase 1` equivalent |

**Key simplification:** Upstream GSD Phase 6 (optional research during new-project) can be deferred. The research capability comes online in Phase 6 of the Cline-GSD roadmap. For now, the new-project flow creates the project structure without optional research agents.

## Config Options (Full Upstream Structure)

```json
{
  "mode": "yolo",              // "yolo" (auto-approve) | "interactive"
  "depth": "comprehensive",    // "quick" | "standard" | "comprehensive"
  "workflow": {
    "research": true,          // Enable research agents before planning
    "plan_check": true,        // Enable plan validation
    "verifier": true           // Enable post-execution verification
  },
  "planning": {
    "max_tasks_per_plan": 8,   // Max tasks per PLAN.md
    "require_verification": true,
    "require_tests": false
  },
  "parallelization": true,     // Enable parallel agent spawning
  "commit_docs": true,         // Git commit planning docs
  "model_profile": "quality",  // "quality" | "balanced" | "budget"
  "gates": {
    "plan_review": false,      // Pause for human review before execution
    "checkpoint_approval": true // Pause at phase boundaries
  },
  "safety": {
    "backup_before_execute": false,
    "dry_run_first": false
  }
}
```

**User-facing preferences (asked during questioning):**
1. **Mode:** "Do you want to approve each step, or should I go full speed?" (yolo/interactive)
2. **Depth:** "How thorough should planning be?" (quick/standard/comprehensive)
3. **Parallelization:** "Should I use parallel agents for research?" (true/false)
4. **Commit docs:** "Should planning files be git-tracked?" (true/false)
5. **Workflow agents:** "Enable research before planning? Plan validation? Post-execution verification?" (3 toggles)

Other fields (planning, gates, safety) use sensible defaults and can be changed later via settings.

## Session Resumption Strategy

Cline has no built-in session state across conversations. The strategy is:

1. **All state is in files:** STATE.md, ROADMAP.md, PROJECT.md, config.json
2. **The `/gsd-progress.md` command is the resumption mechanism:** User opens new Cline session, types `/gsd-progress.md`, the AI reads all state files and presents current position with next action
3. **STATE.md `Session Continuity` section** tracks:
   - Last session timestamp
   - What was being worked on when stopped
   - Resume file (if any)
4. **Atomic commits** prevent partial state: each artifact is committed separately so even if the session crashes, whatever was committed is recoverable

This is the same strategy used by upstream GSD -- state lives in files, not in the AI's context window.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic setup script | Workflow-driven conversation | GSD v1.0+ | AI guides the setup interactively |
| Requirements as bullet points | Testable, ID'd requirements (REQ-01) | GSD v1.0+ | Traceability to phases |
| Config as env vars | config.json with nested structure | GSD v1.0+ | Structured, mergeable settings |
| Manual state tracking | STATE.md auto-updated | GSD v1.0+ | Cross-session continuity |

## Open Questions

1. **Exact slash command format with .md**
   - What we know: Cline source code matches `fileName` (including `.md`) against `commandName` from regex that allows dots
   - What's unclear: Whether users actually type `/gsd-new-project.md` or `/gsd-new-project` (the regex allows both patterns but `.md` suffix must match the filename)
   - Recommendation: Name files `gsd-new-project.md` so users type `/gsd-new-project.md`. Test this during development. If `.md` suffix is awkward, consider renaming files without `.md` extension (but this breaks Cline's workflow directory scanning which filters by `.md`).

2. **Workflow length limits**
   - What we know: Workflow content is injected as `<explicit_instructions>` into the message context
   - What's unclear: Is there a practical size limit for workflow files?
   - Recommendation: Keep workflows focused. The new-project workflow will be long (~200 lines) but should work. If it causes context issues, split into phases that chain (but prefer single workflow for simplicity).

3. **Node.js helper invocation from workflow**
   - What we know: Workflows can run Bash commands, and the project modules are available
   - What's unclear: Whether `node -e "import {...}"` works reliably across setups, or if a dedicated CLI entry point is better
   - Recommendation: Create a thin CLI entry point (`bin/project-init.js`) that the workflow invokes. More reliable than inline `node -e`.

## Sources

### Primary (HIGH confidence)
- Cline source code `src/core/slash-commands/index.ts` - Workflow matching logic, verified filename matching
- Cline source code `src/core/storage/disk.ts` - Workflow directory: `~/Documents/Cline/Workflows/`
- Cline source code `src/shared/slashCommands.ts` - Built-in command definitions
- Existing project modules `src/state-init.js`, `src/state-read.js`, `src/state-write.js` - Template and parsing functions
- Existing workflow files `workflows/gsd/*.md` - Established workflow format

### Secondary (MEDIUM confidence)
- [glittercowboy/get-shit-done new-project.md](https://github.com/glittercowboy/get-shit-done/blob/main/commands/gsd/new-project.md) - Upstream new-project flow (10 phases)
- [glittercowboy/get-shit-done progress.md](https://github.com/glittercowboy/get-shit-done/blob/main/commands/gsd/progress.md) - Upstream progress command with routing logic
- [GSD SKILL.md](https://github.com/openclaw/skills/blob/main/skills/glittercowboy/gsd/SKILL.md) - GSD skill definition with command list

### Tertiary (LOW confidence)
- Upstream GSD questioning.md reference - Could not fetch full content, but key principles verified from summaries
- WebSearch for Cline workflow best practices 2026

## Metadata

**Confidence breakdown:**
- Cline workflow format: HIGH - Verified from Cline source code
- Upstream GSD flow: HIGH - Fetched and analyzed new-project.md and progress.md
- Questioning methodology: MEDIUM - Principles verified, full reference file not available
- Node.js helper pattern: HIGH - Follows established Phase 1-3 patterns
- Session resumption: HIGH - STATE.md pattern already implemented and proven

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days - stable domain, no fast-moving dependencies)
