import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

test('action metadata exposes the minimal Node 24 read-only contract', () => {
  const metadata = parse(readFileSync('action.yml', 'utf8')) as Record<
    string,
    unknown
  >;

  assert.deepEqual(metadata.runs, {
    using: 'node24',
    main: 'dist/index.js',
  });
  const inputs = metadata.inputs as Record<string, unknown>;
  assert.deepEqual(Object.keys(inputs), [
    'github-token',
    'policy-file',
    'enforcement',
  ]);
  assert.deepEqual(inputs.enforcement, {
    description:
      'Choose audit to report violations without blocking, or block to fail the step.',
    required: false,
    default: 'block',
  });
  assert.deepEqual(Object.keys(metadata.outputs as object), [
    'result',
    'violations-count',
    'report',
  ]);
  assert.equal(existsSync('.github/docs-impact.yml'), true);
});

test('action metadata states the high-intent audit-first positioning', () => {
  const metadata = parse(readFileSync('action.yml', 'utf8')) as Record<
    string,
    unknown
  >;
  const description = String(metadata.description);

  assert.equal(
    description,
    'Deterministic PR policy gate for documentation, changelog, and version decisions — audit-first, no source upload or LLM.',
  );
  assert.ok(description.length <= 125);
});
