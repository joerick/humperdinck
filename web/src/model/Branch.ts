import Octokit, { ReposListTagsResponseItem } from '@octokit/rest';
import { Repo } from './Repo';
import Commit from './Commit';

interface GithubApiRef {
    ref: string,
    node_id: string,
    url: string,
    object: {
        type: "commit"|"tag",
        sha: string,
        url: string,
    }
}

const VERSION_REGEX = /^v?\d+\.\d+(\.\d+)?.*/gi;

export default class Branch {
    constructor (public githubObj: Octokit.ReposGetBranchResponse, 
                 readonly repo: Repo,
                 readonly octokit: Octokit) {}

    get headCommit() {
        return new Commit(this.githubObj.commit, this.repo, this.octokit);
    }

    get name() {
        return this.githubObj.name;
    }

    async currentVersion() {
        // get all the tags
        let tags: ReposListTagsResponseItem[] = [];
        let page = 0;

        while (true) {
            const lastTagsRequest = await this.octokit.repos.listTags({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                per_page: 100,
                page,
            })
            tags.push(...lastTagsRequest.data)

            if (lastTagsRequest.data.length < 100) {
                break;
            }

            page += 1;
        }

        // build a map of commit sha to version name
        const versions = tags.filter(t => t.name.match(VERSION_REGEX));
        const commitShaToVersionMap: {[sha: string]: string} = {};
        versions.forEach(v => { commitShaToVersionMap[v.commit.sha] = v.name });
        console.log({tags, versions})
        if (versions.length == 0) {
            throw new Error('No version tags found in this repo');
        }
        
        page = 0;
        let version = null;

        // find the latest commit that's tagged with a version number
        while (!version) {
            const commitsRequest = await this.octokit.repos.listCommits({
                owner: this.repo.ownerUsername,
                repo: this.repo.name,
                sha: this.headCommit.sha,
                per_page: 100,
                page,
            });

            for (const commit of commitsRequest.data) {
                version = commitShaToVersionMap[commit.sha];
                if (version) {
                    break;
                }
            }

            if (commitsRequest.data.length < 100) {
                break;
            }

            page += 1;
        }

        if (version === null) {
            throw new Error('Couldn\'t find a commit in this branch has a version');
        }

        return version
    }
}
