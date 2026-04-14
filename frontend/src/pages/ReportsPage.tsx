import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { reportsApi } from '../api';
import { TopBar } from '../components/Layout/TopBar';
import { PriorityBadge, TypeBadge, StatusBadge, Avatar, Spinner } from '../components/ui';

const TABS = ['velocity', 'linked', 'unlinked'] as const;
type Tab = typeof TABS[number];

export default function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId!);
  const [tab, setTab] = useState<Tab>('velocity');

  const { data: velocity, isLoading: vLoading } = useQuery({
    queryKey: ['reports-velocity', pid],
    queryFn: () => reportsApi.velocity(pid).then((r) => r.data as any[]),
    enabled: tab === 'velocity',
  });

  const { data: linked, isLoading: lLoading } = useQuery({
    queryKey: ['reports-linked', pid],
    queryFn: () => reportsApi.linked(pid).then((r) => r.data as any[]),
    enabled: tab === 'linked',
  });

  const { data: unlinked, isLoading: uLoading } = useQuery({
    queryKey: ['reports-unlinked', pid],
    queryFn: () => reportsApi.unlinked(pid).then((r) => r.data as any[]),
    enabled: tab === 'unlinked',
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar title="Reports" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex border-b border-gray-200 mb-6">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'velocity' ? '📈 Sprint Velocity' : t === 'linked' ? '🔗 Linked Commits' : '⚠ No Commits'}
            </button>
          ))}
        </div>

        {/* Velocity Chart */}
        {tab === 'velocity' && (
          vLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sprint Velocity</h3>
              {!velocity?.length ? (
                <p className="text-gray-500 py-8 text-center">No sprint data available yet.</p>
              ) : (
                <>
                  <div className="card p-5 mb-6" style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={velocity}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="sprintName" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="completedPoints" fill="#3b82f6" name="Completed Points" />
                        <Bar dataKey="totalPoints" fill="#e5e7eb" name="Total Points" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Sprint', 'Status', 'Total Pts', 'Done Pts', 'Tickets', 'Done', 'Stories', 'Defects'].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {velocity.map((v) => (
                          <tr key={v.sprintId}>
                            <td className="px-4 py-3 font-medium text-gray-900">{v.sprintName}</td>
                            <td className="px-4 py-3"><span className={`badge ${v.status === 'active' ? 'bg-green-100 text-green-700' : v.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{v.status}</span></td>
                            <td className="px-4 py-3 text-gray-600">{v.totalPoints}</td>
                            <td className="px-4 py-3 text-blue-600 font-medium">{v.completedPoints}</td>
                            <td className="px-4 py-3 text-gray-600">{v.totalTickets}</td>
                            <td className="px-4 py-3 text-green-600">{v.completedTickets}</td>
                            <td className="px-4 py-3 text-gray-600">{v.stories}</td>
                            <td className="px-4 py-3 text-gray-600">{v.defects}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )
        )}

        {/* Linked tickets */}
        {tab === 'linked' && (
          lLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Tickets with Linked Commits</h3>
              <p className="text-sm text-gray-500 mb-4">{linked?.length || 0} tickets have at least one commit referencing their key.</p>
              <div className="card overflow-hidden">
                {!linked?.length ? (
                  <p className="text-gray-500 py-8 text-center">No linked tickets found. Reference tickets in commit messages as [PROJ-US-1].</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {linked.map((t: any) => (
                      <div key={t.id} className="px-5 py-4">
                        <div className="flex items-center gap-3 mb-2">
                          <TypeBadge type={t.type} />
                          <span className="font-mono text-xs text-gray-500">{t.key}</span>
                          <span className="font-medium text-gray-900 flex-1">{t.title}</span>
                          <PriorityBadge priority={t.priority} />
                          <StatusBadge status={t.status} />
                          <span className="badge bg-green-100 text-green-700">{t.commitCount} commits</span>
                        </div>
                        <div className="ml-2 space-y-1">
                          {t.commits?.slice(0, 3).map((c: any) => (
                            <div key={c.sha} className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{c.sha?.slice(0, 7)}</span>
                              <span className="badge bg-blue-50 text-blue-600">{c.branch}</span>
                              <span className="truncate">{c.message}</span>
                              <span className="text-gray-400 flex-shrink-0">{c.authorName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Unlinked tickets */}
        {tab === 'unlinked' && (
          uLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Tickets Without Commits</h3>
              <p className="text-sm text-gray-500 mb-4">{unlinked?.length || 0} tickets have no commits linked. These may not have been started yet.</p>
              <div className="card overflow-hidden">
                {!unlinked?.length ? (
                  <p className="text-green-600 py-8 text-center">✅ All tickets have linked commits!</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Key', 'Title', 'Type', 'Priority', 'Status', 'Assignee', 'Sprint'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {unlinked.map((t: any) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.key}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{t.title}</td>
                          <td className="px-4 py-3"><TypeBadge type={t.type} /></td>
                          <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                          <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                          <td className="px-4 py-3">
                            {t.assignee ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar name={t.assignee.name} size="sm" />
                                <span className="text-xs">{t.assignee.name}</span>
                              </div>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{t.sprint?.name || 'Backlog'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
