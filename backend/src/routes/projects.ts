import { Router } from 'express';
import { db } from '../db';
import { projects, users, projectMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── Helper: resolve membership role for current user ─────────────────────────
async function getMemberRole(projectId: number, userId: number) {
  const membership = await db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
  });
  return membership?.role ?? null;
}

// ─── List projects the current user is a member of ────────────────────────────
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const memberships = await db.query.projectMembers.findMany({
      where: eq(projectMembers.userId, req.userId!),
      with: {
        project: {
          with: { owner: { columns: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    });
    const result = memberships.map((m) => ({ ...m.project, memberRole: m.role }));
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(result);
  } catch (err) { next(err); }
});

// ─── Create project (creator becomes owner member) ────────────────────────────
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { name, description, key } = req.body;
    if (!name || !key) return res.status(400).json({ error: 'name and key are required' });
    const upperKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const existing = await db.query.projects.findFirst({ where: eq(projects.key, upperKey) });
    if (existing) return res.status(409).json({ error: `Project key ${upperKey} already exists` });

    const owner = req.userId
      ? await db.query.users.findFirst({ where: eq(users.id, req.userId) })
      : null;

    const [project] = await db.insert(projects).values({
      name, description, key: upperKey, ownerId: owner ? req.userId : undefined,
    }).returning();

    // Auto-add creator as owner member
    if (req.userId) {
      await db.insert(projectMembers).values({
        projectId: project.id, userId: req.userId, role: 'owner',
      });
    }

    res.status(201).json(project);
  } catch (err) { next(err); }
});

// ─── Get single project (must be a member) ────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const role = await getMemberRole(id, req.userId!);
    if (!role) return res.status(403).json({ error: 'Not a member of this project' });

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        owner: { columns: { id: true, name: true, email: true, avatarUrl: true } },
        gitRepos: true,
        sprints: { orderBy: (s, { desc }) => [desc(s.createdAt)] },
      },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ ...project, memberRole: role });
  } catch (err) { next(err); }
});

// ─── Update project (owner or member) ────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const role = await getMemberRole(id, req.userId!);
    if (!role) return res.status(403).json({ error: 'Not a member of this project' });
    if (role === 'viewer') return res.status(403).json({ error: 'Viewers cannot edit project settings' });

    const { name, description } = req.body;
    const [updated] = await db.update(projects)
      .set({ name, description, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Project not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

// ─── Delete project (owner only) ──────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const role = await getMemberRole(id, req.userId!);
    if (role !== 'owner') return res.status(403).json({ error: 'Only the project owner can delete it' });
    await db.delete(projects).where(eq(projects.id, id));
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── List project members ─────────────────────────────────────────────────────
router.get('/:id/members', async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const role = await getMemberRole(id, req.userId!);
    if (!role) return res.status(403).json({ error: 'Not a member of this project' });

    const members = await db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, id),
      with: { user: { columns: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
      orderBy: (m, { asc }) => [asc(m.joinedAt)],
    });
    res.json(members.map((m) => ({ ...m.user, memberRole: m.role, joinedAt: m.joinedAt, memberId: m.id })));
  } catch (err) { next(err); }
});

// ─── Add member by email ──────────────────────────────────────────────────────
router.post('/:id/members', async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const myRole = await getMemberRole(id, req.userId!);
    if (myRole !== 'owner') return res.status(403).json({ error: 'Only the project owner can add members' });

    const { email, role = 'member' } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    if (!['owner', 'member', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase().trim()) });
    if (!user) return res.status(404).json({ error: `No user found with email ${email}` });

    const existing = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, id), eq(projectMembers.userId, user.id)),
    });
    if (existing) return res.status(409).json({ error: 'User is already a member of this project' });

    const [membership] = await db.insert(projectMembers)
      .values({ projectId: id, userId: user.id, role })
      .returning();

    res.status(201).json({ ...user, memberRole: membership.role, joinedAt: membership.joinedAt, memberId: membership.id });
  } catch (err) { next(err); }
});

// ─── Update member role ───────────────────────────────────────────────────────
router.patch('/:id/members/:userId', async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    const myRole = await getMemberRole(id, req.userId!);
    if (myRole !== 'owner') return res.status(403).json({ error: 'Only the project owner can change roles' });
    if (targetUserId === req.userId) return res.status(400).json({ error: 'Cannot change your own role' });

    const { role } = req.body;
    if (!['owner', 'member', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const [updated] = await db.update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, targetUserId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Member not found' });
    res.json({ role: updated.role });
  } catch (err) { next(err); }
});

// ─── Remove member ────────────────────────────────────────────────────────────
router.delete('/:id/members/:userId', async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    const myRole = await getMemberRole(id, req.userId!);

    // Owners can remove anyone; members can remove themselves
    const isSelf = targetUserId === req.userId;
    if (!isSelf && myRole !== 'owner') return res.status(403).json({ error: 'Only the project owner can remove members' });

    const target = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, id), eq(projectMembers.userId, targetUserId)),
    });
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner' && isSelf) {
      // Check if there's another owner before allowing owner to leave
      const otherOwners = await db.query.projectMembers.findMany({
        where: and(eq(projectMembers.projectId, id), eq(projectMembers.role, 'owner')),
      });
      if (otherOwners.length <= 1) return res.status(400).json({ error: 'Cannot leave — you are the only owner. Transfer ownership first.' });
    }

    await db.delete(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, targetUserId)));
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
