import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readPullRequestData,
  type PullFilesClient,
  type PullRequestContext,
} from '../src/github.js';

function context(
  overrides: Partial<PullRequestContext> = {},
): PullRequestContext {
  return {
    eventName: 'pull_request',
    repo: { owner: 'octo-org', repo: 'docs-impact-demo' },
    payload: {
      pull_request: {
        number: 42,
        body: 'Only this event body may be used.',
      },
    },
    ...overrides,
  };
}

test('reads only pull-request filenames and event body', async () => {
  const route = Symbol('list-files');
  let receivedRoute: unknown;
  let receivedParameters: unknown;
  const client: PullFilesClient = {
    rest: { pulls: { listFiles: route } },
    paginate: async (actualRoute, parameters) => {
      receivedRoute = actualRoute;
      receivedParameters = parameters;
      return [
        {
          filename: './src\\index.ts',
          patch: 'SECRET SOURCE',
          additions: 99,
          deletions: 1,
          blob_url: 'https://example.invalid/secret',
        },
        { filename: 'docs/USAGE.md', patch: 'OTHER SECRET' },
      ];
    },
  };

  const result = await readPullRequestData(context(), client);

  assert.equal(receivedRoute, route);
  assert.deepEqual(receivedParameters, {
    owner: 'octo-org',
    repo: 'docs-impact-demo',
    pull_number: 42,
    per_page: 100,
  });
  assert.deepEqual(result, {
    owner: 'octo-org',
    repo: 'docs-impact-demo',
    pullNumber: 42,
    body: 'Only this event body may be used.',
    changedFiles: ['src/index.ts', 'docs/USAGE.md'],
  });
  assert.equal(JSON.stringify(result).includes('SECRET SOURCE'), false);
});

test('rejects events without valid pull-request identity', async () => {
  const client: PullFilesClient = {
    rest: { pulls: { listFiles: Symbol('unused') } },
    paginate: async () => [],
  };

  await assert.rejects(
    readPullRequestData(
      { eventName: 'push', repo: context().repo, payload: context().payload },
      client,
    ),
    /pull_request event/i,
  );
  await assert.rejects(
    readPullRequestData(
      { eventName: 'pull_request', repo: context().repo, payload: {} },
      client,
    ),
    /pull_request event/i,
  );
  await assert.rejects(
    readPullRequestData(
      context({ payload: { pull_request: { number: 0, body: null } } }),
      client,
    ),
    /pull request number/i,
  );
  await assert.rejects(
    readPullRequestData(
      context({ repo: { owner: '', repo: 'docs-impact-demo' } }),
      client,
    ),
    /repository identity/i,
  );
});

test('fails closed at the 3000-file API ceiling', async () => {
  const client: PullFilesClient = {
    rest: { pulls: { listFiles: Symbol('list-files') } },
    paginate: async () =>
      Array.from({ length: 3000 }, (_, index) => ({
        filename: `src/file-${index}.ts`,
      })),
  };

  await assert.rejects(readPullRequestData(context(), client), /3,?000.*file/i);
});
