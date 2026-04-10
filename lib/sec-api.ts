import type { Company, Filing, FilingSearchParams } from './types';

const SEC_BASE = 'https://data.sec.gov';
const RATE_LIMIT_MS = 110; // SEC allows 10 req/sec, be conservative

// Simple rate limiter: queue requests with minimum interval
let lastRequestTime = 0;
const rateLimitedFetch = async (url: string, headers?: Record<string, string>): Promise<Response> => {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, { headers });
};

// Convert CIK to 10-digit zero-padded string
export function padCik(cik: string | number): string {
  return String(cik).padStart(10, '0');
}

// Convert accession number to folder path for Archives URL
// e.g., 0000320193-23-000123 -> 0000320193/23000123
export function accessionToPath(accessionNumber: string): string {
  const parts = accessionNumber.split('-');
  if (parts.length !== 3) return accessionNumber.replace(/-/g, '');
  const cik = parts[0];
  const yy = parts[1];
  const seq = parts[2];
  return `${cik}/${yy}${seq}`;
}

// Build document URL for a filing
export function buildFilingUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const paddedCik = padCik(cik);
  const path = accessionToPath(accessionNumber);
  return `https://www.sec.gov/Archives/edgar/data/${paddedCik}/${path}/${primaryDocument}`;
}

// Search company by ticker symbol
export async function searchCompany(ticker: string): Promise<Company> {
  // SEC company tickers JSON - updated daily
  const url = `${SEC_BASE}/company_tickers.json`;
  const response = await rateLimitedFetch(url, {
    'User-Agent': 'Mozilla/5.0 (compatible; SEC-Downloader/1.0)',
    'Accept': 'application/json',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch company tickers: ${response.status}`);
  }

  const data = await response.json();
  const entries = data.data || data;

  // Find by ticker (case-insensitive)
  const upperTicker = ticker.toUpperCase();
  const entry = entries.find((e: unknown[]) => {
    const eTicker = Array.isArray(e) ? e[1] : (e as Record<string, unknown>)?.ticker;
    return typeof eTicker === 'string' && eTicker.toUpperCase() === upperTicker;
  });

  if (!entry) {
    throw new Error(`Company not found for ticker: ${ticker}`);
  }

  // Handle different data structures
  let cik: string, name: string, coTicker: string;
  if (Array.isArray(entry)) {
    // data is [cik_str, ticker, name, ...]
    cik = String(entry[0]);
    coTicker = String(entry[1]);
    name = String(entry[2]);
  } else {
    cik = String((entry as Record<string, unknown>).cik || (entry as Record<string, unknown>)['cik_str']);
    coTicker = String((entry as Record<string, unknown>).ticker);
    name = String((entry as Record<string, unknown>).name);
  }

  return {
    cik: padCik(cik),
    name,
    ticker: coTicker,
  };
}

// Get filings for a company CIK
export async function getFilings(cik: string, params: FilingSearchParams = {}): Promise<{ filings: Filing[]; companyName: string }> {
  const paddedCik = padCik(cik);
  const url = `${SEC_BASE}/submissions/CIK${paddedCik}.json`;

  const response = await rateLimitedFetch(url, {
    'User-Agent': 'Mozilla/5.0 (compatible; SEC-Downloader/1.0)',
    'Accept': 'application/json',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch filings: ${response.status}`);
  }

  const data = await response.json();
  const recent = data.filings?.recent;

  if (!recent) {
    throw new Error(`Invalid response for CIK: ${cik}`);
  }

  const companyName: string = data.name || data.companyName || '';

  const {
    accessionNumber = [],
    filingDate = [],
    form = [],
    primaryDocument = [],
    primaryDocDescription = [],
    size = [],
  } = recent;

  const filings: Filing[] = [];

  for (let i = 0; i < accessionNumber.length; i++) {
    const type = form[i] as string;
    const date = filingDate[i] as string;

    // Apply filters
    if (params.types && params.types.length > 0) {
      // Handle partial matches like "10-K" matches "10-K/A"
      const typeMatches = params.types.some(t => type === t || type.startsWith(t + '/'));
      if (!typeMatches) continue;
    }

    if (params.from && date < params.from) continue;
    if (params.to && date > params.to) continue;

    filings.push({
      accessionNumber: accessionNumber[i] as string,
      filingDate: date,
      form: type,
      primaryDocument: primaryDocument[i] as string,
      primaryDocDescription: primaryDocDescription[i] as string,
      size: size[i] as number,
    });
  }

  return { filings, companyName };
}
