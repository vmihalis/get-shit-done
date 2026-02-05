---
description: Documents the parallel agent spawning pattern used by GSD workflows
---

# GSD Agent Spawning Pattern

This document describes the parallel CLI subagent spawning pattern used by GSD workflows. Reference this when implementing multi-agent workflows like codebase mapping or research.

## Overview

GSD uses parallel CLI subagents for read-only research and mapping tasks. The main Cline context spawns multiple `cline` processes in the background, each writing their output to designated files in `.planning/`. After all agents complete, the orchestrator reads and synthesizes their outputs.

**Key principle:** Agents write to files, not stdout. This enables persistent outputs, human review, and resumed workflows.

## Spawning Pattern (Unix/Mac/Linux)

```bash
# Spawn agents in background, capture PIDs
cline -y "Analyze the technology stack and write to .planning/codebase/STACK.md" &
PID1=$!

cline -y "Analyze the architecture and write to .planning/codebase/ARCHITECTURE.md" &
PID2=$!

cline -y "Analyze code conventions and write to .planning/codebase/CONVENTIONS.md" &
PID3=$!
```

The `-y` flag enables headless mode (auto-approves actions). The `&` sends the process to background. `$!` captures the PID of the last background job.

## Waiting Pattern

```bash
# Wait for all agents to complete
FAIL=0
for pid in $PID1 $PID2 $PID3; do
  wait $pid || let "FAIL+=1"
done

# Check results
if [ $FAIL -gt 0 ]; then
  echo "Warning: $FAIL agents failed"
fi
```

The `wait` command blocks until the specified process completes and returns its exit code.

## File Output Convention

Agents write their outputs to `.planning/` subdirectories based on purpose:

```
.planning/
├── codebase/           # Mapping agent outputs
│   ├── STACK.md        # Technology stack analysis
│   ├── ARCHITECTURE.md # Architecture patterns
│   ├── STRUCTURE.md    # Directory structure
│   ├── CONVENTIONS.md  # Code conventions
│   └── CONCERNS.md     # Technical debt, issues
├── research/           # Research agent outputs
│   ├── ECOSYSTEM.md    # Library/tool research
│   └── FEASIBILITY.md  # Technical feasibility
└── phases/
    └── XX-name/        # Phase-specific work
        └── XX-RESEARCH.md
```

**Convention:** Files are named by content type, not timestamps. Re-running an agent overwrites the previous output.

## Cross-Platform Note

**Windows PowerShell equivalent:**

```powershell
# Spawn agents in parallel
$processes = @()
$processes += Start-Process -FilePath "cline" -ArgumentList '-y "Analyze stack..."' -PassThru -NoNewWindow
$processes += Start-Process -FilePath "cline" -ArgumentList '-y "Analyze architecture..."' -PassThru -NoNewWindow

# Wait for all to complete
$processes | ForEach-Object { $_ | Wait-Process }

# Check exit codes
$failures = ($processes | Where-Object { $_.ExitCode -ne 0 }).Count
```

For cross-platform consistency, use the Node.js module at `src/agent-spawn.js` which handles platform differences automatically.

## Full Example: Parallel Mapping Agents

This example spawns 3 mapping agents to analyze a codebase:

```bash
#!/bin/bash
# GSD Codebase Mapping - Parallel Agent Spawn

# Ensure output directory exists
mkdir -p .planning/codebase

# Spawn mapping agents in parallel
cline -y "You are a GSD stack mapper. Analyze package.json, requirements, and build files. Write a comprehensive STACK.md to .planning/codebase/STACK.md covering: languages, frameworks, dependencies, build tools." &
PID1=$!

cline -y "You are a GSD architecture mapper. Analyze the codebase structure and patterns. Write ARCHITECTURE.md to .planning/codebase/ARCHITECTURE.md covering: layers, data flow, key abstractions, external integrations." &
PID2=$!

cline -y "You are a GSD conventions mapper. Analyze code style and patterns. Write CONVENTIONS.md to .planning/codebase/CONVENTIONS.md covering: naming, file organization, error handling, testing patterns." &
PID3=$!

echo "Spawned 3 mapping agents (PIDs: $PID1, $PID2, $PID3)"

# Wait for all agents
FAIL=0
for pid in $PID1 $PID2 $PID3; do
  wait $pid || let "FAIL+=1"
done

# Report results
echo "All agents complete"
if [ $FAIL -gt 0 ]; then
  echo "WARNING: $FAIL agents failed"
fi

# Verify outputs
for file in STACK.md ARCHITECTURE.md CONVENTIONS.md; do
  if [ -f ".planning/codebase/$file" ]; then
    lines=$(wc -l < ".planning/codebase/$file")
    echo "OK: $file ($lines lines)"
  else
    echo "MISSING: $file"
  fi
done
```

## Node.js Module

For programmatic spawning, use the `src/agent-spawn.js` module:

```javascript
import { spawnAgent, spawnAgents, waitForAgents } from './src/agent-spawn.js';

// Single agent
const { pid, process } = spawnAgent('Analyze stack', {
  outputFile: '.planning/codebase/STACK.md',
  timeout: 300000, // 5 minutes
});

// Multiple agents in parallel
const agents = spawnAgents([
  { prompt: 'Analyze stack', outputFile: '.planning/codebase/STACK.md' },
  { prompt: 'Analyze architecture', outputFile: '.planning/codebase/ARCHITECTURE.md' },
  { prompt: 'Analyze conventions', outputFile: '.planning/codebase/CONVENTIONS.md' },
]);

// Wait for all to complete
const results = await waitForAgents(agents);
const failures = results.filter(r => !r.success).length;
console.log(`Completed with ${failures} failures`);
```

## Best Practices

1. **Capture PIDs immediately** - Store `$!` right after each `&`
2. **Scope tasks narrowly** - Each agent should have a focused, completable task
3. **Use file outputs** - Don't rely on stdout for results
4. **Handle failures** - Check exit codes, don't assume success
5. **Verify outputs** - Confirm files exist before reading them
6. **Avoid race conditions** - Wait for completion before reading output files

## Anti-Patterns

- Parsing stdout for results (use files instead)
- Single agent for all work (parallelize independent tasks)
- Ignoring exit codes (agents can fail)
- Reading files before wait completes (race condition)
- Sequential spawning (use `&` for parallelism)

---

*Part of Cline-GSD agent infrastructure*
