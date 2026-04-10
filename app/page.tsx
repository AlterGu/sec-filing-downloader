'use client';

import { useState, useCallback } from 'react';
import SearchForm from '@/components/SearchForm';
import FilingTable from '@/components/FilingTable';
import DownloadButton from '@/components/DownloadButton';
import { Filing, Company } from '@/lib/types';

export default function Home() {
  const [company, setCompany] = useState<Company | null>(null);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string>('');

  const handleSearch = useCallback(async (
    ticker: string,
    types: string[],
    from: string,
    to: string
  ) => {
    setLoading(true);
    setSearchError('');
    setSelectedIndices(new Set());

    try {
      // Step 1: Search for company CIK
      const searchRes = await fetch(`/api/search?ticker=${encodeURIComponent(ticker)}`);
      if (!searchRes.ok) {
        const err = await searchRes.json();
        throw new Error(err.error || 'Company not found');
      }
      const companyData: Company = await searchRes.json();
      setCompany(companyData);

      // Step 2: Get filings for that CIK
      const params = new URLSearchParams();
      if (types.length > 0) params.set('types', types.join(','));
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const filingsRes = await fetch(
        `/api/filings/${companyData.cik}?${params.toString()}`
      );
      if (!filingsRes.ok) {
        const err = await filingsRes.json();
        throw new Error(err.error || 'Failed to fetch filings');
      }
      const filingsData = await filingsRes.json();
      setFilings(filingsData.filings || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setSearchError(msg);
      setFilings([]);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleIndex = useCallback((index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIndices(prev => {
      if (prev.size === filings.length) {
        return new Set();
      }
      return new Set(filings.map((_, i) => i));
    });
  }, [filings]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            SEC Filing Downloader
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Batch download SEC EDGAR filings for US stocks
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Section */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <SearchForm onSearch={handleSearch} loading={loading} error={searchError} />
        </section>

        {/* Company Info */}
        {company && (
          <section className="mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{company.ticker}</span>
              <span className="text-gray-600 dark:text-gray-400">{company.name}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">CIK: {company.cik}</span>
            </div>
          </section>
        )}

        {/* Results Info */}
        {filings.length > 0 && (
          <section className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Found <strong className="text-gray-900 dark:text-white">{filings.length}</strong> filings
              {selectedIndices.size > 0 && (
                <span className="ml-2">
                  · <strong className="text-blue-600 dark:text-blue-400">{selectedIndices.size}</strong> selected
                </span>
              )}
            </p>
            {selectedIndices.size > 0 && selectedIndices.size < filings.length && (
              <button
                onClick={toggleAll}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Select all {filings.length}
              </button>
            )}
          </section>
        )}

        {/* Filing Table */}
        {filings.length > 0 && (
          <section className="mb-24">
            <FilingTable
              filings={filings}
              ticker={company?.ticker || ''}
              cik={company?.cik || ''}
              selectedIndices={selectedIndices}
              onToggleIndex={toggleIndex}
              onToggleAll={toggleAll}
            />
          </section>
        )}

        {/* Empty State - show when searched but no results */}
        {!loading && filings.length === 0 && company && !searchError && (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <p>No filings match your filter criteria. Try adjusting the date range or filing types.</p>
          </div>
        )}
      </div>

      {/* Download Button (floating) */}
      {company && filings.length > 0 && (
        <DownloadButton
          filings={filings}
          selectedIndices={selectedIndices}
          ticker={company.ticker}
          cik={company.cik}
        />
      )}
    </main>
  );
}
