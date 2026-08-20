import assert from 'node:assert/strict';
import test from 'node:test';

import type { PullFilesClient, PullRequestContext } from '../src/github.js';
import { runAction, type CoreApi, type RunDependencies } from '../src/run.js';

interface Harness {
  dependencies: RunDependencies;
  outputs: Map<string, unknown>;
  failures: string[];
  summaries: string[];
  events: string[];
}

function createHarness(
  filenames: string[],
  body: string | null = null,
): Harness {
  const outputs = new Map<string, unknown>();
  const failures: string[] = [];
  const summaries: string[] = [];
  const events: string[] = [];
  const inputs: Record<string, string> = {
    'github-token': 'test-token-value',
    'policy-file': 'tests/fixtures/valid-policy.yml',
  };
  const core: CoreApi = {
    getInput: (name) => {
      events.push(`input:${name}`);
      return inputs[name] ?? '';
    },
    setSecret: () => {
      events.push('secret');
    },
    setOutput: (name, value) => {
      outputs.set(name, value);
    },
    setFailed: (message) => {
      failures.push(message);
    },
  };
  const context: PullRequestContext = {
    eventName: 'pull_request',
    repo: { owner: 'octo-org', repo: 'docs-impact-demo' },
    payload: { pull_request: { number: 42, body } },
  };
  const client: PullFilesClient = {
    rest: { pulls: { listFiles: Symbol('list-files') } },
    paginate: async () => filenames.map((filename) => ({ filename })),
  };

  return {
    dependencies: {
      core,
      context,
      createClient: () => {
        events.push('client');
        return client;
      },
      getWorkspace: () => process.cwd(),
      writeSummary: async (markdown) => {
        summaries.push(markdown);
      },
    },
    outputs,
    failures,
    summaries,
    events,
  };
}

test('publishes passing outputs and one summary without failing', async () => {
  const harness = createHarness(['src/ui/button.ts', 'docs/USAGE.md']);

  await runAction(harness.dependencies);

  assert.equal(harness.outputs.get('result'), 'pass');
  assert.equal(harness.outputs.get('violations-count'), '0');
  assert.match(String(harness.outputs.get('report')), /^# Docs Impact Gate/u);
  assert.equal(harness.summaries.length, 1);
  assert.equal(harness.failures.length, 0);
});

test('publishes violation details before marking the action failed', async () => {
  const harness = createHarness(['src/ui/button.ts']);

  await runAction(harness.dependencies);

  assert.equal(harness.outputs.get('result'), 'fail');
  assert.equal(harness.outputs.get('violations-count'), '1');
  assert.equal(harness.outputs.get('report'), harness.summaries[0]);
  assert.deepEqual(harness.failures, [
    'Docs Impact Gate found 1 violation(s).',
  ]);
});

test('reports an actionable sanitized policy error', async () => {
  const harness = createHarness(['src/ui/button.ts']);
  harness.dependencies.core.getInput = (name) =>
    name === 'github-token' ? 'test-token-value' : 'missing-policy.yml';

  await runAction(harness.dependencies);

  assert.equal(harness.failures.length, 1);
  assert.match(
    harness.failures[0] ?? '',
    /could not evaluate.*missing-policy/iu,
  );
  assert.equal(harness.failures[0]?.includes('test-token-value'), false);
});

test('redacts token shapes and the raw pull-request body from errors', async () => {
  const body = 'RAW PULL REQUEST BODY';
  const harness = createHarness(['src/ui/button.ts'], body);
  harness.dependencies.createClient = () => ({
    rest: { pulls: { listFiles: Symbol('list-files') } },
    paginate: async () => {
      throw new Error(
        `Authorization Bearer abc123 test-token-value ghp_VISIBLE github_pat_VISIBLE ${body}`,
      );
    },
  });

  await runAction(harness.dependencies);

  const failure = harness.failures[0] ?? '';
  assert.equal(failure.includes('abc123'), false);
  assert.equal(failure.includes('test-token-value'), false);
  assert.equal(failure.includes('ghp_VISIBLE'), false);
  assert.equal(failure.includes('github_pat_VISIBLE'), false);
  assert.equal(failure.includes(body), false);
  assert.equal(failure.includes('***'), true);
});

test('does not echo malformed docs-impact YAML from the pull-request body', async () => {
  const marker = 'PRIVATE_BODY_MARKER';
  const harness = createHarness(
    ['src/ui/button.ts'],
    `\`\`\`docs-impact\ndocs: [${marker}\n\`\`\``,
  );

  await runAction(harness.dependencies);

  const failure = harness.failures[0] ?? '';
  assert.match(failure, /invalid docs-impact YAML/iu);
  assert.equal(failure.includes(marker), false);
});

test('masks the GitHub token before creating the client', async () => {
  const harness = createHarness(['marketing/POSITIONING.md']);

  await runAction(harness.dependencies);

  assert.ok(harness.events.indexOf('secret') >= 0);
  assert.ok(
    harness.events.indexOf('client') > harness.events.indexOf('secret'),
  );
});
