/**
 * State initialization module for Cline-GSD
 * Creates .planning/ directory structure and populates template files
 * matching upstream GSD format exactly.
 *
 * Pure file I/O module — no terminal output imports.
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

/**
 * Render a progress bar string from completion counts.
 * @param {number} completedPlans - Number of plans completed
 * @param {number} totalPlans - Total number of plans
 * @returns {string} Progress bar like "[███░░░░░░░] 30%"
 */
export function renderProgressBar(completedPlans, totalPlans) {
  const pct = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${pct}%`;
}

/**
 * Slugify a name for use in directory names.
 * Lowercase, replace non-alphanumeric with hyphens, trim leading/trailing hyphens.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Check if a file or directory exists.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the .planning/ directory and .planning/phases/ subdirectory exist.
 * Does NOT create codebase/, research/, todos/, or debug/ — those are
 * created on-demand by their respective commands per upstream behavior.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @returns {Promise<{success: boolean, data?: {planningDir: string}, error?: string}>}
 */
export async function ensurePlanningDir(projectRoot) {
  try {
    const planningDir = path.join(projectRoot, '.planning');
    const phasesDir = path.join(planningDir, 'phases');

    await mkdir(phasesDir, { recursive: true });

    return { success: true, data: { planningDir } };
  } catch (err) {
    return { success: false, error: `Failed to create .planning/ directory: ${err.message}` };
  }
}

/**
 * Ensure a phase subdirectory exists under .planning/phases/.
 * Creates .planning/phases/XX-kebab-name/ with zero-padded phase number.
 *
 * @param {string} planningDir - Absolute path to .planning/ directory
 * @param {number} phaseNum - Phase number (will be zero-padded to 2 digits)
 * @param {string} phaseName - Phase name (will be slugified)
 * @returns {Promise<{success: boolean, data?: {phaseDir: string, dirName: string}, error?: string}>}
 */
export async function ensurePhaseDir(planningDir, phaseNum, phaseName) {
  try {
    const paddedNum = String(phaseNum).padStart(2, '0');
    const slug = slugify(phaseName);
    const dirName = `${paddedNum}-${slug}`;
    const phaseDir = path.join(planningDir, 'phases', dirName);

    await mkdir(phaseDir, { recursive: true });

    return { success: true, data: { phaseDir, dirName } };
  } catch (err) {
    return { success: false, error: `Failed to create phase directory: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Template strings
// ---------------------------------------------------------------------------

/**
 * Generate STATE.md content matching upstream GSD format.
 * Sections: Project Reference, Current Position, Performance Metrics,
 *           Accumulated Context, Session Continuity
 */
function stateTemplate({ projectName, coreValue, totalPhases, currentPhase, date }) {
  const progress = renderProgressBar(0, 0);
  return `# Project State

## Project Reference

See: .planning/PROJECT.md (updated ${date})

**Core value:** ${coreValue}
**Current focus:** Phase ${currentPhase} of ${totalPhases}

## Current Position

Phase: ${currentPhase} of ${totalPhases}
Plan: 0 of 0 in current phase
Status: Initializing
Last activity: ${date} — Project initialized

Progress: ${progress}

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|

**Recent Trend:**
- No data yet

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

(none yet)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: ${date}
Stopped at: Project initialized
Resume file: None
`;
}

/**
 * Generate config.json content with full upstream structure.
 */
function configTemplate() {
  return {
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
}

/**
 * Generate PROJECT.md skeleton.
 */
function projectTemplate({ projectName, coreValue, date }) {
  return `# ${projectName}

## What This Is

(Describe the project in 2-3 sentences)

## Core Value

${coreValue}

## Requirements

### Validated

(Requirements confirmed during questioning)

### Active

(Requirements being worked on)

### Out of Scope

(Explicitly excluded features)

## Context

(Why this project exists, key background)

## Constraints

(Technical, business, or timeline constraints)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|

---
*Last updated: ${date}*
`;
}

/**
 * Generate REQUIREMENTS.md skeleton.
 */
function requirementsTemplate({ projectName, coreValue, date }) {
  return `# Requirements: ${projectName}

**Defined:** ${date}
**Core Value:** ${coreValue}

## v1 Requirements

(Requirements for initial release)

## Out of Scope

| Feature | Reason |
|---------|--------|

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|

---
*Requirements defined: ${date}*
`;
}

/**
 * Generate ROADMAP.md skeleton.
 */
function roadmapTemplate({ projectName, totalPhases, date }) {
  return `# Roadmap: ${projectName}

## Overview

(High-level project roadmap description)

## Phases

(List phases with checkmarks)

## Phase Details

(Detailed phase breakdowns will be added during planning)

## Progress

**Execution Order:**
Phases execute in numeric order: ${Array.from({ length: totalPhases }, (_, i) => i + 1).join(' -> ')}

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|

---
*Roadmap created: ${date}*
*Last updated: ${date}*
`;
}

/**
 * Initialize project template files in the .planning/ directory.
 * Only creates files that don't already exist (idempotent).
 *
 * @param {string} planningDir - Absolute path to .planning/ directory
 * @param {object} options - Template values
 * @param {string} options.projectName - Project display name
 * @param {string} options.coreValue - One-line core value statement
 * @param {number} options.totalPhases - Total number of phases in roadmap
 * @param {number} options.currentPhase - Current phase number
 * @param {string} [options.date] - Date string (YYYY-MM-DD), defaults to today
 * @returns {Promise<{success: boolean, data?: {created: string[], skipped: string[]}, error?: string}>}
 */
export async function initProjectFiles(planningDir, options) {
  try {
    const date = options.date || new Date().toISOString().split('T')[0];
    const opts = { ...options, date };

    const created = [];
    const skipped = [];

    // Define files to create: [filename, content]
    const files = [
      ['STATE.md', stateTemplate(opts)],
      ['config.json', JSON.stringify(configTemplate(), null, 2) + '\n'],
      ['PROJECT.md', projectTemplate(opts)],
      ['REQUIREMENTS.md', requirementsTemplate(opts)],
      ['ROADMAP.md', roadmapTemplate(opts)],
    ];

    for (const [filename, content] of files) {
      const filePath = path.join(planningDir, filename);

      if (await exists(filePath)) {
        skipped.push(filename);
      } else {
        await writeFile(filePath, content, 'utf-8');
        created.push(filename);
      }
    }

    return { success: true, data: { created, skipped } };
  } catch (err) {
    return { success: false, error: `Failed to initialize project files: ${err.message}` };
  }
}
