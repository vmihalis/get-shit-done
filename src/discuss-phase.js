/**
 * Discuss-phase helpers for Cline-GSD
 *
 * Provides phase detail extraction from ROADMAP.md and the canonical
 * CONTEXT.md template structure used by all downstream planning agents.
 *
 * Exports: getPhaseDetails, getContextTemplateSections, getOrCreatePhaseDir
 */

import { readRoadmap } from './state-read.js';
import { ensurePhaseDir } from './state-init.js';

/**
 * Read ROADMAP.md and extract details for a specific phase.
 *
 * Parses the "### Phase N: Name" section to find the phase goal,
 * requirements, and success criteria.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @param {number} phaseNum - Phase number to extract
 * @returns {Promise<{success: boolean, data?: {name: string, details: string, requirements: string, successCriteria: string[]}, error?: string}>}
 */
export async function getPhaseDetails(planningDir, phaseNum) {
  try {
    const roadmapResult = await readRoadmap(planningDir);
    if (!roadmapResult.success) {
      return { success: false, error: roadmapResult.error };
    }

    const raw = roadmapResult.data.raw;

    // Match the phase section header: ### Phase N: Name
    const headerRegex = new RegExp(
      `^### Phase ${phaseNum}:\\s*(.+)$`,
      'm'
    );
    const headerMatch = raw.match(headerRegex);
    if (!headerMatch) {
      return { success: false, error: `Phase ${phaseNum} not found in ROADMAP.md` };
    }

    const phaseName = headerMatch[1].trim();
    const headerStart = headerMatch.index;

    // Find the end of this phase section (next ### or end of file)
    const nextSectionRegex = /^### Phase \d+:/m;
    const afterHeader = raw.slice(headerStart + headerMatch[0].length);
    const nextMatch = afterHeader.match(nextSectionRegex);
    const phaseSection = nextMatch
      ? afterHeader.slice(0, nextMatch.index).trim()
      : afterHeader.trim();

    // Extract Goal line
    const goalMatch = phaseSection.match(/\*\*Goal\*\*:\s*(.+)/);
    const goal = goalMatch ? goalMatch[1].trim() : '';

    // Extract Requirements line
    const reqMatch = phaseSection.match(/\*\*Requirements\*\*:\s*(.+)/);
    const requirements = reqMatch ? reqMatch[1].trim() : '';

    // Extract Success Criteria block
    const criteriaLines = [];
    const criteriaHeaderMatch = phaseSection.match(
      /\*\*Success Criteria\*\*[^:]*:/
    );
    if (criteriaHeaderMatch) {
      const afterCriteria = phaseSection.slice(
        criteriaHeaderMatch.index + criteriaHeaderMatch[0].length
      );
      const lines = afterCriteria.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Numbered criteria lines like "  1. Something"
        if (/^\d+\.\s+/.test(trimmed)) {
          criteriaLines.push(trimmed.replace(/^\d+\.\s+/, '').trim());
        } else if (trimmed === '' || trimmed.startsWith('**')) {
          // Empty line or next bold field — stop collecting
          if (criteriaLines.length > 0) break;
        }
      }
    }

    // Build full details string for display
    const details = [
      `**Goal**: ${goal}`,
      requirements ? `**Requirements**: ${requirements}` : '',
      criteriaLines.length > 0
        ? `**Success Criteria**:\n${criteriaLines.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      success: true,
      data: {
        name: phaseName,
        details,
        requirements,
        successCriteria: criteriaLines,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get phase details: ${err.message}` };
  }
}

/**
 * Return the canonical CONTEXT.md section structure.
 *
 * This ensures both discuss-phase and plan-phase agree on the schema.
 * The template includes placeholder instructions that the workflow
 * replaces with actual user-provided content.
 *
 * @returns {{success: boolean, data: {sections: string[], template: string}}}
 */
export function getContextTemplateSections() {
  const sections = ['Decisions', "Claude's Discretion", 'Deferred Ideas'];

  const template = `# Phase {N}: {Name} - Context

**Discussed:** {date}

## Decisions
{user decisions listed as bullet points}

## Claude's Discretion
{areas where Claude can decide freely}

## Deferred Ideas
{ideas explicitly deferred to later phases}
`;

  return {
    success: true,
    data: { sections, template },
  };
}

/**
 * Ensure a phase directory exists under .planning/phases/.
 *
 * Thin wrapper around ensurePhaseDir() from state-init.js so the
 * discuss-phase workflow only needs to import from one module.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @param {number} phaseNum - Phase number (zero-padded to 2 digits)
 * @param {string} phaseName - Phase name (will be slugified)
 * @returns {Promise<{success: boolean, data?: {phaseDir: string, dirName: string}, error?: string}>}
 */
export async function getOrCreatePhaseDir(planningDir, phaseNum, phaseName) {
  return ensurePhaseDir(planningDir, phaseNum, phaseName);
}
