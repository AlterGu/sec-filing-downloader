import { NextRequest, NextResponse } from 'next/server';
import { getFilings } from '@/lib/sec-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  const { cik } = await params;
  const { searchParams } = new URL(request.url);

  const types = searchParams.get('types')?.split(',').filter(Boolean) || [];
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  if (!cik) {
    return NextResponse.json({ error: 'CIK is required' }, { status: 400 });
  }

  try {
    const result = await getFilings(cik, { types, from, to });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
