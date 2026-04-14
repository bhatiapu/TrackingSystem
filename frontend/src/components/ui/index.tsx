import React from 'react';
import { clsx } from 'clsx';
import type { Priority, TicketType, TicketStatus } from '../../types';

// ─── Priority Badge ────────────────────────────────────────────────────────────
const priorityColors: Record<Priority, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};
const priorityDot: Record<Priority, string> = {
  critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={clsx('badge gap-1', priorityColors[priority])}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', priorityDot[priority])} />
      {priority}
    </span>
  );
}

// ─── Type Badge ────────────────────────────────────────────────────────────────
const typeColors: Record<TicketType, string> = {
  story: 'bg-blue-100 text-blue-800',
  defect: 'bg-red-100 text-red-800',
  task: 'bg-purple-100 text-purple-800',
};
const typeIcons: Record<TicketType, string> = {
  story: '📖', defect: '🐛', task: '✅',
};

export function TypeBadge({ type }: { type: TicketType }) {
  return (
    <span className={clsx('badge gap-1', typeColors[type])}>
      <span>{typeIcons[type]}</span>
      {type}
    </span>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
const statusColors: Record<TicketStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
};
const statusLabels: Record<TicketStatus, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={clsx('badge', statusColors[status])}>{statusLabels[status]}</span>;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  return (
    <div className={clsx('rounded-full flex items-center justify-center text-white font-medium flex-shrink-0', color, sz)}>
      {initials}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  title, onClose, children, size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const widths = { sm: 'max-w-sm', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className={clsx('bg-white rounded-xl shadow-xl w-full flex flex-col max-h-[90vh]', widths[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];
  return (
    <div className={clsx('border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin', s)} />
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, options, className }: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
