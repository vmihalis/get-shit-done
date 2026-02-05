/**
 * Cross-platform agent spawning for Cline-GSD
 * Enables main context to spawn parallel CLI subagents
 */

import { spawn } from 'node:child_process';
import { getPlatform } from './platform.js';

/**
 * Spawn a single Cline agent in background
 * @param {string} prompt - The prompt to send to the agent
 * @param {object} options - Spawn options
 * @param {string} [options.outputFile] - Path for agent to write output
 * @param {number} [options.timeout] - Timeout in milliseconds
 * @param {string} [options.cwd] - Working directory for the agent
 * @returns {{ pid: number, process: ChildProcess }}
 */
export function spawnAgent(prompt, options = {}) {
  const platform = getPlatform();
  const { outputFile, timeout, cwd } = options;

  // Build the full prompt with output file instruction if provided
  let fullPrompt = prompt;
  if (outputFile) {
    fullPrompt = `${prompt}\n\nWrite your output to: ${outputFile}`;
  }

  // Spawn options based on platform
  const spawnOptions = {
    cwd: cwd || process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  let childProcess;

  if (platform === 'windows') {
    // Windows: Use shell: true for proper command execution
    spawnOptions.shell = true;
    childProcess = spawn('cline', ['-y', fullPrompt], spawnOptions);
  } else {
    // Unix (Mac/Linux): Use detached mode for proper background behavior
    spawnOptions.detached = true;
    childProcess = spawn('cline', ['-y', fullPrompt], spawnOptions);
    // Unref to allow parent to exit independently (if needed)
    childProcess.unref();
  }

  // Handle timeout if specified
  let timeoutId;
  if (timeout) {
    timeoutId = setTimeout(() => {
      childProcess.kill('SIGTERM');
    }, timeout);

    childProcess.on('exit', () => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }

  // Capture stdout/stderr for debugging
  let stdout = '';
  let stderr = '';

  if (childProcess.stdout) {
    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
  }

  if (childProcess.stderr) {
    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
  }

  // Attach captured output to process object for later access
  childProcess._capturedStdout = () => stdout;
  childProcess._capturedStderr = () => stderr;

  return {
    pid: childProcess.pid,
    process: childProcess,
  };
}

/**
 * Spawn multiple agents in parallel
 * @param {Array<{prompt: string, outputFile?: string, timeout?: number, cwd?: string}>} agents
 * @returns {Array<{pid: number, process: ChildProcess, outputFile?: string}>}
 */
export function spawnAgents(agents) {
  return agents.map((agent) => {
    const { prompt, outputFile, timeout, cwd } = agent;
    const result = spawnAgent(prompt, { outputFile, timeout, cwd });
    return {
      ...result,
      outputFile,
    };
  });
}

/**
 * Wait for all agents to complete
 * @param {Array<{pid: number, process: ChildProcess, outputFile?: string}>} agents
 * @param {object} options
 * @param {number} [options.timeout] - Overall timeout in ms for all agents
 * @returns {Promise<Array<{pid: number, exitCode: number, outputFile?: string, success: boolean}>>}
 */
export async function waitForAgents(agents, options = {}) {
  const { timeout } = options;

  const waitPromises = agents.map((agent) => {
    return new Promise((resolve) => {
      const { pid, process: proc, outputFile } = agent;

      // Already exited
      if (proc.exitCode !== null) {
        resolve({
          pid,
          exitCode: proc.exitCode,
          outputFile,
          success: proc.exitCode === 0,
        });
        return;
      }

      proc.on('exit', (code) => {
        resolve({
          pid,
          exitCode: code ?? -1,
          outputFile,
          success: code === 0,
        });
      });

      proc.on('error', (err) => {
        resolve({
          pid,
          exitCode: -1,
          outputFile,
          success: false,
          error: err.message,
        });
      });
    });
  });

  // Apply overall timeout if specified
  if (timeout) {
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        // Kill all agents that haven't completed
        agents.forEach((agent) => {
          if (agent.process.exitCode === null) {
            agent.process.kill('SIGTERM');
          }
        });
        resolve(
          agents.map((agent) => ({
            pid: agent.pid,
            exitCode: agent.process.exitCode ?? -1,
            outputFile: agent.outputFile,
            success: false,
            timedOut: true,
          }))
        );
      }, timeout);
    });

    return Promise.race([Promise.all(waitPromises), timeoutPromise]);
  }

  return Promise.all(waitPromises);
}
