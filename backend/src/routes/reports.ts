import { Router } from 'express';
import { db } from '../db';
import { tickets, commits, sprints } from '../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

// ─── Tickets WITH linked commits ──────────────────────────────────────────────
router.get('/linked', async (req, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const rows = await db.query.tickets.findMany({
      where: eq(tickets.projectId, projectId),
      with: {
        assignee: { columns: { id: true, name: true, avatarUrl: true } },
        sprint: { columns: { id: true, name: true } },
      },
    });

    // For each ticket, check if any commit references its key
    const result = [];
    for (const ticket of rows) {
      const linkedCommits = await db.query.commits.findMany({
        where: sql`${ticket.key} = ANY(${commits.ticketKeys})`,
        columns: { sha: true, message: true, authorName: true, authoredAt: true, branch: true },
        limit: 10,
      });
      if (linkedCommits.length > 0) {
        result.push({ ...ticket, commits: linkedCommits, commitCount: linkedCommits.length });
      }
    }

    res.json(result);
  } catch (err) { next(err); }
});

// ─── Tickets WITHOUT linked commits ───────────────────────────────────────────
router.get('/unlinked', async (req, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const rows = await db.query.tickets.findMany({
      where: eq(tickets.projectId, projectId),
      with: {
        assignee: { columns: { id: true, name: true, avatarUrl: true } },
        sprint: { columns: { id: true, name: true } },
      },
    });

    const unlinked = [];
    for (const ticket of rows) {
      const count = await db.select({ count: sql<number>`count(*)` })
        .from(commits)
        .where(sql`${ticket.key} = ANY(${commits.ticketKeys})`);
      if (Number(count[0].count) === 0) {
        unlinked.push(ticket);
      }
    }

    res.json(unlinked);
  } catch (err) { next(err); }
});

// ─── Sprint velocity ──────────────────────────────────────────────────────────
router.get('/velocity', async (req, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const projectSprints = await db.query.sprints.findMany({
      where: eq(sprints.projectId, projectId),
      orderBy: (s, { asc }) => [asc(s.startDate)],
    });

    const velocity = [];
    for (const sprint of projectSprints) {
      const sprintTickets = await db.query.tickets.findMany({
        where: and(eq(tickets.sprintId, sprint.id), eq(tickets.projectId, projectId)),
        columns: { status: true, storyPoints: true, type: true },
      });

      const total = sprintTickets.reduce((s, t) => s + (t.storyPoints || 0), 0);
      const completed = sprintTickets
        .filter((t) => t.status === 'done')
        .reduce((s, t) => s + (t.storyPoints || 0), 0);

      velocity.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        status: sprint.status,
        totalPoints: total,
        completedPoints: completed,
        totalTickets: sprintTickets.length,
        completedTickets: sprintTickets.filter((t) => t.status === 'done').length,
        stories: sprintTickets.filter((t) => t.type === 'story').length,
        defects: sprintTickets.filter((t) => t.type === 'defect').length,
      });
    }

    res.json(velocity);
  } catch (err) { next(err); }
});

// ─── Summary dashboard stats ──────────────────────────────────────────────────
router.get('/summary', async (req, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    const allTickets = await db.query.tickets.findMany({
      where: eq(tickets.projectId, projectId),
      columns: { status: true, type: true, priority: true },
    });

    const summary = {
      total: allTickets.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
    };

    for (const t of allTickets) {
      summary.byStatus[t.status] = (summary.byStatus[t.status] || 0) + 1;
      summary.byType[t.type] = (summary.byType[t.type] || 0) + 1;
      summary.byPriority[t.priority] = (summary.byPriority[t.priority] || 0) + 1;
    }

    res.json(summary);
  } catch (err) { next(err); }
});

export default router;
