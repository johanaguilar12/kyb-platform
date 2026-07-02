'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewFilePage() {
  const router = useRouter();
  const [rfc, setRfc] = useState('');
  const [legalName, setLegalName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate Mexican RFC format
  const validateRfc = (value: string): boolean => {
    const cleanRfc = value.trim().toUpperCase();
    const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/;
    return rfcRegex.test(cleanRfc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    // Validate fields
    if (!rfc.trim() || !legalName.trim()) {
      setValidationError('All fields are required.');
      return;
    }

    if (!validateRfc(rfc)) {
      setValidationError('Invalid Mexican RFC format. Must be 12 characters (for companies) or 13 characters (for individuals), containing valid letters and digits.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfc: rfc.trim().toUpperCase(),
          legalName: legalName.trim(),
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        // Redirect to detail page
        router.push(`/file/${json.data.id}`);
      } else {
        setApiError(json.error || 'Failed to create the file. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setApiError('Network connection error. Failed to send data to the compliance servers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sat-bg text-sat-dark font-sans antialiased flex flex-col justify-between">
      {/* SAT Navigation Header */}
      <header className="bg-sat-primary text-white shadow border-b-4 border-sat-secondary">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Registry</span>
          </Link>
          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">New File Setup</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto px-4 py-12 flex-1 flex flex-col justify-center">
        <div className="bg-white rounded border border-slate-350 shadow-sm p-6">
          <h2 className="text-lg font-bold tracking-wide uppercase text-sat-primary">TAXPAYER REGISTER SETUP</h2>
          <p className="text-xs text-sat-muted mt-1 font-semibold leading-relaxed">
            Create a compliance dossier. Please enter the official legal name (Razón Social) and the valid Taxpayer ID (RFC) exactly as listed on the Tax Status Certificate.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Legal Name */}
            <div>
              <label htmlFor="legalName" className="block text-xs font-bold text-sat-muted uppercase tracking-wider mb-1.5">
                Official Legal Name (Razón Social)
              </label>
              <input
                id="legalName"
                type="text"
                required
                placeholder="e.g. ACME SERVICES S.A. DE C.V."
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="block w-full px-3 py-2 text-xs bg-slate-50 border border-slate-350 rounded focus:outline-none focus:ring-1 focus:ring-sat-secondary focus:border-sat-secondary text-sat-dark font-medium"
              />
            </div>

            {/* RFC */}
            <div>
              <label htmlFor="rfc" className="block text-xs font-bold text-sat-muted uppercase tracking-wider mb-1.5">
                Taxpayer ID (RFC)
              </label>
              <input
                id="rfc"
                type="text"
                required
                placeholder="e.g. ACM010101XYZ"
                value={rfc}
                onChange={(e) => setRfc(e.target.value)}
                className="block w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-350 rounded focus:outline-none focus:ring-1 focus:ring-sat-secondary focus:border-sat-secondary uppercase text-sat-dark font-bold"
              />
            </div>

            {/* Errors alert box */}
            {(validationError || apiError) && (
              <div className="p-3 bg-rose-50 border border-rose-350 text-rose-800 text-xs rounded font-medium">
                <span className="font-bold block mb-0.5 uppercase tracking-wide">Validation failed:</span>
                {validationError || apiError}
              </div>
            )}

            {/* Submit Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-3">
              <Link
                href="/"
                className="px-4 py-2 text-xs font-bold border border-slate-350 text-sat-dark bg-slate-100 hover:bg-slate-200 rounded transition uppercase tracking-wider"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-sat-primary hover:bg-blue-900 text-white rounded transition shadow-sm disabled:opacity-50 uppercase tracking-wider"
              >
                {isSubmitting ? 'Creating...' : 'Register File'}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-[10px] text-sat-muted font-bold uppercase tracking-wider">
        &copy; {new Date().getFullYear()} Servicio de Administración Tributaria. Compliance Module.
      </footer>
    </div>
  );
}
