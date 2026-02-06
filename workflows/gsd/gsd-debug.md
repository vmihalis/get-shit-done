---
description: Systematic debugging with persistent state using scientific method and hypothesis testing
---

# /gsd-debug -- Systematic Debugging

This workflow provides systematic debugging with persistent investigation state. Debug sessions are stored in `.planning/debug/DEBUG-{slug}.md` files that persist across `/clear` boundaries, enabling long-running investigations. The methodology follows the scientific method: gather symptoms, form hypothesis, test, eliminate/confirm, resolve. All investigation happens in the main Cline context.

## Step 1: Check for active debug sessions

Look for any existing, unresolved debug sessions:

```bash
node -e "
import { getActiveDebugSessions } from './src/debug-phase.js';
const result = await getActiveDebugSessions('.planning');
if (result.success && result.data.sessions.length > 0) {
  console.log('Active sessions:');
  result.data.sessions.forEach(s => console.log('  -', s.slug, '(' + s.status + '):', s.trigger));
} else {
  console.log('No active debug sessions.');
}
"
```

**If active sessions exist:**
- Show list with status and trigger for each
- Ask: "Resume an existing session, or start new? (resume {slug} / new)"
- If resume: load that session file and jump to Step 3

**If no active sessions or user chooses "new":** Continue to Step 2.

## Step 2: Create new debug session

Ask the user: "What issue are you debugging?"

Capture their description as the trigger. Generate a slug from the description:
- Lowercase
- Replace spaces and special characters with hyphens
- Keep it to 3-5 words (e.g., "login-redirect-loop", "api-timeout-on-save")

Ensure the debug directory exists:

```bash
mkdir -p .planning/debug
```

Generate the debug session file:

```bash
node -e "
import { buildDebugFileContent } from './src/debug-phase.js';
const content = buildDebugFileContent({
  slug: 'SLUG_HERE',
  trigger: 'TRIGGER_DESCRIPTION',
  status: 'gathering',
  created: 'TODAY_DATE',
  updated: 'TODAY_DATE'
});
console.log(content);
"
```

Replace `SLUG_HERE`, `TRIGGER_DESCRIPTION`, and `TODAY_DATE` with actual values.

Write the output to `.planning/debug/DEBUG-{slug}.md`.

Report: "Debug session created: `.planning/debug/DEBUG-{slug}.md`"

## Step 3: Load investigation context

Read and parse the debug session file to orient the investigation:

```bash
node -e "
import { readFile } from 'node:fs/promises';
import { parseDebugFile, buildDebugPrompt } from './src/debug-phase.js';
const content = await readFile('.planning/debug/DEBUG-SLUG.md', 'utf-8');
const session = parseDebugFile(content);
const prompt = buildDebugPrompt(session);
console.log(prompt);
"
```

Replace `SLUG` with the actual slug.

Display the investigation context. This orients Cline (and the user) to the current state of the investigation -- especially useful when resuming after a `/clear`.

## Step 4: Investigation loop (based on status)

The investigation follows strict status transitions:

```
gathering -> investigating -> fixing -> verifying -> resolved
```

Can loop back from `verifying` to `investigating` if the fix does not work.

---

**If status = "gathering":**

1. Ask: "Describe the symptoms. What did you expect vs what happened?"
2. Update the debug file with symptoms:
   ```bash
   node -e "
   import { updateDebugFile } from './src/debug-phase.js';
   const result = await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
     symptoms: {
       expected: 'EXPECTED_BEHAVIOR',
       actual: 'ACTUAL_BEHAVIOR',
       errors: 'ERROR_MESSAGES',
       reproduction: 'STEPS_TO_REPRODUCE'
     }
   });
   console.log(result.success ? 'Symptoms recorded.' : 'Error: ' + result.error);
   "
   ```
3. Analyze the symptoms and form an initial hypothesis
4. Update status to "investigating" and set Current Focus:
   ```bash
   node -e "
   import { updateDebugFile } from './src/debug-phase.js';
   const result = await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
     status: 'investigating',
     currentFocus: {
       hypothesis: 'HYPOTHESIS',
       test: 'HOW_TO_TEST',
       expecting: 'EXPECTED_IF_TRUE',
       next_action: 'NEXT_ACTION'
     }
   });
   console.log(result.success ? 'Investigation started.' : 'Error: ' + result.error);
   "
   ```
5. Continue to "investigating" flow below

---

**If status = "investigating":**

1. Read Current Focus for the current hypothesis
2. Execute the test described in the `test` field:
   - Read relevant source files
   - Run commands to gather data
   - Check logs, configs, or runtime behavior
3. Compare results to the `expecting` field

**If hypothesis confirmed:**
- Append to Evidence section:
  ```bash
  node -e "
  import { updateDebugFile } from './src/debug-phase.js';
  await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
    appendEvidence: '- FINDING: DESCRIPTION (implication: WHAT_IT_MEANS)'
  });
  "
  ```
- Update status to "fixing" and set fix plan in Current Focus:
  ```bash
  node -e "
  import { updateDebugFile } from './src/debug-phase.js';
  await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
    status: 'fixing',
    currentFocus: {
      hypothesis: 'CONFIRMED_ROOT_CAUSE',
      test: 'FIX_APPROACH',
      expecting: 'EXPECTED_AFTER_FIX',
      next_action: 'APPLY_FIX'
    }
  });
  "
  ```

