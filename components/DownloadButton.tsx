'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Filing } from '@/lib/types';
import { buildFilingUrl } from '@/lib/sec-api';

interface DownloadButtonProps {
  filings: Filing[];
  selectedIndices: Set<number>;
  ticker: string;
  cik: string;
}

export default function DownloadButton({ filings, selectedIndices, ticker, cik }: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  if (selectedIndices.size === 0) {
    return null;
  }

  const selectedFilings = Array.from(selectedIndices).map(i => filings[i]);

  const handleDownload = async () => {
    setDownloading(true);
    setProgress(0);
    setStatusText('Preparing ZIP...');

    const zip = new JSZip();
    const folder = zip.folder(ticker) || zip;

    let completed = 0;

    for (const filing of selectedFilings) {
      const docUrl = buildFilingUrl(cik, filing.accessionNumber, filing.primaryDocument);
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(docUrl)}`;

      setStatusText(`Fetching ${filing.form} - ${filing.filingDate}...`);

      try {
        // Fetch through our CORS proxy
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch ${docUrl}: ${response.status}`);
          completed++;
          setProgress((completed / selectedFilings.length) * 100);
          continue;
        }

        const blob = await response.blob();
        const filename = `${ticker}_${filing.form}_${filing.filingDate}_${filing.primaryDocument}`;
        folder.file(filename, blob);
      } catch (err) {
        console.warn(`Error fetching ${docUrl}:`, err);
      }

      completed++;
      setProgress((completed / selectedFilings.length) * 100);

      // Small delay to avoid hammering our own API
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    setStatusText('Generating ZIP...');

    try {
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      saveAs(zipBlob, `${ticker}_filings_${new Date().toISOString().split('T')[0]}.zip`);
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
      alert('Failed to generate ZIP file. Try selecting fewer filings.');
    }

    setDownloading(false);
    setProgress(0);
    setStatusText('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center gap-3 px-5 py-3 cursor-pointer transition-all hover:scale-105">
        {downloading ? (
          <div className="flex items-center gap-3">
            <div className="w-48 h-2 bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-medium whitespace-nowrap">{Math.round(progress)}%</span>
          </div>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <button
              onClick={handleDownload}
              className="font-semibold"
            >
              Download {selectedIndices.size} File{selectedIndices.size > 1 ? 's' : ''}
            </button>
            <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {selectedIndices.size}
            </span>
          </>
        )}
      </div>
      {downloading && statusText && (
        <div className="absolute bottom-full mb-2 right-0 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">
          {statusText}
        </div>
      )}
    </div>
  );
}
