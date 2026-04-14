import {
  pgTable, serial, text, varchar, integer, boolean,
  timestamp, pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['admin', 'developer', 'viewer']);
export const ticketTypeEnum = pgEnum('ticket_type', ['story', 'defect', 'task']);
export const ticketStatusEnum = pgEnum('ticket_status', ['todo', 'in_progress', 'in_review', 'done']);
export const priorityEnum = pgEnum('priority', ['critical', 'high', 'medium', 'low']);
export const sprintStatusEnum = pgEnum('sprint_status', ['planning', 'active', 'completed']);
export const repoTypeEnum = pgEnum('repo_type', ['local', 'github']);
export const docTypeEnum = pgEnum('doc_type', ['architecture', 'sequence', 'dev_guide', 'gap_analysis']);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').default('developer').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  key: varchar('key', { length: 10 }).notNull().unique(),
  ownerId: integer('owner_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ticketCounter: integer('ticket_counter').default(0).notNull(),
});

// ─── Git Repos ────────────────────────────────────────────────────────────────
export const gitRepos = pgTable('git_repos', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: repoTypeEnum('type').notNull(),
  pathOrUrl: text('path_or_url').notNull(),
  githubToken: text('github_token'),
  githubOwner: varchar('github_owner', { length: 255 }),
  githubRepo: varchar('github_repo', { length: 255 }),
  defaultBranch: varchar('default_branch', { length: 255 }).default('main'),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Sprints ──────────────────────────────────────────────────────────────────
export const sprints = pgTable('sprints', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  goal: text('goal'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  status: sprintStatusEnum('status').default('planning').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Tickets ──────────────────────────────────────────────────────────────────
export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sprintId: integer('sprint_id').references(() => sprints.id, { onDelete: 'set null' }),
  type: ticketTypeEnum('type').notNull(),
  key: varchar('key', { length: 30 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  acceptanceCriteria: text('acceptance_criteria'),
  stepsToReproduce: text('steps_to_reproduce'),
  expectedResult: text('expected_result'),
  actualResult: text('actual_result'),
  status: ticketStatusEnum('status').default('todo').notNull(),
  priority: priorityEnum('priority').default('medium').notNull(),
  assigneeId: integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  reporterId: integer('reporter_id').references(() => users.id),
  storyPoints: integer('story_points'),
  labels: text('labels').array(),
  branchName: varchar('branch_name', { length: 255 }),
  boardOrder: integer('board_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  keyIdx: uniqueIndex('tickets_key_idx').on(t.key),
  projectIdx: index('tickets_project_idx').on(t.projectId),
  sprintIdx: index('tickets_sprint_idx').on(t.sprintId),
}));

// ─── Comments ─────────────────────────────────────────────────────────────────
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Activity Log ─────────────────────────────────────────────────────────────
export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  ticketIdx: index('activity_ticket_idx').on(t.ticketId),
}));

// ─── Commits ──────────────────────────────────────────────────────────────────
export const commits = pgTable('commits', {
  id: serial('id').primaryKey(),
  repoId: integer('repo_id').notNull().references(() => gitRepos.id, { onDelete: 'cascade' }),
  sha: varchar('sha', { length: 64 }).notNull(),
  message: text('message').notNull(),
  authorName: varchar('author_name', { length: 255 }),
  authorEmail: varchar('author_email', { length: 255 }),
  authoredAt: timestamp('authored_at').notNull(),
  branch: varchar('branch', { length: 255 }),
  ticketKeys: text('ticket_keys').array(),
}, (t) => ({
  shaIdx: uniqueIndex('commits_sha_repo_idx').on(t.sha, t.repoId),
  repoIdx: index('commits_repo_idx').on(t.repoId),
}));

// ─── Documents ────────────────────────────────────────────────────────────────
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  repoId: integer('repo_id').references(() => gitRepos.id, { onDelete: 'set null' }),
  type: docTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  branch: varchar('branch', { length: 255 }),
  isStale: boolean('is_stale').default(false).notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  ownedProjects: many(projects),
  assignedTickets: many(tickets, { relationName: 'assignee' }),
  reportedTickets: many(tickets, { relationName: 'reporter' }),
  comments: many(comments),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  tickets: many(tickets),
  sprints: many(sprints),
  gitRepos: many(gitRepos),
  documents: many(documents),
}));

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  project: one(projects, { fields: [sprints.projectId], references: [projects.id] }),
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  project: one(projects, { fields: [tickets.projectId], references: [projects.id] }),
  sprint: one(sprints, { fields: [tickets.sprintId], references: [sprints.id] }),
  assignee: one(users, { fields: [tickets.assigneeId], references: [users.id], relationName: 'assignee' }),
  reporter: one(users, { fields: [tickets.reporterId], references: [users.id], relationName: 'reporter' }),
  comments: many(comments),
  activity: many(activityLog),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  ticket: one(tickets, { fields: [comments.ticketId], references: [tickets.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));

export const gitReposRelations = relations(gitRepos, ({ one, many }) => ({
  project: one(projects, { fields: [gitRepos.projectId], references: [projects.id] }),
  commits: many(commits),
  documents: many(documents),
}));

export const commitsRelations = relations(commits, ({ one }) => ({
  repo: one(gitRepos, { fields: [commits.repoId], references: [gitRepos.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  project: one(projects, { fields: [documents.projectId], references: [projects.id] }),
  repo: one(gitRepos, { fields: [documents.repoId], references: [gitRepos.id] }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;
export type Sprint = typeof sprints.$inferSelect;
export type InsertSprint = typeof sprints.$inferInsert;
export type GitRepo = typeof gitRepos.$inferSelect;
export type InsertGitRepo = typeof gitRepos.$inferInsert;
export type Commit = typeof commits.$inferSelect;
export type InsertCommit = typeof commits.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;
export type ActivityLog = typeof activityLog.$inferSelect;
export type Document = typeof documents.$inferSelect;
