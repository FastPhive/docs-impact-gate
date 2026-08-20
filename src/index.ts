import * as core from '@actions/core';
import * as github from '@actions/github';

import type { PullFilesClient, PullRequestContext } from './github.js';
import { runAction } from './run.js';

void runAction({
  core,
  context: github.context as PullRequestContext,
  createClient: (token) =>
    github.getOctokit(token) as unknown as PullFilesClient,
  getWorkspace: () => process.env.GITHUB_WORKSPACE ?? '',
  writeSummary: async (markdown) => {
    await core.summary.addRaw(markdown).write();
  },
});
