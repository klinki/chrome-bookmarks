import {
  CleanupAnalysisInput,
  CleanupAnalysisRequest,
  CleanupAnalysisResponse,
  CleanupAnalysisResult,
  CleanupFinding,
  CleanupNodeSnapshot,
  CleanupReason,
  DuplicateGroup,
  DuplicateKind
} from '../services/cleanup.types';

const TRACKING_PARAMETERS = new Set(['gclid', 'fbclid', 'mc_cid', 'mc_eid']);
const CLEANUP_REASON_FOLDER_NAMES = new Set([
  'Exact duplicates',
  'Probable duplicates',
  'Stale',
  'Unknown usage',
  'Untagged',
  'Unrated',
  'Low usefulness',
  'Empty folders'
]);

const CLEANUP_REASONS: CleanupReason[] = [
  'exact-duplicate',
  'probable-duplicate',
  'stale',
  'unknown-usage',
  'untagged',
  'unrated',
  'low-usefulness',
  'empty-folder',
  'quarantined'
];

export function normalizeProbableDuplicateUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const port = isDefaultPort(protocol, url.port) ? '' : url.port;
  const credentials = url.username
    ? `${url.username}${url.password ? `:${url.password}` : ''}@`
    : '';
  const authority = `${credentials}${hostname}${port ? `:${port}` : ''}`;
  const path = rawPathname(value);
  const parameterEntries: Array<[string, string]> = [];
  url.searchParams.forEach((parameterValue, key) => {
    parameterEntries.push([key, parameterValue]);
  });
  const parameters = parameterEntries
    .filter(([key]) => !isTrackingParameter(key))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? compareStable(leftValue, rightValue)
        : compareStable(leftKey, rightKey));
  const query = parameters.length > 0
    ? `?${parameters.map(([key, parameterValue]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(parameterValue)}`).join('&')}`
    : '';

  return `${protocol}//${authority}${path}${query}`;
}

export function analyzeCleanup(
  input: CleanupAnalysisInput,
  requestId = 0
): CleanupAnalysisResult {
  const nodeMap = new Map(input.nodes.map(node => [node.id, node]));
  const cleanupRootIds = findCleanupRootIds(input.nodes, nodeMap);
  const excludedIds = findExcludedIds(input.nodes, nodeMap, cleanupRootIds);
  const quarantinedIds = findQuarantinedTopLevelIds(input.nodes, nodeMap, cleanupRootIds);
  const actionableNodes = input.nodes.filter(node => !excludedIds.has(node.id));
  const actionableBookmarks = actionableNodes.filter(node => Boolean(node.url));
  const reasonMap = new Map<string, Set<CleanupReason>>();
  const undatedIds = new Set<string>();

  const exactDuplicateGroups = buildDuplicateGroups(
    actionableBookmarks,
    'exact',
    node => node.url ?? '',
    input
  );
  const probableDuplicateGroups = buildDuplicateGroups(
    actionableBookmarks,
    'probable',
    node => normalizeProbableDuplicateUrl(node.url ?? ''),
    input,
    true
  );
  addGroupReasons(reasonMap, exactDuplicateGroups, 'exact-duplicate');
  addGroupReasons(reasonMap, probableDuplicateGroups, 'probable-duplicate');

  const staleCutoff = input.now - input.settings.staleDays * 24 * 60 * 60 * 1000;
  for (const node of actionableBookmarks) {
    if (isKnownTimestamp(node.dateLastUsed)) {
      if (node.dateLastUsed < staleCutoff) {
        addReason(reasonMap, node.id, 'stale');
      }
    } else if (isKnownTimestamp(node.dateAdded)) {
      if (node.dateAdded < staleCutoff) {
        addReason(reasonMap, node.id, 'unknown-usage');
      }
    } else {
      addReason(reasonMap, node.id, 'unknown-usage');
      undatedIds.add(node.id);
    }

    if ((input.tags[node.id]?.length ?? 0) === 0) {
      addReason(reasonMap, node.id, 'untagged');
    }
    const rating = input.usefulness[node.id];
    if (!rating) {
      addReason(reasonMap, node.id, 'unrated');
    } else if (rating.score <= 2) {
      addReason(reasonMap, node.id, 'low-usefulness');
    }
  }

  for (const node of actionableNodes) {
    if (node.isFolder && node.childCount === 0) {
      addReason(reasonMap, node.id, 'empty-folder');
    }
  }

  for (const nodeId of quarantinedIds) {
    addReason(reasonMap, nodeId, 'quarantined');
  }

  const findings = Array.from(reasonMap.entries())
    .map(([nodeId, reasons]): CleanupFinding | null => {
      const node = nodeMap.get(nodeId);
      if (!node) {
        return null;
      }
      return {
        nodeId,
        title: node.title,
        ...(node.url === undefined ? {} : { url: node.url }),
        ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
        ...(node.index === undefined ? {} : { index: node.index }),
        matchedReasons: CLEANUP_REASONS.filter(reason => reasons.has(reason)),
        actionable: !reasons.has('quarantined'),
        ...(undatedIds.has(nodeId) ? { undated: true } : {})
      };
    })
    .filter((finding): finding is CleanupFinding => finding !== null)
    .sort((left, right) => compareStable(left.nodeId, right.nodeId));

  const counts = Object.fromEntries(CLEANUP_REASONS.map(reason => [
    reason,
    findings.filter(finding => finding.matchedReasons.includes(reason)).length
  ])) as Record<CleanupReason, number>;

  return {
    requestId,
    analyzedAt: input.now,
    findings,
    exactDuplicateGroups,
    probableDuplicateGroups,
    counts,
    excludedNodeCount: excludedIds.size
  };
}

