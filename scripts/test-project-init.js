#!/usr/bin/env node

/**
 * Integration test for project-init.js
 *
 * Tests writeProjectMd and writeConfigJson end-to-end with temp directories.
 * Covers: basic creation, requirements, key decisions, error handling,
 * date defaulting, config defaults, scalar overrides, nested merge.
 *
 * Run: node scripts/test-project-init.js
 * npm: "test:project-init": "node scripts/test-project-init.js"
 */

import { tmpdir } from 'node:os';
import { mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

import { writeProjectMd, writeConfigJson } from '../src/project-init.js';

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
// Test suite
// ---------------------------------------------------------------------------

const TEMP_DIR = path.join(tmpdir(), `cline-gsd-project-init-test-${Date.now()}`);

async function main() {
  console.log('\nProject Init Integration Test');
  console.log('=============================\n');
  console.log(`Temp dir: ${TEMP_DIR}\n`);

  try {
    await mkdir(TEMP_DIR, { recursive: true });

    // ---- writeProjectMd tests ----

    console.log('--- writeProjectMd ---');

    await test('1. Basic creation with all fields', async () => {
      const dir = path.join(TEMP_DIR, 'basic');
      await mkdir(dir, { recursive: true });

      const result = await writeProjectMd(dir, {
        name: 'Test Project',
        description: 'A test project for integration testing.',
        coreValue: 'Make testing great again',
        context: 'We need to verify project-init works.',
        constraints: ['Must use Node.js 20+', 'No external services'],
        date: '2026-01-15',
      });

      assert.equal(result.success, true, 'Should succeed');
      assert.ok(result.data.path.endsWith('PROJECT.md'), 'Path should end with PROJECT.md');

      const content = await readFile(result.data.path, 'utf-8');
      assert.ok(content.includes('# Test Project'), 'Should have project name heading');
      assert.ok(content.includes('A test project for integration testing.'), 'Should have description');
      assert.ok(content.includes('Make testing great again'), 'Should have core value');
      assert.ok(content.includes('We need to verify project-init works.'), 'Should have context');
      assert.ok(content.includes('Must use Node.js 20+'), 'Should have constraint 1');
      assert.ok(content.includes('No external services'), 'Should have constraint 2');
      assert.ok(content.includes('2026-01-15'), 'Should have provided date');
    });

    await test('2. Requirements populated', async () => {
      const dir = path.join(TEMP_DIR, 'requirements');
      await mkdir(dir, { recursive: true });

      const result = await writeProjectMd(dir, {
        name: 'Req Project',
        description: 'Testing requirements.',
        coreValue: 'Requirements matter',
        context: 'Context here.',
        constraints: [],
        requirements: {
          validated: ['REQ-01: Auth'],
          active: ['REQ-02: API'],
          outOfScope: ['REQ-03: Mobile'],
        },
        date: '2026-01-15',
      });

      assert.equal(result.success, true, 'Should succeed');

      const content = await readFile(result.data.path, 'utf-8');
      assert.ok(content.includes('REQ-01: Auth'), 'Should have validated requirement');
      assert.ok(content.includes('REQ-02: API'), 'Should have active requirement');
      assert.ok(content.includes('REQ-03: Mobile'), 'Should have out-of-scope requirement');
    });

    await test('3. Key decisions populated', async () => {
      const dir = path.join(TEMP_DIR, 'decisions');
      await mkdir(dir, { recursive: true });

      const result = await writeProjectMd(dir, {
        name: 'Decisions Project',
        description: 'Testing key decisions.',
        coreValue: 'Decisions tracked',
        context: 'Context here.',
        constraints: [],
        keyDecisions: [
          { decision: 'Use React', rationale: 'Team expertise', outcome: 'Adopted' },
        ],
        date: '2026-01-15',
      });

      assert.equal(result.success, true, 'Should succeed');

      const content = await readFile(result.data.path, 'utf-8');
      assert.ok(content.includes('| Use React | Team expertise | Adopted |'), 'Should have decision table row');
    });

    await test('4. Error handling with invalid path', async () => {
      const result = await writeProjectMd('/nonexistent/deep/path/that/wont/exist', {
        name: 'Fail Project',
        description: 'Should fail.',
        coreValue: 'Failure is an option',
        context: 'Bad path.',
        constraints: [],
        date: '2026-01-15',
      });

      assert.equal(result.success, false, 'Should fail');
      assert.equal(typeof result.error, 'string', 'Error should be a string');
      assert.ok(result.error.length > 0, 'Error should not be empty');
    });

    await test('5. Date defaulting to today', async () => {
      const dir = path.join(TEMP_DIR, 'date-default');
      await mkdir(dir, { recursive: true });

      const result = await writeProjectMd(dir, {
        name: 'Date Project',
        description: 'Testing date default.',
        coreValue: 'Dates matter',
        context: 'Context.',
        constraints: [],
        // No date provided -- should default to today
      });

      assert.equal(result.success, true, 'Should succeed');

      const content = await readFile(result.data.path, 'utf-8');
      const today = new Date().toISOString().split('T')[0];
      assert.ok(content.includes(today), `Should contain today's date: ${today}`);
    });

    // ---- writeConfigJson tests ----

    console.log('\n--- writeConfigJson ---');

    await test('6. Defaults only (empty preferences)', async () => {
      const dir = path.join(TEMP_DIR, 'config-defaults');
      await mkdir(dir, { recursive: true });

      const result = await writeConfigJson(dir, {});

      assert.equal(result.success, true, 'Should succeed');

      const raw = await readFile(result.data.path, 'utf-8');
      const config = JSON.parse(raw);

      assert.equal(config.mode, 'yolo', 'Default mode should be yolo');
      assert.equal(config.depth, 'comprehensive', 'Default depth should be comprehensive');
      assert.equal(config.parallelization, true, 'Default parallelization should be true');
      assert.equal(config.commit_docs, true, 'Default commit_docs should be true');
      assert.equal(config.model_profile, 'quality', 'Default model_profile should be quality');
      assert.equal(config.workflow.research, true, 'Default workflow.research should be true');
      assert.equal(config.workflow.plan_check, true, 'Default workflow.plan_check should be true');
      assert.equal(config.workflow.verifier, true, 'Default workflow.verifier should be true');
      assert.equal(config.planning.max_tasks_per_plan, 8, 'Default max_tasks_per_plan should be 8');
      assert.equal(config.gates.plan_review, false, 'Default gates.plan_review should be false');
      assert.equal(config.gates.checkpoint_approval, true, 'Default gates.checkpoint_approval should be true');
      assert.equal(config.safety.backup_before_execute, false, 'Default safety.backup_before_execute should be false');
    });

    await test('7. Scalar overrides', async () => {
      const dir = path.join(TEMP_DIR, 'config-scalars');
      await mkdir(dir, { recursive: true });

      const result = await writeConfigJson(dir, {
        mode: 'interactive',
        depth: 'quick',
      });

      assert.equal(result.success, true, 'Should succeed');

      const raw = await readFile(result.data.path, 'utf-8');
      const config = JSON.parse(raw);

      // Overridden values
      assert.equal(config.mode, 'interactive', 'mode should be overridden to interactive');
      assert.equal(config.depth, 'quick', 'depth should be overridden to quick');

      // Non-overridden defaults preserved
      assert.equal(config.parallelization, true, 'parallelization should remain default');
      assert.equal(config.commit_docs, true, 'commit_docs should remain default');
      assert.equal(config.model_profile, 'quality', 'model_profile should remain default');
      assert.equal(config.workflow.research, true, 'workflow.research should remain default');
    });

    await test('8. Nested object merge', async () => {
      const dir = path.join(TEMP_DIR, 'config-nested');
      await mkdir(dir, { recursive: true });

      const result = await writeConfigJson(dir, {
        workflow: { research: false },
      });

      assert.equal(result.success, true, 'Should succeed');

      const raw = await readFile(result.data.path, 'utf-8');
      const config = JSON.parse(raw);

      // Overridden nested value
      assert.equal(config.workflow.research, false, 'workflow.research should be overridden to false');

      // Other nested defaults preserved
      assert.equal(config.workflow.plan_check, true, 'workflow.plan_check should remain true');
      assert.equal(config.workflow.verifier, true, 'workflow.verifier should remain true');

      // Top-level defaults still intact
      assert.equal(config.mode, 'yolo', 'mode should remain default');
    });

    await test('9. Error handling with invalid path', async () => {
      const result = await writeConfigJson('/nonexistent/deep/path/that/wont/exist', {});

      assert.equal(result.success, false, 'Should fail');
      assert.equal(typeof result.error, 'string', 'Error should be a string');
      assert.ok(result.error.length > 0, 'Error should not be empty');
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
