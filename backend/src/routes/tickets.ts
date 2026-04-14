import { Router } from 'express';
import { db } from '../db';
import { tickets, projects, comments, activityLog, commits } from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

// ─── List tickets for a project ───────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const { type, status, sprintId, assigneeId } = req.query as Record<string, string>;

    const conditions = [eq(tickets.projectId, projectId)];
    if (type) conditions.push(eq(tickets.type, type as any));
    if (status) conditions.push(eq(tickets.status, status as any));
    if (sprintId === 'null') {
      conditions.push(sql`${tickets.sprintId} IS NULL`);
    } else if (sprintId) {
      conditions.push(eq(tickets.sprintId, parseInt(sprintId)));
    }
    if (assigneeId) conditions.push(eq(tickets.assigneeId, parseInt(assigneeId)));

    const rows = await db.query.tickets.findMany({
      where: and(...conditions),
      with: {
        assignee: { columns: { id: true, name: true, avatarUrl: true } },
        reporter: { columns: { id: true, name: true } },
        sprint: { columns: { id: true, name: true } },
      },
      orderBy: (t, { asc }) => [asc(t.boardOrder), desc(t.createdAt)],
    });
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── Create ticket ────────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const counter = project.ticketCounter + 1;
    await db.update(projects).set({ ticketCounter: counter }).where(eq(projects.id, projectId));

    const typePrefix = req.body.type === 'story' ? 'US' : req.body.type === 'defect' ? 'DEF' : 'TASK';
    const key = `${project.key}-${typePrefix}-${counter}`;

    const [ticket] = await db.insert(tickets).values({
      ...req.body,
      projectId,
      key,
      reporterId: req.userId,
    }).returning();

    await db.insert(activityLog).values({
      ticketId: ticket.id,
      userId: req.userId,
      action: 'created',
      newValue: ticket.status,
    });

    res.status(201).json(ticket);
  } catch (err) { next(err); }
});

// ─── Get single ticket ────────────────────────────────────────────────────────
router.get('/:ticketId', async (req, res, next) => {
  try {
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, parseInt(req.params.ticketId)),
      with: {
        assignee: { columns: { id: true, name: true, avatarUrl: true } },
        reporter: { columns: { id: true, name: true, avatarUrl: true } },
        sprint: true,
        comments: {
          with: { user: { columns: { id: true, name: true, avatarUrl: true } } },
          orderBy: (c, { asc }) => [asc(c.createdAt)],
        },
        activity: {
          orderBy: (a, { desc }) => [desc(a.createdAt)],
          limit: 50,
        },
      },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) { next(err); }
});

// ─── Update ticket ────────────────────────────────────────────────────────────
router.patch('/:ticketId', async (req: AuthRequest, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const old = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
    if (!old) return res.status(404).json({ error: 'Ticket not found' });

    const [updated] = await db.update(tickets)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .returning();

    const changes: Array<{ action: string; oldValue: string; newValue: string }> = [];
    const trackFields = ['status', 'priority', 'assigneeId', 'sprintId', 'storyPoints'] as const;
    for (const field of trackFields) {
      if (req.body[field] !== undefined && String(req.body[field]) !== String((old as any)[field] ?? '')) {
        changes.push({ action: `updated_${field}`, oldValue: String((old as any)[field] ?? ''), newValue: String(req.body[field]) });
      }
    }
    if (changes.length > 0) {
      await db.insert(activityLog).values(
        changes.map((c) => ({ ticketId, userId: req.userId, ...c }))
      );
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// ─── Delete ticket ────────────────────────────────────────────────────────────
router.delete('/:ticketId', async (req, res, next) => {
  try {
    await db.delete(tickets).where(eq(tickets.id, parseInt(req.params.ticketId)));
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Comments ─────────────────────────────────────────────────────────────────
router.post('/:ticketId/comments', async (req: AuthRequest, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: 'body is required' });
    const [comment] = await db.insert(comments).values({ ticketId, userId: req.userId!, body }).returning();
    await db.insert(activityLog).values({ ticketId, userId: req.userId, action: 'commented', newValue: body.slice(0, 100) });
    res.status(201).json(comment);
  } catch (err) { next(err); }
});

// ─── Linked commits ───────────────────────────────────────────────────────────
router.get('/:ticketId/commits', async (req, res, next) => {
  try {
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, parseInt(req.params.ticketId)),
      columns: { key: true },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const linked = await db.query.commits.findMany({
      where: sql`${ticket.key} = ANY(${commits.ticketKeys})`,
      with: { repo: { columns: { id: true, name: true, type: true } } },
      orderBy: (c, { desc }) => [desc(c.authoredAt)],
    });
    res.json(linked);
  } catch (err) { next(err); }
});

// ─── Activity log ─────────────────────────────────────────────────────────────
router.get('/:ticketId/activity', async (req, res, next) => {
  try {
    const activity = await db.query.activityLog.findMany({
      where: eq(activityLog.ticketId, parseInt(req.params.ticketId)),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    res.json(activity);
  } catch (err) { next(err); }
});

export default router;
