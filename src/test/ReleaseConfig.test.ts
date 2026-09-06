import { describe, expect, test } from 'vitest';
import {
  findChangelogMarker,
  insertChangelogEntry,
  nextVersion,
  parseReleaseConfig,
  renderReleaseConfig,
  replaceVersion,
  versionFromTag,
  type ReleaseConfig,
} from '../model/ReleaseConfig';

const config: ReleaseConfig = {
  version: 1,
  tagPattern: '^v(?<version>\\d+\\.\\d+\\.\\d+)$',
  versionFiles: [
    { path: 'package.json', find: '"version": "#"' },
  ],
  changelog: { path: 'CHANGELOG.md' },
};

describe('release configuration', () => {
  test('round trips through YAML', () => {
    expect(parseReleaseConfig(renderReleaseConfig(config))).toStrictEqual(config);
  });

  test('extracts versions using a named group', () => {
    expect(versionFromTag('v2.4.1', config.tagPattern)).toBe('2.4.1');
    expect(versionFromTag('release-2.4.1', config.tagPattern)).toBeNull();
  });

  test('replaces a version in an optional find template', () => {
    const source = '{\n  "name": "demo",\n  "version": "1.2.3"\n}\n';
    expect(replaceVersion(source, config.versionFiles[0]!.find, '1.2.3', '1.3.0')).toStrictEqual({
      contents: '{\n  "name": "demo",\n  "version": "1.3.0"\n}\n',
      found: true,
      previousVersion: '1.2.3',
    });
  });

  test('finds the bare version when no template is configured', () => {
    expect(replaceVersion('version = 1.2.3', undefined, '1.2.3', '1.3.0').contents)
      .toBe('version = 1.3.0');
  });

  test('increments semantic versions', () => {
    expect(nextVersion('v1.2.3', 'major')).toBe('v2.0.0');
    expect(nextVersion('v1.2.3', 'minor')).toBe('v1.3.0');
    expect(nextVersion('v1.2.3', 'patch')).toBe('v1.2.4');
  });
});

describe('changelog markers', () => {
  test('inserts newest entries after a newest-first marker', () => {
    const source = '# Changelog\n\n<!-- humperdinck: releases order=newest-first heading=2 -->\n\n## v1.0.0\n\nOld.\n';
    const marker = findChangelogMarker(source)!;
    expect(insertChangelogEntry(source, marker, 'v1.1.0', 'New.')).toContain(
      '<!-- humperdinck: releases order=newest-first heading=2 -->\n\n## v1.1.0\n\nNew.\n\n## v1.0.0',
    );
  });

  test('inserts oldest entries before a newest-last marker', () => {
    const source = '# Changelog\n\n## v1.0.0\n\nOld.\n\n<!-- humperdinck: releases order=newest-last heading=3 -->\n';
    const marker = findChangelogMarker(source)!;
    expect(insertChangelogEntry(source, marker, 'v1.1.0', 'New.')).toContain(
      'Old.\n\n### v1.1.0\n\nNew.\n\n<!-- humperdinck: releases order=newest-last heading=3 -->',
    );
  });
});
