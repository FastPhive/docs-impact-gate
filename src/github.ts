import type { PullRequestData } from './domain.js';
import { normalizeRepositoryPath } from './policy.js';

export interface PullRequestContext {
  eventName: string;
  repo: {
    owner: string;
    repo: string;
  };
  payload: {
    pull_request?: {
      number?: number;
      body?: unknown;
    };
  };
}

interface PullFile {
  filename?: unknown;
}

export interface PullFilesClient {
  rest: {
    pulls: {
      listFiles: unknown;
    };
  };
  paginate: (
    route: unknown,
    parameters: {
      owner: string;
      repo: string;
      pull_number: number;
      per_page: 100;
    },
  ) => Promise<readonly PullFile[]>;
}

export async function readPullRequestData(
  context: PullRequestContext,
  client: PullFilesClient,
): Promise<PullRequestData> {
  const pullRequest = context.payload.pull_request;
  if (context.eventName !== 'pull_request' || !pullRequest) {
    throw new Error('Docs Impact Gate requires a pull_request event');
  }

  const owner = context.repo.owner.trim();
  const repo = context.repo.repo.trim();
  if (!owner || !repo) {
    throw new Error('GitHub repository identity is missing');
  }

  const pullNumber = pullRequest.number;
  if (!Number.isSafeInteger(pullNumber) || (pullNumber ?? 0) <= 0) {
    throw new Error('GitHub pull request number is invalid');
  }

  const files = await client.paginate(client.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber as number,
    per_page: 100,
  });
  if (files.length >= 3000) {
    throw new Error(
      'GitHub returned 3,000 or more files; evaluation stopped because the changed-file list may be truncated',
    );
  }

  const changedFiles = files.map((file, index) => {
    if (typeof file.filename !== 'string') {
      throw new Error(`GitHub changed file ${index + 1} has no valid filename`);
    }
    return normalizeRepositoryPath(file.filename);
  });

  return {
    owner,
    repo,
    pullNumber: pullNumber as number,
    body: typeof pullRequest.body === 'string' ? pullRequest.body : null,
    changedFiles,
  };
}
