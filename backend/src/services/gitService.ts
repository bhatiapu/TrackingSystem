import simpleGit, { SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { GitRepo } from '../db/schema';
import { extractTicketKeys } from './commitParser';

export interface CommitInfo {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authoredAt: Date;
  branch: string;
  ticketKeys: string[];
}

export interface BranchInfo {
  name: string;
  current: boolean;
  sha: string;
}

// ─── Local Git ────────────────────────────────────────────────────────────────
async function getLocalCommits(repo: GitRepo, since?: Date): Promise<CommitInfo[]> {
  const git: SimpleGit = simpleGit(repo.pathOrUrl);
  const branches = await git.branch(['-a']);
  const allCommits: CommitInfo[] = [];

  for (const branchName of Object.keys(branches.branches)) {
    const shortName = branchName.replace('remotes/origin/', '');
    try {
      const logOptions: string[] = ['--format=%H|%s|%an|%ae|%aI', `${shortName}`];
      if (since) logOptions.push(`--after=${since.toISOString()}`);
      const logResult = await git.raw(['log', ...logOptions]);
      if (!logResult.trim()) continue;

      for (const line of logResult.trim().split('\n')) {
        const [sha, message, authorName, authorEmail, authoredAt] = line.split('|');
        if (!sha) continue;
        allCommits.push({
          sha: sha.trim(),
          message: message?.trim() || '',
          authorName: authorName?.trim() || '',
          authorEmail: authorEmail?.trim() || '',
          authoredAt: new Date(authoredAt?.trim() || Date.now()),
          branch: shortName,
          ticketKeys: extractTicketKeys(message || ''),
        });
      }
    } catch { continue; }
  }

  const seen = new Set<string>();
  return allCommits.filter((c) => {
    if (seen.has(c.sha)) return false;
    seen.add(c.sha);
    return true;
  });
}

async function getLocalBranches(repo: GitRepo): Promise<BranchInfo[]> {
  const git: SimpleGit = simpleGit(repo.pathOrUrl);
  const result = await git.branch(['-a', '-v']);
  return Object.values(result.branches).map((b) => ({
    name: b.name,
    current: b.current,
    sha: b.commit,
  }));
}

async function createLocalBranch(repo: GitRepo, branchName: string, from: string): Promise<void> {
  const git: SimpleGit = simpleGit(repo.pathOrUrl);
  await git.checkoutBranch(branchName, from);
}

async function getDiffLocal(repo: GitRepo, base: string, head: string): Promise<string> {
  const git: SimpleGit = simpleGit(repo.pathOrUrl);
  return await git.raw(['diff', `${base}...${head}`, '--stat']);
}

// ─── GitHub ───────────────────────────────────────────────────────────────────
async function getGithubCommits(repo: GitRepo, since?: Date): Promise<CommitInfo[]> {
  const octokit = new Octokit({ auth: repo.githubToken });
  const commits: CommitInfo[] = [];
  const owner = repo.githubOwner!;
  const repoName = repo.githubRepo!;

  try {
    const branches = await octokit.repos.listBranches({ owner, repo: repoName, per_page: 50 });
    for (const branch of branches.data) {
      let page = 1;
      while (true) {
        const res = await octokit.repos.listCommits({
          owner, repo: repoName, sha: branch.name,
          per_page: 100, page,
          ...(since ? { since: since.toISOString() } : {}),
        });
        if (res.data.length === 0) break;
        for (const c of res.data) {
          commits.push({
            sha: c.sha,
            message: c.commit.message,
            authorName: c.commit.author?.name || '',
            authorEmail: c.commit.author?.email || '',
            authoredAt: new Date(c.commit.author?.date || Date.now()),
            branch: branch.name,
            ticketKeys: extractTicketKeys(c.commit.message),
          });
        }
        if (res.data.length < 100) break;
        page++;
      }
    }
  } catch (err) {
    console.error('GitHub fetch error:', err);
  }

  const seen = new Set<string>();
  return commits.filter((c) => { if (seen.has(c.sha)) return false; seen.add(c.sha); return true; });
}

async function getGithubBranches(repo: GitRepo): Promise<BranchInfo[]> {
  const octokit = new Octokit({ auth: repo.githubToken });
  const { data } = await octokit.repos.listBranches({
    owner: repo.githubOwner!, repo: repo.githubRepo!, per_page: 100,
  });
  return data.map((b) => ({ name: b.name, current: false, sha: b.commit.sha }));
}

async function createGithubBranch(repo: GitRepo, branchName: string, from: string): Promise<void> {
  const octokit = new Octokit({ auth: repo.githubToken });
  const base = await octokit.repos.getBranch({
    owner: repo.githubOwner!, repo: repo.githubRepo!, branch: from,
  });
  await octokit.git.createRef({
    owner: repo.githubOwner!, repo: repo.githubRepo!,
    ref: `refs/heads/${branchName}`,
    sha: base.data.commit.sha,
  });
}

async function getDiffGithub(repo: GitRepo, base: string, head: string): Promise<string> {
  const octokit = new Octokit({ auth: repo.githubToken });
  const { data } = await octokit.repos.compareCommitsWithBasehead({
    owner: repo.githubOwner!, repo: repo.githubRepo!,
    basehead: `${base}...${head}`,
  });
  return data.files?.map((f) => `${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n') || '';
}

// ─── Unified API ──────────────────────────────────────────────────────────────
export async function syncCommits(repo: GitRepo, since?: Date): Promise<CommitInfo[]> {
  if (repo.type === 'local') return getLocalCommits(repo, since);
  return getGithubCommits(repo, since);
}

export async function listBranches(repo: GitRepo): Promise<BranchInfo[]> {
  if (repo.type === 'local') return getLocalBranches(repo);
  return getGithubBranches(repo);
}

export async function createBranch(repo: GitRepo, branchName: string, from: string): Promise<void> {
  if (repo.type === 'local') return createLocalBranch(repo, branchName, from);
  return createGithubBranch(repo, branchName, from);
}

export async function getBranchDiff(repo: GitRepo, base: string, head: string): Promise<string> {
  if (repo.type === 'local') return getDiffLocal(repo, base, head);
  return getDiffGithub(repo, base, head);
}
