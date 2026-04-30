import { api } from './client';
import type { Project, Ticket, Sprint, GitRepo, Document, User, ProjectMember, ProjectMemberRole } from '../types';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }),
  register: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post<{ token: string; user: User }>('/auth/register', data),
  me: () => api.get<User>('/auth/me'),
};

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: number) => api.get<Project>(`/projects/${id}`),
  create: (data: Partial<Project>) => api.post<Project>('/projects', data),
  update: (id: number, data: Partial<Project>) => api.patch<Project>(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  // Team member management
  members: (id: number) => api.get<ProjectMember[]>(`/projects/${id}/members`),
  addMember: (id: number, email: string, role: ProjectMemberRole) =>
    api.post<ProjectMember>(`/projects/${id}/members`, { email, role }),
  updateMemberRole: (id: number, userId: number, role: ProjectMemberRole) =>
    api.patch<{ role: ProjectMemberRole }>(`/projects/${id}/members/${userId}`, { role }),
  removeMember: (id: number, userId: number) =>
    api.delete(`/projects/${id}/members/${userId}`),
};

// ─── Tickets ──────────────────────────────────────────────────────────────────
export const ticketsApi = {
  list: (projectId: number, params?: Record<string, string>) =>
    api.get<Ticket[]>(`/projects/${projectId}/tickets`, { params }),
  get: (projectId: number, ticketId: number) =>
    api.get<Ticket>(`/projects/${projectId}/tickets/${ticketId}`),
  create: (projectId: number, data: Partial<Ticket>) =>
    api.post<Ticket>(`/projects/${projectId}/tickets`, data),
  update: (projectId: number, ticketId: number, data: Partial<Ticket>) =>
    api.patch<Ticket>(`/projects/${projectId}/tickets/${ticketId}`, data),
  delete: (projectId: number, ticketId: number) =>
    api.delete(`/projects/${projectId}/tickets/${ticketId}`),
  addComment: (projectId: number, ticketId: number, body: string) =>
    api.post(`/projects/${projectId}/tickets/${ticketId}/comments`, { body }),
  getCommits: (projectId: number, ticketId: number) =>
    api.get(`/projects/${projectId}/tickets/${ticketId}/commits`),
  getActivity: (projectId: number, ticketId: number) =>
    api.get(`/projects/${projectId}/tickets/${ticketId}/activity`),
};

// ─── Sprints ──────────────────────────────────────────────────────────────────
export const sprintsApi = {
  list: (projectId: number) => api.get<Sprint[]>(`/projects/${projectId}/sprints`),
  get: (projectId: number, sprintId: number) =>
    api.get<Sprint>(`/projects/${projectId}/sprints/${sprintId}`),
  create: (projectId: number, data: Partial<Sprint>) =>
    api.post<Sprint>(`/projects/${projectId}/sprints`, data),
  update: (projectId: number, sprintId: number, data: Partial<Sprint>) =>
    api.patch<Sprint>(`/projects/${projectId}/sprints/${sprintId}`, data),
  moveTickets: (projectId: number, sprintId: number, ticketIds: number[]) =>
    api.post(`/projects/${projectId}/sprints/${sprintId}/tickets`, { ticketIds }),
};

// ─── Repos ────────────────────────────────────────────────────────────────────
export const reposApi = {
  list: (projectId: number) => api.get<GitRepo[]>(`/projects/${projectId}/repos`),
  create: (projectId: number, data: Partial<GitRepo> & { githubToken?: string }) =>
    api.post<GitRepo>(`/projects/${projectId}/repos`, data),
  delete: (projectId: number, repoId: number) =>
    api.delete(`/projects/${projectId}/repos/${repoId}`),
  sync: (projectId: number, repoId: number) =>
    api.post<{ inserted: number; total: number }>(`/projects/${projectId}/repos/${repoId}/sync`),
  branches: (projectId: number, repoId: number) =>
    api.get<{ name: string; current: boolean; sha: string }[]>(`/projects/${projectId}/repos/${repoId}/branches`),
  createBranch: (projectId: number, repoId: number, branchName: string, from?: string) =>
    api.post(`/projects/${projectId}/repos/${repoId}/branches`, { branchName, from }),
  compare: (projectId: number, repoId: number, base: string, head: string) =>
    api.get<{ base: string; head: string; diff: string }>(`/projects/${projectId}/repos/${repoId}/compare`, { params: { base, head } }),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiApi = {
  generateTicket: (type: string, briefDescription: string, projectContext?: string) =>
    api.post<Record<string, unknown>>('/ai/generate-ticket', { type, briefDescription, projectContext }),
  enrichTicket: (ticketId: number, field: string) =>
    api.post<{ field: string; content: string }>(`/ai/enrich-ticket/${ticketId}`, { field }),
  generateDocs: (repoId: number, projectId: number, docType: string, branch?: string) =>
    api.post<Document>('/ai/generate-docs', { repoId, projectId, docType, branch }),
  gapAnalysis: (repoId: number, projectId: number, base: string, head: string) =>
    api.post<Document>('/ai/gap-analysis', { repoId, projectId, base, head }),
  documents: (projectId: number) => api.get<Document[]>(`/ai/documents/${projectId}`),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  linked: (projectId: number) => api.get(`/projects/${projectId}/reports/linked`),
  unlinked: (projectId: number) => api.get(`/projects/${projectId}/reports/unlinked`),
  velocity: (projectId: number) => api.get(`/projects/${projectId}/reports/velocity`),
  summary: (projectId: number) => api.get(`/projects/${projectId}/reports/summary`),
};

// ─── Import ───────────────────────────────────────────────────────────────────
export const importApi = {
  downloadTemplate: () =>
    api.get('/projects/0/import/template', { responseType: 'blob' }),
  uploadExcel: (projectId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ imported: number; keys: string[] }>(
      `/projects/${projectId}/import/excel`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
};
