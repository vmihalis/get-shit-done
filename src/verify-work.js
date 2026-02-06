/**
 * Verify-work helper module for Cline-GSD
 *
 * Provides must-haves parsing from PLAN.md frontmatter, three-level artifact
 * verification (exists / substantive / wired), testable delivery extraction
 * from SUMMARY.md, and content generators for VERIFICATION.md and UAT.md.
 *
 * All functions run in the main Cline context -- no agent-spawn dependencies.
 *
 * Pure parsers:  parseMustHaves, extractTestableDeliveries
 * Pure formatters: buildVerificationContent, buildUATContent
 * I/O functions: checkArtifactExists, checkArtifactSubstantive, checkArtifactWired
 *
 * Exports: parseMustHaves, extractTestableDeliveries,
 *          checkArtifactExists, checkArtifactSubstantive, checkArtifactWired,
 *          buildVerificationContent, buildUATContent
 */

import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Stub detection patterns
// ---------------------------------------------------------------------------

const STUB_PATTERNS = [
  /TODO/i,
  /FIXME/i,
  /placeholder/i,
  /coming soon/i,
  /lorem ipsum/i,
  /throw new Error\(['"]not implemented/i,
  /^\s*return\s*;?\s*$/m,
];

// ---------------------------------------------------------------------------
// Pure parsers (no I/O)
// ---------------------------------------------------------------------------

/**
 * Parse must_haves from PLAN.md frontmatter content.
 *
 * Extracts truths (string[]), artifacts (object[]), and key_links (object[])
 * from the YAML frontmatter block. Uses line-by-line regex parsing following
 * the existing parsePlanFrontmatter() approach in state-read.js.
 *
 * @param {string} content - Full PLAN.md content including frontmatter
 * @returns {{ truths: string[], artifacts: object[], key_links: object[] } | null}
 *   Returns null if no frontmatter or no must_haves field found.
 */
export function parseMustHaves(content) {
  // Extract frontmatter between --- delimiters
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;

  const fmText = fmMatch[1];

  // Check if must_haves section exists
  if (!fmText.includes('must_haves:')) return null;

  const lines = fmText.split('\n');
  const result = { truths: [], artifacts: [], key_links: [] };

  // Find the must_haves: line
  let mustHavesStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^must_haves:\s*$/.test(lines[i])) {
      mustHavesStart = i;
      break;
    }
  }
  if (mustHavesStart === -1) return null;

  // Track current section and current object for nested parsing
  let currentSection = null; // 'truths' | 'artifacts' | 'key_links'
  let currentObj = null;

  for (let i = mustHavesStart + 1; i < lines.length; i++) {
    const line = lines[i];

    // Stop at next top-level field (no indentation)
    if (/^\S/.test(line) && !line.startsWith('#')) break;

    // Detect section headers (2-space indent): truths:, artifacts:, key_links:
    const sectionMatch = line.match(/^  (\w[\w_]*):\s*(.*)$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1];
      const inlineValue = sectionMatch[2].trim();

      // Push any pending object from the previous section before switching
      if (currentObj) {
        if (currentSection === 'artifacts' && currentObj.path) {
          result.artifacts.push(currentObj);
        } else if (currentSection === 'key_links' && currentObj.from !== undefined) {
          result.key_links.push(currentObj);
        }
        currentObj = null;
      }

      if (sectionName === 'truths') {
        currentSection = 'truths';
        // Handle inline empty array
        if (inlineValue === '[]') continue;
        continue;
      }
      if (sectionName === 'artifacts') {
        currentSection = 'artifacts';
        if (inlineValue === '[]') continue;
        continue;
      }
      if (sectionName === 'key_links') {
        currentSection = 'key_links';
        if (inlineValue === '[]') continue;
        continue;
      }
    }

    // Parse truths: array items -- "    - \"truth text\""
    if (currentSection === 'truths') {
      const truthMatch = line.match(/^\s+-\s+"([^"]+)"/);
      if (truthMatch) {
        result.truths.push(truthMatch[1]);
      }
      continue;
    }

    // Parse artifacts: array of objects
    if (currentSection === 'artifacts') {
      // New artifact starts with "    - path:"
      const newArtifactMatch = line.match(/^\s+-\s+path:\s*"?([^"]+)"?\s*$/);
      if (newArtifactMatch) {
        // Save previous object if any
        if (currentObj) {
          result.artifacts.push(currentObj);
        }
        currentObj = { path: newArtifactMatch[1].trim() };
        continue;
      }

      // Continuation fields for current artifact (6+ spaces indent)
      if (currentObj) {
        const fieldMatch = line.match(/^\s{6,}(\w[\w_]*):\s*(.+)$/);
        if (fieldMatch) {
          const key = fieldMatch[1];
          const val = fieldMatch[2].trim();

          if (key === 'provides') {
            currentObj.provides = val.replace(/^"|"$/g, '');
          } else if (key === 'exports') {
            // Handle inline array: ["a", "b"] or [a, b]
            if (val.startsWith('[')) {
              const inner = val.slice(1, -1).trim();
              if (inner === '') {
                currentObj.exports = [];
              } else {
                currentObj.exports = inner.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
              }
            } else {
              currentObj.exports = [val.replace(/^"|"$/g, '')];
            }
          } else if (key === 'min_lines') {
            currentObj.min_lines = parseInt(val, 10);
          } else if (key === 'contains') {
            currentObj.contains = val.replace(/^"|"$/g, '');
          }
          continue;
        }

        // Multi-line exports: "        - item"
        const exportItemMatch = line.match(/^\s{8,}-\s+"?([^"]+)"?\s*$/);
        if (exportItemMatch) {
          if (!currentObj.exports) currentObj.exports = [];
          currentObj.exports.push(exportItemMatch[1].trim());
          continue;
        }
      }
      continue;
    }

    // Parse key_links: array of objects
    if (currentSection === 'key_links') {
      // New key_link starts with "    - from:"
      const newLinkMatch = line.match(/^\s+-\s+from:\s*"?([^"]+)"?\s*$/);
      if (newLinkMatch) {
        if (currentObj && currentObj.from) {
          result.key_links.push(currentObj);
        }
        currentObj = { from: newLinkMatch[1].trim() };
        continue;
      }

      // Continuation fields for current key_link
      if (currentObj && currentObj.from !== undefined) {
        const fieldMatch = line.match(/^\s{6,}(\w[\w_]*):\s*(.+)$/);
        if (fieldMatch) {
          const key = fieldMatch[1];
          const val = fieldMatch[2].trim().replace(/^"|"$/g, '');

          if (key === 'to') currentObj.to = val;
          else if (key === 'via') currentObj.via = val;
          else if (key === 'pattern') currentObj.pattern = val;
          continue;
        }
      }
      continue;
    }
  }

  // Push last object if still pending
  if (currentSection === 'artifacts' && currentObj && currentObj.path) {
    result.artifacts.push(currentObj);
  }
  if (currentSection === 'key_links' && currentObj && currentObj.from) {
    result.key_links.push(currentObj);
  }

  return result;
}

