# Phase 3: State Management - Research

**Researched:** 2026-02-05
**Domain:** File-based project state management (`.planning/` directory structure)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Mirror upstream GSD (glittercowboy/get-shit-done) `.planning/` structure exactly
- Same directory layout, same file names, same sections, same formats
- Only adapt where Cline's architecture fundamentally requires it (e.g., agent spawning model, command format)
- Projects should be portable between upstream GSD (Claude Code) and Cline-GSD
- Validation, defaults, file handling -- match whatever upstream does
- Track upstream changes manually (no automated sync mechanism)
- Just implement the Cline version -- no need to document upstream differences inline

### Claude's Discretion
- Which specific parts of upstream need Cline adaptation (discover during research)
- Internal module architecture for state read/write operations
- Error handling and edge cases in file operations

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase creates the modules that initialize, read, and update the `.planning/` directory structure -- the backbone of project state persistence across sessions. Research focused on the upstream GSD repository (glittercowboy/get-shit-done) to document the exact file formats, directory layout, lifecycle operations, and templates that must be mirrored.

The upstream `.planning/` structure is a well-defined file-based state system consisting of: a root directory with core files (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json), per-phase subdirectories under `phases/`, optional subdirectories for codebase mapping, research, todos, and debug sessions. Every workflow in upstream GSD reads STATE.md first and updates it after significant actions. ROADMAP.md is the source of truth for phase structure, and PLAN.md files within phase directories define atomic task breakdowns.

For Cline adaptation, the only changes needed are command name formats (upstream uses `/gsd:name`, Cline uses `/gsd-name`) within workflow references in templates, and agent spawning patterns (upstream uses `Task` tool, Cline uses `cline -y "prompt" &`). The file structures, section headings, progress calculations, and all other formatting remain identical.

**Primary recommendation:** Build three focused modules -- `state-init.js` (directory/file creation from templates), `state-read.js` (parse STATE.md, ROADMAP.md, PLAN.md into structured data), and `state-write.js` (update STATE.md, ROADMAP.md progress, PLAN.md status) -- all using Node.js built-in `fs/promises` with the same error-return pattern established in Phase 2.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:fs/promises | Node 20+ built-in | All file read/write operations | Zero deps, async, already used in project |
| node:path | Node 20+ built-in | Cross-platform path handling | Already used in platform.js, installer.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| picocolors | ^1.1.1 | Terminal output coloring | Already a dependency, used in output.js |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw fs operations | gray-matter (YAML frontmatter parsing) | gray-matter adds a dependency; frontmatter parsing is simple enough to hand-roll with regex since PLAN.md frontmatter is well-structured YAML |
| String templates | Template engine (handlebars, etc.) | Overkill -- templates are simple string interpolation with known placeholders |

**Installation:**
```bash
# No new dependencies needed -- uses existing node builtins and picocolors
```

## Architecture Patterns

### Recommended Module Structure
```
src/
  state-init.js      # Create .planning/ directory tree and template files
  state-read.js      # Parse state files into structured objects
  state-write.js     # Update state files (STATE.md, ROADMAP.md progress)
  output.js          # (existing) Terminal output helpers
  platform.js        # (existing) Platform detection
```

### Upstream `.planning/` Directory Structure (MUST MATCH)

```
.planning/
  PROJECT.md          # Project context, core value, requirements, decisions
  REQUIREMENTS.md     # Checkable requirements with traceability
  ROADMAP.md          # Phase structure, success criteria, progress table
  STATE.md            # Living memory -- position, metrics, decisions, continuity
  config.json         # Workflow preferences and settings
  codebase/           # (created by map-codebase, not this phase)
    ARCHITECTURE.md
    STACK.md
    STRUCTURE.md
    CONVENTIONS.md
    CONCERNS.md
    INTEGRATIONS.md
    TESTING.md
  research/           # (created by new-project research, not this phase)
    FEATURES.md
    STACK.md
    ARCHITECTURE.md
    PITFALLS.md
    SUMMARY.md
  phases/
    XX-name/          # Zero-padded phase number + kebab-case name
      XX-CONTEXT.md          # Phase context from discuss-phase
      XX-RESEARCH.md         # Phase research from research-phase
      XX-NN-PLAN.md          # Execution plan (NN = plan number)
      XX-NN-SUMMARY.md       # Post-execution summary
      XX-VERIFICATION.md     # Phase verification report
      XX-USER-SETUP.md       # Human-required setup (if needed)
      .continue-here.md      # Session handoff (temporary)
      DISCOVERY.md           # Library/option discovery (if needed)
  todos/              # (created by add-todo, not this phase)
    pending/
      YYYY-MM-DD-slug.md
    done/
      YYYY-MM-DD-slug.md
  debug/              # (created by debug command, not this phase)
    *.md
  MILESTONES.md       # (created after v1.0 ships)
```

