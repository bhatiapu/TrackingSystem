import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, aiApi, projectsApi } from '../../api';
import { Modal, PriorityBadge, StatusBadge, TypeBadge, Avatar, Spinner } from '../ui';
import type { Ticket } from '../../types';
import { format } from 'date-fns';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const;
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export function TicketModal({
  ticket, projectId, onClose,
}: {
  ticket: Ticket;
  projectId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'commits' | 'activity'>('detail');

  const { data: full } = useQuery({
    queryKey: ['ticket', ticket.id],
    queryFn: () => ticketsApi.get(projectId, ticket.id).then((r) => r.data),
    initialData: ticket,
  });

  const { data: members } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectsApi.members(projectId).then((r) => r.data),
  });

  const { data: commits } = useQuery({
    queryKey: ['ticket-commits', ticket.id],
    queryFn: () => ticketsApi.getCommits(projectId, ticket.id).then((r) => r.data as any[]),
    enabled: activeTab === 'commits',
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<Ticket>) => ticketsApi.update(projectId, ticket.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets', projectId] }); qc.invalidateQueries({ queryKey: ['ticket', ticket.id] }); },
  });

  const commentMut = useMutation({
    mutationFn: (body: string) => ticketsApi.addComment(projectId, ticket.id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', ticket.id] }); setComment(''); },
  });

  async function handleEnrich(field: 'acceptanceCriteria' | 'stepsToReproduce' | 'description') {
    setEnriching(true);
    try {
      const { data } = await aiApi.enrichTicket(ticket.id, field);
      await ticketsApi.update(projectId, ticket.id, { [field]: data.content });
      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] });
    } finally { setEnriching(false); }
  }

  const t = full || ticket;

  return (
    <Modal title="" onClose={onClose} size="xl">
      <div className="flex gap-6">
        {/* Left main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <TypeBadge type={t.type} />
            <span className="text-sm font-mono text-gray-500">{t.key}</span>
            {t.branchName && (
              <span className="badge bg-gray-100 text-gray-600 font-mono">🌿 {t.branchName}</span>
            )}
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.title}</h2>

          <div className="flex border-b border-gray-200 mb-4">
            {(['detail', 'commits', 'activity'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'commits' && commits ? ` (${commits.length})` : ''}
              </button>
            ))}
          </div>

          {activeTab === 'detail' && (
            <div className="space-y-4">
              <Section label="Description" value={t.description} field="description"
                onEnrich={() => handleEnrich('description')} enriching={enriching} />
              {t.type === 'story' && (
                <Section label="Acceptance Criteria" value={t.acceptanceCriteria} field="acceptanceCriteria"
                  onEnrich={() => handleEnrich('acceptanceCriteria')} enriching={enriching} />
              )}
              {t.type === 'defect' && (
                <>
                  <Section label="Steps to Reproduce" value={t.stepsToReproduce} field="stepsToReproduce"
                    onEnrich={() => handleEnrich('stepsToReproduce')} enriching={enriching} />
                  <Section label="Expected Result" value={t.expectedResult} />
                  <Section label="Actual Result" value={t.actualResult} />
                </>
              )}

              {/* Comments */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Comments ({t.comments?.length || 0})</h4>
                <div className="space-y-3 mb-3">
                  {t.comments?.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <Avatar name={c.user?.name || '?'} size="sm" />
                      <div className="flex-1 bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-700">{c.user?.name}</span>
                          <span className="text-xs text-gray-400">{format(new Date(c.createdAt), 'MMM d, h:mm a')}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea className="input flex-1 resize-none" rows={2} placeholder="Add a comment…"
                    value={comment} onChange={(e) => setComment(e.target.value)} />
                  <button className="btn-primary self-end" disabled={!comment || commentMut.isPending}
                    onClick={() => commentMut.mutate(comment)}>Post</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'commits' && (
            <div className="space-y-2">
              {!commits ? <div className="flex justify-center py-8"><Spinner size="sm" /></div>
                : commits.length === 0 ? <p className="text-sm text-gray-500 py-4 text-center">No linked commits. Reference this ticket in commit messages as [{t.key}]</p>
                : commits.map((c: any) => (
                  <div key={c.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{c.sha?.slice(0, 7)}</span>
                      <span className="badge bg-blue-50 text-blue-700">{c.branch}</span>
                    </div>
                    <p className="text-sm text-gray-800">{c.message}</p>
                    <div className="text-xs text-gray-500 mt-1">{c.authorName} · {format(new Date(c.authoredAt), 'MMM d, yyyy')}</div>
                  </div>
                ))}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-2">
              {t.activity?.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-gray-700 capitalize">{a.action.replace(/_/g, ' ')}</span>
                    {a.oldValue && <span className="text-gray-400"> · <s>{a.oldValue}</s> → <b>{a.newValue}</b></span>}
                    <span className="text-gray-400 ml-2 text-xs">{format(new Date(a.createdAt), 'MMM d, h:mm a')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-56 flex-shrink-0 space-y-4">
          <Field label="Status">
            <select className="select text-xs" value={t.status}
              onChange={(e) => updateMut.mutate({ status: e.target.value as any })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="select text-xs" value={t.priority}
              onChange={(e) => updateMut.mutate({ priority: e.target.value as any })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Assignee">
            <select className="select text-xs" value={t.assigneeId || ''}
              onChange={(e) => updateMut.mutate({ assigneeId: e.target.value ? parseInt(e.target.value) : undefined })}>
              <option value="">Unassigned</option>
              {members?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Story Points">
            <input type="number" className="input text-xs" value={t.storyPoints || ''}
              onChange={(e) => updateMut.mutate({ storyPoints: e.target.value ? parseInt(e.target.value) : undefined })} />
          </Field>
          {t.labels && t.labels.length > 0 && (
            <Field label="Labels">
              <div className="flex flex-wrap gap-1">
                {t.labels.map((l) => <span key={l} className="badge bg-gray-100 text-gray-600">{l}</span>)}
              </div>
            </Field>
          )}
          <Field label="Reporter">
            <span className="text-xs text-gray-600">{t.reporter?.name || '—'}</span>
          </Field>
          <Field label="Created">
            <span className="text-xs text-gray-600">{format(new Date(t.createdAt), 'MMM d, yyyy')}</span>
          </Field>
          <Field label="Updated">
            <span className="text-xs text-gray-600">{format(new Date(t.updatedAt), 'MMM d, yyyy')}</span>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Section({ label, value, field, onEnrich, enriching }: {
  label: string;
  value?: string | null;
  field?: string;
  onEnrich?: () => void;
  enriching?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
        {onEnrich && (
          <button className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            disabled={enriching} onClick={onEnrich}>
            {enriching ? '✨ Generating…' : '✨ AI Fill'}
          </button>
        )}
      </div>
      {value ? (
        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-3">{value}</p>
      ) : (
        <p className="text-sm text-gray-400 italic">Not provided</p>
      )}
    </div>
  );
}
