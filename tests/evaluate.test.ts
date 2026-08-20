import assert from 'node:assert/strict';
import test from 'node:test';

import type { Policy } from '../src/domain.js';
import { evaluatePolicy } from '../src/evaluate.js';

const policy: Policy = {
  version: 1,
  rules: [
    {
      id: 'user-docs',
      description: 'UI changes require user documentation.',
      ifChanged: ['src/ui/**', 'src/index.ts'],
      requireAny: ['docs/USAGE.md'],
      decision: 'docs',
      minReasonLength: 15,
    },
    {
      id: 'changelog',
      description: 'Source changes require a changelog decision.',
      ifChanged: ['src/index.ts'],
      requireAny: ['CHANGELOG.md'],
      decision: 'changelog',
      minReasonLength: 15,
    },
    {
      id: 'version',
      description: 'Source changes require a version decision.',
      ifChanged: ['src/index.ts'],
      requireAny: ['package.json'],
      decision: 'version',
      minReasonLength: 15,
    },
  ],
};

test('does not trigger unrelated rules', () => {
  const evaluation = evaluatePolicy(policy, ['marketing/POSITIONING.md'], {});

  assert.equal(evaluation.passed, true);
  assert.equal(
    evaluation.results.every((result) => result.outcome === 'not-triggered'),
    true,
  );
});

test('passes when a required path changes', () => {
  const evaluation = evaluatePolicy(
    policy,
    ['src/ui/button.ts', 'docs/USAGE.md'],
    {},
  );

  assert.equal(evaluation.results[0]?.outcome, 'required-file-changed');
});

test('passes with a sufficiently detailed explicit decision', () => {
  const evaluation = evaluatePolicy(policy, ['src/ui/button.ts'], {
    docs: 'Internal refactor only; user behavior remains unchanged.',
  });

  assert.equal(evaluation.results[0]?.outcome, 'explicit-decision');
});

test('fails closed when the decision is absent or too short', () => {
  const missing = evaluatePolicy(policy, ['src/ui/button.ts'], {});
  const short = evaluatePolicy(policy, ['src/ui/button.ts'], {
    docs: 'No change.',
  });

  assert.equal(missing.violations.length, 1);
  assert.equal(short.violations.length, 1);
});

test('evaluates every triggered rule and keeps deterministic order', () => {
  const evaluation = evaluatePolicy(policy, ['src/index.ts'], {});

  assert.deepEqual(
    evaluation.violations.map((item) => item.rule.id),
    ['user-docs', 'changelog', 'version'],
  );
});

test('matches dotfiles and de-duplicates normalized changed paths', () => {
  const dotfilePolicy: Policy = {
    version: 1,
    rules: [
      {
        id: 'dotfiles',
        description: 'Dotfile changes require documentation.',
        ifChanged: ['src/**'],
        requireAny: ['docs/**'],
        decision: 'docs',
        minReasonLength: 15,
      },
    ],
  };

  const evaluation = evaluatePolicy(
    dotfilePolicy,
    ['src\\.config', './src/.config', 'docs\\.notes'],
    {},
  );

  assert.deepEqual(evaluation.results[0]?.triggeringFiles, ['src/.config']);
  assert.deepEqual(evaluation.results[0]?.satisfyingFiles, ['docs/.notes']);
  assert.equal(evaluation.results[0]?.outcome, 'required-file-changed');
});

test('handles overlapping globs once and counts Unicode code points', () => {
  const unicodePolicy: Policy = {
    version: 1,
    rules: [
      {
        id: 'unicode',
        description: 'Unicode reasons are counted by code point.',
        ifChanged: ['src/**', 'src/ui/**'],
        requireAny: ['docs/**'],
        decision: 'docs',
        minReasonLength: 10,
      },
    ],
  };

  const evaluation = evaluatePolicy(unicodePolicy, ['src/ui/button.ts'], {
    docs: '🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀',
  });

  assert.deepEqual(evaluation.results[0]?.triggeringFiles, [
    'src/ui/button.ts',
  ]);
  assert.equal(evaluation.results[0]?.outcome, 'explicit-decision');
});
