import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

interface RecordedRequest {
  method: string | undefined;
  url: string | undefined;
  authorization: string | undefined;
  body: string;
}

interface BundleResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  summary: string;
  requests: RecordedRequest[];
}

const policy = `version: 1
rules:
  - id: user-docs
    description: UI changes require user documentation.
    if_changed:
      - src/ui/**
    require_any:
      - docs/USAGE.md
    decision: docs
    min_reason_length: 15
`;

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function runBundle(
  changedFiles: Array<Record<string, unknown>>,
  pullRequestBody: string,
): Promise<BundleResult> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'docs-impact-bundle-'));
  const outputPath = join(temporaryRoot, 'output.txt');
  const summaryPath = join(temporaryRoot, 'summary.md');
  const eventPath = join(temporaryRoot, 'event.json');
  const policyPath = join(temporaryRoot, 'policy.yml');
  const requests: RecordedRequest[] = [];
  const server = createServer(async (request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      body: await readRequestBody(request),
    });
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'x-github-api-version-selected': '2022-11-28',
    });
    response.end(JSON.stringify(changedFiles));
  });

  try {
    await Promise.all([
      writeFile(
        eventPath,
        JSON.stringify({
          repository: {
            name: 'docs-impact-demo',
            owner: { login: 'octo-org' },
          },
          pull_request: { number: 42, body: pullRequestBody },
        }),
      ),
      writeFile(policyPath, policy),
      writeFile(outputPath, ''),
      writeFile(summaryPath, ''),
    ]);
    await new Promise<void>((resolveListen, rejectListen) => {
      server.once('error', rejectListen);
      server.listen(0, '127.0.0.1', () => resolveListen());
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');

    const child = spawn(process.execPath, [resolve('dist/index.js')], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GITHUB_API_URL: `http://127.0.0.1:${address.port}`,
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_OUTPUT: outputPath,
        GITHUB_REPOSITORY: 'octo-org/docs-impact-demo',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_WORKSPACE: temporaryRoot,
        'INPUT_GITHUB-TOKEN': 'local-bundle-test-token',
        'INPUT_POLICY-FILE': 'policy.yml',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    const exitCode = await new Promise<number | null>(
      (resolveExit, rejectExit) => {
        child.once('error', rejectExit);
        child.once('exit', resolveExit);
      },
    );

    return {
      exitCode,
      stdout,
      stderr,
      output: await readFile(outputPath, 'utf8'),
      summary: await readFile(summaryPath, 'utf8'),
      requests,
    };
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function apiFile(filename: string, patch: string): Record<string, unknown> {
  return {
    sha: '0123456789abcdef0123456789abcdef01234567',
    filename,
    status: 'modified',
    additions: 1,
    deletions: 1,
    changes: 2,
    blob_url: `https://github.example/blob/${filename}`,
    raw_url: `https://github.example/raw/${filename}`,
    contents_url: `https://api.github.example/contents/${filename}`,
    patch,
  };
}

test(
  'packaged action passes and uses only the list-files API boundary',
  { timeout: 10_000 },
  async () => {
    const result = await runBundle(
      [
        apiFile('src/ui/button.ts', 'PRIVATE SOURCE PATCH'),
        apiFile('docs/USAGE.md', 'PRIVATE DOCUMENT PATCH'),
      ],
      'PRIVATE PULL REQUEST BODY',
    );

    assert.equal(result.exitCode, 0);
    assert.match(result.output, /result<<[^\n]+\npass\n/u);
    assert.match(result.output, /violations-count<<[^\n]+\n0\n/u);
    assert.match(result.output, /report<<[^\n]+\n# Docs Impact Gate/u);
    assert.match(result.summary, /PASS.*0 violations/u);
    assert.deepEqual(result.requests, [
      {
        method: 'GET',
        url: '/repos/octo-org/docs-impact-demo/pulls/42/files?per_page=100',
        authorization: 'token local-bundle-test-token',
        body: '',
      },
    ]);
    for (const destination of [
      result.stdout,
      result.stderr,
      result.output,
      result.summary,
    ]) {
      assert.equal(destination.includes('PRIVATE SOURCE PATCH'), false);
      assert.equal(destination.includes('PRIVATE DOCUMENT PATCH'), false);
      assert.equal(destination.includes('PRIVATE PULL REQUEST BODY'), false);
    }
  },
);

test(
  'packaged action publishes a report before failing a violation',
  { timeout: 10_000 },
  async () => {
    const result = await runBundle(
      [apiFile('src/ui/button.ts', 'PRIVATE SOURCE PATCH')],
      'No decision block.',
    );

    assert.equal(result.exitCode, 1);
    assert.match(result.output, /result<<[^\n]+\nfail\n/u);
    assert.match(result.output, /violations-count<<[^\n]+\n1\n/u);
    assert.match(result.summary, /FAIL.*1 violation/u);
    assert.match(result.summary, /user-docs/u);
    assert.equal(result.stderr.includes('PRIVATE SOURCE PATCH'), false);
  },
);
