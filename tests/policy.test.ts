import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPolicy, normalizeRepositoryPath } from '../src/policy.js';

test('loads and maps a valid version 1 policy', () => {
  const policy = loadPolicy('tests/fixtures/valid-policy.yml', process.cwd());

  assert.equal(policy.rules[0]?.id, 'user-docs');
  assert.deepEqual(policy.rules[0]?.ifChanged, ['src/ui/**']);
  assert.equal(policy.rules[0]?.minReasonLength, 15);
});

test('rejects duplicate rule ids and unsupported keys', () => {
  assert.throws(
    () => loadPolicy('tests/fixtures/invalid-policy.yml', process.cwd()),
    /duplicate rule id|unsupported key/i,
  );
});

test('rejects a policy path outside the workspace', () => {
  assert.throws(
    () => loadPolicy('../secret.yml', process.cwd()),
    /outside the workspace/i,
  );
});

test('normalizes repository paths and rejects traversal', () => {
  assert.equal(
    normalizeRepositoryPath('./src\\ui\\button.ts'),
    'src/ui/button.ts',
  );
  assert.throws(() => normalizeRepositoryPath('../secret.txt'), /traversal/i);
});
