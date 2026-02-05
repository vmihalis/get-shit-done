---
description: Create validated plans for a phase with optional research and checking
---

# /gsd-plan-phase.md - Plan a Phase

This workflow orchestrates the planning pipeline for a phase. It optionally runs a researcher agent, always runs a planner agent, and optionally runs a plan-checker agent. The pipeline is sequential -- each step depends on the previous output.

## Step 1: Parse phase number

Extract the phase number from the user's input. If the user did not provide a phase number, read the ROADMAP to show available phases:

```bash
node -e "
import { readRoadmap } from './src/state-read.js';
const result = await readRoadmap('.planning');
if (result.success) {
  console.log(result.data.raw);
} else {
  console.log('Could not read ROADMAP.md:', result.error);
}
"
```

Ask: "Which phase would you like to plan?" Show the phase list with status from the progress table.

Store the phase number as `PHASE_NUM` for subsequent steps.

## Step 2: Load phase details and config

Load the full phase details from ROADMAP.md and the planning configuration:

```bash
node -e "
import { getPhaseDetails } from './src/discuss-phase.js';
import { readPlanningConfig } from './src/state-read.js';
const [phase, config] = await Promise.all([
  getPhaseDetails('.planning', PHASE_NUM),
  readPlanningConfig('.planning')
]);
console.log(JSON.stringify({ phase: phase, config: config.data }, null, 2));
"
```

Replace `PHASE_NUM` with the actual phase number.

If the phase is not found (phase result has `success: false`), stop with an error:

> Phase PHASE_NUM not found in ROADMAP.md. Check the phase number and try again.

Store the phase name, details, and config for subsequent steps.

## Step 3: Check for existing plans

Check if PLAN.md files already exist for this phase:

```bash
ls .planning/phases/PADDED_PHASE-*/*-PLAN.md 2>/dev/null
```

Replace `PADDED_PHASE` with the zero-padded phase number (e.g. `06`).

If plans exist, inform the user:

> Plans already exist for this phase:
> (list of plan files)
>
> Options:
> 1. **Re-plan** -- delete existing plans and re-run the pipeline
> 2. **Skip** -- keep existing plans

If the user chooses re-plan:

```bash
rm -f .planning/phases/PADDED_PHASE-*/*-PLAN.md
rm -f .planning/phases/PADDED_PHASE-*/*-PLANS-DONE.md
rm -f .planning/phases/PADDED_PHASE-*/*-CHECK.md
```

If the user chooses skip: stop and suggest `/gsd-progress` to check status.

If no existing plans: continue to Step 4.

## Step 4: Check for CONTEXT.md

Check if a CONTEXT.md file exists for this phase:

```bash
ls .planning/phases/PADDED_PHASE-*/*-CONTEXT.md 2>/dev/null
```

If it exists, read its content and store it for agent prompts:

```bash
cat .planning/phases/PADDED_PHASE-*/*-CONTEXT.md
```

If it does not exist, note to the user:

> No CONTEXT.md found. Consider running `/gsd-discuss-phase PHASE_NUM` first for better plans. Continuing without context...

Store the context content (or null) for Step 5.

## Step 5: Run planning pipeline

Inform the user about what will happen based on the config:

- "Research agent: {enabled/disabled} (workflow.research in config)"
- "Plan checker: {enabled/disabled} (workflow.plan_check in config)"
- "This may take 5-15 minutes depending on phase complexity."

Run the pipeline:

```bash
node -e "
import { runPlanningPipeline } from './src/plan-phase.js';
const result = await runPlanningPipeline(
  process.cwd(),
  PHASE_NUM,
  'PHASE_NAME',
  {
    phaseDetails: PHASE_DETAILS_JSON,
    contextContent: CONTEXT_CONTENT_OR_NULL,
    timeout: 600000
  }
);
console.log(JSON.stringify(result, null, 2));
"
```

Replace placeholders with the actual values from previous steps. Pass `phaseDetails` and `contextContent` as JSON-encoded strings.

Wait for the pipeline to complete. This spawns up to 3 sequential agents and may take several minutes per agent.

## Step 6: Verify results

Check the pipeline output:

- If `success: false`: report the error and suggest re-running `/gsd-plan-phase PHASE_NUM`.
- If `success: true`: report what was produced.

For each produced file, verify content:

```bash
for f in .planning/phases/PADDED_PHASE-*/*-PLAN.md; do
  lines=$(wc -l < "$f" 2>/dev/null || echo 0)
  name=$(basename "$f")
  echo "$name: $lines lines"
done
```

Show a summary of pipeline stages:

| Stage | Ran | Result |
|-------|-----|--------|
| Research | yes/no | pass/fail/skipped |
| Planning | yes | pass/fail |
| Checking | yes/no | pass/fail/skipped |

If the checker ran and produced output, read the first few lines to show its verdict summary.

## Step 7: Update state and commit

Update STATE.md to reflect that planning is underway for this phase:

```bash
node -e "
import { readFile, writeFile } from 'node:fs/promises';
const state = await readFile('.planning/STATE.md', 'utf-8');
const updated = state
  .replace(/Status:\s*.+/, 'Status: Planning underway')
  .replace(/Last activity:\s*.+/, 'Last activity: $(date +%Y-%m-%d) -- Planning phase PHASE_NUM');
await writeFile('.planning/STATE.md', updated);
console.log('STATE.md updated');
"
```

If `commit_docs` is `true` in config:

```bash
git add .planning/phases/PADDED_PHASE-*/ && git commit -m "docs(PADDED_PHASE): create plans for PHASE_NAME via /gsd-plan-phase"
```

If `commit_docs` is `false`, skip with a note:

> Skipping git commit (commit_docs: false in config).

## Step 8: Present results and next steps

Show a summary of what was accomplished:

- Pipeline stages run (research, planning, checking) with pass/fail for each
- Number of PLAN.md files created
- If checker ran and had issues, summarize them

Suggest next steps:

- "Plans are ready! Run `/gsd-progress` to see updated status, or start executing."
- If plans need review: "Review the plans in `.planning/phases/PADDED_PHASE-*/` before executing."

## Behavioral Guidelines

- **Inform on spawn.** Tell the user each agent is spawning and may take several minutes.
- **Handle partial failures.** If research fails, continue to planning. If checker fails, plans are still usable.
- **Do not read PLAN.md contents in detail.** Summarize count and line counts only.
- **Keep it concise.** The orchestration module does the heavy lifting.
- **Never ask the user to run commands.** Always execute commands yourself.
- **Model orchestration is advisory.** Log which model tier is recommended per step but do not enforce it.
