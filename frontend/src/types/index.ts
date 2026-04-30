export type ProjectMemberRole = 'owner' | 'member' | 'viewer';
export type TicketType = 'story' | 'defect' | 'task';
export type TicketStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type SprintStatus = 'planning' | 'active' | 'completed';
export type RepoType = 'local' | 'github';
export type DocType = 'architecture' | 'sequence' | 'dev_guide' | 'gap_analysis';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface ProjectMember extends User {
  memberRole: ProjectMemberRole;
  joinedAt: string;
  memberId: number;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  key: string;
  ownerId?: number;
  owner?: User;
  memberRole?: ProjectMemberRole;
  createdAt: string;
  ticketCounter: number;
  sprints?: Sprint[];
  gitRepos?: GitRepo[];
}

export interface Sprint {
  id: number;
  projectId: number;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  status: SprintStatus;
  tickets?: Ticket[];
}

export interface Ticket {
  id: number;
  projectId: number;
  sprintId?: number;
  type: TicketType;
  key: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  status: TicketStatus;
  priority: Priority;
  assigneeId?: number;
  reporterId?: number;
  storyPoints?: number;
  labels?: string[];
  branchName?: string;
  boardOrder: number;
  createdAt: string;
  updatedAt: string;
  assignee?: User;
  reporter?: User;
  sprint?: Sprint;
  comments?: Comment[];
  activity?: ActivityLog[];
}

export interface Comment {
  id: number;
  ticketId: number;
  userId: number;
  body: string;
  createdAt: string;
  user?: User;
}

export interface ActivityLog {
  id: number;
  ticketId: number;
  userId?: number;
  action: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface GitRepo {
  id: number;
  projectId: number;
  name: string;
  type: RepoType;
  pathOrUrl: string;
  githubOwner?: string;
  githubRepo?: string;
  defaultBranch?: string;
  lastSyncedAt?: string;
}

export interface Commit {
  id: number;
  repoId: number;
  sha: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
  authoredAt: string;
  branch?: string;
  ticketKeys?: string[];
  repo?: GitRepo;
}

export interface Document {
  id: number;
  projectId: number;
  repoId?: number;
  type: DocType;
  title: string;
  content: string;
  branch?: string;
  isStale: boolean;
  generatedAt: string;
  repo?: GitRepo;
}

export interface VelocityData {
  sprintId: number;
  sprintName: string;
  status: SprintStatus;
  totalPoints: number;
  completedPoints: number;
  totalTickets: number;
  completedTickets: number;
  stories: number;
  defects: number;
}

export interface ReportSummary {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}
