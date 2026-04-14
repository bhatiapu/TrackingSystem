import { Router } from 'express';
import { db } from '../db';
import { gitRepos, commits, documents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { syncCommits, listBranches, createBranch, getBranchDiff } from '../services/gitService';

const router = Router({ mergeParams: true });
router.use(authenticate);

// ─── List repos for project ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const repos = await db.query.gitRepos.findMany({ where: eq(gitRepos.projectId, projectId) });
    res.json(repos);
  } catch (err) { next(err); }
});

// ─── Register repo ────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const { name, type, pathOrUrl, githubToken, githubOwner, githubRepo, defaultBranch } = req.body;
    if (!name || !type || !pathOrUrl) return res.status(400).json({ error: 'name, type, pathOrUrl required' });
    const [repo] = await db.insert(gitRepos).values({
      projectId, name, type, pathOrUrl, githubToken, githubOwner, githubRepo,
      defaultBranch: defaultBranch || 'main',
    }).returning();
    res.status(201).json(repo);
  } catch (err) { next(err); }
});

// ─── Sync commits ─────────────────────────────────────────────────────────────
router.post('/:repoId/sync', async (req, res, next) => {
  try {
    const repoId = parseInt(req.params.repoId);
    const repo = await db.query.gitRepos.findFirst({ where: eq(gitRepos.id, repoId) });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });

    const since = repo.lastSyncedAt || undefined;
    const newCommits = await syncCommits(repo, since);
    let inserted = 0;

    for (const c of newCommits) {
      try {
        await db.insert(commits).values({
          repoId,
          sha: c.sha,
          message: c.message,
          authorName: c.authorName,
          authorEmail: c.authorEmail,
          authoredAt: c.authoredAt,
          branch: c.branch,
          ticketKeys: c.ticketKeys,
        }).onConflictDoNothing();
        inserted++;
      } catch { continue; }
    }

    // Mark all docs as stale if new commits arrived
    if (inserted > 0) {
      await db.update(documents)
        .set({ isStale: true })
        .where(eq(documents.repoId, repoId));
    }

    await db.update(gitRepos)
      .set({ lastSyncedAt: new Date() })
      .where(eq(gitRepos.id, repoId));

    res.json({ inserted, total: newCommits.length });
  } catch (err) { next(err); }
});

// ─── List branches ────────────────────────────────────────────────────────────
router.get('/:repoId/branches', async (req, res, next) => {
  try {
    const repoId = parseInt(req.params.repoId);
    const repo = await db.query.gitRepos.findFirst({ where: eq(gitRepos.id, repoId) });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
    const branches = await listBranches(repo);
    res.json(branches);
  } catch (err) { next(err); }
});

// ─── Create branch ────────────────────────────────────────────────────────────
router.post('/:repoId/branches', async (req, res, next) => {
  try {
    const repoId = parseInt(req.params.repoId);
    const { branchName, from } = req.body;
    if (!branchName) return res.status(400).json({ error: 'branchName is required' });
    const repo = await db.query.gitRepos.findFirst({ where: eq(gitRepos.id, repoId) });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
    await createBranch(repo, branchName, from || repo.defaultBranch || 'main');
    res.json({ created: branchName, from: from || repo.defaultBranch });
  } catch (err) { next(err); }
});

// ─── Branch comparison / gap analysis ────────────────────────────────────────
router.get('/:repoId/compare', async (req, res, next) => {
  try {
    const repoId = parseInt(req.params.repoId);
    const { base, head } = req.query as { base: string; head: string };
    if (!base || !head) return res.status(400).json({ error: 'base and head are required' });
    const repo = await db.query.gitRepos.findFirst({ where: eq(gitRepos.id, repoId) });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
    const diff = await getBranchDiff(repo, base, head);
    res.json({ base, head, diff });
  } catch (err) { next(err); }
});

// ─── Delete repo ──────────────────────────────────────────────────────────────
router.delete('/:repoId', async (req, res, next) => {
  try {
    await db.delete(gitRepos).where(eq(gitRepos.id, parseInt(req.params.repoId)));
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
