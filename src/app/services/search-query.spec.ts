import { describe, expect, it } from 'vitest';
import {
  formatSearchQuery,
  getSearchChips,
  parseSearchQuery,
  removeSearchChip
} from './search-query';
import { SearchParseError } from './search.types';

describe('structured search query', () => {
  it('parses Boolean precedence, implicit AND, grouping, and negation', () => {
    const query = parseSearchQuery('alpha OR beta gamma AND NOT (delta OR -epsilon)');

    expect(query.expression?.kind).toBe('or');
    const right = query.expression?.kind === 'or' ? query.expression.operands[1] : null;
    expect(right?.kind).toBe('and');
    expect(formatSearchQuery(query)).toBe('alpha OR beta AND gamma AND NOT (delta OR NOT epsilon)');
  });

  it('parses phrases and escaped quotes and backslashes', () => {
    const query = parseSearchQuery('title:"API \\"guide\\"" path:"Work \\\\ Notes"');

    expect(formatSearchQuery(query)).toBe('title:"API \\"guide\\"" AND path:"Work \\\\ Notes"');
  });

  it('keeps URL schemes compatible with unqualified text search', () => {
    const query = parseSearchQuery('https://example.com/docs');

    expect(query.expression).toEqual(expect.objectContaining({
      kind: 'text',
      value: 'https://example.com/docs'
    }));
  });

  it('validates fields, comparators, dates, durations, and enums', () => {
    const query = parseSearchQuery(
      'type:bookmark score:>=4 source:manual added:>=2024-01-01 used:<2025-01-01 age:6m unused:>30d is:tagged'
    );

    expect(getSearchChips(query)).toHaveLength(8);
    expect(formatSearchQuery(query)).toContain('score:>=4');
    expect(formatSearchQuery(query)).toContain('age:6m');
  });

  it.each([
    ['unknown:value', 0],
    ['score:6', 6],
    ['added:2024-02-31', 6],
    ['unused:soon', 7],
    ['title:"open', 6],
    ['alpha OR', 8]
  ])('reports a positioned error for %s', (source, position) => {
    expect(() => parseSearchQuery(source)).toThrow(SearchParseError);
    try {
      parseSearchQuery(source);
    } catch (error) {
      expect((error as SearchParseError).position).toBe(position);
    }
  });

  it('round trips chips through the canonical formatter and supports removal', () => {
    const query = parseSearchQuery('work tag:"Type Script" score:>=4');
    const chips = getSearchChips(query);
    const withoutTag = removeSearchChip(query, 1);

    expect(chips).toEqual(['work', 'tag:"Type Script"', 'score:>=4']);
    expect(formatSearchQuery(withoutTag)).toBe('work AND score:>=4');
    expect(parseSearchQuery(formatSearchQuery(query))).toEqual(expect.objectContaining({ version: 1 }));
  });
});
