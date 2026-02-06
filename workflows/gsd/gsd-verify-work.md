---
description: Verify completed phase work with automated must-haves checking and interactive UAT
---

# /gsd-verify-work -- Verify Completed Work

This workflow verifies completed phase work through two mechanisms: (1) automated must-haves checking against the actual codebase, and (2) interactive user acceptance testing (UAT). It runs in the main Cline context. Must-haves verification checks that planned artifacts exist, are substantive (not stubs), and are wired (imported/used). Interactive UAT presents testable deliveries from SUMMARY.md files for the user to confirm pass/fail. Together they close the verification loop after plan execution.

## Step 1: Parse phase number and load state

Extract the phase number from the user's input. If not provided, read STATE.md for the current or last completed phase and ask the user:

```bash
node -e "
import { readState, readPlanningConfig } from './src/state-read.js';
import { getPhaseDetails } from './src/discuss-phase.js';
const state = await readState('.planning');
const config = await readPlanningConfig('.planning');
const phase = await getPhaseDetails('.planning', PHASE_NUM);
console.log(JSON.stringify({ state: state.data?.position, config: config.data, phase: phase.data }, null, 2));
"
```

Replace `PHASE_NUM` with the actual phase number from the user's input (e.g., `/gsd-verify-work 7`).

If the phase is not found, stop with error:

> Phase PHASE_NUM not found in ROADMAP.md. Check the phase number and try again.

Check if the phase execution is complete (all plans have SUMMARY.md):

```bash
node -e "
import { getPhaseCompletionStatus } from './src/execute-phase.js';
const status = await getPhaseCompletionStatus('PHASE_DIR_PATH');
console.log(JSON.stringify(status, null, 2));
"
```

Replace `PHASE_DIR_PATH` with the absolute path to the phase directory (e.g., `.planning/phases/07-execution-workflow`).

- If the phase has incomplete plans, warn the user:
  ```
  Phase {N} has {K} incomplete plans ({list}). Verification may be partial.
  Continue anyway? (yes / no)
  ```
- If all plans are complete, proceed to Step 2.

## Step 2: Automated must-haves verification

Discover all plans in the phase:

```bash
node -e "
import { discoverPlans } from './src/execute-phase.js';
const result = await discoverPlans('PHASE_DIR_PATH');
console.log(JSON.stringify(result.data.plans.map(p => ({ id: p.id, path: p.path })), null, 2));
"
```

For each plan, read the PLAN.md content and parse must_haves:

```bash
node -e "
import { readFile } from 'node:fs/promises';
import { parseMustHaves } from './src/verify-work.js';
const content = await readFile('PLAN_PATH', 'utf-8');
const mustHaves = parseMustHaves(content);
console.log(JSON.stringify(mustHaves, null, 2));
"
```

If must_haves is null (plan has no must_haves field), skip that plan's automated verification and note it for UAT.

For each plan with must_haves, perform these checks:

**Check artifacts:**

For each artifact in `mustHaves.artifacts`:

1. Check existence:
   ```bash
   node -e "
   import { checkArtifactExists } from './src/verify-work.js';
   const result = await checkArtifactExists('ARTIFACT_PATH');
   console.log(JSON.stringify(result.data, null, 2));
   "
   ```

2. If the artifact exists, check substantiveness:
   ```bash
   node -e "
   import { checkArtifactSubstantive } from './src/verify-work.js';
   const result = await checkArtifactSubstantive('ARTIFACT_PATH', {
     min_lines: MIN_LINES,
     exports: ['EXPORT1', 'EXPORT2'],
     contains: 'CONTAINS_STRING'
   });
   console.log(JSON.stringify(result.data, null, 2));
   "
   ```
   Pass the artifact's `min_lines`, `exports`, and `contains` values from the must_haves specification.

