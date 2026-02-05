/**
 * Project initialization helpers for Cline-GSD
 *
 * Provides functions to generate populated PROJECT.md and config.json
 * files during the /gsd-new-project.md workflow. These helpers ensure
 * consistent template structure and correct defaults merging.
 *
 * Self-contained module -- does NOT import from state-init.js to avoid
 * circular dependency risk. Default config values are intentionally
 * duplicated (same pattern as state-read.js).
 *
 * Exports: writeProjectMd, writeConfigJson
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Write a fully populated PROJECT.md from gathered project context.
 *
 * Generates a PROJECT.md matching the upstream GSD template structure
 * with all sections filled from the provided project object, instead
 * of placeholder text.
 *
 * @param {string} planningDir - Absolute or relative path to .planning/ directory
 * @param {object} project - Gathered project context
 * @param {string} project.name - Project display name
 * @param {string} project.description - 2-3 sentence description of the project
 * @param {string} project.coreValue - One-line core value statement
 * @param {string} project.context - Why this project exists, key background
 * @param {string[]} project.constraints - Technical, business, or timeline constraints
 * @param {object} [project.requirements] - Optional requirements breakdown
 * @param {string[]} [project.requirements.validated] - Requirements confirmed during questioning
 * @param {string[]} [project.requirements.active] - Requirements being worked on
 * @param {string[]} [project.requirements.outOfScope] - Explicitly excluded features
 * @param {Array<{decision: string, rationale: string, outcome: string}>} [project.keyDecisions] - Optional key decisions
 * @param {string} [project.date] - Date string (YYYY-MM-DD), defaults to today
 * @returns {Promise<{success: boolean, data?: {path: string}, error?: string}>}
 */
export async function writeProjectMd(planningDir, project) {
  try {
    const date = project.date || new Date().toISOString().split('T')[0];

    // Build constraints list
    const constraintsList = (project.constraints || [])
      .map(function (c) { return `- ${c}`; })
      .join('\n') || '(No constraints specified)';

    // Build requirements sections
    const requirements = project.requirements || {};

    const validatedList = (requirements.validated || [])
      .map(function (r) { return `- ${r}`; })
      .join('\n') || '(Requirements confirmed during questioning)';

    const activeList = (requirements.active || [])
      .map(function (r) { return `- ${r}`; })
      .join('\n') || '(Requirements being worked on)';

    const outOfScopeList = (requirements.outOfScope || [])
      .map(function (r) { return `- ${r}`; })
      .join('\n') || '(Explicitly excluded features)';

    // Build key decisions table rows
    let decisionsRows = '';
    if (project.keyDecisions && project.keyDecisions.length > 0) {
      decisionsRows = project.keyDecisions
        .map(function (d) {
          return `| ${d.decision} | ${d.rationale} | ${d.outcome} |`;
        })
        .join('\n');
    }

    const content = `# ${project.name}

## What This Is

${project.description}

## Core Value

${project.coreValue}

## Requirements

### Validated

${validatedList}

### Active

${activeList}

### Out of Scope

${outOfScopeList}

## Context

${project.context}

## Constraints

${constraintsList}

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
${decisionsRows}

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
 * Write config.json with user preferences merged onto full upstream defaults.
 *
 * Starts from the complete set of upstream GSD config defaults, then
 * overlays user preferences. For nested objects (workflow, planning,
 * gates, safety), performs a shallow merge (spread defaults then user
 * values). For scalar values, performs a direct replace.
 *
 * @param {string} planningDir - Absolute or relative path to .planning/ directory
 * @param {object} [preferences] - User-selected preferences to overlay
 * @param {string} [preferences.mode] - 'yolo' | 'interactive'
 * @param {string} [preferences.depth] - 'quick' | 'standard' | 'comprehensive'
 * @param {boolean} [preferences.parallelization] - Enable parallel agent spawning
 * @param {boolean} [preferences.commit_docs] - Git commit planning docs
 * @param {string} [preferences.model_profile] - 'quality' | 'balanced' | 'budget'
 * @param {object} [preferences.workflow] - Workflow toggles (research, plan_check, verifier)
 * @param {object} [preferences.planning] - Planning settings (max_tasks_per_plan, etc.)
 * @param {object} [preferences.gates] - Gate settings (plan_review, checkpoint_approval)
 * @param {object} [preferences.safety] - Safety settings (backup_before_execute, dry_run_first)
 * @returns {Promise<{success: boolean, data?: {path: string}, error?: string}>}
 */
export async function writeConfigJson(planningDir, preferences) {
  try {
    const userPrefs = preferences || {};

    // Full upstream defaults (intentionally duplicated from state-init.js
    // and state-read.js to keep this module self-contained)
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

    // Overlay user preferences onto defaults
    for (const key of Object.keys(userPrefs)) {
      const value = userPrefs[key];

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof config[key] === 'object' &&
        config[key] !== null
      ) {
        // Shallow merge for nested objects
        config[key] = { ...config[key], ...value };
      } else {
        // Direct replace for scalars
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