export function chooseDuplicateKeeper(
  bookmarkIds: string[],
  input: Pick<CleanupAnalysisInput, 'nodes' | 'tags' | 'usefulness'>
): string {
  const nodeMap = new Map(input.nodes.map(node => [node.id, node]));
  return [...bookmarkIds].sort((leftId, rightId) => {
    const left = nodeMap.get(leftId)!;
    const right = nodeMap.get(rightId)!;
    return compareDescending(knownTimestamp(left.dateLastUsed), knownTimestamp(right.dateLastUsed))
      || compareDescending(input.usefulness[leftId]?.score ?? 0, input.usefulness[rightId]?.score ?? 0)
      || compareDescending(input.tags[leftId]?.length ?? 0, input.tags[rightId]?.length ?? 0)
      || compareAscending(creationRank(left.dateAdded), creationRank(right.dateAdded))
      || compareStable(leftId, rightId);
  })[0] ?? '';
}

function buildDuplicateGroups(
  bookmarks: CleanupNodeSnapshot[],
  kind: DuplicateKind,
  keyForNode: (node: CleanupNodeSnapshot) => string | null,
  input: CleanupAnalysisInput,
  requireDistinctOriginalUrls = false
): DuplicateGroup[] {
  const grouped = new Map<string, CleanupNodeSnapshot[]>();
  for (const bookmark of bookmarks) {
    const key = keyForNode(bookmark);
    if (key === null || key === '') {
      continue;
    }
    const group = grouped.get(key) ?? [];
    group.push(bookmark);
    grouped.set(key, group);
  }

  return Array.from(grouped.entries())
    .filter(([, nodes]) => nodes.length > 1
      && (!requireDistinctOriginalUrls || new Set(nodes.map(node => node.url)).size > 1))
    .map(([normalizedUrl, nodes]) => {
      const bookmarkIds = nodes.map(node => node.id).sort(compareStable);
      return {
        id: `${kind}:${stableHash(normalizedUrl)}`,
        kind,
        normalizedUrl,
        bookmarkIds,
        keeperId: chooseDuplicateKeeper(bookmarkIds, input)
      };
    })
    .sort((left, right) => compareStable(left.normalizedUrl, right.normalizedUrl));
}

function findCleanupRootIds(
  nodes: CleanupNodeSnapshot[],
  nodeMap: ReadonlyMap<string, CleanupNodeSnapshot>
): Set<string> {
  const result = new Set<string>();
  for (const node of nodes) {
    if (!node.isFolder || node.title !== 'Cleanup') {
      continue;
    }
    const trash = node.parentId ? nodeMap.get(node.parentId) : undefined;
    const other = trash?.parentId ? nodeMap.get(trash.parentId) : undefined;
    if (trash?.title === 'Trash' && isOtherBookmarksRoot(other, nodeMap)) {
      result.add(node.id);
    }
  }
  return result;
}

function findExcludedIds(
  nodes: CleanupNodeSnapshot[],
  nodeMap: ReadonlyMap<string, CleanupNodeSnapshot>,
  cleanupRootIds: ReadonlySet<string>
): Set<string> {
  const excluded = new Set<string>();
  for (const node of nodes) {
    if (isPermanentRoot(node, nodeMap)
      || hasAncestorMatching(node, nodeMap, ancestor => ancestor.unmodifiable === 'managed')
      || hasAncestorMatching(node, nodeMap, ancestor => cleanupRootIds.has(ancestor.id))) {
      excluded.add(node.id);
    }
  }
  return excluded;
}

