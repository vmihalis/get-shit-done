---
description: Execute plans for a phase with atomic commits per task and SUMMARY generation
---

# /gsd-execute-phase -- Execute a Phase

This workflow executes all plans in a phase sequentially in the main Cline context. For each plan, it reads the PLAN.md, executes each task inline (with Cline performing the actual code changes), commits each task atomically, generates SUMMARY.md, and updates STATE.md and ROADMAP.md. Plans execute in wave order. Completed plans (those with matching SUMMARY.md files) are skipped, enabling safe resumption after interruptions.

## Step 1: Parse phase number and load state

Extract the phase number from the user's input. If not provided, read STATE.md for the current phase or ask the user:

```bash
node -e "
import { readState, readPlanningConfig } from './src/state-read.js';
const state = await readState('.planning');
if (state.success) {
  console.log(state.data.raw);
} else {
  console.log('Could not read STATE.md:', state.error);
}
"
```

If the user did not specify a phase number, show the ROADMAP and ask which phase to execute.

Once the phase number is known, load phase details and config:

```bash
node -e "
import { readPlanningConfig } from './src/state-read.js';
import { getPhaseDetails } from './src/discuss-phase.js';
const config = await readPlanningConfig('.planning');
const phase = await getPhaseDetails('.planning', PHASE_NUM);
console.log(JSON.stringify({ config: config.data, phase: phase.data }, null, 2));
"
```

Replace `PHASE_NUM` with the actual phase number.

Load commit_docs config: `COMMIT_PLANNING_DOCS` from config.json (default true). Also check `git check-ignore -q .planning 2>/dev/null` to auto-detect if gitignored.

Load mode config: `mode` from config.json (`yolo` or `interactive`).

If the phase is not found, stop with error:

> Phase PHASE_NUM not found in ROADMAP.md. Check the phase number and try again.

## Step 2: Discover plans and check progress

```bash
node -e "
import { discoverPlans, groupByWave } from './src/execute-phase.js';
const result = await discoverPlans('PHASE_DIR_PATH');
if (!result.success) { console.error(result.error); process.exit(1); }
const grouped = groupByWave(result.data.incomplete);
console.log(JSON.stringify({
  total: result.data.plans.length,
  completed: result.data.completed.length,
  incomplete: result.data.incomplete.length,
  waves: grouped.data.waveOrder,
  plans: result.data.plans.map(p => ({ id: p.id, wave: p.wave, complete: p.isComplete, autonomous: p.autonomous }))
}, null, 2));
"
```

Replace `PHASE_DIR_PATH` with the absolute path to the phase directory (e.g. `.planning/phases/07-execution-workflow`).

Report discovery results:
- "Found N plans in phase (M completed, K remaining)"
- If all plans complete: "Phase already complete. Nothing to execute." and stop.
- Show wave structure table: Wave | Plans | Autonomous

## Step 3: Present execution plan

Show the user what will happen:

```
## Execution Plan

**Phase {N}: {Name}** -- {K} plans remaining across {W} waves

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1 | 07-01, 07-02 | {from plan objectives} |
| 2 | 07-03 | {from plan objectives} |
```

For each incomplete plan, skim the `<objective>` section to populate "What it builds" (3-8 words).

If any plan has `autonomous: false`, inform the user: "Note: Plan {id} has checkpoints that will require your input."

In yolo mode: auto-continue. In interactive mode: ask "Proceed with execution?"

## Step 4: Execute plans (main loop)

For each wave (in ascending order), for each plan in the wave:

**4a. Read the plan:**

