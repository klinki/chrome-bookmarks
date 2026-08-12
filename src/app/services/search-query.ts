import {
  SEARCH_QUERY_VERSION,
  SearchBooleanExpression,
  SearchComparisonOperator,
  SearchExpression,
  SearchField,
  SearchParseError,
  SearchQueryAst
} from './search.types';

type TokenKind = 'word' | 'phrase' | 'left' | 'right' | 'minus';

interface Token {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
}

const FIELDS = new Set<SearchField>([
  'title', 'url', 'host', 'tag', 'path', 'type', 'score', 'source',
  'added', 'used', 'age', 'unused', 'is'
]);
const IS_VALUES = new Set([
  'tagged', 'untagged', 'rated', 'unrated', 'usage-unknown', 'quarantined'
]);
const COMPARISON_FIELDS = new Set<SearchField>(['score', 'added', 'used', 'age', 'unused']);

export function tokenizeSearchQuery(source: string): ReadonlyArray<Token> {
  const tokens: Token[] = [];
  let position = 0;
  while (position < source.length) {
    if (/\s/u.test(source[position])) {
      position++;
      continue;
    }
    const start = position;
    if (source[position] === '(') {
      tokens.push({ kind: 'left', value: '(', start, end: ++position });
      continue;
    }
    if (source[position] === ')') {
      tokens.push({ kind: 'right', value: ')', start, end: ++position });
      continue;
    }
    if (source[position] === '-') {
      tokens.push({ kind: 'minus', value: '-', start, end: ++position });
      continue;
    }
    if (source[position] === '"') {
      const phrase = readQuoted(source, position);
      tokens.push(phrase.token);
      position = phrase.next;
      continue;
    }

    let value = '';
    while (position < source.length && !/[\s()]/u.test(source[position])) {
      if (source[position] === '"' && value.endsWith(':')) {
        break;
      }
      if (source[position] === '\\') {
        if (position + 1 >= source.length) {
          throw new SearchParseError('Trailing escape character', position);
        }
        value += source[position + 1];
        position += 2;
      } else {
        value += source[position++];
      }
    }
    tokens.push({ kind: 'word', value, start, end: position });
  }
  return tokens;
}

function readQuoted(source: string, start: number): { token: Token; next: number } {
  let position = start + 1;
  let value = '';
  while (position < source.length) {
    if (source[position] === '"') {
      return {
        token: { kind: 'phrase', value, start, end: position + 1 },
        next: position + 1
      };
    }
    if (source[position] === '\\') {
      if (position + 1 >= source.length) {
        throw new SearchParseError('Trailing escape character', position);
      }
      const escaped = source[position + 1];
      if (escaped !== '"' && escaped !== '\\') {
        throw new SearchParseError('Only quotes and backslashes may be escaped in a phrase', position);
      }
      value += escaped;
      position += 2;
    } else {
      value += source[position++];
    }
  }
  throw new SearchParseError('Unclosed quoted phrase', start);
}

