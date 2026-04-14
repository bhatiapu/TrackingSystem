import { Router } from 'express';
import { db } from '../db';
import { projects, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try {
    const all = await db.query.projects.findMany({
      with: { owner: { columns: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
    res.json(all);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { name, description, key } = req.body;
    if (!name || !key) return res.status(400).json({ error: 'name and key are required' });
    const upperKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const existing = await db.query.projects.findFirst({ where: eq(projects.key, upperKey) });
    if (existing) return res.status(409).json({ error: `Project key ${upperKey} already exists` });

    // Verify user exists before setting as owner
    const owner = req.userId
      ? await db.query.users.findFirst({ where: eq(users.id, req.userId) })
      : null;

    const [project] = await db.insert(projects).values({
      name, description, key: upperKey, ownerId: owner ? req.userId : undefined,
    }).returning();
    res.status(201).json(project);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        owner: { columns: { id: true, name: true, email: true, avatarUrl: true } },
        gitRepos: true,
        sprints: { orderBy: (s, { desc }) => [desc(s.createdAt)] },
      },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description } = req.body;
    const [updated] = await db.update(projects)
      .set({ name, description, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Project not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(projects).where(eq(projects.id, id));
    res.status(204).send();
  } catch (err) { next(err); }
});

// List all users (for assignee dropdowns)
router.get('/:id/members', async (_req, res, next) => {
  try {
    const members = await db.select({
      id: users.id, name: users.name, email: users.email, role: users.role, avatarUrl: users.avatarUrl,
    }).from(users);
    res.json(members);
  } catch (err) { next(err); }
});

export default router;
