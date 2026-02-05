---
description: Check project progress and suggest next action
---

# /gsd-progress.md - Project Progress & Routing

You are checking the status of a GSD project and suggesting the next action. Be concise -- this is a status check, not a conversation. Read files silently and present a single well-formatted report.

## Step 1: Verify planning structure

```bash
test -d .planning && echo "exists" || echo "missing"
```

If missing, display this message and stop:

> No GSD project found in this directory. Run `/gsd-new-project.md` to initialize a new project.

## Step 2: Load project context

Read these files. Skip any that don't exist -- do not error on missing files.

- `.planning/PROJECT.md` -- parse the project name from the `# ` heading and the core value from the `## Core Value` section
- `.planning/STATE.md` -- parse current position (Phase N of M, Plan X of Y, Status, Last activity) and the progress percentage
- `.planning/ROADMAP.md` -- parse the progress table (phase name, plans complete X/Y, status, completed date)
- `.planning/config.json` -- parse mode and depth for context

Do not narrate the file reading. Go straight to the report.

## Step 3: Present status report

Display a formatted status report:

```
# [Project Name]

**Core Value:** [core value from PROJECT.md]

**Progress:** [████░░░░░░] N/M plans complete (X%)

## Current Position

Phase N of M: [phase-name]
Plan: X of Y in current phase
Status: [status]
Last activity: [date] -- [description]

## Phase Progress

| Phase | Status | Progress |
|-------|--------|----------|
| 1. [name] | Complete | 3/3 |
| 2. [name] | In progress | 1/2 |
| ... | ... | ... |

## Session Info

Last session: [date]
Stopped at: [description]
```

**Progress bar format:** Use block characters with 10 slots. Each slot represents (100/10)% = 10%. Fill slots proportionally: `[████░░░░░░]`. Calculate as: filled = round(percentage / 10), empty = 10 - filled. Calculate overall progress as: (total completed plans across all phases) / (total plans across all phases).

If any state file is missing or malformed, note it briefly in the report but present whatever information is available. Do not fail entirely due to one bad file.

## Step 4: Smart routing -- suggest next action

Based on the current state, determine ONE clear next action and present it as an actionable suggestion.

**Routing logic (evaluate in order):**

| Condition | Suggestion |
|-----------|------------|
| No ROADMAP.md exists | "Run `/gsd-new-project.md` to complete project setup." |
| Status contains "blocked" or "error" | "There's a blocker. Check `.planning/STATE.md` for details and resolve the issue." |
| Current phase has unexecuted plans (plan < total in phase) | "Continue the current phase: execute the next plan for Phase N." |
| Current phase complete and next phase has TBD plans | "Phase N is complete! Start planning Phase N+1: [phase-name]." |
| Current phase complete and next phase has plans | "Phase N is complete! Start executing Phase N+1: [phase-name]." |
| All phases complete | "All phases complete! Consider running final verification." |

Present the suggestion clearly:

```
## What's Next

[Actionable suggestion with specific command if applicable]
```

## Behavioral Guidelines

- **Be concise.** One formatted report, no chitchat.
- **Read silently.** Do not narrate "Reading STATE.md..." -- just read and present.
- **Fail gracefully.** Missing files get a note, not an error. Present what you can.
- **One suggestion.** Do not list multiple options. Pick the most relevant next action.
- **Use data.** The progress bar, percentages, and phase table should reflect actual file contents, not guesses.
