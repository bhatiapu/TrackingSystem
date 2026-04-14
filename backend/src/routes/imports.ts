import { Router } from 'express';
import multer from 'multer';
import { db } from '../db';
import { projects, tickets, users, sprints } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';
import { parseExcelTickets, generateTemplate } from '../services/excelService';

const router = Router({ mergeParams: true });
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Download Excel template ──────────────────────────────────────────────────
router.get('/template', (_req, res, next) => {
  try {
    const buffer = generateTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="ticket-import-template.xlsx"');
    res.send(buffer);
  } catch (err) { next(err); }
});

// ─── Upload and import Excel ──────────────────────────────────────────────────
router.post('/excel', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const projectId = parseInt((req.params as any).projectId);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { stories, defects } = parseExcelTickets(req.file.buffer);
    const allRows = [...stories, ...defects];
    const created: string[] = [];

    // Cache sprint names → ids
    const sprintCache = new Map<string, number>();
    const projectSprints = await db.query.sprints.findMany({ where: eq(sprints.projectId, projectId) });
    for (const s of projectSprints) sprintCache.set(s.name.toLowerCase(), s.id);

    // Cache user emails → ids
    const userCache = new Map<string, number>();
    const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
    for (const u of allUsers) userCache.set(u.email.toLowerCase(), u.id);

    let counter = project.ticketCounter;
    for (const row of allRows) {
      counter++;
      const typePrefix = row.type === 'story' ? 'US' : row.type === 'defect' ? 'DEF' : 'TASK';
      const key = `${project.key}-${typePrefix}-${counter}`;
      const sprintId = row.sprintName ? sprintCache.get(row.sprintName.toLowerCase()) : undefined;
      const assigneeId = row.assigneeEmail ? userCache.get(row.assigneeEmail.toLowerCase()) : undefined;

      const [t] = await db.insert(tickets).values({
        projectId,
        type: row.type,
        key,
        title: row.title,
        description: row.description,
        acceptanceCriteria: row.acceptanceCriteria,
        stepsToReproduce: row.stepsToReproduce,
        expectedResult: row.expectedResult,
        actualResult: row.actualResult,
        priority: row.priority,
        storyPoints: row.storyPoints,
        labels: row.labels,
        sprintId,
        assigneeId,
        reporterId: req.userId,
      }).returning({ key: tickets.key });

      created.push(t.key);
    }

    await db.update(projects).set({ ticketCounter: counter }).where(eq(projects.id, projectId));
    res.json({ imported: created.length, keys: created });
  } catch (err) { next(err); }
});

export default router;