**Key naming conventions:**
- Phase directories: `{zero-padded-phase}-{kebab-case-name}` (e.g., `03-state-management`)
- Plan files: `{phase}-{plan}-PLAN.md` (e.g., `03-02-PLAN.md`)
- Summary files: `{phase}-{plan}-SUMMARY.md` (e.g., `03-02-SUMMARY.md`)
- Context files: `{phase}-CONTEXT.md` (e.g., `03-CONTEXT.md`)
- Research files: `{phase}-RESEARCH.md` (e.g., `03-RESEARCH.md`)
- Verification files: `{phase}-VERIFICATION.md`

### Pattern 1: Error Return (Not Throw)
**What:** Functions return `{ success, data, error }` instead of throwing exceptions.
**When to use:** All file operations (established decision from Phase 2: 02-02).
**Example:**
```javascript
// Source: Established project pattern from agent-collect.js
export async function readState(planningDir) {
  try {
    const content = await readFile(
      path.join(planningDir, 'STATE.md'),
      'utf-8'
    );
    const parsed = parseStateMd(content);
    return { success: true, data: parsed, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}
```

### Pattern 2: Template-Based Initialization
**What:** Initialize files from template strings with placeholder substitution.
**When to use:** Creating STATE.md, ROADMAP.md, config.json for the first time.
**Example:**
```javascript
// Source: Upstream template patterns
function renderStateTemplate({ projectName, coreValue, totalPhases, currentPhase }) {
  return `# Project State

## Project Reference

See: .planning/PROJECT.md (updated ${new Date().toISOString().split('T')[0]})

**Core value:** ${coreValue}
**Current focus:** Phase 1 - ${currentPhase}

## Current Position

Phase: 1 of ${totalPhases} (${currentPhase})
Plan: 0 of 0 in current phase
Status: Ready to plan
Last activity: ${new Date().toISOString().split('T')[0]} -- Project initialized

Progress: [${'\u2591'.repeat(10)}] 0%
...`;
}
```

### Pattern 3: Progress Bar Calculation
**What:** Progress = (completed plans) / (total plans across all phases) * 100%.
**When to use:** Updating STATE.md after plan completion or phase transition.
**Example:**
```javascript
// Source: Upstream STATE.md template documentation
function renderProgressBar(completedPlans, totalPlans) {
  const pct = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  return `[${bar}] ${pct}%`;
}
```

### Pattern 4: Markdown Section Parsing
**What:** Parse markdown files by heading level to extract/update specific sections.
**When to use:** Reading specific sections from STATE.md, ROADMAP.md, or updating them in place.
**Example:**
```javascript
// Parse markdown sections by heading level
function parseSections(content, level = 2) {
  const prefix = '#'.repeat(level) + ' ';
  const sections = {};
  let currentKey = null;
  let currentLines = [];

  for (const line of content.split('\n')) {
    if (line.startsWith(prefix)) {
      if (currentKey) {
        sections[currentKey] = currentLines.join('\n').trim();
      }
      currentKey = line.slice(prefix.length).trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentKey) {
    sections[currentKey] = currentLines.join('\n').trim();
  }
  return sections;
}
```

