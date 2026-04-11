import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const secUrl = request.nextUrl.searchParams.get('url');

  if (!secUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate it's a SEC Archives URL
  if (!secUrl.startsWith('https://www.sec.gov/Archives/')) {
    return NextResponse.json({ error: 'Invalid SEC URL' }, { status: 400 });
  }

  const apiKey = process.env.SEC_API_KEY;
  if (!apiKey || apiKey === 'your_sec_api_key_here') {
    return NextResponse.json(
      { error: 'SEC API key not configured. Set SEC_API_KEY in Vercel environment variables.' },
      { status: 500 }
    );
  }

  // Redirect to sec-api.io PDF endpoint (preserves API key server-side)
  const pdfUrl = `https://api.sec-api.io/filing-reader?token=${apiKey}&url=${encodeURIComponent(secUrl)}&type=pdf`;
  return NextResponse.redirect(pdfUrl);
}
