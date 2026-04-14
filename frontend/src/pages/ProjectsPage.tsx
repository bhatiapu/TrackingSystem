import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api';
import { Modal, EmptyState, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', key: '', description: '' });
  const mut = useMutation({
    mutationFn: () => projectsApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose(); },
  });

  return (
    <Modal title="New Project" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
        <div>
          <label className="label">Project Name *</label>
          <input className="input" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value,
              key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) })} />
        </div>
        <div>
          <label className="label">Project Key *</label>
          <input className="input" required maxLength={10} value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
          <p className="text-xs text-gray-500 mt-1">Used as prefix for ticket IDs (e.g. MYAPP-US-1)</p>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        {mut.isError && <p className="text-sm text-red-600">{(mut.error as any)?.response?.data?.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>
            {mut.isPending ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <h1 className="text-xl font-bold text-gray-900">TrackingSystem</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button onClick={logout} className="btn-secondary text-xs">Sign out</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Project</button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !projects?.length ? (
          <EmptyState icon="📋" title="No projects yet"
            description="Create your first project to start tracking user stories and defects."
            action={<button className="btn-primary" onClick={() => setShowCreate(true)}>Create Project</button>} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div key={p.id} className="card p-5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                onClick={() => navigate(`/projects/${p.id}/dashboard`)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-sm">
                    {p.key.slice(0, 3)}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{p.name}</h3>
                {p.description && <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>{p.ticketCounter} tickets</span>
                  {p.owner && <span>by {p.owner.name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
