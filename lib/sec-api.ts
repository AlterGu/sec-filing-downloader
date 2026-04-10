import type { Company, Filing, FilingSearchParams } from './types';

const RATE_LIMIT_MS = 110; // SEC allows 10 req/sec, be conservative

// SEC requires a User-Agent with contact information
const SEC_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Simple rate limiter: queue requests with minimum interval
let lastRequestTime = 0;
const rateLimitedFetch = async (url: string, headers?: Record<string, string>): Promise<Response> => {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, { headers: { ...SEC_HEADERS, ...headers } });
};

// Convert CIK to 10-digit zero-padded string
export function padCik(cik: string | number): string {
  return String(cik).padStart(10, '0');
}

// Convert CIK to stripped form (no leading zeros) for SEC Archives URL path
export function stripCik(cik: string | number): string {
  return String(cik).replace(/^0+/, '') || '0';
}

// Remove all dashes from accession number for folder path
// e.g., 0001628280-25-008724 -> 000162828025008724
export function accessionToFolder(accessionNumber: string): string {
  return accessionNumber.replace(/-/g, '');
}

// Build SEC Archives document URL for a filing
// URL pattern: https://www.sec.gov/Archives/edgar/data/{cik_stripped}/{accession_no_dashes}/{primaryDocument}
export function buildFilingUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const cikStripped = stripCik(cik);
  const folder = accessionToFolder(accessionNumber);
  return `https://www.sec.gov/Archives/edgar/data/${cikStripped}/${folder}/${primaryDocument}`;
}

// Build the SEC EDGAR filing page URL (for "View" link)
export function buildFilingPageUrl(cik: string, accessionNumber: string): string {
  // Modern SEC EDGAR URL format
  const accNoDash = accessionToFolder(accessionNumber);
  return `https://www.sec.gov/Archives/edgar/data/${stripCik(cik)}/${accNoDash}`;
}

// Search company by ticker using SEC EDGAR full-text search API
export async function searchCompany(ticker: string): Promise<Company> {
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(ticker)}&dateRange=custom&category=form-type&from=&to=&forms=${encodeURIComponent('10-K,10-Q,8-K')}`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(`SEC search failed: ${response.status}`);
  }

  const data = await response.json();
  const hits = data.hits?.hits || [];

  // Find the entity that exactly matches the ticker
  const upperTicker = ticker.toUpperCase();
  const entityHit = hits.find((hit: Record<string, unknown>) => {
    const source = hit._source as Record<string, unknown>;
    const displayNames = source.display_names as string[] || [];
    return displayNames.some((name: string) => name.toUpperCase().includes(`(${upperTicker})`));
  });

  if (!entityHit) {
    // Fallback: search in entity aggregations
    const aggs = data.aggregations?.entity_filter?.buckets || [];
    const match = aggs.find((b: Record<string, unknown>) => {
      const key = b.key as string;
      return key.toUpperCase().includes(`(${upperTicker})`);
    });

    if (!match) {
      throw new Error(`Company not found for ticker: ${ticker}`);
    }

    // Extract CIK from the entity name, e.g. "Rocket Lab USA, Inc.  (RKLB)  (CIK 0001819994)"
    const cikMatch = String(match.key).match(/CIK (\d+)/);
    if (!cikMatch) {
      throw new Error(`Could not extract CIK for: ${ticker}`);
    }

    // Get company name (everything before the ticker symbol)
    const nameMatch = String(match.key).match(/^(.+?)\s+\(/);
    const name = nameMatch ? nameMatch[1].trim() : ticker;

    return {
      cik: padCik(cikMatch[1]),
      name,
      ticker: upperTicker,
    };
  }

  const source = entityHit._source as Record<string, unknown>;
  const ciks = source.ciks as string[] || [];
  const displayNames = source.display_names as string[] || [];

  if (ciks.length === 0) {
    throw new Error(`No CIK found for ticker: ${ticker}`);
  }

  // Extract company name from display_name
  const displayName = displayNames[0] || '';
  const nameMatch = displayName.match(/^(.+?)\s+\(/);
  const name = nameMatch ? nameMatch[1].trim() : ticker;

  return {
    cik: padCik(ciks[0]),
    name,
    ticker: upperTicker,
  };
}

// Get filings for a company CIK
export async function getFilings(cik: string, params: FilingSearchParams = {}): Promise<{ filings: Filing[]; companyName: string }> {
  const paddedCik = padCik(cik);
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  const response = await rateLimitedFetch(url);
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
