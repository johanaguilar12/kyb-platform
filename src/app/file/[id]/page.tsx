'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { SATSignals } from '@/components/SATSignals';
import { RiskScoreCard } from '@/components/RiskScoreCard';
import { AuditTable } from '@/components/AuditTable';

interface Document {
  id: string;
  type: string;
  name: string;
  version: number;
  isActive: boolean;
  issueDate?: string | null;
  expirationDate?: string | null;
  aiExtractedData?: Record<string, any> | null;
  pdfHash?: string | null;
  confirmationStatus: string;
  confirmedAt?: string | null;
  url?: string | null;
  fileSize?: number | null;
}

interface SATListCheck {
  id: string;
  rfc: string;
  listType: string;
  found: boolean;
  checkedAt: string;
  source: string;
  reference: string;
}

interface RiskScore {
  level: string;
  score: number;
  factors: any[];
  explanation: string;
  suggestedAction: string;
  calculatedAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  reason?: string;
}

interface FileData {
  id: string;
  rfc: string;
  legalName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  documents: Document[];
  satListChecks: SATListCheck[];
  riskScore: RiskScore | null;
  auditLogs: AuditLog[];
}

export default function FileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const [fileData, setFileData] = useState<FileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'sat' | 'score' | 'audit'>('overview');
  const [isSatChecking, setIsSatChecking] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>('tax_status_certificate');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

  // Confirmation / Edit States
  const [pendingConfirmDoc, setPendingConfirmDoc] = useState<any | null>(null);
  const [editExtractedFields, setEditExtractedFields] = useState<Record<string, string>>({});
  const [isConfirming, setIsConfirming] = useState(false);

  const startConfirmation = (doc: any) => {
    setPendingConfirmDoc(doc);
    const initialFields: Record<string, string> = {};
    if (doc.aiExtractedData) {
      Object.entries(doc.aiExtractedData).forEach(([key, val]) => {
        initialFields[key] = val !== null && val !== undefined ? String(val) : '';
      });
    }
    // Guarantee required fields are editable even if they were not found by the regex extraction rules
    if (doc.type === 'tax_status_certificate') {
      if (!initialFields.rfc) initialFields.rfc = '';
      if (!initialFields.legalName) initialFields.legalName = '';
      if (!initialFields.issueDate) initialFields.issueDate = '';
      if (!initialFields.taxRegime) initialFields.taxRegime = '';
      if (!initialFields.address) initialFields.address = '';
    } else if (doc.type === 'articles_of_incorporation') {
      if (!initialFields.rfc) initialFields.rfc = '';
      if (!initialFields.legalName) initialFields.legalName = '';
      if (!initialFields.incorporationDate) initialFields.incorporationDate = '';
      if (!initialFields.legalRepresentative) initialFields.legalRepresentative = '';
    } else if (doc.type === 'legal_representative_id') {
      if (!initialFields.name) initialFields.name = '';
      if (!initialFields.curp) initialFields.curp = '';
      if (!initialFields.issueDate) initialFields.issueDate = '';
      if (!initialFields.expirationDate) initialFields.expirationDate = '';
    } else if (doc.type === 'proof_of_address') {
      if (!initialFields.address) initialFields.address = '';
      if (!initialFields.issueDate) initialFields.issueDate = '';
    }
    setEditExtractedFields(initialFields);
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingConfirmDoc) return;

    setIsConfirming(true);
    try {
      const res = await fetch(`/api/documents/${pendingConfirmDoc.id}/confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: editExtractedFields }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setPendingConfirmDoc(null);
        setUploadSuccess(true);
        // Reload data
        await fetchFileData();
        // Recalculate score
        await handleScoreRecalculate();
      } else {
        throw new Error(json.error || 'Confirmation failed.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred during confirmation.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document from the vault?')) return;

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Reload data
        await fetchFileData();
        // Recalculate score
        await handleScoreRecalculate();
      } else {
        throw new Error(json.error || 'Failed to delete document.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred during deletion.');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', uploadDocType);
      formData.append('fileId', id);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setUploadSuccess(true);
        setSelectedFile(null);
        
        // Reset file input element
        const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        // Reload data
        await fetchFileData();
        
        // Auto-recalculate risk score to reflect new document uploads
        await handleScoreRecalculate();
      } else {
        throw new Error(json.error || 'Upload and text extraction failed.');
      }
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'An error occurred during PDF processing.');
    } finally {
      setIsUploading(false);
    }
  };

  async function fetchFileData() {
    try {
      const res = await fetch(`/api/files/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('File not found.');
        throw new Error('Database server connection failed.');
      }
      const json = await res.json();
      if (json.success) {
        setFileData(json.data);
      } else {
        throw new Error(json.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load taxpayer compliance details.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchFileData();
  }, [id]);

  const handleSatCheck = async () => {
    if (!fileData) return;
    setIsSatChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/sat-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfc: fileData.rfc, fileId: fileData.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Refresh scoring as well immediately after running SAT check to update compliance scores
        await handleScoreRecalculate();
      } else {
        throw new Error(json.error || 'SAT query returned failure.');
      }
    } catch (err: any) {
      console.error(err);
      setError(`SAT List Check failed: ${err.message}`);
      setIsSatChecking(false);
    }
  };

  const handleScoreRecalculate = async () => {
    if (!fileData) return;
    setIsScoring(true);
    setError(null);
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fileData.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchFileData(); // Refresh full data
      } else {
        throw new Error(json.error || 'Scoring engine returned failure.');
      }
    } catch (err: any) {
      console.error(err);
      setError(`Scoring Calculation failed: ${err.message}`);
    } finally {
      setIsScoring(false);
    }
  };

  const handleStatusTransition = async (newStatus: 'approved' | 'rejected') => {
    if (!fileData) return;
    setIsTransitioning(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchFileData(); // Refresh data
      } else {
        throw new Error(json.error || 'Status update rejected.');
      }
    } catch (err: any) {
      console.error(err);
      setError(`Compliance Action failed: ${err.message}`);
    } finally {
      setIsTransitioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sat-bg flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-sat-primary mb-4"></div>
        <p className="text-xs font-bold text-sat-muted uppercase tracking-wider">Loading taxpayer record...</p>
      </div>
    );
  }

  if (error && !fileData) {
    return (
      <div className="min-h-screen bg-sat-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded border border-slate-350 p-6 text-center shadow-sm">
          <div className="inline-flex items-center justify-center p-3 bg-rose-50 rounded text-rose-600 mb-4 border border-rose-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-bold text-sat-primary uppercase text-sm">Error Loading File</h3>
          <p className="text-xs text-sat-muted mt-2 font-semibold">{error}</p>
          <Link href="/" className="mt-4 inline-flex items-center justify-center px-4 py-2 bg-sat-primary hover:bg-blue-900 text-white text-xs font-bold rounded uppercase tracking-wider transition">
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  if (!fileData) return null;

  const isHighRisk = fileData.riskScore?.level === 'high_risk';

  // Structure mapping for SAT signals display
  const satSignalsObject = fileData.satListChecks.length > 0 ? {
    not_located: fileData.satListChecks.some(c => c.listType === 'list_69_not_located' && c.found),
    list_69b: fileData.satListChecks.some(c => c.listType === 'list_69_b' && c.found),
    list_69b_bis: fileData.satListChecks.some(c => c.listType === 'list_69_b_bis' && c.found),
    csd_revoked: fileData.satListChecks.some(c => c.listType === 'csd_revoked' && c.found),
  } : undefined;

  const getArt49BisStatus = () => {
    return 'not_verifiable_with_current_public_sources';
  };

  const getLatestRecommendation = () => {
    const is69b = fileData.satListChecks.some(c => (c.listType === 'list_69_b' || c.listType === 'list_69_b_bis') && c.found);
    if (is69b) return 'Block approval immediately due to blacklisted taxpayer record.';
    
    const requiresManual = fileData.satListChecks.some(c => (c.listType === 'list_69_not_located' || c.listType === 'csd_revoked') && c.found);
    if (requiresManual) return 'Requires manual compliance verification.';
    
    return 'Proceed with standard approval.';
  };

  const getLatestCheckedAt = () => {
    return fileData.satListChecks.length > 0 ? fileData.satListChecks[0].checkedAt : undefined;
  };

  const documentTypeLabels: Record<string, string> = {
    articles_of_incorporation: 'Articles of Incorporation',
    legal_representative_id: 'Legal Representative ID',
    power_of_attorney: 'Power of Attorney',
    proof_of_address: 'Proof of Address',
    rfc: 'Taxpayer ID (RFC)',
    tax_status_certificate: 'Tax Status Certificate (CSF)',
    manifestation_under_protest: 'Manifestation Under Protest',
    controlling_party: 'Shareholder/Controlling Party Data',
  };

  return (
    <div className="min-h-screen bg-sat-bg text-sat-dark font-sans antialiased pb-24">
      {/* Detail Header Header */}
      <header className="bg-sat-primary text-white shadow border-b-4 border-sat-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-1.5 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Taxpayer Registry</span>
            </Link>
            <span className="text-slate-400">|</span>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-sat-primary bg-white px-2 py-0.5 rounded-sm">
                {fileData.rfc}
              </span>
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">/ID {fileData.id.slice(-6).toUpperCase()}</span>
            </div>
          </div>
          <div>
            <StatusBadge status={fileData.status} />
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner with Company Header */}
        <div className="bg-white rounded border border-slate-350 shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-wide uppercase text-sat-primary">{fileData.legalName}</h2>
              <p className="text-xs text-sat-muted mt-1 font-semibold">
                Registry Modified: {new Date(fileData.updatedAt).toLocaleString()}
              </p>
            </div>
            
            {/* Quick Actions Panel */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleSatCheck}
                disabled={isSatChecking || isScoring}
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold border border-slate-350 text-sat-dark bg-slate-100 hover:bg-slate-200 rounded shadow-sm transition disabled:opacity-50 uppercase tracking-wider"
              >
                {isSatChecking ? 'Running SAT Check...' : 'Run SAT Compliance Check'}
              </button>
              
              <button
                onClick={handleScoreRecalculate}
                disabled={isSatChecking || isScoring}
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold bg-sat-primary hover:bg-blue-900 text-white rounded shadow-sm transition disabled:opacity-50 uppercase tracking-wider"
              >
                {isScoring ? 'Recalculating...' : 'Recalculate Score'}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-350 text-rose-800 text-xs rounded font-medium flex items-start space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-350 mb-6 flex flex-wrap gap-2">
          {(['overview', 'documents', 'sat', 'score', 'audit'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 font-bold text-xs border-b-2 uppercase tracking-wider transition ${
                activeTab === tab
                  ? 'border-sat-primary text-sat-primary font-extrabold'
                  : 'border-transparent text-sat-muted hover:text-sat-dark'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className="space-y-6">
          
          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* File Info */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white rounded border border-slate-350 shadow-sm p-6">
                  <h3 className="font-bold text-sm text-sat-primary uppercase tracking-wide mb-4">Taxpayer Profile Summary</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-t border-slate-100 pt-4">
                    <div>
                      <span className="font-bold text-sat-muted block uppercase tracking-wider mb-1">RFC (Taxpayer ID)</span>
                      <span className="font-mono text-sm font-bold text-sat-dark">{fileData.rfc}</span>
                    </div>
                    <div>
                      <span className="font-bold text-sat-muted block uppercase tracking-wider mb-1">Razón Social (Legal Name)</span>
                      <span className="font-bold text-sat-dark text-sm">{fileData.legalName}</span>
                    </div>
                    <div>
                      <span className="font-bold text-sat-muted block uppercase tracking-wider mb-1">Compliance Status</span>
                      <div className="mt-1">
                        <StatusBadge status={fileData.status} />
                      </div>
                    </div>
                    <div>
                      <span className="font-bold text-sat-muted block uppercase tracking-wider mb-1">Created At</span>
                      <span className="font-semibold text-sat-dark text-sm">
                        {new Date(fileData.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Documents Summary */}
                <div className="bg-white rounded border border-slate-350 shadow-sm p-6">
                  <h3 className="font-bold text-sm text-sat-primary uppercase tracking-wide mb-4">Verification Audits Summary</h3>
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between text-xs py-2 border-b border-slate-100">
                      <span className="text-sat-muted font-bold uppercase tracking-wider">Compliance Documents Uploaded</span>
                      <span className="font-bold text-sat-dark">
                        {fileData.documents.filter(d => d.isActive).length} / 5 required
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-2 border-b border-slate-100">
                      <span className="text-sat-muted font-bold uppercase tracking-wider">Blacklist Checks Performed</span>
                      <span className="font-bold text-sat-dark">
                        {fileData.satListChecks.length} lists cached
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-2">
                      <span className="text-sat-muted font-bold uppercase tracking-wider">Current Risk Index</span>
                      <span className={`font-extrabold text-sm ${isHighRisk ? 'text-sat-danger animate-pulse' : 'text-sat-dark'}`}>
                        {fileData.riskScore ? `${fileData.riskScore.score} PTS` : 'UNEVALUATED'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Risk Summary */}
              <div>
                <div className="sticky top-24 space-y-6">
                  {fileData.riskScore ? (
                    <div className={`p-5 rounded border shadow-sm ${
                      isHighRisk 
                        ? 'bg-rose-50 border-rose-350' 
                        : fileData.riskScore.level === 'review_required' 
                          ? 'bg-amber-50 border-amber-350' 
                          : 'bg-emerald-50 border-emerald-350'
                    }`}>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-sat-muted mb-3">Overall Assessment</h4>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-4xl font-extrabold tracking-tight text-sat-dark">{fileData.riskScore.score}</span>
                        <span className="text-xs uppercase font-bold text-sat-muted">PTS</span>
                      </div>
                      <p className="text-xs text-sat-dark mt-2 leading-relaxed font-semibold">
                        {fileData.riskScore.explanation}
                      </p>
                      <div className="mt-4 pt-4 border-t border-slate-350 text-xs">
                        <span className="font-bold text-sat-muted block uppercase tracking-wider mb-1">System Action</span>
                        <span className="font-bold text-sat-secondary uppercase tracking-wide">{fileData.riskScore.suggestedAction}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-350 text-center rounded p-5 text-xs text-sat-muted font-semibold">
                      Please execute risk scoring models to fetch the assessment card.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Documents */}
          {activeTab === 'documents' && (
            <div className="bg-white rounded border border-slate-350 shadow-sm p-6">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h3 className="font-bold text-sm text-sat-primary uppercase tracking-wide">KYB Document Vault</h3>
                <p className="text-xs text-sat-muted mt-0.5 font-semibold">Review and upload active corporate files.</p>
                
                {/* Working PDF Upload Section */}
                <form onSubmit={handleUploadSubmit} className="mt-4 p-4 border border-slate-305 rounded bg-slate-50 space-y-4">
                  <span className="font-bold text-[10px] text-sat-muted block uppercase tracking-widest">COMPLIANCE DOCUMENT UPLOAD CONSOLE</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    
                    {/* Document Type Dropdown */}
                    <div>
                      <label htmlFor="upload-doc-type" className="block text-[10px] font-bold text-sat-muted uppercase tracking-wider mb-1">
                        Document Type
                      </label>
                      <select
                        id="upload-doc-type"
                        value={uploadDocType}
                        onChange={(e) => setUploadDocType(e.target.value)}
                        className="block w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded text-sat-dark font-medium"
                      >
                        <option value="tax_status_certificate">Tax Status Certificate (CSF)</option>
                        <option value="articles_of_incorporation">Articles of Incorporation</option>
                        <option value="legal_representative_id">Legal Representative ID</option>
                        <option value="proof_of_address">Proof of Address</option>
                      </select>
                    </div>

                    {/* File Input */}
                    <div>
                      <label htmlFor="pdf-file-input" className="block text-[10px] font-bold text-sat-muted uppercase tracking-wider mb-1">
                        Select PDF Document
                      </label>
                      <input
                        id="pdf-file-input"
                        type="file"
                        accept=".pdf"
                        required
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="block w-full text-xs text-sat-dark border border-slate-300 rounded bg-white px-2 py-1"
                      />
                    </div>

                    {/* Submit Button */}
                    <div>
                      <button
                        type="submit"
                        disabled={isUploading || !selectedFile}
                        className="w-full inline-flex items-center justify-center px-4 py-2 text-xs font-bold bg-sat-primary hover:bg-blue-900 text-white rounded transition disabled:opacity-50 uppercase tracking-wider cursor-pointer"
                      >
                        {isUploading ? 'Extracting...' : 'Upload & Extract'}
                      </button>
                    </div>

                  </div>

                  {/* Feedback Alerts */}
                  {uploadSuccess && (
                    <div className="text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-300 p-2.5 rounded">
                      Document uploaded successfully! Metadata extraction complete.
                    </div>
                  )}
                  {uploadError && (
                    <div className="text-xs text-rose-800 font-bold bg-rose-50 border border-rose-350 p-2.5 rounded">
                      Upload/Extraction Error: {uploadError}
                    </div>
                  )}
                </form>
              </div>

              {fileData.documents.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded p-8 text-center text-xs text-sat-muted font-semibold">
                  No documents have been uploaded to this vault.
                </div>
              ) : (
                <div className="space-y-4">
                  {fileData.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-4 rounded border transition ${
                        doc.isActive
                          ? 'border-slate-350 bg-white'
                          : 'border-slate-200 bg-slate-50/50 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-slate-100 rounded text-sat-primary shrink-0 border border-slate-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-bold text-sat-dark text-sm">
                              {documentTypeLabels[doc.type] || doc.type}
                            </h4>
                            <p className="text-sat-muted font-semibold mt-0.5">{doc.name}</p>
                            <div className="flex items-center space-x-2 text-[10px] text-sat-muted mt-1 font-bold">
                              <span>VERSION v{doc.version}</span>
                              <span>&bull;</span>
                              {doc.issueDate && (
                                <span>ISSUED {new Date(doc.issueDate).toLocaleDateString()}</span>
                              )}
                              {doc.expirationDate && (
                                <>
                                  <span>&bull;</span>
                                  <span className={new Date(doc.expirationDate) < new Date() ? 'text-sat-danger font-extrabold' : ''}>
                                    EXPIRES {new Date(doc.expirationDate).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-sat-success border-emerald-200`}>
                            ✓ Confirmed
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            doc.isActive 
                              ? 'bg-blue-50 text-sat-secondary border-blue-200' 
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}>
                            {doc.isActive ? 'Active' : 'Archived'}
                          </span>
                        </div>
                      </div>

                      {doc.aiExtractedData && (
                        <div className="mt-4 pt-4 border-t border-slate-200 text-xs">
                          <div className="bg-slate-50 border border-slate-350 rounded p-4">
                            <span className="font-bold text-sat-muted block uppercase tracking-wider mb-2">AI Extracted Metadata</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-700">
                              {Object.entries(doc.aiExtractedData).map(([key, val]) => {
                                if (val === null || val === undefined) return null;
                                
                                // Format dates nicely if they are strings representing ISO dates
                                let displayVal = String(val);
                                if (key.toLowerCase().includes('date') && typeof val === 'string') {
                                  const dateObj = new Date(val);
                                  if (!isNaN(dateObj.getTime())) {
                                    displayVal = dateObj.toLocaleDateString();
                                  }
                                }
                                
                                // Format key to title case
                                const displayKey = key
                                  .replace(/([A-Z])/g, ' $1')
                                  .replace(/^./, str => str.toUpperCase());
 
                                return (
                                  <div key={key} className="border-b border-slate-200/50 pb-2">
                                    <span className="text-[10px] text-sat-muted block uppercase tracking-wider mb-0.5">{displayKey}</span>
                                    <span className="font-bold text-sat-dark">{displayVal}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Hash and actions footer */}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <div className="text-[10px] font-mono text-slate-400">
                          {doc.pdfHash ? `HASH: ${doc.pdfHash.substring(0, 16)}...` : 'HASH: N/A'}
                        </div>
                        <div className="flex items-center space-x-2">
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 text-[10px] font-bold border border-slate-300 hover:bg-slate-50 text-sat-primary rounded uppercase tracking-wider text-center"
                            >
                              View PDF
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="px-2.5 py-1 text-[10px] font-bold bg-sat-danger hover:bg-red-700 text-white rounded uppercase tracking-wider cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: SAT Check */}
          {activeTab === 'sat' && (
            <div className="bg-white rounded border border-slate-350 shadow-sm p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="font-bold text-sm text-sat-primary uppercase tracking-wide">SAT Blacklist Verification</h3>
                  <p className="text-xs text-sat-muted mt-0.5 font-semibold">Queries real-time compliance blacklists using verified government datasets.</p>
                </div>
                <button
                  onClick={handleSatCheck}
                  disabled={isSatChecking || isScoring}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold bg-sat-primary hover:bg-blue-900 text-white rounded transition disabled:opacity-50 uppercase tracking-wider"
                >
                  {isSatChecking ? 'Running Check...' : 'Trigger Live Check'}
                </button>
              </div>

              <SATSignals
                signals={satSignalsObject}
                art_49_bis_status={getArt49BisStatus()}
                recommendation={getLatestRecommendation()}
                checkedAt={getLatestCheckedAt()}
              />
            </div>
          )}

          {/* Tab 4: Risk Score */}
          {activeTab === 'score' && (
            <div className="space-y-6">
              <RiskScoreCard
                score={fileData.riskScore || undefined}
                onRecalculate={handleScoreRecalculate}
                isLoading={isScoring}
              />
            </div>
          )}

          {/* Tab 5: Audit Log */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded border border-slate-350 shadow-sm p-6">
              <h3 className="font-bold text-sm text-sat-primary uppercase tracking-wide mb-4">Compliance History Logs</h3>
              <AuditTable logs={fileData.auditLogs} />
            </div>
          )}

        </div>
      </main>

      {/* Floating compliance approvals footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-350 shadow-md py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="text-xs">
            <span className="text-sat-muted font-bold block uppercase tracking-wider mb-0.5">Dossier Evaluation Status</span>
            <span className="font-extrabold text-sat-dark text-sm">
              CURRENT STATE: {fileData.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Reject Button */}
            <button
              onClick={() => handleStatusTransition('rejected')}
              disabled={isTransitioning || fileData.status === 'rejected'}
              className="inline-flex items-center justify-center px-4 py-2 bg-sat-danger hover:bg-red-700 text-white border border-red-700 rounded text-xs font-bold uppercase tracking-wider transition disabled:opacity-40"
            >
              {isTransitioning ? 'Processing...' : 'Reject File'}
            </button>

            {/* Approve Button */}
            <div className="relative group">
              <button
                onClick={() => handleStatusTransition('approved')}
                disabled={isTransitioning || isHighRisk || fileData.status === 'approved'}
                className="inline-flex items-center justify-center px-4 py-2 bg-sat-success hover:bg-green-700 disabled:bg-slate-100 text-white disabled:text-slate-400 disabled:border disabled:border-slate-300 rounded text-xs font-bold uppercase tracking-wider transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isTransitioning ? 'Processing...' : 'Approve File'}
              </button>
              {isHighRisk && (
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-sat-dark text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap font-bold z-50 uppercase tracking-widest border border-slate-700">
                  Blocked due to high risk
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
