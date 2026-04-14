import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Layout/Sidebar';

export default function ProjectLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
