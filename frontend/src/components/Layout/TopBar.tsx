import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui';

export function TopBar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <Avatar name={user.name} size="sm" />
            <span className="text-sm text-gray-700">{user.name}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </>
        )}
      </div>
    </header>
  );
}
