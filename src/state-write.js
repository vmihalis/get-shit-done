/**
 * State file update operations for Cline-GSD
 *
 * Provides read-modify-write functions for STATE.md and ROADMAP.md.
 * Every function reads the current file content, modifies only the
 * targeted section/line, and writes back the full file to avoid
 * data loss.
 *
 * Exports: updateStateSection, updateStatePosition, updateRoadmapProgress, updatePlanCheckbox
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseSections, parseRoadmapProgress } from './state-read.js';
import { renderProgressBar } from './state-init.js';

/**
 * Update a specific ## section in STATE.md, preserving all other sections.
 *
 * Uses parseSections() to locate the heading, then rebuilds the file
 * with the new content for that section while keeping everything else
 * byte-for-byte identical.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @param {string} sectionName - The ## heading name (e.g. "Pending Todos")
 * @param {string} newContent - New body content for the section (without heading)
 * @returns {Promise<{success: boolean, data?: {updated: boolean}, error?: string}>}
 */
export async function updateStateSection(planningDir, sectionName, newContent) {
  try {
    const filePath = path.join(planningDir, 'STATE.md');
    const raw = await readFile(filePath, 'utf-8');

    // Find the ## heading for sectionName
    const headingRegex = new RegExp(
      `^(## ${escapeRegex(sectionName)})[ \\t]*\\r?\\n`,
      'm'
    );
    const headingMatch = raw.match(headingRegex);

    if (!headingMatch) {
      return { success: false, error: `Section "## ${sectionName}" not found in STATE.md` };
    }

    const sectionStart = headingMatch.index;
    const contentStart = sectionStart + headingMatch[0].length;

    // Find the next ## heading (same level) or end of file
    const nextHeadingRegex = /^## (?!#)/m;
    const remainder = raw.slice(contentStart);
    const nextMatch = remainder.match(nextHeadingRegex);

    let sectionEnd;
    if (nextMatch) {
      sectionEnd = contentStart + nextMatch.index;
    } else {
      sectionEnd = raw.length;
    }

    // Rebuild the file: before + heading + new content + after
    const before = raw.slice(0, contentStart);
    const after = raw.slice(sectionEnd);

    // Ensure proper spacing: newline after heading, content, double newline before next section
    const updated = before + '\n' + newContent.trim() + '\n\n' + after;

    await writeFile(filePath, updated, 'utf-8');
    return { success: true, data: { updated: true } };
  } catch (err) {
    return { success: false, error: `Failed to update STATE.md section: ${err.message}` };
  }
}

/**
 * Update the Current Position section in STATE.md with new position values.
 *
 * Performs line-by-line replacement of Phase, Plan, Status, Last activity,
 * and Progress lines. Also updates the "Current focus" line in the
 * Project Reference section if present.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @param {object} position - Position fields to update
 * @param {number} position.phaseNum - Current phase number
 * @param {number} position.totalPhases - Total number of phases
 * @param {string} [position.phaseName] - Phase display name
 * @param {number} position.planNum - Current plan number within phase
 * @param {number} position.totalPlans - Total plans in current phase
 * @param {string} position.status - Status string (e.g. "In progress")
 * @param {string} position.lastActivity - Last activity description
 * @param {number} position.completedPlans - Total completed plans globally
 * @param {number} position.totalPlansGlobal - Total plans globally
 * @returns {Promise<{success: boolean, data?: {updated: boolean}, error?: string}>}
 */
export async function updateStatePosition(planningDir, position) {
  try {
    const filePath = path.join(planningDir, 'STATE.md');
    let content = await readFile(filePath, 'utf-8');

    const {
      phaseNum,
      totalPhases,
      phaseName,
      planNum,
      totalPlans,
      status,
      lastActivity,
      completedPlans,
      totalPlansGlobal,
    } = position;

    // Update Phase line
    const phaseStr = phaseName
      ? `Phase: ${phaseNum} of ${totalPhases} (${phaseName})`
      : `Phase: ${phaseNum} of ${totalPhases}`;
    content = content.replace(
      /^Phase:\s*\d+\s+of\s+\d+.*$/m,
      phaseStr
    );

    // Update Plan line
    content = content.replace(
      /^Plan:\s*\d+\s+of\s+\d+.*$/m,
      `Plan: ${planNum} of ${totalPlans} in current phase`
    );

    // Update Status line
    content = content.replace(
      /^Status:\s*.+$/m,
      `Status: ${status}`
    );

    // Update Last activity line
    content = content.replace(
      /^Last activity:\s*.+$/m,
      `Last activity: ${lastActivity}`
    );

    // Update Progress line with rendered bar
    const progressBar = renderProgressBar(completedPlans, totalPlansGlobal);
    content = content.replace(
      /^Progress:\s*\[.*?\]\s*\d+%$/m,
      `Progress: ${progressBar}`
    );

    // Update "Current focus" line in Project Reference if present
    if (phaseName) {
      content = content.replace(
        /^\*\*Current focus:\*\*\s*.+$/m,
        `**Current focus:** Phase ${phaseNum} - ${phaseName}`
      );
    }

    await writeFile(filePath, content, 'utf-8');
    return { success: true, data: { updated: true } };
  } catch (err) {
    return { success: false, error: `Failed to update STATE.md position: ${err.message}` };
  }
}

