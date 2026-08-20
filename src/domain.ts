export const decisionKeys = ['docs', 'changelog', 'version'] as const;
export type DecisionKey = (typeof decisionKeys)[number];

export interface PolicyRule {
  id: string;
  description: string;
  ifChanged: string[];
  requireAny: string[];
  decision: DecisionKey;
  minReasonLength: number;
}

export interface Policy {
  version: 1;
  rules: PolicyRule[];
}

export type DecisionMap = Partial<Record<DecisionKey, string>>;

export interface PullRequestData {
  owner: string;
  repo: string;
  pullNumber: number;
  body: string | null;
  changedFiles: string[];
}

export type RuleOutcome =
  'not-triggered' | 'required-file-changed' | 'explicit-decision' | 'violation';

export interface RuleResult {
  rule: PolicyRule;
  outcome: RuleOutcome;
  triggeringFiles: string[];
  satisfyingFiles: string[];
}

export interface Evaluation {
  passed: boolean;
  results: RuleResult[];
  violations: RuleResult[];
}
