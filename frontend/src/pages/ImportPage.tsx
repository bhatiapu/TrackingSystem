import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { importApi } from '../api';
import { TopBar } from '../components/Layout/TopBar';
import { Spinner } from '../components/ui';

export default function ImportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId!);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported: number; keys: string[] } | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDownloadTemplate() {
    try {
      const resp = await importApi.downloadTemplate();
      const url = URL.createObjectURL(new Blob([resp.data as BlobPart]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ticket-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download template');
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(''); setResult(null);
    try {
      const { data } = await importApi.uploadExcel(pid, file);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar title="Import" />
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Import Tickets from Excel</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload an Excel file with <strong>Stories</strong> and/or <strong>Defects</strong> sheets to bulk-import tickets.
            Download the template to see the required format.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Stories Sheet Columns</h3>
            <div className="flex flex-wrap gap-1">
              {['Title', 'Description', 'Acceptance Criteria', 'Priority', 'Story Points', 'Labels', 'Assignee Email', 'Sprint'].map((c) => (
                <span key={c} className="badge bg-blue-100 text-blue-700">{c}</span>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Defects Sheet Columns</h3>
            <div className="flex flex-wrap gap-1">
              {['Title', 'Description', 'Steps To Reproduce', 'Expected Result', 'Actual Result', 'Priority', 'Labels', 'Assignee Email', 'Sprint'].map((c) => (
                <span key={c} className="badge bg-red-100 text-red-700">{c}</span>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary" onClick={handleDownloadTemplate}>
              📥 Download Template
            </button>
            <label className="btn-primary cursor-pointer">
              {uploading ? <><Spinner size="sm" /> Importing…</> : '📤 Upload Excel File'}
              <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-5">
            <h3 className="text-green-800 font-semibold mb-2">✅ Import Successful</h3>
            <p className="text-green-700 text-sm mb-3">Created <strong>{result.imported}</strong> tickets.</p>
            <div className="flex flex-wrap gap-1">
              {result.keys.map((k) => (
                <span key={k} className="badge bg-green-100 text-green-700 font-mono">{k}</span>
              ))}
            </div>
          </div>
        )}

        <div className="card p-5 mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tips</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Priority values: <code className="bg-gray-100 px-1 rounded">critical</code>, <code className="bg-gray-100 px-1 rounded">high</code>, <code className="bg-gray-100 px-1 rounded">medium</code>, <code className="bg-gray-100 px-1 rounded">low</code></li>
            <li>• Labels: comma-separated (e.g. <code className="bg-gray-100 px-1 rounded">auth, backend</code>)</li>
            <li>• Assignee Email: must match a registered user's email</li>
            <li>• Sprint: must match an existing sprint name exactly</li>
            <li>• Ticket keys are auto-generated — you can leave the Key column empty</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