### Pattern 5: YAML Frontmatter Extraction
**What:** Extract YAML frontmatter from PLAN.md files (between `---` delimiters).
**When to use:** Reading plan metadata (wave, depends_on, files_modified, must_haves).
**Example:**
```javascript
// Simple YAML frontmatter extraction (no dependency needed)
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  // Parse simple YAML key-value pairs
  const yaml = {};
  const lines = match[1].split('\n');
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w_-]*):\s*(.*)/);
    if (kvMatch) {
      if (currentArray && currentKey) {
        yaml[currentKey] = currentArray;
        currentArray = null;
      }
      const [, key, value] = kvMatch;
      currentKey = key;
      if (value === '' || value === '[]') {
        yaml[key] = value === '[]' ? [] : '';
      } else if (value === 'true' || value === 'false') {
        yaml[key] = value === 'true';
      } else {
        yaml[key] = value.replace(/^["']|["']$/g, '');
      }
    } else if (line.match(/^\s+-\s/)) {
      if (!currentArray) currentArray = [];
      currentArray.push(line.replace(/^\s+-\s/, '').trim());
    }
  }
  if (currentArray && currentKey) {
    yaml[currentKey] = currentArray;
  }
  return yaml;
}
```

### Anti-Patterns to Avoid
- **Do NOT use a database or JSON store for state:** Upstream uses markdown files deliberately -- they are human-readable, git-diffable, and consumable by Claude workflows
- **Do NOT build a custom YAML parser:** Keep it simple; PLAN.md frontmatter has limited YAML (no nested objects beyond must_haves). For must_haves specifically, use the raw text and pass it to workflows
- **Do NOT abstract file paths into a config:** Use the exact path conventions from upstream (`.planning/phases/XX-name/`)
- **Do NOT add validation libraries:** Simple regex and string checks are sufficient

## Cline-Specific Adaptations Needed

After thorough comparison of upstream GSD and this Cline port, the following are the ONLY areas requiring adaptation:

### 1. Command Name Format in Templates
| Upstream (Claude Code) | Cline-GSD |
|------------------------|-----------|
| `/gsd:new-project` | `/gsd-new-project` |
| `/gsd:plan-phase N` | `/gsd-plan-phase N` |
| `/gsd:execute-phase N` | `/gsd-execute-phase N` |
| `/gsd:progress` | `/gsd-progress` |
| `/gsd:discuss-phase N` | `/gsd-discuss-phase N` |

**Where this matters:** STATE.md session continuity section, ROADMAP.md "next steps" comments, and any template text that references commands.

### 2. Execution Context References
| Upstream | Cline-GSD |
|----------|-----------|
| `@~/.claude/get-shit-done/...` | Cline workflow references use different path |

**Where this matters:** PLAN.md `<execution_context>` section template. The module should produce the Cline-equivalent paths.

### 3. Config.json Structure
The upstream config.json has more options than needed for initial Cline implementation. The existing project config.json already matches the needed subset. No changes needed -- the config.json format is already compatible.

### 4. No Structural Changes
The directory layout, file names, section headings, progress calculation, frontmatter format, and all other structural elements remain **identical** to upstream. This maximizes portability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing (complex) | Full YAML parser | Simple regex extraction for known fields | PLAN.md frontmatter is well-structured; full YAML parsing (nested objects, multiline strings) adds complexity without benefit for our use case |
| Progress bar rendering | Custom progress visualization | The exact format from upstream (`[###.......] NN%`) | Must match upstream exactly for portability |
| Date formatting | Custom date utilities | `new Date().toISOString().split('T')[0]` | Simple YYYY-MM-DD is all that's needed |
| File existence checks | Custom existence utilities | `fs.access()` with try/catch (already used in agent-collect.js) | Established project pattern |

**Key insight:** This phase is primarily about string templates and file I/O -- not complex data structures. The files are markdown designed to be readable by humans and Claude alike. Keep the implementation simple: read strings, parse with regex, write strings.

## Common Pitfalls

### Pitfall 1: STATE.md Growing Beyond 100 Lines
**What goes wrong:** Accumulated decisions, blockers, and todos accumulate over sessions and STATE.md becomes too long to be a "quick glance" file.
**Why it happens:** Every write appends context without trimming old content.
**How to avoid:** Upstream enforces a <100 line constraint. When updating decisions section, keep only 3-5 most recent. Full decision log lives in PROJECT.md Key Decisions table.
**Warning signs:** STATE.md exceeding 100 lines during update operations.

### Pitfall 2: Progress Bar Counting Phases Instead of Plans
**What goes wrong:** Progress shows 2/8 (25%) based on phases completed, when actual plan completion is 5/20 (25%).
**Why it happens:** Using phase count instead of plan count for progress calculation.
**How to avoid:** Progress = completed plans / total plans across ALL phases. Parse ROADMAP.md progress table to count plan completion (e.g., "3/3", "2/2", "0/3").
**Warning signs:** Progress not updating within a phase (only jumps between phases).

