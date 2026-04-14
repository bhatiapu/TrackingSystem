import React, { useState, useEffect } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { projectsApi } from '../../api';
import type { Project } from '../../types';

const navItems = [
  { to: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { to: 'board', label: 'Board', icon: '📋' },
  { to: 'backlog', label: 'Backlog', icon: '📝' },
  { to: 'sprints', label: 'Sprints', icon: '🏃' },
  { to: 'repos', label: 'Repositories', icon: '🔀' },
  { to: 'documents', label: 'Documents', icon: '📄' },
  { to: 'reports', label: 'Reports', icon: '📊' },
  { to: 'import', label: 'Import', icon: '📥' },
];

export function Sidebar() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projectId) {
      projectsApi.get(parseInt(projectId)).then((r) => setProject(r.data)).catch(() => {});
    }
  }, [projectId]);

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-gray-700">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Project</div>
        <div className="text-white font-semibold truncate">{project?.name || '...'}</div>
        <div className="text-gray-400 text-xs">{project?.key}</div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={`/projects/${projectId}/${item.to}`}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-700">
        <NavLink to="/" className="text-gray-400 hover:text-white text-sm flex items-center gap-2">
          ← All Projects
        </NavLink>
      </div>
    </aside>
  );
}
