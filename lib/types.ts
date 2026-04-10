export interface Company {
  cik: string;
  name: string;
  ticker: string;
}

export interface Filing {
  accessionNumber: string;
  filingDate: string;
  form: string;
  primaryDocument: string;
  primaryDocDescription: string;
  size?: number;
}

export interface FilingSearchParams {
  types?: string[];
  from?: string;
  to?: string;
}

export interface FilingsResponse {
  filings: Filing[];
  companyName: string;
}

export interface CompanySearchResult {
  cik: string;
  name: string;
  ticker: string;
}

export const FILING_TYPES = [
  '10-K',
  '10-Q',
  '8-K',
  'S-1',
  '4',
  'DEF 14A',
  'SC 13G',
  '13F',
] as const;

export type FilingType = typeof FILING_TYPES[number];
