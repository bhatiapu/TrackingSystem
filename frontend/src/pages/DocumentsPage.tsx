import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aiApi, reposApi } from '../api';
import { TopBar } from '../components/Layout/TopBar';
import { EmptyState, Spinner } from '../components/ui';
import type { DocType } from '../types';

const DOC_TYPES: { value: DocType; label: string; icon: string; desc: string }[] = [
  { value: 'architecture', label: 'Architecture Diagram', icon: '🏗️', desc: 'Component overview with Mermaid diagram' },
  { value: 'sequence', label: 'Sequence Diagrams', icon: '🔄', desc: 'Request/response flow diagrams' },
  { value: 'dev_guide', label: 'Developer Guide', icon: '📚', desc: 'Setup, conventions, how to contribute' },
];

export default function DocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId!);
  const qc = useQueryClient();
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [generating, setGenerating] = useState<DocType | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const mermaidRef = useRef<HTMLDivElement>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['docs', pid],
    queryFn: () => aiApi.documents(pid).then((r) => r.data),
  });

  const { data: repos } = useQuery({
    queryKey: ['repos', pid],
    queryFn: () => reposApi.list(pid).then((r) => r.data),
  });

  useEffect(() => {
    if (repos && repos.length > 0 && !selectedRepo) setSelectedRepo(repos[0].id);
  }, [repos]);

  async function handleGenerate(docType: DocType) {
    if (!selectedRepo) return alert('Select a repository first');
    setGenerating(docType);
    try {
      await aiApi.generateDocs(selectedRepo, pid, docType, selectedBranch);
      qc.invalidateQueries({ queryKey: ['docs', pid] });
    } finally { setGenerating(null); }
  }

  // Render Mermaid diagrams
  useEffect(() => {
    if (!selectedDoc?.content) return;
    const hasMermaid = selectedDoc.content.includes('```mermaid');
    if (!hasMermaid || !mermaidRef.current) return;
    import('mermaid').then((m) => {
      m.default.initialize({ startOnLoad: false, theme: 'default' });
      m.default.run({ nodes: mermaidRef.current ? [mermaidRef.current] : [] });
    });
  }, [selectedDoc]);

  function renderContent(content: string) {
    // Replace ```mermaid blocks with rendered divs
    const parts = content.split(/(```mermaid[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```mermaid')) {
        const code = part.replace(/^```mermaid\n?/, '').replace(/```$/, '');
        return (
          <div key={i} className="my-4 bg-white border border-gray-200 rounded-lg p-4 overflow-x-auto">
            <div className="mermaid">{code}</div>
          </div>
        );
      }
      // Render as markdown-like
      return (
        <div key={i} className="prose prose-sm max-w-none">
          {part.split('\n').map((line, j) => {
            if (line.startsWith('## ')) return <h2 key={j} className="text-lg font-bold mt-4 mb-2 text-gray-900">{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={j} className="text-base font-semibold mt-3 mb-1 text-gray-800">{line.slice(4)}</h3>;
            if (line.startsWith('# ')) return <h1 key={j} className="text-xl font-bold mt-4 mb-2 text-gray-900">{line.slice(2)}</h1>;
            if (line.startsWith('- ') || line.startsWith('* ')) return <li key={j} className="ml-4 text-gray-700">{line.slice(2)}</li>;
            if (line.match(/^\d+\./)) return <li key={j} className="ml-4 text-gray-700">{line}</li>;
            if (!line.trim()) return <br key={j} />;
            return <p key={j} className="text-gray-700 text-sm">{line}</p>;
          })}
        </div>
      );
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar title="Documents" />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
          {/* Generate controls */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Generate Docs</h3>
            <div className="space-y-2 mb-3">
              <div>
                <label className="label text-xs">Repository</label>
                <select className="select text-xs" value={selectedRepo || ''} onChange={(e) => setSelectedRepo(parseInt(e.target.value))}>
                  <option value="">Select repo…</option>
                  {repos?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Branch</label>
                <input className="input text-xs" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              {DOC_TYPES.map((dt) => (
                <button key={dt.value} className="btn-secondary w-full justify-start text-xs"
                  onClick={() => handleGenerate(dt.value)}
                  disabled={generating !== null || !selectedRepo}>
                  {generating === dt.value ? <Spinner size="sm" /> : dt.icon}
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              : docs?.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No documents yet</p>
              : docs?.map((doc) => (
                <button key={doc.id} onClick={() => setSelectedDoc(doc)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${selectedDoc?.id === doc.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                  <div className="flex items-center gap-1.5">
                    {DOC_TYPES.find((d) => d.value === doc.type)?.icon || '📄'}
                    <span className="truncate font-medium">{doc.title}</span>
                  </div>
                  {doc.branch && <span className="text-xs text-gray-400 ml-5">🌿 {doc.branch}</span>}
                  {doc.isStale && (
                    <span className="badge bg-yellow-100 text-yellow-700 ml-5 mt-1">⚠ Stale</span>
                  )}
                </button>
              ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedDoc ? (
            <EmptyState icon="📄" title="Select a document" description="Choose a document from the sidebar or generate new documentation." />
          ) : (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedDoc.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedDoc.branch && <span className="badge bg-gray-100 text-gray-600">🌿 {selectedDoc.branch}</span>}
                    {selectedDoc.isStale && <span className="badge bg-yellow-100 text-yellow-700">⚠ Stale — regenerate for latest</span>}
                    <span className="text-xs text-gray-400">Generated {new Date(selectedDoc.generatedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div ref={mermaidRef} className="bg-white">
                {renderContent(selectedDoc.content)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
