#!/usr/bin/env node

/**
 * Integration test for map-codebase.js
 *
 * Tests buildMapperPrompts, getExpectedOutputFiles, and the verify/report
 * pipeline end-to-end with temp directories and mock files.
 * Covers: prompt construction, file path generation, full pipeline,
 * partial failures, and empty directory edge case.
 *
 * Run: node scripts/test-map-codebase.js
 * npm: "test:map-codebase": "node scripts/test-map-codebase.js"
 */

import { tmpdir } from 'node:os';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

import { buildMapperPrompts, getExpectedOutputFiles } from '../src/map-codebase.js';
import { verifyOutputs, reportResults } from '../src/agent-collect.js';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateMockContent(docName, lineCount = 30) {
  const lines = [`# ${docName}`, '', `Generated for testing at ${new Date().toISOString()}`, ''];
  for (let i = 0; i < lineCount - 4; i++) {
    lines.push(`Line ${i + 1}: Placeholder content for ${docName}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const TEMP_DIR = path.join(tmpdir(), `cline-gsd-map-test-${Date.now()}`);

async function main() {
  console.log('\nMap Codebase Integration Test');
  console.log('============================\n');
  console.log(`Temp dir: ${TEMP_DIR}\n`);

  try {
    await mkdir(TEMP_DIR, { recursive: true });

    // ---- buildMapperPrompts tests ----

    console.log('--- buildMapperPrompts ---');

    await test('1. Produces 4 prompts', async () => {
      const result = buildMapperPrompts('/tmp/test');
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.length, 4, 'Should produce 4 prompts');
      for (const item of result.data) {
        assert.ok(item.prompt, 'Each item should have a prompt');
        assert.ok(item.outputFile, 'Each item should have an outputFile');
        assert.ok(item.focus, 'Each item should have a focus');
      }
    });

    await test('2. Correct focus areas', async () => {
      const result = buildMapperPrompts('/tmp/test');
      const focuses = result.data.map((d) => d.focus).sort();
      const expected = ['arch', 'concerns', 'quality', 'tech'].sort();
      assert.deepEqual(focuses, expected, 'Focus areas should be tech, arch, quality, concerns');
    });

    await test('3. Prompts reference agent definition', async () => {
      const result = buildMapperPrompts('/tmp/test');
      for (const item of result.data) {
        assert.ok(
          item.prompt.includes('gsd-codebase-mapper.md'),
          `Prompt for ${item.focus} should reference gsd-codebase-mapper.md`
        );
      }
    });

    await test('4. Prompts include output file paths', async () => {
      const result = buildMapperPrompts('/tmp/test');
      const techPrompt = result.data.find((d) => d.focus === 'tech');
      assert.ok(techPrompt.prompt.includes('STACK.md'), 'Tech prompt should reference STACK.md');
      assert.ok(techPrompt.prompt.includes('INTEGRATIONS.md'), 'Tech prompt should reference INTEGRATIONS.md');

      const concernsPrompt = result.data.find((d) => d.focus === 'concerns');
      assert.ok(concernsPrompt.prompt.includes('CONCERNS.md'), 'Concerns prompt should reference CONCERNS.md');
    });

    // ---- getExpectedOutputFiles tests ----

    console.log('\n--- getExpectedOutputFiles ---');

    await test('5. Returns 7 file paths', async () => {
      const result = getExpectedOutputFiles('/tmp/test/.planning');
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.length, 7, 'Should return 7 file paths');
    });

    await test('6. Correct file names', async () => {
      const result = getExpectedOutputFiles('/tmp/test/.planning');
      const basenames = result.data.map((f) => path.basename(f)).sort();
      const expected = [
        'ARCHITECTURE.md',
        'CONCERNS.md',
        'CONVENTIONS.md',
        'INTEGRATIONS.md',
        'STACK.md',
        'STRUCTURE.md',
        'TESTING.md',
      ];
      assert.deepEqual(basenames, expected, 'Should contain all 7 expected file names');
    });

    await test('7. Paths include codebase directory', async () => {
      const result = getExpectedOutputFiles('/tmp/test/.planning');
      for (const filePath of result.data) {
        assert.ok(
          filePath.includes('/codebase/'),
          `Path ${filePath} should include /codebase/`
        );
      }
    });

    // ---- Verify/report pipeline tests ----

    console.log('\n--- Verify/report pipeline ---');

    await test('8. Full pipeline with all files present', async () => {
      const pipeDir = path.join(TEMP_DIR, 'full-pipeline');
      const codebaseDir = path.join(pipeDir, '.planning', 'codebase');
      await mkdir(codebaseDir, { recursive: true });

      // Write all 7 mock files
      const allFiles = [
        'STACK.md', 'INTEGRATIONS.md', 'ARCHITECTURE.md',
        'STRUCTURE.md', 'CONVENTIONS.md', 'TESTING.md', 'CONCERNS.md',
      ];
      for (const file of allFiles) {
        await writeFile(
          path.join(codebaseDir, file),
          generateMockContent(file, 30)
        );
      }

      const filesResult = getExpectedOutputFiles(path.join(pipeDir, '.planning'));
      assert.equal(filesResult.success, true, 'getExpectedOutputFiles should succeed');

      const verifications = await verifyOutputs(filesResult.data);
      const report = reportResults(verifications);

      assert.equal(report.found, 7, 'Should find all 7 files');
      assert.equal(report.missing, 0, 'Should have 0 missing');

      // Check that report contains OK for each file
      for (const file of allFiles) {
        assert.ok(report.report.includes('OK'), 'Report should contain OK entries');
      }
    });

    await test('9. Partial failure (some files missing)', async () => {
      const partialDir = path.join(TEMP_DIR, 'partial');
      const codebaseDir = path.join(partialDir, '.planning', 'codebase');
      await mkdir(codebaseDir, { recursive: true });

      // Write only STACK.md and ARCHITECTURE.md
      await writeFile(
        path.join(codebaseDir, 'STACK.md'),
        generateMockContent('STACK.md', 30)
      );
      await writeFile(
        path.join(codebaseDir, 'ARCHITECTURE.md'),
        generateMockContent('ARCHITECTURE.md', 30)
      );

      const filesResult = getExpectedOutputFiles(path.join(partialDir, '.planning'));
      const verifications = await verifyOutputs(filesResult.data);
      const report = reportResults(verifications);

      assert.equal(report.found, 2, 'Should find 2 files');
      assert.equal(report.missing, 5, 'Should have 5 missing');
      assert.ok(report.report.includes('MISSING'), 'Report should contain MISSING entries');
    });

    await test('10. Empty directory (all files missing)', async () => {
      const emptyDir = path.join(TEMP_DIR, 'empty');
      const codebaseDir = path.join(emptyDir, '.planning', 'codebase');
      await mkdir(codebaseDir, { recursive: true });

      // Write no files
      const filesResult = getExpectedOutputFiles(path.join(emptyDir, '.planning'));
      const verifications = await verifyOutputs(filesResult.data);

      // All should show exists: false
      for (const v of verifications) {
        assert.equal(v.exists, false, `${v.path} should not exist`);
      }

      const report = reportResults(verifications);
      assert.equal(report.found, 0, 'Should find 0 files');
      assert.equal(report.missing, 7, 'Should have 7 missing');
    });

  } finally {
    // ---- Cleanup ----
    console.log('\n--- Cleanup ---');
    await rm(TEMP_DIR, { recursive: true, force: true });
    console.log(`  Removed: ${TEMP_DIR}`);
  }

  // ---- Summary ----

  const total = passed + failed;
  console.log(`\n${'='.repeat(40)}`);
  console.log(`${passed}/${total} tests passed`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
