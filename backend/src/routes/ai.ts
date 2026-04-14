import { Router } from 'express';
import { db } from '../db';
import { documents, gitRepos, tickets } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { generateTicket, enrichTicket, generateDocs, analyzeGap } from '../services/aiService';
import { getBranchDiff } from '../services/gitService';

const router = Router();
router.use(authenticate);

// ─── Generate full ticket from brief description ──────────────────────────────
router.post('/generate-ticket', async (req, res, next) => {
  try {
    const { type, briefDescription, projectContext } = req.body;
    if (!type || !briefDescription) return res.status(400).json({ error: 'type and briefDescription are required' });
    const result = await generateTicket(type, briefDescription, projectContext);
    res.json(result);
  } catch (err) { next(err); }
});

// ─── Enrich existing ticket field ─────────────────────────────────────────────
router.post('/enrich-ticket/:ticketId', async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const { field } = req.body;
    const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const content = await enrichTicket(ticket as any, field);
    res.json({ field, content });
  } catch (err) { next(err); }
});

// ─── Generate documentation for a repo ───────────────────────────────────────
router.post('/generate-docs', async (req, res, next) => {
  try {
    const { repoId, projectId, docType, branch } = req.body;
    if (!repoId || !projectId || !docType) return res.status(400).json({ error: 'repoId, projectId, docType required' });

    const repo = await db.query.gitRepos.findFirst({ where: eq(gitRepos.id, repoId) });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
    if (repo.type !== 'local') {
      return res.status(400).json({ error: 'Doc generation is currently supported for local repos only' });
    }

    const content = await generateDocs(repo.pathOrUrl, docType, branch || repo.defaultBranch || 'main');
    const title = `${docType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} — ${repo.name}`;

    // Upsert the document
    const existing = await db.query.documents.findFirst({
      where: (d, { and }) => and(eq(d.repoId, repoId), eq(d.type, docType)),
    });

    let doc;
    if (existing) {
      [doc] = await db.update(documents)
        .set({ content, title, branch, isStale: false, generatedAt: new Date() })
        .where(eq(documents.id, existing.id))
        .returning();
    } else {
      [doc] = await db.insert(documents).values({
        projectId, repoId, type: docType, title, content, branch, isStale: false,
      }).returning();
    }

    res.json(doc);
  } catch (err) { next(err); }
});

// ─── Gap analysis ─────────────────────────────────────────────────────────────
router.post('/gap-analysis', async (req, res, next) => {
  try {
    const { repoId, projectId, base, head } = req.body;
    if (!repoId || !base || !head) return res.status(400).json({ error: 'repoId, base, head required' });

    const repo = await db.query.gitRepos.findFirst({ where: eq(gitRepos.id, repoId) });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });

    const diff = await getBranchDiff(repo, base, head);
    const content = await analyzeGap(diff, base, head);
    const title = `Gap Analysis: ${head} vs ${base}`;

    const [doc] = await db.insert(documents).values({
      projectId, repoId, type: 'gap_analysis', title, content,
      branch: head, isStale: false,
    }).returning();

    res.json(doc);
  } catch (err) { next(err); }
});

// ─── List documents for project ───────────────────────────────────────────────
router.get('/documents/:projectId', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const docs = await db.query.documents.findMany({
      where: eq(documents.projectId, projectId),
      with: { repo: { columns: { id: true, name: true } } },
      orderBy: (d, { desc }) => [desc(d.generatedAt)],
    });
    res.json(docs);
  } catch (err) { next(err); }
});

export default router;
