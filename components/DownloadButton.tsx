'use client';

import { useState } from 'react';
import { Filing } from '@/lib/types';
import { buildFilingUrl } from '@/lib/sec-api';

interface DownloadButtonProps {
  filings: Filing[];
  selectedIndices: Set<number>;
  ticker: string;
  cik: string;
}

export default function DownloadButton({ filings, selectedIndices, ticker, cik }: DownloadButtonProps) {
  const [copied, setCopied] = useState(false);

  if (selectedIndices.size === 0) {
    return null;
  }

  const selectedFilings = Array.from(selectedIndices).map(i => filings[i]);
  const urls = selectedFilings.map(f => ({
    secUrl: buildFilingUrl(cik, f.accessionNumber, f.primaryDocument),
    label: `${f.form} ${f.filingDate}`,
  }));

  const handleOpenInBrowser = () => {
    if (selectedFilings.length > 5) {
      alert('Too many files selected. Please use "Copy Links" instead to avoid popup blocker.');
      return;
    }
    urls.forEach(item => {
      window.open(item.secUrl, '_blank');
    });
  };

  const handleDownloadPdf = () => {
    urls.forEach((item, index) => {
      setTimeout(() => {
        const pdfProxyUrl = `/api/download-pdf?url=${encodeURIComponent(item.secUrl)}`;
        window.open(pdfProxyUrl, '_blank');
      }, index * 500);
    });
  };

  const handleCopyLinks = async () => {
    const text = urls.map(item => `${item.label}\n${item.secUrl}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(urls.map(item => item.secUrl).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {/* Copy Links Button */}
      <button
        onClick={handleCopyLinks}
        className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-full shadow-lg flex items-center gap-2 px-5 py-3 cursor-pointer transition-all hover:scale-105"
      >
        {copied ? (
          <>
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Copied!</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            <span className="font-medium">Copy {selectedIndices.size} Link{selectedIndices.size > 1 ? 's' : ''}</span>
          </>
        )}
      </button>

      {/* Open in Browser Button */}
      <button
        onClick={handleOpenInBrowser}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center gap-2 px-5 py-3 cursor-pointer transition-all hover:scale-105"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        <span className="font-semibold">Open in Browser</span>
        <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
          {selectedIndices.size}
        </span>
      </button>

      {/* Download PDF Button */}
      <button
        onClick={handleDownloadPdf}
        className="bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center gap-2 px-5 py-3 cursor-pointer transition-all hover:scale-105"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="font-semibold">Download PDF</span>
        <span className="bg-white text-green-600 text-xs font-bold px-2 py-0.5 rounded-full">
          {selectedIndices.size}
        </span>
      </button>

      {selectedFilings.length > 5 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          5+ files: use Copy Links
        </p>
      )}
    </div>
  );
}
