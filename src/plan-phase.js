/**
 * Planning phase orchestration for Cline-GSD
 *
 * Coordinates a sequential agent pipeline (research -> plan -> check) to
 * produce validated PLAN.md files for a phase. Each stage is config-gated
 * and builds on the previous agent's output.
 *
 * Exports: buildResearchPrompt, buildPlannerPrompt, buildCheckerPrompt,
 *          getExpectedPlanFiles, runPlanningPipeline
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { spawnAgent, waitForAgents } from './agent-spawn.js';
import { verifyOutputs, reportResults } from './agent-collect.js';
import { readPlanningConfig } from './state-read.js';
import { ensurePhaseDir } from './state-init.js';

/**
 * Model recommendations by profile for advisory logging.
 * These are suggestions only -- the actual model is determined by the
 * Cline CLI configuration, not by this module.
 */
const MODEL_RECOMMENDATIONS = {
  quality:  { researcher: 'sonnet', planner: 'opus', checker: 'sonnet' },
  balanced: { researcher: 'haiku',  planner: 'sonnet', checker: 'haiku' },
  budget:   { researcher: 'haiku',  planner: 'sonnet', checker: 'haiku' },
};

/**
 * Zero-pad a phase number to 2 digits.
 * @param {number} phaseNum
 * @returns {string}
 */
function padPhase(phaseNum) {
  return String(phaseNum).padStart(2, '0');
}

/**
 * Build the prompt for the researcher agent.
 *
 * The researcher gathers domain knowledge, explores the codebase, and
 * produces a RESEARCH.md document that informs the planner.
 *
 * @param {number} phaseNum - Phase number
 * @param {string} phaseName - Phase display name
 * @param {string} phaseDetails - Full phase details from ROADMAP.md
 * @param {string|null} contextContent - CONTEXT.md content (may be null)
 * @param {string} phaseDir - Absolute path to phase directory
 * @returns {{ success: boolean, data?: { prompt: string, outputFile: string }, error?: string }}
 */
export function buildResearchPrompt(phaseNum, phaseName, phaseDetails, contextContent, phaseDir) {
  try {
    const paddedPhase = padPhase(phaseNum);
    const outputFile = path.join(phaseDir, `${paddedPhase}-RESEARCH.md`);

    const contextSection = contextContent
      ? `<user_decisions>\n${contextContent}\n</user_decisions>`
      : 'No CONTEXT.md exists for this phase. Research broadly.';

    const prompt = `You are a phase researcher agent.

Read the agent definition at agents/gsd-phase-researcher.md and follow its instructions.

Phase ${phaseNum}: ${phaseName}

<phase_details>
${phaseDetails}
</phase_details>

${contextSection}

Write your research output to: ${outputFile}`;

    return { success: true, data: { prompt, outputFile } };
  } catch (err) {
    return { success: false, error: `Failed to build research prompt: ${err.message}` };
  }
}

/**
 * Build the prompt for the planner agent.
 *
 * The planner creates PLAN.md files with atomic tasks for the phase,
 * informed by research output and user context decisions.
 *
 * @param {number} phaseNum - Phase number
 * @param {string} phaseName - Phase display name
 * @param {string} phaseDetails - Full phase details from ROADMAP.md
 * @param {string|null} contextContent - CONTEXT.md content (may be null)
 * @param {string|null} researchContent - RESEARCH.md content (may be null)
 * @param {string} phaseDir - Absolute path to phase directory
 * @returns {{ success: boolean, data?: { prompt: string, outputFile: string }, error?: string }}
 */
export function buildPlannerPrompt(phaseNum, phaseName, phaseDetails, contextContent, researchContent, phaseDir) {
  try {
    const paddedPhase = padPhase(phaseNum);
    const outputFile = path.join(phaseDir, `${paddedPhase}-PLANS-DONE.md`);

    const contextSection = contextContent
      ? `<user_decisions>\n${contextContent}\n</user_decisions>`
      : 'No CONTEXT.md exists for this phase.';

    const researchSection = researchContent
      ? `<research>\n${researchContent}\n</research>`
      : '';

    const prompt = `You are a phase planner agent.

Read the agent definition at agents/gsd-planner.md and follow its instructions.

Phase ${phaseNum}: ${phaseName}

<phase_details>
${phaseDetails}
</phase_details>

${contextSection}

${researchSection}

Create PLAN.md files in: ${phaseDir}
When finished, write a brief confirmation to: ${outputFile}`;

    return { success: true, data: { prompt, outputFile } };
  } catch (err) {
    return { success: false, error: `Failed to build planner prompt: ${err.message}` };
  }
}

