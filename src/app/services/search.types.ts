export const SEARCH_QUERY_VERSION = 1 as const;

export type SearchNodeType = 'bookmark' | 'folder';
export type SearchComparisonOperator = '=' | '<' | '<=' | '>' | '>=';
export type SearchTextField = 'title' | 'url' | 'host' | 'tag' | 'path';
export type SearchField = SearchTextField
  | 'type'
  | 'score'
  | 'source'
  | 'added'
  | 'used'
  | 'age'
  | 'unused'
  | 'is';

export interface SearchDocument {
  id: string;
  type: SearchNodeType;
  title: string;
  url: string;
  hostname: string;
  tags: string[];
  path: string;
  ancestorIds: string[];
  dateAdded?: number;
  dateLastUsed?: number;
  usefulnessScore?: 1 | 2 | 3 | 4 | 5;
  usefulnessSource?: 'ai' | 'manual';
  quarantined: boolean;
}

export interface SearchSourceRange {
  start: number;
  end: number;
}

export interface SearchTextExpression extends SearchSourceRange {
  kind: 'text';
  value: string;
}

export interface SearchFieldExpression extends SearchSourceRange {
  kind: 'field';
  field: SearchField;
  operator: SearchComparisonOperator;
  value: string;
}

export interface SearchNotExpression extends SearchSourceRange {
  kind: 'not';
  operand: SearchExpression;
}

export interface SearchBooleanExpression extends SearchSourceRange {
  kind: 'and' | 'or';
  operands: SearchExpression[];
}

export type SearchExpression = SearchTextExpression
  | SearchFieldExpression
  | SearchNotExpression
  | SearchBooleanExpression;

export interface SearchQueryAst {
  version: typeof SEARCH_QUERY_VERSION;
  expression: SearchExpression | null;
}

export class SearchParseError extends Error {
  constructor(message: string, public readonly position: number) {
    super(message);
    this.name = 'SearchParseError';
  }
}

export interface SearchIndexRequest {
  type: 'index';
  requestId: number;
  documents: SearchDocument[];
}

export interface SearchQueryRequest {
  type: 'query';
  requestId: number;
  query: SearchQueryAst;
  scopeFolderId?: string;
  now: number;
}

export type SearchRequest = SearchIndexRequest | SearchQueryRequest;

export interface SearchResult {
  type: 'result';
  requestId: number;
  nodeIds: string[];
}

export interface SearchIndexResult {
  type: 'indexed';
  requestId: number;
}

export interface SearchErrorResult {
  type: 'error';
  requestId: number;
  message: string;
}

export type SearchWorkerResult = SearchResult | SearchIndexResult | SearchErrorResult;
