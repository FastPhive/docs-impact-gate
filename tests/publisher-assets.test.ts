import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import { parse } from 'yaml';

function readYaml(path: string): Record<string, unknown> {
  const parsed: unknown = parse(readFileSync(path, 'utf8'));
  assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
  return parsed as Record<string, unknown>;
}

test('publisher CI uses read-only permissions and immutable action pins', () => {
  const workflow = readYaml('.github/workflows/ci.yml');

  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.ok(workflow.on && typeof workflow.on === 'object');
  assert.equal('pull_request_target' in (workflow.on as object), false);

  const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
  const steps = jobs.validate?.steps as Array<Record<string, unknown>>;
  assert.equal(
    steps[0]?.uses,
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  );
  assert.deepEqual(steps[0]?.with, { 'persist-credentials': false });
  assert.equal(
    steps[1]?.uses,
    'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
  );
  assert.deepEqual(steps[1]?.with, {
    'node-version': '24',
    cache: 'npm',
  });
  assert.equal(
    steps.some((step) => step.run === 'npm ci'),
    true,
  );
  assert.equal(
    steps.some((step) => step.run === 'npm run check'),
    true,
  );
  assert.equal(
    steps.some((step) => step.run === 'npm audit --audit-level=high'),
    true,
  );
});

test('demo workflow grants only required reads and keeps the product pin explicit', () => {
  const workflow = readYaml('marketing/demo-workflow.yml');

  assert.deepEqual(workflow.permissions, {
    contents: 'read',
    'pull-requests': 'read',
  });
  assert.ok(workflow.on && typeof workflow.on === 'object');
  assert.equal('pull_request' in (workflow.on as object), true);
  assert.equal('pull_request_target' in (workflow.on as object), false);

  const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
  const steps = jobs['docs-impact']?.steps as Array<Record<string, unknown>>;
  assert.equal(
    steps[0]?.uses,
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  );
  assert.equal(steps[1]?.uses, '<publisher>/<repository>@<full-commit-sha>');
});

test('publisher root contains exactly one action metadata file', () => {
  const metadataFiles = readdirSync('.').filter((name) =>
    /^action\.ya?ml$/u.test(name),
  );

  assert.deepEqual(metadataFiles, ['action.yml']);
});
