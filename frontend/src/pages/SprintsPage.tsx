import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sprintsApi, ticketsApi } from '../api';
import { TopBar } from '../components/Layout/TopBar';
import { Modal, EmptyState, Spinner, StatusBadge, PriorityBadge } from '../components/ui';
import type { Sprint } from '../types';

function SprintForm({ sprint, projectId, onClose }: { sprint?: Sprint; projectId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: sprint?.name || '',
    goal: sprint?.goal || '',
    startDate: sprint?.startDate?.slice(0, 10) || '',
    endDate: sprint?.endDate?.slice(0, 10) || '',
  });

  const mut = useMutation({
    mutationFn: () => sprint
      ? sprintsApi.update(projectId, sprint.id, form)
      : sprintsApi.create(projectId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sprints', projectId] }); onClose(); },
  });

  return (
    <Modal title={sprint ? 'Edit Sprint' : 'New Sprint'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
        <div>
          <label className="label">Sprint Name *</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Goal</label>
          <textarea className="input resize-none" rows={2} value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date</label>
            <input className="input" type="date" value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input className="input" type="date" value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save Sprint'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const statusColors: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
};

export default function SprintsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId!);
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Sprint | null>(null);

  const { data: sprints, isLoading } = useQuery({
    queryKey: ['sprints', pid],
    queryFn: () => sprintsApi.list(pid).then((r) => r.data),
  });

  const { data: backlog } = useQuery({
    queryKey: ['tickets', pid, { sprintId: 'null' }],
    queryFn: () => ticketsApi.list(pid, { sprintId: 'null' }).then((r) => r.data),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => sprintsApi.update(pid, id, { status: 'active' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', pid] }),
  });

  const completeMut = useMutation({
    mutationFn: (id: number) => sprintsApi.update(pid, id, { status: 'completed' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', pid] }),
  });

  const addTicketsMut = useMutation({
    mutationFn: ({ sprintId, ticketIds }: { sprintId: number; ticketIds: number[] }) =>
      sprintsApi.moveTickets(pid, sprintId, ticketIds),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets', pid] }); },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar title="Sprints" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Sprints</h2>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Sprint</button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !sprints?.length ? (
          <EmptyState icon="🏃" title="No sprints yet"
            description="Create your first sprint to start planning."
            action={<button className="btn-primary" onClick={() => setShowCreate(true)}>Create Sprint</button>} />
        ) : (
          <div className="space-y-4">
            {sprints.map((sprint) => (
              <div key={sprint.id} className="card">
                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{sprint.name}</h3>
                    <span className={`badge ${statusColors[sprint.status]}`}>{sprint.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sprint.status === 'planning' && (
                      <button className="btn-primary text-xs"
                        onClick={() => activateMut.mutate(sprint.id)}>Start Sprint</button>
                    )}
                    {sprint.status === 'active' && (
                      <button className="btn-secondary text-xs"
                        onClick={() => completeMut.mutate(sprint.id)}>Complete</button>
                    )}
                    <button className="btn-secondary text-xs" onClick={() => setEditing(sprint)}>Edit</button>
                  </div>
                </div>

                {sprint.goal && (
                  <div className="px-5 py-2 bg-blue-50 text-sm text-blue-800">
                    🎯 {sprint.goal}
                  </div>
                )}

                <div className="px-5 py-3 grid grid-cols-2 gap-4 text-sm text-gray-600">
                  {sprint.startDate && <span>Start: {new Date(sprint.startDate).toLocaleDateString()}</span>}
                  {sprint.endDate && <span>End: {new Date(sprint.endDate).toLocaleDateString()}</span>}
                </div>

                {/* Backlog tickets to add */}
                {sprint.status !== 'completed' && backlog && backlog.length > 0 && (
                  <div className="px-5 pb-4">
                    <p className="text-xs text-gray-500 mb-2">{backlog.length} tickets in backlog — select to add to this sprint:</p>
                    <div className="flex flex-wrap gap-2">
                      {backlog.slice(0, 5).map((t) => (
                        <button key={t.id} className="btn-secondary text-xs"
                          onClick={() => addTicketsMut.mutate({ sprintId: sprint.id, ticketIds: [t.id] })}>
                          + {t.key}
                        </button>
                      ))}
                      {backlog.length > 5 && (
                        <span className="text-xs text-gray-400 self-center">+{backlog.length - 5} more in backlog</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <SprintForm projectId={pid} onClose={() => setShowCreate(false)} />}
      {editing && <SprintForm sprint={editing} projectId={pid} onClose={() => setEditing(null)} />}
    </div>
  );
}