/**
 * Update a specific phase row in the ROADMAP.md progress table.
 *
 * Finds the table row matching the phase number and updates the
 * Plans Complete, Status, and Completed columns while preserving
 * the phase name exactly as-is.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @param {number} phaseNum - Phase number to update
 * @param {number} completedPlans - Number of completed plans
 * @param {number} totalPlans - Total plans in phase
 * @param {string} status - Status string (e.g. "Complete", "In progress")
 * @param {string|null} completedDate - Completion date string or null/"-"
 * @returns {Promise<{success: boolean, data?: {updated: boolean}, error?: string}>}
 */
export async function updateRoadmapProgress(planningDir, phaseNum, completedPlans, totalPlans, status, completedDate) {
  try {
    const filePath = path.join(planningDir, 'ROADMAP.md');
    let content = await readFile(filePath, 'utf-8');

    // Match the specific phase row in the progress table
    // Format: | N. Phase Name | X/Y | Status | Date |
    const rowRegex = new RegExp(
      `(\\|\\s*${phaseNum}\\.\\s*.+?\\s*\\|)\\s*\\d+/\\d+\\s*\\|\\s*\\w[\\w\\s]*?\\s*\\|\\s*.*?\\s*\\|`,
      'm'
    );

    const match = content.match(rowRegex);
    if (!match) {
      return { success: false, error: `Phase ${phaseNum} row not found in ROADMAP.md progress table` };
    }

    // Preserve the phase name part (group 1), replace the rest
    const dateStr = completedDate || '-';
    const newRow = `${match[1]} ${completedPlans}/${totalPlans} | ${status} | ${dateStr} |`;

    content = content.replace(match[0], newRow);

    await writeFile(filePath, content, 'utf-8');
    return { success: true, data: { updated: true } };
  } catch (err) {
    return { success: false, error: `Failed to update ROADMAP.md progress: ${err.message}` };
  }
}

/**
 * Toggle a plan checkbox in ROADMAP.md.
 *
 * Finds the line matching "- [ ] XX-NN-PLAN.md" or "- [x] XX-NN-PLAN.md"
 * and sets the checkbox state based on the checked parameter.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @param {number} phaseNum - Phase number (zero-padded to 2 digits)
 * @param {number} planNum - Plan number (zero-padded to 2 digits)
 * @param {boolean} checked - true for [x], false for [ ]
 * @returns {Promise<{success: boolean, data?: {updated: boolean}, error?: string}>}
 */
export async function updatePlanCheckbox(planningDir, phaseNum, planNum, checked) {
  try {
    const filePath = path.join(planningDir, 'ROADMAP.md');
    let content = await readFile(filePath, 'utf-8');

    const paddedPhase = String(phaseNum).padStart(2, '0');
    const paddedPlan = String(planNum).padStart(2, '0');
    const planId = `${paddedPhase}-${paddedPlan}`;

    // Match either "- [ ] XX-NN-PLAN.md" or "- [x] XX-NN-PLAN.md"
    // Allow flexible content after the plan ID (description, etc.)
    const checkboxRegex = new RegExp(
      `^(\\s*- \\[)[ x](\\]\\s+${escapeRegex(planId)}(?:-PLAN\\.md|\\b).*)$`,
      'm'
    );

    const match = content.match(checkboxRegex);
    if (!match) {
      return { success: false, error: `Plan checkbox for ${planId} not found in ROADMAP.md` };
    }

    const mark = checked ? 'x' : ' ';
    content = content.replace(match[0], `${match[1]}${mark}${match[2]}`);

    await writeFile(filePath, content, 'utf-8');
    return { success: true, data: { updated: true } };
  } catch (err) {
    return { success: false, error: `Failed to update plan checkbox: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
