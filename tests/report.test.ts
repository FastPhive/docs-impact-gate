import assert from 'node:assert/strict';
import test from 'node:test';

import type { Evaluation, PolicyRule, RuleResult } from '../src/domain.js';
import { renderReport } from '../src/report.js';

function evaluationWith(
  rule: PolicyRule,
  outcome: 'explicit-decision' | 'violation',
): Evaluation {
  const result: RuleResult = {
    rule,
    outcome,
    triggeringFiles: ['src/ui/button.ts'],
    satisfyingFiles: [],
  };

  return {
    passed: outcome !== 'violation',
    results: [result],
    violations: outcome === 'violation' ? [result] : [],
  };
}

const baseRule: PolicyRule = {
  id: 'user-docs',
  description: 'UI changes require user documentation.',
  ifChanged: ['src/ui/**'],
  requireAny: ['docs/USAGE.md', 'docs/ARCHITECTURE.md'],
  decision: 'docs',
  minReasonLength: 15,
};

test('renders deterministic status, rule details, and repair guidance', () => {
  const report = renderReport(evaluationWith(baseRule, 'violation'));

  assert.equal(report.startsWith('# Docs Impact Gate'), true);
  assert.match(report, /FAIL.*1 violation/u);
  assert.match(report, /user-docs/u);
  assert.match(report, /UI changes require user documentation\./u);
  assert.match(report, /src\/ui\/\*\*/u);
  assert.match(report, /docs\/USAGE\.md/u);
  assert.match(report, /violation/u);
  assert.match(report, /Add.*required path.*docs-impact/isu);
});

test('renders a passing report with zero violations', () => {
  const report = renderReport(evaluationWith(baseRule, 'explicit-decision'));

  assert.match(report, /PASS.*0 violations/u);
  assert.match(report, /explicit-decision/u);
});

test('escapes and truncates untrusted fields without leaking unrelated data', () => {
  const repeated = 'X'.repeat(400);
  const rule: PolicyRule = {
    ...baseRule,
    id: 'unsafe|id',
    description: `[label] <tag> \`code\`\\line\n${repeated}`,
  };
  const evaluation = evaluationWith(rule, 'violation') as Evaluation & {
    decisionReason?: string;
    pullRequestBody?: string;
    token?: string;
    source?: string;
  };
  evaluation.decisionReason = 'PRIVATE DECISION REASON';
  evaluation.pullRequestBody = 'RAW PULL REQUEST BODY';
  evaluation.token = 'ghp_EXAMPLE_SHOULD_NOT_APPEAR';
  evaluation.source = 'SECRET SOURCE CONTENT';

  const report = renderReport(evaluation);

  assert.equal(report.includes('unsafe|id'), false);
  assert.match(report, /unsafe\\\|id/u);
  assert.equal(report.includes('<tag>'), false);
  assert.equal(report.includes('line\n'), false);
  assert.equal(report.includes('X'.repeat(301)), false);
  assert.equal(report.includes('PRIVATE DECISION REASON'), false);
  assert.equal(report.includes('RAW PULL REQUEST BODY'), false);
  assert.equal(report.includes('ghp_EXAMPLE_SHOULD_NOT_APPEAR'), false);
  assert.equal(report.includes('SECRET SOURCE CONTENT'), false);
});

test('caps the complete report with a deterministic notice', () => {
  const results = Array.from({ length: 200 }, (_, index) => ({
    rule: {
      ...baseRule,
      id: `rule-${index}`,
      description: `Description ${index} ${'X'.repeat(400)}`,
    },
    outcome: 'violation' as const,
    triggeringFiles: [`src/generated/file-${index}-${'Y'.repeat(400)}.ts`],
    satisfyingFiles: [],
  }));
  const evaluation: Evaluation = {
    passed: false,
    results,
    violations: results,
  };

  const report = renderReport(evaluation);

  assert.ok(report.length <= 50_000);
  assert.equal(
    report.endsWith(
      '_Report truncated at the deterministic 50,000-character limit._',
    ),
    true,
  );
});