/**
 * Build the prompt for the plan-checker agent.
 *
 * The checker reviews all PLAN.md files in the phase directory and
 * produces a CHECK.md report with issues and recommendations.
 *
 * @param {number} phaseNum - Phase number
 * @param {string} phaseName - Phase display name
 * @param {string|null} contextContent - CONTEXT.md content (may be null)
 * @param {string} phaseDir - Absolute path to phase directory
 * @returns {{ success: boolean, data?: { prompt: string, outputFile: string }, error?: string }}
 */
export function buildCheckerPrompt(phaseNum, phaseName, contextContent, phaseDir) {
  try {
    const paddedPhase = padPhase(phaseNum);
    const outputFile = path.join(phaseDir, `${paddedPhase}-CHECK.md`);

    const contextSection = contextContent
      ? `<context_md>\n${contextContent}\n</context_md>`
      : 'No CONTEXT.md exists for this phase.';

    const prompt = `You are a plan checker agent.

Read the agent definition at agents/gsd-plan-checker.md and follow its instructions.

Phase ${phaseNum}: ${phaseName}

${contextSection}

Read all PLAN.md files in: ${phaseDir}
Write your review to: ${outputFile}`;

    return { success: true, data: { prompt, outputFile } };
  } catch (err) {
    return { success: false, error: `Failed to build checker prompt: ${err.message}` };
  }
}

/**
 * Get expected output file paths for each pipeline stage.
 *
 * Returns the marker/output files that each agent stage produces.
 * Used for verification after pipeline execution.
 *
 * @param {string} phaseDir - Absolute path to phase directory
 * @param {string} paddedPhase - Zero-padded phase number (e.g. "06")
 * @returns {{ research: string, plans: string, check: string }}
 */
export function getExpectedPlanFiles(phaseDir, paddedPhase) {
  return {
    research: path.join(phaseDir, `${paddedPhase}-RESEARCH.md`),
    plans: path.join(phaseDir, `${paddedPhase}-PLANS-DONE.md`),
    check: path.join(phaseDir, `${paddedPhase}-CHECK.md`),
  };
}

