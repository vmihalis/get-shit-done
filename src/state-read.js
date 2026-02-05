/**
 * State file parsing and reading for Cline-GSD
 *
 * Provides pure parsers for markdown state files (no I/O) and
 * file-reading wrappers that use the error-return pattern.
 *
 * Pure parsers: parseSections, parseStatePosition, parseRoadmapProgress, parsePlanFrontmatter
 * File readers: readState, readRoadmap, readPlanFrontmatter, readPlanningConfig
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Pure parsers (no I/O — operate on string content)
// ---------------------------------------------------------------------------

/**
 * Split markdown content by heading level into named sections.
 *
 * @param {string} content - Raw markdown text
 * @param {number} [level=2] - Heading level to split on (default: ## level 2)
 * @returns {Object<string, string>} Map of section name to trimmed content.
 *   Text before the first heading is stored under key '_preamble' (if non-empty).
 */
export function parseSections(content, level = 2) {
  const prefix = '#'.repeat(level);
  // Match lines like "## Section Name" at the correct heading level
  // Negative lookahead ensures we don't match ### when splitting on ##
  const regex = new RegExp(`^${prefix}(?!#)\\s+(.+)$`, 'gm');

  const sections = {};
  const matches = [...content.matchAll(regex)];

  if (matches.length === 0) {
    // No headings found — everything is preamble
    const trimmed = content.trim();
    if (trimmed) {
      sections._preamble = trimmed;
    }
    return sections;
  }

  // Text before the first heading
  const preamble = content.slice(0, matches[0].index).trim();
  if (preamble) {
    sections._preamble = preamble;
  }

  // Each heading owns the text until the next same-level heading
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const body = content.slice(start, end).trim();
    sections[name] = body;
  }

  return sections;
}

/**
 * Parse the "Current Position" block from STATE.md content.
 *
 * Expected line formats:
 *   Phase: 3 of 8 (State Management)
 *   Plan: 0 of 3 in current phase
 *   Status: Ready to plan
 *   Last activity: 2026-02-05 — Phase 2 complete, verified
 *   Progress: [███░░░░░░░] 25%
 *
 * @param {string} content - Raw text of the Current Position section (or full STATE.md)
 * @returns {Object|null} Parsed position object, or null if required fields not found
 */
export function parseStatePosition(content) {
  // Phase line: "Phase: N of M (Name)" or "Phase: N of M"
  const phaseMatch = content.match(/Phase:\s*(\d+)\s+of\s+(\d+)(?:\s*\((.+?)\))?/);
  if (!phaseMatch) return null;

  // Plan line: "Plan: N of M in current phase"
  const planMatch = content.match(/Plan:\s*(\d+)\s+of\s+(\d+)/);

  // Status line
  const statusMatch = content.match(/Status:\s*(.+)/);

  // Last activity line (handle both — and - separators)
  const activityMatch = content.match(/Last activity:\s*(.+)/);

  // Progress percentage from progress bar line
  const progressMatch = content.match(/Progress:\s*\[.*?\]\s*(\d+)%/);

  return {
    phaseNum: parseInt(phaseMatch[1], 10),
    totalPhases: parseInt(phaseMatch[2], 10),
    phaseName: phaseMatch[3] ? phaseMatch[3].trim() : null,
    planNum: planMatch ? parseInt(planMatch[1], 10) : 0,
    totalPlans: planMatch ? parseInt(planMatch[2], 10) : 0,
    status: statusMatch ? statusMatch[1].trim() : null,
    lastActivity: activityMatch ? activityMatch[1].trim() : null,
    progressPct: progressMatch ? parseInt(progressMatch[1], 10) : 0,
  };
}

/**
 * Parse the progress table from ROADMAP.md content.
 *
 * Expected row format:
 *   | 1. Installation & Foundation | 3/3 | Complete | 2026-02-05 |
 *
 * @param {string} content - Raw ROADMAP.md text
 * @returns {{phases: Array<Object>, totalPlans: number, completedPlans: number}}
 */
export function parseRoadmapProgress(content) {
  const rowRegex = /\|\s*(\d+)\.\s*(.+?)\s*\|\s*(\d+)\/(\d+)\s*\|\s*(\w[\w\s]*?)\s*\|\s*(.*?)\s*\|/g;

  const phases = [];
  let totalPlans = 0;
  let completedPlans = 0;

  let match;
  while ((match = rowRegex.exec(content)) !== null) {
    const completed = parseInt(match[3], 10);
    const total = parseInt(match[4], 10);

    phases.push({
      number: parseInt(match[1], 10),
      name: match[2].trim(),
      completedPlans: completed,
      totalPlans: total,
      status: match[5].trim(),
      completedDate: match[6].trim() || null,
    });

    totalPlans += total;
    completedPlans += completed;
  }

  return { phases, totalPlans, completedPlans };
}

/**
 * Parse YAML frontmatter from a PLAN.md file.
 *
 * Extracts top-level fields: phase, plan, type, wave, depends_on,
 * files_modified, autonomous. Does NOT deeply parse must_haves
 * (left as raw text for downstream consumers).
 *
 * Handles both inline arrays [a, b] and multi-line arrays (- item).
 *
 * @param {string} content - Raw PLAN.md text
 * @returns {Object|null} Parsed frontmatter object, or null if no frontmatter found
 */
