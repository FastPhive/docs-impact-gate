import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDecisionBlock } from '../src/decisions.js';

test('parses one fenced docs-impact YAML block', () => {
  const decisions = parseDecisionBlock(`Context

\`\`\`docs-impact
docs: Internal refactor; user behavior is unchanged.
changelog: No release note because behavior is unchanged.
\`\`\``);

  assert.equal(
    decisions.docs,
    'Internal refactor; user behavior is unchanged.',
  );
  assert.equal(
    decisions.changelog,
    'No release note because behavior is unchanged.',
  );
});

test('returns an empty map when no decision block exists', () => {
  assert.deepEqual(parseDecisionBlock('ordinary pull request body'), {});
});

test('rejects duplicate blocks, unknown keys, and non-string values', () => {
  assert.throws(
    () =>
      parseDecisionBlock(
        '```docs-impact\ndocs: First reason is sufficiently long.\n```\n```docs-impact\ndocs: Second reason is sufficiently long.\n```',
      ),
    /exactly one/i,
  );
  assert.throws(
    () =>
      parseDecisionBlock(
        '```docs-impact\nrelease_notes: Not required for this internal change.\n```',
      ),
    /unsupported decision/i,
  );
  assert.throws(
    () => parseDecisionBlock('```docs-impact\ndocs: [not, text]\n```'),
    /must be text/i,
  );
});

test('rejects aliases and nested decision values', () => {
  assert.throws(
    () =>
      parseDecisionBlock(
        '```docs-impact\ndocs: &reason This reason is long enough.\nchangelog: *reason\n```',
      ),
    /alias/i,
  );
  assert.throws(
    () =>
      parseDecisionBlock(
        '```docs-impact\ndocs:\n  reason: Nested values are forbidden.\n```',
      ),
    /must be text/i,
  );
});
