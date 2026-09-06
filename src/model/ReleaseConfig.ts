import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import Version from './Version';

export const RELEASE_CONFIG_PATH = '.humperdinck.yaml';
export const DEFAULT_TAG_PATTERN = 'v(?<version>\\d.*)';
export const CHANGELOG_MARKER_EXAMPLE = '<!-- humperdinck: releases order=newest-first heading=2 -->';

export interface VersionFileConfig {
    path: string;
    pattern: string;
}

export interface ReleaseConfig {
    version: 1;
    tagPattern: string;
    versionFiles: VersionFileConfig[];
    changelog: {
        path: string;
    };
}

export type ChangelogOrder = 'newest-first' | 'newest-last';

export interface ChangelogMarker {
    index: number;
    length: number;
    order: ChangelogOrder;
    heading: number;
    source: string;
}

export interface VersionReplacement {
    contents: string;
    found: boolean;
    previousVersion: string | null;
}

export function emptyReleaseConfig(): ReleaseConfig {
    return {
        version: 1,
        tagPattern: DEFAULT_TAG_PATTERN,
        versionFiles: [],
        changelog: { path: 'CHANGELOG.md' },
    };
}

export function parseReleaseConfig(source: string): ReleaseConfig {
    const value: unknown = parseYaml(source);
    if (!value || typeof value !== 'object') {
        throw new Error('The release configuration must be a YAML object.');
    }

    const data = value as Record<string, unknown>;
    if (data.version !== 1) {
        throw new Error('The release configuration must specify version: 1.');
    }
    if (typeof data.tagPattern !== 'string' || !data.tagPattern) {
        throw new Error('tagPattern must be a non-empty regular expression string.');
    }
    compilePattern(data.tagPattern, 'tagPattern');

    if (!Array.isArray(data.versionFiles)) {
        throw new Error('versionFiles must be a list.');
    }
    const versionFiles = data.versionFiles.map((item, index) => {
        if (!item || typeof item !== 'object') {
            throw new Error(`versionFiles[${index}] must be an object.`);
        }
        const file = item as Record<string, unknown>;
        if (typeof file.path !== 'string' || !file.path) {
            throw new Error(`versionFiles[${index}].path must be a non-empty string.`);
        }
        if (typeof file.pattern !== 'string' || !file.pattern) {
            throw new Error(`versionFiles[${index}].pattern must be a non-empty regular expression string.`);
        }
        compilePattern(file.pattern, `versionFiles[${index}].pattern`);
        return { path: file.path, pattern: file.pattern };
    });
    if (new Set(versionFiles.map(file => file.path)).size !== versionFiles.length) {
        throw new Error('Each versionFiles path must be unique.');
    }

    if (!data.changelog || typeof data.changelog !== 'object') {
        throw new Error('changelog must be an object.');
    }
    const changelog = data.changelog as Record<string, unknown>;
    if (typeof changelog.path !== 'string' || !changelog.path) {
        throw new Error('changelog.path must be a non-empty Markdown file path.');
    }
    if (!/\.md$/i.test(changelog.path)) {
        throw new Error('changelog.path must point to a Markdown (.md) file.');
    }

    return {
        version: 1,
        tagPattern: data.tagPattern,
        versionFiles,
        changelog: { path: changelog.path },
    };
}

export function renderReleaseConfig(config: ReleaseConfig): string {
    return stringifyYaml(config, { lineWidth: 0 });
}

export function compilePattern(pattern: string, label = 'Pattern'): RegExp {
    try {
        return new RegExp(pattern);
    } catch (error) {
        throw new Error(`${label} is not a valid regular expression: ${error instanceof Error ? error.message : error}`);
    }
}

export function versionFromTag(tag: string, tagPattern: string): string | null {
    const match = compilePattern(tagPattern, 'tagPattern').exec(tag);
    if (!match) return null;
    return match.groups?.version ?? match[1] ?? match[0];
}

export function nextVersion(current: string, increment: 'major' | 'minor' | 'patch'): string {
    const parsed = Version.parse(current);
    if (!parsed) throw new Error(`Could not parse current version “${current}”.`);

    parsed.postamble = '';
    if (increment === 'major') {
        parsed.major += 1;
        parsed.minor = 0;
        parsed.patch = parsed.patch === undefined ? undefined : 0;
    } else if (increment === 'minor') {
        parsed.minor += 1;
        if (parsed.patch !== undefined) parsed.patch = 0;
    } else if (parsed.patch === undefined) {
        parsed.minor += 1;
    } else {
        parsed.patch += 1;
    }
    return Version.render(parsed);
}

export function replaceVersion(source: string, pattern: string, newVersion: string): VersionReplacement {
    const regex = compilePattern(pattern);
    const match = regex.exec(source);
    if (!match) return { contents: source, found: false, previousVersion: null };

    const previousVersion = match.groups?.version ?? match[0];
    const capturedVersionIndex = match.groups?.version
        ? match[0].lastIndexOf(previousVersion)
        : -1;
    const replacement = capturedVersionIndex >= 0
        ? match[0].slice(0, capturedVersionIndex) + newVersion + match[0].slice(capturedVersionIndex + previousVersion.length)
        : newVersion;
    const index = match.index;
    return {
        contents: source.slice(0, index) + replacement + source.slice(index + match[0].length),
        found: true,
        previousVersion,
    };
}

export function findChangelogMarker(source: string): ChangelogMarker | null {
    const regex = /<!--\s*humperdinck:\s*releases\s+order=(newest-first|newest-last)\s+heading=([1-6])\s*-->/i;
    const match = regex.exec(source);
    if (!match) return null;
    return {
        index: match.index,
        length: match[0].length,
        order: match[1]!.toLowerCase() as ChangelogOrder,
        heading: Number(match[2]),
        source: match[0],
    };
}

export function insertChangelogEntry(
    source: string,
    marker: ChangelogMarker,
    version: string,
    notes: string,
): string {
    const entry = `${'#'.repeat(marker.heading)} ${version}\n\n${notes.trim()}`;
    const before = source.slice(0, marker.index);
    const after = source.slice(marker.index + marker.length);
    if (marker.order === 'newest-first') {
        return `${before}${marker.source}\n\n${entry}${after}`;
    }
    return `${before}${entry}\n\n${marker.source}${after}`;
}