**If hypothesis disproven:**
- Append to Eliminated section:
  ```bash
  node -e "
  import { updateDebugFile } from './src/debug-phase.js';
  await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
    appendEliminated: '- HYPOTHESIS: DISPROVEN (evidence: WHAT_WAS_FOUND)'
  });
  "
  ```
- Form a new hypothesis based on what was learned
- Update Current Focus with the new hypothesis:
  ```bash
  node -e "
  import { updateDebugFile } from './src/debug-phase.js';
  await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
    currentFocus: {
      hypothesis: 'NEW_HYPOTHESIS',
      test: 'HOW_TO_TEST',
      expecting: 'EXPECTED_IF_TRUE',
      next_action: 'NEXT_ACTION'
    }
  });
  "
  ```
- Repeat the investigation cycle

---

**If status = "fixing":**

1. Read Current Focus for the fix plan
2. Apply the fix (Cline performs the code changes in the main context)
3. Update status to "verifying" with verification plan:
   ```bash
   node -e "
   import { updateDebugFile } from './src/debug-phase.js';
   await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
     status: 'verifying',
     currentFocus: {
       hypothesis: 'ROOT_CAUSE',
       test: 'VERIFICATION_METHOD',
       expecting: 'EXPECTED_PASSING_RESULT',
       next_action: 'Run verification'
     }
   });
   "
   ```

---

**If status = "verifying":**

1. Run the verification described in Current Focus
2. **If fix verified:**
   - Update status to "resolved" and fill Resolution section:
     ```bash
     node -e "
     import { updateDebugFile } from './src/debug-phase.js';
     await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
       status: 'resolved',
       resolution: {
         root_cause: 'ROOT_CAUSE_DESCRIPTION',
         fix: 'FIX_DESCRIPTION',
         verification: 'HOW_VERIFIED',
         files_changed: 'LIST_OF_FILES'
       }
     });
     "
     ```
   - Report resolution (see Step 5)

3. **If verification fails:**
   - Append failure to Evidence:
     ```bash
     node -e "
     import { updateDebugFile } from './src/debug-phase.js';
     await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
       appendEvidence: '- VERIFICATION FAILED: DESCRIPTION (fix was insufficient or wrong)',
       status: 'investigating',
       currentFocus: {
         hypothesis: 'NEW_HYPOTHESIS_AFTER_FAILED_FIX',
         test: 'HOW_TO_TEST',
         expecting: 'EXPECTED_IF_TRUE',
         next_action: 'NEXT_ACTION'
       }
     });
     "
     ```
   - Loop back to "investigating" flow

## Step 5: Session management

At any point during the investigation, offer these options:

- **"Continue investigating"** -- loop back to Step 4 with current status
- **"Pause session"** -- save current state and exit; the debug file persists and can be resumed later with `/gsd-debug`
- **"Abandon session"** -- mark as resolved with a note that it was abandoned:
  ```bash
  node -e "
  import { updateDebugFile } from './src/debug-phase.js';
  await updateDebugFile('.planning/debug/DEBUG-SLUG.md', {
    status: 'resolved',
    resolution: {
      root_cause: 'Abandoned',
      fix: 'N/A',
      verification: 'N/A',
      files_changed: 'N/A'
    }
  });
  "
  ```

**When resolved:**

```
## Debug Session Resolved: {slug}

**Root cause:** {root_cause}
**Fix applied:** {fix}
**Verified:** {verification}

Debug file: .planning/debug/DEBUG-{slug}.md

---

**Next steps:**
- `/gsd-verify-work {N}` -- re-run verification if this was from a UAT failure
- `/gsd-progress` -- check project status
```

## Behavioral Guidelines

- **All investigation and fixing happens in the main Cline context.** No subagents. No `spawnAgent`, no `agent-spawn.js`, no `cline "prompt" &` for debugging. Cline reads code, forms hypotheses, and performs fixes directly.
- **Update the debug file BEFORE taking action, not after.** This ensures the file always reflects what is about to happen, enabling reliable resume after `/clear` or interruption.
- **Eliminated and Evidence sections are append-only.** Never delete entries. This creates an audit trail of the investigation. Each entry should include what was found and its implication.
- **Status transitions are strict:** `gathering -> investigating -> fixing -> verifying -> resolved`. The only allowed loop-back is from `verifying` to `investigating` if the fix does not work.
- **Keep hypotheses specific and testable.** "Something is wrong with auth" is bad. "JWT token expiry is set to 0 instead of 900 seconds" is good. If a hypothesis is too broad, narrow it before testing.
- **Each investigation cycle should take 5-15 minutes.** If it is taking longer, the hypothesis is too broad -- narrow it down.
- **When pausing, always save current state** so resume picks up where you left off. The Current Focus section should always describe what to do next.
- **Debug files persist across `/clear`.** Always check for active sessions at the start of every `/gsd-debug` invocation. This is the core value of the debug system.
- **Scientific method is mandatory.** Never jump to a fix without testing a hypothesis first. The eliminate/confirm cycle prevents wasted time on wrong assumptions.