/**
 * Run the full planning pipeline: research -> plan -> check.
 *
 * Orchestrates three sequential agent stages. Research and checking are
 * gated by config.workflow.research and config.workflow.plan_check
 * respectively. Planning always runs. Each stage builds on the previous
 * output. Model orchestration is advisory only (logged, not enforced).
 *
 * @param {string} projectRoot - Absolute path to project root
 * @param {number} phaseNum - Phase number
 * @param {string} phaseName - Phase display name
 * @param {object} [options] - Pipeline options
 * @param {number} [options.timeout=600000] - Per-agent timeout in ms (default: 10 min)
 * @param {object} [options.config] - Pre-loaded config (skips readPlanningConfig)
 * @param {string} [options.phaseDetails] - Phase details from ROADMAP.md
 * @param {string|null} [options.contextContent] - CONTEXT.md content
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function runPlanningPipeline(projectRoot, phaseNum, phaseName, options = {}) {
  const timeout = options.timeout ?? 600000;

  try {
    const planningDir = path.join(projectRoot, '.planning');
    const paddedPhase = padPhase(phaseNum);
    const phaseDetails = options.phaseDetails ?? '';
    const contextContent = options.contextContent ?? null;

    // Load config if not provided
    let config;
    if (options.config) {
      config = options.config;
    } else {
      const configResult = await readPlanningConfig(planningDir);
      if (!configResult.success) {
        return { success: false, error: `Failed to read config: ${configResult.error}` };
      }
      config = configResult.data;
    }

    // Model profile for advisory logging
    const profile = config.model_profile || 'quality';
    const models = MODEL_RECOMMENDATIONS[profile] || MODEL_RECOMMENDATIONS.quality;

    // Ensure phase directory exists
    const dirResult = await ensurePhaseDir(planningDir, phaseNum, phaseName);
    if (!dirResult.success) {
      return { success: false, error: dirResult.error };
    }
    const phaseDir = dirResult.data.phaseDir;

    // Track pipeline results
    const result = {
      research: { ran: false, success: false, file: null },
      planning: { ran: true, success: false, file: null },
      checking: { ran: false, success: false, file: null },
    };

    let researchContent = null;

    // -----------------------------------------------------------------------
    // Step 1: Research (optional, config-gated)
    // -----------------------------------------------------------------------
    if (config.workflow && config.workflow.research === true) {
      console.log(`[pipeline] Research step (model_profile suggests: ${models.researcher})`);
      result.research.ran = true;

      const researchPrompt = buildResearchPrompt(
        phaseNum, phaseName, phaseDetails, contextContent, phaseDir
      );

      if (!researchPrompt.success) {
        console.warn(`[pipeline] Research prompt build failed: ${researchPrompt.error}`);
      } else {
        const agent = spawnAgent(researchPrompt.data.prompt, {
          outputFile: researchPrompt.data.outputFile,
          timeout,
          cwd: projectRoot,
        });

        const [waitResult] = await waitForAgents(
          [{ ...agent, outputFile: researchPrompt.data.outputFile }],
          { timeout }
        );

        // Verify research output exists
        const [verification] = await verifyOutputs([researchPrompt.data.outputFile]);

        if (verification.exists) {
          result.research.success = true;
          result.research.file = researchPrompt.data.outputFile;
          // Read research content for the planner
          try {
            researchContent = await readFile(researchPrompt.data.outputFile, 'utf-8');
          } catch {
            console.warn('[pipeline] Could not read research output, continuing without it');
          }
        } else {
          console.warn('[pipeline] Research agent did not produce output, continuing to planning');
        }
      }
    } else {
      console.log('[pipeline] Research step skipped (workflow.research is false)');
    }

    // -----------------------------------------------------------------------
    // Step 2: Planning (always runs)
    // -----------------------------------------------------------------------
    console.log(`[pipeline] Planning step (model_profile suggests: ${models.planner})`);

    const plannerPrompt = buildPlannerPrompt(
      phaseNum, phaseName, phaseDetails, contextContent, researchContent, phaseDir
    );

    if (!plannerPrompt.success) {
      return { success: false, error: `Planner prompt build failed: ${plannerPrompt.error}` };
    }

    const plannerAgent = spawnAgent(plannerPrompt.data.prompt, {
      outputFile: plannerPrompt.data.outputFile,
      timeout,
      cwd: projectRoot,
    });

    const [plannerWait] = await waitForAgents(
      [{ ...plannerAgent, outputFile: plannerPrompt.data.outputFile }],
      { timeout }
    );

    // Verify planner marker file exists
    const [plannerVerification] = await verifyOutputs([plannerPrompt.data.outputFile]);

    if (plannerVerification.exists) {
      result.planning.success = true;
      result.planning.file = plannerPrompt.data.outputFile;
    } else {
      return {
        success: false,
        error: 'Planner agent did not produce output',
        data: result,
      };
    }

    // -----------------------------------------------------------------------
    // Step 3: Plan checking (optional, config-gated)
    // -----------------------------------------------------------------------
    if (config.workflow && config.workflow.plan_check === true) {
      console.log(`[pipeline] Checking step (model_profile suggests: ${models.checker})`);
      result.checking.ran = true;

      const checkerPrompt = buildCheckerPrompt(
        phaseNum, phaseName, contextContent, phaseDir
      );

      if (!checkerPrompt.success) {
        console.warn(`[pipeline] Checker prompt build failed: ${checkerPrompt.error}`);
      } else {
        const checkerAgent = spawnAgent(checkerPrompt.data.prompt, {
          outputFile: checkerPrompt.data.outputFile,
          timeout,
          cwd: projectRoot,
        });

        const [checkerWait] = await waitForAgents(
          [{ ...checkerAgent, outputFile: checkerPrompt.data.outputFile }],
          { timeout }
        );

        const [checkerVerification] = await verifyOutputs([checkerPrompt.data.outputFile]);

        if (checkerVerification.exists) {
          result.checking.success = true;
          result.checking.file = checkerPrompt.data.outputFile;
        } else {
          console.warn('[pipeline] Checker agent did not produce output (non-fatal)');
        }
      }
    } else {
      console.log('[pipeline] Checking step skipped (workflow.plan_check is false)');
    }

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: `Pipeline error: ${err.message}` };
  }
}
