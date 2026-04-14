import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, ticketsApi, sprintsApi } from '../api';
import { TopBar } from '../components/Layout/TopBar';
import { StatusBadge, PriorityBadge, TypeBadge, Spinner } from '../components/ui';

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-5">
      <div className={`text-3xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId!);

  const { data: summary } = useQuery({
    queryKey: ['reports-summary', pid],
    queryFn: () => reportsApi.summary(pid).then((r) => r.data as any),
  });

  const { data: recentTickets, isLoading } = useQuery({
    queryKey: ['tickets', pid],
    queryFn: () => ticketsApi.list(pid).then((r) => r.data.slice(0, 10)),
  });

  const { data: sprints } = useQuery({
    queryKey: ['sprints', pid],
    queryFn: () => sprintsApi.list(pid).then((r) => r.data),
  });

  const activeSprint = sprints?.find((s) => s.status === 'active');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6">

        {/* Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Tickets" value={summary.total} color="text-gray-900" />
            <StatCard label="In Progress" value={summary.byStatus?.in_progress || 0} color="text-blue-600" />
            <StatCard label="Done" value={summary.byStatus?.done || 0} color="text-green-600" />
            <StatCard label="Critical" value={summary.byPriority?.critical || 0} color="text-red-600" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Breakdown */}
          {summary && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">By Type</h3>
              <div className="space-y-2">
                {Object.entries(summary.byType || {}).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-gray-600">{type === 'story' ? '📖' : type === 'defect' ? '🐛' : '✅'} {type}</span>
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="font-medium text-gray-700 mb-2 text-sm">By Status</h4>
                <div className="space-y-1">
                  {Object.entries(summary.byStatus || {}).map(([s, c]) => (
                    <div key={s} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{s.replace('_', ' ')}</span>
                      <span className="font-medium">{c as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active Sprint */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Active Sprint</h3>
            {activeSprint ? (
              <div>
                <div className="font-medium text-blue-600 mb-1">{activeSprint.name}</div>
                {activeSprint.goal && <p className="text-sm text-gray-500 mb-2">{activeSprint.goal}</p>}
                <div className="flex gap-4 text-sm text-gray-500">
                  {activeSprint.startDate && <span>Start: {new Date(activeSprint.startDate).toLocaleDateString()}</span>}
                  {activeSprint.endDate && <span>End: {new Date(activeSprint.endDate).toLocaleDateString()}</span>}
                </div>
                <Link to={`/projects/${projectId}/board`} className="btn-primary mt-3 text-xs">Open Board →</Link>
              </div>
            ) : (
              <div className="text-sm text-gray-500 py-4 text-center">
                No active sprint.<br />
                <Link to={`/projects/${projectId}/sprints`} className="text-blue-600 hover:underline">Create one →</Link>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { to: 'backlog', icon: '📝', label: 'View Backlog' },
                { to: 'repos', icon: '🔀', label: 'Manage Repos' },
                { to: 'documents', icon: '📄', label: 'View Documents' },
                { to: 'reports', icon: '📊', label: 'View Reports' },
                { to: 'import', icon: '📥', label: 'Import Excel' },
              ].map((a) => (
                <Link key={a.to} to={`/projects/${projectId}/${a.to}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 py-1">
                  <span>{a.icon}</span> {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="card mt-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Tickets</h3>
            <Link to={`/projects/${projectId}/backlog`} className="text-sm text-blue-600 hover:underline">View all →</Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size="sm" /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentTickets?.map((t) => (
                <div key={t.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <TypeBadge type={t.type} />
                  <span className="text-xs text-gray-400 font-mono w-24 flex-shrink-0">{t.key}</span>
                  <span className="text-sm text-gray-900 flex-1 truncate">{t.title}</span>
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
