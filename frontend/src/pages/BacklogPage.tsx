import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, sprintsApi, aiApi, projectsApi } from '../api';
import { TopBar } from '../components/Layout/TopBar';
import { TicketModal } from '../components/TicketDetail/TicketModal';
import { PriorityBadge, TypeBadge, StatusBadge, Avatar, Modal, EmptyState, Spinner } from '../components/ui';
import type { Ticket, TicketType, Priority } from '../types';

function CreateTicketModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    type: 'story' as TicketType, title: '', description: '',
    acceptanceCriteria: '', stepsToReproduce: '', expectedResult: '', actualResult: '',
    priority: 'medium' as Priority, storyPoints: '', labels: '', branchName: '',
  });
  const [briefDesc, setBriefDesc] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: sprints } = useQuery({ queryKey: ['sprints', projectId], queryFn: () => sprintsApi.list(projectId).then((r) => r.data) });

  const mut = useMutation({
    mutationFn: () => ticketsApi.create(projectId, {
      ...form,
      storyPoints: form.storyPoints ? parseInt(form.storyPoints) : undefined,
      labels: form.labels ? form.labels.split(',').map((l) => l.trim()) : [],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets', projectId] }); onClose(); },
  });

  async function handleAIGenerate() {
    if (!briefDesc) return;
    setGenerating(true);
    try {
      const { data } = await aiApi.generateTicket(form.type, briefDesc);
      setForm((f) => ({
        ...f,
        title: (data.title as string) || f.title,
        description: (data.description as string) || f.description,
        acceptanceCriteria: (data.acceptanceCriteria as string) || f.acceptanceCriteria,
        stepsToReproduce: (data.stepsToReproduce as string) || f.stepsToReproduce,
        expectedResult: (data.expectedResult as string) || f.expectedResult,
        actualResult: (data.actualResult as string) || f.actualResult,
        priority: ((data.priority as Priority) || f.priority),
        storyPoints: data.storyPoints ? String(data.storyPoints) : f.storyPoints,
        labels: Array.isArray(data.labels) ? (data.labels as string[]).join(', ') : f.labels,
        branchName: (data.suggestedBranch as string) || f.branchName,
      }));
      setAiMode(false);
    } finally { setGenerating(false); }
  }

  return (
    <Modal title="Create Ticket" onClose={onClose} size="lg">
      <div className="flex gap-2 mb-4">
        {(['story', 'defect', 'task'] as const).map((t) => (
          <button key={t} onClick={() => setForm({ ...form, type: t })}
            className={`btn text-xs ${form.type === t ? 'btn-primary' : 'btn-secondary'}`}>
            {t === 'story' ? '📖' : t === 'defect' ? '🐛' : '✅'} {t}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setAiMode(!aiMode)} className={`btn text-xs ${aiMode ? 'btn-primary' : 'btn-secondary'}`}>
          ✨ AI Generate
        </button>
      </div>

      {aiMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <label className="label text-blue-800">Brief description → AI generates full ticket</label>
          <div className="flex gap-2">
            <textarea className="input flex-1 resize-none" rows={2} placeholder="e.g. Users should be able to reset their password via email link"
              value={briefDesc} onChange={(e) => setBriefDesc(e.target.value)} />
            <button className="btn-primary self-end text-xs" onClick={handleAIGenerate} disabled={generating || !briefDesc}>
              {generating ? <Spinner size="sm" /> : 'Generate'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
        <div>
          <label className="label">Title *</label>
          <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        {form.type === 'story' && (
          <div>
            <label className="label">Acceptance Criteria</label>
            <textarea className="input resize-none" rows={3} value={form.acceptanceCriteria}
              onChange={(e) => setForm({ ...form, acceptanceCriteria: e.target.value })} />
          </div>
        )}
        {form.type === 'defect' && (
          <>
            <div>
              <label className="label">Steps to Reproduce</label>
              <textarea className="input resize-none" rows={3} value={form.stepsToReproduce}
                onChange={(e) => setForm({ ...form, stepsToReproduce: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Expected Result</label>
                <textarea className="input resize-none" rows={2} value={form.expectedResult}
                  onChange={(e) => setForm({ ...form, expectedResult: e.target.value })} />
              </div>
              <div>
                <label className="label">Actual Result</label>
                <textarea className="input resize-none" rows={2} value={form.actualResult}
                  onChange={(e) => setForm({ ...form, actualResult: e.target.value })} />
              </div>
            </div>
          </>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Priority</label>
            <select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
              {(['critical', 'high', 'medium', 'low'] as const).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Story Points</label>
            <input className="input" type="number" value={form.storyPoints}
              onChange={(e) => setForm({ ...form, storyPoints: e.target.value })} />
          </div>
          <div>
            <label className="label">Branch Name</label>
            <input className="input" placeholder="feature/..." value={form.branchName}
              onChange={(e) => setForm({ ...form, branchName: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Labels (comma separated)</label>
          <input className="input" placeholder="auth, backend, ui" value={form.labels}
            onChange={(e) => setForm({ ...form, labels: e.target.value })} />
        </div>
        {mut.isError && <p className="text-sm text-red-600">{(mut.error as any)?.response?.data?.error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>
            {mut.isPending ? 'Creating…' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function BacklogPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId!);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  const params: Record<string, string> = { sprintId: 'null' };
  if (typeFilter) params.type = typeFilter;
  if (statusFilter) params.status = statusFilter;

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets', pid, params],
    queryFn: () => ticketsApi.list(pid, params).then((r) => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => ticketsApi.delete(pid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', pid] }),
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar title="Backlog" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Create Ticket</button>
          <select className="select w-36 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="story">📖 Story</option>
            <option value="defect">🐛 Defect</option>
            <option value="task">✅ Task</option>
          </select>
          <select className="select w-40 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </select>
          <span className="text-sm text-gray-500 ml-auto">{tickets?.length || 0} items</span>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : !tickets?.length ? (
            <EmptyState icon="📝" title="Backlog is empty"
              description="Create tickets or move them to the backlog from sprints."
              action={<button className="btn-primary" onClick={() => setShowCreate(true)}>Create Ticket</button>} />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-24">Key</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-20">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-24">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-28">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-32">Assignee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-8">SP</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(t)}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.key}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{t.title}</td>
                    <td className="px-4 py-3"><TypeBadge type={t.type} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3">
                      {t.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar name={t.assignee.name} size="sm" />
                          <span className="text-xs text-gray-600">{t.assignee.name}</span>
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.storyPoints || '—'}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button className="text-red-400 hover:text-red-600 text-xs"
                        onClick={() => { if (confirm('Delete?')) deleteMut.mutate(t.id); }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showCreate && <CreateTicketModal projectId={pid} onClose={() => setShowCreate(false)} />}
      {selected && <TicketModal ticket={selected} projectId={pid} onClose={() => setSelected(null)} />}
    </div>
  );
}
