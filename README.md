<div align="center">

# GET SHIT DONE — for Cline

**The GSD spec-driven development system, ported for [Cline](https://github.com/cline/cline).**

**Same structured workflow. Same context engineering. Now works with Cline CLI and VS Code extension.**

[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npx cline-gsd
```

**Works on Mac, Windows, and Linux.**

<br>

*Based on [glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done) — the original GSD for Claude Code.*

</div>

---

## What Is This?

This is a port of [Get Shit Done (GSD)](https://github.com/glittercowboy/get-shit-done) to work with **Cline** instead of Claude Code.

GSD is a spec-driven development system that solves context rot — the quality degradation that happens as AI fills its context window. It does this through deep questioning, structured planning, parallel research agents, atomic execution, and automated verification.

The original GSD works with Claude Code, OpenCode, and Gemini CLI. **This port brings the same workflow to Cline users** — both the VS Code extension and the standalone CLI.

### Key Differences from Upstream GSD

| | Claude Code GSD | Cline GSD |
|---|---|---|
| **Agent spawning** | `Task` tool (in-process) | `cline "prompt" &` (CLI subprocesses) |
| **Execution** | Subagent contexts | Main Cline context (CLI agents are read-only) |
| **Commands** | `/gsd:command` | `/gsd-command.md` (Cline workflow format) |
| **Installation** | `npx get-shit-done-cc` | `npx cline-gsd` |
| **Config location** | `~/.claude/commands/` | `~/Documents/Cline/Workflows/` |

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **Cline CLI** (`npm install -g cline`) and/or **Cline VS Code extension**

### Install

```bash
npx cline-gsd
```

The installer detects your platform, checks for the Cline CLI, and copies GSD workflow files to `~/Documents/Cline/Workflows/`.

Verify it worked:

**In VS Code (Cline extension):**
```
/gsd-health.md
```

**From terminal (Cline CLI):**
```bash
cline "$(cat ~/Documents/Cline/Workflows/gsd-health.md)"
```

---

## How It Works

The workflow is the same as upstream GSD — describe your idea, let the system extract everything it needs, and let Cline build it.

### 1. Initialize Project

```
/gsd-new-project.md
```

The system asks deep questions about your idea (goals, constraints, tech preferences, edge cases), optionally spawns parallel research agents, extracts requirements, and creates a phased roadmap.

**Creates:** `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `.planning/`

### 2. Discuss Phase

```
/gsd-discuss-phase.md 1
```

Captures your implementation preferences before planning. The system identifies gray areas and asks targeted questions — layout, interactions, error handling, etc.

**Creates:** `{phase}-CONTEXT.md`

### 3. Plan Phase

```
/gsd-plan-phase.md 1
```

Spawns research agents, creates atomic task plans with XML structure, then verifies plans against requirements.

**Creates:** `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md`

### 4. Execute Phase

```
/gsd-execute-phase.md 1
```

Runs plans sequentially in the main Cline context. Each completed task gets an atomic git commit.

**Creates:** `{phase}-{N}-SUMMARY.md`

### 5. Verify Work

```
/gsd-verify-work.md 1
```

Walks you through testable deliverables one at a time. If something's broken, it diagnoses the issue and creates fix plans.

**Creates:** `{phase}-UAT.md`

### 6. Repeat

```
discuss → plan → execute → verify
```

Loop through each phase until the milestone is complete.

---

## Commands

### Core Workflow

| Command | What it does |
|---------|--------------|
| `/gsd-new-project.md` | Full initialization: questions → research → requirements → roadmap |
| `/gsd-discuss-phase.md [N]` | Capture implementation decisions before planning |
| `/gsd-plan-phase.md [N]` | Research + plan + verify for a phase |
| `/gsd-execute-phase.md [N]` | Execute all plans with atomic commits |
| `/gsd-verify-work.md [N]` | User acceptance testing |

### Utilities

| Command | What it does |
|---------|--------------|
| `/gsd-health.md` | Verify installation |
| `/gsd-progress.md` | Check project state and next action |
| `/gsd-debug.md` | Systematic debugging with persistent state |
| `/gsd-map-codebase.md` | Analyze existing codebase before new-project |
| `/gsd-sync-upstream.md` | Check for upstream GSD updates |

### Using Commands

**VS Code (Cline extension):** Type the command directly in Cline's chat panel (e.g. `/gsd-new-project.md`).

**Terminal (Cline CLI):**
```bash
cline "$(cat ~/Documents/Cline/Workflows/gsd-new-project.md)"

# With auto-approve:
cline -y "$(cat ~/Documents/Cline/Workflows/gsd-new-project.md)"
```

---

## Configuration

GSD stores project settings in `.planning/config.json`. Configure during `/gsd-new-project.md` or edit directly.

| Setting | Options | Default | What it controls |
|---------|---------|---------|------------------|
| `mode` | `yolo`, `interactive` | `interactive` | Auto-approve vs confirm at each step |
| `depth` | `quick`, `standard`, `comprehensive` | `standard` | Planning thoroughness |

### Model Profiles

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced` (default) | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |

---

## Upstream GSD

This project tracks [glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done). The upstream project supports Claude Code, OpenCode, and Gemini CLI natively. This port adapts the architecture specifically for Cline's CLI subagent model.

To check for upstream updates:
```
/gsd-sync-upstream.md
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**GSD for Cline — same structured workflow, different runtime.**

</div>