```bash
cat .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

Parse the plan content. The plan IS the execution instructions -- its `<tasks>` section defines what to do.

**4b. Record start time:**

Note the start time for duration tracking:

```bash
PLAN_START_EPOCH=$(date +%s)
```

**4c. Load execution context:**

Read the `<context>` section `@` file references. Read each referenced file to have full context available.

**4d. Execute each task in order:**

For each `<task>` in the plan's `<tasks>` section:

- **If type="auto":**
  1. Read the `<action>` section carefully -- this IS the implementation instructions
  2. Execute the work described in `<action>` (create files, modify code, run commands)
  3. Apply deviation rules automatically:
     - **Rule 1 (auto-fix bugs):** Fix broken behavior immediately, track as `[Rule 1 - Bug]`
     - **Rule 2 (auto-add missing critical):** Add missing error handling, validation, security. Track as `[Rule 2 - Missing Critical]`
     - **Rule 3 (auto-fix blocking issues):** Fix missing deps, broken imports, build errors. Track as `[Rule 3 - Blocking]`
     - **Rule 4 (architectural changes):** STOP and ask the user before making structural changes (new tables, switching libraries, changing APIs)
  4. Run the `<verify>` check to confirm task is complete
  5. Confirm `<done>` criteria are met
  6. **Atomic task commit:**
     - Run `git status --short` to identify changed files
     - Stage ONLY the files from this task individually (`git add path/to/file`)
     - NEVER use `git add .`, `git add -A`, or `git add -u`
     - Determine commit type (feat, fix, test, refactor, chore, docs, style, perf)
     - Build commit message using:
       ```bash
       node -e "
       import { buildTaskCommitMessage } from './src/execute-phase.js';
       console.log(buildTaskCommitMessage('TYPE', 'PLAN_ID', 'description', ['detail1', 'detail2']));
       "
       ```
       Or construct it directly following `{type}({planId}): {description}` format
     - Commit: `git commit -m "MESSAGE"`
     - Record commit hash: `git rev-parse --short HEAD`
  7. Track: task name, commit hash, commit type, files modified

- **If type="checkpoint:human-verify":**
  1. Present what was built (from `<what-built>`)
  2. Show verification steps (from `<how-to-verify>`)
  3. STOP and wait for user response
  4. If "approved": continue to next task
  5. If issues described: address them, then re-verify

- **If type="checkpoint:decision":**
  1. Present decision and options (from `<decision>`, `<options>`)
  2. STOP and wait for user selection
  3. Record decision for SUMMARY
  4. Continue with user's choice

- **If type="checkpoint:human-action":**
  1. Show what was already automated (from `<instructions>`)
  2. Present the unavoidable manual step (from `<action>`)
  3. STOP and wait for user to complete
  4. Run `<verification>` check if provided
  5. Continue normally

**4e. Handle authentication gates:**

If any CLI/API command returns an auth error during task execution:
1. Recognize it as an auth gate (not a bug)
2. Create a dynamic checkpoint -- present auth steps to user
3. Wait for user to authenticate
4. Retry the original command
5. Continue normally

**4f. Generate SUMMARY.md:**

After all tasks in a plan complete:

1. Calculate duration from start time:
   ```bash
   PLAN_END_EPOCH=$(date +%s)
   DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
   DURATION_MIN=$(( DURATION_SEC / 60 ))
   ```
2. Collect all task commit records, accomplishments, deviations, decisions
3. Generate SUMMARY.md content using:
   ```bash
   node -e "
   import { buildSummaryContent } from './src/execute-phase.js';
   const content = buildSummaryContent({
     phase: 'PHASE_ID', plan: 'PLAN_NUM', title: 'PLAN_TITLE',
     oneLiner: 'SUBSTANTIVE_ONE_LINER',
     subsystem: 'SUBSYSTEM', tags: ['TAG1', 'TAG2'],
     requires: ['REQUIRES'], provides: ['PROVIDES'], affects: ['AFFECTS'],
     techAdded: [], patterns: [],
     filesCreated: [{path: 'path', purpose: 'purpose'}],
     filesModified: [{path: 'path', purpose: 'purpose'}],
     decisions: [{decision: 'what', rationale: 'why'}],
     duration: 'DURATION_MIN min', completed: 'TODAY_DATE',
     tasks: [{name: 'task', commit: 'hash', type: 'feat', files: ['file']}],
     accomplishments: ['accomplishment'],
     deviations: 'None - plan executed exactly as written.',
     issues: 'None',
     nextReadiness: 'Ready for next plan'
   });
   console.log(content);
   "
   ```
4. Write SUMMARY.md to `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`
5. Self-check: verify first 2 created files exist on disk, check `git log --oneline --grep="{planId}"` returns commits

**4g. Update state:**

```bash
node -e "
import { updateStateAfterPlan } from './src/execute-phase.js';
const result = await updateStateAfterPlan('.planning', PHASE_NUM, PLAN_NUM, 'PHASE_NAME', TOTAL_PLANS, COMPLETED_SO_FAR);
console.log(JSON.stringify(result, null, 2));
"
```

Replace placeholders with actual values.

**4h. Commit metadata:**

If COMMIT_PLANNING_DOCS is true:

```bash
git add .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md
```

Build metadata commit message using:

```bash
node -e "
import { buildPlanCommitMessage } from './src/execute-phase.js';
console.log(buildPlanCommitMessage('PLAN_ID', 'PLAN_NAME', ['Task 1', 'Task 2'], 'SUMMARY_PATH'));
"
```

Then: `git commit -m "MESSAGE"`

If COMMIT_PLANNING_DOCS is false: skip with a note "Skipping planning docs commit (commit_docs: false)."

**4i. Report plan completion:**

```
Plan {planId} complete.
Summary: .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md
{M} of {N} plans complete for Phase {X}.
```

**4j. Inter-plan routing:**

- In yolo mode: auto-continue to next plan
- In interactive mode: ask user "Continue to next plan?" or suggest `/clear` for fresh context
- If context usage is getting high (approaching 50%+): suggest `/clear` and re-running `/gsd-execute-phase N` to resume with fresh context

## Step 5: Handle failures

If any task fails:
- Report which task failed and why
- Offer options: Retry, Skip (mark incomplete in SUMMARY), Stop
- If stopped: generate partial SUMMARY.md noting incomplete tasks
- STATE.md updated with last completed position

If a task verification fails:

```
Verification failed for Task {X}: {task name}

