import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reposApi, aiApi } from '../api';
import { TopBar } from '../components/Layout/TopBar';
import { Modal, EmptyState, Spinner } from '../components/ui';
import type { GitRepo } from '../types';

function AddRepoModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', type: 'local' as 'local' | 'github', pathOrUrl: '', githubToken: '', githubOwner: '', githubRepo: '', defaultBranch: 'main' });
  const mut = useMutation({
    mutationFn: () => reposApi.create(projectId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['repos', projectId] }); onClose(); },
  });
  return (
    <Modal title="Add Repository" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
            <option value="local">Local Path</option>
            <option value="github">GitHub</option>
          </select>
        </div>
        <div>
          <label className="label">{form.type === 'local' ? 'Local Path *' : 'GitHub URL *'}</label>
          <input className="input" required value={form.pathOrUrl}
            placeholder={form.type === 'local' ? 'C:/Workspace/MyProject' : 'https://github.com/owner/repo'}
            onChange={(e) => setForm({ ...form, pathOrUrl: e.target.value })} />
        </div>
        {form.type === 'github' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">GitHub Owner</label>
                <input className="input" value={form.githubOwner} onChange={(e) => setForm({ ...form, githubOwner: e.target.value })} />
              </div>
              <div>
                <label className="label">GitHub Repo</label>
                <input className="input" value={form.githubRepo} onChange={(e) => setForm({ ...form, githubRepo: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">GitHub Token</label>
              <input className="input" type="password" value={form.githubToken}
                placeholder="ghp_..." onChange={(e) => setForm({ ...form, githubToken: e.target.value })} />
            </div>
          </>
        )}
        <div>
          <label className="label">Default Branch</label>
          <input className="input" value={form.defaultBranch} onChange={(e) => setForm({ ...form, defaultBranch: e.target.value })} />
        </div>
        {mut.isError && <p className="text-sm text-red-600">{(mut.error as any)?.response?.data?.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>Add Repo</button>
        </div>
      </form>
    </Modal>
  );
}

function RepoCard({ repo, projectId }: { repo: GitRepo; projectId: number }) {
  const qc = useQueryClient();
  const [showBranches, setShowBranches] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [base, setBase] = useState(repo.defaultBranch || 'main');
  const [head, setHead] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [gapResult, setGapResult] = useState('');
  const [generating, setGenerating] = useState(false);

  const syncMut = useMutation({
    mutationFn: () => reposApi.sync(projectId, repo.id),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['repos', projectId] }); alert(`Synced: ${r.data.inserted} new commits from ${r.data.total} total`); },
  });

  const { data: branches } = useQuery({
    queryKey: ['branches', repo.id],
    queryFn: () => reposApi.branches(projectId, repo.id).then((r) => r.data),
    enabled: showBranches,
  });

  const createBranchMut = useMutation({
    mutationFn: () => reposApi.createBranch(projectId, repo.id, newBranch, base),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches', repo.id] }); setNewBranch(''); },
  });

  async function handleGapAnalysis() {
    if (!base || !head) return;
    setGenerating(true);
    try {
      const { data } = await aiApi.gapAnalysis(repo.id, projectId, base, head);
      setGapResult(data.content);
    } finally { setGenerating(false); }
  }

  return (
    <div className="card">
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span>{repo.type === 'local' ? '💻' : '🐙'}</span>
            <h3 className="font-semibold text-gray-900">{repo.name}</h3>
            <span className="badge bg-gray-100 text-gray-600">{repo.type}</span>
          </div>
          <p className="text-xs text-gray-500 font-mono">{repo.pathOrUrl}</p>
          {repo.lastSyncedAt && (
            <p className="text-xs text-gray-400 mt-1">Last synced: {new Date(repo.lastSyncedAt).toLocaleString()}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs" onClick={() => setShowBranches(!showBranches)}>
            🌿 Branches
          </button>
          <button className="btn-secondary text-xs" onClick={() => setShowCompare(!showCompare)}>
            🔍 Gap Analysis
          </button>
          <button className="btn-primary text-xs" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            {syncMut.isPending ? 'Syncing…' : '🔄 Sync'}
          </button>
        </div>
      </div>

      {showBranches && (
        <div className="border-t border-gray-100 px-5 py-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Branches</h4>
          {!branches ? <Spinner size="sm" /> : (
            <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
              {branches.map((b) => (
                <div key={b.name} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-gray-700">{b.name}</span>
                  {b.current && <span className="badge bg-green-100 text-green-700">current</span>}
                  <span className="text-xs text-gray-400 font-mono">{b.sha.slice(0, 7)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className="input flex-1 text-sm" placeholder="New branch name (e.g. feature/my-feature)"
              value={newBranch} onChange={(e) => setNewBranch(e.target.value)} />
            <input className="input w-32 text-sm" placeholder="From branch" value={base}
              onChange={(e) => setBase(e.target.value)} />
            <button className="btn-primary text-xs" disabled={!newBranch || createBranchMut.isPending}
              onClick={() => createBranchMut.mutate()}>Create</button>
          </div>
        </div>
      )}

      {showCompare && (
        <div className="border-t border-gray-100 px-5 py-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">AI Gap Analysis</h4>
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="label text-xs">Base Branch</label>
              <input className="input text-sm" value={base} onChange={(e) => setBase(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label text-xs">Compare Branch (Head)</label>
              <input className="input text-sm" placeholder="feature/my-branch" value={head} onChange={(e) => setHead(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button className="btn-primary text-xs" onClick={handleGapAnalysis} disabled={generating || !base || !head}>
                {generating ? <Spinner size="sm" /> : '✨ Analyze'}
              </button>
            </div>
          </div>
          {gapResult && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 max-h-64 overflow-y-auto whitespace-pre-wrap">
              {gapResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReposPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId!);
  const [showAdd, setShowAdd] = useState(false);

  const { data: repos, isLoading } = useQuery({
    queryKey: ['repos', pid],
    queryFn: () => reposApi.list(pid).then((r) => r.data),
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar title="Repositories" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Git Repositories</h2>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Repository</button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !repos?.length ? (
          <EmptyState icon="🔀" title="No repositories linked"
            description="Link a local or GitHub repository to track commits and generate documentation."
            action={<button className="btn-primary" onClick={() => setShowAdd(true)}>Add Repository</button>} />
        ) : (
          <div className="space-y-4">
            {repos.map((r) => <RepoCard key={r.id} repo={r} projectId={pid} />)}
          </div>
        )}
      </div>
      {showAdd && <AddRepoModal projectId={pid} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