3. If the artifact is substantive, check wiring:
   ```bash
   node -e "
   import { checkArtifactWired } from './src/verify-work.js';
   const result = await checkArtifactWired('ARTIFACT_PATH', '.');
   console.log(JSON.stringify(result.data, null, 2));
   "
   ```

Record the three-level result for each artifact: exists, substantive status, wired status.

**Check key links:**

For each key_link in `mustHaves.key_links`:

1. Read the `from` file and check if the `pattern` regex matches:
   ```bash
   node -e "
   import { readFile } from 'node:fs/promises';
   const content = await readFile('FROM_PATH', 'utf-8');
   const pattern = new RegExp('PATTERN');
   const found = pattern.test(content);
   console.log(JSON.stringify({ from: 'FROM_PATH', to: 'TO_PATH', via: 'VIA_DESC', found }));
   "
   ```

Record whether each key_link pattern was found.

**Derive truth statuses:**

Truths are observable behaviors that cannot be fully automated. Derive their status heuristically:

- Mark a truth as **pass** if ALL artifacts that could support it are SUBSTANTIVE and wired.
- Mark a truth as **fail** if any supporting artifact is missing or STUB.
- Mark a truth as **skip** if there is no clear artifact mapping (these need manual UAT confirmation).

**Generate VERIFICATION.md:**

Collect all plan results and counts, then generate the verification report:

```bash
node -e "
import { buildVerificationContent } from './src/verify-work.js';
import { writeFile } from 'node:fs/promises';
const content = buildVerificationContent({
  phase: 'PHASE_ID',
  phaseName: 'PHASE_NAME',
  plans: [
    {
      planId: 'PLAN_ID',
      truths: [{ text: 'TRUTH_TEXT', status: 'pass' }],
      artifacts: [{ path: 'PATH', exists: true, substantive: 'SUBSTANTIVE', wired: true, status: 'pass' }],
      keyLinks: [{ from: 'FROM', to: 'TO', via: 'VIA', found: true, status: 'pass' }]
    }
  ],
  created: new Date().toISOString().split('T')[0],
  summary: { totalChecks: TOTAL, passed: PASSED, failed: FAILED, skipped: SKIPPED }
});
await writeFile('PHASE_DIR/PHASE-VERIFICATION.md', content, 'utf-8');
console.log('VERIFICATION.md written');
"
```

Write the file to `.planning/phases/XX-name/{phase}-VERIFICATION.md`.

**Report results:**

Present a summary table to the user:

```
## Must-Haves Verification

{passed}/{total} checks passed ({failed} failed, {skipped} skipped)

| Plan | Artifacts | Key Links | Status |
|------|-----------|-----------|--------|
| 08-01 | 2/2 pass | 4/4 pass | PASS |
| 08-02 | 2/2 pass | 2/2 pass | PASS |
```

## Step 3: Interactive UAT

Extract testable deliveries from SUMMARY.md files for each completed plan:

```bash
node -e "
import { readFile } from 'node:fs/promises';
import { extractTestableDeliveries } from './src/verify-work.js';
const content = await readFile('SUMMARY_PATH', 'utf-8');
const deliveries = extractTestableDeliveries(content);
console.log(JSON.stringify(deliveries, null, 2));
"
```

Present the phase success criteria from ROADMAP.md (already loaded in Step 1 via `getPhaseDetails`). These become the UAT test cases.

For each success criterion:

1. **Show the criterion text** -- what was supposed to be delivered.
2. **Show supporting evidence** -- which artifacts were verified in Step 2, related accomplishments from SUMMARY.md files.
3. **Ask the user:**
   ```
   Does this work as expected?
   - pass: Yes, verified
   - fail: No, there is an issue
   - skip: Cannot verify right now
   ```
4. If the user says **fail**, ask:
   ```
   What is the issue?
   > (user describes the problem)

   Severity?
   - blocker: Prevents core functionality
   - major: Significant impact but has workaround
   - minor: Small issue, low impact
   ```
5. Record the result.

After all criteria are evaluated, generate UAT.md:

