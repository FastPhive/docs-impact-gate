import { parseDecisionBlock } from './decisions.js';
import { evaluatePolicy } from './evaluate.js';
import {
  readPullRequestData,
  type PullFilesClient,
  type PullRequestContext,
} from './github.js';
import { loadPolicy } from './policy.js';
import { renderReport } from './report.js';

export interface CoreApi {
  getInput: (name: string, options?: { required?: boolean }) => string;
  setSecret: (secret: string) => void;
  setOutput: (name: string, value: unknown) => void;
  setFailed: (message: string) => void;
}

export interface RunDependencies {
  core: CoreApi;
  context: PullRequestContext;
  createClient: (token: string) => PullFilesClient;
  getWorkspace: () => string;
  writeSummary: (markdown: string) => Promise<void>;
}

const classicTokenPrefix = String.fromCharCode(103, 104, 112, 95);
const fineGrainedTokenPrefix = String.fromCharCode(
  103,
  105,
  116,
  104,
  117,
  98,
  95,
  112,
  97,
  116,
  95,
);

function replaceLiteral(value: string, secret: string): string {
  return secret ? value.split(secret).join('***') : value;
}

function sanitizeError(
  error: unknown,
  suppliedToken: string,
  pullRequestBody: unknown,
): string {
  const original = error instanceof Error ? error.message : String(error);
  const classicPattern = new RegExp(
    `\\b${classicTokenPrefix}[A-Za-z0-9_]+`,
    'gu',
  );
  const fineGrainedPattern = new RegExp(
    `\\b${fineGrainedTokenPrefix}[A-Za-z0-9_]+`,
    'gu',
  );
  let sanitized = replaceLiteral(original, suppliedToken)
    .replace(classicPattern, '***')
    .replace(fineGrainedPattern, '***')
    .replace(/\bBearer\s+\S+/giu, 'Bearer ***');

  if (typeof pullRequestBody === 'string') {
    sanitized = replaceLiteral(sanitized, pullRequestBody);
  }

  sanitized = sanitized.replace(/\r\n?|\n/gu, ' ').trim();
  const points = [...sanitized];
  return points.length > 1000
    ? `${points.slice(0, 999).join('')}…`
    : points.join('');
}

export async function runAction(dependencies: RunDependencies): Promise<void> {
  let suppliedToken = '';

  try {
    suppliedToken = dependencies.core.getInput('github-token', {
      required: true,
    });
    dependencies.core.setSecret(suppliedToken);
    if (!suppliedToken) {
      throw new Error('The github-token input is required');
    }

    const policyFile =
      dependencies.core.getInput('policy-file') || '.github/docs-impact.yml';
    const workspace = dependencies.getWorkspace();
    if (!workspace) {
      throw new Error('GITHUB_WORKSPACE is unavailable');
    }

    const policy = loadPolicy(policyFile, workspace);
    const client = dependencies.createClient(suppliedToken);
    const pullRequest = await readPullRequestData(dependencies.context, client);
    const decisions = parseDecisionBlock(pullRequest.body);
    const evaluation = evaluatePolicy(
      policy,
      pullRequest.changedFiles,
      decisions,
    );
    const report = renderReport(evaluation);

    await dependencies.writeSummary(report);
    dependencies.core.setOutput('result', evaluation.passed ? 'pass' : 'fail');
    dependencies.core.setOutput(
      'violations-count',
      String(evaluation.violations.length),
    );
    dependencies.core.setOutput('report', report);

    if (!evaluation.passed) {
      dependencies.core.setFailed(
        `Docs Impact Gate found ${evaluation.violations.length} violation(s).`,
      );
    }
  } catch (error) {
    const message = sanitizeError(
      error,
      suppliedToken,
      dependencies.context.payload.pull_request?.body,
    );
    dependencies.core.setFailed(
      `Docs Impact Gate could not evaluate the pull request: ${message || 'unknown error'}`,
    );
  }
}