/**
 * Parse SUMMARY.md content to extract testable deliveries.
 *
 * Looks for Accomplishments bullet points, Task Commits task names,
 * and Files Created/Modified file paths.
 *
 * @param {string} summaryContent - Raw SUMMARY.md text
 * @returns {Array<{ name: string, type: 'accomplishment'|'task'|'file', detail: string }>}
 */
export function extractTestableDeliveries(summaryContent) {
  if (!summaryContent || typeof summaryContent !== 'string') return [];

  const deliveries = [];

  // Extract accomplishments (bullet points under ## Accomplishments)
  const accomplishmentsMatch = summaryContent.match(
    /## Accomplishments\s*\n([\s\S]*?)(?=\n## |\n---|$)/
  );
  if (accomplishmentsMatch) {
    const lines = accomplishmentsMatch[1].split('\n');
    for (const line of lines) {
      const bulletMatch = line.match(/^\s*-\s+(.+)/);
      if (bulletMatch) {
        deliveries.push({
          name: bulletMatch[1].trim(),
          type: 'accomplishment',
          detail: bulletMatch[1].trim(),
        });
      }
    }
  }

  // Extract task names from ## Task Commits
  const taskCommitsMatch = summaryContent.match(
    /## Task Commits\s*\n([\s\S]*?)(?=\n## |\n---|$)/
  );
  if (taskCommitsMatch) {
    const lines = taskCommitsMatch[1].split('\n');
    for (const line of lines) {
      // Match "1. **Task Name** - `hash` (type)"
      const taskMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*/);
      if (taskMatch) {
        deliveries.push({
          name: taskMatch[1].trim(),
          type: 'task',
          detail: line.trim(),
        });
      }
    }
  }

  // Extract file paths from ## Files Created/Modified
  const filesMatch = summaryContent.match(
    /## Files Created\/Modified\s*\n([\s\S]*?)(?=\n## |\n---|$)/
  );
  if (filesMatch) {
    const lines = filesMatch[1].split('\n');
    for (const line of lines) {
      // Match "- `path/to/file` - purpose (created/modified)"
      const fileMatch = line.match(/^\s*-\s+`([^`]+)`\s*-\s*(.+)/);
      if (fileMatch) {
        deliveries.push({
          name: fileMatch[1].trim(),
          type: 'file',
          detail: fileMatch[2].trim(),
        });
      }
    }
  }

  return deliveries;
}

// ---------------------------------------------------------------------------
// I/O functions (error-return pattern)
// ---------------------------------------------------------------------------

/**
 * Check if a file exists at the given path.
 *
 * @param {string} filePath - Path to check
 * @returns {Promise<{ success: boolean, data?: { exists: boolean, path: string }, error?: string }>}
 */
export async function checkArtifactExists(filePath) {
  try {
    try {
      await access(filePath);
      return { success: true, data: { exists: true, path: filePath } };
    } catch {
      return { success: true, data: { exists: false, path: filePath } };
    }
  } catch (err) {
    return { success: false, error: `Failed to check artifact existence: ${err.message}` };
  }
}

/**
 * Read file content and determine if it is substantive, a stub, or partial.
 *
 * Uses line count thresholds, stub pattern detection, export checking,
 * and optional content-contains checking to classify the artifact.
 *
 * @param {string} filePath - Path to the file to check
 * @param {object} [options={}] - Check options
 * @param {number} [options.min_lines=10] - Minimum line count for substantive
 * @param {string[]} [options.exports] - Expected export names to verify
 * @param {string} [options.contains] - String that must appear in the content
 * @returns {Promise<{ success: boolean, data?: { status: 'SUBSTANTIVE'|'STUB'|'PARTIAL', lines: number, hasStubs: boolean, missingExports: string[], missingContains: boolean }, error?: string }>}
 */
export async function checkArtifactSubstantive(filePath, options = {}) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const minLines = options.min_lines ?? 10;
    const expectedExports = options.exports ?? [];
    const containsStr = options.contains ?? null;

    // Count non-empty lines
    const allLines = content.split('\n');
    const nonEmptyLines = allLines.filter(l => l.trim().length > 0).length;

    // Check for stub patterns
    const hasStubs = STUB_PATTERNS.some(p => p.test(content));

    // Check expected exports
    const missingExports = [];
    for (const exportName of expectedExports) {
      const exportPattern = new RegExp(
        `export\\s+(function|const|class|async\\s+function)\\s+${exportName}\\b` +
        `|export\\s*\\{[^}]*\\b${exportName}\\b[^}]*\\}`
      );
      if (!exportPattern.test(content)) {
        missingExports.push(exportName);
      }
    }

    // Check contains
    const missingContains = containsStr ? !content.includes(containsStr) : false;

    // Classify
    let status;
    if (nonEmptyLines < minLines || hasStubs) {
      status = 'STUB';
    } else if (missingExports.length > 0 || missingContains) {
      status = 'PARTIAL';
    } else {
      status = 'SUBSTANTIVE';
    }

    return {
      success: true,
      data: {
        status,
        lines: nonEmptyLines,
        hasStubs,
        missingExports,
        missingContains,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to check artifact substantiveness: ${err.message}` };
  }
}

