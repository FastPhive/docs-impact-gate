import type { EnforcementMode, Evaluation } from './domain.js';

const fieldLimit = 300;
const reportLimit = 50_000;
const truncationNotice =
  '\n\n_Report truncated at the deterministic 50,000-character limit._';
const classicTokenPattern = new RegExp(
  `\\b${String.fromCharCode(103, 104, 112, 95)}[A-Za-z0-9_]+`,
  'gu',
);
const fineGrainedTokenPattern = new RegExp(
  `\\b${String.fromCharCode(103, 105, 116, 104, 117, 98, 95, 112, 97, 116, 95)}[A-Za-z0-9_]+`,
  'gu',
);

function redactTokenShapes(value: string): string {
  return value
    .replace(classicTokenPattern, '***')
    .replace(fineGrainedTokenPattern, '***')
    .replace(/\bBearer\s+[^\s]+/giu, 'Bearer ***');
}

function renderField(value: string): string {
  const points = [...redactTokenShapes(value)];
  const limited =
    points.length > fieldLimit
      ? `${points.slice(0, fieldLimit).join('')}…`
      : points.join('');

  return limited
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '\\|')
    .replace(/\r\n?|\n/gu, ' ↵ ');
}

function renderList(values: string[]): string {
  return values.length > 0
    ? values.map((value) => renderField(value)).join(', ')
    : 'none';
}

function capReport(report: string): string {
  if (report.length <= reportLimit) {
    return report;
  }

  return `${report.slice(0, reportLimit - truncationNotice.length)}${truncationNotice}`;
}

export function renderReport(
  evaluation: Evaluation,
  enforcement: EnforcementMode = 'block',
): string {
  const lines = [
    '# Docs Impact Gate',
    '',
    evaluation.passed
      ? `**PASS — ${evaluation.violations.length} violations.**`
      : enforcement === 'audit'
        ? `**AUDIT — ${evaluation.violations.length} violation(s) found; the step was not blocked.**`
        : `**FAIL — ${evaluation.violations.length} violation(s).**`,
  ];
  const triggered = evaluation.results.filter(
    (result) => result.outcome !== 'not-triggered',
  );

  if (triggered.length === 0) {
    lines.push('', 'No policy rules were triggered.');
  }

  for (const result of triggered) {
    lines.push(
      '',
      `## Rule: ${renderField(result.rule.id)}`,
      '',
      `- Description: ${renderField(result.rule.description)}`,
      `- Trigger patterns: ${renderList(result.rule.ifChanged)}`,
      `- Triggering files: ${renderList(result.triggeringFiles)}`,
      `- Required paths (any): ${renderList(result.rule.requireAny)}`,
      `- Satisfying files: ${renderList(result.satisfyingFiles)}`,
      `- Decision: ${renderField(result.rule.decision)} (minimum ${result.rule.minReasonLength} characters)`,
      `- Outcome: ${result.outcome}`,
    );

    if (result.outcome === 'violation') {
      lines.push(
        '- Repair: Add at least one matching required path or provide a sufficiently detailed reason in the `docs-impact` block.',
      );
    }
  }

  return capReport(lines.join('\n'));
}