### Pitfall 3: Phase Directory Naming Mismatch
**What goes wrong:** Phase directory created as `3-state-management` instead of `03-state-management`.
**Why it happens:** Forgetting to zero-pad phase numbers.
**How to avoid:** Always use `printf "%02d"` or equivalent to zero-pad phase numbers. Support both padded and unpadded when reading (for resilience).
**Warning signs:** `ls .planning/phases/` showing inconsistent naming.

### Pitfall 4: Overwriting STATE.md Instead of Updating
**What goes wrong:** A write operation replaces STATE.md entirely, losing accumulated context.
**Why it happens:** Using `writeFile` instead of section-based update.
**How to avoid:** Read STATE.md first, parse into sections, update only the relevant section, write back the full file. Never blindly overwrite.
**Warning signs:** Accumulated decisions disappearing after updates.

### Pitfall 5: ROADMAP Plan Count Out of Sync
**What goes wrong:** ROADMAP.md progress table shows "0/3" for a phase but the phase directory has 4 PLAN.md files.
**Why it happens:** Plans were added after roadmap creation without updating the progress table.
**How to avoid:** When updating progress, count actual PLAN.md files in the phase directory rather than trusting the denominator in the progress table. Update both numerator and denominator.
**Warning signs:** Sum of plan counts in ROADMAP.md not matching actual file counts.

### Pitfall 6: Frontmatter Parsing Breaking on must_haves
**What goes wrong:** Simple regex-based YAML parsing fails on the nested `must_haves` structure in PLAN.md.
**Why it happens:** must_haves contains nested objects with arrays (truths, artifacts with sub-fields, key_links with sub-fields).
**How to avoid:** For PLAN.md reading, extract frontmatter as raw text and pass simple top-level fields (wave, depends_on, autonomous) via regex. Pass must_haves as raw YAML text to verification workflows. Do NOT try to fully parse must_haves into JS objects unless absolutely necessary.
**Warning signs:** Parsing errors on PLAN.md files with complex must_haves.

## Code Examples

### STATE.md Template (Exact Upstream Format)
```javascript
// Source: https://github.com/glittercowboy/get-shit-done/blob/main/get-shit-done/templates/state.md
const STATE_TEMPLATE = `# Project State

## Project Reference

See: .planning/PROJECT.md (updated {{date}})

**Core value:** {{coreValue}}
**Current focus:** {{currentFocus}}

## Current Position

Phase: {{phaseNum}} of {{totalPhases}} ({{phaseName}})
Plan: {{planNum}} of {{totalPlans}} in current phase
Status: {{status}}
Last activity: {{date}} -- {{lastActivity}}

Progress: [{{progressBar}}] {{progressPct}}%

## Performance Metrics

**Velocity:**
- Total plans completed: {{completedPlans}}
- Average duration: {{avgDuration}} min
- Total execution time: {{totalTime}} min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
{{phaseMetrics}}

**Recent Trend:**
- Last 5 plans: {{recentDurations}}
- Trend: {{trend}}

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

{{recentDecisions}}

### Pending Todos

{{pendingTodos}}

### Blockers/Concerns

{{blockers}}

## Session Continuity

Last session: {{lastSession}}
Stopped at: {{stoppedAt}}
Resume file: {{resumeFile}}
`;
```

### config.json Template (Upstream Format)
```javascript
// Source: https://github.com/glittercowboy/get-shit-done/blob/main/get-shit-done/templates/config.json
const CONFIG_TEMPLATE = {
  mode: "interactive",
  depth: "standard",
  workflow: {
    research: true,
    plan_check: true,
    verifier: true
  },
  planning: {
    commit_docs: true,
    search_gitignored: false
  },
  parallelization: {
    enabled: true,
    plan_level: true,
    task_level: false,
    skip_checkpoints: true,
    max_concurrent_agents: 3,
    min_plans_for_parallel: 2
  },
  gates: {
    confirm_project: true,
    confirm_phases: true,
    confirm_roadmap: true,
    confirm_breakdown: true,
    confirm_plan: true,
    execute_next_plan: true,
    issues_review: true,
    confirm_transition: true
  },
  safety: {
    always_confirm_destructive: true,
    always_confirm_external_services: true
  }
};
```

