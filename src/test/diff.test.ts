import { describe, expect, it } from 'vitest';
import { createLineDiff } from '@/diff';

describe('createLineDiff', () => {
  it('numbers additions and deletions as a unified diff', () => {
    expect(createLineDiff('one\ntwo\nthree', 'one\nchanged\nthree')).toEqual([
      { kind: 'context', content: 'one', oldLine: 1, newLine: 1 },
      { kind: 'deletion', content: 'two', oldLine: 2 },
      { kind: 'addition', content: 'changed', newLine: 2 },
      { kind: 'context', content: 'three', oldLine: 3, newLine: 3 },
    ]);
  });

  it('collapses unchanged sections to three lines of context', () => {
    const before = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join('\n');
    const after = before.replace('line 7', 'changed');
    const result = createLineDiff(before, after);

    expect(result[0]).toEqual({ kind: 'skip', content: '…' });
    expect(result.at(-1)).toEqual({ kind: 'skip', content: '…' });
    expect(result).toContainEqual({ kind: 'deletion', content: 'line 7', oldLine: 7 });
    expect(result).toContainEqual({ kind: 'addition', content: 'changed', newLine: 7 });
  });

  it('handles large files without allocating a full-file comparison matrix', () => {
    const lines = Array.from({ length: 5_000 }, (_, index) => `line ${index + 1}`);
    const changed = [...lines];
    changed[2_500] = 'changed';

    const result = createLineDiff(lines.join('\n'), changed.join('\n'));
    expect(result).toContainEqual({ kind: 'deletion', content: 'line 2501', oldLine: 2501 });
    expect(result).toContainEqual({ kind: 'addition', content: 'changed', newLine: 2501 });
    expect(result.length).toBeLessThan(20);
  });
});
