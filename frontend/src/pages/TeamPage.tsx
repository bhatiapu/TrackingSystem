import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api';
import { Avatar, EmptyState, Modal, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import type { ProjectMember, ProjectMemberRole } from '../types';

const ROLE_LABELS: Record<ProjectMemberRole, string> = {
  owner: 'Owner',
  member: 'Member',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<ProjectMemberRole, string> = {
  owner: 'bg-purple-100 text-purple-800',
  member: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-700',
};

function AddMemberModal({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectMemberRole>('member');

  const mut = useMutation({
    mutationFn: () => projectsApi.addMember(projectId, email, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      onClose();
    },
  });

  return (
    <Modal title="Add Team Member" onClose={onClose} size="sm">
      <form
        onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
        className="space-y-4"
      >
        <div>
          <label className="label">Email Address *</label>
          <input
            className="input"
            type="email"
            required
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            The user must already have an account in TrackingSystem.
          </p>
        </div>
        <div>
          <label className="label">Role</label>
          <select
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value as ProjectMemberRole)}
          >
            <option value="owner">Owner — full control, can manage members</option>
            <option value="member">Member — can create and edit tickets</option>
            <option value="viewer">Viewer — read-only access</option>
          </select>
        </div>
        {mut.isError && (
          <p className="text-sm text-red-600">
            {(mut.error as any)?.response?.data?.error ?? 'Failed to add member'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>
            {mut.isPending ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MemberRow({
  member,
  projectId,
  isOwner,
  isSelf,
}: {
  member: ProjectMember;
  projectId: number;
  isOwner: boolean;
  isSelf: boolean;
}) {
  const qc = useQueryClient();
  const [editingRole, setEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ProjectMemberRole>(member.memberRole);

  const updateRole = useMutation({
    mutationFn: (role: ProjectMemberRole) =>
      projectsApi.updateMemberRole(projectId, member.id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      setEditingRole(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => projectsApi.removeMember(projectId, member.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', projectId] }),
  });

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={member.name} size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm">{member.name}</span>
            {isSelf && (
              <span className="text-xs text-gray-400">(you)</span>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">{member.email}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-gray-400 hidden sm:block">
          Joined {new Date(member.joinedAt).toLocaleDateString()}
        </span>

        {/* Role display / editor */}
        {editingRole ? (
          <div className="flex items-center gap-1">
            <select
              className="select text-xs py-1"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as ProjectMemberRole)}
            >
              <option value="owner">Owner</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              className="btn-primary text-xs px-2 py-1"
              disabled={updateRole.isPending}
              onClick={() => updateRole.mutate(selectedRole)}
            >
              {updateRole.isPending ? '…' : 'Save'}
            </button>
            <button
              className="btn-secondary text-xs px-2 py-1"
              onClick={() => { setEditingRole(false); setSelectedRole(member.memberRole); }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[member.memberRole]}`}>
            {ROLE_LABELS[member.memberRole]}
          </span>
        )}

        {/* Action buttons (owner only, not on self) */}
        {isOwner && !isSelf && !editingRole && (
          <div className="flex items-center gap-1">
            <button
              className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              onClick={() => setEditingRole(true)}
            >
              Change role
            </button>
            <button
              className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm(`Remove ${member.name} from this project?`)) remove.mutate();
              }}
            >
              Remove
            </button>
          </div>
        )}

        {/* Self leave button */}
        {isSelf && member.memberRole !== 'owner' && (
          <button
            className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm('Leave this project?')) remove.mutate();
            }}
          >
            Leave
          </button>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const id = parseInt(projectId!);

  const { data: members, isLoading } = useQuery({
    queryKey: ['project-members', id],
    queryFn: () => projectsApi.members(id).then((r) => r.data),
  });

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id).then((r) => r.data),
  });

  const isOwner = project?.memberRole === 'owner';

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
            <p className="text-sm text-gray-500 mt-1">
              {members?.length ?? 0} member{members?.length !== 1 ? 's' : ''} in this project
            </p>
          </div>
          {isOwner && (
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              + Add Member
            </button>
          )}
        </div>

        {/* Role legend */}
        <div className="flex gap-3 mb-5 flex-wrap">
          {(['owner', 'member', 'viewer'] as ProjectMemberRole[]).map((r) => (
            <span key={r} className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[r]}`}>
              {ROLE_LABELS[r]}
            </span>
          ))}
          <span className="text-xs text-gray-400 self-center">
            Owners manage members · Members create &amp; edit tickets · Viewers read-only
          </span>
        </div>

        {/* Member list */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !members?.length ? (
          <EmptyState
            icon="👥"
            title="No members yet"
            description="Add team members so they can access this project."
            action={
              isOwner
                ? <button className="btn-primary" onClick={() => setShowAdd(true)}>Add First Member</button>
                : undefined
            }
          />
        ) : (
          <div className="card divide-y divide-gray-100">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                projectId={id}
                isOwner={isOwner}
                isSelf={m.id === user?.id}
              />
            ))}
          </div>
        )}

        {/* Invite hint */}
        {isOwner && members && members.length > 0 && (
          <p className="text-xs text-gray-400 mt-4 text-center">
            Team members must already have a TrackingSystem account. Share the registration link if they don't have one yet.
          </p>
        )}
      </div>

      {showAdd && <AddMemberModal projectId={id} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
