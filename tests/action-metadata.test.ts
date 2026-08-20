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
  assert.deepEqual(Object.keys(metadata.inputs as object), [
    'github-token',
    'policy-file',
  ]);
  assert.deepEqual(Object.keys(metadata.outputs as object), [
    'result',
    'violations-count',
    'report',
  ]);
  assert.equal(existsSync('.github/docs-impact.yml'), true);
});
