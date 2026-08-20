import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { parse } from 'yaml';

import {
  decisionKeys,
  type DecisionKey,
  type Policy,
  type PolicyRule,
} from './domain.js';

const policyKeys = new Set(['version', 'rules']);
const ruleKeys = new Set([
  'id',
  'description',
  'if_changed',
  'require_any',
  'decision',
  'min_reason_length',
]);
const safeRuleId = /^[a-z][a-z0-9-]{1,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  context: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${context} contains unsupported key: ${key}`);
    }
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be non-empty text`);
  }

  return value.trim();
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must be a non-empty list`);
  }

  return value.map((item, index) => requireString(item, `${field}[${index}]`));
}

function hasAbsolutePrefix(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(value);
}

export function normalizeRepositoryPath(repositoryPath: string): string {
  if (repositoryPath.includes('\0')) {
    throw new Error('Repository path contains a NUL byte');
  }

  const slashed = repositoryPath.replaceAll('\\', '/');
  if (slashed.trim().length === 0) {
    throw new Error('Repository path must not be empty');
  }
  if (hasAbsolutePrefix(slashed)) {
    throw new Error('Repository path must be relative');
  }

  const segments = slashed.split('/');
  if (segments.includes('..')) {
    throw new Error('Repository path traversal is not allowed');
  }

  const normalized = segments
    .filter((segment) => segment !== '' && segment !== '.')
    .join('/');
  if (normalized.length === 0) {
    throw new Error('Repository path must not be empty');
  }

  return normalized;
}

function normalizeGlob(pattern: string, field: string): string {
  if (pattern.includes('\\')) {
    throw new Error(`${field} must use forward slashes`);
  }

  return normalizeRepositoryPath(pattern);
}

function parseRule(value: unknown, index: number): PolicyRule {
  if (!isRecord(value)) {
    throw new Error(`rules[${index}] must be a mapping`);
  }
  assertExactKeys(value, ruleKeys, `rules[${index}]`);

  const id = requireString(value.id, `rules[${index}].id`);
  if (!safeRuleId.test(id)) {
    throw new Error(`rules[${index}].id is not a safe rule id`);
  }

  const decision = requireString(value.decision, `rules[${index}].decision`);
  if (!(decisionKeys as readonly string[]).includes(decision)) {
    throw new Error(`rules[${index}].decision is unsupported`);
  }

  const rawMinimum = value.min_reason_length ?? 15;
  if (
    !Number.isInteger(rawMinimum) ||
    (rawMinimum as number) < 10 ||
    (rawMinimum as number) > 500
  ) {
    throw new Error(
      `rules[${index}].min_reason_length must be an integer from 10 through 500`,
    );
  }

  return {
    id,
    description: requireString(
      value.description,
      `rules[${index}].description`,
    ),
    ifChanged: requireStringArray(
      value.if_changed,
      `rules[${index}].if_changed`,
    ).map((pattern, patternIndex) =>
      normalizeGlob(pattern, `rules[${index}].if_changed[${patternIndex}]`),
    ),
    requireAny: requireStringArray(
      value.require_any,
      `rules[${index}].require_any`,
    ).map(normalizeRepositoryPath),
    decision: decision as DecisionKey,
    minReasonLength: rawMinimum as number,
  };
}

function resolvePolicyPath(policyFile: string, workspace: string): string {
  if (
    policyFile.includes('\0') ||
    isAbsolute(policyFile) ||
    hasAbsolutePrefix(policyFile)
  ) {
    throw new Error('Policy file is outside the workspace');
  }

  const workspacePath = realpathSync(workspace);
  const requestedPath = resolve(workspacePath, policyFile);
  const lexicalRelative = relative(workspacePath, requestedPath);
  if (
    lexicalRelative === '..' ||
    lexicalRelative.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  ) {
    throw new Error('Policy file is outside the workspace');
  }

  const actualPath = realpathSync(requestedPath);
  const actualRelative = relative(workspacePath, actualPath);
  if (
    actualRelative === '..' ||
    actualRelative.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  ) {
    throw new Error('Policy file is outside the workspace');
  }

  return actualPath;
}

export function loadPolicy(policyFile: string, workspace: string): Policy {
  const contents = readFileSync(
    resolvePolicyPath(policyFile, workspace),
    'utf8',
  );
  const parsed: unknown = parse(contents, { strict: true, uniqueKeys: true });

  if (!isRecord(parsed)) {
    throw new Error('Policy must be a mapping');
  }
  assertExactKeys(parsed, policyKeys, 'Policy');
  if (parsed.version !== 1) {
    throw new Error('Policy version must be 1');
  }
  if (!Array.isArray(parsed.rules) || parsed.rules.length === 0) {
    throw new Error('Policy rules must be a non-empty list');
  }

  const rules = parsed.rules.map(parseRule);
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) {
      throw new Error(`Duplicate rule id: ${rule.id}`);
    }
    seen.add(rule.id);
  }

  return { version: 1, rules };
}