/**
 * Check if the artifact is imported/referenced by other files in the project.
 *
 * Searches src/, scripts/, and workflows/ directories for files that
 * reference the artifact's basename. Workflows (.md) are entry points
 * and are always considered wired.
 *
 * @param {string} filePath - Path to the artifact file
 * @param {string} [projectRoot='.'] - Project root directory
 * @returns {Promise<{ success: boolean, data?: { wired: boolean, importedBy: string[] }, error?: string }>}
 */
export async function checkArtifactWired(filePath, projectRoot = '.') {
  try {
    const basename = path.basename(filePath);
    const basenameNoExt = path.basename(filePath, path.extname(filePath));

    // Workflows are entry points -- always considered wired
    if (basename.endsWith('.md')) {
      return { success: true, data: { wired: true, importedBy: ['entry-point'] } };
    }

    const searchDirs = ['src', 'scripts', 'workflows'];
    const importedBy = [];

    for (const dir of searchDirs) {
      const dirPath = path.join(projectRoot, dir);
      let files;
      try {
        files = await readdir(dirPath, { recursive: true });
      } catch {
        // Directory doesn't exist, skip
        continue;
      }

      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        // Skip self-references
        if (path.resolve(fullPath) === path.resolve(filePath)) continue;

        try {
          const fileContent = await readFile(fullPath, 'utf-8');
          // Check for import/require patterns matching the basename
          const importPattern = new RegExp(
            `(?:import|require).*['"].*${basenameNoExt}(?:\\.js)?['"]` +
            `|from\\s+['"].*${basenameNoExt}(?:\\.js)?['"]`
          );
          // Also check for references in markdown (workflow files)
          const mdRefPattern = new RegExp(basenameNoExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

          if (importPattern.test(fileContent) || (file.endsWith('.md') && mdRefPattern.test(fileContent))) {
            importedBy.push(fullPath);
          }
        } catch {
          // Can't read file, skip
          continue;
        }
      }
    }

    return {
      success: true,
      data: {
        wired: importedBy.length > 0,
        importedBy,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to check artifact wiring: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Pure formatters (return strings directly)
// ---------------------------------------------------------------------------

/**
 * Generate VERIFICATION.md content with must-haves check results.
 *
 * @param {object} data - Verification data
 * @param {string} data.phase - Phase identifier (e.g. "08-verification-polish")
 * @param {string} data.phaseName - Phase display name (e.g. "Verification & Polish")
 * @param {Array} data.plans - Plan result objects, each with: planId, truths, artifacts, keyLinks
 * @param {string} data.created - ISO date string
 * @param {{ totalChecks: number, passed: number, failed: number, skipped: number }} data.summary
 * @returns {string} Complete VERIFICATION.md content
 */
export function buildVerificationContent(data) {
  const { phase, phaseName, plans, created, summary } = data;
  const overallStatus = summary.failed > 0 ? 'fail' : 'pass';

  // Extract phase number from phase string (e.g. "08-verification-polish" -> "8")
  const phaseNum = parseInt(phase.split('-')[0], 10) || phase;

  // --- Frontmatter ---
  const frontmatter = `---
status: ${overallStatus}
phase: ${phase}
created: ${created}
total: ${summary.totalChecks}
passed: ${summary.passed}
failed: ${summary.failed}
---`;

  // --- Body ---
  let body = `\n\n# Phase ${phaseNum}: ${phaseName} - Verification\n\n`;
  body += `## Summary\n\n`;
  body += `${summary.passed}/${summary.totalChecks} checks passed (${summary.failed} failed, ${summary.skipped} skipped)\n`;

  for (const plan of plans) {
    body += `\n## Plan ${plan.planId}\n`;

    // Truths
    if (plan.truths && plan.truths.length > 0) {
      body += `\n### Truths\n`;
      for (const truth of plan.truths) {
        const checkbox = truth.status === 'pass' ? '[x]' : '[ ]';
        body += `- ${checkbox} "${truth.text}"\n`;
      }
    }

    // Artifacts
    if (plan.artifacts && plan.artifacts.length > 0) {
      body += `\n### Artifacts\n`;
      body += `| Path | Exists | Substantive | Wired | Status |\n`;
      body += `|------|--------|-------------|-------|--------|\n`;
      for (const artifact of plan.artifacts) {
        const exists = artifact.exists ? 'Yes' : 'No';
        const substantive = artifact.substantive || '-';
        const wired = artifact.wired ? 'Yes' : 'No';
        const status = artifact.status === 'pass' ? 'PASS' : 'FAIL';
        body += `| ${artifact.path} | ${exists} | ${substantive} | ${wired} | ${status} |\n`;
      }
    }

    // Key Links
    if (plan.keyLinks && plan.keyLinks.length > 0) {
      body += `\n### Key Links\n`;
      body += `| From | To | Via | Found | Status |\n`;
      body += `|------|----|----|-------|--------|\n`;
      for (const link of plan.keyLinks) {
        const found = link.found ? 'Yes' : 'No';
        const status = link.status === 'pass' ? 'PASS' : 'FAIL';
        body += `| ${link.from} | ${link.to} | ${link.via} | ${found} | ${status} |\n`;
      }
    }
  }

  return frontmatter + body;
}

/**
 * Generate UAT.md content for user acceptance testing.
 *
 * @param {object} data - UAT data
 * @param {string} data.phase - Phase identifier
 * @param {string} data.phaseName - Phase display name
 * @param {Array<{ name: string, expected: string, result: string, issue?: string, severity?: string }>} data.tests
 * @param {string} data.status - Overall status: pending|in-progress|passed|failed|diagnosed
 * @param {string} data.created - ISO date string
 * @param {string} data.updated - ISO date string
 * @returns {string} Complete UAT.md content
 */
export function buildUATContent(data) {
  const { phase, phaseName, tests, status, created, updated } = data;

  const passed = tests.filter(t => t.result === 'pass').length;
  const failed = tests.filter(t => t.result === 'fail').length;
  const skipped = tests.filter(t => t.result === 'skipped').length;
  const pending = tests.filter(t => t.result === 'pending').length;

  // Extract phase number from phase string
  const phaseNum = parseInt(phase.split('-')[0], 10) || phase;

  // --- Frontmatter ---
  const frontmatter = `---
status: ${status}
phase: ${phase}
created: ${created}
updated: ${updated}
total: ${tests.length}
passed: ${passed}
failed: ${failed}
skipped: ${skipped}
pending: ${pending}
---`;

  // --- Body ---
  let body = `\n\n# Phase ${phaseNum}: ${phaseName} - UAT\n\n`;
  body += `## Test Results\n`;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    body += `\n### Test ${i + 1}: ${t.name}\n`;
    body += `- **Expected:** ${t.expected}\n`;
    body += `- **Result:** ${t.result}\n`;
    if (t.issue) {
      body += `- **Issue:** ${t.issue}\n`;
      body += `- **Severity:** ${t.severity || 'unknown'}\n`;
    }
  }

  return frontmatter + body;
}
