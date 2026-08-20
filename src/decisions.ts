import { isAlias, isMap, isScalar, parseDocument, visit } from 'yaml';

import { decisionKeys, type DecisionKey, type DecisionMap } from './domain.js';

const openingFence = /```docs-impact\b/gu;
const completeBlock = /```docs-impact[ \t]*\r?\n([\s\S]*?)\r?\n```/gu;

function isDecisionKey(value: string): value is DecisionKey {
  return (decisionKeys as readonly string[]).includes(value);
}

export function parseDecisionBlock(
  body: string | null | undefined,
): DecisionMap {
  if (!body) {
    return {};
  }

  const openings = [...body.matchAll(openingFence)];
  if (openings.length === 0) {
    return {};
  }

  const blocks = [...body.matchAll(completeBlock)];
  if (openings.length !== 1 || blocks.length !== 1) {
    throw new Error(
      'Pull request body must contain exactly one complete docs-impact block',
    );
  }

  const yamlSource = blocks[0]?.[1];
  if (yamlSource === undefined) {
    throw new Error('The docs-impact block is malformed');
  }

  const document = parseDocument(yamlSource, {
    schema: 'core',
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error('Invalid docs-impact YAML');
  }

  let containsAlias = false;
  visit(document, {
    Alias: () => {
      containsAlias = true;
      return visit.BREAK;
    },
  });
  if (containsAlias) {
    throw new Error('YAML aliases are not allowed in the docs-impact block');
  }

  if (!isMap(document.contents)) {
    throw new Error('The docs-impact block must be a YAML mapping');
  }

  const decisions: DecisionMap = {};
  for (const pair of document.contents.items) {
    if (!isScalar(pair.key) || typeof pair.key.value !== 'string') {
      throw new Error('Each decision key must be text');
    }

    const key = pair.key.value;
    if (!isDecisionKey(key)) {
      throw new Error('Unsupported decision key in docs-impact block');
    }
    if (!isScalar(pair.value) || typeof pair.value.value !== 'string') {
      throw new Error(`Decision ${key} must be text`);
    }

    decisions[key] = pair.value.value.trim();
  }

  return decisions;
}
