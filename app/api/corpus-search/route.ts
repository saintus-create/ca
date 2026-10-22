import { NextRequest, NextResponse } from 'next/server';
import { searchCorpus } from '@/lib/corpus-search';

// Direct search over the local California corpus.
// GET /api/corpus-search?q=retroactive&dataset=PEN&limit=5
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const dataset = req.nextUrl.searchParams.get('dataset') || undefined;
  const limit = Math.min(25, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 5)));
  if (!q) {
    return NextResponse.json({ error: 'q is required' }, { status: 400 });
  }
  const hits = await searchCorpus(q, dataset, limit);
  return NextResponse.json({ query: q, dataset: dataset || null, count: hits.length, hits });
}
