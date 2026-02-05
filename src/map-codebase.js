/**
 * Codebase mapping orchestration for Cline-GSD
 *
 * Coordinates parallel mapper agents that analyze a codebase and produce
 * structured documents in .planning/codebase/. This is the first consumer
 * of the agent infrastructure built in Phase 2.
 *
 * Exports: buildMapperPrompts, runMapping, getExpectedOutputFiles
 */

import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { spawnAgent, spawnAgents, waitForAgents } from './agent-spawn.js';
import { verifyOutputs, reportResults } from './agent-collect.js';
import { readPlanningConfig } from './state-read.js';

/**
 * Focus areas and their output documents.
 * Each mapper agent handles one focus area and writes its documents
 * directly to .planning/codebase/.
 */
const FOCUS_AREAS = [
  { focus: 'tech', files: ['STACK.md', 'INTEGRATIONS.md'] },
  { focus: 'arch', files: ['ARCHITECTURE.md', 'STRUCTURE.md'] },
  { focus: 'quality', files: ['CONVENTIONS.md', 'TESTING.md'] },
  { focus: 'concerns', files: ['CONCERNS.md'] },
];

/**
 * Get all expected output file paths for codebase mapping.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @returns {{ success: boolean, data: string[] }} Array of 7 absolute file paths
 */
export function getExpectedOutputFiles(planningDir) {
  try {
    const files = FOCUS_AREAS.flatMap((area) =>
      area.files.map((file) => path.join(planningDir, 'codebase', file))
    );
    return { success: true, data: files };
  } catch (err) {
    return { success: false, error: `Failed to compute output files: ${err.message}` };
  }
}

/**
 * Build prompts for each mapper agent.
 *
 * Each prompt references agents/gsd-codebase-mapper.md and specifies
 * the focus area and output file paths.
 *
 * @param {string} cwd - Project working directory
 * @returns {{ success: boolean, data: Array<{ prompt: string, outputFile: string, focus: string }> }}
 */
export function buildMapperPrompts(cwd) {
  try {
    const prompts = FOCUS_AREAS.map((area) => {
      const outputFiles = area.files.map((f) =>
        path.join('.planning', 'codebase', f)
      );

      const prompt = `You are a codebase mapper agent.

Read the agent definition at agents/gsd-codebase-mapper.md and follow the instructions for the "${area.focus}" focus area.

Your focus area: ${area.focus}
Write your output documents to:
${outputFiles.map((f) => `- ${f}`).join('\n')}

After writing, output a brief confirmation with file paths and line counts.`;

      return {
        prompt,
        outputFile: path.join('.planning', 'codebase', `.mapper-${area.focus}-done.txt`),
        focus: area.focus,
      };
    });

    return { success: true, data: prompts };
  } catch (err) {
    return { success: false, error: `Failed to build prompts: ${err.message}` };
  }
}

/**
 * Run the full codebase mapping pipeline.
 *
 * Orchestrates: spawn agents -> wait for completion -> verify outputs -> report.
 * Supports both parallel (default) and sequential execution modes.
 *
 * @param {string} projectRoot - Project root directory
 * @param {object} [options] - Pipeline options
 * @param {number} [options.timeout=300000] - Per-agent timeout in ms (default: 5 min)
 * @param {boolean} [options.parallel=true] - Run agents in parallel
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function runMapping(projectRoot, options = {}) {
  const timeout = options.timeout ?? 300000;
  const parallel = options.parallel ?? true;

  try {
    const planningDir = path.join(projectRoot, '.planning');

    // Create output directory
    await mkdir(path.join(planningDir, 'codebase'), { recursive: true });

    // Build prompts
    const promptResult = buildMapperPrompts(projectRoot);
    if (!promptResult.success) {
      return { success: false, error: promptResult.error };
    }
    const prompts = promptResult.data;

    // Spawn and wait for agents
    let results;

    if (parallel) {
      // Parallel: spawn all 4 agents at once
      const spawned = spawnAgents(
        prompts.map((p) => ({
          prompt: p.prompt,
          outputFile: p.outputFile,
          timeout,
          cwd: projectRoot,
        }))
      );
      results = await waitForAgents(spawned, { timeout });
    } else {
      // Sequential: run agents one at a time
      results = [];
      for (const prompt of prompts) {
        const agent = spawnAgent(prompt.prompt, {
          outputFile: prompt.outputFile,
          timeout,
          cwd: projectRoot,
        });
        const [result] = await waitForAgents(
          [{ ...agent, outputFile: prompt.outputFile }],
          { timeout }
        );
        results.push(result);
      }
    }

    // Verify expected output files exist
    const filesResult = getExpectedOutputFiles(planningDir);
    if (!filesResult.success) {
      return { success: false, error: filesResult.error };
    }
    const expectedFiles = filesResult.data;

    const verifications = await verifyOutputs(expectedFiles);
    const report = reportResults(verifications);

    return {
      success: report.found > 0,
      data: {
        report: report.report,
        total: report.total,
        found: report.found,
        missing: report.missing,
        verifications,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
