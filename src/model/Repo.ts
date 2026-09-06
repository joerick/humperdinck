import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import Branch from './Branch';
import { asyncGeneratorToList } from '@/util';
import { cacheMethod } from '@/util-cache';

type GithubRepository = RestEndpointMethodTypes['repos']['get']['response']['data'];

export default class Repo {
    constructor (public githubObj: GithubRepository, readonly octokit: Octokit) {}

    get ownerUsername() { return this.githubObj.owner.login }
    get name() { return this.githubObj.name }

    get defaultBranchName() { return this.githubObj.default_branch }
    async branch(branchName: string) {
        const branchResult = await this.octokit.rest.repos.getBranch({
            owner: this.ownerUsername,
            repo: this.name,
            branch: branchName
        })
        return new Branch(branchResult.data, this, this.octokit);
    }
    async defaultBranch() {
        return await this.branch(this.defaultBranchName);
    }
    @cacheMethod({ttl: 180})
    async branchNames() {
        const branches = await this.octokit.paginate(this.octokit.rest.repos.listBranches, {
            owner: this.ownerUsername,
            repo: this.name,
            per_page: 100,
        })

        return branches.map(branch => branch.name);
    }

    async *tagsGenerator() {
        let page = 1;

        while (true) {
            const tagsRequest = await this.octokit.rest.repos.listTags({
                owner: this.ownerUsername,
                repo: this.name,
                per_page: 100,
                page,
            })

            for (const tag of tagsRequest.data) {
                yield tag;
            }

            if (tagsRequest.data.length < 100) {
                break;
            }

            page += 1;
        }
    }

    async tags() {
        return asyncGeneratorToList(this.tagsGenerator());
    }

    async *commitsGenerator({headSha}: {headSha: string}) {
        let page = 1;
        while (true) {
            const commitsRequest = await this.octokit.rest.repos.listCommits({
                owner: this.ownerUsername,
                repo: this.name,
                sha: headSha,
                per_page: 100,
                page,
            });

            for (const commit of commitsRequest.data) {
                yield commit;
            }

            if (commitsRequest.data.length < 100) {
                break;
            }

            page += 1;
        }
    }
}
