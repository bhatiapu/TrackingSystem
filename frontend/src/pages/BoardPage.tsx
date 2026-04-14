import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { ticketsApi, sprintsApi } from '../api';
import { TopBar } from '../components/Layout/TopBar';
import { TicketModal } from '../components/TicketDetail/TicketModal';
import { PriorityBadge, TypeBadge, Avatar, EmptyState, Spinner } from '../components/ui';
import type { Ticket, TicketStatus } from '../types';

const COLUMNS: { id: TicketStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'border-t-gray-400' },
  { id: 'in_progress', label: 'In Progress', color: 'border-t-blue-500' },
  { id: 'in_review', label: 'In Review', color: 'border-t-purple-500' },
  { id: 'done', label: 'Done', color: 'border-t-green-500' },
];

function TicketCard({ ticket, index, onClick }: { ticket: Ticket; index: number; onClick: () => void }) {
  return (
    <Draggable draggableId={String(ticket.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`card p-3 cursor-pointer hover:border-blue-300 transition-all mb-2 ${snapshot.isDragging ? 'shadow-lg rotate-1 border-blue-400' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <TypeBadge type={ticket.type} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{ticket.title}</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-gray-400">{ticket.key}</span>
            <div className="flex items-center gap-1.5">
              {ticket.storyPoints && (
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{ticket.storyPoints}</span>
              )}
              {ticket.assignee && <Avatar name={ticket.assignee.name} size="sm" />}
            </div>
          </div>
          {ticket.labels && ticket.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ticket.labels.slice(0, 3).map((l) => (
                <span key={l} className="badge bg-gray-100 text-gray-500">{l}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId!);
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const qc = useQueryClient();

  const { data: sprints } = useQuery({
    queryKey: ['sprints', pid],
    queryFn: () => sprintsApi.list(pid).then((r) => r.data),
  });

  React.useEffect(() => {
    if (sprints && !selectedSprint) {
      const active = sprints.find((s) => s.status === 'active');
      if (active) setSelectedSprint(active.id);
    }
  }, [sprints]);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets', pid, { sprintId: selectedSprint }],
    queryFn: () => ticketsApi.list(pid, selectedSprint ? { sprintId: String(selectedSprint) } : {}).then((r) => r.data),
    enabled: !!selectedSprint,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status, boardOrder }: { id: number; status: TicketStatus; boardOrder: number }) =>
      ticketsApi.update(pid, id, { status, boardOrder }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', pid] }),
  });

  function onDragEnd(result: DropResult) {
    if (!result.destination || !tickets) return;
    const { draggableId, source, destination } = result;
    const ticketId = parseInt(draggableId);
    const newStatus = destination.droppableId as TicketStatus;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    updateMut.mutate({ id: ticketId, status: newStatus, boardOrder: destination.index });
  }

  const byStatus = (status: TicketStatus) => tickets?.filter((t) => t.status === status) || [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar title="Board" />
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <label className="text-sm font-medium text-gray-700">Sprint:</label>
        <select className="select w-56 text-sm" value={selectedSprint || ''}
          onChange={(e) => setSelectedSprint(e.target.value ? parseInt(e.target.value) : null)}>
          <option value="">Select sprint…</option>
          {sprints?.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        {!selectedSprint ? (
          <EmptyState icon="🏃" title="Select a sprint" description="Choose a sprint from the dropdown above to view its board." />
        ) : isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full min-w-max">
              {COLUMNS.map((col) => {
                const colTickets = byStatus(col.id);
                return (
                  <div key={col.id} className="w-72 flex-shrink-0 flex flex-col">
                    <div className={`bg-white rounded-t-lg border-t-4 ${col.color} border border-gray-200 px-3 py-2 flex items-center justify-between`}>
                      <h3 className="font-semibold text-sm text-gray-700">{col.label}</h3>
                      <span className="badge bg-gray-100 text-gray-600">{colTickets.length}</span>
                    </div>
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 p-2 rounded-b-lg border border-t-0 border-gray-200 min-h-32 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}
                        >
                          {colTickets.map((t, i) => (
                            <TicketCard key={t.id} ticket={t} index={i} onClick={() => setSelectedTicket(t)} />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      {selectedTicket && (
        <TicketModal ticket={selectedTicket} projectId={pid} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  );
}