export function parseSearchQuery(source: string): SearchQueryAst {
  const tokens = tokenizeSearchQuery(source);
  if (tokens.length === 0) {
    return { version: SEARCH_QUERY_VERSION, expression: null };
  }
  const parser = new Parser(tokens, source.length);
  const expression = parser.parseOr();
  parser.assertComplete();
  return { version: SEARCH_QUERY_VERSION, expression };
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: ReadonlyArray<Token>, private readonly sourceLength: number) {}

  public parseOr(): SearchExpression {
    const operands = [this.parseAnd()];
    while (this.isKeyword(this.peek(), 'OR')) {
      this.take();
      operands.push(this.parseAnd());
    }
    return joinBoolean('or', operands);
  }

  private parseAnd(): SearchExpression {
    const operands = [this.parseUnary()];
    while (true) {
      if (this.isKeyword(this.peek(), 'AND')) {
        this.take();
        operands.push(this.parseUnary());
        continue;
      }
      const next = this.peek();
      if (next && next.kind !== 'right' && !this.isKeyword(next, 'OR')) {
        operands.push(this.parseUnary());
        continue;
      }
      break;
    }
    return joinBoolean('and', operands);
  }

  private parseUnary(): SearchExpression {
    const token = this.peek();
    if (token?.kind === 'minus' || this.isKeyword(token, 'NOT')) {
      const operator = this.take()!;
      if (!this.peek()) {
        throw new SearchParseError('Expected an expression after negation', operator.end);
      }
      const operand = this.parseUnary();
      return { kind: 'not', operand, start: operator.start, end: operand.end };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): SearchExpression {
    const token = this.take();
    if (!token) {
      throw new SearchParseError('Expected a search expression', this.sourceLength);
    }
    if (token.kind === 'left') {
      if (this.peek()?.kind === 'right') {
        throw new SearchParseError('Empty groups are not allowed', token.start);
      }
      const expression = this.parseOr();
      const closing = this.take();
      if (closing?.kind !== 'right') {
        throw new SearchParseError('Expected a closing parenthesis', closing?.start ?? this.sourceLength);
      }
      return { ...expression, start: token.start, end: closing.end };
    }
    if (token.kind === 'right') {
      throw new SearchParseError('Unexpected closing parenthesis', token.start);
    }
    if (token.kind === 'minus') {
      throw new SearchParseError('Expected an expression after negation', token.end);
    }
    if (this.isKeyword(token, 'AND') || this.isKeyword(token, 'OR')) {
      throw new SearchParseError(`Unexpected ${token.value.toUpperCase()}`, token.start);
    }
    return this.parsePredicate(token);
  }

  private parsePredicate(token: Token): SearchExpression {
    if (token.kind === 'phrase') {
      return { kind: 'text', value: token.value, start: token.start, end: token.end };
    }
    const colon = token.value.indexOf(':');
    if (colon < 0) {
      return { kind: 'text', value: token.value, start: token.start, end: token.end };
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(token.value)) {
      return { kind: 'text', value: token.value, start: token.start, end: token.end };
    }
    const rawField = token.value.slice(0, colon).toLowerCase();
    if (!FIELDS.has(rawField as SearchField)) {
      throw new SearchParseError(`Unknown field “${rawField}”`, token.start);
    }
    const field = rawField as SearchField;
    let rawValue = token.value.slice(colon + 1);
    let end = token.end;
    if (!rawValue) {
      const valueToken = this.peek();
      if (!valueToken || (valueToken.kind !== 'word' && valueToken.kind !== 'phrase')) {
        throw new SearchParseError(`Expected a value for ${field}:`, token.end);
      }
      if (valueToken.kind === 'word'
        && ['AND', 'OR', 'NOT'].includes(valueToken.value.toUpperCase())) {
        throw new SearchParseError(`Expected a value for ${field}:`, valueToken.start);
      }
      this.take();
      rawValue = valueToken.value;
      end = valueToken.end;
    }
    const { operator, value } = splitComparator(field, rawValue, token.start + colon + 1);
    validateFieldValue(field, value, token.start + colon + 1);
    return { kind: 'field', field, operator, value, start: token.start, end };
  }

  public assertComplete(): void {
    const token = this.peek();
    if (token) {
      throw new SearchParseError(`Unexpected token “${token.value}”`, token.start);
    }
  }

  private isKeyword(token: Token | undefined, keyword: string): boolean {
    return token?.kind === 'word' && token.value.toUpperCase() === keyword;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private take(): Token | undefined {
    return this.tokens[this.index++];
  }
}

function joinBoolean(kind: 'and' | 'or', operands: SearchExpression[]): SearchExpression {
  if (operands.length === 1) {
    return operands[0];
  }
  return {
    kind,
    operands,
    start: operands[0].start,
    end: operands[operands.length - 1].end
  } satisfies SearchBooleanExpression;
}

function splitComparator(
  field: SearchField,
  rawValue: string,
  position: number
): { operator: SearchComparisonOperator; value: string } {
  if (!COMPARISON_FIELDS.has(field)) {
    return { operator: '=', value: rawValue };
  }
  const match = /^(<=|>=|=|<|>)(.*)$/u.exec(rawValue);
  const operator = (match?.[1] ?? (field === 'age' || field === 'unused' ? '>=' : '=')) as SearchComparisonOperator;
  const value = match?.[2] ?? rawValue;
  if (!value) {
    throw new SearchParseError(`Expected a value after ${operator}`, position + operator.length);
  }
  return { operator, value };
}

function validateFieldValue(field: SearchField, value: string, position: number): void {
  const normalized = value.toLowerCase();
  if (field === 'type' && normalized !== 'bookmark' && normalized !== 'folder') {
    throw new SearchParseError('type: must be bookmark or folder', position);
  }
  if (field === 'source' && normalized !== 'ai' && normalized !== 'manual') {
    throw new SearchParseError('source: must be ai or manual', position);
  }
  if (field === 'is' && !IS_VALUES.has(normalized)) {
    throw new SearchParseError(`Unknown is: filter “${value}”`, position);
  }
  if (field === 'score' && !/^[1-5]$/u.test(value)) {
    throw new SearchParseError('score: must be an integer from 1 to 5', position);
  }
  if ((field === 'added' || field === 'used') && !isValidIsoDate(value)) {
    throw new SearchParseError(`${field}: must use YYYY-MM-DD`, position);
  }
  if ((field === 'age' || field === 'unused') && !/^\d+(?:d|m|y)$/iu.test(value)) {
    throw new SearchParseError(`${field}: must use a duration such as 30d, 6m, or 2y`, position);
  }
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) {
    return false;
  }
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(timestamp);
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

export function formatSearchQuery(query: SearchQueryAst): string {
  return query.expression ? formatExpression(query.expression, 0) : '';
}

function formatExpression(expression: SearchExpression, parentPrecedence: number): string {
  const precedence = expression.kind === 'or' ? 1 : expression.kind === 'and' ? 2 : expression.kind === 'not' ? 3 : 4;
  let formatted: string;
  if (expression.kind === 'text') {
    formatted = formatValue(expression.value);
  } else if (expression.kind === 'field') {
    const comparator = COMPARISON_FIELDS.has(expression.field)
      && !(expression.operator === '>=' && (expression.field === 'age' || expression.field === 'unused'))
      ? expression.operator
      : '';
    formatted = `${expression.field}:${comparator}${formatValue(expression.value)}`;
  } else if (expression.kind === 'not') {
    formatted = `NOT ${formatExpression(expression.operand, precedence)}`;
  } else {
    formatted = expression.operands
      .map(operand => formatExpression(operand, precedence))
      .join(expression.kind === 'and' ? ' AND ' : ' OR ');
  }
  return precedence < parentPrecedence ? `(${formatted})` : formatted;
}

function formatValue(value: string): string {
  if (value !== '' && !/[\s()"\\:]/u.test(value) && !/^(?:AND|OR|NOT)$/iu.test(value)) {
    return value;
  }
  return `"${value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`;
}

export function getSearchChips(query: SearchQueryAst): ReadonlyArray<string> {
  if (!query.expression) {
    return [];
  }
  const expressions = query.expression.kind === 'and'
    ? query.expression.operands
    : [query.expression];
  return expressions.map(expression => formatSearchQuery({
    version: SEARCH_QUERY_VERSION,
    expression
  }));
}

export function removeSearchChip(query: SearchQueryAst, index: number): SearchQueryAst {
  if (!query.expression) {
    return query;
  }
  const expressions = query.expression.kind === 'and'
    ? [...query.expression.operands]
    : [query.expression];
  if (index < 0 || index >= expressions.length) {
    return query;
  }
  expressions.splice(index, 1);
  return {
    version: SEARCH_QUERY_VERSION,
    expression: expressions.length === 0 ? null : joinBoolean('and', expressions)
  };
}