```bash
node -e "
import { buildUATContent } from './src/verify-work.js';
import { writeFile } from 'node:fs/promises';
const content = buildUATContent({
  phase: 'PHASE_ID',
  phaseName: 'PHASE_NAME',
  tests: [
    { name: 'TEST_NAME', expected: 'EXPECTED_BEHAVIOR', result: 'pass' },
    { name: 'TEST_NAME', expected: 'EXPECTED_BEHAVIOR', result: 'fail', issue: 'ISSUE_DESC', severity: 'major' }
  ],
  status: 'STATUS',
  created: new Date().toISOString().split('T')[0],
  updated: new Date().toISOString().split('T')[0]
});
await writeFile('PHASE_DIR/PHASE-UAT.md', content, 'utf-8');
console.log('UAT.md written');
"
```

Write the file to `.planning/phases/XX-name/{phase}-UAT.md`.

Determine overall UAT status:
- **passed**: All tests pass
- **failed**: Any test failed
- **diagnosed**: Tests failed but issues are understood

## Step 4: Results and next steps

If all must-haves checks pass AND all UAT tests pass:

```
## Verification Complete

Phase {N}: {Name} -- ALL CHECKS PASSED

- Must-haves: {M}/{M} pass
- UAT: {K}/{K} pass

Phase is verified and ready.

---

**Next steps:**
- `/gsd-progress` -- see updated project status
{If more phases remain: - `/gsd-plan-phase {N+1}` -- plan next phase}
```

If any must-haves checks fail:

```
## Verification Found Issues

Phase {N}: {Name} -- {F} MUST-HAVE ISSUES FOUND

### Failed Checks
{list of failures with artifact paths, statuses, and details}

### Recommended Actions
1. Fix the identified issues (missing files, stubs, unwired artifacts)
2. Re-run `/gsd-verify-work {N}` to confirm fixes
3. If systematic gaps: `/gsd-plan-phase {N} --gaps` to create fix plans
```

If any UAT tests fail:

```
## Verification Found Issues

Phase {N}: {Name} -- {F} UAT ISSUES FOUND

### Failed Tests
{list of failures with issue descriptions and severity}

### Recommended Actions
1. Address blocker issues first
2. Re-run `/gsd-verify-work {N}` after fixes
{If issues need investigation: 3. `/gsd-debug` to investigate root causes}
```

If mixed results (some pass, some fail):

```
## Verification Partial

Phase {N}: {Name} -- PARTIAL PASS

- Must-haves: {M}/{T} pass ({F} failed)
- UAT: {K}/{U} pass ({J} failed, {S} skipped)

### Action Items
{Prioritized list of issues to fix}

Re-run `/gsd-verify-work {N}` after addressing issues.
```

## Behavioral Guidelines

- **Verification runs in the main Cline context only.** No subagents for checking. All artifact verification, key_link checking, and UAT interaction happens inline.
- **Must-haves verification is automated.** No user input is needed for artifact existence, substantiveness, and wiring checks. Report results directly.
- **UAT is interactive.** Always ask the user for pass/fail confirmation on each success criterion. Never auto-pass UAT items.
- **Never skip VERIFICATION.md or UAT.md generation.** They are the persistent verification record. Even partial results should be written.
- **If a plan has no must_haves frontmatter**, skip its automated checking but still include it in UAT via SUMMARY.md extraction.
- **Truths without clear artifact backing are marked 'skip'** and flagged for manual verification in the UAT step.
- **Keep output concise.** Show summary tables, not every regex match or file read. The detailed results are in VERIFICATION.md.
- **Suggest `/gsd-debug`** for UAT failures that need investigation.
- **Suggest `/gsd-plan-phase N --gaps`** for systematic must-haves failures that indicate missing implementation.
- **Handle gracefully when files are missing.** If a SUMMARY.md does not exist for a completed plan, note it and continue with what is available.
- **Do not import from agent-spawn.js.** Verification is entirely main-context work.
