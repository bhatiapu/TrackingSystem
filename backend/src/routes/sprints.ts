import { Router } from 'express';
import { db } from '../db';
import { sprints, tickets } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const rows = await db.query.sprints.findMany({
      where: eq(sprints.projectId, projectId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const { name, goal, startDate, endDate } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const [sprint] = await db.insert(sprints).values({
      projectId, name, goal,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    }).returning();
    res.status(201).json(sprint);
  } catch (err) { next(err); }
});

router.get('/:sprintId', async (req, res, next) => {
  try {
    const sprint = await db.query.sprints.findFirst({
      where: eq(sprints.id, parseInt((req.params as any).sprintId)),
      with: {
        tickets: {
          with: {
            assignee: { columns: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: (t, { asc }) => [asc(t.boardOrder)],
        },
      },
    });
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
    res.json(sprint);
  } catch (err) { next(err); }
});

router.patch('/:sprintId', async (req, res, next) => {
  try {
    const { name, goal, startDate, endDate, status } = req.body;

    // Only one active sprint per project
    if (status === 'active') {
      const projectId = parseInt((req.params as any).projectId);
      await db.update(sprints)
        .set({ status: 'completed' })
        .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'active')));
    }

    const [updated] = await db.update(sprints)
      .set({
        ...(name && { name }),
        ...(goal !== undefined && { goal }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status }),
      })
      .where(eq(sprints.id, parseInt((req.params as any).sprintId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Sprint not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

// Move tickets into sprint
router.post('/:sprintId/tickets', async (req, res, next) => {
  try {
    const sprintId = parseInt((req.params as any).sprintId);
    const { ticketIds } = req.body as { ticketIds: number[] };
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ error: 'ticketIds array is required' });
    }
    for (const id of ticketIds) {
      await db.update(tickets).set({ sprintId }).where(eq(tickets.id, id));
    }
    res.json({ moved: ticketIds.length });
  } catch (err) { next(err); }
});

export default router;