function findQuarantinedTopLevelIds(
  nodes: CleanupNodeSnapshot[],
  nodeMap: ReadonlyMap<string, CleanupNodeSnapshot>,
  cleanupRootIds: ReadonlySet<string>
): Set<string> {
  const result = new Set<string>();
  for (const node of nodes) {
    const parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
    if (!parent || !CLEANUP_REASON_FOLDER_NAMES.has(parent.title)) {
      continue;
    }
    const cleanup = parent.parentId ? nodeMap.get(parent.parentId) : undefined;
    if (cleanup && cleanupRootIds.has(cleanup.id)) {
      result.add(node.id);
    }
  }
  return result;
}

function isOtherBookmarksRoot(
  node: CleanupNodeSnapshot | undefined,
  nodeMap: ReadonlyMap<string, CleanupNodeSnapshot>
): boolean {
  if (!node?.isFolder) {
    return false;
  }
  const parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
  return node.id === '2'
    || (node.title === 'Other Bookmarks' && Boolean(parent) && parent?.parentId === undefined);
}

function isPermanentRoot(
  node: CleanupNodeSnapshot,
  nodeMap: ReadonlyMap<string, CleanupNodeSnapshot>
): boolean {
  if (!node.isFolder) {
    return false;
  }
  if (node.parentId === undefined) {
    return true;
  }
  return nodeMap.get(node.parentId)?.parentId === undefined;
}

function hasAncestorMatching(
  node: CleanupNodeSnapshot,
  nodeMap: ReadonlyMap<string, CleanupNodeSnapshot>,
  predicate: (node: CleanupNodeSnapshot) => boolean
): boolean {
  let current: CleanupNodeSnapshot | undefined = node;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (predicate(current)) {
      return true;
    }
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }
  return false;
}

function addGroupReasons(
  reasonMap: Map<string, Set<CleanupReason>>,
  groups: DuplicateGroup[],
  reason: CleanupReason
): void {
  for (const group of groups) {
    for (const bookmarkId of group.bookmarkIds) {
      addReason(reasonMap, bookmarkId, reason);
    }
  }
}

function addReason(
  reasonMap: Map<string, Set<CleanupReason>>,
  nodeId: string,
  reason: CleanupReason
): void {
  const reasons = reasonMap.get(nodeId) ?? new Set<CleanupReason>();
  reasons.add(reason);
  reasonMap.set(nodeId, reasons);
}

function rawPathname(value: string): string {
  const authorityStart = value.indexOf('//');
  if (authorityStart < 0) {
    return '';
  }
  const pathStart = value.indexOf('/', authorityStart + 2);
  const queryStart = value.indexOf('?', authorityStart + 2);
  const fragmentStart = value.indexOf('#', authorityStart + 2);
  const authorityEnd = [queryStart, fragmentStart]
    .filter(index => index >= 0)
    .reduce((minimum, index) => Math.min(minimum, index), value.length);
  if (pathStart < 0 || pathStart >= authorityEnd) {
    return '';
  }
  const pathEnd = [queryStart, fragmentStart]
    .filter(index => index >= pathStart)
    .reduce((minimum, index) => Math.min(minimum, index), value.length);
  return value.slice(pathStart, pathEnd);
}

function isTrackingParameter(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith('utm_') || TRACKING_PARAMETERS.has(normalized);
}

function isDefaultPort(protocol: string, port: string): boolean {
  return port === '' || (protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443');
}

function isKnownTimestamp(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function knownTimestamp(value: number | undefined): number {
  return isKnownTimestamp(value) ? value : Number.NEGATIVE_INFINITY;
}

function creationRank(value: number | undefined): number {
  return isKnownTimestamp(value) ? value : Number.POSITIVE_INFINITY;
}

function compareDescending(left: number, right: number): number {
  return right - left;
}

function compareAscending(left: number, right: number): number {
  return left - right;
}

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

interface CleanupWorkerScope {
  onmessage: ((event: MessageEvent<CleanupAnalysisRequest>) => void) | null;
  postMessage(message: CleanupAnalysisResponse): void;
}

const workerScope = typeof globalThis !== 'undefined'
  && 'postMessage' in globalThis
  && !('document' in globalThis)
  ? globalThis as unknown as CleanupWorkerScope
  : null;

if (workerScope) {
  workerScope.onmessage = ({ data }: MessageEvent<CleanupAnalysisRequest>) => {
    if (data.type !== 'analyze') {
      return;
    }
    let response: CleanupAnalysisResponse;
    try {
      response = {
        type: 'result',
        requestId: data.requestId,
        result: analyzeCleanup(data.input, data.requestId)
      };
    } catch (error) {
      response = {
        type: 'error',
        requestId: data.requestId,
        message: error instanceof Error ? error.message : String(error)
      };
    }
    workerScope.postMessage(response);
  };
}
