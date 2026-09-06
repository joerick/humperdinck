import { Base64 } from '@/util';
import Commit, { type GithubCommit } from './Commit';
import Repo from './Repo';
import {
    RELEASE_CONFIG_PATH,
    findChangelogMarker,
    insertChangelogEntry,
    parseReleaseConfig,
    renderReleaseConfig,
    replaceVersion,
    versionFromTag,
    type ChangelogMarker,
    type ReleaseConfig,
} from './ReleaseConfig';
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';

type GithubBranch = RestEndpointMethodTypes['repos']['getBranch']['response']['data'];
type GithubListCommit = RestEndpointMethodTypes['repos']['listCommits']['response']['data'][number];
type GithubPullRequest = RestEndpointMethodTypes['repos']['listPullRequestsAssociatedWithCommit']['response']['data'][number];

export interface ReleaseTag {
    sha: string;
    tag: string;
    version: string;
}

export interface ReleaseCommitSummary {
    sha: string;
    message: string;
    url: string;
    author: string | null;
}

export interface ReleasePullRequestSummary {
    number: number;
    title: string;
    body: string;
    url: string;
    author: string | null;
    commits: ReleaseCommitSummary[];
}

export type ReleaseTimelineItem =
    | { kind: 'pull-request'; pullRequest: ReleasePullRequestSummary }
    | { kind: 'commit'; commit: ReleaseCommitSummary };

export interface ReleaseChanges {
    release: ReleaseTag;
    pullRequests: ReleasePullRequestSummary[];
    standaloneCommits: ReleaseCommitSummary[];
    timeline: ReleaseTimelineItem[];
}

export interface ReleaseFileChange {
    path: string;
    before: string;
    after: string;
    versionFound?: boolean;
    foundVersion?: string | null;
}

export interface ChangelogPreview {
    path: string;
    marker: ChangelogMarker;
    beforeMarker: string;
    afterMarker: string;
}

export interface ReleasePlan {
    baseSha: string;
    currentRelease: ReleaseTag;
    newTag: string;
    newVersion: string;
    notes: string;
    files: ReleaseFileChange[];
    changelog: ChangelogPreview;
}

export default class Branch {
    constructor(
        public githubObj: GithubBranch,
        readonly repo: Repo,
        readonly octokit: Octokit,
    ) {}

    get headCommit() {
        return new Commit(this.githubObj.commit, this.repo, this.octokit);
    }

    get name() {
        return this.githubObj.name;
    }

    async refresh() {
        const response = await this.octokit.rest.repos.getBranch({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            branch: this.name,
        });
        this.githubObj = response.data;
    }

    async loadReleaseConfig(): Promise<ReleaseConfig | null> {
        try {
            const source = await this.fileContents(RELEASE_CONFIG_PATH);
            return parseReleaseConfig(source);
        } catch (error) {
            if (error instanceof Error && error.message === 'file not found') return null;
            throw error;
        }
    }

