import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import { parse } from 'yaml';

import type { Evaluation, PolicyRule, RuleResult } from '../src/domain.js';
import { renderReport } from '../src/report.js';

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

test('demo workflow is directly runnable with the immutable v0.2.0 release pin', () => {
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
  assert.equal(
    steps[1]?.uses,
    'FastPhive/docs-impact-gate@6683d10b1aa4768e433bc5ba2498f1f0b9477c70',
  );
});

test('publisher CI dogfoods the released action in audit mode with minimal reads', () => {
  const workflow = readYaml('.github/workflows/ci.yml');

  assert.ok(workflow.on && typeof workflow.on === 'object');
  assert.equal('pull_request' in (workflow.on as object), true);
  assert.equal('pull_request_target' in (workflow.on as object), false);

  const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
  const job = jobs['docs-impact'];
  assert.ok(job, 'expected a docs-impact self-check job');
  assert.equal(job.if, "github.event_name == 'pull_request'");
  assert.deepEqual(job.permissions, {
    contents: 'read',
    'pull-requests': 'read',
  });

  const steps = job.steps as Array<Record<string, unknown>>;
  assert.equal(
    steps[0]?.uses,
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  );
  assert.deepEqual(steps[0]?.with, { 'persist-credentials': false });
  assert.equal(
    steps[1]?.uses,
    'FastPhive/docs-impact-gate@6683d10b1aa4768e433bc5ba2498f1f0b9477c70',
  );
  assert.deepEqual(steps[1]?.with, {
    'github-token': '${{ github.token }}',
    'policy-file': '.github/docs-impact.yml',
    enforcement: 'audit',
  });
});

test('audit pilot intake keeps repository disclosure optional and requires authorization', () => {
  const path = '.github/ISSUE_TEMPLATE/audit-pilot.yml';
  assert.equal(existsSync(path), true, 'expected the audit pilot issue form');

  const form = readYaml(path);
  const body = form.body as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(body));

  const fields = new Map(
    body
      .filter((item) => typeof item.id === 'string')
      .map((item) => [item.id as string, item]),
  );
  assert.deepEqual(
    [...fields.keys()],
    [
      'repository',
      'check-count',
      'observations',
      'false-positives',
      'authorization',
    ],
  );

  const repository = fields.get('repository');
  assert.equal(repository?.type, 'input');
  assert.deepEqual(repository?.validations, { required: false });
  const repositoryAttributes = repository?.attributes as Record<
    string,
    unknown
  >;
  assert.match(
    String(repositoryAttributes.description),
    /public.*authorized|authorized.*public/iu,
  );

  const authorization = fields.get('authorization');
  assert.equal(authorization?.type, 'checkboxes');
  const authorizationAttributes = authorization?.attributes as Record<
    string,
    unknown
  >;
  const options = authorizationAttributes.options as Array<
    Record<string, unknown>
  >;
  assert.equal(options.length, 1);
  assert.equal(options[0]?.required, true);
  assert.match(String(options[0]?.label), /authorized|permission/iu);
});

test('publisher root contains exactly one action metadata file', () => {
  const metadataFiles = readdirSync('.').filter((name) =>
    /^action\.ya?ml$/u.test(name),
  );

  assert.deepEqual(metadataFiles, ['action.yml']);
});

test('Marketplace README audit example matches the real report renderer', () => {
  const rule: PolicyRule = {
    id: 'production-docs',
    description:
      'Production changes require user or architecture documentation.',
    ifChanged: ['src/**'],
    requireAny: ['docs/USAGE.md', 'docs/ARCHITECTURE.md'],
    decision: 'docs',
    minReasonLength: 15,
  };
  const result: RuleResult = {
    rule,
    outcome: 'violation',
    triggeringFiles: ['src/api/client.ts'],
    satisfyingFiles: [],
  };
  const evaluation: Evaluation = {
    passed: false,
    results: [result],
    violations: [result],
  };
  const readme = readFileSync('README.md', 'utf8');
  const example = readme.match(
    /## See it in action[\s\S]*?```text\n([\s\S]*?)\n```/u,
  );

  assert.ok(example, 'expected a text report under See it in action');
  assert.equal(example[1], renderReport(evaluation, 'audit'));
});