Expected: {verification criteria}
Actual: {what happened}

How to proceed?
1. Retry -- Try the task again
2. Skip -- Mark as incomplete, continue
3. Stop -- Pause execution, investigate
```

Wait for user decision.

## Step 6: Phase completion

After all plans complete:

```bash
node -e "
import { getPhaseCompletionStatus } from './src/execute-phase.js';
const status = await getPhaseCompletionStatus('PHASE_DIR');
console.log(JSON.stringify(status, null, 2));
"
```

If all plans complete:

```
## Phase {N}: {Name} Complete

All {M} plans finished.

---

## Next Up

**Phase {N+1}: {Next Name}** -- {Goal from ROADMAP.md}

`/gsd-plan-phase {N+1}`

<sub>`/clear` first -- fresh context window</sub>

---

**Also available:**
- `/gsd-progress` -- see updated project status
```

If this was the final phase in the milestone, celebrate and suggest `/gsd-progress`.

## Behavioral Guidelines

- **Execution is main-context.** Cline reads task instructions and performs them inline. No subagents. No `spawnAgent`, no `agent-spawn.js`, no `cline "prompt" &` for execution.
- **Atomic commits: one commit per task.** Never batch multiple tasks into one commit. Stage files individually -- never use `git add .` or `git add -A`.
- **Deviation rules are automatic** (Rules 1-3) except architectural changes (Rule 4 asks the user).
- **Context management:** If a plan is consuming too much context, finish it and suggest `/clear` before the next plan.
- **Never skip SUMMARY.md generation.** It is the completion signal for resumption logic.
- **Parallelization config is ignored for execution.** Main context is inherently sequential. The parallelization setting only applies to research/mapping agents (Phases 5-6).
- **The `autonomous` flag is informational.** All execution is interactive in main context. Use it to warn the user: "This plan has checkpoints that will require your input."
- **Keep orchestration output concise.** The PLAN.md itself is the prompt -- the workflow guides execution, it does not repeat all plan content.
- **Record commit hashes for every task.** They go into SUMMARY.md for traceability.
- **Resumption via SUMMARY detection.** Plans with existing SUMMARY.md files are skipped. Re-running `/gsd-execute-phase N` safely resumes from the first incomplete plan.
- **Wave ordering is respected.** Wave 1 plans execute before wave 2 plans. Within a wave, plans execute sequentially.
- **Yolo mode auto-continues between plans.** Interactive mode pauses after each plan and asks the user.
- **Authentication gates are not failures.** Handle them by creating a dynamic checkpoint, waiting for the user to authenticate, then retrying.
