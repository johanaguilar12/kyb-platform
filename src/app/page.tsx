'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';

interface File {
  id: string;
  rfc: string;
  legalName: string;
  status: string;
  createdAt: string;
  riskScore?: {
    level: string;
    score: number;
  } | null;
}

export default function DashboardPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFiles() {
      try {
        const res = await fetch('/api/files');
        if (!res.ok) throw new Error('Failed to fetch files from API.');
        const json = await res.json();
        if (json.success) {
          setFiles(json.data);
          setFilteredFiles(json.data);
        } else {
          throw new Error(json.error || 'Unknown error');
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to connect to backend service.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchFiles();
  }, []);

  useEffect(() => {
    const term = search.toLowerCase().trim();
    if (!term) {
      setFilteredFiles(files);
    } else {
      const filtered = files.filter(
        f =>
          f.rfc.toLowerCase().includes(term) ||
          f.legalName.toLowerCase().includes(term)
      );
      setFilteredFiles(filtered);
    }
  }, [search, files]);

  const getRiskLevelStyles = (level?: string) => {
    switch (level) {
      case 'high_risk':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'review_required':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'safe':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-300';
    }
  };

  const getRiskLevelLabel = (level?: string) => {
    switch (level) {
      case 'high_risk':
        return 'HIGH RISK';
      case 'review_required':
        return 'REVIEW REQUIRED';
      case 'safe':
        return 'SAFE';
      default:
        return 'UNEVALUATED';
    }
  };

  return (
    <div className="min-h-screen bg-sat-bg text-sat-dark font-sans antialiased">
      {/* SAT Header Bar */}
      <header className="bg-sat-primary text-white shadow-md border-b-4 border-sat-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white text-sat-primary p-1.5 rounded-sm font-extrabold text-sm tracking-tighter">
              SAT
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight tracking-wider uppercase">SERVICIO DE ADMINISTRACIÓN TRIBUTARIA</h1>
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">KYB Compliance & Blacklist Verification Portal</p>
            </div>
          </div>
          <div className="text-xs text-slate-200 font-bold uppercase hidden sm:block">
            {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Banner Title */}
        <div className="bg-white border border-slate-350 p-6 rounded shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-wide uppercase text-sat-primary">TAXPAYER COMPLIANCE FILES</h2>
            <p className="text-xs text-sat-muted mt-1 font-semibold">
              Official verification console for taxpayer registers, document reconciliation, and article 69/69-B fiscal blacklists.
            </p>
          </div>
          <Link
            href="/file/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-sat-secondary hover:bg-blue-700 text-white text-xs font-bold rounded shadow transition-all duration-150 uppercase tracking-wider"
          >
            Create New File
          </Link>
        </div>

        {/* Toolbar */}
        <div className="mb-6 bg-white border border-slate-350 p-4 rounded shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative w-full sm:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-sat-muted">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by RFC or Legal Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-350 rounded focus:outline-none focus:ring-1 focus:ring-sat-secondary focus:border-sat-secondary text-sat-dark"
              />
            </div>
          </div>
        </div>

        {/* Table/Data Grid */}
        {isLoading ? (
          <div className="bg-white rounded border border-slate-350 shadow-sm p-12 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-sat-primary mb-4"></div>
            <p className="text-xs font-bold text-sat-muted uppercase tracking-wider">Retrieving Taxpayer Files...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-350 rounded p-4 text-rose-800 flex items-start space-x-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-bold text-sm uppercase">Database Connection Error</h4>
              <p className="text-xs mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="bg-white rounded border border-slate-350 shadow-sm p-12 text-center">
            <div className="inline-flex items-center justify-center p-3 bg-slate-100 rounded text-sat-muted mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="font-bold text-sat-primary uppercase text-sm">No Taxpayer Files Found</h4>
            <p className="text-xs text-sat-muted mt-1 max-w-sm mx-auto font-semibold">
              {search ? 'Adjust your search terms to match another file.' : 'Get started by creating a new file to upload compliance documents.'}
            </p>
            {!search && (
              <Link
                href="/file/new"
                className="mt-4 inline-flex items-center justify-center px-4 py-2 bg-sat-primary hover:bg-blue-900 text-white text-xs font-bold rounded uppercase tracking-wider transition-all"
              >
                Create First File
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded border border-slate-350 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-300 text-left text-sm">
                <thead className="bg-slate-100 text-xs font-bold text-sat-dark uppercase tracking-wider border-b border-slate-350">
                  <tr>
                    <th className="px-6 py-4 border-r border-slate-200">Legal Name (Razón Social)</th>
                    <th className="px-6 py-4 border-r border-slate-200">Tax ID (RFC)</th>
                    <th className="px-6 py-4 border-r border-slate-200">Status</th>
                    <th className="px-6 py-4 border-r border-slate-200">Compliance Risk</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredFiles.map((file, idx) => (
                    <tr
                      key={file.id}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'
                      }`}
                    >
                      <td className="px-6 py-4 border-r border-slate-150">
                        <Link href={`/file/${file.id}`} className="block font-bold text-sat-primary hover:text-sat-secondary hover:underline">
                          {file.legalName}
                        </Link>
                        <span className="text-[10px] text-sat-muted block mt-0.5 font-semibold">
                          Registered: {new Date(file.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700 border-r border-slate-150">
                        {file.rfc}
                      </td>
                      <td className="px-6 py-4 border-r border-slate-150">
                        <StatusBadge status={file.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-slate-150">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${getRiskLevelStyles(file.riskScore?.level)}`}>
                          {getRiskLevelLabel(file.riskScore?.level)}
                          {file.riskScore && ` (${file.riskScore.score} PTS)`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <Link
                          href={`/file/${file.id}`}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-bold border border-slate-350 text-sat-dark bg-slate-100 hover:bg-slate-200 rounded shadow-sm transition uppercase tracking-wider"
                        >
                          Open File
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