### Directory Initialization
```javascript
// Source: Derived from upstream new-project.md and plan-phase.md workflows
import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

async function ensurePlanningDir(projectRoot) {
  const planningDir = path.join(projectRoot, '.planning');
  const dirs = [
    planningDir,
    path.join(planningDir, 'phases'),
    // Note: codebase/, research/, todos/, debug/ are created
    // by their respective commands, not during init
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  return planningDir;
}

async function ensurePhaseDir(planningDir, phaseNum, phaseName) {
  const paddedPhase = String(phaseNum).padStart(2, '0');
  const slug = phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dirName = `${paddedPhase}-${slug}`;
  const phaseDir = path.join(planningDir, 'phases', dirName);
  await mkdir(phaseDir, { recursive: true });
  return phaseDir;
}
```

### Reading ROADMAP.md Progress
```javascript
// Source: Derived from upstream execute-phase.md and progress.md patterns
function parseRoadmapProgress(roadmapContent) {
  const phases = [];
  // Parse progress table: | 1. Name | 3/3 | Complete | 2026-02-05 |
  const tableRegex = /\|\s*(\d+)\.\s*(.+?)\s*\|\s*(\d+)\/(\d+)\s*\|\s*(\w[\w\s]*?)\s*\|\s*(.*?)\s*\|/g;
  let match;
  while ((match = tableRegex.exec(roadmapContent)) !== null) {
    phases.push({
      number: parseInt(match[1]),
      name: match[2].trim(),
      completedPlans: parseInt(match[3]),
      totalPlans: parseInt(match[4]),
      status: match[5].trim(),
      completedDate: match[6].trim() === '-' ? null : match[6].trim()
    });
  }

  const totalPlans = phases.reduce((sum, p) => sum + p.totalPlans, 0);
  const completedPlans = phases.reduce((sum, p) => sum + p.completedPlans, 0);

  return { phases, totalPlans, completedPlans };
}
```

