import { minimatch } from 'minimatch';

import type { DecisionMap, Evaluation, Policy, RuleResult } from './domain.js';
import { normalizeRepositoryPath } from './policy.js';

const matchOptions = { dot: true, nocase: false } as const;

function comparePaths(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function matchesAny(filename: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(filename, pattern, matchOptions));
}

export function evaluatePolicy(
  policy: Policy,
  changedFiles: string[],
  decisions: DecisionMap,
): Evaluation {
  const normalizedFiles = [
    ...new Set(changedFiles.map(normalizeRepositoryPath)),
  ].sort(comparePaths);

  const results: RuleResult[] = policy.rules.map((rule) => {
    const triggeringFiles = normalizedFiles.filter((filename) =>
      matchesAny(filename, rule.ifChanged),
    );
    if (triggeringFiles.length === 0) {
      return {
        rule,
        outcome: 'not-triggered',
        triggeringFiles,
        satisfyingFiles: [],
      };
    }

    const satisfyingFiles = normalizedFiles.filter((filename) =>
      matchesAny(filename, rule.requireAny),
    );
    if (satisfyingFiles.length > 0) {
      return {
        rule,
        outcome: 'required-file-changed',
        triggeringFiles,
        satisfyingFiles,
      };
    }

    const reason = decisions[rule.decision]?.trim();
    if (reason && [...reason].length >= rule.minReasonLength) {
      return {
        rule,
        outcome: 'explicit-decision',
        triggeringFiles,
        satisfyingFiles,
      };
    }

    return {
      rule,
      outcome: 'violation',
      triggeringFiles,
      satisfyingFiles,
    };
  });
  const violations = results.filter((result) => result.outcome === 'violation');

  return {
    passed: violations.length === 0,
    results,
    violations,
  };
}