    async saveReleaseConfig(config: ReleaseConfig): Promise<void> {
        let sha: string | undefined;
        try {
            sha = (await this.headCommit.root.getFile(RELEASE_CONFIG_PATH)).sha;
        } catch (error) {
            if (!(error instanceof Error) || error.message !== 'file not found') throw error;
        }

        await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            path: RELEASE_CONFIG_PATH,
            branch: this.name,
            message: 'Configure Humperdinck releases',
            content: Base64.encode(renderReleaseConfig(config)),
            ...(sha ? { sha } : {}),
        });
        await this.refresh();
    }

    async latestRelease(config: ReleaseConfig): Promise<ReleaseTag> {
        const tags = await this.repo.tags();
        const tagBySha = new Map<string, { tag: string; version: string }>();
        for (const tag of tags) {
            const version = versionFromTag(tag.name, config.tagPattern);
            if (version && !tagBySha.has(tag.commit.sha)) {
                tagBySha.set(tag.commit.sha, { tag: tag.name, version });
            }
        }

        if (tagBySha.size === 0) {
            throw new Error('No tags match the configured release tag pattern.');
        }

        for await (const commit of this.repo.commitsGenerator({ headSha: this.headCommit.sha })) {
            const release = tagBySha.get(commit.sha);
            if (release) return { sha: commit.sha, ...release };
        }
        throw new Error('No matching release tag is reachable from this branch.');
    }

    async changesSinceLatestRelease(config: ReleaseConfig): Promise<ReleaseChanges> {
        const release = await this.latestRelease(config);
        const commits: GithubListCommit[] = [];
        for await (const commit of this.repo.commitsGenerator({ headSha: this.headCommit.sha })) {
            if (commit.sha === release.sha) break;
            commits.push(commit);
        }

        const pullRequests = new Map<number, ReleasePullRequestSummary>();
        const standaloneCommits: ReleaseCommitSummary[] = [];
        const timeline: ReleaseTimelineItem[] = [];
        for (const commit of commits) {
            const summary = summarizeCommit(commit);
            const response = await this.octokit.rest.repos.listPullRequestsAssociatedWithCommit({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                commit_sha: commit.sha,
            });
            const pullRequest = response.data.find(pr => pr.merged_at !== null);
            if (!pullRequest) {
                standaloneCommits.push(summary);
                timeline.push({ kind: 'commit', commit: summary });
                continue;
            }

            const existing = pullRequests.get(pullRequest.number);
            if (existing) {
                if (commit.sha !== pullRequest.merge_commit_sha) existing.commits.push(summary);
            } else {
                const summarized = summarizePullRequest(
                    pullRequest,
                    commit.sha === pullRequest.merge_commit_sha ? [] : [summary],
                );
                pullRequests.set(pullRequest.number, summarized);
                timeline.push({ kind: 'pull-request', pullRequest: summarized });
            }
        }

        return {
            release,
            pullRequests: [...pullRequests.values()],
            standaloneCommits,
            timeline: timeline.reverse(),
        };
    }

    async changelogPreview(config: ReleaseConfig): Promise<ChangelogPreview> {
        const source = await this.changelogContents(config);
        const marker = findChangelogMarker(source);
        if (!marker) {
            throw this.missingChangelogMarkerError(config);
        }
        return {
            path: config.changelog.path,
            marker,
            beforeMarker: source.slice(Math.max(0, marker.index - 800), marker.index),
            afterMarker: source.slice(marker.index + marker.length, marker.index + marker.length + 800),
        };
    }

    async planRelease(config: ReleaseConfig, newTag: string, notes: string): Promise<ReleasePlan> {
        const currentRelease = await this.latestRelease(config);
        const newVersion = versionFromTag(newTag, config.tagPattern);
        if (!newVersion) {
            throw new Error(`The new tag “${newTag}” does not match the configured tag pattern.`);
        }
        const tags = await this.repo.tags();
        if (tags.some(tag => tag.name === newTag)) {
            throw new Error(`Tag “${newTag}” already exists.`);
        }
        const files = new Map<string, ReleaseFileChange>();

        for (const versionFile of config.versionFiles) {
            const before = await this.fileContents(versionFile.path);
            const result = replaceVersion(
                before,
                versionFile.find,
                currentRelease.version,
                newVersion,
            );
            const versionFound = result.found;
            files.set(versionFile.path, {
                path: versionFile.path,
                before,
                after: result.contents,
                versionFound,
                foundVersion: result.previousVersion,
            });
        }

        const changelogSource = files.get(config.changelog.path)?.after
            ?? await this.changelogContents(config);
        const marker = findChangelogMarker(changelogSource);
        if (!marker) {
            throw this.missingChangelogMarkerError(config);
        }
        const changelogAfter = insertChangelogEntry(changelogSource, marker, newTag, notes);
        const existingChangelog = files.get(config.changelog.path);
        files.set(config.changelog.path, {
            path: config.changelog.path,
            before: existingChangelog?.before ?? changelogSource,
            after: changelogAfter,
            versionFound: existingChangelog?.versionFound,
            foundVersion: existingChangelog?.foundVersion,
        });

        return {
            baseSha: this.headCommit.sha,
            currentRelease,
            newTag,
            newVersion,
            notes,
            files: [...files.values()],
            changelog: {
                path: config.changelog.path,
                marker,
                beforeMarker: changelogSource.slice(Math.max(0, marker.index - 800), marker.index),
                afterMarker: changelogSource.slice(marker.index + marker.length, marker.index + marker.length + 800),
            },
        };
    }

    async createDraftCommit(plan: ReleasePlan): Promise<Commit> {
        await this.refresh();
        if (this.headCommit.sha !== plan.baseSha) {
            throw new Error('The branch changed after the preview. Refresh and review the release again.');
        }

        const tree = await Promise.all(plan.files.map(async file => {
            const currentFile = await this.headCommit.root.getFile(file.path);
            const blob = await this.octokit.rest.git.createBlob({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                content: Base64.encode(file.after),
                encoding: 'base64',
            });
            return {
                path: file.path,
                mode: currentFile.githubObj.mode as '100644',
                type: 'blob' as const,
                sha: blob.data.sha,
            };
        }));

        const newTree = await this.octokit.rest.git.createTree({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            base_tree: this.headCommit.treeSha,
            tree,
        });
        const response = await this.octokit.rest.git.createCommit({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            message: plan.newTag,
            tree: newTree.data.sha,
            parents: [plan.baseSha],
        });
        return new Commit({
            sha: response.data.sha,
            commit: { tree: { sha: response.data.tree.sha } },
        } satisfies GithubCommit, this.repo, this.octokit);
    }

    draftDiffUrl(commit: Commit): string {
        return `https://github.com/${this.repo.ownerUsername}/${this.repo.name}/compare/${this.name}...${commit.sha}`;
    }

    async publishRelease(plan: ReleasePlan, commit: Commit) {
        await this.refresh();
        if (this.headCommit.sha !== plan.baseSha) {
            throw new Error('The branch changed after the draft was created. Refresh before publishing.');
        }

        await this.octokit.rest.git.updateRef({
            owner: this.repo.ownerUsername,
            repo: this.repo.name,
            ref: `heads/${this.name}`,
            sha: commit.sha,
        });

        try {
            const response = await this.octokit.rest.repos.createRelease({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                tag_name: plan.newTag,
                target_commitish: commit.sha,
                name: plan.newTag,
                body: plan.notes,
            });
            await this.refresh();
            return response.data;
        } catch (error) {
            await this.octokit.rest.git.updateRef({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                ref: `heads/${this.name}`,
                sha: plan.baseSha,
                force: true,
            });
            await this.refresh();
            throw error;
        }
    }

    async fileContents(path: string): Promise<string> {
        return (await this.headCommit.root.getFile(path)).contents();
    }

    async changelogContents(config: ReleaseConfig): Promise<string> {
        try {
            return await this.fileContents(config.changelog.path);
        } catch (error) {
            if (error instanceof Error && error.message === 'file not found') {
                throw new Error(
                    `${config.changelog.path} was not found on ${this.name}. Create the Markdown file and add ` +
                    '<!-- humperdinck: releases order=newest-first heading=2 --> where release entries should go.',
                );
            }
            throw error;
        }
    }

    missingChangelogMarkerError(config: ReleaseConfig): Error {
        return new Error(
            `${config.changelog.path} does not contain a Humperdinck release marker. Add ` +
            '<!-- humperdinck: releases order=newest-first heading=2 --> where entries should be inserted.',
        );
    }
}

function summarizeCommit(commit: GithubListCommit): ReleaseCommitSummary {
    return {
        sha: commit.sha,
        message: commit.commit.message.split('\n')[0] ?? commit.sha,
        url: commit.html_url,
        author: commit.author?.login ?? commit.commit.author?.name ?? null,
    };
}

function summarizePullRequest(pr: GithubPullRequest, commits: ReleaseCommitSummary[]): ReleasePullRequestSummary {
    return {
        number: pr.number,
        title: pr.title,
        body: pr.body ?? '',
        url: pr.html_url,
        author: pr.user?.login ?? null,
        commits,
    };
}