### Updating STATE.md Section
```javascript
// Source: Derived from upstream execute-phase.md state update pattern
function updateStateSection(stateContent, sectionName, newContent) {
  // Find the section by ## heading
  const sectionRegex = new RegExp(
    `(## ${sectionName}\\n)([\\s\\S]*?)(?=\\n## |$)`,
    'g'
  );

  if (sectionRegex.test(stateContent)) {
    return stateContent.replace(sectionRegex, `$1\n${newContent}\n`);
  }

  // Section not found, append before last section
  return stateContent + `\n## ${sectionName}\n\n${newContent}\n`;
}
```

### PLAN.md Frontmatter Fields (Top-Level Only)
```javascript
// Source: Upstream phase-prompt.md template
// Only parse top-level scalar/array fields; leave must_haves as raw text
function parsePlanFrontmatter(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const raw = fmMatch[1];
  const result = {
    phase: null,
    plan: null,
    type: 'execute',
    wave: 1,
    depends_on: [],
    files_modified: [],
    autonomous: true
  };

  // Simple scalar extraction
  const scalarMatch = (key) => {
    const m = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : null;
  };

  result.phase = scalarMatch('phase');
  result.plan = scalarMatch('plan');
  result.type = scalarMatch('type') || 'execute';

  const waveStr = scalarMatch('wave');
  if (waveStr) result.wave = parseInt(waveStr);

  const autoStr = scalarMatch('autonomous');
  if (autoStr) result.autonomous = autoStr === 'true';

  // Array extraction (simple - items on subsequent lines)
  const arrayMatch = (key) => {
    const m = raw.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, 'm'));
    if (m) {
      const inner = m[1].trim();
      if (!inner) return [];
      return inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }
    // Multi-line array
    const items = [];
    const lines = raw.split('\n');
    let collecting = false;
    for (const line of lines) {
      if (line.match(new RegExp(`^${key}:`))) {
        collecting = true;
        continue;
      }
      if (collecting) {
        if (line.match(/^\s+-\s/)) {
          items.push(line.replace(/^\s+-\s/, '').trim().replace(/^["']|["']$/g, ''));
        } else if (!line.match(/^\s/)) {
          break;
        }
      }
    }
    return items;
  };

  result.depends_on = arrayMatch('depends_on');
  result.files_modified = arrayMatch('files_modified');

  return result;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic state file | Split into STATE.md (memory) + PROJECT.md (context) + ROADMAP.md (structure) | Upstream GSD current design | Each file has clear purpose and size constraint |
| Phase numbering without padding | Zero-padded phase numbers (01, 02, ...) | Current upstream | Consistent directory sorting |
| Time estimates in roadmap | No time estimates | Current upstream | Avoids enterprise PM overhead |
| Requirements in PROJECT.md | Separate REQUIREMENTS.md with traceability | Current upstream | Enables phase-requirement mapping |

**Key upstream patterns that are current and stable:**
- STATE.md under 100 lines (digest, not archive)
- Progress = completed plans / total plans (not phases)
- config.json has `planning.commit_docs` controlling git operations
- PLAN.md frontmatter includes `wave` for pre-computed execution order
- Phase directories use `XX-kebab-name` format
- SUMMARY.md frontmatter tracks dependency graph (requires/provides/affects)

## Open Questions

1. **must_haves Parsing Depth**
   - What we know: must_haves in PLAN.md frontmatter has nested YAML (truths array, artifacts array of objects, key_links array of objects)
   - What's unclear: How deeply should the state-read module parse this? The verification workflow needs the full structure, but state management modules may only need to know if must_haves exists.
   - Recommendation: Parse only top-level presence check. Pass raw YAML text to downstream consumers (verification agent). This avoids building a complex YAML parser.

2. **Todos/Debug Directory Creation**
   - What we know: Upstream creates `.planning/todos/pending/`, `.planning/todos/done/`, and `.planning/debug/` directories on demand (when add-todo or debug commands run).
   - What's unclear: Should state-init create these empty directories proactively?
   - Recommendation: Do NOT create them in init. Match upstream behavior where they are created by their respective commands. Only create `.planning/`, `.planning/phases/`, and the core files.

3. **config.json Versioning**
   - What we know: Upstream config.json has evolved to include git branching options and other fields not in all project configs.
   - What's unclear: Whether to include all upstream fields or just the subset relevant to current Cline-GSD implementation.
   - Recommendation: Include the full upstream config template structure. Missing fields default to upstream defaults at read time. This ensures forward compatibility.

## Sources

### Primary (HIGH confidence)
- **Upstream GSD repository** (glittercowboy/get-shit-done) -- accessed via GitHub API
  - `get-shit-done/templates/state.md` -- STATE.md template with full lifecycle documentation
  - `get-shit-done/templates/roadmap.md` -- ROADMAP.md template with phase structure
  - `get-shit-done/templates/phase-prompt.md` -- PLAN.md template with frontmatter schema
  - `get-shit-done/templates/config.json` -- Configuration defaults
  - `get-shit-done/templates/context.md` -- CONTEXT.md template
  - `get-shit-done/templates/summary.md` -- SUMMARY.md template
  - `get-shit-done/templates/project.md` -- PROJECT.md template
  - `get-shit-done/templates/requirements.md` -- REQUIREMENTS.md template
  - `commands/gsd/new-project.md` -- Directory creation and initialization flow
  - `commands/gsd/progress.md` -- State reading and progress calculation
  - `commands/gsd/execute-phase.md` -- State update after execution
  - `commands/gsd/plan-phase.md` -- Phase directory creation
  - `commands/gsd/pause-work.md` -- continue-here file creation
  - `commands/gsd/add-todo.md` -- Todo directory structure
  - `agents/gsd-roadmapper.md` -- STATE.md and ROADMAP.md initialization
  - `get-shit-done/references/planning-config.md` -- Config options documentation
  - `get-shit-done/workflows/execute-phase.md` -- Wave execution and state updates

### Secondary (MEDIUM confidence)
- **Existing project codebase** -- established patterns in src/agent-collect.js, src/installer.js, src/output.js

### Tertiary (LOW confidence)
- None -- all findings verified against upstream repository source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- uses Node.js built-ins already in the project
- Architecture: HIGH -- directly derived from upstream GSD source code
- Directory structure: HIGH -- exact upstream layout documented from templates and commands
- File formats: HIGH -- exact templates copied from upstream repo
- Cline adaptations: HIGH -- identified through systematic comparison of upstream patterns
- Pitfalls: MEDIUM -- derived from understanding of the system, not from reported issues

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (stable -- upstream changes tracked manually)
