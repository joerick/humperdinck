export type DiffKind = 'context' | 'addition' | 'deletion' | 'skip';

export interface DiffLine {
  kind: DiffKind;
  content: string;
  oldLine?: number;
  newLine?: number;
}

const CONTEXT_LINES = 3;
const MAX_LCS_CELLS = 1_000_000;

export function createLineDiff(before: string, after: string): DiffLine[] {
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  const prefixLength = sharedPrefixLength(oldLines, newLines);
  const suffixLength = sharedSuffixLength(oldLines, newLines, prefixLength);
  const oldMiddle = oldLines.slice(prefixLength, oldLines.length - suffixLength);
  const newMiddle = newLines.slice(prefixLength, newLines.length - suffixLength);

  const operations = [
    ...oldLines.slice(0, prefixLength).map(content => ({ kind: 'context' as const, content })),
    ...diffMiddle(oldMiddle, newMiddle),
    ...oldLines.slice(oldLines.length - suffixLength).map(content => ({ kind: 'context' as const, content })),
  ];

  let oldLine = 1;
  let newLine = 1;
  const numbered = operations.map(operation => {
    if (operation.kind === 'addition') return { ...operation, newLine: newLine++ };
    if (operation.kind === 'deletion') return { ...operation, oldLine: oldLine++ };
    return { ...operation, oldLine: oldLine++, newLine: newLine++ };
  });
  return compactContext(numbered);
}

function sharedPrefixLength(left: string[], right: string[]): number {
  const limit = Math.min(left.length, right.length);
  let length = 0;
  while (length < limit && left[length] === right[length]) length += 1;
  return length;
}

function sharedSuffixLength(left: string[], right: string[], prefixLength: number): number {
  const limit = Math.min(left.length, right.length) - prefixLength;
  let length = 0;
  while (length < limit && left[left.length - 1 - length] === right[right.length - 1 - length]) length += 1;
  return length;
}

function diffMiddle(oldLines: string[], newLines: string[]): Array<{ kind: Exclude<DiffKind, 'skip'>; content: string }> {
  if (oldLines.length * newLines.length > MAX_LCS_CELLS) {
    return [
      ...oldLines.map(content => ({ kind: 'deletion' as const, content })),
      ...newLines.map(content => ({ kind: 'addition' as const, content })),
    ];
  }

  const lengths = Array.from({ length: oldLines.length + 1 }, () =>
    Array<number>(newLines.length + 1).fill(0));
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      lengths[oldIndex]![newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? lengths[oldIndex + 1]![newIndex + 1]! + 1
        : Math.max(lengths[oldIndex + 1]![newIndex]!, lengths[oldIndex]![newIndex + 1]!);
    }
  }

  const result: Array<{ kind: Exclude<DiffKind, 'skip'>; content: string }> = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      result.push({ kind: 'context', content: oldLines[oldIndex]! });
      oldIndex += 1;
      newIndex += 1;
    } else if (
      newIndex < newLines.length &&
      (oldIndex >= oldLines.length || lengths[oldIndex]![newIndex + 1]! > lengths[oldIndex + 1]![newIndex]!)
    ) {
      result.push({ kind: 'addition', content: newLines[newIndex++]! });
    } else {
      result.push({ kind: 'deletion', content: oldLines[oldIndex++]! });
    }
  }
  return result;
}

function compactContext(lines: DiffLine[]): DiffLine[] {
  const visible = new Set<number>();
  lines.forEach((line, index) => {
    if (line.kind !== 'context') {
      for (let nearby = Math.max(0, index - CONTEXT_LINES); nearby <= Math.min(lines.length - 1, index + CONTEXT_LINES); nearby += 1) {
        visible.add(nearby);
      }
    }
  });

  const compact: DiffLine[] = [];
  lines.forEach((line, index) => {
    if (visible.has(index)) compact.push(line);
    else if (visible.has(index - 1) || index === 0) compact.push({ kind: 'skip', content: '…' });
  });
  return compact;
}