export function parsePlanFrontmatter(content) {
  // Extract text between --- delimiters
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;

  const fmText = fmMatch[1];
  const result = {};

  // Scalar fields
  const scalarFields = ['phase', 'plan', 'type', 'wave', 'autonomous'];
  for (const field of scalarFields) {
    // Match only top-level (no leading whitespace) field: value
    const fieldMatch = fmText.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    if (fieldMatch) {
      const raw = fieldMatch[1].trim();
      // Parse booleans
      if (raw === 'true') {
        result[field] = true;
      } else if (raw === 'false') {
        result[field] = false;
      }
      // Parse integers
      else if (/^\d+$/.test(raw)) {
        result[field] = parseInt(raw, 10);
      }
      // String value
      else {
        result[field] = raw;
      }
    }
  }

  // Array fields: depends_on, files_modified
  const arrayFields = ['depends_on', 'files_modified'];
  for (const field of arrayFields) {
    const fieldMatch = fmText.match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
    if (fieldMatch) {
      const raw = fieldMatch[1].trim();

      // Inline array format: [item1, item2]
      if (raw.startsWith('[')) {
        const inner = raw.slice(1, -1).trim();
        if (inner === '') {
          result[field] = [];
        } else {
          result[field] = inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
        }
      }
      // Empty value — check for multi-line items on subsequent lines
      else if (raw === '' || raw === '[]') {
        if (raw === '[]') {
          result[field] = [];
        } else {
          // Collect multi-line "- item" entries
          const lines = fmText.split('\n');
          const fieldIndex = lines.findIndex((l) => l.match(new RegExp(`^${field}:`)));
          const items = [];
          if (fieldIndex >= 0) {
            for (let i = fieldIndex + 1; i < lines.length; i++) {
              const itemMatch = lines[i].match(/^\s+-\s+(.+)/);
              if (itemMatch) {
                items.push(itemMatch[1].trim().replace(/^["']|["']$/g, ''));
              } else if (/^\S/.test(lines[i])) {
                // Next top-level field — stop collecting
                break;
              }
            }
          }
          result[field] = items;
        }
      }
      // Single value without brackets
      else {
        result[field] = [raw.replace(/^["']|["']$/g, '')];
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// File readers (I/O with error-return pattern)
// ---------------------------------------------------------------------------

/**
 * Read and parse STATE.md from a planning directory.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @returns {Promise<{success: boolean, data?: {raw: string, sections: Object, position: Object|null}, error?: string}>}
 */
export async function readState(planningDir) {
  try {
    const filePath = path.join(planningDir, 'STATE.md');
    const raw = await readFile(filePath, 'utf-8');
    const sections = parseSections(raw);
    const positionContent = sections['Current Position'] || raw;
    const position = parseStatePosition(positionContent);
    return { success: true, data: { raw, sections, position } };
  } catch (err) {
    return { success: false, error: `Failed to read STATE.md: ${err.message}` };
  }
}

/**
 * Read and parse ROADMAP.md from a planning directory.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @returns {Promise<{success: boolean, data?: {raw: string, progress: Object}, error?: string}>}
 */
export async function readRoadmap(planningDir) {
  try {
    const filePath = path.join(planningDir, 'ROADMAP.md');
    const raw = await readFile(filePath, 'utf-8');
    const progress = parseRoadmapProgress(raw);
    return { success: true, data: { raw, progress } };
  } catch (err) {
    return { success: false, error: `Failed to read ROADMAP.md: ${err.message}` };
  }
}

/**
 * Read and parse PLAN.md frontmatter from a specific plan file.
 *
 * @param {string} planFilePath - Absolute path to a PLAN.md file
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function readPlanFrontmatter(planFilePath) {
  try {
    const raw = await readFile(planFilePath, 'utf-8');
    const frontmatter = parsePlanFrontmatter(raw);
    if (!frontmatter) {
      return { success: false, error: 'No frontmatter found in plan file' };
    }
    return { success: true, data: frontmatter };
  } catch (err) {
    return { success: false, error: `Failed to read plan file: ${err.message}` };
  }
}

/**
 * Read planning config from config.json, merging with defaults.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function readPlanningConfig(planningDir) {
  const defaults = {
    mode: 'yolo',
    depth: 'comprehensive',
    parallelization: true,
    commit_docs: true,
    model_profile: 'quality',
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
    gates: {
      plan_review: false,
      checkpoint_approval: true,
    },
    safety: {
      backup_before_execute: false,
      dry_run_first: false,
    },
  };

  try {
    const filePath = path.join(planningDir, 'config.json');
    const raw = await readFile(filePath, 'utf-8');
    const loaded = JSON.parse(raw);

    // Shallow merge top-level, deep merge nested objects
    const merged = { ...defaults };
    for (const key of Object.keys(loaded)) {
      if (
        typeof loaded[key] === 'object' &&
        loaded[key] !== null &&
        !Array.isArray(loaded[key]) &&
        typeof defaults[key] === 'object' &&
        defaults[key] !== null
      ) {
        merged[key] = { ...defaults[key], ...loaded[key] };
      } else {
        merged[key] = loaded[key];
      }
    }

    return { success: true, data: merged };
  } catch (err) {
    // If file doesn't exist or is invalid, return defaults
    if (err.code === 'ENOENT') {
      return { success: true, data: defaults };
    }
    return { success: false, error: `Failed to read config.json: ${err.message}` };
  }
}
