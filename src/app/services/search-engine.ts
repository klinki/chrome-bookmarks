import {
  SearchComparisonOperator,
  SearchDocument,
  SearchExpression,
  SearchQueryAst
} from './search.types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function executeSearch(
  documents: readonly SearchDocument[],
  query: SearchQueryAst,
  scopeFolderId: string | undefined,
  now: number
): string[] {
  const includeQuarantined = containsPositiveQuarantineFilter(query.expression);
  return documents
    .filter(document => !scopeFolderId || document.ancestorIds.includes(scopeFolderId))
    .filter(document => includeQuarantined || !document.quarantined)
    .filter(document => !query.expression || matchesExpression(document, query.expression, now))
    .map(document => document.id);
}

function matchesExpression(document: SearchDocument, expression: SearchExpression, now: number): boolean {
  if (expression.kind === 'and') {
    return expression.operands.every(operand => matchesExpression(document, operand, now));
  }
  if (expression.kind === 'or') {
    return expression.operands.some(operand => matchesExpression(document, operand, now));
  }
  if (expression.kind === 'not') {
    return !matchesExpression(document, expression.operand, now);
  }
  if (expression.kind === 'text') {
    const needle = normalizeSearchText(expression.value);
    return [document.title, document.url, document.hostname, document.path, ...document.tags]
      .some(value => normalizeSearchText(value).includes(needle));
  }
  if (expression.kind !== 'field') {
    return false;
  }

  const value = expression.value.toLowerCase();
  switch (expression.field) {
    case 'title': return includes(document.title, value);
    case 'url': return includes(document.url, value);
    case 'host': return includes(document.hostname, value);
    case 'tag': return document.tags.some(tag => includes(tag, value));
    case 'path': return includes(document.path, value);
    case 'type': return document.type === value;
    case 'source': return document.usefulnessSource === value;
    case 'score': return compareOptional(document.usefulnessScore, Number(value), expression.operator);
    case 'added': return compareDateOptional(document.dateAdded, isoTimestamp(value), expression.operator);
    case 'used': return compareDateOptional(document.dateLastUsed, isoTimestamp(value), expression.operator);
    case 'age': return compareOptional(
      document.dateAdded === undefined ? undefined : now - document.dateAdded,
      durationMilliseconds(value),
      expression.operator
    );
    case 'unused': return compareOptional(
      document.dateLastUsed === undefined ? undefined : now - document.dateLastUsed,
      durationMilliseconds(value),
      expression.operator
    );
    case 'is': return matchesIs(document, value);
  }
}

function matchesIs(document: SearchDocument, value: string): boolean {
  switch (value) {
    case 'tagged': return document.tags.length > 0;
    case 'untagged': return document.tags.length === 0;
    case 'rated': return document.usefulnessScore !== undefined;
    case 'unrated': return document.usefulnessScore === undefined;
    case 'usage-unknown': return document.dateLastUsed === undefined;
    case 'quarantined': return document.quarantined;
    default: return false;
  }
}

function containsPositiveQuarantineFilter(expression: SearchExpression | null, negated = false): boolean {
  if (!expression) {
    return false;
  }
  if (expression.kind === 'not') {
    return containsPositiveQuarantineFilter(expression.operand, !negated);
  }
  if (expression.kind === 'and' || expression.kind === 'or') {
    return expression.operands.some(operand => containsPositiveQuarantineFilter(operand, negated));
  }
  return !negated && expression.kind === 'field'
    && expression.field === 'is'
    && expression.value.toLowerCase() === 'quarantined';
}

function includes(haystack: string, needle: string): boolean {
  return normalizeSearchText(haystack).includes(normalizeSearchText(needle));
}

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

function compareDateOptional(
  actual: number | undefined,
  expectedDayStart: number,
  operator: SearchComparisonOperator
): boolean {
  if (actual === undefined || !Number.isFinite(expectedDayStart)) {
    return false;
  }
  switch (operator) {
    case '=': return actual >= expectedDayStart && actual < expectedDayStart + DAY_MS;
    case '<': return actual < expectedDayStart;
    case '<=': return actual < expectedDayStart + DAY_MS;
    case '>': return actual >= expectedDayStart + DAY_MS;
    case '>=': return actual >= expectedDayStart;
  }
}

function compareOptional(
  actual: number | undefined,
  expected: number,
  operator: SearchComparisonOperator
): boolean {
  if (actual === undefined || !Number.isFinite(expected)) {
    return false;
  }
  switch (operator) {
    case '=': return actual === expected;
    case '<': return actual < expected;
    case '<=': return actual <= expected;
    case '>': return actual > expected;
    case '>=': return actual >= expected;
  }
}

function isoTimestamp(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

export function durationMilliseconds(value: string): number {
  const match = /^(\d+)(d|m|y)$/iu.exec(value);
  if (!match) {
    return Number.NaN;
  }
  const days = match[2].toLowerCase() === 'd'
    ? 1
    : match[2].toLowerCase() === 'm' ? 30 : 365;
  return Number(match[1]) * days * DAY_MS;
}
